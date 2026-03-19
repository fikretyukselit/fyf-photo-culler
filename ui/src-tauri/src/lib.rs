use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

struct BackendState {
    process: Option<CommandChild>,
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(BackendState {
            process: None,
            port: None,
        }))
        .setup(|app| {
            let handle = app.handle().clone();

            // Try Tauri sidecar first (production), fall back to python3 (development)
            let sidecar_result = app.shell().sidecar("fyf-backend");

            match sidecar_result {
                Ok(sidecar_cmd) => {
                    let (mut rx, child) = sidecar_cmd
                        .spawn()
                        .expect("failed to spawn sidecar");

                    // Read stdout to find the port, then store child
                    std::thread::spawn(move || {
                        use tauri_plugin_shell::process::CommandEvent;
                        while let Some(event) = rx.blocking_recv() {
                            if let CommandEvent::Stdout(line) = event {
                                let line = String::from_utf8_lossy(&line);
                                if line.starts_with("BACKEND_PORT=") {
                                    if let Ok(port) = line[13..].trim().parse::<u16>() {
                                        let bs = handle.state::<Mutex<BackendState>>();
                                        let mut guard = bs.lock().unwrap();
                                        guard.port = Some(port);
                                        guard.process = Some(child);
                                        return;
                                    }
                                }
                            }
                        }
                    });
                }
                Err(_) => {
                    // Development fallback: run Python directly
                    eprintln!("Sidecar not found, falling back to python3 -m backend.server");
                    std::thread::spawn(move || {
                        use std::io::{BufRead, BufReader};
                        use std::process::{Command, Stdio};

                        let mut cmd = Command::new("python3");
                        cmd.arg("-m").arg("backend.server");
                        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

                        match cmd.spawn() {
                            Ok(mut child) => {
                                if let Some(stdout) = child.stdout.take() {
                                    let reader = BufReader::new(stdout);
                                    for line in reader.lines() {
                                        if let Ok(line) = line {
                                            if line.starts_with("BACKEND_PORT=") {
                                                if let Ok(port) = line[13..].trim().parse::<u16>() {
                                                    let bs = handle.state::<Mutex<BackendState>>();
                                                    let mut guard = bs.lock().unwrap();
                                                    guard.port = Some(port);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                // Keep child alive so backend doesn't die
                                std::mem::forget(child);
                            }
                            Err(e) => {
                                eprintln!("Failed to start backend: {}", e);
                            }
                        }
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state_handle = window.state::<Mutex<BackendState>>();
                let mut guard = match state_handle.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };
                if let Some(child) = guard.process.take() {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
