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

fn get_sidecar_path(app: &tauri::AppHandle) -> PathBuf {
    // In dev mode, use the binary from the source tree
    if cfg!(dev) {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let target_arch = std::env::consts::ARCH;
        let binary_name = format!("backend-{}-apple-darwin", target_arch);
        return PathBuf::from(manifest_dir)
            .join("binaries")
            .join(binary_name);
    }
    
    // In production, use the bundled resource
    app.path().resource_dir()
        .expect("failed to get resource directory")
        .join("binaries")
        .join("backend")
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
