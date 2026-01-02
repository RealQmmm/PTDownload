# RSS任务保存路径和分类传递修复

## 问题描述
RSS任务中填写了保存位置和分类，但实际下载时并没有下载到该位置下，也没有设置分类。

## 问题原因

### 代码分析

#### 问题1: `addTorrentFromData` 缺少参数

**文件**: `server/src/services/rssService.js:164-168`

**修复前** ❌:
```javascript
if (torrentData && !item.link.startsWith('magnet:')) {
    // 下载种子文件并解析
    result = await downloaderService.addTorrentFromData(targetClient, torrentData);
    // ❌ 没有传递 savePath 和 category
}
```

**修复后** ✅:
```javascript
if (torrentData && !item.link.startsWith('magnet:')) {
    result = await downloaderService.addTorrentFromData(targetClient, torrentData, {
        savePath: task.save_path,  // ✅ 传递保存路径
        category: task.category     // ✅ 传递分类
    });
}
```

---

#### 问题2: `addTorrentFromData` 方法不支持options

**文件**: `server/src/services/downloaderService.js:339`

**修复前** ❌:
```javascript
async addTorrentFromData(client, torrentBase64) {
    // ❌ 没有接收 options 参数
    const { type, host, port, username, password } = client;
    
    // qBittorrent
    form.append('torrents', torrentBuffer, {...});
    // ❌ 没有添加 savepath 和 category
    
    // Transmission
    arguments: { metainfo: torrentBase64 }
    // ❌ 没有添加 download-dir
}
```

**修复后** ✅:
```javascript
async addTorrentFromData(client, torrentBase64, options = {}) {
    const { type, host, port, username, password } = client;
    const { savePath, category } = options;  // ✅ 解构options
    
    // qBittorrent
    form.append('torrents', torrentBuffer, {...});
    if (savePath) form.append('savepath', savePath);  // ✅ 添加保存路径
    if (category) form.append('category', category);  // ✅ 添加分类
    
    // Transmission
    const args = { metainfo: torrentBase64 };
    if (savePath) args['download-dir'] = savePath;  // ✅ 添加下载目录
}
```

---

## 修复内容

### 1. RSS服务修改

**文件**: `server/src/services/rssService.js:161-174`

```javascript
let result;
if (torrentData && !item.link.startsWith('magnet:')) {
    // 种子文件方式 - 添加 options 参数
    result = await downloaderService.addTorrentFromData(targetClient, torrentData, {
        savePath: task.save_path,
        category: task.category
    });
} else {
    // Magnet 链接方式 - 已有 options 参数
    result = await downloaderService.addTorrent(targetClient, item.link, {
        savePath: task.save_path,
        category: task.category
    });
}
```

---

### 2. 下载器服务修改

**文件**: `server/src/services/downloaderService.js:338-432`

#### qBittorrent 支持

```javascript
async addTorrentFromData(client, torrentBase64, options = {}) {
    const { savePath, category } = options;
    
    if (type === 'qBittorrent') {
        const form = new FormData();
        form.append('torrents', torrentBuffer, {...});
        
        // ⭐ 添加保存路径和分类
        if (savePath) form.append('savepath', savePath);
        if (category) form.append('category', category);
        
        await axios.post(`${baseUrl}/api/v2/torrents/add`, form, {...});
    }
}
```

**qBittorrent API 参数**:
- `savepath`: 保存路径
- `category`: 分类标签

---

#### Transmission 支持

```javascript
if (type === 'Transmission') {
    const args = { metainfo: torrentBase64 };
    
    // ⭐ 添加下载目录
    if (savePath) args['download-dir'] = savePath;
    
    await axios.post(rpcUrl, {
        method: 'torrent-add',
        arguments: args
    }, {...});
}
```

**Transmission RPC 参数**:
- `download-dir`: 下载目录
- 注意: Transmission 不支持分类（category）

---

## 完整流程

### RSS任务执行流程

```
RSS任务执行
    ↓
匹配到种子
    ↓
下载种子文件 (.torrent)
    ↓
解析 hash
    ↓
检查重复
    ↓
添加到下载器
    ├─ 种子文件方式
    │   ↓
    │   addTorrentFromData(client, data, {
    │       savePath: task.save_path,  ✅
    │       category: task.category    ✅
    │   })
    │
    └─ Magnet 链接方式
        ↓
        addTorrent(client, link, {
            savePath: task.save_path,  ✅
            category: task.category    ✅
        })
```

---

## 下载器API对比

### qBittorrent

| 参数 | 字段名 | 支持 | 说明 |
|------|--------|------|------|
| **保存路径** | `savepath` | ✅ | 种子保存位置 |
| **分类** | `category` | ✅ | 分类标签 |

**API示例**:
```javascript
POST /api/v2/torrents/add
Content-Type: multipart/form-data

torrents: <binary>
savepath: /downloads/movies
category: Movies
```

---

### Transmission

| 参数 | 字段名 | 支持 | 说明 |
|------|--------|------|------|
| **下载目录** | `download-dir` | ✅ | 下载位置 |
| **分类** | - | ❌ | 不支持分类 |

**RPC示例**:
```javascript
POST /transmission/rpc
{
    "method": "torrent-add",
    "arguments": {
        "metainfo": "<base64>",
        "download-dir": "/downloads/movies"
    }
}
```

---

## 测试验证

### 测试步骤

1. **创建RSS任务**
```
任务名称: 测试电影
分类: Movies
保存路径: /downloads/test
RSS URL: ...
关键词: test
```

2. **等待任务执行**
- 任务匹配到种子
- 自动添加到下载器

3. **检查下载器**

#### qBittorrent
```
1. 打开 qBittorrent Web UI
2. 查看种子列表
3. 检查:
   - 保存路径: /downloads/test ✅
   - 分类: Movies ✅
```

#### Transmission
```
1. 打开 Transmission Web UI
2. 查看种子列表
3. 检查:
   - 下载目录: /downloads/test ✅
   - 分类: (不支持) -
```

---

## 日志输出

### 启用系统日志后

```bash
# qBittorrent
[RSS] Match found: Movie.2024.1080p. Adding to downloader...
[Downloader] Adding torrent to qBittorrent with savePath: /downloads/movies, category: Movies
[RSS] Successfully added: Movie.2024.1080p

# Transmission
[RSS] Match found: Movie.2024.1080p. Adding to downloader...
[Downloader] Adding torrent to Transmission with savePath: /downloads/movies
[RSS] Successfully added: Movie.2024.1080p
```

---

## 注意事项

### 1. 路径格式

#### qBittorrent
- ✅ 支持绝对路径: `/downloads/movies`
- ✅ 支持相对路径: `movies`
- ⚠️ 路径必须存在或qBittorrent有权限创建

#### Transmission
- ✅ 支持绝对路径: `/downloads/movies`
- ❌ 不支持相对路径
- ⚠️ 路径必须存在

---

### 2. 分类支持

| 下载器 | 分类支持 | 说明 |
|--------|---------|------|
| **qBittorrent** | ✅ | 完全支持，可在UI中查看 |
| **Transmission** | ❌ | 不支持分类功能 |
| **Mock** | ✅ | 仅日志输出 |

---

### 3. 默认值

如果任务没有设置保存路径或分类：

```javascript
savePath: task.save_path,  // undefined → 使用下载器默认路径
category: task.category    // undefined → 无分类
```

**行为**:
- `savePath` 为空 → 使用下载器的默认下载目录
- `category` 为空 → 不设置分类

---

## 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| RSS调用 | `server/src/services/rssService.js` | 161-174 |
| addTorrentFromData | `server/src/services/downloaderService.js` | 338-432 |
| qBittorrent实现 | `server/src/services/downloaderService.js` | 346-378 |
| Transmission实现 | `server/src/services/downloaderService.js` | 380-415 |

---

## 修复前后对比

### 修复前 ❌

```
RSS任务配置:
- 保存路径: /downloads/movies
- 分类: Movies

实际下载:
- 保存路径: /downloads (默认) ❌
- 分类: (无) ❌
```

### 修复后 ✅

```
RSS任务配置:
- 保存路径: /downloads/movies
- 分类: Movies

实际下载:
- 保存路径: /downloads/movies ✅
- 分类: Movies ✅
```

---

## 总结

### 问题
- ❌ RSS任务的保存路径和分类没有传递给下载器

### 原因
1. ❌ `addTorrentFromData` 调用时没有传递 options
2. ❌ `addTorrentFromData` 方法不支持 options 参数

### 解决方案
1. ✅ RSS服务调用时传递 `{ savePath, category }`
2. ✅ `addTorrentFromData` 添加 options 参数支持
3. ✅ qBittorrent 添加 `savepath` 和 `category` 字段
4. ✅ Transmission 添加 `download-dir` 字段

### 影响范围
- ✅ 所有通过RSS任务添加的种子
- ✅ 支持 qBittorrent 和 Transmission
- ✅ 向后兼容（options 为可选参数）

**现在RSS任务会正确地将种子下载到指定位置，并设置正确的分类！** 🎉
