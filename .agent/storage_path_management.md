# 存储路径管理与智能推荐功能

## 功能概述

本次更新将存储路径管理功能独立出来，并实现了基于种子类型的智能路径推荐功能。

## 主要改进

### 1. 独立的存储路径管理页面

创建了专门的 **存储路径** 管理页面，用户可以：
- 查看所有已配置的存储路径
- 添加新的存储路径
- 编辑现有路径的名称、物理路径和说明
- 删除不需要的路径

**访问方式**：侧边栏 → 📁 存储路径

### 2. 智能路径推荐

在搜索下载时，系统会根据种子名称自动推荐最合适的存储路径。

#### 推荐规则

系统通过分析种子名称中的关键词来判断资源类型：

| 路径类型 | 匹配关键词 |
|---------|-----------|
| 电影 | movie, film, bluray, bdrip, webrip, web-dl, hdtv, remux, 电影 |
| 剧集 | s0-s5, season, episode, ep, 剧集, 美剧, 日剧, 韩剧, 国产剧 |
| 动画 | anime, animation, 动画, 番剧, ova, ona |
| 音乐 | music, flac, mp3, aac, wav, ape, album, discography, 音乐, 专辑 |
| 纪录片 | documentary, docu, nature, bbc, discovery, 纪录片 |
| 综艺 | variety, show, reality, 综艺, 真人秀 |
| 软件 | software, app, game, crack, keygen, 软件, 游戏 |
| 电子书 | ebook, epub, mobi, pdf, azw3, 电子书, 书籍 |

#### 评分机制

- **基础匹配**：关键词匹配 +10 分
- **剧集特征**：检测到季数标识（S01, Season 1 等）+5 分
- **电影特征**：检测到年份标识 +3 分
- **直接名称匹配**：种子名包含路径名 +15 分

系统会选择得分最高的路径作为推荐。

### 3. 用户体验优化

- **自动选择**：打开下载确认对话框时，推荐的路径会自动被选中
- **视觉提示**：对话框中显示 "✨ 智能推荐" 标签，让用户知道系统已做出推荐
- **灵活调整**：用户仍可以手动选择其他路径或自定义路径

## 文件变更

### 新增文件

1. `/client/src/pages/PathsPage.jsx` - 存储路径管理页面
2. `/client/src/utils/pathUtils.js` - 智能路径推荐工具函数

### 修改文件

1. `/client/src/App.jsx` - 添加 PathsPage 路由
2. `/client/src/components/Sidebar.jsx` - 添加存储路径菜单项
3. `/client/src/pages/SearchPage.jsx` - 集成智能路径推荐功能

## 使用示例

### 示例 1：下载电影

种子名称：`Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.HDR.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos`

**推荐结果**：📁 电影 (`/downloads/movies`)

**匹配原因**：
- 包含 "2022"（年份）+3 分
- 包含 "BluRay" +10 分
- 包含 "REMUX" +10 分

### 示例 2：下载剧集

种子名称：`The.Last.of.Us.S01E05.2023.2160p.WEB-DL.DDP5.1.Atmos.H.265`

**推荐结果**：📁 剧集 (`/downloads/series`)

**匹配原因**：
- 包含 "S01"（季数标识）+10 分 +5 分
- 包含 "WEB-DL" +10 分

### 示例 3：下载动画

种子名称：`[Anime] Demon Slayer S03 [1080p]`

**推荐结果**：📁 动画 (`/downloads/anime`)

**匹配原因**：
- 包含 "Anime" +10 分
- 包含 "S03"（季数标识）+10 分 +5 分

## 后端 API

存储路径管理使用以下 API 端点（已存在）：

- `GET /api/download-paths` - 获取所有路径
- `POST /api/download-paths` - 创建新路径
- `PUT /api/download-paths/:id` - 更新路径
- `DELETE /api/download-paths/:id` - 删除路径

## 数据库表

使用现有的 `download_paths` 表：

```sql
CREATE TABLE IF NOT EXISTS download_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 注意事项

1. **路径名称规范**：建议使用中文或英文常见分类名称（如"电影"、"剧集"等），以便智能推荐功能更准确
2. **物理路径**：确保填写的物理路径在下载客户端中是可访问的
3. **推荐准确性**：智能推荐基于关键词匹配，对于特殊命名的种子可能需要手动选择路径
4. **性能影响**：推荐算法在客户端运行，不会增加服务器负担

## 未来改进方向

1. 支持用户自定义关键词规则
2. 学习用户的手动选择，优化推荐算法
3. 支持路径模板（如按年份、类型自动创建子目录）
4. 批量下载时的路径策略配置
