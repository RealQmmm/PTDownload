# 预定义下载路径功能实现指南

## 功能概述
在自动任务页面添加下载路径管理功能，用户可以预定义常用的下载路径，创建RSS任务时直接选择，避免手动输入错误。

---

## 后端实现

### 1. 数据库表

**文件**: `server/src/db/index.js`

```sql
CREATE TABLE IF NOT EXISTS download_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- 路径名称（如：电影、剧集）
  path TEXT NOT NULL,              -- 实际路径（如：/downloads/movies）
  description TEXT,                -- 描述
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**默认数据**:
```javascript
const defaultPaths = [
  { name: '电影', path: '/downloads/movies', description: '电影下载目录' },
  { name: '剧集', path: '/downloads/series', description: '电视剧下载目录' },
  { name: '动画', path: '/downloads/anime', description: '动画下载目录' },
  { name: '音乐', path: '/downloads/music', description: '音乐下载目录' },
  { name: '纪录片', path: '/downloads/documentary', description: '纪录片下载目录' },
  { name: '综艺', path: '/downloads/variety', description: '综艺节目下载目录' }
];
```

---

### 2. API路由

**文件**: `server/src/routes/downloadPaths.js`

```javascript
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/download-paths - 获取所有路径
router.get('/', (req, res) => {
    const db = getDB();
    const paths = db.prepare('SELECT * FROM download_paths ORDER BY id ASC').all();
    res.json(paths);
});

// POST /api/download-paths - 创建路径
router.post('/', (req, res) => {
    const { name, path, description } = req.body;
    const db = getDB();
    const info = db.prepare('INSERT INTO download_paths (name, path, description) VALUES (?, ?, ?)').run(name, path, description);
    res.status(201).json({ id: info.lastInsertRowid, name, path, description });
});

// PUT /api/download-paths/:id - 更新路径
router.put('/:id', (req, res) => {
    const { name, path, description } = req.body;
    const db = getDB();
    db.prepare('UPDATE download_paths SET name = ?, path = ?, description = ? WHERE id = ?').run(name, path, description, req.params.id);
    res.json({ message: 'Download path updated successfully' });
});

// DELETE /api/download-paths/:id - 删除路径
router.delete('/:id', (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM download_paths WHERE id = ?').run(req.params.id);
    res.json({ message: 'Download path deleted successfully' });
});

module.exports = router;
```

**注册路由**: `server/src/index.js`
```javascript
app.use('/api/download-paths', require('./routes/downloadPaths'));
```

---

## 前端实现

### 1. 状态管理

**文件**: `client/src/pages/TasksPage.jsx`

```javascript
const TasksPage = () => {
    // 现有状态...
    const [downloadPaths, setDownloadPaths] = useState([]);
    const [showPathsModal, setShowPathsModal] = useState(false);
    const [editingPath, setEditingPath] = useState(null);
    const [pathFormData, setPathFormData] = useState({
        name: '',
        path: '',
        description: ''
    });

    // 获取下载路径
    const fetchDownloadPaths = async () => {
        try {
            const res = await authenticatedFetch('/api/download-paths');
            const data = await res.json();
            setDownloadPaths(data);
        } catch (err) {
            console.error('Failed to fetch download paths:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchDownloadPaths();  // 加载下载路径
    }, []);
};
```

---

### 2. 任务表单修改

将保存路径输入框改为下拉选择：

```jsx
<div className="md:col-span-2">
    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>
        保存路径
    </label>
    <div className="flex space-x-2">
        <select
            value={formData.save_path}
            onChange={(e) => setFormData({ ...formData, save_path: e.target.value })}
            className={`flex-1 ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
        >
            <option value="">请选择路径</option>
            {downloadPaths.map(p => (
                <option key={p.id} value={p.path}>
                    {p.name} ({p.path})
                </option>
            ))}
            <option value="custom">自定义路径...</option>
        </select>
        
        <button
            type="button"
            onClick={() => setShowPathsModal(true)}
            className={`px-4 py-2 border ${borderColor} ${textSecondary} hover:${textPrimary} rounded-lg transition-colors`}
            title="管理路径"
        >
            ⚙️
        </button>
    </div>
    
    {/* 自定义路径输入框 */}
    {formData.save_path === 'custom' && (
        <input
            type="text"
            value={formData.custom_path || ''}
            onChange={(e) => setFormData({ ...formData, custom_path: e.target.value })}
            className={`w-full ${inputBg} border rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500`}
            placeholder="/downloads/custom"
        />
    )}
</div>
```

---

### 3. 路径管理模态框

```jsx
{showPathsModal && (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className={`${bgMain} rounded-2xl w-full max-w-3xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
            {/* 标题栏 */}
            <div className={`p-6 border-b ${borderColor} flex justify-between items-center`}>
                <h2 className={`text-xl font-bold ${textPrimary}`}>下载路径管理</h2>
                <button onClick={() => setShowPathsModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
            </div>

            {/* 内容区 */}
            <div className="p-6 overflow-y-auto flex-1">
                {/* 添加/编辑表单 */}
                <form onSubmit={handlePathSubmit} className={`p-4 rounded-xl border-2 ${editingPath ? 'border-blue-500/50 bg-blue-500/5' : `border-dashed ${borderColor}`} mb-6 space-y-4`}>
                    <h4 className={`text-xs font-bold ${editingPath ? 'text-blue-500' : textSecondary} uppercase`}>
                        {editingPath ? '编辑路径' : '添加新路径'}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-1`}>名称</label>
                            <input
                                required
                                type="text"
                                value={pathFormData.name}
                                onChange={(e) => setPathFormData({ ...pathFormData, name: e.target.value })}
                                className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm`}
                                placeholder="电影"
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-1`}>路径</label>
                            <input
                                required
                                type="text"
                                value={pathFormData.path}
                                onChange={(e) => setPathFormData({ ...pathFormData, path: e.target.value })}
                                className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm`}
                                placeholder="/downloads/movies"
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-1`}>描述</label>
                            <input
                                type="text"
                                value={pathFormData.description}
                                onChange={(e) => setPathFormData({ ...pathFormData, description: e.target.value })}
                                className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm`}
                                placeholder="电影下载目录"
                            />
                        </div>
                    </div>
                    
                    <div className="flex space-x-2">
                        <button type="submit" className={`px-6 py-1.5 ${editingPath ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-bold`}>
                            {editingPath ? '更新' : '添加'}
                        </button>
                        {editingPath && (
                            <button type="button" onClick={cancelPathEdit} className="px-4 py-1.5 text-gray-500 hover:text-gray-700 text-sm">
                                取消编辑
                            </button>
                        )}
                    </div>
                </form>

                {/* 路径列表 */}
                <div className="space-y-3">
                    <h3 className={`text-sm font-bold ${textPrimary} mb-2`}>已配置的路径 ({downloadPaths.length})</h3>
                    {downloadPaths.map(path => (
                        <div key={path.id} className={`flex items-center justify-between p-3 border ${borderColor} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <span className={`font-bold text-sm ${textPrimary}`}>{path.name}</span>
                                    <span className="text-xs text-gray-400 font-mono">{path.path}</span>
                                </div>
                                {path.description && (
                                    <p className="text-[10px] text-gray-400 mt-1">{path.description}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => openPathEdit(path)}
                                    className="p-1.5 text-gray-400 hover:text-blue-500"
                                    title="编辑"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => deletePath(path.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500"
                                    title="删除"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 底部按钮 */}
            <div className={`p-4 border-t ${borderColor} flex justify-end`}>
                <button onClick={() => setShowPathsModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>
                    关闭
                </button>
            </div>
        </div>
    </div>
)}
```

---

### 4. 处理函数

```javascript
// 提交路径表单
const handlePathSubmit = async (e) => {
    e.preventDefault();
    const method = editingPath ? 'PUT' : 'POST';
    const url = editingPath ? `/api/download-paths/${editingPath.id}` : '/api/download-paths';

    try {
        const res = await authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pathFormData)
        });
        if (res.ok) {
            setPathFormData({ name: '', path: '', description: '' });
            setEditingPath(null);
            fetchDownloadPaths();
        }
    } catch (err) {
        alert('保存失败');
    }
};

// 编辑路径
const openPathEdit = (path) => {
    setEditingPath(path);
    setPathFormData({
        name: path.name,
        path: path.path,
        description: path.description || ''
    });
};

// 取消编辑
const cancelPathEdit = () => {
    setEditingPath(null);
    setPathFormData({ name: '', path: '', description: '' });
};

// 删除路径
const deletePath = async (id) => {
    if (!confirm('确定删除该路径吗？')) return;
    try {
        await authenticatedFetch(`/api/download-paths/${id}`, { method: 'DELETE' });
        fetchDownloadPaths();
    } catch (err) {
        alert('删除失败');
    }
};

// 修改任务提交逻辑
const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 处理自定义路径
    const finalSavePath = formData.save_path === 'custom' 
        ? formData.custom_path 
        : formData.save_path;
    
    const payload = {
        ...formData,
        save_path: finalSavePath,
        filter_config: JSON.stringify(formData.filter_config)
    };
    
    // ... 其余提交逻辑
};
```

---

## 使用流程

### 1. 管理下载路径

```
打开自动任务页面
    ↓
点击"创建任务"
    ↓
在保存路径字段旁点击 ⚙️ 按钮
    ↓
打开"下载路径管理"模态框
    ├─ 查看已有路径
    ├─ 添加新路径
    ├─ 编辑路径
    └─ 删除路径
```

### 2. 创建任务时选择路径

```
创建任务
    ↓
选择分类: Movies
    ↓
选择保存路径: 电影 (/downloads/movies)  ← 下拉选择
    ↓
或选择"自定义路径..."
    ↓
输入自定义路径
    ↓
创建任务 ✅
```

---

## 优势

### 1. 用户体验 ✨
- ✅ 下拉选择，避免手动输入
- ✅ 路径预览，清晰明了
- ✅ 统一管理，方便维护

### 2. 减少错误 🛡️
- ✅ 避免路径拼写错误
- ✅ 避免路径格式错误
- ✅ 统一路径规范

### 3. 提高效率 ⚡
- ✅ 快速选择常用路径
- ✅ 一次配置，多次使用
- ✅ 批量管理路径

---

## 界面预览

### 任务创建表单
```
┌─────────────────────────────────────────┐
│  保存路径                                │
│  ┌────────────────────────────┬────┐   │
│  │ 电影 (/downloads/movies) ▼│ ⚙️ │   │
│  └────────────────────────────┴────┘   │
│                                         │
│  选项:                                  │
│  - 电影 (/downloads/movies)             │
│  - 剧集 (/downloads/series)             │
│  - 动画 (/downloads/anime)              │
│  - 音乐 (/downloads/music)              │
│  - 自定义路径...                        │
└─────────────────────────────────────────┘
```

### 路径管理模态框
```
┌─────────────────────────────────────────┐
│  下载路径管理                      ✕   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ 添加新路径 ─────────────────────┐  │
│  │ 名称: [电影____]                 │  │
│  │ 路径: [/downloads/movies_______] │  │
│  │ 描述: [电影下载目录____________] │  │
│  │ [添加]                           │  │
│  └──────────────────────────────────┘  │
│                                         │
│  已配置的路径 (6)                       │
│  ┌──────────────────────────────────┐  │
│  │ 电影  /downloads/movies    ✏️ 🗑️│  │
│  │ 电影下载目录                     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 剧集  /downloads/series    ✏️ 🗑️│  │
│  │ 电视剧下载目录                   │  │
│  └──────────────────────────────────┘  │
│                                         │
│                          [关闭]         │
└─────────────────────────────────────────┘
```

---

## 总结

### 实现的功能
- ✅ 下载路径预定义管理
- ✅ 路径增删改查
- ✅ 任务创建时下拉选择
- ✅ 支持自定义路径
- ✅ 默认路径预设

### 技术要点
- 数据库表: `download_paths`
- API路由: `/api/download-paths`
- 前端组件: 路径管理模态框
- 表单集成: 下拉选择 + 自定义输入

**现在用户可以方便地管理和选择下载路径，避免手动输入错误！** 🎉
