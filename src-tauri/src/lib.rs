use tauri::Manager;
use std::sync::{Arc, Mutex};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

#[derive(Default)]
struct AppState {
    backend_port: Arc<Mutex<Option<u16>>>,
}

#[tauri::command]
fn get_backend_port(state: tauri::State<AppState>) -> Result<u16, String> {
    state.backend_port
        .lock()
        .unwrap()
        .ok_or_else(|| "Backend port not available".to_string())
}

fn get_sidecar_path(_app: &tauri::AppHandle) -> PathBuf {
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
    
    // In production, externalBin bundles the binary as just "backend"
    // in the same directory as the main executable (Contents/MacOS/ on macOS)
    let binary_name = if cfg!(target_os = "windows") {
        "backend.exe"
    } else {
        "backend"
    };
    std::env::current_exe()
        .expect("failed to get current executable path")
        .parent()
        .expect("failed to get executable directory")
        .join(binary_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .setup(|app| {
            let state = app.state::<AppState>();
            
            // Get the path to the sidecar binary
            let sidecar_path = get_sidecar_path(app.handle());
            
            eprintln!("Starting backend sidecar at: {:?}", sidecar_path);
            
            // Start backend sidecar
            let mut child = Command::new(&sidecar_path)
                .arg("--port=0")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect(&format!("Failed to start backend sidecar at {:?}", sidecar_path));
            
            // Read port from stdout
            let stdout = child.stdout.take().expect("Failed to capture stdout");
            let reader = BufReader::new(stdout);
            let port_mutex = Arc::clone(&state.backend_port);
            
            std::thread::spawn(move || {
                for line in reader.lines() {
                    if let Ok(line) = line {
                        eprintln!("[Backend] {}", line);
                        if line.starts_with("PORT:") {
                            if let Ok(port) = line.trim_start_matches("PORT:").trim().parse::<u16>() {
                                *port_mutex.lock().unwrap() = Some(port);
                                eprintln!("Backend started on port: {}", port);
                                break;
                            }
                        }
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
