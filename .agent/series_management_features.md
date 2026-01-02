# PTDownload 剧集管理功能需求分析

## 当前功能状态

### ✅ 已实现的功能

#### 1. 基础RSS任务管理
- ✅ 创建/编辑/删除RSS任务
- ✅ 设置保存路径
- ✅ 设置分类（Category）
- ✅ 过滤规则（关键词、排除词、大小限制）
- ✅ 定时执行（Cron）

#### 2. 追剧功能
- ✅ 创建追剧订阅
- ✅ 智能正则生成
- ✅ 自动创建RSS任务
- ✅ 订阅管理（查看、删除）

#### 3. 下载路径管理
- ✅ 预定义下载路径
- ✅ 路径增删改查
- ✅ 下拉选择路径
- ✅ 自定义路径输入

#### 4. 分类管理
- ✅ 任务创建时可设置分类
- ✅ 智能分类判断（电影/剧集）
- ✅ 分类字段传递给下载器

---

## ⚠️ 缺失的功能（需要开发）

### 1. 分类预定义管理 ❌

**问题**: 
- 当前分类需要手动输入
- 容易输入错误或不一致
- 没有统一的分类管理

**需求**:
类似于"下载路径管理"，需要一个"分类管理"功能。

**建议实现**:

#### 数据库表
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- 分类名称
  type TEXT,                       -- 类型：series/movie/anime/music
  description TEXT,                -- 描述
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 默认数据
```javascript
const defaultCategories = [
  { name: 'Movies', type: 'movie', description: '电影分类' },
  { name: 'Series', type: 'series', description: '剧集分类' },
  { name: 'Anime', type: 'anime', description: '动画分类' },
  { name: 'Music', type: 'music', description: '音乐分类' },
  { name: 'Documentary', type: 'series', description: '纪录片分类' }
];
```

#### API路由
```javascript
GET    /api/categories      - 获取所有分类
POST   /api/categories      - 创建分类
PUT    /api/categories/:id  - 更新分类
DELETE /api/categories/:id  - 删除分类
```

#### 前端UI
```jsx
// 任务创建表单
<select value={formData.category}>
    <option value="">请选择分类</option>
    {categories.map(c => (
        <option value={c.name}>{c.name} - {c.description}</option>
    ))}
    <option value="custom">✏️ 自定义分类...</option>
</select>
<button onClick={() => setShowCategoriesModal(true)}>⚙️</button>

// 分类管理模态框
{showCategoriesModal && (
    <CategoryManagementModal />
)}
```

**优先级**: ⭐⭐⭐ 高

---

### 2. 剧集专用分类生成 ❌

**问题**:
- 每个剧集需要单独的分类（如 `Game.of.Thrones.S08`）
- 手动输入容易出错
- 没有自动生成机制

**需求**:
在创建追剧订阅时，自动生成剧集专用分类。

**建议实现**:

#### 追剧订阅创建时自动生成
```javascript
// server/src/services/seriesService.js
createSubscription(data) {
    const { name, season, quality } = data;
    
    // 自动生成分类名称
    const categoryName = season 
        ? `${name.replace(/\s+/g, '.')}.S${season.padStart(2, '0')}`
        : name.replace(/\s+/g, '.');
    
    // 创建任务时使用生成的分类
    const taskId = taskService.createTask({
        name: `[追剧] ${name} ${season ? 'S' + season : ''}`,
        category: categoryName,  // 自动生成的分类
        save_path: data.save_path || '/downloads/series',
        // ... 其他配置
    });
}
```

**示例**:
```
输入:
  剧集名称: Game of Thrones
  季数: 08

自动生成:
  分类: Game.of.Thrones.S08
  保存路径: /downloads/series

最终路径:
  /downloads/series/Game.of.Thrones.S08/
```

**优先级**: ⭐⭐⭐ 高

---

### 3. 批量分类修改工具 ❌

**问题**:
- 已有任务的分类可能不规范
- 需要逐个修改很麻烦
- 没有批量操作功能

**需求**:
提供批量修改任务分类的功能。

**建议实现**:

#### API
```javascript
POST /api/tasks/batch-update-category
{
    "taskIds": [1, 2, 3],
    "category": "Game.of.Thrones.S08"
}
```

#### 前端UI
```jsx
// 任务列表页面
<div className="batch-actions">
    <input type="checkbox" onChange={handleSelectAll} />
    <button onClick={handleBatchUpdateCategory}>
        批量修改分类
    </button>
</div>

// 批量修改模态框
{showBatchModal && (
    <div>
        <h3>批量修改分类</h3>
        <p>已选择 {selectedTasks.length} 个任务</p>
        <select value={newCategory}>
            {categories.map(c => (
                <option value={c.name}>{c.name}</option>
            ))}
        </select>
        <button onClick={handleConfirmBatch}>确认修改</button>
    </div>
)}
```

**优先级**: ⭐⭐ 中

---

### 4. 分类使用统计 ❌

**问题**:
- 不知道哪些分类正在使用
- 不知道每个分类下有多少任务
- 无法清理未使用的分类

**需求**:
显示分类使用情况统计。

**建议实现**:

#### API
```javascript
GET /api/categories/stats
[
    {
        "category": "Game.of.Thrones.S08",
        "task_count": 1,
        "download_count": 8,
        "total_size": "45.2 GB"
    }
]
```

#### 前端UI
```jsx
// 分类管理页面
<div className="category-stats">
    <h3>分类使用统计</h3>
    {categoryStats.map(stat => (
        <div key={stat.category}>
            <span>{stat.category}</span>
            <span>{stat.task_count} 个任务</span>
            <span>{stat.download_count} 个下载</span>
            <span>{stat.total_size}</span>
        </div>
    ))}
</div>
```

**优先级**: ⭐ 低

---

### 5. 分类模板功能 ❌

**问题**:
- 不同类型的内容需要不同的分类命名规则
- 没有统一的命名规范
- 容易混乱

**需求**:
提供分类命名模板。

**建议实现**:

#### 模板定义
```javascript
const categoryTemplates = {
    series: {
        pattern: '{name}.S{season}',
        example: 'Game.of.Thrones.S08'
    },
    movie: {
        pattern: '{name}.{year}',
        example: 'Avatar.3.2024'
    },
    anime: {
        pattern: '{name}',
        example: 'One.Piece'
    }
};
```

#### 前端UI
```jsx
// 分类创建时
<div className="category-template">
    <label>选择模板</label>
    <select onChange={handleTemplateChange}>
        <option value="series">剧集 ({name}.S{season})</option>
        <option value="movie">电影 ({name}.{year})</option>
        <option value="anime">动画 ({name})</option>
    </select>
    
    <input name="name" placeholder="剧集名称" />
    <input name="season" placeholder="季数" />
    
    <p>预览: {generateCategoryName()}</p>
</div>
```

**优先级**: ⭐ 低

---

### 6. 文件整理助手 ❌

**问题**:
- 已下载的文件可能散乱
- 需要手动整理
- 没有自动化工具

**需求**:
提供文件整理工具，自动将散乱的文件移动到正确的分类文件夹。

**建议实现**:

#### API
```javascript
POST /api/tools/organize-files
{
    "source_path": "/downloads",
    "target_path": "/downloads/series",
    "pattern": "Game.of.Thrones.S08*",
    "category": "Game.of.Thrones.S08"
}
```

#### 前端UI
```jsx
// 工具页面
<div className="file-organizer">
    <h3>文件整理助手</h3>
    <input placeholder="源目录" />
    <input placeholder="目标目录" />
    <input placeholder="文件匹配模式" />
    <select>
        <option>选择分类</option>
        {categories.map(c => <option>{c.name}</option>)}
    </select>
    <button onClick={handleOrganize}>开始整理</button>
</div>
```

**优先级**: ⭐ 低（可以用脚本代替）

---

### 7. 追剧订阅增强 ❌

**问题**:
- 追剧订阅创建时没有设置分类选项
- 分类是自动生成的，用户无法自定义
- 保存路径选项不够灵活

**需求**:
增强追剧订阅创建界面。

**建议实现**:

#### 前端UI改进
```jsx
// 追剧订阅创建表单
<form>
    <input name="name" placeholder="剧集名称" />
    <input name="season" placeholder="季数" />
    <input name="quality" placeholder="质量" />
    
    {/* 新增：分类设置 */}
    <div className="category-setting">
        <label>分类</label>
        <div className="flex">
            <input 
                value={autoGeneratedCategory} 
                readOnly 
                placeholder="自动生成"
            />
            <button onClick={handleCustomCategory}>
                自定义
            </button>
        </div>
        <p className="hint">
            自动生成: {name}.S{season}
        </p>
    </div>
    
    {/* 新增：保存路径选择 */}
    <div className="save-path-setting">
        <label>保存路径</label>
        <select>
            <option value="">请选择路径</option>
            {downloadPaths.map(p => (
                <option value={p.path}>{p.name} ({p.path})</option>
            ))}
        </select>
    </div>
    
    <button type="submit">创建订阅</button>
</form>
```

**优先级**: ⭐⭐ 中

---

## 功能优先级总结

### 高优先级 ⭐⭐⭐ （建议立即开发）

1. **分类预定义管理**
   - 类似下载路径管理
   - 提供分类增删改查
   - 下拉选择分类

2. **剧集专用分类自动生成**
   - 追剧订阅时自动生成分类
   - 格式：`剧名.S季数`
   - 自动设置到任务中

### 中优先级 ⭐⭐ （可以后续开发）

3. **批量分类修改工具**
   - 批量选择任务
   - 统一修改分类

4. **追剧订阅增强**
   - 分类自定义选项
   - 保存路径下拉选择

### 低优先级 ⭐ （可选功能）

5. **分类使用统计**
   - 显示分类使用情况
   - 帮助清理未使用分类

6. **分类模板功能**
   - 提供命名模板
   - 规范分类命名

7. **文件整理助手**
   - 自动整理散乱文件
   - 可用脚本代替

---

## 实施建议

### 第一阶段：核心功能（立即开发）

#### 1. 分类管理功能
```
时间估计: 2-3小时
文件修改:
  - server/src/db/index.js (数据库表)
  - server/src/routes/categories.js (API路由)
  - client/src/pages/TasksPage.jsx (UI集成)
```

#### 2. 追剧分类自动生成
```
时间估计: 1小时
文件修改:
  - server/src/services/seriesService.js (自动生成逻辑)
```

### 第二阶段：增强功能（后续开发）

#### 3. 批量操作
```
时间估计: 2小时
文件修改:
  - server/src/routes/tasks.js (批量API)
  - client/src/pages/TasksPage.jsx (批量UI)
```

#### 4. 追剧订阅UI改进
```
时间估计: 1-2小时
文件修改:
  - client/src/pages/SeriesPage.jsx (表单增强)
```

---

## 代码示例

### 分类管理 - 数据库表
```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 分类管理 - API路由
```javascript
// server/src/routes/categories.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/', (req, res) => {
    const db = getDB();
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(categories);
});

router.post('/', (req, res) => {
    const { name, type, description } = req.body;
    const db = getDB();
    const info = db.prepare('INSERT INTO categories (name, type, description) VALUES (?, ?, ?)').run(name, type, description);
    res.status(201).json({ id: info.lastInsertRowid, name, type, description });
});

module.exports = router;
```

### 追剧分类自动生成
```javascript
// server/src/services/seriesService.js
createSubscription(data) {
    const { name, season } = data;
    
    // 自动生成分类
    const categoryName = season 
        ? `${name.replace(/\s+/g, '.')}.S${season.padStart(2, '0')}`
        : name.replace(/\s+/g, '.');
    
    const taskId = taskService.createTask({
        name: `[追剧] ${name} ${season ? 'S' + season : ''}`,
        category: categoryName,  // ⭐ 自动生成
        save_path: data.save_path || '/downloads/series',
        // ...
    });
}
```

---

## 总结

### 当前状态
- ✅ 基础功能完整
- ✅ 可以手动设置分类
- ⚠️ 缺少分类管理工具
- ⚠️ 追剧订阅未自动生成分类

### 需要开发的核心功能

| 功能 | 优先级 | 工作量 | 价值 |
|------|--------|--------|------|
| **分类预定义管理** | ⭐⭐⭐ | 2-3h | 高 |
| **剧集分类自动生成** | ⭐⭐⭐ | 1h | 高 |
| **批量分类修改** | ⭐⭐ | 2h | 中 |
| **追剧订阅增强** | ⭐⭐ | 1-2h | 中 |

### 建议实施顺序
1. ✅ 剧集分类自动生成（最快见效）
2. ✅ 分类预定义管理（长期价值）
3. ⏳ 追剧订阅UI增强
4. ⏳ 批量操作工具

**总工作量估计**: 6-8小时
**核心功能**: 3-4小时即可完成

需要我开始实现这些功能吗？🚀
