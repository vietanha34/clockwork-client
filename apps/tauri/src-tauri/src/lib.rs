use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

const WINDOW_WIDTH: i32 = 302;
#[allow(dead_code)]
const WINDOW_HEIGHT: i32 = 540;

// ─── Settings ─────────────────────────────────────────────────────────────────

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JiraUserSettings {
    #[serde(rename = "accountId", default)]
    pub account_id: String,
    #[serde(rename = "emailAddress", default)]
    pub email_address: String,
    #[serde(rename = "displayName", default)]
    pub display_name: String,
    #[serde(rename = "avatarUrl", default)]
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(rename = "jiraToken", default)]
    pub jira_token: String,
    #[serde(rename = "clockworkApiToken", default)]
    pub clockwork_api_token: String,
    #[serde(rename = "jiraUser", default)]
    pub jira_user: Option<JiraUserSettings>,
    #[serde(rename = "pinIconDismissed", default)]
    pub pin_icon_dismissed: bool,
    #[serde(rename = "launchAtStartup", default = "default_true")]
    pub launch_at_startup: bool,
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
fn update_tray_bitmap(app: AppHandle, buffer: Vec<u8>, width: u32, height: u32) {
    if let Some(tray) = app.tray_by_id("main") {
        // Clear the text title since we are drawing it in the icon now
        let _ = tray.set_title(Some::<&str>(""));
        
        let icon = tauri::image::Image::new(&buffer, width, height);
        let _ = tray.set_icon(Some(icon));
    }
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, tooltip: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

#[tauri::command]
fn update_tray_icon_state(app: AppHandle, state: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let icon = match state.as_str() {
            "active" => tauri::image::Image::from_bytes(include_bytes!("../icons/tray-active.png")).unwrap(),
            "onhold" => tauri::image::Image::from_bytes(include_bytes!("../icons/tray-onhold.png")).unwrap(),
            _ => tauri::image::Image::from_bytes(include_bytes!("../icons/tray-idle.png")).unwrap(),
        };
        let _ = tray.set_icon(Some(icon));
    }
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            // Auto-start: enable/disable based on saved preference (defaults to true)
            {
                let settings = get_settings(app.handle().clone());
                let manager = app.autolaunch();
                if settings.launch_at_startup {
                    let _ = manager.enable();
                } else {
                    let _ = manager.disable();
                }
            }

            #[cfg(target_os = "macos")]
            {
                let _ = app.handle().set_dock_visibility(false);
                let _ = window.set_shadow(false);
            }

            // Tray icon left-click → toggle window visibility + position near cursor
            if let Some(tray) = app.tray_by_id("main") {
                #[cfg(target_os = "macos")]
                let _ = tray.set_icon_as_template(true);
                
                #[cfg(target_os = "linux")]
                {
                    // Build context menu for Linux
                    let show_hide = MenuItemBuilder::new("Show/Hide").id("toggle").build(app.handle())?;
                    let quit = MenuItemBuilder::new("Quit").id("quit").build(app.handle())?;
                    let menu = MenuBuilder::new(app.handle())
                        .item(&show_hide)
                        .item(&quit)
                        .build()?;
                    let _ = tray.set_menu(Some(menu));
                    let _ = tray.set_show_menu_on_left_click(true);
                    
                    let win = window.clone();
                    let app_handle = app.handle().clone();
                    tray.on_menu_event(move |_tray, event| match event.id().as_ref() {
                        "toggle" => {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    });
                }
                
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
                            let x = (position.x as i32) - (WINDOW_WIDTH / 2);
                            
                            // Windows and Linux: window appears above tray icon
                            #[cfg(any(target_os = "windows", target_os = "linux"))]
                            let y = (position.y as i32) - WINDOW_HEIGHT;
                            
                            // macOS: window appears below menu bar
                            #[cfg(target_os = "macos")]
                            let y = (position.y as i32) + 1;

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
                tauri::WindowEvent::Focused(false) => {
                    let _ = win.hide();
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_settings, save_settings, update_tray_bitmap, update_tray_tooltip, update_tray_icon_state, exit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
