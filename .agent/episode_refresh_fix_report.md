# 剧集刷新失败问题 - 分析与修复报告

**问题时间**: 2026-01-02 22:03  
**问题描述**: 全新部署的 Docker 无法刷新剧集信息，而开发环境可以  
**状态**: ✅ 已修复

---

## 🐛 问题现象

### 开发环境
- ✅ 刷新剧集信息成功
- ✅ 矩阵上显示已下载的集数
- ✅ 刷新过程正常

### 全新部署环境
- ❌ 刷新剧集信息失败
- ❌ 矩阵上无法显示已下载的集数
- ❌ 刷新动作很快就完成（没有数据）

---

## 🔍 问题分析

### 根本原因

**关键代码**（`statsService.js` 第 332-365 行）：

```javascript
// 4. DELETE ORPHANED RECORDS
// Check all task_history records and delete those not found in any downloader
const allHistory = db.prepare('SELECT * FROM task_history').all();

for (const historyItem of allHistory) {
    const existsInDownloader = allTorrents.find(t => {
        // Match by hash or name
        ...
    });

    // If not found in any downloader, delete it ❌ 问题在这里！
    if (!existsInDownloader) {
        db.prepare('DELETE FROM task_history WHERE id = ?').run(historyItem.id);
    }
}
```

**问题**：
- 这段代码会删除**所有**不在下载器中的 `task_history` 记录
- 包括已完成（`is_finished = 1`）的历史记录
- 当用户从下载器中删除已完成的种子时，历史记录也会被删除

### 刷新剧集的逻辑

**关键代码**（`seriesService.js` 第 309 行）：

```javascript
const allHistory = db.prepare(
    'SELECT item_title, item_hash, download_time FROM task_history WHERE is_finished = 1'
).all();
```

**依赖**：
- 刷新剧集功能依赖 `task_history` 表中 `is_finished = 1` 的记录
- 如果这些记录被删除，就无法刷新剧集信息

### 为什么开发环境正常？

**开发环境**：
```
下载器中有种子
  ↓
task_history 记录不会被删除
  ↓
is_finished = 1 的记录存在
  ↓
刷新剧集成功 ✅
```

**全新部署环境**：
```
下载器中没有种子（或被删除）
  ↓
task_history 记录被删除（包括已完成的）
  ↓
is_finished = 1 的记录不存在
  ↓
刷新剧集失败 ❌
```

---

## 🔧 修复方案

### 修改内容

**文件**: `server/src/services/statsService.js`

**修改前**（第 332-365 行）：
```javascript
// 4. DELETE ORPHANED RECORDS
// Check all task_history records and delete those not found in any downloader
const allHistory = db.prepare('SELECT * FROM task_history').all();
let deletedCount = 0;

for (const historyItem of allHistory) {
    const existsInDownloader = allTorrents.find(t => { ... });

    // If not found in any downloader, delete it ❌
    if (!existsInDownloader) {
        db.prepare('DELETE FROM task_history WHERE id = ?').run(historyItem.id);
        deletedCount++;
    }
}
```

**修改后**：
```javascript
// 4. DELETE ORPHANED RECORDS (ONLY UNFINISHED ONES)
// CRITICAL FIX: Only delete unfinished orphaned records
// Finished records are historical data and should be preserved even if torrent is removed from downloader
const unfinishedHistory = db.prepare('SELECT * FROM task_history WHERE is_finished = 0').all();
let deletedCount = 0;

for (const historyItem of unfinishedHistory) {
    const existsInDownloader = allTorrents.find(t => { ... });

    // If not found in any downloader AND is unfinished, delete it ✅
    if (!existsInDownloader) {
        db.prepare('DELETE FROM task_history WHERE id = ?').run(historyItem.id);
        deletedCount++;
    }
}
```

### 关键变化

1. **查询范围**：
   - 修改前：`SELECT * FROM task_history` （所有记录）
   - 修改后：`SELECT * FROM task_history WHERE is_finished = 0` （仅未完成）

2. **删除逻辑**：
   - 修改前：删除所有不在下载器中的记录
   - 修改后：只删除未完成且不在下载器中的记录

3. **历史数据保护**：
   - ✅ 已完成的记录永久保留
   - ✅ 即使从下载器中删除种子，历史记录也不会丢失
   - ✅ 刷新剧集功能始终可用

---

## 📊 影响分析

### 修复前的问题

| 操作 | 结果 | 影响 |
|------|------|------|
| 从下载器删除已完成种子 | ❌ 历史记录被删除 | 严重 |
| 刷新剧集信息 | ❌ 无数据可显示 | 严重 |
| 导出备份 | ❌ 历史数据丢失 | 严重 |
| 统计数据 | ❌ 不准确 | 中等 |

### 修复后的行为

| 操作 | 结果 | 影响 |
|------|------|------|
| 从下载器删除已完成种子 | ✅ 历史记录保留 | 正常 |
| 刷新剧集信息 | ✅ 正确显示 | 正常 |
| 导出备份 | ✅ 完整数据 | 正常 |
| 统计数据 | ✅ 准确 | 正常 |

---

## 🎯 设计原则

### 历史数据的重要性

**已完成的记录是历史数据**：
- ✅ 应该永久保留
- ✅ 不应该因为下载器中的种子被删除而丢失
- ✅ 是统计、追剧、备份等功能的基础

**未完成的记录是临时数据**：
- ✅ 如果下载器中没有对应种子，说明已被删除
- ✅ 可以安全删除，避免数据库中的垃圾数据
- ✅ 不影响历史统计

### 数据生命周期

```
种子添加到下载器
  ↓
创建 task_history 记录 (is_finished = 0)
  ↓
种子下载完成
  ↓
更新 task_history 记录 (is_finished = 1, finish_time = ...)
  ↓
从下载器删除种子
  ↓
修复前: 删除 task_history 记录 ❌
修复后: 保留 task_history 记录 ✅
```

---

## ✅ 验证方法

### 测试步骤

1. **准备环境**
   ```bash
   # 重新构建 Docker
   docker-compose down && docker-compose up -d --build
   ```

2. **添加测试数据**
   - 创建追剧订阅
   - 下载几集剧集
   - 等待下载完成

3. **刷新剧集**
   - 在追剧页面点击"刷新剧集"
   - 确认矩阵显示已下载的集数

4. **删除种子**
   - 从下载器（qBittorrent/Transmission）中删除已完成的种子
   - **不要删除文件，只删除种子**

5. **再次刷新剧集**
   - 在追剧页面点击"刷新剧集"
   - **修复前**: ❌ 矩阵变空，无法显示
   - **修复后**: ✅ 矩阵正常显示，历史数据保留

### 数据库验证

```bash
# 检查 task_history 表
docker exec pt-app sqlite3 /app/data/pt-manager.db \
  "SELECT COUNT(*) FROM task_history WHERE is_finished = 1;"

# 应该看到已完成的记录数量，即使种子已从下载器删除
```

---

## 🚨 注意事项

### 数据库清理

如果您的数据库中已经丢失了历史数据，可以通过以下方式恢复：

1. **从备份恢复**
   - 如果有备份文件，导入即可恢复

2. **重新同步**
   - 如果下载器中还有种子，使用"同步历史数据"功能
   - 路径：系统设置 → 维护 → 同步历史数据

3. **手动添加**
   - 如果知道已下载的剧集，可以手动添加到数据库

---

## 📝 总结

### 问题根源

- ❌ 错误地删除了已完成的历史记录
- ❌ 导致刷新剧集功能失效
- ❌ 影响统计、备份等功能

### 修复方案

- ✅ 只删除未完成的孤立记录
- ✅ 保留所有已完成的历史记录
- ✅ 确保数据完整性

### 影响范围

- ✅ 刷新剧集功能恢复正常
- ✅ 历史数据不会丢失
- ✅ 统计数据更准确
- ✅ 备份数据更完整

---

**修复状态**: ✅ **已完成**  
**测试状态**: ⏳ **待验证**  
**部署状态**: ⏳ **待重新构建**

🎉 **问题已修复，需要重新构建 Docker 以应用修复！**
