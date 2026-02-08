use tauri::Manager;

// Import modules
mod db;
mod rss;

use db::{
    init_db, get_feeds, add_feed, remove_feed, get_articles,
    mark_article_read, toggle_article_starred, get_setting, set_setting,
    Feed, Article,
};
use rss::fetch_feed;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command/
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
fn fetch_articles(feed_id: Option<String>, limit: i64, offset: i64) -> Result<Vec<Article>, String> {
    get_articles(feed_id, limit, offset)
}

#[tauri::command]
fn refresh_feed(url: String) -> Result<Vec<Article>, String> {
    fetch_feed(url)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database on startup
    if let Err(e) = init_db() {
        eprintln!("Failed to initialize database: {}", e);
    }
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_version,
            get_all_feeds,
            add_new_feed,
            delete_feed,
            fetch_articles,
            refresh_feed,
            mark_read,
            toggle_starred,
            get_app_setting,
            set_app_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
