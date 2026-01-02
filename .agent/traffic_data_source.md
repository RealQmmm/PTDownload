# 当前总流量的数据来源详解

## 概述
"当前总流量" 是从**下载器客户端的API**直接获取的，不同的下载器类型有不同的API端点。

---

## 数据获取路径

### 完整调用链
```
statsService.collectStats()
    ↓
clientService.getAllClients()  // 获取所有配置的下载器
    ↓
downloaderService.getTorrents(client)  // 对每个下载器调用
    ↓
下载器 API (qBittorrent/Transmission)
    ↓
返回 { stats: { totalDownloaded, totalUploaded } }
```

---

## 不同下载器的数据来源

### 1. qBittorrent 📦

#### API 端点
```javascript
GET http://{host}:{port}/api/v2/transfer/info
```

#### 返回数据
```json
{
  "dl_info_data": 156000000000,    // 累计下载字节数
  "up_info_data": 312000000000,    // 累计上传字节数
  "dl_info_speed": 12500000,       // 当前下载速度
  "up_info_speed": 2200000         // 当前上传速度
}
```

#### 代码实现
**位置**: `server/src/services/downloaderService.js:87-91`

```javascript
// 3. Get transfer info
const transferRes = await axios.get(`${baseUrl}/api/v2/transfer/info`, {
    headers: { 'Cookie': cookie },
    timeout: 5000
});

return {
    stats: {
        totalDownloaded: transferRes.data.dl_info_data || 0,  // ← 这里！
        totalUploaded: transferRes.data.up_info_data || 0     // ← 这里！
    }
};
```

#### qBittorrent 的数据含义
- `dl_info_data`: qBittorrent **自启动以来**的累计下载字节数
- `up_info_data`: qBittorrent **自启动以来**的累计上传字节数
- ⚠️ **注意**: qBittorrent 重启后这些值会**归零**

---

### 2. Transmission 🔄

#### API 端点
```javascript
POST http://{host}:{port}/transmission/rpc
Method: session-stats
```

#### 返回数据
```json
{
  "arguments": {
    "cumulative-stats": {
      "downloadedBytes": 156000000000,  // 累计下载字节数
      "uploadedBytes": 312000000000     // 累计上传字节数
    },
    "downloadSpeed": 12500000,
    "uploadSpeed": 2200000
  }
}
```

#### 代码实现
**位置**: `server/src/services/downloaderService.js:159-170`

```javascript
// 3. Get session stats
const statsRes = await axios.post(
    rpcUrl,
    { method: 'session-stats' },
    { headers: { 'X-Transmission-Session-Id': sessionId } }
);

const cumStats = statsRes.data.arguments['cumulative-stats'] || {};

return {
    stats: {
        totalDownloaded: cumStats.downloadedBytes || 0,  // ← 这里！
        totalUploaded: cumStats.uploadedBytes || 0       // ← 这里！
    }
};
```

#### Transmission 的数据含义
- `cumulative-stats.downloadedBytes`: Transmission **历史累计**下载字节数
- `cumulative-stats.uploadedBytes`: Transmission **历史累计**上传字节数
- ✅ **优势**: Transmission 的累计统计**持久化**，重启后不会丢失

---

## 双重验证机制

### 为什么要双重验证？
代码中使用了一个**容错机制**，同时获取两个数据源并取最大值：

**位置**: `server/src/services/downloaderService.js:69-75`

```javascript
// 计算所有种子的流量总和
const torrentSumDL = (result.torrents || []).reduce(
    (sum, t) => sum + (Number(t.downloaded) || 0), 
    0
);
const torrentSumUL = (result.torrents || []).reduce(
    (sum, t) => sum + (Number(t.uploaded) || 0), 
    0
);

return {
    downloaded: Math.max(result.stats.totalDownloaded || 0, torrentSumDL),
    uploaded: Math.max(result.stats.totalUploaded || 0, torrentSumUL)
};
```

### 两个数据源对比

| 数据源 | 来源 | 优点 | 缺点 |
|--------|------|------|------|
| **全局统计** | `/api/v2/transfer/info` | 快速，一次调用 | 可能不准确，重启归零 |
| **种子求和** | 遍历所有种子累加 | 准确，基于实际数据 | 计算量大 |

### 为什么取最大值？
```javascript
Math.max(全局统计, 种子求和)
```

**原因**:
1. **API 延迟**: 全局统计可能有缓存延迟
2. **数据不一致**: 某些情况下全局统计可能未及时更新
3. **容错处理**: 确保不会因为API异常导致流量统计偏低

---

## 数据流示意图

```
┌─────────────────────────────────────────────────────────┐
│  qBittorrent / Transmission                             │
│                                                         │
│  内部统计数据库:                                          │
│  - 每个种子的 downloaded/uploaded                        │
│  - 全局累计 totalDownloaded/totalUploaded               │
│                                                         │
│  ┌─────────────────┐      ┌──────────────────┐         │
│  │ Torrent 1       │      │ Global Stats     │         │
│  │ DL: 5GB         │      │ Total DL: 100GB  │         │
│  │ UP: 10GB        │      │ Total UP: 200GB  │         │
│  └─────────────────┘      └──────────────────┘         │
│  ┌─────────────────┐                                    │
│  │ Torrent 2       │                                    │
│  │ DL: 8GB         │                                    │
│  │ UP: 15GB        │                                    │
│  └─────────────────┘                                    │
└────────────┬────────────────────────────────────────────┘
             │
             │ HTTP API 请求
             ▼
┌─────────────────────────────────────────────────────────┐
│  downloaderService.getTorrents()                        │
│                                                         │
│  1. 调用 /api/v2/transfer/info                          │
│     → totalDownloaded = 100GB                           │
│                                                         │
│  2. 调用 /api/v2/torrents/info                          │
│     → 遍历种子求和 = 98GB (可能有延迟)                    │
│                                                         │
│  3. 取最大值: Math.max(100GB, 98GB) = 100GB             │
│                                                         │
│  返回: { stats: { totalDownloaded: 100GB } }            │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  statsService.collectStats()                            │
│                                                         │
│  currentTotal = 100GB                                   │
│  lastTotal = 95GB                                       │
│  diff = 100GB - 95GB = 5GB                              │
│                                                         │
│  todayDownloaded += 5GB                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 关键代码位置总结

### 1. 获取 qBittorrent 总流量
**文件**: `server/src/services/downloaderService.js`  
**行数**: 87-91, 115-120

```javascript
const transferRes = await axios.get(`${baseUrl}/api/v2/transfer/info`, ...);
stats: {
    totalDownloaded: transferRes.data.dl_info_data || 0,
    totalUploaded: transferRes.data.up_info_data || 0
}
```

### 2. 获取 Transmission 总流量
**文件**: `server/src/services/downloaderService.js`  
**行数**: 159-170, 196-201

```javascript
const statsRes = await axios.post(rpcUrl, { method: 'session-stats' }, ...);
const cumStats = statsRes.data.arguments['cumulative-stats'] || {};
stats: {
    totalDownloaded: cumStats.downloadedBytes || 0,
    totalUploaded: cumStats.uploadedBytes || 0
}
```

### 3. 双重验证逻辑
**文件**: `server/src/services/statsService.js`  
**行数**: 64-88

```javascript
const torrentSumDL = result.torrents.reduce((sum, t) => sum + t.downloaded, 0);
downloaded: Math.max(result.stats.totalDownloaded, torrentSumDL)
```

---

## 常见问题

### Q1: 为什么 qBittorrent 重启后流量会归零？
**A**: qBittorrent 的 `dl_info_data` 是**会话统计**，重启后重新计数。但我们的系统使用**增量计算**，所以不会影响历史统计。

### Q2: 如果下载器返回的数据不准确怎么办？
**A**: 系统使用 `Math.max(全局统计, 种子求和)` 来容错，取较大值确保不会低估流量。

### Q3: 多个下载器的流量如何汇总？
**A**: 在 `statsService.js:87-88` 中，对所有下载器的流量进行求和：
```javascript
const currentTotalDownloaded = validResults.reduce((acc, r) => acc + r.downloaded, 0);
```

### Q4: 如果下载器离线会怎样？
**A**: 该下载器会被跳过（`validResults.filter(r => r.success)`），不影响其他下载器的统计。

---

## 总结

**当前总流量的来源**:
1. **直接来源**: 下载器客户端的 API
   - qBittorrent: `/api/v2/transfer/info` → `dl_info_data`
   - Transmission: `session-stats` → `cumulative-stats.downloadedBytes`

2. **备用来源**: 所有种子的流量求和
   - 作为验证和容错机制

3. **最终值**: 取两者的最大值
   - 确保数据准确性和可靠性

**数据特点**:
- ✅ 实时性: 每10秒更新一次
- ✅ 准确性: 双重验证机制
- ✅ 可靠性: 容错处理，支持多客户端
- ⚠️ 依赖性: 依赖下载器API的准确性
