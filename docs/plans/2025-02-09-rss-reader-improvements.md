# RSS Reader 改进实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成5项改进：使用 Iconify 图标、简化界面、添加设置功能、优化 Feed 默认名称、修复 OPML 导入

**Architecture:**

- 前端：使用 @iconify-icon/react 替换所有 emoji 图标
- 新增 Settings 组件，支持翻译 API 配置
- 修改 OPML 解析逻辑，支持嵌套结构
- 使用 URL 解析提取域名作为默认 Feed 名称

**Tech Stack:** React 19, TypeScript 5, Tauri 2.x, @iconify-icon/react, Zustand

---

## Task 1: 安装 @iconify-icon/react 依赖

**Files:**

- Modify: `package.json`

**Step 1: 安装依赖**

```bash
npm install @iconify-icon/react
```

**Step 2: 验证安装**

```bash
npm list @iconify-icon/react
```

Expected: 显示版本号

---

## Task 2: 使用 Iconify 图标替换所有 Emoji

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ArticleList.tsx`
- Modify: `src/components/ArticleView.tsx`
- Modify: `src/components/OPMLImport.tsx`

**Step 1: 修改 App.tsx - Header 图标**

替换以下 emoji 为 Iconify 图标：

- 📡 (RSS) → `icon="mdi:rss"` 或 `icon="mdi:rss-box"`
- 📥 (Import) → `icon="mdi:database-import"`
- 🔄 (Refresh) → `icon="mdi:refresh"`
- ⏳ (Loading) → `icon="mdi:loading"` (需要旋转动画)
- ☀️ (Light) → `icon="mdi:white-balance-sunny"`
- 🌙 (Dark) → `icon="mdi:moon-waning-crescent"`
- ⚙️ (Settings) → `icon="mdi:cog"`

**Step 2: 修改 Sidebar.tsx**

- 📡 → `icon="mdi:rss"`
- - (Add) → `icon="mdi:plus"`
- 📰 (All Articles) → `icon="mdi:newspaper-variant-multiple"`

**Step 3: 修改 ArticleList.tsx**

- ⭐ (Starred) → `icon="mdi:star"` (黄色)

**Step 4: 修改 ArticleView.tsx**

- 📰 (Feed) → `icon="mdi:newspaper-variant"`
- 👤 (Author) → `icon="mdi:account"`
- ⭐/☆ (Star) → `icon="mdi:star"` / `icon="mdi:star-outline"`
- 🌐 (Translate) → `icon="mdi:translate"`
- 📝 (Translated) → `icon="mdi:file-document-edit"`

**Step 5: 修改 OPMLImport.tsx**

- ✕ (Close) → `icon="mdi:close"`

---

## Task 3: 简化界面 - 移除 Sidebar 重复标题

**Files:**

- Modify: `src/components/Sidebar.tsx`

**Step 1: 移除 Sidebar Header**

删除 Sidebar 组件中的标题区域（第 52-57 行）：

```tsx
{
  /* Header - REMOVE THIS */
}
<div className="p-4 border-b border-border">
  <h1 className="text-lg font-semibold flex items-center gap-2">
    <span className="text-primary">📡</span> RSS Reader
  </h1>
</div>;
```

保留 "All Articles" 按钮作为第一个选项。

---

## Task 4: 创建设置界面组件

**Files:**

- Create: `src/components/Settings.tsx`
- Modify: `src/App.tsx`
- Modify: `src/stores/useAppStore.ts`

**Step 1: 扩展 Store 添加设置状态**

在 `useAppStore.ts` 中添加：

```typescript
// Settings
settings: {
  translationApiKey: string;
  translationBaseUrl: string;
  translationPrompt: string;
};
setTranslationApiKey: (key: string) => void;
setTranslationBaseUrl: (url: string) => void;
setTranslationPrompt: (prompt: string) => void;
```

**Step 2: 创建 Settings.tsx 组件**

设置项包括：

- Translation API Key (password input)
- Translation Base URL (text input, default: https://libretranslate.com)
- Translation Prompt (textarea, default: "Translate the following text to Chinese:")

**Step 3: 在 App.tsx 中集成 Settings 组件**

添加状态管理，点击设置按钮打开 Settings 弹窗。

---

## Task 5: 添加 Feed 时使用域名作为默认名称

**Files:**

- Modify: `src/components/Sidebar.tsx`

**Step 1: 添加 URL 解析函数**

```typescript
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "New Feed";
  }
}
```

**Step 2: 修改 addFeedMutation**

使用域名作为默认标题：

```typescript
const addFeedMutation = useMutation({
  mutationFn: async (url: string) => {
    const title = extractDomainFromUrl(url);
    await invoke<Feed>("add_new_feed", {
      title,
      url,
      description: null,
      category: null,
    });
  },
  // ...
});
```

---

## Task 6: 修复 OPML 嵌套结构导入

**Files:**

- Modify: `src/lib/opml.ts`
- Modify: `src/lib/opml.test.ts`

**Step 1: 分析 OPML 结构**

hn-blogs.opml 的结构：

```xml
<outline text="Blogs" title="Blogs">
  <outline type="rss" text="simonwillison.net" xmlUrl="..."/>
  ...
</outline>
```

当前的正则表达式只匹配单层，无法处理嵌套。

**Step 2: 重写 importFromOPML 函数**

使用 DOMParser 替代正则表达式：

```typescript
export async function importFromOPML(
  opmlContent: string,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(opmlContent, "text/xml");

    // 递归提取所有 type="rss" 的 outline
    const rssOutlines: Array<{ title: string; url: string }> = [];

    function extractOutlines(node: Element) {
      if (node.tagName === "outline") {
        const type = node.getAttribute("type");
        const xmlUrl = node.getAttribute("xmlUrl");
        const text =
          node.getAttribute("text") || node.getAttribute("title") || "Unknown";

        if (type === "rss" && xmlUrl) {
          rssOutlines.push({ title: text, url: xmlUrl });
        }

        // 递归处理子 outline
        for (const child of node.children) {
          extractOutlines(child);
        }
      }
    }

    for (const outline of doc.querySelectorAll("outline")) {
      extractOutlines(outline);
    }

    // 导入提取的 feeds
    for (const { title, url } of rssOutlines) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("add_new_feed", {
          title,
          url,
          description: null,
          category: null,
        });
        count++;
      } catch (e) {
        errors.push(`Failed to import ${title}: ${e}`);
      }
    }
  } catch (e) {
    errors.push(`Failed to parse OPML: ${e}`);
  }

  return { count, errors };
}
```

**Step 3: 添加嵌套 OPML 测试用例**

在 `opml.test.ts` 中添加：

```typescript
it("should handle nested OPML structure", async () => {
  const nestedOPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Category">
      <outline type="rss" text="Feed 1" xmlUrl="https://feed1.com/rss"/>
      <outline type="rss" text="Feed 2" xmlUrl="https://feed2.com/rss"/>
    </outline>
  </body>
</opml>`;

  const result = await importFromOPML(nestedOPML);
  expect(result.count).toBe(2);
});
```

---

## Task 7: 更新后端翻译函数支持自定义配置

**Files:**

- Modify: `src-tauri/src/lib.rs`

**Step 1: 修改 translate_text 命令**

从设置中读取 API key 和 base URL：

```rust
#[tauri::command]
fn translate_text(text: String, target_lang: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    // 读取设置
    let base_url = get_setting("translation_base_url".to_string())?
        .unwrap_or_else(|| "https://libretranslate.com".to_string());
    let api_key = get_setting("translation_api_key".to_string())?
        .unwrap_or_default();

    // 构建请求...
}
```

---

## Task 8: 运行测试验证

**Files:**

- All modified files

**Step 1: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

**Step 2: 运行测试**

```bash
npm run test:run
```

**Step 3: 运行 Lint**

```bash
npm run lint
```

---

## Summary of Changes

| 文件                             | 变更类型 | 说明                                                    |
| -------------------------------- | -------- | ------------------------------------------------------- |
| `package.json`                   | 修改     | 添加 @iconify-icon/react 依赖                           |
| `src/App.tsx`                    | 修改     | 使用 Iconify 图标，集成 Settings 组件                   |
| `src/components/Sidebar.tsx`     | 修改     | 移除重复标题，使用 Iconify 图标，域名作为默认 Feed 名称 |
| `src/components/ArticleList.tsx` | 修改     | 使用 Iconify 图标                                       |
| `src/components/ArticleView.tsx` | 修改     | 使用 Iconify 图标                                       |
| `src/components/OPMLImport.tsx`  | 修改     | 使用 Iconify 图标                                       |
| `src/components/Settings.tsx`    | 新建     | 设置界面组件                                            |
| `src/stores/useAppStore.ts`      | 修改     | 添加设置状态                                            |
| `src/lib/opml.ts`                | 修改     | 修复嵌套 OPML 解析                                      |
| `src/lib/opml.test.ts`           | 修改     | 添加嵌套结构测试                                        |
| `src-tauri/src/lib.rs`           | 修改     | 支持自定义翻译配置                                      |
