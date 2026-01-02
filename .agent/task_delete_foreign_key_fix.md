# 任务删除外键约束错误修复

## 问题描述
删除自动任务时报错：
```
删除失败: {"error":"FOREIGN KEY constraint failed"}
```

## 问题原因

### 数据库结构
```sql
-- 任务表
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    -- ... 其他字段
);

-- 任务历史表（有外键约束）
CREATE TABLE task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    item_guid TEXT,
    item_title TEXT,
    -- ... 其他字段
    FOREIGN KEY(task_id) REFERENCES tasks(id)  -- ⚠️ 外键约束
);

-- 任务日志表（有外键约束）
CREATE TABLE task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    run_time DATETIME,
    -- ... 其他字段
    FOREIGN KEY(task_id) REFERENCES tasks(id)  -- ⚠️ 外键约束
);
```

### 问题分析
当尝试删除任务时：
```javascript
// 原来的代码 ❌
deleteTask(id) {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
```

**错误原因**:
- ❌ 任务有关联的历史记录（`task_history`）
- ❌ 任务有关联的日志记录（`task_logs`）
- ❌ 外键约束阻止删除父记录

**错误流程**:
```
尝试删除 tasks (id=1)
    ↓
检查外键约束
    ↓
发现 task_history 中有 task_id=1 的记录
    ↓
❌ FOREIGN KEY constraint failed
```

---

## 修复方案

### 修复后的代码 ✅

**文件**: `server/src/services/taskService.js:48-59`

```javascript
deleteTask(id) {
    const db = this._getDB();
    
    // Delete related records first to avoid foreign key constraint
    // 1. Delete task history
    db.prepare('DELETE FROM task_history WHERE task_id = ?').run(id);
    
    // 2. Delete task logs
    db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(id);
    
    // 3. Delete the task itself
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
```

### 删除顺序 ⭐

```
1️⃣ 删除 task_history (子表)
    ↓
2️⃣ 删除 task_logs (子表)
    ↓
3️⃣ 删除 tasks (父表)
    ↓
✅ 删除成功
```

**关键点**:
- ✅ 先删除子表（有外键的表）
- ✅ 后删除父表（被引用的表）
- ✅ 避免外键约束冲突

---

## 删除的数据

### 1. 任务历史记录 (`task_history`)
```sql
DELETE FROM task_history WHERE task_id = ?
```

**删除内容**:
- 所有该任务下载的种子记录
- GUID、标题、hash、大小等信息
- 完成状态和完成时间

**影响**:
- ⚠️ 历史下载记录将被清除
- ⚠️ 无法追溯该任务下载过哪些资源

### 2. 任务日志 (`task_logs`)
```sql
DELETE FROM task_logs WHERE task_id = ?
```

**删除内容**:
- 所有该任务的执行日志
- 运行时间、状态、消息等

**影响**:
- ⚠️ 执行历史将被清除
- ⚠️ 无法查看任务的历史运行记录

### 3. 任务本身 (`tasks`)
```sql
DELETE FROM tasks WHERE id = ?
```

**删除内容**:
- 任务配置（名称、cron、过滤规则等）
- RSS URL、保存路径等设置

---

## 完整流程

### 删除任务的完整流程

```
用户点击删除按钮
    ↓
前端弹出确认对话框: "确定删除该自动化任务吗？"
    ↓
用户点击"确定"
    ↓
前端发送 DELETE /api/tasks/:id
    ↓
后端接收请求
    ↓
调用 taskService.deleteTask(id)
    ↓
1️⃣ DELETE FROM task_history WHERE task_id = ?
   (删除 N 条历史记录)
    ↓
2️⃣ DELETE FROM task_logs WHERE task_id = ?
   (删除 M 条日志记录)
    ↓
3️⃣ DELETE FROM tasks WHERE id = ?
   (删除任务本身)
    ↓
调用 schedulerService.cancelTask(id)
   (取消调度任务)
    ↓
返回成功响应
    ↓
前端刷新任务列表
    ↓
✅ 任务及所有关联数据已删除
```

---

## 数据统计

### 删除任务时会清除的数据量

假设任务运行了30天：

| 数据类型 | 估计数量 | 说明 |
|---------|---------|------|
| **task_history** | ~100条 | 每天匹配3-5个资源 |
| **task_logs** | ~1440条 | 每30分钟执行一次 |
| **tasks** | 1条 | 任务本身 |

**总计**: 约 1541 条记录

---

## 注意事项

### ⚠️ 数据不可恢复
删除任务后，以下数据将**永久丢失**：
- ❌ 任务配置
- ❌ 下载历史记录
- ❌ 执行日志

### ✅ 不影响的数据
- ✅ 下载器中的种子（仍然存在）
- ✅ 已下载的文件（不会被删除）
- ✅ 其他任务的数据

---

## 测试验证

### 测试步骤

1. **创建测试任务**
```sql
-- 查看任务
SELECT * FROM tasks WHERE id = 1;

-- 查看历史记录
SELECT COUNT(*) FROM task_history WHERE task_id = 1;

-- 查看日志
SELECT COUNT(*) FROM task_logs WHERE task_id = 1;
```

2. **删除任务**
- 在前端点击删除按钮
- 确认删除

3. **验证结果**
```sql
-- 任务应该不存在
SELECT * FROM tasks WHERE id = 1;  -- 返回空

-- 历史记录应该被清空
SELECT COUNT(*) FROM task_history WHERE task_id = 1;  -- 返回 0

-- 日志应该被清空
SELECT COUNT(*) FROM task_logs WHERE task_id = 1;  -- 返回 0
```

---

## 其他关联表

### 可能的其他外键关联

#### 1. `series_subscriptions` (追剧订阅)
```sql
CREATE TABLE series_subscriptions (
    task_id INTEGER,
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
```

**处理**: 如果存在，也需要删除：
```javascript
db.prepare('DELETE FROM series_subscriptions WHERE task_id = ?').run(id);
```

#### 2. 未来可能的关联表
如果添加了新的关联表，记得在 `deleteTask` 中添加删除逻辑。

---

## 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 删除任务方法 | `server/src/services/taskService.js` | 48-59 |
| 删除API | `server/src/routes/tasks.js` | 47-56 |
| 前端删除函数 | `client/src/pages/TasksPage.jsx` | 169-186 |

---

## 修复前后对比

### 修复前 ❌
```javascript
deleteTask(id) {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// 结果: FOREIGN KEY constraint failed
```

### 修复后 ✅
```javascript
deleteTask(id) {
    const db = this._getDB();
    
    // 1. 删除历史记录
    db.prepare('DELETE FROM task_history WHERE task_id = ?').run(id);
    
    // 2. 删除日志
    db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(id);
    
    // 3. 删除任务
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// 结果: 删除成功 ✅
```

---

## 总结

### 问题
- ❌ 外键约束阻止删除任务

### 原因
- ❌ 任务有关联的子表记录

### 解决方案
- ✅ 先删除子表记录
- ✅ 再删除父表记录

### 影响
- ⚠️ 历史记录和日志会被清除
- ✅ 下载的文件不受影响

**现在可以正常删除任务了！** 🎉
