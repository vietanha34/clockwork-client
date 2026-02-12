use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition};

// ─── Settings ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(rename = "jiraToken", default)]
    pub jira_token: String,
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("settings.json")
}

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    let path = settings_path(&app);
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    println!("Saving settings: {:?}", settings);
    let path = settings_path(&app);
    println!("Settings path: {:?}", path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| {
        println!("Error writing settings: {}", e);
        e.to_string()
    })
}

#[tauri::command]
fn update_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(Some(title));
    }
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            #[cfg(target_os = "macos")]
            {
                let _ = app.handle().set_dock_visibility(false);
            }

            // Tray icon left-click → toggle window visibility + position near cursor
            if let Some(tray) = app.tray_by_id("main") {
                let win = window.clone();
                tray.on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        if win.is_visible().unwrap_or(false) {
                            let _ = win.hide();
                        } else {
                            // Center window horizontally on tray icon, just below menu bar
                            let x = (position.x as i32) - 190;
                            let y = (position.y as i32) + 5;
                            let _ = win.set_position(tauri::Position::Physical(
                                PhysicalPosition { x, y },
                            ));
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                });
            }

            let win = window.clone();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = win.hide();
                }
                #[cfg(not(debug_assertions))]
                tauri::WindowEvent::Focused(false) => {
                    let _ = win.hide();
                }
                _ => {}
            });

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_settings, save_settings, update_tray_title])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
