use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tempfile::NamedTempFile;
use wait_timeout::ChildExt;

use crate::runtime::platform::find_program_on_path;
use crate::runtime::process::{configure_child_process_group, kill_child_process_tree_best_effort};
use crate::runtime::terminal::TerminalSessionRegistry;

pub type CloseWindowBehaviorState = AtomicU8;

pub const CLOSE_WINDOW_BEHAVIOR_MINIMIZE: u8 = 0;
pub const CLOSE_WINDOW_BEHAVIOR_EXIT: u8 = 1;

/// 已注册全局快捷键 -> 动作 的映射，供插件回调反查动作。
#[derive(Default)]
pub struct GlobalShortcutRegistry {
    entries: Mutex<Vec<(Shortcut, String)>>,
}

/// 主窗口置顶状态（快捷键切换用；独立 newtype 避免与其他 AtomicBool 状态类型冲突）。
#[derive(Default)]
pub struct WindowPinState(pub AtomicBool);

/// 前端查询当前置顶状态（webview 重载后恢复置顶指示器）。
#[tauri::command]
pub fn app_window_pinned(pin_state: State<'_, Arc<WindowPinState>>) -> bool {
    pin_state.0.load(Ordering::SeqCst)
}

/// 前端主动切换置顶（置顶指示器点击取消）；状态变更仍经
/// `global-shortcut:pin-changed` 事件广播回前端。
#[tauri::command]
pub fn app_toggle_window_pin(app: AppHandle) {
    crate::toggle_main_window_pin(&app);
}

impl GlobalShortcutRegistry {
    pub fn lookup_action(&self, shortcut: &Shortcut) -> Option<String> {
        let entries = self.entries.lock().ok()?;
        entries
            .iter()
            .find(|(registered, _)| registered == shortcut)
            .map(|(_, action)| action.clone())
    }

    fn replace(&self, next: Vec<(Shortcut, String)>) {
        if let Ok(mut entries) = self.entries.lock() {
            *entries = next;
        }
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalShortcutBinding {
    pub action: String,
    pub accelerator: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalShortcutFailure {
    pub action: String,
    pub accelerator: String,
    pub error: String,
}

/// 全量替换式注册：本命令是插件注册的唯一入口，`unregister_all` 会清掉
/// 插件上的所有快捷键。日后若有其他模块要注册全局快捷键，必须并入本命令
/// 的 bindings 走同一条替换路径，不能自行调用插件 register。
#[tauri::command]
pub fn app_set_global_shortcuts(
    app: AppHandle,
    bindings: Vec<GlobalShortcutBinding>,
    registry: State<'_, Arc<GlobalShortcutRegistry>>,
) -> Result<Vec<GlobalShortcutFailure>, String> {
    let manager = app.global_shortcut();
    manager
        .unregister_all()
        .map_err(|error| format!("failed to unregister global shortcuts: {error}"))?;

    let mut entries: Vec<(Shortcut, String)> = Vec::new();
    let mut failures: Vec<GlobalShortcutFailure> = Vec::new();
    for binding in bindings {
        let action = binding.action.trim().to_string();
        let accelerator = binding.accelerator.trim().to_string();
        if action.is_empty() || accelerator.is_empty() {
            continue;
        }
        match accelerator.parse::<Shortcut>() {
            Ok(shortcut) => match manager.register(shortcut) {
                Ok(()) => entries.push((shortcut, action)),
                Err(error) => failures.push(GlobalShortcutFailure {
                    action,
                    accelerator,
                    error: error.to_string(),
                }),
            },
            Err(error) => failures.push(GlobalShortcutFailure {
                action,
                accelerator,
                error: error.to_string(),
            }),
        }
    }
    registry.replace(entries);
    Ok(failures)
}

pub fn parse_close_window_behavior(value: &str) -> u8 {
    if value.trim().eq_ignore_ascii_case("exit") {
        CLOSE_WINDOW_BEHAVIOR_EXIT
    } else {
        CLOSE_WINDOW_BEHAVIOR_MINIMIZE
    }
}

pub fn is_close_window_exit(state: &CloseWindowBehaviorState) -> bool {
    state.load(Ordering::SeqCst) == CLOSE_WINDOW_BEHAVIOR_EXIT
}

#[allow(dead_code)]
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacOsTrafficLightMetrics {
    pub top: f64,
    pub left: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePlatformResponse {
    pub platform: &'static str,
}

fn runtime_platform_name() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

#[tauri::command]
pub fn app_runtime_platform() -> RuntimePlatformResponse {
    RuntimePlatformResponse {
        platform: runtime_platform_name(),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeCapabilityStatus {
    Available,
    Unavailable,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PythonPostgresDriver {
    Psycopg,
    Psycopg2,
    None,
    Unknown,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeShellSnapshot {
    pub profile: &'static str,
    pub family: &'static str,
    pub name: &'static str,
    pub uses_wsl: bool,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCommandSnapshot {
    pub python: RuntimeCapabilityStatus,
    pub node: RuntimeCapabilityStatus,
    pub psql: RuntimeCapabilityStatus,
    pub git: RuntimeCapabilityStatus,
    pub docker: RuntimeCapabilityStatus,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePythonSnapshot {
    pub status: RuntimeCapabilityStatus,
    pub launcher: Option<&'static str>,
    pub postgres_driver: PythonPostgresDriver,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEnvironmentSnapshot {
    pub platform: &'static str,
    pub architecture: &'static str,
    pub shell: RuntimeShellSnapshot,
    pub commands: RuntimeCommandSnapshot,
    pub python: RuntimePythonSnapshot,
}

const PYTHON_PROBE_SENTINEL: &str = "ARCFORGE_RUNTIME:";
const PYTHON_PROBE_SCRIPT: &str = r#"import importlib.util as u;print("ARCFORGE_RUNTIME:"+("psycopg" if u.find_spec("psycopg") is not None else ("psycopg2" if u.find_spec("psycopg2") is not None else "none")))"#;
const PYTHON_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const PYTHON_PROBE_MAX_OUTPUT_BYTES: u64 = 4096;
const RUNTIME_ENVIRONMENT_PROBE_TIMEOUT: Duration = Duration::from_secs(3);
static RUNTIME_ENVIRONMENT_PROBE_RUNNING: AtomicBool = AtomicBool::new(false);

struct RuntimeEnvironmentProbeGuard;

impl Drop for RuntimeEnvironmentProbeGuard {
    fn drop(&mut self) {
        RUNTIME_ENVIRONMENT_PROBE_RUNNING.store(false, Ordering::Release);
    }
}

fn preferred_shell_snapshot(platform: &str) -> RuntimeShellSnapshot {
    match platform {
        "windows" => RuntimeShellSnapshot {
            profile: "windows-powershell",
            family: "powershell",
            name: "powershell",
            uses_wsl: false,
        },
        "macos" => RuntimeShellSnapshot {
            profile: "posix-zsh",
            family: "posix",
            name: "zsh",
            uses_wsl: false,
        },
        _ => RuntimeShellSnapshot {
            profile: "posix-bash",
            family: "posix",
            name: "bash",
            uses_wsl: false,
        },
    }
}

fn fixed_command_status(name: &str, path_is_known: bool) -> RuntimeCapabilityStatus {
    if !path_is_known {
        return RuntimeCapabilityStatus::Unknown;
    }
    if find_program_on_path(name).is_some() {
        RuntimeCapabilityStatus::Available
    } else {
        RuntimeCapabilityStatus::Unavailable
    }
}

fn parse_python_probe_output(output: &[u8]) -> Option<PythonPostgresDriver> {
    if output.len() as u64 > PYTHON_PROBE_MAX_OUTPUT_BYTES {
        return None;
    }
    let text = std::str::from_utf8(output).ok()?;
    let payload = text
        .lines()
        .rev()
        .find_map(|line| line.trim().strip_prefix(PYTHON_PROBE_SENTINEL))?;
    match payload {
        "psycopg" => Some(PythonPostgresDriver::Psycopg),
        "psycopg2" => Some(PythonPostgresDriver::Psycopg2),
        "none" => Some(PythonPostgresDriver::None),
        _ => None,
    }
}

fn run_python_probe(
    program: &std::path::Path,
    prefix_args: &[&str],
    timeout: Duration,
) -> Option<PythonPostgresDriver> {
    let stdout_file = NamedTempFile::new().ok()?;
    let stdout_target = stdout_file.reopen().ok()?;
    let probe_cwd = tempfile::tempdir().ok()?;
    let mut command = Command::new(program);
    configure_child_process_group(&mut command);
    // Preserve the selected interpreter, active virtual environment, and
    // user-site packages while preventing an untrusted workspace/PYTHONPATH
    // from shadowing standard-library modules during this automatic probe.
    command
        .args(prefix_args)
        .arg("-c")
        .arg(PYTHON_PROBE_SCRIPT)
        .current_dir(probe_cwd.path())
        .env_remove("PYTHONHOME")
        .env_remove("PYTHONPATH")
        .env_remove("PYTHONSTARTUP")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_target))
        .stderr(Stdio::null());
    let mut child = command.spawn().ok()?;
    let status = match child.wait_timeout(timeout).ok()? {
        Some(status) => status,
        None => {
            kill_child_process_tree_best_effort(&mut child);
            return None;
        }
    };
    if !status.success() {
        return None;
    }
    let metadata = stdout_file.as_file().metadata().ok()?;
    if metadata.len() > PYTHON_PROBE_MAX_OUTPUT_BYTES {
        return None;
    }
    let output = std::fs::read(stdout_file.path()).ok()?;
    parse_python_probe_output(&output)
}

fn python_launcher_candidates() -> Vec<(&'static str, &'static str, &'static [&'static str])> {
    if cfg!(windows) {
        vec![
            ("python", "python", &[]),
            ("py", "py -3", &["-3"]),
            ("python3", "python3", &[]),
        ]
    } else {
        vec![("python3", "python3", &[]), ("python", "python", &[])]
    }
}

fn probe_python(path_is_known: bool) -> RuntimePythonSnapshot {
    if !path_is_known {
        return RuntimePythonSnapshot {
            status: RuntimeCapabilityStatus::Unknown,
            launcher: None,
            postgres_driver: PythonPostgresDriver::Unknown,
        };
    }

    let mut found_launcher = false;
    let mut first_working_launcher = None;
    let probe_started = Instant::now();
    for (program_name, launcher, prefix_args) in python_launcher_candidates() {
        let Some(program) = find_program_on_path(program_name) else {
            continue;
        };
        found_launcher = true;
        let remaining = PYTHON_PROBE_TIMEOUT.saturating_sub(probe_started.elapsed());
        if remaining.is_zero() {
            break;
        }
        if let Some(postgres_driver) = run_python_probe(&program, prefix_args, remaining) {
            if postgres_driver != PythonPostgresDriver::None {
                return RuntimePythonSnapshot {
                    status: RuntimeCapabilityStatus::Available,
                    launcher: Some(launcher),
                    postgres_driver,
                };
            }
            first_working_launcher.get_or_insert(launcher);
        }
    }

    if let Some(launcher) = first_working_launcher {
        return RuntimePythonSnapshot {
            status: RuntimeCapabilityStatus::Available,
            launcher: Some(launcher),
            postgres_driver: PythonPostgresDriver::None,
        };
    }

    RuntimePythonSnapshot {
        status: if found_launcher {
            RuntimeCapabilityStatus::Unknown
        } else {
            RuntimeCapabilityStatus::Unavailable
        },
        launcher: None,
        postgres_driver: PythonPostgresDriver::Unknown,
    }
}

fn build_runtime_environment_snapshot() -> RuntimeEnvironmentSnapshot {
    let platform = runtime_platform_name();
    let path_is_known = std::env::var_os("PATH").is_some();
    let python = probe_python(path_is_known);
    RuntimeEnvironmentSnapshot {
        platform,
        architecture: std::env::consts::ARCH,
        shell: preferred_shell_snapshot(platform),
        commands: RuntimeCommandSnapshot {
            python: python.status,
            node: fixed_command_status("node", path_is_known),
            psql: fixed_command_status("psql", path_is_known),
            git: fixed_command_status("git", path_is_known),
            docker: fixed_command_status("docker", path_is_known),
        },
        python,
    }
}

#[tauri::command]
pub async fn app_runtime_environment() -> Result<RuntimeEnvironmentSnapshot, String> {
    if RUNTIME_ENVIRONMENT_PROBE_RUNNING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("runtime environment probe is already running".to_string());
    }

    let task = tauri::async_runtime::spawn_blocking(|| {
        let _guard = RuntimeEnvironmentProbeGuard;
        build_runtime_environment_snapshot()
    });
    match tokio::time::timeout(RUNTIME_ENVIRONMENT_PROBE_TIMEOUT, task).await {
        Ok(Ok(snapshot)) => Ok(snapshot),
        Ok(Err(error)) => Err(format!("runtime environment probe failed: {error}")),
        Err(_) => Err("runtime environment probe timed out".to_string()),
    }
}

#[tauri::command]
pub fn app_set_close_window_behavior(
    behavior: String,
    close_window_behavior: State<'_, Arc<CloseWindowBehaviorState>>,
) -> Result<(), String> {
    close_window_behavior.store(parse_close_window_behavior(&behavior), Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn app_confirmed_exit(
    app: AppHandle,
    allow_exit: State<'_, Arc<AtomicBool>>,
    terminal_registry: State<'_, Arc<TerminalSessionRegistry>>,
) -> Result<(), String> {
    terminal_registry.close_all()?;
    allow_exit.store(true, Ordering::SeqCst);
    app.exit(0);
    Ok(())
}

#[allow(dead_code)]
#[tauri::command]
pub async fn app_macos_traffic_light_metrics(
    window: tauri::Window,
) -> Result<Option<MacOsTrafficLightMetrics>, String> {
    read_macos_traffic_light_metrics(window).await
}

#[allow(dead_code)]
async fn read_macos_traffic_light_metrics(
    _window: tauri::Window,
) -> Result<Option<MacOsTrafficLightMetrics>, String> {
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_window_behavior_parser_accepts_exit_and_defaults_to_minimize() {
        assert_eq!(
            parse_close_window_behavior("exit"),
            CLOSE_WINDOW_BEHAVIOR_EXIT
        );
        assert_eq!(
            parse_close_window_behavior(" EXIT "),
            CLOSE_WINDOW_BEHAVIOR_EXIT
        );
        assert_eq!(
            parse_close_window_behavior("tray"),
            CLOSE_WINDOW_BEHAVIOR_MINIMIZE
        );
    }

    #[test]
    fn close_window_exit_reads_shared_state() {
        let state = CloseWindowBehaviorState::new(CLOSE_WINDOW_BEHAVIOR_MINIMIZE);
        assert!(!is_close_window_exit(&state));
        state.store(CLOSE_WINDOW_BEHAVIOR_EXIT, Ordering::SeqCst);
        assert!(is_close_window_exit(&state));
    }

    #[test]
    fn python_probe_parser_distinguishes_drivers_and_failures() {
        assert_eq!(
            parse_python_probe_output(b"ARCFORGE_RUNTIME:psycopg"),
            Some(PythonPostgresDriver::Psycopg)
        );
        assert_eq!(
            parse_python_probe_output(
                b"notice
ARCFORGE_RUNTIME:psycopg2"
            ),
            Some(PythonPostgresDriver::Psycopg2)
        );
        assert_eq!(
            parse_python_probe_output(b"ARCFORGE_RUNTIME:none"),
            Some(PythonPostgresDriver::None)
        );
        assert_eq!(parse_python_probe_output(b"not-a-probe"), None);
        assert_eq!(
            parse_python_probe_output(b"ARCFORGE_RUNTIME:psycopg extra"),
            None
        );
        assert!(!PYTHON_PROBE_SCRIPT.contains("json"));
    }

    #[test]
    fn runtime_environment_serialization_exposes_only_safe_capability_fields() {
        let snapshot = RuntimeEnvironmentSnapshot {
            platform: "windows",
            architecture: "x86_64",
            shell: preferred_shell_snapshot("windows"),
            commands: RuntimeCommandSnapshot {
                python: RuntimeCapabilityStatus::Available,
                node: RuntimeCapabilityStatus::Available,
                psql: RuntimeCapabilityStatus::Unavailable,
                git: RuntimeCapabilityStatus::Available,
                docker: RuntimeCapabilityStatus::Unknown,
            },
            python: RuntimePythonSnapshot {
                status: RuntimeCapabilityStatus::Available,
                launcher: Some("python"),
                postgres_driver: PythonPostgresDriver::Psycopg,
            },
        };

        let value = serde_json::to_value(snapshot).expect("snapshot should serialize");
        let object = value.as_object().expect("snapshot should be an object");
        assert_eq!(
            object.keys().cloned().collect::<Vec<_>>(),
            vec!["architecture", "commands", "platform", "python", "shell"]
        );
        let serialized = value.to_string().to_ascii_lowercase();
        assert!(!serialized.contains("path"));
        assert!(!serialized.contains("home"));
        assert!(!serialized.contains("hostname"));
        assert!(!serialized.contains("environment"));
    }
}
