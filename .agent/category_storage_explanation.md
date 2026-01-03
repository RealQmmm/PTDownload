# 分类数据存储说明

## 检查时间
2026-01-03 23:00

## 分类数据存储位置

### ✅ 存储在 `settings` 表中

分类映射数据以 **JSON 字符串** 的形式存储在 `settings` 表中。

---

## 详细说明

### 1. 存储表
- **表名**: `settings`
- **字段**: `key` = `'category_map'`, `value` = JSON 字符串

### 2. 数据结构

```javascript
// settings 表中的存储
{
    key: 'category_map',
    value: '{"电影":["电影","movie","movies","film"],"剧集":["剧集","tv","series"],...}'
}
```

### 3. JSON 数据格式

```json
{
    "电影": ["电影", "movie", "movies", "film", "films", "bluray", "bd", "dvd", "401", "402"],
    "剧集": ["剧集", "tv", "series", "tvshow", "drama", "美剧", "日剧", "韩剧"],
    "动画": ["动画", "anime", "animation", "cartoon", "动漫", "番剧"],
    "音乐": ["音乐", "music", "audio", "mp3", "flac", "ape"],
    "综艺": ["综艺", "variety", "show", "reality", "真人秀"],
    "纪录片": ["纪录片", "documentary", "docu", "nature", "bbc"],
    "软件": ["软件", "software", "app", "application", "program"],
    "游戏": ["游戏", "game", "games", "gaming", "pc", "console"],
    "体育": ["体育", "sport", "sports", "fitness"],
    "学习": ["学习", "education", "tutorial", "course", "ebook", "电子书"],
    "其他": ["其他", "other", "misc", "miscellaneous"]
}
```

**说明**:
- **键（Key）**: 分类名称（如"电影"、"剧集"）
- **值（Value）**: 该分类的别名数组

---

## 代码实现

### 前端（CategoryMapEditor.jsx）

#### 读取数据
```javascript
const fetchData = async () => {
    const res = await authenticatedFetch('/api/settings');
    const data = await res.json();
    if (data.category_map) {
        const parsed = JSON.parse(data.category_map);
        setMapData(parsed);
    }
};
```

#### 保存数据
```javascript
const saveData = async (newData) => {
    await authenticatedFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            category_map: JSON.stringify(newData)  // 转为 JSON 字符串
        })
    });
};
```

---

### 后端（settings.js）

#### 读取设置
```javascript
router.get('/', (req, res) => {
    const db = getDB();
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsMap = {};
    settings.forEach(s => {
        settingsMap[s.key] = s.value;  // category_map 的值是 JSON 字符串
    });
    res.json(settingsMap);
});
```

#### 保存设置
```javascript
router.post('/', (req, res) => {
    const settings = req.body;
    const db = getDB();
    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    for (const [key, value] of Object.entries(settings)) {
        updateStmt.run(key, String(value));  // 存储为字符串
    }
});
```

---

## 默认配置

### 默认分类映射（CategoryMapEditor.jsx 第121-133行）

```javascript
const defaultMap = {
    '电影': ['电影', 'movie', 'movies', 'film', 'films', 'bluray', 'bd', 'dvd', '401', '402', '403', '404', '405'],
    '剧集': ['剧集', 'tv', 'series', 'tvshow', 'drama', '美剧', '日剧', '韩剧', '国产剧', 'episode', '411', '412', '413', '414', '415'],
    '动画': ['动画', 'anime', 'animation', 'cartoon', '动漫', '番剧', 'ova', 'ona', '421', '422', '423'],
    '音乐': ['音乐', 'music', 'audio', 'mp3', 'flac', 'ape', 'wav', 'album', '演唱', '演唱会', 'concert', 'live', 'mv', '431', '432', '433'],
    '综艺': ['综艺', 'variety', 'show', 'reality', '真人秀', '441', '442'],
    '纪录片': ['纪录片', 'documentary', 'docu', 'nature', 'bbc', 'discovery', '451', '452'],
    '软件': ['软件', 'software', 'app', 'application', 'program', '461', '462'],
    '游戏': ['游戏', 'game', 'games', 'gaming', 'pc', 'console', '471', '472'],
    '体育': ['体育', 'sport', 'sports', 'fitness', '481', '482'],
    '学习': ['学习', 'education', 'tutorial', 'course', 'ebook', '电子书', '491', '492'],
    '其他': ['其他', 'other', 'misc', 'miscellaneous', '499']
};
```

---

## 导出/导入

### ✅ 已包含在导出/导入功能中

由于分类映射存储在 `settings` 表中，而 `settings` 表已包含在导出/导入功能中，因此：

- ✅ **导出**: 分类映射会随 `settings` 表一起导出
- ✅ **导入**: 分类映射会随 `settings` 表一起导入

---

## 使用场景

### 1. 智能路径匹配

当用户点击下载时，系统会：
1. 获取种子的分类信息（如 "movie"、"401"）
2. 在 `category_map` 中查找匹配的分类
3. 根据匹配的分类名称（如"电影"）找到对应的下载路径

### 2. 分类识别

```javascript
// 示例：识别种子分类
const torrentCategory = "movie";  // 从 PT 站点获取

// 在 category_map 中查找
for (const [categoryName, aliases] of Object.entries(categoryMap)) {
    if (aliases.includes(torrentCategory.toLowerCase())) {
        // 找到匹配：categoryName = "电影"
        // 然后查找名为"电影"的下载路径
        break;
    }
}
```

---

## 总结

### 存储位置
- **表**: `settings`
- **键**: `category_map`
- **值**: JSON 字符串

### 数据格式
```json
{
    "分类名称": ["别名1", "别名2", "别名3", ...]
}
```

### 特点
- ✅ 存储在 `settings` 表中
- ✅ 以 JSON 字符串形式存储
- ✅ 支持自定义分类和别名
- ✅ 已包含在导出/导入功能中
- ✅ 可通过界面编辑和重置

### 相关文件
- **前端组件**: `client/src/components/CategoryMapEditor.jsx`
- **后端路由**: `server/src/routes/settings.js`
- **数据库表**: `settings`

完美！🎉
