use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

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

#[tauri::command]
pub fn app_runtime_platform() -> RuntimePlatformResponse {
    let platform = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    RuntimePlatformResponse { platform }
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
}
