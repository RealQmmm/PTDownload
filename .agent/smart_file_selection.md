# 智能剧集文件选择功能

## 功能概述

系统现在支持智能文件选择，可以在下载季包（Season Pack）时自动跳过已下载的剧集文件，只下载新的剧集。

## 工作原理

### 场景示例

**已下载**: S01E01  
**新种子**: S01E01-E02

**旧行为**:
- 下载整个种子包（包括 E01 和 E02）
- 依赖下载器的文件校验跳过 E01
- 可能产生重复记录

**新行为**:
1. 解析种子文件列表
2. 识别每个文件包含的剧集信息
3. 对比历史下载记录
4. 只选择包含新剧集的文件（E02）
5. 通过下载器 API 设置文件优先级

## 技术实现

### 1. 文件选择器 (`fileSelector.js`)

```javascript
// 核心方法
selectFiles(torrentFiles, downloadedEpisodes, targetSeason)
```

**输入**:
- `torrentFiles`: 种子文件列表 `[{name, size}, ...]`
- `downloadedEpisodes`: 已下载剧集编号 `[1, 2, 3]`
- `targetSeason`: 目标季度（用于匹配）

**输出**:
- 文件索引数组 `[0, 2, 5]`（需要下载的文件）

**逻辑**:
1. 遍历所有文件
2. 使用 `episodeParser` 解析文件名中的剧集信息
3. 检查是否包含新剧集
4. 无法识别的文件（字幕、NFO等）默认包含

### 2. 下载器服务增强

#### qBittorrent
```javascript
// 添加种子后设置文件优先级
POST /api/v2/torrents/filePrio
参数: hash, id (文件索引), priority (0=不下载, 1=下载)
```

#### Transmission
```javascript
// 添加种子时指定文件
torrent-add {
  metainfo: "base64...",
  "files-wanted": [0, 2, 5],      // 需要的文件
  "files-unwanted": [1, 3, 4]     // 不需要的文件
}
```

### 3. RSS 服务集成

在 `rssService.js` 中的处理流程：

```
1. 匹配到种子
2. 下载种子文件
3. 解析种子元数据
   ├─ 单文件? → 正常下载
   └─ 多文件? → 继续
4. 解析种子标题获取季度信息
5. 查询该季度已下载剧集
6. 调用 fileSelector.selectFiles()
7. 传递 fileIndices 给下载器
```

## 支持的格式

### 文件名识别

系统可以识别以下格式的文件名：

- `Series.Name.S01E01.1080p.mkv` → S01E01
- `Series.Name.S01E01-E03.1080p.mkv` → S01E01-E03
- `[Group] Series S01E05 [1080p].mkv` → S01E05
- `Series.1x01.Title.mkv` → S01E01

### 季包检测

- `Series.Name.S01.Complete.1080p` → 季包
- `Series.Name.Season.1.1080p` → 季包

## 日志示例

### 成功选择文件
```
[RSS] Match found: Series S01E01-E10. Adding to downloader...
[RSS] Smart file selection: 8/10 files selected for Series S01E01-E10
[qBittorrent] Set file priorities for abc123: downloading 8/10 files
[RSS] Successfully added: Series S01E01-E10 (8 files selected)
```

### 全部已下载
```
[RSS] Match found: Series S01E01-E05. Adding to downloader...
[RSS] All files in Series S01E01-E05 already downloaded. Skipping.
匹配到资源但已存在: Series S01E01-E05 (原因: 所有文件已下载)
```

## 限制

1. **仅支持 .torrent 文件**: Magnet 链接无法提前解析文件列表
2. **依赖文件名规范**: 文件名必须包含可识别的剧集信息
3. **季度匹配**: 只在同一季度内进行对比
4. **网络延迟**: qBittorrent 需要等待 500ms 让种子被处理

## 回退机制

如果任何步骤失败（解析失败、API 错误等），系统会：
1. 记录警告日志
2. 继续下载整个种子（保守策略）
3. 不会因为智能选择失败而丢失下载

## 性能影响

- **额外解析**: 每个种子需要解析元数据（~50-200ms）
- **API 调用**: qBittorrent 需要额外 2 次 API 调用
- **内存**: 种子文件需要临时加载到内存（通常 < 1MB）

## 配置

无需额外配置，功能自动启用。

要禁用此功能，可以修改 `rssService.js` 中的相关代码块。
