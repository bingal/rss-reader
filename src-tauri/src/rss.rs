use feed_rs::parser;
use feed_rs::model::{Feed as RSSFeed, Entry};
use uuid::Uuid;
use std::collections::HashMap;

use crate::db::{Article, init_db};

pub fn fetch_feed(url: String) -> Result<Vec<Article>, String> {
    let response = reqwest::blocking::get(&url)
        .map_err(|e| format!("Failed to fetch feed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let body = response.text().map_err(|e| format!("Failed to read response: {}", e))?;
    
    let feed = parser::parse(body.as_bytes())
        .map_err(|e| format!("Failed to parse RSS: {}", e))?;
    
    let articles = convert_feed_to_articles(&feed)?;
    Ok(articles)
}

pub fn fetch_and_save_feed(url: &str, feed_id: &str) -> Result<i64, String> {
    let articles = fetch_feed(url.to_string())?;
    
    if articles.is_empty() {
        return Ok(0);
    }
    
    let conn = init_db().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    let mut saved_count = 0;
    
    // Get existing article links
    let existing_links: HashMap<String, i32> = conn.prepare("SELECT link, 1 FROM articles WHERE feed_id = ?")?
        .query_map([feed_id], |row| Ok((row.get(0)?, row.get(1)?)))?
        .filter_map(|r| r.ok())
        .collect();
    
    // Save new articles
    for mut article in articles {
        if existing_links.contains_key(&article.link) {
            continue;
        }
        
        article.feed_id = feed_id.to_string();
        
        // Insert article
        conn.execute(
            "INSERT OR IGNORE INTO articles (id, feed_id, title, link, content, summary, author, pub_date, is_read, is_starred, fetched_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                &article.id,
                &article.feed_id,
                &article.title,
                &article.link,
                &article.content,
                article.summary.as_deref().unwrap_or(""),
                article.author.as_deref().unwrap_or(""),
                &article.pub_date.unwrap_or(now).to_string(),
                &article.is_read.to_string(),
                &article.is_starred.to_string(),
                &article.fetched_at.to_string(),
            ],
        ).map_err(|e| e.to_string())?;
        
        saved_count += 1;
    }
    
    // Update feed timestamp
    conn.execute(
        "UPDATE feeds SET updated_at = ? WHERE id = ?",
        [now.to_string(), feed_id],
    ).ok();
    
    Ok(saved_count)
}

fn convert_feed_to_articles(feed: &RSSFeed) -> Result<Vec<Article>, String> {
    let mut articles = Vec::new();
    let now = chrono::Utc::now().timestamp();
    
    for entry in feed.entries.iter() {
        let link = entry.link.as_ref()
            .map(|l| l.href.clone())
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        
        let id = Uuid::new_v4().to_string();
        
        let title = entry.title.clone().unwrap_or_else(|| "Untitled".to_string());
        
        // Extract content
        let (content, summary) = extract_content(entry);
        
        let author = entry.authors.first()
            .map(|a| a.name.clone())
            .or(entry.source.as_ref().map(|s| s.title.clone()))
            .or(feed.title.clone().map(|t| t.content));
        
        let pub_date = entry.published
            .or(entry.updated)
            .map(|d| d.timestamp())
            .unwrap_or(now);
        
        let article = Article {
            id,
            feed_id: String::new(),
            title,
            link,
            content: content.clone(),
            summary: summary.clone(),
            author,
            pub_date: Some(pub_date),
            is_read: 0,
            is_starred: 0,
            fetched_at: now,
        };
        
        articles.push(article);
    }
    
    Ok(articles)
}

fn extract_content(entry: &Entry) -> (String, Option<String>) {
    // Prefer content over summary
    let content = entry.content.as_ref()
        .or(entry.summary.as_ref())
        .map(|c| c.body.clone())
        .unwrap_or_else(|| String::new());
    
    let summary = entry.summary.as_ref()
        .map(|s| s.body.clone())
        .filter(|s| !s.is_empty() && s != content);
    
    // Extract summary from content if needed
    let final_summary = if let Some(summary) = &summary {
        Some(summary.clone())
    } else if !content.is_empty() {
        Some(create_summary(&content))
    } else {
        None
    };
    
    (content, final_summary)
}

fn create_summary(html: &str) -> String {
    // Strip HTML tags and limit length
    let text = html
        .replace(|c| c == '<' || c == '>', " ")
        .split_whitespace()
        .take(100)
        .collect::<Vec<_>>()
        .join(" ");
    
    if text.len() > 200 {
        format!("{}...", &text[..200])
    } else {
        text
    }
}
