use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::api::path::data_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Feed {
    pub id: String,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub category: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Article {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub link: String,
    pub content: String,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub pub_date: Option<i64>,
    pub is_read: i32,
    pub is_starred: i32,
    pub fetched_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ArticleFilter {
    All,
    Unread,
    Starred,
}

fn get_db_path() -> PathBuf {
    let mut path = data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("rss-reader");
    fs::create_dir_all(&path).ok();
    path.push("data.db");
    path
}

pub fn init_db() -> Result<Connection> {
    let conn = Connection::open(get_db_path())?;
    
    // Create feeds table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            description TEXT,
            image_url TEXT,
            category TEXT,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        )",
        [],
    )?;
    
    // Create articles table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            feed_id TEXT NOT NULL,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            content TEXT,
            summary TEXT,
            author TEXT,
            pub_date INTEGER,
            is_read INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            fetched_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY (feed_id) REFERENCES feeds(id)
        )",
        [],
    )?;
    
    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;
    
    // Create indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(pub_date DESC)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_starred ON articles(is_starred)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read)", [])?;
    
    Ok(conn)
}

#[tauri::command]
pub fn get_feeds() -> Result<Vec<Feed>, String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, url, description, image_url, category, created_at, updated_at FROM feeds ORDER BY title")?;
    let feeds = stmt.query_map([], |row| {
        Ok(Feed {
            id: row.get(0)?,
            title: row.get(1)?,
            url: row.get(2)?,
            description: row.get(3)?,
            image_url: row.get(4)?,
            category: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?.collect::<Result<Vec<Feed>, _>>().map_err(|e| e.to_string())?;
    Ok(feeds)
}

#[tauri::command]
pub fn add_feed(title: String, url: String, description: Option<String>, category: Option<String>) -> Result<Feed, String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT INTO feeds (id, title, url, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [&id, &title, &url, description.as_deref().unwrap_or(""), category.as_deref().unwrap_or(""), &now.to_string(), &now.to_string()],
    ).map_err(|e| e.to_string())?;
    
    Ok(Feed {
        id,
        title,
        url,
        description,
        image_url: None,
        category,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn remove_feed(id: String) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    
    // Remove articles first
    conn.execute("DELETE FROM articles WHERE feed_id = ?", [&id]).map_err(|e| e.to_string())?;
    
    // Remove feed
    conn.execute("DELETE FROM feeds WHERE id = ?", [&id]).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_articles(
    feed_id: Option<String>,
    filter: Option<String>, // "all", "unread", "starred"
    limit: i64,
    offset: i64,
) -> Result<Vec<Article>, String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    
    // Build query with filters
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    
    if let Some(feed_id) = feed_id {
        conditions.push("feed_id = ?".to_string());
        params.push(feed_id);
    }
    
    if let Some(filter) = filter {
        match filter.as_str() {
            "unread" => {
                conditions.push("is_read = 0".to_string());
            }
            "starred" => {
                conditions.push("is_starred = 1".to_string());
            }
            _ => {}
        }
    }
    
    let where_clause = if conditions.is_empty() {
        "".to_string()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };
    
    let query = format!(
        "SELECT id, feed_id, title, link, content, summary, author, pub_date, is_read, is_starred, fetched_at FROM articles{} ORDER BY pub_date DESC LIMIT ? OFFSET ?",
        where_clause
    );
    
    params.push(limit.to_string());
    params.push(offset.to_string());
    
    let mut stmt = conn.prepare(&query)?;
    let articles = stmt.query_map(params.as_slice(), |row| {
        Ok(Article {
            id: row.get(0)?,
            feed_id: row.get(1)?,
            title: row.get(2)?,
            link: row.get(3)?,
            content: row.get(4)?,
            summary: row.get(5)?,
            author: row.get(6)?,
            pub_date: row.get(7)?,
            is_read: row.get(8)?,
            is_starred: row.get(9)?,
            fetched_at: row.get(10)?,
        })
    })?.collect::<Result<Vec<Article>, _>>().map_err(|e| e.to_string())?;
    
    Ok(articles)
}

#[tauri::command]
pub fn mark_article_read(id: String, read: bool) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let read_value = if read { 1 } else { 0 };
    conn.execute("UPDATE articles SET is_read = ? WHERE id = ?", [read_value, &id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_article_starred(id: String, starred: bool) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let starred_value = if starred { 1 } else { 0 };
    conn.execute("UPDATE articles SET is_starred = ? WHERE id = ?", [starred_value, &id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_setting(key: String) -> Result<Option<String>, String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
    let result: Option<String> = stmt.query_row([&key], |row| row.get(0)).ok();
    Ok(result)
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [&key, &value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
