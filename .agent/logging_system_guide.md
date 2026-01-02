# 系统日志说明文档

## 日志系统概述

PTDownload 的日志系统使用 `loggerService` 来记录各种操作和事件，所有日志都存储在 `task_logs` 数据库表中，并在前端的"系统日志"页面显示。

---

## 会显示在日志页面的日志

### 1. RSS任务执行日志 ✅

**来源**: `server/src/services/rssService.js`

#### 成功日志
```javascript
loggerService.log(
    `成功发现 ${items.length} 个资源，匹配 ${matchCount} 个`, 
    'success', 
    task.id, 
    items.length, 
    matchCount
);
```

**显示内容**:
- ✅ 任务名称
- ✅ 执行时间
- ✅ 状态：成功
- ✅ 消息：成功发现 X 个资源，匹配 Y 个
- ✅ 抓取数量
- ✅ 匹配数量

#### 一次性任务自动禁用日志
```javascript
loggerService.log(
    `任务已完成匹配并自动禁用（匹配 ${matchCount} 个资源）`, 
    'success', 
    task.id, 
    items.length, 
    matchCount
);
```

#### 错误日志
```javascript
loggerService.log(err.message, 'error', task.id);
```

**显示内容**:
- ✅ 任务名称
- ✅ 执行时间
- ✅ 状态：失败
- ✅ 错误消息

---

### 2. Cookie检查日志 ✅

**来源**: `server/src/services/schedulerService.js`

```javascript
loggerService.log(
    `周期性 Cookie 检查完成：${valid}/${results.length} 站点有效`, 
    results.every(r => r) ? 'success' : 'error'
);
```

**显示内容**:
- ✅ 执行时间
- ✅ 状态：成功/失败
- ✅ 消息：X/Y 站点有效
- ✅ 任务ID：null（全局日志）

---

### 3. 自动签到日志 ✅

**来源**: `server/src/services/schedulerService.js` 和 `siteService.js`

#### 批量签到日志
```javascript
loggerService.log(
    `每日自动签到完成，成功 ${successCount} 个站点`, 
    'success'
);
```

#### 单个站点签到日志
```javascript
// 成功
loggerService.log(`站点 ${site.name} 自动签到成功`, 'success');

// 失败
loggerService.log(`站点 ${site.name} 自动签到失败: ${err.message}`, 'error');
```

**显示内容**:
- ✅ 执行时间
- ✅ 状态：成功/失败
- ✅ 消息：站点名称 + 结果
- ✅ 任务ID：null（全局日志）

---

### 4. Cookie失效警告 ✅

**来源**: `server/src/services/siteService.js`

```javascript
loggerService.log(`站点 ${site.name} Cookie 已失效，请及时处理`, 'error');
```

**显示内容**:
- ✅ 执行时间
- ✅ 状态：失败
- ✅ 消息：站点 Cookie 失效警告
- ✅ 任务ID：null（全局日志）

---

### 5. 系统维护日志 ✅

**来源**: `server/src/services/schedulerService.js`

```javascript
loggerService.log(
    `系统维护完成：清理了 ${delDate.changes + totalKeepDeleted} 条日志及 ${delHeatmap.changes} 条热力数据`, 
    'success'
);
```

**显示内容**:
- ✅ 执行时间
- ✅ 状态：成功
- ✅ 消息：清理统计信息
- ✅ 任务ID：null（全局日志）

---

### 6. 自动清理日志 ✅

**来源**: `server/src/services/cleanupService.js`

#### 清理成功
```javascript
loggerService.log(
    `自动清理: ${torrent.name} (${reason})`, 
    'success'
);
```

#### 清理错误
```javascript
loggerService.log(`自动清理运行出错: ${err.message}`, 'error');
```

**显示内容**:
- ✅ 执行时间
- ✅ 状态：成功/失败
- ✅ 消息：种子名称 + 清理原因
- ✅ 任务ID：null（全局日志）

---

## 不会显示在日志页面的日志

### 1. 控制台调试日志 ❌

**来源**: 各个服务文件

```javascript
// 这些只会输出到控制台，不会记录到数据库
console.log('[RSS] Match found: ...');
console.log('[Checkin Debug] ...');
console.error('[RSS] Error processing item: ...');
console.warn('[RSS] Failed to check client: ...');
```

**特点**:
- ❌ 不存储到数据库
- ❌ 不显示在前端日志页面
- ✅ 只在服务器控制台显示
- ✅ 需要设置 `enable_system_logs=true` 才会输出

---

### 2. 统计服务日志 ❌

**来源**: `server/src/services/statsService.js`

```javascript
// 统计服务的日志只输出到控制台
console.log('[Stats] Collecting stats...');
console.log('[Stats] Updated daily stats...');
```

**特点**:
- ❌ 不记录到日志表
- ❌ 不显示在前端
- ✅ 仅用于调试

---

### 3. HTTP请求日志 ❌

**来源**: Express中间件

```javascript
// HTTP请求日志
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
```

**特点**:
- ❌ 不记录到数据库
- ❌ 不显示在前端
- ✅ 仅服务器控制台

---

### 4. 数据库操作日志 ❌

**来源**: 数据库初始化

```javascript
console.log('Database tables initialized');
console.log('Database migrations applied');
```

**特点**:
- ❌ 不记录到日志表
- ❌ 不显示在前端
- ✅ 仅启动时输出

---

## 日志数据结构

### 数据库表: `task_logs`

```sql
CREATE TABLE task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,                    -- 关联任务ID（null表示全局日志）
    run_time DATETIME,                  -- 执行时间
    status TEXT,                        -- 状态：success/error
    message TEXT,                       -- 日志消息
    items_found INTEGER DEFAULT 0,     -- 发现的资源数（RSS任务）
    items_matched INTEGER DEFAULT 0,   -- 匹配的资源数（RSS任务）
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
```

---

## 日志类型对比

| 日志类型 | 存储位置 | 前端显示 | 用途 |
|---------|---------|---------|------|
| **RSS任务执行** | 数据库 | ✅ 是 | 用户查看任务运行状态 |
| **Cookie检查** | 数据库 | ✅ 是 | 用户了解Cookie状态 |
| **自动签到** | 数据库 | ✅ 是 | 用户查看签到结果 |
| **系统维护** | 数据库 | ✅ 是 | 用户了解系统清理情况 |
| **自动清理** | 数据库 | ✅ 是 | 用户查看种子清理记录 |
| **调试日志** | 控制台 | ❌ 否 | 开发调试 |
| **统计日志** | 控制台 | ❌ 否 | 开发调试 |
| **HTTP请求** | 控制台 | ❌ 否 | 服务器监控 |

---

## 日志查看方式

### 1. 前端日志页面 ✅

**路径**: 系统设置 → 系统日志

**显示内容**:
- 所有存储在 `task_logs` 表中的日志
- 最多显示 500 条
- 按时间倒序排列

**筛选**:
- 可以按任务筛选
- 可以按状态筛选（成功/失败）

---

### 2. 服务器控制台 ✅

**查看方式**:
```bash
# 查看实时日志
docker-compose logs -f server

# 查看最近100行
docker-compose logs --tail=100 server
```

**显示内容**:
- 所有 `console.log/error/warn` 输出
- HTTP请求日志
- 数据库操作日志
- 调试日志（需要 `enable_system_logs=true`）

---

## 日志配置

### 启用详细日志

**设置**: 系统设置 → 启用系统日志

```javascript
// 设置为 true 后，会输出详细的调试日志到控制台
enable_system_logs: true
```

**影响**:
- ✅ 控制台会显示更多调试信息
- ✅ 包括RSS匹配详情、签到检测详情等
- ❌ 不影响前端日志页面的显示

---

### 日志保留设置

**设置**: 系统设置 → 日志保留天数

```javascript
log_retention_days: 7  // 默认保留7天
```

**影响**:
- ✅ 自动清理超过指定天数的日志
- ✅ 每天凌晨3点执行清理
- ✅ 减少数据库大小

---

## 日志API

### 获取日志
```
GET /api/logs?limit=500&taskId=1
```

**参数**:
- `limit`: 返回数量（默认100）
- `taskId`: 筛选特定任务的日志（可选）

**返回**:
```json
[
    {
        "id": 1,
        "task_id": 1,
        "task_name": "[追剧] 权力的游戏",
        "run_time": "2026-01-02T10:30:00",
        "status": "success",
        "message": "成功发现 50 个资源，匹配 2 个",
        "items_found": 50,
        "items_matched": 2
    }
]
```

---

### 清空日志
```
DELETE /api/logs?taskId=1
```

**参数**:
- `taskId`: 清空特定任务的日志（可选，不传则清空所有）

---

## 日志最佳实践

### 应该记录到数据库的日志 ✅
- ✅ 用户关心的操作结果
- ✅ 任务执行状态
- ✅ 错误和警告
- ✅ 系统维护操作

### 应该只输出到控制台的日志 ✅
- ✅ 调试信息
- ✅ 详细的执行步骤
- ✅ 性能统计
- ✅ 开发调试信息

---

## 总结

### 会显示在日志页面 ✅
1. ✅ RSS任务执行日志
2. ✅ Cookie检查日志
3. ✅ 自动签到日志
4. ✅ Cookie失效警告
5. ✅ 系统维护日志
6. ✅ 自动清理日志

### 不会显示在日志页面 ❌
1. ❌ 控制台调试日志（`console.log`）
2. ❌ 统计服务日志
3. ❌ HTTP请求日志
4. ❌ 数据库操作日志

### 关键区别
- **数据库日志** (`loggerService.log`) → 前端可见 ✅
- **控制台日志** (`console.log`) → 仅服务器可见 ❌

**如果需要在前端日志页面看到某个日志，必须使用 `loggerService.log()` 而不是 `console.log()`！** 📝
