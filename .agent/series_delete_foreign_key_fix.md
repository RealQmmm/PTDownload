# 追剧订阅删除外键约束错误修复

## 问题描述
删除追剧订阅时显示"删除失败"，原因是外键约束冲突。

## 问题原因

### 数据库结构
```sql
-- 任务表（父表）
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    -- ...
);

-- 追剧订阅表（子表）
CREATE TABLE series_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    task_id INTEGER,
    -- ...
    FOREIGN KEY(task_id) REFERENCES tasks(id)  -- ⚠️ 外键约束
);
```

### 错误的删除顺序 ❌

**修复前的代码**:
```javascript
deleteSubscription(id) {
    const sub = db.prepare('SELECT * FROM series_subscriptions WHERE id = ?').get(id);
    if (sub) {
        // 1. 先删除任务（父表） ❌
        if (sub.task_id) {
            taskService.deleteTask(sub.task_id);
        }
        // 2. 再删除订阅（子表） ❌
        db.prepare('DELETE FROM series_subscriptions WHERE id = ?').run(id);
    }
}
```

**问题**:
```
尝试删除 tasks (id=1)
    ↓
检查外键约束
    ↓
发现 series_subscriptions 中有 task_id=1 的记录
    ↓
❌ FOREIGN KEY constraint failed
```

---

## 修复方案

### 正确的删除顺序 ✅

**修复后的代码**:
```javascript
deleteSubscription(id) {
    const sub = db.prepare('SELECT * FROM series_subscriptions WHERE id = ?').get(id);
    if (sub) {
        // 1. 先删除订阅（子表） ✅
        db.prepare('DELETE FROM series_subscriptions WHERE id = ?').run(id);
        
        // 2. 再删除任务（父表） ✅
        if (sub.task_id) {
            taskService.deleteTask(sub.task_id);
            // 同时取消调度
            schedulerService.cancelTask(sub.task_id);
        }
    }
}
```

### 删除流程 ⭐

```
删除追剧订阅 (id=1)
    ↓
1️⃣ DELETE FROM series_subscriptions WHERE id = 1
   (删除订阅记录 - 子表)
    ↓
2️⃣ 调用 taskService.deleteTask(task_id)
   ├─ DELETE FROM task_history WHERE task_id = ?
   ├─ DELETE FROM task_logs WHERE task_id = ?
   └─ DELETE FROM tasks WHERE id = ?
   (删除任务及其关联数据 - 父表)
    ↓
3️⃣ 调用 schedulerService.cancelTask(task_id)
   (取消调度任务)
    ↓
✅ 删除成功
```

---

## 删除的数据

### 1. 追剧订阅 (`series_subscriptions`)
```sql
DELETE FROM series_subscriptions WHERE id = ?
```

**删除内容**:
- 订阅名称、季数、质量
- 智能正则表达式
- RSS源ID、任务ID

### 2. 任务 (`tasks`)
```sql
DELETE FROM tasks WHERE id = ?
```

**删除内容**:
- 任务配置（名称、cron、过滤规则等）
- RSS URL、保存路径等设置

### 3. 任务历史 (`task_history`)
```sql
DELETE FROM task_history WHERE task_id = ?
```

**删除内容**:
- 所有下载的剧集记录
- GUID、标题、hash、大小等

### 4. 任务日志 (`task_logs`)
```sql
DELETE FROM task_logs WHERE task_id = ?
```

**删除内容**:
- 所有执行日志
- 运行时间、状态、消息等

---

## 完整流程

### 删除追剧订阅的完整流程

```
用户点击删除按钮
    ↓
前端弹出确认对话框
    ↓
用户点击"确定"
    ↓
前端发送 DELETE /api/series/:id
    ↓
后端接收请求
    ↓
调用 seriesService.deleteSubscription(id)
    ↓
1️⃣ 查询订阅信息
   SELECT * FROM series_subscriptions WHERE id = ?
    ↓
2️⃣ 删除订阅记录（子表）
   DELETE FROM series_subscriptions WHERE id = ?
    ↓
3️⃣ 删除关联任务（父表）
   调用 taskService.deleteTask(task_id)
   ├─ DELETE FROM task_history WHERE task_id = ?
   ├─ DELETE FROM task_logs WHERE task_id = ?
   └─ DELETE FROM tasks WHERE id = ?
    ↓
4️⃣ 取消调度
   调用 schedulerService.cancelTask(task_id)
    ↓
返回成功响应
    ↓
前端刷新订阅列表
    ↓
✅ 订阅及所有关联数据已删除
```

---

## 关键点

### 外键约束规则

**基本原则**: 先删除子表（有外键的表），再删除父表（被引用的表）

```
父表: tasks (被引用)
    ↑
    │ FOREIGN KEY
    │
子表: series_subscriptions (引用)
```

**删除顺序**:
```
1. series_subscriptions (子表) ✅
2. task_history (子表) ✅
3. task_logs (子表) ✅
4. tasks (父表) ✅
```

---

## 注意事项

### ⚠️ 数据不可恢复
删除追剧订阅后，以下数据将**永久丢失**：
- ❌ 订阅配置
- ❌ 关联任务配置
- ❌ 下载历史记录
- ❌ 执行日志

### ✅ 不影响的数据
- ✅ 下载器中的种子（仍然存在）
- ✅ 已下载的剧集文件（不会被删除）
- ✅ 其他订阅的数据

---

## 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 删除订阅方法 | `server/src/services/seriesService.js` | 161-175 |
| 删除任务方法 | `server/src/services/taskService.js` | 48-59 |
| 删除API | `server/src/routes/series.js` | - |

---

## 修复前后对比

### 修复前 ❌
```javascript
// 错误的顺序
1. taskService.deleteTask(task_id)  // 删除父表
2. DELETE FROM series_subscriptions  // 删除子表
// 结果: FOREIGN KEY constraint failed
```

### 修复后 ✅
```javascript
// 正确的顺序
1. DELETE FROM series_subscriptions  // 删除子表
2. taskService.deleteTask(task_id)   // 删除父表
// 结果: 删除成功 ✅
```

---

## 测试验证

### 测试步骤

1. **创建追剧订阅**
```sql
-- 查看订阅
SELECT * FROM series_subscriptions WHERE id = 1;

-- 查看关联任务
SELECT * FROM tasks WHERE id = ?;

-- 查看历史记录
SELECT COUNT(*) FROM task_history WHERE task_id = ?;
```

2. **删除订阅**
- 在前端点击删除按钮
- 确认删除

3. **验证结果**
```sql
-- 订阅应该不存在
SELECT * FROM series_subscriptions WHERE id = 1;  -- 返回空

-- 任务应该不存在
SELECT * FROM tasks WHERE id = ?;  -- 返回空

-- 历史记录应该被清空
SELECT COUNT(*) FROM task_history WHERE task_id = ?;  -- 返回 0
```

---

## 相关修复

### 同时修复的问题
1. ✅ 任务删除外键约束错误
   - 文件: `server/src/services/taskService.js`
   - 修复: 先删除 `task_history` 和 `task_logs`，再删除 `tasks`

2. ✅ 追剧订阅删除外键约束错误
   - 文件: `server/src/services/seriesService.js`
   - 修复: 先删除 `series_subscriptions`，再删除 `tasks`

---

## 总结

### 问题
- ❌ 外键约束阻止删除追剧订阅

### 原因
- ❌ 删除顺序错误（先删父表，后删子表）

### 解决方案
- ✅ 调整删除顺序（先删子表，后删父表）
- ✅ 添加调度取消逻辑

### 影响
- ⚠️ 订阅、任务、历史记录和日志会被清除
- ✅ 下载的文件不受影响

**现在可以正常删除追剧订阅了！** 🎉
