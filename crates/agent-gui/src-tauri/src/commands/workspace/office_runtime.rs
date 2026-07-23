use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::State;

const SIDECAR_STEM: &str = "arcforge-office-runtime";
const DEFAULT_TIMEOUT_MS: u64 = 180_000;
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 600_000;
const STDOUT_LIMIT_BYTES: usize = 4 * 1024 * 1024;
const STDERR_LIMIT_BYTES: usize = 1024 * 1024;

#[derive(Default)]
pub struct OfficeRuntimeRegistry {
    requests: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl OfficeRuntimeRegistry {
    fn register(&self, request_id: &str, cancelled: Arc<AtomicBool>) -> Result<(), String> {
        let mut requests = self
            .requests
            .lock()
            .map_err(|_| "Office Runtime cancellation registry is unavailable".to_string())?;
        if requests.contains_key(request_id) {
            return Err("Office Runtime request_id is already active".to_string());
        }
        requests.insert(request_id.to_string(), cancelled);
        Ok(())
    }

    fn cancel(&self, request_id: &str) -> bool {
        let Ok(requests) = self.requests.lock() else {
            return false;
        };
        let Some(cancelled) = requests.get(request_id) else {
            return false;
        };
        cancelled.store(true, Ordering::SeqCst);
        true
    }

    fn finish(&self, request_id: &str) {
        if let Ok(mut requests) = self.requests.lock() {
            requests.remove(request_id);
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeRuntimeRequest {
    request_id: String,
    workdir: String,
    document_type: String,
    action: String,
    spec_path: Option<String>,
    script_path: Option<String>,
    input_path: Option<String>,
    output_path: Option<String>,
    #[serde(default)]
    force: bool,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeRuntimeResponse {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
    timed_out: bool,
    cancelled: bool,
    duration_ms: u64,
    runtime: String,
    runtime_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficeRuntimeCancelResponse {
    cancelled: bool,
}

#[derive(Debug)]
struct PreparedInvocation {
    request_id: String,
    workdir: PathBuf,
    arguments: Vec<OsString>,
    timeout: Duration,
}

struct RuntimeProgram {
    program: PathBuf,
    prefix_arguments: Vec<OsString>,
    label: String,
}

struct CapturedOutput {
    text: String,
    truncated: bool,
}

fn trimmed_required<'a>(value: &'a str, label: &str) -> Result<&'a str, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(format!("{label} is required"))
    } else {
        Ok(trimmed)
    }
}

fn required_path<'a>(value: &'a Option<String>, label: &str) -> Result<&'a str, String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{label} is required for this Office Runtime action"))
}

fn reject_path(value: &Option<String>, label: &str) -> Result<(), String> {
    if value
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        Err(format!(
            "{label} is not valid for this Office Runtime action"
        ))
    } else {
        Ok(())
    }
}

fn reject_parent_components(raw: &str, label: &str) -> Result<(), String> {
    if Path::new(raw)
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(format!("{label} must not contain '..' path components"));
    }
    Ok(())
}

fn ensure_extension(path: &Path, expected: &str, label: &str) -> Result<(), String> {
    let actual = path.extension().and_then(OsStr::to_str).unwrap_or_default();
    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(format!("{label} must end with .{expected}"))
    }
}

fn ensure_within_workspace(path: &Path, workspace: &Path, label: &str) -> Result<(), String> {
    if path.starts_with(workspace) {
        Ok(())
    } else {
        Err(format!("{label} must stay inside the configured workspace"))
    }
}

fn absolute_candidate(base: &Path, raw: &str, label: &str) -> Result<PathBuf, String> {
    let raw = trimmed_required(raw, label)?;
    reject_parent_components(raw, label)?;
    let path = Path::new(raw);
    Ok(if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    })
}

fn resolve_existing_path(
    workspace: &Path,
    base: &Path,
    raw: &str,
    expected_extension: &str,
    label: &str,
) -> Result<PathBuf, String> {
    let candidate = absolute_candidate(base, raw, label)?;
    ensure_extension(&candidate, expected_extension, label)?;
    let canonical = std::fs::canonicalize(&candidate)
        .map_err(|error| format!("{label} does not exist or cannot be opened: {error}"))?;
    if !canonical.is_file() {
        return Err(format!("{label} must identify a file"));
    }
    ensure_within_workspace(&canonical, workspace, label)?;
    Ok(canonical)
}

fn resolve_output_path(
    workspace: &Path,
    raw: &str,
    expected_extension: &str,
    label: &str,
) -> Result<PathBuf, String> {
    let candidate = absolute_candidate(workspace, raw, label)?;
    ensure_extension(&candidate, expected_extension, label)?;

    let mut ancestor = candidate.clone();
    let mut missing_segments = Vec::<OsString>::new();
    while !ancestor.exists() {
        let segment = ancestor
            .file_name()
            .ok_or_else(|| format!("{label} has no existing parent directory"))?
            .to_os_string();
        missing_segments.push(segment);
        if !ancestor.pop() {
            return Err(format!("{label} has no existing parent directory"));
        }
    }

    let mut resolved = std::fs::canonicalize(&ancestor)
        .map_err(|error| format!("{label} parent cannot be opened: {error}"))?;
    ensure_within_workspace(&resolved, workspace, label)?;
    if missing_segments.is_empty() && !resolved.is_file() {
        return Err(format!("{label} must identify a file path"));
    }
    if !missing_segments.is_empty() && !resolved.is_dir() {
        return Err(format!("{label} parent must be a directory"));
    }
    for segment in missing_segments.iter().rev() {
        resolved.push(segment);
    }
    ensure_within_workspace(&resolved, workspace, label)?;
    Ok(resolved)
}

fn validate_presentation_assets(spec_path: &Path, workspace: &Path) -> Result<(), String> {
    let raw = std::fs::read_to_string(spec_path)
        .map_err(|error| format!("specPath could not be read: {error}"))?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("specPath is not valid JSON: {error}"))?;
    let Some(slides) = value.get("slides").and_then(serde_json::Value::as_array) else {
        return Ok(());
    };
    let spec_dir = spec_path.parent().unwrap_or(workspace);
    for (index, slide) in slides.iter().enumerate() {
        let Some(image) = slide.get("image").and_then(serde_json::Value::as_str) else {
            continue;
        };
        resolve_existing_path(
            workspace,
            spec_dir,
            image,
            Path::new(image)
                .extension()
                .and_then(OsStr::to_str)
                .unwrap_or_default(),
            &format!("slides[{index}].image"),
        )?;
    }
    Ok(())
}

fn push_path_argument(arguments: &mut Vec<OsString>, flag: &str, path: PathBuf) {
    arguments.push(OsString::from(flag));
    arguments.push(path.into_os_string());
}

fn prepare_invocation(input: OfficeRuntimeRequest) -> Result<PreparedInvocation, String> {
    let request_id = trimmed_required(&input.request_id, "requestId")?;
    if request_id.len() > 128
        || !request_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("requestId must contain only letters, digits, '-' or '_'".to_string());
    }

    let workdir_raw = trimmed_required(&input.workdir, "workdir")?;
    let workspace = std::fs::canonicalize(workdir_raw)
        .map_err(|error| format!("workdir does not exist or cannot be opened: {error}"))?;
    if !workspace.is_dir() {
        return Err("workdir must identify a directory".to_string());
    }

    let document_type = trimmed_required(&input.document_type, "documentType")?.to_lowercase();
    let action = trimmed_required(&input.action, "action")?.to_lowercase();
    let mut arguments = vec![OsString::from(&document_type), OsString::from(&action)];

    match (document_type.as_str(), action.as_str()) {
        ("spreadsheet", "create") => {
            reject_path(&input.input_path, "inputPath")?;
            reject_path(&input.script_path, "scriptPath")?;
            let spec = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.spec_path, "specPath")?,
                "json",
                "specPath",
            )?;
            let output = resolve_output_path(
                &workspace,
                required_path(&input.output_path, "outputPath")?,
                "xlsx",
                "outputPath",
            )?;
            push_path_argument(&mut arguments, "--spec", spec);
            push_path_argument(&mut arguments, "--output", output);
        }
        ("spreadsheet", "patch") => {
            reject_path(&input.script_path, "scriptPath")?;
            let workbook = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.input_path, "inputPath")?,
                "xlsx",
                "inputPath",
            )?;
            let spec = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.spec_path, "specPath")?,
                "json",
                "specPath",
            )?;
            let output = resolve_output_path(
                &workspace,
                required_path(&input.output_path, "outputPath")?,
                "xlsx",
                "outputPath",
            )?;
            push_path_argument(&mut arguments, "--input", workbook);
            push_path_argument(&mut arguments, "--spec", spec);
            push_path_argument(&mut arguments, "--output", output);
        }
        ("spreadsheet", "code") => {
            reject_path(&input.spec_path, "specPath")?;
            if let Some(raw_input) = input
                .input_path
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let workbook =
                    resolve_existing_path(&workspace, &workspace, raw_input, "xlsx", "inputPath")?;
                push_path_argument(&mut arguments, "--input", workbook);
            }
            let script = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.script_path, "scriptPath")?,
                "py",
                "scriptPath",
            )?;
            let output = resolve_output_path(
                &workspace,
                required_path(&input.output_path, "outputPath")?,
                "xlsx",
                "outputPath",
            )?;
            push_path_argument(&mut arguments, "--script", script);
            push_path_argument(&mut arguments, "--output", output);
        }
        ("spreadsheet", "inspect") => {
            reject_path(&input.spec_path, "specPath")?;
            reject_path(&input.script_path, "scriptPath")?;
            reject_path(&input.output_path, "outputPath")?;
            if input.force {
                return Err("force is not valid for inspect".to_string());
            }
            let workbook = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.input_path, "inputPath")?,
                "xlsx",
                "inputPath",
            )?;
            push_path_argument(&mut arguments, "--input", workbook);
        }
        ("presentation", "create") => {
            reject_path(&input.input_path, "inputPath")?;
            reject_path(&input.script_path, "scriptPath")?;
            let spec = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.spec_path, "specPath")?,
                "json",
                "specPath",
            )?;
            validate_presentation_assets(&spec, &workspace)?;
            let output = resolve_output_path(
                &workspace,
                required_path(&input.output_path, "outputPath")?,
                "pptx",
                "outputPath",
            )?;
            push_path_argument(&mut arguments, "--spec", spec);
            push_path_argument(&mut arguments, "--output", output);
        }
        ("presentation", "inspect") => {
            reject_path(&input.spec_path, "specPath")?;
            reject_path(&input.script_path, "scriptPath")?;
            reject_path(&input.output_path, "outputPath")?;
            if input.force {
                return Err("force is not valid for inspect".to_string());
            }
            let presentation = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.input_path, "inputPath")?,
                "pptx",
                "inputPath",
            )?;
            push_path_argument(&mut arguments, "--input", presentation);
        }
        ("presentation", "render") => {
            reject_path(&input.spec_path, "specPath")?;
            reject_path(&input.script_path, "scriptPath")?;
            let presentation = resolve_existing_path(
                &workspace,
                &workspace,
                required_path(&input.input_path, "inputPath")?,
                "pptx",
                "inputPath",
            )?;
            let output = resolve_output_path(
                &workspace,
                required_path(&input.output_path, "outputPath")?,
                "pdf",
                "outputPath",
            )?;
            push_path_argument(&mut arguments, "--input", presentation);
            push_path_argument(&mut arguments, "--output", output);
        }
        ("spreadsheet", _) => {
            return Err("Spreadsheet action must be create, patch, code, or inspect".to_string())
        }
        ("presentation", _) => {
            return Err("Presentation action must be create, inspect, or render".to_string())
        }
        _ => return Err("documentType must be spreadsheet or presentation".to_string()),
    }

    if input.force {
        arguments.push(OsString::from("--force"));
    }
    let timeout_ms = input.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
    if !(MIN_TIMEOUT_MS..=MAX_TIMEOUT_MS).contains(&timeout_ms) {
        return Err(format!(
            "timeoutMs must be between {MIN_TIMEOUT_MS} and {MAX_TIMEOUT_MS}"
        ));
    }

    Ok(PreparedInvocation {
        request_id: request_id.to_string(),
        workdir: workspace,
        arguments,
        timeout: Duration::from_millis(timeout_ms),
    })
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-x86_64-pc-windows-msvc.exe";
#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-aarch64-pc-windows-msvc.exe";
#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-x86_64-apple-darwin";
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-aarch64-apple-darwin";
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-x86_64-unknown-linux-gnu";
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
const SOURCE_SIDECAR_NAME: &str = "arcforge-office-runtime-aarch64-unknown-linux-gnu";

fn bundled_sidecar_name() -> String {
    if cfg!(target_os = "windows") {
        format!("{SIDECAR_STEM}.exe")
    } else {
        SIDECAR_STEM.to_string()
    }
}

fn resolve_runtime_program() -> Result<RuntimeProgram, String> {
    if let Some(override_path) = std::env::var_os("ARCFORGE_OFFICE_RUNTIME_PATH") {
        let path = PathBuf::from(override_path);
        let canonical = std::fs::canonicalize(&path).map_err(|error| {
            format!("ARCFORGE_OFFICE_RUNTIME_PATH does not identify a file: {error}")
        })?;
        if !canonical.is_file() {
            return Err("ARCFORGE_OFFICE_RUNTIME_PATH must identify a file".to_string());
        }
        return Ok(RuntimeProgram {
            program: canonical,
            prefix_arguments: Vec::new(),
            label: "path-override".to_string(),
        });
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(executable_dir) = current_exe.parent() {
            let bundled = executable_dir.join(bundled_sidecar_name());
            if bundled.is_file() {
                return Ok(RuntimeProgram {
                    program: bundled,
                    prefix_arguments: Vec::new(),
                    label: "bundled-sidecar".to_string(),
                });
            }
        }
    }

    let source_sidecar = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(SOURCE_SIDECAR_NAME);
    if source_sidecar.is_file() {
        return Ok(RuntimeProgram {
            program: source_sidecar,
            prefix_arguments: Vec::new(),
            label: "development-sidecar".to_string(),
        });
    }

    let allow_python_fallback = cfg!(debug_assertions)
        || std::env::var("ARCFORGE_OFFICE_RUNTIME_ALLOW_PYTHON_FALLBACK")
            .is_ok_and(|value| value == "1");
    if allow_python_fallback {
        let wrapper = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| "Could not locate the Office Runtime source wrapper".to_string())?
            .join("scripts")
            .join("office_runtime.py");
        if wrapper.is_file() {
            let python = std::env::var_os("ARCFORGE_OFFICE_RUNTIME_PYTHON")
                .unwrap_or_else(|| OsString::from("python"));
            return Ok(RuntimeProgram {
                program: PathBuf::from(python),
                prefix_arguments: vec![wrapper.into_os_string()],
                label: "development-python-fallback".to_string(),
            });
        }
    }

    Err(
        "ArcForge Office Runtime is missing. Reinstall ArcForge or run pnpm sidecar:build before starting the desktop app."
            .to_string(),
    )
}

fn read_capped<R: Read>(mut reader: R, limit: usize) -> CapturedOutput {
    let mut bytes = Vec::with_capacity(limit.min(64 * 1024));
    let mut buffer = [0_u8; 8192];
    let mut total = 0_usize;
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => {
                total = total.saturating_add(count);
                if bytes.len() < limit {
                    let keep = count.min(limit - bytes.len());
                    bytes.extend_from_slice(&buffer[..keep]);
                }
            }
            Err(error) => {
                let message = format!("\n[output read error: {error}]");
                let remaining = limit.saturating_sub(bytes.len());
                bytes.extend_from_slice(&message.as_bytes()[..message.len().min(remaining)]);
                break;
            }
        }
    }
    CapturedOutput {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        truncated: total > bytes.len(),
    }
}

fn wait_for_child(
    child: &mut std::process::Child,
    timeout: Duration,
    cancelled: &AtomicBool,
) -> Result<(ExitStatus, bool, bool), String> {
    let started = Instant::now();
    loop {
        if cancelled.load(Ordering::SeqCst) {
            let _ = child.kill();
            let status = child
                .wait()
                .map_err(|error| format!("Failed to reap cancelled Office Runtime: {error}"))?;
            return Ok((status, false, true));
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let status = child
                .wait()
                .map_err(|error| format!("Failed to reap timed-out Office Runtime: {error}"))?;
            return Ok((status, true, false));
        }
        match child.try_wait() {
            Ok(Some(status)) => return Ok((status, false, false)),
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Failed while waiting for Office Runtime: {error}"));
            }
        }
    }
}

fn run_office_runtime(
    invocation: PreparedInvocation,
    cancelled: Arc<AtomicBool>,
) -> Result<OfficeRuntimeResponse, String> {
    let runtime = resolve_runtime_program()?;
    let runtime_path = runtime.program.to_string_lossy().into_owned();
    let mut command = Command::new(&runtime.program);
    command
        .args(&runtime.prefix_arguments)
        .args(&invocation.arguments)
        .current_dir(&invocation.workdir)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let started = Instant::now();
    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start ArcForge Office Runtime: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture Office Runtime stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture Office Runtime stderr".to_string())?;
    let stdout_reader = thread::spawn(move || read_capped(stdout, STDOUT_LIMIT_BYTES));
    let stderr_reader = thread::spawn(move || read_capped(stderr, STDERR_LIMIT_BYTES));

    let status_result = wait_for_child(&mut child, invocation.timeout, &cancelled);
    let captured_stdout = stdout_reader
        .join()
        .map_err(|_| "Office Runtime stdout reader failed".to_string())?;
    let captured_stderr = stderr_reader
        .join()
        .map_err(|_| "Office Runtime stderr reader failed".to_string())?;
    let (status, timed_out, was_cancelled) = status_result?;
    let duration_ms = started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;

    Ok(OfficeRuntimeResponse {
        success: status.success() && !timed_out && !was_cancelled,
        exit_code: status.code(),
        stdout: captured_stdout.text,
        stderr: captured_stderr.text,
        stdout_truncated: captured_stdout.truncated,
        stderr_truncated: captured_stderr.truncated,
        timed_out,
        cancelled: was_cancelled,
        duration_ms,
        runtime: runtime.label,
        runtime_path,
    })
}

#[tauri::command]
pub async fn office_runtime_execute(
    registry: State<'_, Arc<OfficeRuntimeRegistry>>,
    input: OfficeRuntimeRequest,
) -> Result<OfficeRuntimeResponse, String> {
    let invocation = prepare_invocation(input)?;
    let request_id = invocation.request_id.clone();
    let cancelled = Arc::new(AtomicBool::new(false));
    registry.register(&request_id, Arc::clone(&cancelled))?;
    let result = tokio::task::spawn_blocking(move || run_office_runtime(invocation, cancelled))
        .await
        .map_err(|error| format!("Office Runtime worker failed: {error}"));
    registry.finish(&request_id);
    result?
}

#[tauri::command]
pub fn office_runtime_cancel(
    registry: State<'_, Arc<OfficeRuntimeRegistry>>,
    request_id: String,
) -> OfficeRuntimeCancelResponse {
    OfficeRuntimeCancelResponse {
        cancelled: registry.cancel(request_id.trim()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_path_stays_in_workspace() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = std::fs::canonicalize(temp.path()).expect("canonical workspace");
        let output = resolve_output_path(&workspace, "reports/book.xlsx", "xlsx", "outputPath")
            .expect("valid output");
        assert!(output.starts_with(&workspace));
        assert!(output.ends_with("reports/book.xlsx"));
    }

    #[test]
    fn output_path_rejects_parent_escape() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = std::fs::canonicalize(temp.path()).expect("canonical workspace");
        let error = resolve_output_path(&workspace, "../book.xlsx", "xlsx", "outputPath")
            .expect_err("parent path must be rejected");
        assert!(error.contains("must not contain '..'"));
    }

    #[test]
    fn spreadsheet_code_prepares_a_workspace_script_and_output() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::write(
            temp.path().join("transform.py"),
            "sheet = workbook.active\n",
        )
        .expect("write script");
        let invocation = prepare_invocation(OfficeRuntimeRequest {
            request_id: "spreadsheet-code-test".to_string(),
            workdir: temp.path().to_string_lossy().into_owned(),
            document_type: "spreadsheet".to_string(),
            action: "code".to_string(),
            spec_path: None,
            script_path: Some("transform.py".to_string()),
            input_path: None,
            output_path: Some("result.xlsx".to_string()),
            force: false,
            timeout_ms: Some(5_000),
        })
        .expect("prepare SpreadsheetCode invocation");
        let arguments = invocation
            .arguments
            .iter()
            .map(|value| value.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(arguments[0], "spreadsheet");
        assert_eq!(arguments[1], "code");
        assert!(arguments.iter().any(|value| value == "--script"));
        assert!(arguments
            .iter()
            .any(|value| value.ends_with("transform.py")));
        assert!(arguments.iter().any(|value| value == "--output"));
        assert!(arguments.iter().any(|value| value.ends_with("result.xlsx")));
    }

    #[test]
    fn spreadsheet_code_rejects_a_script_parent_escape() {
        let temp = tempfile::tempdir().expect("tempdir");
        let error = prepare_invocation(OfficeRuntimeRequest {
            request_id: "spreadsheet-code-escape-test".to_string(),
            workdir: temp.path().to_string_lossy().into_owned(),
            document_type: "spreadsheet".to_string(),
            action: "code".to_string(),
            spec_path: None,
            script_path: Some("../transform.py".to_string()),
            input_path: None,
            output_path: Some("result.xlsx".to_string()),
            force: false,
            timeout_ms: None,
        })
        .expect_err("parent path must be rejected");
        assert!(error.contains("scriptPath must not contain '..'"));
    }
}
