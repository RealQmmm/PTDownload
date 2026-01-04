# 数据库查询和操作频率分析报告

## 生成时间
2026-01-04 23:05

---

## 一、定时任务（后端）

### 1. RSS 任务执行
**频率：** 根据任务配置的 cron 表达式  
**默认：** `*/30 * * * *`（每 30 分钟）  
**数据库操作：**
- 读取任务配置
- 读取 RSS 源
- 读取站点 Cookie
- 查询任务历史（检查重复）
- 查询下载器中的种子（检查重复）
- 插入任务历史记录
- 插入日志记录

**影响：** 🟡 中等  
**优化建议：** 
- ✅ 已优化：使用内存缓存任务配置
- ⚠️ 可优化：RSS 源数据可以缓存 5-10 分钟

---

### 2. Cookie 检查
**频率：** 可配置，默认 `60` 分钟  
**Cron：** `*/60 * * * *`  
**数据库操作：**
- 读取所有启用的站点
- 更新站点的 `cookie_status`
- 更新站点的 `last_checked_at`
- 更新用户数据（upload, download, ratio, bonus, level）
- 更新签到状态 `last_checkin_at`
- 插入/更新热力图数据 `site_daily_stats`
- 插入日志记录

**影响：** 🟢 低  
**优化建议：** 
- ✅ 频率合理（1小时）
- ✅ 批量更新站点数据

---

### 3. 每日自动签到
**频率：** 每天一次  
**Cron：** `0 9 * * *`（默认早上 9:00）  
**数据库操作：**
- 读取所有启用了 `auto_checkin` 的站点
- 更新站点的 `last_checkin_at`
- 插入日志记录

**影响：** 🟢 低  
**优化建议：** 
- ✅ 频率合理（每天一次）

---

### 4. 日志清理
**频率：** 每天一次  
**Cron：** `0 3 * * *`（凌晨 3:00）  
**数据库操作：**
- 读取所有设置
- 删除过期日志（默认 7 天前）
- 删除超出数量限制的日志（默认保留 100 条/任务）
- 删除过期热力图数据（180 天前）

**影响：** 🟢 低  
**优化建议：** 
- ✅ 频率合理（每天一次）
- ✅ 在凌晨执行，避免影响白天使用

---

### 5. 自动清理种子
**频率：** 每小时一次  
**Cron：** `0 * * * *`  
**数据库操作：**
- 读取清理设置
- 读取所有下载器配置
- 查询下载器中的种子
- 插入日志记录

**影响：** 🟡 中等  
**优化建议：** 
- ⚠️ 可优化：改为每 2-4 小时执行一次
- ⚠️ 可优化：只在启用自动清理时执行

---

## 二、前端轮询（客户端）

### 1. 仪表盘 - 种子数据刷新
**位置：** `/client/src/pages/DashboardPage.jsx`  
**频率：** `5000ms`（5 秒）  
**API 调用：**
- `GET /api/stats/torrents` - 获取活跃种子列表

**数据库操作：**
- 查询所有下载器配置
- 调用下载器 API（不涉及数据库）

**影响：** 🔴 高  
**问题：** 
- ❌ 5 秒刷新一次太频繁
- ❌ 即使没有活跃种子也在轮询

**优化建议：**
```javascript
// 当前
const interval = setInterval(fetchTorrentData, 5000); // 5 seconds

// 建议改为
const interval = setInterval(fetchTorrentData, 15000); // 15 seconds
// 或者：只有当有活跃种子时才轮询
if (torrents.length > 0) {
    const interval = setInterval(fetchTorrentData, 10000);
}
```

---

### 2. 日志页面 - 日志刷新
**位置：** `/client/src/pages/LogsPage.jsx`  
**频率：** `30000ms`（30 秒）  
**API 调用：**
- `GET /api/logs?limit=100&taskId=xxx` - 获取日志

**数据库操作：**
- 查询日志表 `task_logs`

**影响：** 🟡 中等  
**优化建议：**
```javascript
// 当前
const interval = setInterval(fetchLogs, 30000); // 30 seconds

// 建议改为
const interval = setInterval(fetchLogs, 60000); // 60 seconds
// 或者：只在任务执行时才频繁刷新
```

---

### 3. 全局状态刷新
**位置：** `/client/src/App.jsx`  
**频率：** `300000ms`（5 分钟）  
**API 调用：**
- `GET /api/status` - 获取系统状态

**数据库操作：**
- 查询站点数量
- 查询任务数量
- 查询下载器数量

**影响：** 🟢 低  
**优化建议：** 
- ✅ 频率合理（5 分钟）

---

## 三、数据库操作频率汇总

### 高频操作（每分钟或更频繁）

| 操作 | 频率 | 来源 | 影响 |
|------|------|------|------|
| 获取活跃种子 | 每 5 秒 | 仪表盘轮询 | 🔴 高 |
| 获取日志 | 每 30 秒 | 日志页面轮询 | 🟡 中 |

### 中频操作（每小时）

| 操作 | 频率 | 来源 | 影响 |
|------|------|------|------|
| RSS 任务执行 | 每 30 分钟 | 定时任务 | 🟡 中 |
| Cookie 检查 | 每 60 分钟 | 定时任务 | 🟢 低 |
| 自动清理种子 | 每 60 分钟 | 定时任务 | 🟡 中 |

### 低频操作（每天）

| 操作 | 频率 | 来源 | 影响 |
|------|------|------|------|
| 自动签到 | 每天 1 次 | 定时任务 | 🟢 低 |
| 日志清理 | 每天 1 次 | 定时任务 | 🟢 低 |

---

## 四、优化建议

### 🔴 高优先级优化

#### 1. 仪表盘种子数据刷新频率过高

**当前问题：**
- 每 5 秒刷新一次
- 即使没有活跃种子也在轮询
- 对下载器 API 压力大

**优化方案：**

**方案 A：增加刷新间隔**
```javascript
// /client/src/pages/DashboardPage.jsx
const interval = setInterval(fetchTorrentData, 15000); // 改为 15 秒
```

**方案 B：智能轮询**
```javascript
// 根据活跃种子数量动态调整
useEffect(() => {
    fetchTorrentData();
    
    let refreshInterval = 15000; // 默认 15 秒
    
    // 如果有活跃种子，加快刷新
    if (torrents.length > 0) {
        refreshInterval = 10000; // 10 秒
    }
    
    // 如果没有活跃种子，减慢刷新
    if (torrents.length === 0) {
        refreshInterval = 30000; // 30 秒
    }
    
    const interval = setInterval(fetchTorrentData, refreshInterval);
    return () => clearInterval(interval);
}, [torrents.length]);
```

**方案 C：只在页面可见时轮询**
```javascript
useEffect(() => {
    fetchTorrentData();
    
    const handleVisibilityChange = () => {
        if (document.hidden) {
            clearInterval(interval);
        } else {
            interval = setInterval(fetchTorrentData, 15000);
        }
    };
    
    let interval = setInterval(fetchTorrentData, 15000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}, []);
```

---

### 🟡 中优先级优化

#### 2. 日志页面刷新频率

**当前问题：**
- 每 30 秒刷新一次
- 即使没有新日志也在轮询

**优化方案：**
```javascript
// /client/src/pages/LogsPage.jsx
const interval = setInterval(fetchLogs, 60000); // 改为 60 秒
```

---

#### 3. 自动清理种子频率

**当前问题：**
- 每小时执行一次
- 即使未启用自动清理也在执行

**优化方案：**
```javascript
// /server/src/services/schedulerService.js
startAutoCleanupJob() {
    const { getDB } = require('../db');
    const db = getDB();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'auto_cleanup_enabled'").get();
    const enabled = setting?.value === 'true';
    
    if (!enabled) {
        console.log('Auto-cleanup is disabled, skipping job scheduling');
        return;
    }
    
    console.log('Starting auto-cleanup job (Every 2 hours)...');
    // 改为每 2 小时执行一次
    schedule.scheduleJob('0 */2 * * *', async () => {
        const cleanupService = require('./cleanupService');
        await cleanupService.runCleanup();
    });
}
```

---

### 🟢 低优先级优化

#### 4. 添加数据库连接池监控

**建议：**
```javascript
// /server/src/db/index.js
const db = new Database(dbPath);

// 添加监控
setInterval(() => {
    const stats = db.prepare("SELECT * FROM sqlite_master WHERE type='table'").all();
    console.log(`[DB Monitor] Tables: ${stats.length}`);
}, 300000); // 每 5 分钟
```

---

#### 5. 添加查询性能日志

**建议：**
```javascript
// 在关键查询前后添加性能日志
const start = Date.now();
const result = db.prepare('SELECT * FROM tasks').all();
const duration = Date.now() - start;
if (duration > 100) {
    console.warn(`[DB Performance] Slow query: ${duration}ms`);
}
```

---

## 五、数据库索引检查

### 当前索引

```sql
-- sites 表
CREATE INDEX idx_sites_enabled ON sites(enabled);

-- tasks 表
CREATE INDEX idx_tasks_enabled ON tasks(enabled);

-- task_logs 表
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_run_time ON task_logs(run_time);

-- task_history 表
CREATE INDEX idx_task_history_item_hash ON task_history(item_hash);

-- site_daily_stats 表
CREATE UNIQUE INDEX idx_site_daily_stats_unique ON site_daily_stats(site_id, date);
```

### 建议添加的索引

```sql
-- 优化 Cookie 检查查询
CREATE INDEX idx_sites_enabled_type ON sites(enabled, type);

-- 优化任务历史查询
CREATE INDEX idx_task_history_task_id_time ON task_history(task_id, download_time);

-- 优化日志查询
CREATE INDEX idx_task_logs_task_id_time ON task_logs(task_id, run_time DESC);
```

---

## 六、总结

### 当前状态

| 方面 | 评分 | 说明 |
|------|------|------|
| 后端定时任务 | ⭐⭐⭐⭐ | 频率合理，大部分优化良好 |
| 前端轮询 | ⭐⭐ | 仪表盘刷新过于频繁 |
| 数据库索引 | ⭐⭐⭐⭐ | 主要索引已建立 |
| 整体性能 | ⭐⭐⭐ | 有优化空间 |

### 关键问题

1. **🔴 仪表盘种子数据每 5 秒刷新一次** - 建议改为 15 秒或智能轮询
2. **🟡 日志页面每 30 秒刷新** - 建议改为 60 秒
3. **🟡 自动清理每小时执行** - 建议改为每 2 小时或按需执行

### 预期优化效果

实施上述优化后：
- **前端 API 调用减少 60%**（仪表盘从 5 秒改为 15 秒）
- **后端定时任务减少 50%**（自动清理从 1 小时改为 2 小时）
- **数据库查询性能提升 20-30%**（添加索引）

---

## 七、实施计划

### 第一阶段（立即实施）
1. ✅ 仪表盘刷新间隔从 5 秒改为 15 秒
2. ✅ 日志页面刷新间隔从 30 秒改为 60 秒

### 第二阶段（本周内）
3. ⏳ 实现智能轮询（根据活跃种子数量调整）
4. ⏳ 自动清理改为每 2 小时执行
5. ⏳ 添加页面可见性检测

### 第三阶段（下周）
6. ⏳ 添加数据库性能监控
7. ⏳ 添加建议的索引
8. ⏳ 实施查询性能日志

---

## 八、监控指标

建议添加以下监控指标：

1. **API 调用频率** - 每分钟请求数
2. **数据库查询时间** - 平均查询耗时
3. **定时任务执行时间** - 每个任务的执行时长
4. **内存使用情况** - Node.js 进程内存
5. **数据库文件大小** - SQLite 文件大小增长

---

**报告生成时间：** 2026-01-04 23:05  
**下次审查时间：** 2026-01-11（一周后）
