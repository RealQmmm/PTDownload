# 创建剧集子文件夹功能实现说明

## 功能概述

在设置页面的"下载"部分添加了"创建剧集子文件夹"选项，当启用此功能时，下载剧集类型的资源会自动创建父文件夹来组织集数。

## 前端实现

### 1. 状态变量
**文件**: `/client/src/pages/SettingsPage.jsx`

```javascript
const [createSeriesSubfolder, setCreateSeriesSubfolder] = useState(false);
```

### 2. 设置加载
```javascript
setCreateSeriesSubfolder(data.create_series_subfolder === 'true' || data.create_series_subfolder === true);
```

### 3. 保存处理
```javascript
const handleToggleSeriesSubfolder = async (newValue) => {
    setSaving(true);
    setMessage(null);
    try {
        const res = await authenticatedFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ create_series_subfolder: newValue })
        });
        if (res.ok) {
            setCreateSeriesSubfolder(newValue);
            setMessage({
                type: 'success',
                text: newValue ? '剧集子文件夹已启用' : '剧集子文件夹已禁用'
            });
        }
    } catch (err) {
        setMessage({ type: 'error', text: '保存出错' });
    } finally {
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    }
};
```

### 4. UI 组件
在"默认下载路径"卡片的右侧添加了开关：

```jsx
{/* 创建剧集子文件夹选项 */}
<div className="lg:w-64 flex-shrink-0">
    <div className="flex items-start justify-between">
        <div className="flex-1 mr-3">
            <h3 className={`text-sm font-bold ${textPrimary} mb-1`}>
                创建剧集子文件夹
            </h3>
            <p className={`text-xs ${textSecondary}`}>
                下载剧集时自动创建父文件夹
            </p>
        </div>
        <button
            onClick={() => handleToggleSeriesSubfolder(!createSeriesSubfolder)}
            disabled={saving}
            className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer flex-shrink-0 ${
                createSeriesSubfolder ? 'bg-blue-600' : 'bg-gray-300'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${
                createSeriesSubfolder ? 'left-6.5' : 'left-0.5'
            }`} />
        </button>
    </div>
</div>
```

## 后端实现

### 1. 数据库设置
**文件**: `/server/src/db/index.js`

```javascript
{ key: 'create_series_subfolder', value: 'false' }, // Create subfolder for series downloads
```

### 2. 下载逻辑实现（待实现）

需要在以下文件中实现逻辑：
- `/server/src/routes/download.js` - 手动下载
- `/server/src/services/rssService.js` - RSS 自动下载

#### 实现思路

1. **读取设置**
```javascript
const { getDB } = require('../db');
const db = getDB();
const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
const createSeriesSubfolder = setting?.value === 'true';
```

2. **判断是否为剧集**
```javascript
// 方法 1: 根据下载路径判断
function isSeriesPath(savePath, downloadPaths) {
    if (!savePath) return false;
    
    // 查找匹配的路径配置
    const matchedPath = downloadPaths.find(p => 
        savePath.includes(p.path) || p.path.includes(savePath)
    );
    
    // 检查路径名称是否包含"剧集"相关关键词
    if (matchedPath) {
        const pathName = matchedPath.name.toLowerCase();
        return pathName.includes('剧集') || 
               pathName.includes('series') || 
               pathName.includes('tv') ||
               pathName.includes('episode');
    }
    
    return false;
}

// 方法 2: 根据种子名称判断（更准确）
function isSeriesFromTitle(title) {
    const episodeParser = require('../utils/episodeParser');
    const info = episodeParser.parse(title);
    
    // 如果能解析出季数和集数，认为是剧集
    return info && info.season !== null && info.episodes.length > 0;
}
```

3. **生成子文件夹名称**
```javascript
function generateSeriesFolderName(title) {
    const episodeParser = require('../utils/episodeParser');
    const info = episodeParser.parse(title);
    
    if (!info || !info.seriesName) {
        // 如果无法解析，使用种子名称的前半部分
        // 移除季数、集数、分辨率等信息
        const cleaned = title
            .replace(/S\d{1,2}E\d{1,2}/gi, '')
            .replace(/\d{4}p/gi, '')
            .replace(/\.(mkv|mp4|avi)$/i, '')
            .replace(/[.\-_]/g, ' ')
            .trim();
        return cleaned;
    }
    
    // 使用解析出的剧集名称
    return info.seriesName;
}
```

4. **修改保存路径**
```javascript
function modifySavePath(originalPath, title, createSeriesSubfolder, downloadPaths) {
    // 如果未启用子文件夹功能，直接返回原路径
    if (!createSeriesSubfolder) {
        return originalPath;
    }
    
    // 判断是否为剧集
    const isSeries = isSeriesPath(originalPath, downloadPaths) || isSeriesFromTitle(title);
    
    if (!isSeries) {
        return originalPath;
    }
    
    // 生成子文件夹名称
    const folderName = generateSeriesFolderName(title);
    
    // 拼接路径
    const pathUtils = require('../utils/pathUtils');
    const newPath = pathUtils.join(originalPath, folderName);
    
    console.log(`[Series Subfolder] Original: ${originalPath}, New: ${newPath}`);
    
    return newPath;
}
```

5. **在下载时应用**

**手动下载** (`/server/src/routes/download.js`):
```javascript
router.post('/', async (req, res) => {
    try {
        let { clientId, torrentUrl, savePath, category, title } = req.body;
        
        // 读取设置
        const db = getDB();
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
        const createSeriesSubfolder = setting?.value === 'true';
        
        // 获取所有下载路径配置
        const downloadPaths = db.prepare('SELECT * FROM download_paths').all();
        
        // 修改保存路径（如果启用了子文件夹功能）
        if (savePath && title) {
            savePath = modifySavePath(savePath, title, createSeriesSubfolder, downloadPaths);
        }
        
        const options = { savePath, category };
        
        // ... 继续原有的下载逻辑
    }
});
```

**RSS 自动下载** (`/server/src/services/rssService.js`):
```javascript
async executeTask(task) {
    // ... 现有代码
    
    // 在添加到下载器之前修改保存路径
    const db = getDB();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
    const createSeriesSubfolder = setting?.value === 'true';
    
    const downloadPaths = db.prepare('SELECT * FROM download_paths').all();
    
    let finalSavePath = task.save_path;
    if (createSeriesSubfolder && item.title) {
        finalSavePath = modifySavePath(task.save_path, item.title, createSeriesSubfolder, downloadPaths);
    }
    
    // 使用修改后的路径
    result = await downloaderService.addTorrent(targetClient, item.link, {
        savePath: finalSavePath,
        category: task.category
    });
}
```

## 使用示例

### 示例 1：剧集下载

**设置：**
- 创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/series`（剧集路径）

**种子：** `The.Last.of.Us.S01E05.2023.2160p.WEB-DL.DDP5.1.Atmos.H.265`

**匹配过程：**
1. 检测到下载路径是"剧集"路径 ✅
2. 解析种子名称，提取剧集名称：`The Last of Us`
3. 生成子文件夹：`The Last of Us`
4. 最终保存路径：`/downloads/series/The Last of Us/`

**文件结构：**
```
/downloads/series/
└── The Last of Us/
    ├── The.Last.of.Us.S01E01.mkv
    ├── The.Last.of.Us.S01E02.mkv
    ├── The.Last.of.Us.S01E03.mkv
    ├── The.Last.of.Us.S01E04.mkv
    └── The.Last.of.Us.S01E05.mkv
```

### 示例 2：电影下载

**设置：**
- 创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/movies`（电影路径）

**种子：** `Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.mkv`

**匹配过程：**
1. 检测到下载路径不是"剧集"路径 ❌
2. 种子名称中没有季数/集数标识 ❌
3. 不创建子文件夹
4. 最终保存路径：`/downloads/movies/`

**文件结构：**
```
/downloads/movies/
├── Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.mkv
└── Oppenheimer.2023.2160p.BluRay.REMUX.mkv
```

### 示例 3：纪录片剧集

**设置：**
- 创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/series`（剧集路径）

**种子：** `Planet.Earth.II.S01E01.2016.2160p.BluRay.mkv`

**匹配过程：**
1. 检测到下载路径是"剧集"路径 ✅
2. 解析种子名称，提取剧集名称：`Planet Earth II`
3. 生成子文件夹：`Planet Earth II`
4. 最终保存路径：`/downloads/series/Planet Earth II/`

## 注意事项

1. **路径判断优先级**
   - 优先根据下载路径配置判断
   - 其次根据种子名称特征判断
   - 两者都满足时才创建子文件夹

2. **文件夹命名规范**
   - 移除特殊字符（`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`）
   - 使用 `.` 或空格分隔
   - 避免过长的文件夹名称

3. **下载器兼容性**
   - qBittorrent：支持自动创建不存在的文件夹 ✅
   - Transmission：支持自动创建不存在的文件夹 ✅

4. **性能考虑**
   - 每次下载时都需要读取设置和路径配置
   - 可以考虑缓存设置值以提高性能

## 后续优化方向

1. **自定义命名规则**
   - 允许用户自定义子文件夹命名模板
   - 例如：`{series_name} ({year})` → `The Last of Us (2023)`

2. **多季管理**
   - 为不同季创建子文件夹
   - 例如：`/downloads/series/The Last of Us/Season 01/`

3. **智能合并**
   - 检测已存在的相似文件夹
   - 避免创建重复的文件夹（如 `The.Last.of.Us` 和 `The Last of Us`）

4. **手动调整**
   - 在下载确认对话框中显示生成的文件夹名称
   - 允许用户手动修改

## 总结

✅ **前端实现完成**
- 添加了状态变量
- 实现了设置加载和保存
- 添加了 UI 开关

✅ **数据库设置完成**
- 添加了默认设置项

⏳ **后端逻辑待实现**
- 需要在下载路由和 RSS 服务中添加路径修改逻辑
- 需要实现剧集判断和文件夹名称生成函数

建议先测试前端功能是否正常，然后再实现后端逻辑。
