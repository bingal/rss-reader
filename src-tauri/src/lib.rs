use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've greeted the RSS Reader!", name)
}

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, get_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
