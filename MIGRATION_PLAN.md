# RSS Reader 架构迁移计划

## 目标架构

**新技术栈：**
- 包管理：Bun (替代 npm)
- 后端服务：Hono + TypeScript + Bun runtime
- 数据库：better-sqlite3 (Bun原生支持)
- RSS解析：feedparser 或 rss-parser (TypeScript)
- HTTP客户端：Bun原生 fetch API
- 前端：React 19 + TypeScript + Vite (保持不变)
- 打包工具：Tauri 2.x Sidecar 模式 (仅用于打包)

## 架构对比

### 旧架构
```
Frontend (React) 
    ↓ invoke()
Rust Tauri Commands (lib.rs)
    ↓
SQLite (rusqlite)
```

### 新架构
```
Frontend (React)
    ↓ fetch(http://localhost:PORT)
Hono Backend (TypeScript + Bun)
    ↓
SQLite (better-sqlite3)
    
Tauri App (仅负责打包和启动 sidecar)
```

## 迁移步骤

### Phase 1: 环境准备
1. 安装 Bun 包管理器
2. 迁移 package.json 依赖
3. 更新构建脚本

### Phase 2: Hono 后端开发
1. 创建 `backend/` 目录结构
2. 设置 Hono 服务器框架
3. 配置数据库连接 (better-sqlite3)
4. 实现所有 API 端点

### Phase 3: 功能迁移
1. Feed 管理 API
2. 文章管理 API
3. RSS 解析功能
4. 翻译服务
5. 设置管理
6. 数据库迁移工具

### Phase 4: Tauri Sidecar 配置
1. 配置 Tauri sidecar
2. 更新 tauri.conf.json
3. 生成独立的 backend 二进制文件
4. 配置端口通信

### Phase 5: 前端适配
1. 移除 `@tauri-apps/api` invoke 调用
2. 改用标准 fetch API
3. 更新 API 客户端
4. 更新类型定义

### Phase 6: 清理和测试
1. 删除 Rust 代码和依赖
2. 清理 src-tauri 目录
3. 更新测试
4. 更新文档

## 详细实现方案

### 1. Bun 迁移

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 迁移依赖
bun install
```

### 2. Backend 目录结构

```
backend/
├── src/
│   ├── index.ts           # Hono 服务器入口
│   ├── db/
│   │   ├── connection.ts  # 数据库连接
│   │   ├── schema.ts      # 表结构定义
│   │   └── migrations.ts  # 迁移工具
│   ├── routes/
│   │   ├── feeds.ts       # Feed 相关路由
│   │   ├── articles.ts    # 文章相关路由
│   │   ├── settings.ts    # 设置相关路由
│   │   └── translation.ts # 翻译相关路由
│   ├── services/
│   │   ├── rss.ts         # RSS 解析服务
│   │   └── translate.ts   # 翻译服务
│   └── types/
│       └── index.ts       # 类型定义
├── package.json
└── tsconfig.json
```

### 3. Hono API 端点映射

| Rust Command | Hono API Endpoint | Method |
|-------------|-------------------|--------|
| get_all_feeds | GET /api/feeds | GET |
| add_new_feed | POST /api/feeds | POST |
| delete_feed | DELETE /api/feeds/:id | DELETE |
| fetch_articles | GET /api/articles | GET |
| refresh_feed | POST /api/feeds/:id/refresh | POST |
| refresh_all_feeds | POST /api/feeds/refresh-all | POST |
| mark_read | PATCH /api/articles/:id/read | PATCH |
| toggle_starred | PATCH /api/articles/:id/starred | PATCH |
| get_app_setting | GET /api/settings/:key | GET |
| set_app_setting | PUT /api/settings/:key | PUT |
| translate_text | POST /api/translate | POST |
| save_translation | POST /api/translations | POST |
| get_translation | GET /api/translations/:articleId | GET |

### 4. Tauri Sidecar 配置

**tauri.conf.json 修改：**

```json
{
  "bundle": {
    "externalBin": [
      "backend/dist/server"
    ]
  },
  "plugins": {
    "shell": {
      "sidecar": true,
      "scope": [
        {
          "name": "backend",
          "cmd": "backend/dist/server",
          "args": ["--port", "3456"]
        }
      ]
    }
  }
}
```

### 5. 数据库迁移

保持相同的 SQLite schema，使用 better-sqlite3：

```typescript
// backend/src/db/schema.ts
const schema = `
  CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    category TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  
  CREATE TABLE IF NOT EXISTS articles (
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
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS translations (
    article_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
  );
`;
```

### 6. 前端 API 客户端

```typescript
// src/lib/api.ts
const API_BASE = 'http://localhost:3456/api';

export const api = {
  feeds: {
    getAll: () => fetch(`${API_BASE}/feeds`).then(r => r.json()),
    add: (data) => fetch(`${API_BASE}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    delete: (id) => fetch(`${API_BASE}/feeds/${id}`, {
      method: 'DELETE'
    }),
    refresh: (id) => fetch(`${API_BASE}/feeds/${id}/refresh`, {
      method: 'POST'
    }).then(r => r.json()),
    refreshAll: () => fetch(`${API_BASE}/feeds/refresh-all`, {
      method: 'POST'
    }).then(r => r.json()),
  },
  articles: {
    fetch: (params) => fetch(`${API_BASE}/articles?${new URLSearchParams(params)}`).then(r => r.json()),
    markRead: (id, read) => fetch(`${API_BASE}/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read })
    }),
    toggleStarred: (id, starred) => fetch(`${API_BASE}/articles/${id}/starred`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred })
    }),
  },
  settings: {
    get: (key) => fetch(`${API_BASE}/settings/${key}`).then(r => r.json()),
    set: (key, value) => fetch(`${API_BASE}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }),
  },
  translation: {
    translate: (text, targetLang) => fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    }).then(r => r.json()),
    save: (articleId, content) => fetch(`${API_BASE}/translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, content })
    }),
    get: (articleId) => fetch(`${API_BASE}/translations/${articleId}`).then(r => r.json()),
  }
};
```

## 优势分析

### 开发体验提升
- TypeScript 全栈，类型共享更简单
- 热重载更快（Bun 性能优势）
- 无需 Rust 编译，开发迭代更快
- 代码更易维护和调试

### 性能优势
- Bun 运行时性能优异
- HTTP 通信开销极小（本地）
- better-sqlite3 性能优秀

### 部署优势
- Sidecar 打包，用户无需关心后端
- 跨平台更简单（Bun 支持良好）
- 可独立运行后端服务（开发/调试）

## 风险评估

### 技术风险
- Bun 生态相对年轻，部分包可能不兼容
- Sidecar 模式需要正确配置端口和生命周期
- SQLite 数据库文件位置需要统一管理

### 缓解措施
- 使用成熟的 Bun 兼容包
- 添加健康检查和重试机制
- 使用标准数据目录（用户目录）

## 时间估算

- Phase 1: 环境准备 - 1小时
- Phase 2: Hono 后端开发 - 4小时
- Phase 3: 功能迁移 - 6小时
- Phase 4: Tauri Sidecar 配置 - 3小时
- Phase 5: 前端适配 - 3小时
- Phase 6: 清理和测试 - 2小时

**总计：约 19 小时开发时间**

## 下一步行动

1. 获得用户确认
2. 创建新分支进行迁移
3. 按阶段执行迁移计划
4. 每个阶段完成后进行测试
5. 最终验证全部功能
