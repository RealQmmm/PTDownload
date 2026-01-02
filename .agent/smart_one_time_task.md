# 一次性RSS任务 - 智能判断功能

## 更新时间
2026-01-02

## 功能说明

系统会**自动判断**任务是否应该设为一次性任务，无需手动指定！

---

## 智能判断规则

### 自动设为一次性任务 ✅

当任务的 `category`（分类）包含以下关键词时，自动设为一次性任务：

#### 中文关键词
- ✅ `电影`
- ✅ `音乐`
- ✅ `书籍`
- ✅ `游戏`

#### 英文关键词
- ✅ `movie` / `movies`
- ✅ `film` / `films`
- ✅ `music` / `album`
- ✅ `book` / `books`
- ✅ `game` / `games`

### 保持持续运行 🔄

其他分类（如 `Series`、`TV`、`Anime` 等）保持为普通任务，持续运行。

---

## 使用示例

### 示例1: 电影任务（自动一次性）

```javascript
// 创建任务
POST /api/tasks
{
    "name": "阿凡达3",
    "category": "Movies",  // ⭐ 包含 "movie"
    // ... 其他参数 ...
    // 不需要设置 auto_disable_on_match
}

// 结果
// ✅ 自动设置为一次性任务
// auto_disable_on_match = 1
```

### 示例2: 追剧任务（自动持续）

```javascript
// 创建任务
POST /api/tasks
{
    "name": "权力的游戏 S08",
    "category": "Series",  // ⭐ 不包含一次性关键词
    // ... 其他参数 ...
}

// 结果
// ✅ 自动设置为普通任务
// auto_disable_on_match = 0
```

### 示例3: 手动指定（优先级最高）

```javascript
// 创建任务
POST /api/tasks
{
    "name": "特殊任务",
    "category": "Movies",
    "auto_disable_on_match": 0  // ⭐ 手动指定
}

// 结果
// ✅ 使用手动指定的值
// auto_disable_on_match = 0（即使category是Movies）
```

---

## 判断逻辑

### 代码实现
**文件**: `server/src/services/taskService.js:23-40`

```javascript
createTask(task) {
    const { ..., category, auto_disable_on_match } = task;
    
    // 智能判断逻辑
    let finalAutoDisable = auto_disable_on_match;
    
    if (finalAutoDisable === undefined) {
        // 一次性下载的分类
        const oneTimeCategories = [
            'movie', 'movies', 'film', 'films', '电影',
            'music', 'album', '音乐',
            'book', 'books', '书籍',
            'game', 'games', '游戏'
        ];
        
        const categoryLower = (category || '').toLowerCase();
        
        // 检查category是否包含任何一次性关键词
        finalAutoDisable = oneTimeCategories.some(cat => 
            categoryLower.includes(cat)
        ) ? 1 : 0;
    }
    
    // 使用判断后的值创建任务
    db.prepare('INSERT INTO tasks (..., auto_disable_on_match) VALUES (..., ?)')
        .run(..., finalAutoDisable);
}
```

### 判断流程

```
创建任务
    ↓
检查 auto_disable_on_match 参数
    ↓
已手动指定？
    ├─ 是 → 使用指定的值 ✅
    └─ 否 → 智能判断
         ↓
    检查 category
         ↓
    包含一次性关键词？
         ├─ 是 → auto_disable_on_match = 1 ✅
         └─ 否 → auto_disable_on_match = 0 ✅
```

---

## 分类建议

### 推荐的分类命名

#### 一次性任务（自动禁用）
```
✅ Movies          - 电影
✅ Films           - 影片
✅ 电影            - 中文电影
✅ Music           - 音乐
✅ Albums          - 专辑
✅ Books           - 书籍
✅ Games           - 游戏
```

#### 持续任务（持续运行）
```
🔄 Series          - 剧集
🔄 TV              - 电视剧
🔄 Anime           - 动画
🔄 Documentary     - 纪录片
🔄 Variety         - 综艺
```

---

## 优先级规则

### 规则优先级（从高到低）

1. **手动指定** 🎯
   ```javascript
   auto_disable_on_match: 1  // 明确指定，优先级最高
   ```

2. **智能判断** 🤖
   ```javascript
   category: "Movies"  // 根据分类自动判断
   ```

3. **默认值** 📋
   ```javascript
   // 如果category为空或不匹配，默认为 0（持续运行）
   ```

---

## 实际场景

### 场景1: 电影下载

```javascript
// 用户创建任务
{
    "name": "沙丘2 4K",
    "category": "Movies",
    "filter_config": "{\"keywords\":\"沙丘,Dune,2160p\"}"
}

// 系统自动处理
// 1. 检测到 category 包含 "movie"
// 2. 自动设置 auto_disable_on_match = 1
// 3. 匹配到资源后自动禁用 ✅
```

### 场景2: 追剧订阅

```javascript
// 用户创建任务
{
    "name": "权力的游戏 S08",
    "category": "Series",
    "filter_config": "{\"keywords\":\"Game.of.Thrones.S08\"}"
}

// 系统自动处理
// 1. 检测到 category 不包含一次性关键词
// 2. 自动设置 auto_disable_on_match = 0
// 3. 持续运行，监控新剧集 ✅
```

### 场景3: 音乐专辑

```javascript
// 用户创建任务
{
    "name": "Taylor Swift - Midnights",
    "category": "Music",
    "filter_config": "{\"keywords\":\"Taylor Swift,Midnights,FLAC\"}"
}

// 系统自动处理
// 1. 检测到 category 包含 "music"
// 2. 自动设置 auto_disable_on_match = 1
// 3. 下载专辑后自动禁用 ✅
```

---

## 前端集成建议

### 任务创建表单

```jsx
<div className="form-group">
    <label>分类 (Category)</label>
    <select 
        value={formData.category}
        onChange={(e) => setFormData({
            ...formData,
            category: e.target.value
        })}
    >
        <option value="">请选择</option>
        
        {/* 一次性任务分类 */}
        <optgroup label="一次性下载（自动禁用）">
            <option value="Movies">🎬 电影</option>
            <option value="Music">🎵 音乐</option>
            <option value="Books">📚 书籍</option>
            <option value="Games">🎮 游戏</option>
        </optgroup>
        
        {/* 持续任务分类 */}
        <optgroup label="持续订阅（持续运行）">
            <option value="Series">📺 剧集</option>
            <option value="Anime">🎌 动画</option>
            <option value="Documentary">🎥 纪录片</option>
            <option value="Variety">🎭 综艺</option>
        </optgroup>
    </select>
    
    {/* 显示提示 */}
    {formData.category && (
        <p className="help-text">
            {isOneTimeCategory(formData.category) ? (
                <span className="text-info">
                    ℹ️ 此分类将自动设为一次性任务，匹配后自动禁用
                </span>
            ) : (
                <span className="text-muted">
                    ℹ️ 此分类将持续运行，适合追剧等场景
                </span>
            )}
        </p>
    )}
</div>

{/* 高级选项：允许手动覆盖 */}
<details>
    <summary>高级选项</summary>
    <label>
        <input
            type="checkbox"
            checked={formData.auto_disable_on_match === 1}
            onChange={(e) => setFormData({
                ...formData,
                auto_disable_on_match: e.target.checked ? 1 : 0
            })}
        />
        手动设置为一次性任务（覆盖自动判断）
    </label>
</details>
```

### 辅助函数

```javascript
// 判断是否为一次性分类
function isOneTimeCategory(category) {
    const oneTimeCategories = [
        'movie', 'movies', 'film', 'films', '电影',
        'music', 'album', '音乐',
        'book', 'books', '书籍',
        'game', 'games', '游戏'
    ];
    
    const categoryLower = (category || '').toLowerCase();
    return oneTimeCategories.some(cat => categoryLower.includes(cat));
}
```

---

## 日志输出

### 创建任务时的日志

```bash
# 电影任务（自动一次性）
[Task] Creating task "沙丘2 4K" with category "Movies"
[Task] Auto-detected as one-time task (auto_disable_on_match = 1)

# 追剧任务（自动持续）
[Task] Creating task "权力的游戏 S08" with category "Series"
[Task] Auto-detected as continuous task (auto_disable_on_match = 0)

# 手动指定
[Task] Creating task "特殊任务" with category "Movies"
[Task] Using manually specified auto_disable_on_match = 0
```

---

## 常见问题

### Q1: 如果我想让电影任务持续运行怎么办？

**A**: 手动指定 `auto_disable_on_match = 0`，会覆盖自动判断。

```javascript
{
    "category": "Movies",
    "auto_disable_on_match": 0  // 手动指定
}
```

### Q2: 如果category为空会怎样？

**A**: 默认设为普通任务（`auto_disable_on_match = 0`），持续运行。

### Q3: 可以添加新的一次性关键词吗？

**A**: 可以！修改 `taskService.js` 中的 `oneTimeCategories` 数组：

```javascript
const oneTimeCategories = [
    'movie', 'movies', 'film', 'films', '电影',
    'music', 'album', '音乐',
    'book', 'books', '书籍',
    'game', 'games', '游戏',
    'software', '软件'  // ← 添加新关键词
];
```

### Q4: 大小写敏感吗？

**A**: 不敏感。系统会自动转换为小写进行匹配。

```javascript
"Movies" === "movies" === "MOVIES"  // 都会匹配
```

---

## 优势

### 1. 用户体验 ✨
- ✅ 无需手动选择
- ✅ 自动化程度高
- ✅ 减少操作步骤

### 2. 智能化 🤖
- ✅ 根据分类自动判断
- ✅ 支持中英文关键词
- ✅ 可手动覆盖

### 3. 灵活性 🔄
- ✅ 保留手动指定选项
- ✅ 优先级清晰
- ✅ 易于扩展

---

## 总结

### 使用方式

| 方式 | 说明 | 优先级 |
|------|------|--------|
| **自动判断** | 根据category自动设置 | 低 |
| **手动指定** | 明确设置auto_disable_on_match | 高 ⭐ |

### 分类规则

| 分类类型 | 关键词 | 行为 |
|---------|--------|------|
| **电影** | movie, film, 电影 | 一次性 ✅ |
| **音乐** | music, album, 音乐 | 一次性 ✅ |
| **书籍** | book, 书籍 | 一次性 ✅ |
| **游戏** | game, 游戏 | 一次性 ✅ |
| **剧集** | series, tv, anime | 持续 🔄 |
| **其他** | - | 持续 🔄 |

### 推荐做法

1. ✅ **使用标准分类**: Movies, Series, Music 等
2. ✅ **让系统自动判断**: 大部分情况下无需手动设置
3. ✅ **特殊情况手动指定**: 需要覆盖时明确设置

**现在创建任务时，系统会根据分类自动判断是否为一次性任务，无需手动指定！** 🎉
