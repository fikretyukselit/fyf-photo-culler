use tauri::Manager;
use std::sync::Mutex;
use std::io::{BufRead, BufReader};
use std::process::{Command, Child, Stdio};

struct BackendState {
    process: Option<Child>,
    port: Option<u16>,
}

#[tauri::command]
fn get_backend_port(state: tauri::State<'_, Mutex<BackendState>>) -> Result<u16, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.port.ok_or_else(|| "Backend not ready".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(BackendState {
            process: None,
            port: None,
        }))
        .setup(|app| {
            // Try to spawn the Python backend sidecar
            // In development, the Python backend should be started manually
            // In production, it's bundled as a sidecar binary
            let handle = app.handle().clone();

            std::thread::spawn(move || {
                // Try to find and launch the backend
                // First try the sidecar binary (production)
                let backend_path = handle.path()
                    .resource_dir()
                    .ok()
                    .map(|d| d.join("fyf-backend"));

                let mut cmd = if let Some(ref path) = backend_path {
                    if path.exists() {
                        Command::new(path)
                    } else {
                        // Development fallback: run Python directly
                        let mut c = Command::new("python3");
                        c.arg("-m").arg("backend.server");
                        c.current_dir(
                            handle.path().resource_dir().unwrap_or_default()
                                .parent().unwrap_or_else(|| std::path::Path::new("."))
                                .parent().unwrap_or_else(|| std::path::Path::new("."))
                        );
                        c
                    }
                } else {
                    let mut c = Command::new("python3");
                    c.arg("-m").arg("backend.server");
                    c
                };

                cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

                match cmd.spawn() {
                    Ok(mut child) => {
                        if let Some(stdout) = child.stdout.take() {
                            let reader = BufReader::new(stdout);
                            for line in reader.lines() {
                                if let Ok(line) = line {
                                    if line.starts_with("BACKEND_PORT=") {
                                        if let Ok(port) = line[13..].trim().parse::<u16>() {
                                            let state = handle.state::<Mutex<BackendState>>();
                                            if let Ok(mut state) = state.lock() {
                                                state.port = Some(port);
                                                state.process = Some(child);
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to start backend: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state_handle = window.state::<Mutex<BackendState>>();
                let mut guard = match state_handle.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };
                if let Some(mut process) = guard.process.take() {
                    let _ = process.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
