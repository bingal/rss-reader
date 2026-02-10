#!/usr/bin/env bun

/**
 * Migration script to replace Tauri invoke() calls with new API client
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

const replacements: Array<{
  pattern: RegExp;
  replacement: string;
  description: string;
}> = [
  {
    pattern:
      /import\s+{\s*invoke\s*}\s+from\s+["']@tauri-apps\/api\/core["'];?\s*/g,
    replacement: "",
    description: "Remove invoke import",
  },
  {
    pattern: /await\s+invoke<Feed\[\]>\(["']get_all_feeds["']\)/g,
    replacement: "await api.feeds.getAll()",
    description: "Replace get_all_feeds",
  },
  {
    pattern:
      /await\s+invoke<Feed>\(["']add_new_feed["'],\s*{\s*title:\s*([^,]+),\s*url:\s*([^,]+),\s*description:\s*([^,]+),\s*category:\s*([^}]+)\s*}\)/g,
    replacement:
      "await api.feeds.add({ title: $1, url: $2, description: $3, category: $4 })",
    description: "Replace add_new_feed",
  },
  {
    pattern:
      /await\s+invoke<void>\(["']delete_feed["'],\s*{\s*id:\s*([^}]+)\s*}\)/g,
    replacement: "await api.feeds.delete($1)",
    description: "Replace delete_feed",
  },
  {
    pattern:
      /await\s+invoke<Article\[\]>\(["']fetch_articles["'],\s*{\s*feedId:\s*([^,]+),\s*filter:\s*([^,]+),\s*limit:\s*([^,]+),\s*offset:\s*([^}]+)\s*}\)/g,
    replacement:
      "await api.articles.fetch({ feedId: $1, filter: $2, limit: $3, offset: $4 })",
    description: "Replace fetch_articles",
  },
  {
    pattern:
      /await\s+invoke<number>\(["']refresh_feed["'],\s*{\s*feedId:\s*([^}]+)\s*}\)/g,
    replacement: "(await api.feeds.refresh($1)).count",
    description: "Replace refresh_feed",
  },
  {
    pattern: /await\s+invoke<number>\(["']refresh_all_feeds["']\)/g,
    replacement: "(await api.feeds.refreshAll()).count",
    description: "Replace refresh_all_feeds",
  },
  {
    pattern:
      /await\s+invoke<void>\(["']mark_read["'],\s*{\s*id:\s*([^,]+),\s*read:\s*([^}]+)\s*}\)/g,
    replacement: "await api.articles.markRead($1, $2)",
    description: "Replace mark_read",
  },
  {
    pattern:
      /await\s+invoke<void>\(["']toggle_starred["'],\s*{\s*id:\s*([^,]+),\s*starred:\s*([^}]+)\s*}\)/g,
    replacement: "await api.articles.toggleStarred($1, $2)",
    description: "Replace toggle_starred",
  },
  {
    pattern:
      /await\s+invoke<string\s*\|\s*null>\(["']get_app_setting["'],\s*{\s*key:\s*([^}]+)\s*}\)/g,
    replacement: "(await api.settings.get($1)).value",
    description: "Replace get_app_setting",
  },
  {
    pattern:
      /await\s+invoke<void>\(["']set_app_setting["'],\s*{\s*key:\s*([^,]+),\s*value:\s*([^}]+)\s*}\)/g,
    replacement: "await api.settings.set($1, $2)",
    description: "Replace set_app_setting",
  },
  {
    pattern:
      /await\s+invoke<string>\(["']translate_text["'],\s*{\s*text:\s*([^,]+),\s*targetLang:\s*([^}]+)\s*}\)/g,
    replacement: "(await api.translation.translate($1, $2)).translatedText",
    description: "Replace translate_text",
  },
  {
    pattern:
      /await\s+invoke<void>\(["']save_translation["'],\s*{\s*articleId:\s*([^,]+),\s*content:\s*([^}]+)\s*}\)/g,
    replacement: "await api.translation.save($1, $2)",
    description: "Replace save_translation",
  },
  {
    pattern:
      /await\s+invoke<string\s*\|\s*null>\(["']get_translation["'],\s*{\s*articleId:\s*([^}]+)\s*}\)/g,
    replacement: "(await api.translation.get($1)).content",
    description: "Replace get_translation",
  },
];

async function migrateFile(filePath: string): Promise<boolean> {
  let content = readFileSync(filePath, "utf-8");
  let modified = false;

  // Check if file uses invoke
  if (!content.includes("invoke(") && !content.includes("invoke<")) {
    return false;
  }

  console.log(`\n📝 Migrating: ${filePath}`);

  // Apply replacements
  for (const { pattern, replacement, description } of replacements) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      console.log(`  ✓ ${description}`);
      modified = true;
    }
  }

  // Add API import if invoke was removed and api is used
  if (
    modified &&
    content.includes("api.") &&
    !content.includes("from '@/lib/api'")
  ) {
    // Find the last import statement
    const importMatch = content.match(/^import.*from.*['"];?\s*$/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const importIndex = content.indexOf(lastImport) + lastImport.length;
      content =
        content.slice(0, importIndex) +
        '\nimport { api } from "@/lib/api";' +
        content.slice(importIndex);
      console.log("  ✓ Added api import");
    }
  }

  if (modified) {
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  return false;
}

async function main() {
  console.log("🚀 Starting migration from Tauri invoke() to API client\n");

  const files = await glob("src/**/*.{ts,tsx}", {
    ignore: ["node_modules/**", "dist/**"],
  });

  let migratedCount = 0;

  for (const file of files) {
    if (await migrateFile(file)) {
      migratedCount++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(
    `   ${migratedCount} file(s) modified out of ${files.length} total files.`,
  );
}

main().catch(console.error);
