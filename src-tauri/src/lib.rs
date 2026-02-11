use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;

#[derive(Default, Clone)]
struct AppState {
    backend_port: Arc<Mutex<Option<u16>>>,
    backend_process: Arc<Mutex<Option<Child>>>,
    restart_count: Arc<Mutex<u32>>,
}

#[tauri::command]
fn get_backend_port(state: tauri::State<AppState>) -> Result<u16, String> {
    state
        .backend_port
        .lock()
        .unwrap()
        .ok_or_else(|| "Backend port not available".to_string())
}

fn get_sidecar_path(_app: &tauri::AppHandle) -> PathBuf {
    // Get the directory where the current executable is located
    let exe_dir = std::env::current_exe()
        .expect("failed to get current executable path")
        .parent()
        .expect("failed to get executable directory")
        .to_path_buf();

    // In dev mode, use the binary from the source tree with target triple
    if cfg!(dev) {
        let binary_name = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                "backend-aarch64-apple-darwin"
            } else {
                "backend-x86_64-apple-darwin"
            }
        } else if cfg!(target_os = "windows") {
            "backend-x86_64-pc-windows-msvc.exe"
        } else if cfg!(target_os = "linux") {
            "backend-x86_64-unknown-linux-gnu"
        } else {
            "backend"
        };
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        return PathBuf::from(manifest_dir)
            .join("binaries")
            .join(binary_name);
    }

    // In production, try multiple possible locations and naming conventions
    let binary_name = if cfg!(target_os = "windows") {
        "backend.exe"
    } else {
        "backend"
    };

    // Primary location: same directory as the main executable
    let primary_path = exe_dir.join(&binary_name);
    if primary_path.exists() {
        return primary_path;
    }

    // Fallback: check for platform-specific target triple naming (Tauri externalBin style)
    let target_binary = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "backend-aarch64-apple-darwin"
        } else {
            "backend-x86_64-apple-darwin"
        }
    } else if cfg!(target_os = "windows") {
        "backend-x86_64-pc-windows-msvc.exe"
    } else if cfg!(target_os = "linux") {
        "backend-x86_64-unknown-linux-gnu"
    } else {
        "backend"
    };

    let target_path = exe_dir.join(target_binary);
    if target_path.exists() {
        return target_path;
    }

    // For macOS .app bundles, check Contents/MacOS/ directory
    #[cfg(target_os = "macos")]
    {
        let macos_dir = exe_dir.join("backend");
        if macos_dir.exists() {
            return macos_dir;
        }
    }

    // Return primary path even if it doesn't exist (will fail with clear error later)
    primary_path
}

fn start_backend(
    app: &tauri::AppHandle,
    state: &AppState,
) -> Result<u16, Box<dyn std::error::Error>> {
    let sidecar_path = get_sidecar_path(app);
    eprintln!("[Sidecar] Starting backend at: {:?}", sidecar_path);

    let mut child = Command::new(&sidecar_path)
        .arg("--port=0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start backend sidecar: {}", e))?;

    // Read port from stdout
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    let (tx, rx) = std::sync::mpsc::channel::<Result<u16, String>>();
    let port_mutex = Arc::clone(&state.backend_port);

    thread::spawn(move || {
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[Backend] {}", line);
                if line.starts_with("PORT:") {
                    if let Ok(port) = line.trim_start_matches("PORT:").trim().parse::<u16>() {
                        *port_mutex.lock().unwrap() = Some(port);
                        eprintln!("[Sidecar] Backend started on port: {}", port);
                        let _ = tx.send(Ok(port));
                        break;
                    }
                }
            }
        }
    });

    // Wait for port with timeout
    match rx.recv_timeout(Duration::from_secs(10)) {
        Ok(Ok(port)) => {
            // Store the process handle
            *state.backend_process.lock().unwrap() = Some(child);
            Ok(port)
        }
        Ok(Err(e)) => Err(e.into()),
        Err(_) => {
            let _ = child.kill();
            Err("Timeout waiting for backend port".into())
        }
    }
}

fn stop_backend(state: &AppState) {
    eprintln!("[Sidecar] Stopping backend...");
    if let Some(mut child) = state.backend_process.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *state.backend_port.lock().unwrap() = None;
}

fn restart_backend(app: &tauri::AppHandle, state: &AppState) -> Result<u16, String> {
    let mut restart_count = state.restart_count.lock().unwrap();
    *restart_count += 1;

    if *restart_count > 5 {
        return Err("Backend restart limit exceeded".to_string());
    }

    eprintln!(
        "[Sidecar] Restarting backend (attempt {})...",
        *restart_count
    );
    stop_backend(state);

    // Wait a bit before restarting
    thread::sleep(Duration::from_millis(500));

    start_backend(app, state).map_err(|e| format!("Failed to restart backend: {}", e))
}

fn monitor_backend(app: tauri::AppHandle, state: AppState) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(5));

            // Check if backend is still running
            let is_running = state
                .backend_process
                .lock()
                .unwrap()
                .as_mut()
                .map(|child| matches!(child.try_wait(), Ok(None)))
                .unwrap_or(false);

            if !is_running {
                eprintln!("[Sidecar] Backend process not running, attempting restart...");

                // Reset restart count if backend has been running for a while
                if state.backend_port.lock().unwrap().is_some() {
                    *state.restart_count.lock().unwrap() = 0;
                }

                match restart_backend(&app, &state) {
                    Ok(port) => {
                        eprintln!("[Sidecar] Backend restarted successfully on port {}", port);
                    }
                    Err(e) => {
                        eprintln!("[Sidecar] Failed to restart backend: {}", e);
                    }
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state.clone())
        .setup(move |app| {
            let state = app.state::<AppState>();

            // Start backend initially
            match start_backend(app.handle(), &state) {
                Ok(port) => {
                    eprintln!("[Sidecar] Initial backend started on port {}", port);
                }
                Err(e) => {
                    eprintln!("[Sidecar] Failed to start initial backend: {}", e);
                }
            }

            // Start monitoring thread
            monitor_backend(app.handle().clone(), state.inner().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
