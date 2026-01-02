# 任务删除问题排查指南

## 问题描述
点击删除按钮无反应

## 可能的原因

### 1. 确认对话框被取消 ❌
**现象**: 点击删除按钮后，弹出确认对话框，点击"取消"
**解决**: 点击"确定"而不是"取消"

### 2. JavaScript错误 🐛
**现象**: 浏览器控制台有错误信息
**排查步骤**:
1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 点击删除按钮
4. 查看是否有红色错误信息

### 3. 网络请求失败 🌐
**现象**: 请求未发送或返回错误
**排查步骤**:
1. 按 F12 打开开发者工具
2. 切换到 Network 标签
3. 点击删除按钮
4. 查看是否有 DELETE 请求
5. 检查请求状态码

### 4. 权限问题 🔒
**现象**: 后端返回 401/403 错误
**解决**: 检查登录状态，重新登录

---

## 已添加的调试功能

### 控制台日志
现在删除任务时会输出详细日志：

```javascript
// 点击删除按钮后
console.log('Deleting task:', id);  // 显示要删除的任务ID

// 请求完成后
console.log('Delete response:', res.status);  // 显示响应状态码

// 如果失败
console.error('Delete failed:', error);  // 显示错误信息
```

### 错误提示
如果删除失败，会弹出提示框显示错误原因。

---

## 排查步骤

### 步骤1: 打开浏览器控制台
```
Chrome/Edge: F12 或 Ctrl+Shift+I
Firefox: F12 或 Ctrl+Shift+K
Safari: Cmd+Option+I
```

### 步骤2: 切换到 Console 标签
查看是否有错误信息

### 步骤3: 尝试删除任务
1. 点击任务的删除按钮（🗑️）
2. 在确认对话框中点击"确定"
3. 观察控制台输出

### 步骤4: 查看日志输出

#### 正常情况 ✅
```
Deleting task: 1
Delete response: 200
```
任务列表自动刷新，任务消失

#### 异常情况 ❌
```
Deleting task: 1
Delete failed: Task not found
```
或
```
Delete error: Network error
```

---

## 常见问题

### Q1: 点击删除按钮没有任何反应
**可能原因**:
1. 点击了"取消"而不是"确定"
2. JavaScript错误阻止了执行
3. 按钮事件未绑定

**解决方法**:
1. 确保点击确认对话框的"确定"
2. 检查浏览器控制台是否有错误
3. 刷新页面重试

### Q2: 弹出"删除失败"提示
**可能原因**:
1. 网络连接问题
2. 后端服务未运行
3. 数据库错误

**解决方法**:
1. 检查网络连接
2. 确认Docker容器正在运行: `docker ps`
3. 查看后端日志: `docker-compose logs -f server`

### Q3: 删除后任务仍然存在
**可能原因**:
1. 删除请求失败
2. 前端未刷新列表

**解决方法**:
1. 查看控制台日志确认删除是否成功
2. 手动刷新页面 (F5)
3. 检查后端日志

---

## 测试方法

### 方法1: 使用浏览器控制台
```javascript
// 在控制台直接执行删除请求
fetch('/api/tasks/1', {
    method: 'DELETE',
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
```

### 方法2: 使用curl命令
```bash
# 获取token
TOKEN=$(docker exec pt-app cat /data/ptdownload.db | grep token)

# 删除任务
curl -X DELETE http://localhost:3000/api/tasks/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 前端删除函数 | `client/src/pages/TasksPage.jsx` | 169-186 |
| 后端删除API | `server/src/routes/tasks.js` | 47-56 |
| 数据库删除 | `server/src/services/taskService.js` | 48-50 |

---

## 如果问题仍然存在

请提供以下信息：

1. **浏览器控制台日志**
```
// 粘贴控制台的所有输出
```

2. **Network标签截图**
- 显示DELETE请求的状态

3. **后端日志**
```bash
docker-compose logs -f server | tail -50
```

4. **任务信息**
- 任务ID
- 任务名称
- 任务类型

---

## 临时解决方案

### 方案1: 直接操作数据库
```bash
# 进入容器
docker exec -it pt-app sh

# 打开数据库
sqlite3 /data/ptdownload.db

# 查看所有任务
SELECT * FROM tasks;

# 删除指定任务
DELETE FROM tasks WHERE id = 1;

# 退出
.quit
```

### 方案2: 重启服务
```bash
docker-compose restart
```

---

## 已修复的问题

### 2026-01-02 更新
- ✅ 添加详细的错误处理
- ✅ 添加控制台日志输出
- ✅ 添加错误提示对话框

---

## 总结

删除功能的完整流程：

```
点击删除按钮
    ↓
弹出确认对话框
    ↓
点击"确定"
    ↓
发送 DELETE 请求
    ↓
后端删除任务
    ↓
取消调度
    ↓
返回成功响应
    ↓
前端刷新列表
    ↓
任务消失 ✅
```

**如果任何一步失败，现在都会有明确的错误提示和日志输出！**
