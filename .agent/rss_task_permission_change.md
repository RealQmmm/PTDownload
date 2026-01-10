# RSS 任务权限调整说明

## 修改日期
2026-01-10

## 修改目标
调整 RSS 自动任务的权限控制策略，实现以下目标：
1. **所有用户可见所有 RSS 任务**：移除任务列表的用户过滤
2. **下载记录保持用户隔离**：RSS 任务产生的下载历史记录仍然记录对应的用户 ID

## 修改文件

### 1. `/server/src/services/taskService.js`
**修改内容**：
- 移除 `getAllTasks()` 方法的 `userId` 参数
- 移除基于用户 ID 的查询过滤逻辑
- 所有用户调用该方法时都返回全部任务

**修改前**：
```javascript
getAllTasks(userId = null) {
    if (userId) {
        return this._getDB().prepare('SELECT * FROM tasks WHERE user_id = ? OR user_id IS NULL ORDER BY enabled DESC, created_at DESC').all(userId);
    }
    return this._getDB().prepare('SELECT * FROM tasks ORDER BY enabled DESC, created_at DESC').all();
}
```

**修改后**：
```javascript
getAllTasks() {
    // RSS tasks are visible to all users, no user filtering
    return this._getDB().prepare('SELECT * FROM tasks ORDER BY enabled DESC, created_at DESC').all();
}
```

### 2. `/server/src/routes/tasks.js`
**修改内容**：
- 移除管理员角色判断
- 直接调用 `getAllTasks()` 返回所有任务

**修改前**：
```javascript
router.get('/', (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const tasks = taskService.getAllTasks(isAdmin ? null : req.user.id);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

**修改后**：
```javascript
router.get('/', (req, res) => {
    try {
        // All users can see all RSS tasks
        const tasks = taskService.getAllTasks();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### 3. `/server/src/services/seriesService.js`
**修改内容**：
- 在 `getAllSubscriptions()` 方法中添加注释说明
- 明确所有用户可见所有追剧订阅

**修改**：
```javascript
async getAllSubscriptions() {
    // All users can see all series subscriptions (no user filtering)
    // But download records (task_history) remain user-isolated
    // ...
}
```

## 下载记录隔离机制

### RSS 服务中的用户隔离
在 `/server/src/services/rssService.js` 中，下载记录仍然保持用户隔离：

```javascript
// Line 444-445
const preRecordResult = db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, item_hash, download_time, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(task.id, item.guid, item.title, item.size, torrentHash, timeUtils.getLocalISOString(), task.user_id);
```

**关键点**：
- 记录下载历史时使用 `task.user_id`
- 每个 RSS 任务创建时会记录创建者的 `user_id`
- 该任务产生的所有下载记录都会继承这个 `user_id`

## 影响范围

### 前端变化
- 所有用户在"自动任务"页面都能看到全部 RSS 任务
- 所有用户在"追剧"页面都能看到全部追剧订阅
- 用户可以查看、编辑、删除任何 RSS 任务（无权限限制）

### 后端变化
- `task_history` 表中的记录仍然保留 `user_id` 字段
- 下载历史查询时可以根据 `user_id` 进行过滤
- 统计数据可以按用户维度进行聚合

## 使用场景

### 适用场景
1. **家庭共享环境**：家庭成员共同管理 RSS 订阅
2. **小团队协作**：团队成员可以互相查看和管理订阅任务
3. **集中管理**：管理员统一配置，所有用户共享使用

### 数据隔离
虽然任务对所有用户可见，但以下数据仍然保持隔离：
- 下载历史记录（`task_history.user_id`）
- 用户统计数据（基于 `user_id` 聚合）
- 个人下载量统计

## 注意事项

1. **任务创建者追踪**：每个任务的 `user_id` 字段记录了创建者
2. **下载记录归属**：任务产生的下载记录会继承任务的 `user_id`
3. **权限考虑**：如果未来需要恢复权限控制，只需在路由层添加过滤逻辑即可
4. **数据一致性**：确保所有 RSS 任务都有有效的 `user_id`（通过迁移脚本已处理）

## 回滚方案

如需恢复原有的权限控制，可以：
1. 恢复 `taskService.getAllTasks(userId)` 的参数
2. 在路由中恢复管理员判断逻辑
3. 重新启用基于 `user_id` 的查询过滤
