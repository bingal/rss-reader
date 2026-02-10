// Import modules
mod db;
mod rss;

use db::{
    init_db, get_feeds, add_feed, remove_feed, get_articles,
    mark_article_read, toggle_article_starred, get_setting, set_setting,
    save_translation, get_translation,
    Feed, Article,
};
use rss::fetch_and_save_feed;

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
async fn refresh_all_feeds() -> Result<i64, String> {
    let feeds = get_feeds()?;
    let mut total = 0;
    let mut errors = Vec::new();
    
    // Refresh feeds sequentially to avoid overwhelming the system
    // Use spawn_blocking since fetch_and_save_feed uses blocking reqwest
    for feed in feeds {
        let url = feed.url.clone();
        let id = feed.id.clone();
        let title = feed.title.clone();
        
        let result = tokio::task::spawn_blocking(move || {
            fetch_and_save_feed(&url, &id)
        }).await;
        
        match result {
            Ok(Ok(count)) => total += count,
            Ok(Err(e)) => {
                let err_msg = format!("Failed to refresh feed '{}': {}", title, e);
                eprintln!("{}", err_msg);
                errors.push(err_msg);
            }
            Err(e) => {
                let err_msg = format!("Task panicked for feed '{}': {}", title, e);
                eprintln!("{}", err_msg);
                errors.push(err_msg);
            }
        }
    }
    
    // Return error if all feeds failed
    if total == 0 && !errors.is_empty() {
        return Err(format!("All feeds failed to refresh. First error: {}", errors[0]));
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
async fn translate_text(text: String, target_lang: String) -> Result<String, String> {
    // Read settings from database (blocking operations need spawn_blocking)
    let settings_result = tokio::task::spawn_blocking(move || {
        let base_url = get_setting("translation_base_url".to_string())?
            .unwrap_or_else(|| "https://libretranslate.com".to_string());
        
        let api_key = get_setting("translation_api_key".to_string())?
            .unwrap_or_default();
        
        let model = get_setting("translation_model".to_string())?
            .unwrap_or_else(|| "gpt-3.5-turbo".to_string());
        
        let prompt = get_setting("translation_prompt".to_string())?
            .unwrap_or_else(|| "Translate the following text to Chinese:".to_string());
        
        Ok::<_, String>((base_url, api_key, model, prompt))
    }).await.map_err(|e| format!("Task join error: {}", e))??;
    
    let (base_url, api_key, model, prompt) = settings_result;
    
    // Debug logging
    eprintln!("[translate] base_url: {}, model: {}, has_api_key: {}", 
              base_url, model, !api_key.is_empty());
    
    // Determine if this is OpenAI API or LibreTranslate
    let is_openai = base_url.contains("openai.com") 
        || base_url.contains("openai")
        || base_url.contains("api.openai") 
        || base_url.ends_with("/v1")
        || (!api_key.is_empty() && !base_url.contains("libretranslate"));
    
    let client = reqwest::Client::new();
    
    if is_openai {
        // OpenAI API format
        let api_url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
        
        eprintln!("[translate] Using OpenAI API: {}", api_url);
        
        let request_body = serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            "temperature": 0.3
        });
        
        let mut request = client
            .post(&api_url)
            .json(&request_body);
        
        // Add Authorization header
        if !api_key.is_empty() {
            request = request.header("Authorization", format!("Bearer {}", api_key));
            eprintln!("[translate] Added Authorization header");
        } else {
            eprintln!("[translate] Warning: No API key provided");
        }
        
        let response = request
            .send()
            .await
            .map_err(|e| format!("OpenAI request failed: {}. URL: {}", e, api_url))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error ({}): {}", status, error_text));
        }
        
        let json: serde_json::Value = response.json()
            .await
            .map_err(|e| format!("Parse OpenAI response failed: {}", e))?;
        
        let translated = json["choices"]
            .get(0)
            .and_then(|c| c["message"]["content"].as_str())
            .ok_or_else(|| format!("Invalid OpenAI response: {:?}", json))?
            .to_string();
        
        Ok(translated)
    } else {
        // LibreTranslate API format
        let translate_url = format!("{}/translate", base_url.trim_end_matches('/'));
        
        eprintln!("[translate] Using LibreTranslate API: {}", translate_url);
        
        let mut body = serde_json::json!({
            "q": text,
            "source": "auto",
            "target": target_lang,
            "format": "text"
        });
        
        if !api_key.is_empty() {
            body["api_key"] = serde_json::json!(api_key);
        }
        
        let response = client
            .post(&translate_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Translation request failed: {}", e))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Translation service error ({}): {}", status, error_text));
        }
        
        let json: serde_json::Value = response.json()
            .await
            .map_err(|e| format!("Parse response failed: {}", e))?;
        
        let translated = json["translatedText"]
            .as_str()
            .ok_or_else(|| format!("Invalid translation response: {:?}", json))?
            .to_string();
        
        Ok(translated)
    }
}

#[tauri::command]
async fn open_link(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(&url, None::<&str>)
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
        .plugin(tauri_plugin_opener::init())
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
            save_translation,
            get_translation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
