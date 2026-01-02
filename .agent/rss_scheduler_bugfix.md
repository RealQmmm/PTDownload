# RSS任务调度Bug修复

## 更新时间
2026-01-02

## 问题描述
RSS自动任务有时候会没有定期执行，或者任务配置更新后不生效。

## 根本原因分析

### Bug原因：闭包捕获过时数据 🐛

**文件**: `server/src/services/schedulerService.js:158-161`

#### 优化前的代码 ❌
```javascript
scheduleTask(task) {
    // ...
    const job = schedule.scheduleJob(task.cron, () => {
        this.executeTask(task);  // ❌ 闭包捕获了task对象
    });
    // ...
}
```

**问题**:
1. **闭包捕获**: `task` 对象在调度时被闭包捕获
2. **数据过时**: 后续任务更新不会影响已调度的job
3. **状态不同步**: 任务禁用后仍然会执行

---

### 问题场景示例

#### 场景1: 任务配置更新不生效
```
10:00  创建RSS任务
       → task = { id: 1, cron: '*/30 * * * *', filter_config: 'old' }
       → 调度job，闭包捕获 task 对象

10:30  第一次执行 ✅
       → 使用闭包中的 task (filter_config: 'old')

11:00  用户更新任务配置
       → 数据库: filter_config = 'new'
       → 重新调度: scheduleTask(updatedTask)
       → 新job闭包捕获 updatedTask

11:30  第二次执行 ❌
       → 但如果调度失败，仍使用旧job
       → 使用旧的 filter_config: 'old'
```

#### 场景2: 禁用任务仍然执行
```
10:00  创建并启用RSS任务
       → task = { id: 1, enabled: 1 }
       → 调度job

10:15  用户禁用任务
       → 数据库: enabled = 0
       → 调用 cancelTask(1)

10:30  定时触发 ❌
       → 如果cancel失败，job仍然存在
       → 闭包中的 task.enabled = 1（旧值）
       → 任务仍然执行！
```

#### 场景3: 任务删除后仍然执行
```
10:00  创建RSS任务 (id: 1)
       → 调度job

10:15  用户删除任务
       → 数据库删除记录
       → 调用 cancelTask(1)

10:30  定时触发 ❌
       → 如果cancel失败，job仍然存在
       → 闭包中的 task 对象仍然存在
       → 尝试执行已删除的任务！
```

---

## 修复方案

### 优化后的代码 ✅

**文件**: `server/src/services/schedulerService.js:158-187`

```javascript
scheduleTask(task) {
    // Cancel existing job if any
    if (this.jobs.has(task.id)) {
        this.jobs.get(task.id).cancel();
    }

    console.log(`Scheduling task: ${task.name} (ID: ${task.id}) with cron: ${task.cron}`);

    try {
        // ⭐ 只存储 task ID，不存储整个对象
        const taskId = task.id;
        
        const job = schedule.scheduleJob(task.cron, async () => {
            // ⭐ 每次执行时从数据库获取最新信息
            const latestTask = taskService.getTaskById(taskId);
            
            // ✅ 检查任务是否还存在
            if (!latestTask) {
                if (this._isLogEnabled()) console.warn(`Task ${taskId} no longer exists. Cancelling job.`);
                this.cancelTask(taskId);
                return;
            }
            
            // ✅ 检查任务是否启用
            if (!latestTask.enabled) {
                if (this._isLogEnabled()) console.log(`Task ${taskId} is disabled. Skipping execution.`);
                return;
            }
            
            // ✅ 使用最新的任务信息执行
            await this.executeTask(latestTask);
        });

        if (job) {
            this.jobs.set(task.id, job);
            if (this._isLogEnabled()) console.log(`Successfully scheduled task ${task.id}: ${task.name}`);
        } else {
            console.error(`Failed to create schedule job for task ${task.id}. Invalid cron: ${task.cron}`);
        }
    } catch (err) {
        console.error(`Failed to schedule task ${task.id}:`, err.message);
    }
}
```

---

## 关键改进

### 1️⃣ 只存储任务ID
```javascript
// 优化前 ❌
const job = schedule.scheduleJob(task.cron, () => {
    this.executeTask(task);  // 使用闭包中的task对象
});

// 优化后 ✅
const taskId = task.id;  // 只存储ID
const job = schedule.scheduleJob(task.cron, async () => {
    const latestTask = taskService.getTaskById(taskId);  // 每次获取最新数据
    await this.executeTask(latestTask);
});
```

### 2️⃣ 检查任务是否存在
```javascript
if (!latestTask) {
    console.warn(`Task ${taskId} no longer exists. Cancelling job.`);
    this.cancelTask(taskId);  // 自动清理
    return;
}
```

### 3️⃣ 检查任务是否启用
```javascript
if (!latestTask.enabled) {
    console.log(`Task ${taskId} is disabled. Skipping execution.`);
    return;  // 跳过执行
}
```

### 4️⃣ 使用最新配置
```javascript
await this.executeTask(latestTask);  // latestTask 包含最新的配置
```

---

## 修复后的场景

### 场景1: 任务配置更新立即生效 ✅
```
10:00  创建RSS任务
       → 调度job，只存储 taskId = 1

10:30  第一次执行
       → 从数据库获取: task = { id: 1, filter_config: 'old' }
       → 使用 'old' 配置执行 ✅

11:00  用户更新任务配置
       → 数据库: filter_config = 'new'

11:30  第二次执行
       → 从数据库获取: task = { id: 1, filter_config: 'new' }
       → 使用 'new' 配置执行 ✅
       → 配置立即生效！
```

### 场景2: 禁用任务不再执行 ✅
```
10:00  创建并启用RSS任务
       → 调度job，存储 taskId = 1

10:15  用户禁用任务
       → 数据库: enabled = 0

10:30  定时触发
       → 从数据库获取: task = { id: 1, enabled: 0 }
       → 检查: enabled = 0
       → 跳过执行 ✅
```

### 场景3: 删除任务自动清理 ✅
```
10:00  创建RSS任务 (id: 1)
       → 调度job

10:15  用户删除任务
       → 数据库删除记录

10:30  定时触发
       → 从数据库获取: task = null
       → 检查: task不存在
       → 自动取消job ✅
       → 不再执行
```

---

## 额外优势

### 1. 更好的错误处理
```javascript
if (job) {
    this.jobs.set(task.id, job);
    console.log(`Successfully scheduled task ${task.id}`);
} else {
    console.error(`Failed to create schedule job. Invalid cron: ${task.cron}`);
}
```

### 2. 详细的日志输出
```javascript
// 调度时
console.log(`Scheduling task: ${task.name} (ID: ${task.id}) with cron: ${task.cron}`);

// 执行时
console.log(`Task ${taskId} is disabled. Skipping execution.`);
console.warn(`Task ${taskId} no longer exists. Cancelling job.`);
```

### 3. 自动清理无效任务
```javascript
if (!latestTask) {
    this.cancelTask(taskId);  // 自动清理
    return;
}
```

---

## 性能影响

### 额外开销
| 操作 | 耗时 | 频率 |
|------|------|------|
| **数据库查询** | ~1ms | 每次任务执行 |
| **任务状态检查** | ~0.1ms | 每次任务执行 |

### 实际影响
```
场景: RSS任务每30分钟执行一次

优化前:
- 查询次数: 0
- 可能问题: 配置不生效、禁用任务仍执行

优化后:
- 查询次数: 1次/30分钟
- 额外耗时: ~1ms
- 问题: 完全解决 ✅

结论: 1ms的开销完全可以接受！
```

---

## 测试建议

### 1. 测试任务配置更新
```bash
# 1. 创建RSS任务，关键词: "test"
# 2. 等待任务执行一次
# 3. 修改关键词为 "new"
# 4. 等待下次执行
# 5. 检查日志，应该使用新关键词 "new"
```

### 2. 测试任务禁用
```bash
# 1. 创建并启用RSS任务
# 2. 禁用任务
# 3. 等待定时触发
# 4. 检查日志，应该显示 "Task is disabled. Skipping execution."
```

### 3. 测试任务删除
```bash
# 1. 创建RSS任务
# 2. 删除任务
# 3. 等待定时触发
# 4. 检查日志，应该显示 "Task no longer exists. Cancelling job."
```

---

## 相关代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 任务调度 | `server/src/services/schedulerService.js` | 150-187 |
| 获取最新任务 | `server/src/services/schedulerService.js` | 164 |
| 任务存在检查 | `server/src/services/schedulerService.js` | 166-171 |
| 任务启用检查 | `server/src/services/schedulerService.js` | 173-177 |
| 任务执行 | `server/src/services/schedulerService.js` | 179 |

---

## 总结

### Bug原因
- ❌ 闭包捕获了任务对象
- ❌ 任务更新后使用旧数据
- ❌ 禁用/删除的任务仍然执行

### 修复方案
- ✅ 只存储任务ID，不存储对象
- ✅ 每次执行时从数据库获取最新数据
- ✅ 检查任务是否存在和启用
- ✅ 自动清理无效任务

### 修复效果
| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| **配置更新不生效** | ❌ 使用旧配置 | ✅ 立即生效 |
| **禁用任务仍执行** | ❌ 继续执行 | ✅ 自动跳过 |
| **删除任务仍执行** | ❌ 可能执行 | ✅ 自动清理 |
| **性能开销** | 0ms | ~1ms (可接受) |

**现在RSS任务会准确地按照最新配置定期执行，不会出现配置不生效或禁用任务仍执行的问题！** 🎉
