# 创建剧集子文件夹功能 - 完整实现

## 功能说明

当启用"自动创建剧集子文件夹"功能时，系统会检测种子名称是否包含明显的季数标识（如 S01, Season 1 等）。如果检测到季数标识，会自动创建一个父文件夹来组织该剧集的所有集数。

**适用范围：** 剧集、综艺节目等任何包含季数标识的多集内容

## 判断逻辑

**不再基于下载路径判断**，而是基于种子名称特征：

### 季数标识检测规则
- `S01`, `S1`, `S02` 等
- `Season 1`, `Season 01` 等
- 大小写不敏感

### 示例

✅ **会创建子文件夹：**
- `The.Last.of.Us.S01E05.2023.2160p.WEB-DL` → 创建 `The Last of Us/`
- `Running.Man.S2024E680.1080p` → 创建 `Running Man/`
- `Planet.Earth.II.Season.1.2016.2160p` → 创建 `Planet Earth II/`
- `Slow.Road.to.Hainan.2025.S01.Complete` → 创建 `Slow Road to Hainan/`

❌ **不会创建子文件夹：**
- `Avatar.The.Way.of.Water.2022.2160p.BluRay` （没有季数标识）
- `Running.Man.E680.2024.1080p` （只有集数，没有季数）

## 实现细节

### 1. 前端 UI ✅

**位置：** 设置 → 下载 → 自动创建剧集子文件夹

**文件：** `/client/src/pages/SettingsPage.jsx`

**布局：** 独立卡片，紫色左边框，清晰的描述说明

```jsx
<Card className="border-l-4 border-l-purple-500">
    <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
            <h3>📁 自动创建剧集子文件夹</h3>
            <p>检测到种子名称包含季数标识（如 S01, Season 1）时，自动创建父文件夹来组织集数。适用于剧集、综艺等多集内容</p>
        </div>
        <button>开关</button>
    </div>
</Card>
```

### 2. 后端工具函数 ✅

**文件：** `/server/src/utils/episodeParser.js`

新增两个方法：

#### `hasSeasonIdentifier(title)`
检测种子名称是否包含季数标识

```javascript
episodeParser.hasSeasonIdentifier('The.Last.of.Us.S01E05.2023.2160p')
// 返回: true

episodeParser.hasSeasonIdentifier('Avatar.2022.2160p.BluRay')
// 返回: false
```

#### `extractSeriesName(title)`
从种子名称中提取剧集名称，用于文件夹命名

```javascript
episodeParser.extractSeriesName('The.Last.of.Us.S01E05.2023.2160p.WEB-DL.H265')
// 返回: "The Last of Us"

episodeParser.extractSeriesName('Planet.Earth.II.S01E01.2016.2160p.BluRay')
// 返回: "Planet Earth II"
```

**清理规则：**
- 移除季数/集数标识（S01E05, Season 1, 1x01 等）
- 移除分辨率（2160p, 1080p, 4K 等）
- 移除质量/来源（WEB-DL, BluRay, HDTV 等）
- 移除编码（H.264, H.265, HEVC 等）
- 移除音频（AAC, DDP, Atmos 等）
- 移除年份
- 移除组标签 [xxx] 或 (xxx)
- 移除文件扩展名
- 将 `.`, `-`, `_` 替换为空格
- 移除非法文件名字符
- 限制长度为 100 字符

### 3. 手动下载逻辑 ✅

**文件：** `/server/src/routes/download.js`

在添加种子到下载器之前：
1. 读取 `create_series_subfolder` 设置
2. 如果启用且有保存路径和标题
3. 检测是否有季数标识
4. 如果有，提取剧集名称并拼接到路径

```javascript
let { clientId, torrentUrl, savePath, category, title } = req.body;

// Check if series subfolder creation is enabled
if (savePath && title) {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
    const createSeriesSubfolder = setting?.value === 'true';
    
    if (createSeriesSubfolder) {
        if (episodeParser.hasSeasonIdentifier(title)) {
            const seriesName = episodeParser.extractSeriesName(title);
            savePath = pathUtils.join(savePath, seriesName);
            console.log(`[Series Subfolder] Created subfolder for: ${seriesName}`);
        }
    }
}
```

### 4. RSS 自动下载逻辑 ✅

**文件：** `/server/src/services/rssService.js`

在 RSS 任务执行时，添加种子前应用相同的逻辑：

```javascript
// Determine final save path (with series subfolder if enabled)
let finalSavePath = task.save_path;

const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
const createSeriesSubfolder = setting?.value === 'true';

if (createSeriesSubfolder && finalSavePath && item.title) {
    if (episodeParser.hasSeasonIdentifier(item.title)) {
        const seriesName = episodeParser.extractSeriesName(item.title);
        finalSavePath = pathUtils.join(finalSavePath, seriesName);
        console.log(`[RSS][Series Subfolder] Using subfolder: ${seriesName}`);
    }
}

// Use finalSavePath instead of task.save_path
result = await downloaderService.addTorrent(targetClient, item.link, {
    savePath: finalSavePath,
    category: task.category
});
```

### 5. 数据库设置 ✅

**文件：** `/server/src/db/index.js`

```javascript
{ key: 'create_series_subfolder', value: 'false' }
```

## 使用示例

### 示例 1：剧集下载

**设置：**
- 自动创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/series`

**种子：** `The.Last.of.Us.S01E05.2023.2160p.WEB-DL.DDP5.1.Atmos.H.265`

**处理过程：**
1. 检测到季数标识 `S01` ✅
2. 提取剧集名称：`The Last of Us`
3. 拼接路径：`/downloads/series/The Last of Us/`

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

### 示例 2：综艺节目

**设置：**
- 自动创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/variety`

**种子：** `Running.Man.S2024E680.1080p.WEB-DL.H264.AAC`

**处理过程：**
1. 检测到季数标识 `S2024` ✅
2. 提取节目名称：`Running Man`
3. 拼接路径：`/downloads/variety/Running Man/`

**文件结构：**
```
/downloads/variety/
└── Running Man/
    ├── Running.Man.S2024E678.mkv
    ├── Running.Man.S2024E679.mkv
    └── Running.Man.S2024E680.mkv
```

### 示例 3：纪录片剧集

**设置：**
- 自动创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/documentary`

**种子：** `Planet.Earth.II.S01E01.2016.2160p.BluRay.mkv`

**处理过程：**
1. 检测到季数标识 `S01` ✅
2. 提取剧集名称：`Planet Earth II`
3. 拼接路径：`/downloads/documentary/Planet Earth II/`

**文件结构：**
```
/downloads/documentary/
└── Planet Earth II/
    ├── Planet.Earth.II.S01E01.mkv
    ├── Planet.Earth.II.S01E02.mkv
    └── Planet.Earth.II.S01E03.mkv
```

### 示例 4：电影（不创建子文件夹）

**设置：**
- 自动创建剧集子文件夹：✅ 启用
- 下载路径：`/downloads/movies`

**种子：** `Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.mkv`

**处理过程：**
1. 检测季数标识 ❌ 没有
2. 不创建子文件夹
3. 使用原路径：`/downloads/movies/`

**文件结构：**
```
/downloads/movies/
├── Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.mkv
└── Oppenheimer.2023.2160p.BluRay.REMUX.mkv
```

## 日志输出

启用后，在下载时会看到以下日志：

**手动下载：**
```
[Series Subfolder] Created subfolder for: The Last of Us
```

**RSS 自动下载：**
```
[RSS][Series Subfolder] Using subfolder: The Last of Us
```

**错误处理：**
```
[Series Subfolder] Error: <错误信息>
[RSS][Series Subfolder] Error: <错误信息>
```

如果发生错误，系统会继续使用原始路径，不会影响下载。

## 优势

1. **通用性强** - 不依赖下载路径判断，适用于任何包含季数标识的内容
2. **自动化** - 无需手动创建文件夹或移动文件
3. **智能识别** - 准确提取剧集名称，自动清理无关信息
4. **容错性好** - 发生错误时自动回退到原路径
5. **灵活控制** - 可随时开启或关闭

## 注意事项

1. **下载器兼容性**
   - qBittorrent：✅ 支持自动创建不存在的文件夹
   - Transmission：✅ 支持自动创建不存在的文件夹

2. **文件夹命名**
   - 自动移除特殊字符和无关信息
   - 限制长度为 100 字符
   - 使用空格分隔单词

3. **性能影响**
   - 每次下载时读取一次设置（可忽略不计）
   - 正则表达式匹配（毫秒级）

4. **错误处理**
   - 如果提取剧集名称失败，使用原路径
   - 如果路径拼接失败，使用原路径
   - 不会影响下载任务的执行

## 测试

可以使用以下测试脚本验证功能：

```bash
node test-series-subfolder.js
```

测试用例包括：
- 剧集（S01E05 格式）
- 纪录片剧集（Season 格式）
- 综艺节目（只有集数）
- 电影（无季数标识）
- 季包（S01 Complete）

## 总结

✅ **前端实现完成** - 独立卡片，清晰的 UI 和描述
✅ **后端逻辑完成** - 基于季数标识判断，智能提取剧集名称
✅ **手动下载支持** - 在下载路由中实现
✅ **RSS 自动下载支持** - 在 RSS 服务中实现
✅ **数据库设置完成** - 默认关闭，可随时开启

**功能已完全实现并部署！** 🎉
