# 资源类型字段提取与智能路径匹配

## 功能概述

本次更新在搜索功能中增加了对 PT 站点资源类型字段的提取，并优化了智能路径推荐算法，使其能够更准确地根据资源类型匹配存储路径。

## 主要改进

### 1. 资源类型字段提取

在 `siteParsers.js` 的 NexusPHP 解析器中添加了类型字段提取功能，支持多种提取方式：

#### 提取方法

**方法 1：从类型列图标/链接提取**
- 检查第一列的类型链接（如 `?cat=401`）
- 提取类型 ID 和名称
- 从图标的 alt、title 属性获取类型名称
- 从图片路径推断类型（如 `/pic/cat_movie.png`）

**方法 2：从第二列图标提取**
- 某些站点将类型图标放在第二列
- 从 img 标签的 alt/title 属性提取

**方法 3：从单元格文本提取**
- 直接识别常见类型名称（电影、剧集、动漫等）
- 支持中英文类型名称

#### 类型标准化

添加了 `normalizeCategory` 函数，将各种不同的类型名称统一为标准格式：

| 标准名称 | 识别别名 |
|---------|---------|
| 电影 | movie, film, bluray, bd, dvd, 401-405 |
| 剧集 | tv, series, drama, 美剧, 日剧, 韩剧, 411-415 |
| 动画 | anime, animation, 动漫, 番剧, ova, 421-423 |
| 音乐 | music, audio, mp3, flac, album, 431-433 |
| 综艺 | variety, show, reality, 真人秀, 441-442 |
| 纪录片 | documentary, docu, bbc, discovery, 451-452 |
| 软件 | software, app, application, 461-462 |
| 游戏 | game, gaming, pc, console, 471-472 |
| 体育 | sport, fitness, 481-482 |
| 学习 | education, tutorial, ebook, 电子书, 491-492 |
| 其他 | other, misc, 499 |

### 2. 增强的智能路径推荐

更新了 `pathUtils.js` 中的推荐算法，采用两级匹配策略：

#### 第一级：类型字段精确匹配（优先）

```javascript
if (torrentItem.category) {
    const exactMatch = downloadPaths.find(p => 
        p.name.toLowerCase() === category.toLowerCase() ||
        p.name.includes(category) ||
        category.includes(p.name)
    );
    if (exactMatch) {
        return exactMatch; // 直接返回精确匹配
    }
}
```

**优势**：
- 🎯 准确度高：直接使用 PT 站点提供的分类信息
- ⚡ 速度快：无需复杂的关键词匹配
- 🔒 可靠性强：不受种子命名规则影响

#### 第二级：关键词匹配（回退）

如果没有类型字段或精确匹配失败，回退到基于种子名称的关键词匹配。

### 3. 用户体验优化

在下载确认对话框中显示类型信息：

```
✨ 智能推荐 (电影)
```

用户可以清楚地看到：
- 系统已进行智能推荐
- 推荐基于的资源类型

## 数据结构

### 搜索结果对象

```javascript
{
    id: '12345',
    name: '阿凡达：水之道 Avatar.The.Way.of.Water.2022.2160p',
    subtitle: '4K HDR 中文字幕',
    link: 'https://example.com/details.php?id=12345',
    torrentUrl: 'https://example.com/download.php?id=12345',
    size: '25.6 GB',
    seeders: 154,
    leechers: 12,
    date: '2025-01-01 12:00',
    isFree: true,
    freeType: '2xFree',
    isHot: false,
    isNew: true,
    category: '电影',        // 新增：标准化的类型名称
    categoryId: 401,         // 新增：类型 ID
    siteName: 'M-Team'
}
```

## 匹配示例

### 示例 1：类型字段精确匹配

**种子信息**：
```
名称: Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX
类型: 电影 (categoryId: 401)
```

**匹配过程**：
1. 检测到 `category: '电影'`
2. 在存储路径中查找名称为 "电影" 的路径
3. 找到精确匹配：`{ name: '电影', path: '/downloads/movies' }`
4. 直接返回，无需关键词匹配

**推荐结果**：📁 电影 (`/downloads/movies`)

### 示例 2：类型字段 + 关键词双重验证

**种子信息**：
```
名称: The.Last.of.Us.S01E05.2023.2160p.WEB-DL
类型: 剧集 (categoryId: 412)
```

**匹配过程**：
1. 检测到 `category: '剧集'`
2. 精确匹配到：`{ name: '剧集', path: '/downloads/series' }`
3. 额外验证：种子名包含 "S01"（季数标识）

**推荐结果**：📁 剧集 (`/downloads/series`)

### 示例 3：回退到关键词匹配

**种子信息**：
```
名称: [Anime] Demon Slayer S03 [1080p]
类型: (无类型字段)
```

**匹配过程**：
1. 没有 category 字段
2. 回退到关键词匹配
3. 检测到 "Anime" 关键词
4. 匹配到：`{ name: '动画', path: '/downloads/anime' }`

**推荐结果**：📁 动画 (`/downloads/anime`)

## 技术细节

### 修改的文件

1. **`/server/src/utils/siteParsers.js`**
   - 添加 `normalizeCategory` 函数
   - 在 NexusPHP 解析器中添加类型提取逻辑
   - 返回结果中包含 `category` 和 `categoryId` 字段

2. **`/client/src/utils/pathUtils.js`**
   - 更新 `suggestPathByTorrentName` 函数签名
   - 从接收 `torrentName` 改为接收 `torrentItem` 对象
   - 添加类型字段优先匹配逻辑

3. **`/client/src/pages/SearchPage.jsx`**
   - 更新智能推荐调用，传递完整的 item 对象
   - 在推荐提示中显示类型信息

### 兼容性

- ✅ 向后兼容：如果 PT 站点不提供类型字段，自动回退到关键词匹配
- ✅ 多站点支持：支持不同 PT 站点的类型命名规则
- ✅ 灵活配置：用户可以自定义存储路径名称

## 性能优化

1. **减少计算**：类型字段匹配避免了复杂的关键词扫描
2. **提前返回**：找到精确匹配后立即返回，不进行后续计算
3. **缓存友好**：类型字段在解析时一次性提取，无需重复处理

## 未来改进方向

1. **类型映射配置化**：允许用户自定义类型到路径的映射规则
2. **多类型支持**：处理跨类型资源（如音乐纪录片）
3. **子类型识别**：区分电影类型（动作、科幻等）
4. **统计分析**：记录匹配准确率，持续优化算法
5. **用户反馈学习**：根据用户手动调整学习偏好

## 测试建议

1. 测试不同 PT 站点的类型字段提取
2. 验证类型标准化的准确性
3. 测试精确匹配和关键词匹配的回退机制
4. 检查推荐提示的显示效果
