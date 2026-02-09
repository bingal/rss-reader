// Import modules
mod db;
mod rss;

use db::{
    init_db, get_feeds, add_feed, remove_feed, get_articles,
    mark_article_read, toggle_article_starred, get_setting, set_setting,
    Feed, Article,
};
use rss::fetch_and_save_feed;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've greeted the RSS Reader!", name)
}

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_all_feeds() -> Result<Vec<Feed>, String> {
    get_feeds()
}

#[tauri::command]
fn add_new_feed(title: String, url: String, description: Option<String>, category: Option<String>) -> Result<Feed, String> {
    add_feed(title, url, description, category)
}

#[tauri::command]
fn delete_feed(id: String) -> Result<(), String> {
    remove_feed(id)
}

#[tauri::command]
fn fetch_articles(feed_id: Option<String>, filter: Option<String>, limit: i64, offset: i64) -> Result<Vec<Article>, String> {
    get_articles(feed_id, filter, limit, offset)
}

#[tauri::command]
fn refresh_feed(feed_id: String) -> Result<i64, String> {
    // Get feed by ID
    let feeds = get_feeds()?;
    let feed = feeds.iter()
        .find(|f| f.id == feed_id)
        .ok_or_else(|| "Feed not found".to_string())?;
    
    // Fetch and save articles
    let count = fetch_and_save_feed(&feed.url, &feed_id)?;
    Ok(count)
}

#[tauri::command]
fn refresh_all_feeds() -> Result<i64, String> {
    let feeds = get_feeds()?;
    let mut total = 0;
    
    for feed in feeds {
        match fetch_and_save_feed(&feed.url, &feed.id) {
            Ok(count) => total += count,
            Err(e) => eprintln!("Failed to refresh feed {}: {}", feed.title, e),
        }
    }
    
    Ok(total)
}

#[tauri::command]
fn mark_read(id: String, read: bool) -> Result<(), String> {
    mark_article_read(id, read)
}

#[tauri::command]
fn toggle_starred(id: String, starred: bool) -> Result<(), String> {
    toggle_article_starred(id, starred)
}

#[tauri::command]
fn get_app_setting(key: String) -> Result<Option<String>, String> {
    get_setting(key)
}

#[tauri::command]
fn set_app_setting(key: String, value: String) -> Result<(), String> {
    set_setting(key, value)
}

#[tauri::command]
fn translate_text(text: String, target_lang: String) -> Result<String, String> {
    // Read settings from database
    let base_url = get_setting("translation_base_url".to_string())?
        .unwrap_or_else(|| "https://libretranslate.com".to_string());
    
    let api_key = get_setting("translation_api_key".to_string())?
        .unwrap_or_default();
    
    // Ensure base_url doesn't end with /
    let base_url = base_url.trim_end_matches('/');
    let translate_url = format!("{}/translate", base_url);
    
    let client = reqwest::blocking::Client::new();
    
    // Build request body
    let mut body = serde_json::json!({
        "q": text,
        "source": "auto",
        "target": target_lang,
        "format": "text"
    });
    
    // Add API key if provided
    if !api_key.is_empty() {
        body["api_key"] = serde_json::json!(api_key);
    }
    
    let response = client
        .post(&translate_url)
        .json(&body)
        .send()
        .map_err(|e| format!("Translation request failed: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().unwrap_or_default();
        return Err(format!("Translation service error ({}): {}", status, error_text));
    }
    
    let json: serde_json::Value = response.json().map_err(|e| format!("Parse response failed: {}", e))?;
    
    let translated = json["translatedText"]
        .as_str()
        .ok_or_else(|| format!("Invalid translation response: {:?}", json))?
        .to_string();
    
    Ok(translated)
}

#[tauri::command]
async fn open_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.shell()
        .open(&url, None)
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database on startup
    if let Err(e) = init_db() {
        eprintln!("Failed to initialize database: {}", e);
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_version,
            get_all_feeds,
            add_new_feed,
            delete_feed,
            fetch_articles,
            refresh_feed,
            refresh_all_feeds,
            mark_read,
            toggle_starred,
            get_app_setting,
            set_app_setting,
            translate_text,
            open_link,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
