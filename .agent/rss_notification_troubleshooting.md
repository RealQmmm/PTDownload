# RSS 自动任务通知问题排查

## 问题描述
RSS 自动任务匹配到资源并开始下载时，没有通过设定的通知规则进行通知。

## 代码分析

### 通知调用位置

#### 1. RSS 自动匹配通知
**文件**: `/server/src/services/rssService.js`  
**位置**: 第 364 行

```javascript
// 在成功添加种子后发送通知
if (result.success) {
    db.prepare('INSERT INTO task_history ...').run(...);
    
    // Send notification
    try {
        const FormatUtils = require('../utils/formatUtils');
        await notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));
    } catch (notifyErr) {
        console.error('[RSS] Notification failed:', notifyErr.message);
    }
}
```

#### 2. 手动下载通知
**文件**: `/server/src/routes/download.js`  
**位置**: 第 118 行

```javascript
// Send notification
const notificationService = require('../services/notificationService');
notificationService.notifyDownloadStart(title, size);
```

### 通知服务逻辑

**文件**: `/server/src/services/notificationService.js`

#### RSS 匹配通知方法 (第 133-140 行)
```javascript
async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
    const config = await this.getSettings();
    if (!config.enabled || !config.notifyOnDownloadStart) return;  // ⚠️ 关键检查

    const title = `✨ RSS 匹配成功: ${taskName}`;
    const message = `${torrentTitle}\\n体积: ${sizeStr}`;
    await this.send(title, message, config);
}
```

#### 手动下载通知方法 (第 145-153 行)
```javascript
async notifyDownloadStart(torrentTitle, sizeStr) {
    const config = await this.getSettings();
    if (!config.enabled || !config.notifyOnDownloadStart) return;  // ⚠️ 关键检查

    const title = `🚀 开始下载资源`;
    const message = `${torrentTitle}\\n体积: ${sizeStr || '未知'}`;
    await this.send(title, message, config);
}
```

### 配置读取逻辑 (第 48-52 行)
```javascript
return {
    enabled: settingsMap['notify_enabled'] === 'true',
    notifyOnDownloadStart: settingsMap['notify_on_download_start'] === 'true',
    receivers: receivers.filter(r => r.enabled)
};
```

---

## 可能的问题原因

### 1. ✅ 通知总开关未启用
**检查**: 设置页面 → 通知 → 是否启用了通知功能

**数据库检查**:
```sql
SELECT * FROM settings WHERE key = 'notify_enabled';
```

**预期值**: `'true'`

---

### 2. ✅ 资源下载通知开关未启用
**检查**: 设置页面 → 通知 → "资源下载通知" 开关

**数据库检查**:
```sql
SELECT * FROM settings WHERE key = 'notify_on_download_start';
```

**预期值**: `'true'`

**说明**: 这个开关同时控制：
- RSS 自动匹配通知
- 手动搜索下载通知

---

### 3. ✅ 没有配置通知接收端
**检查**: 设置页面 → 通知 → 通知接收端列表

**数据库检查**:
```sql
SELECT * FROM settings WHERE key = 'notification_receivers';
```

**预期值**: 包含至少一个启用的接收端，例如：
```json
[
  {
    "id": "xxx",
    "type": "bark",
    "name": "我的 Bark",
    "url": "https://api.day.app/YOUR_KEY",
    "enabled": true
  }
]
```

**代码检查**: `notificationService.js` 第 65-73 行
```javascript
if (receivers.length === 0) {
    // Check compatibility mode if overrideConfig has legacy fields
    if (config.barkUrl) receivers.push({ type: 'bark', url: config.barkUrl, enabled: true });
    if (config.webhookUrl) receivers.push({ type: 'webhook', url: config.webhookUrl, method: config.webhookMethod, enabled: true });
}

if (receivers.length === 0) {
    return { success: false, error: '未配置任何有效通知接收端' };
}
```

---

### 4. ⚠️ 通知发送失败但被静默处理
**位置**: `rssService.js` 第 362-367 行

```javascript
try {
    const FormatUtils = require('../utils/formatUtils');
    await notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));
} catch (notifyErr) {
    console.error('[RSS] Notification failed:', notifyErr.message);  // ⚠️ 只打印错误，不抛出
}
```

**问题**: 如果通知发送失败，错误只会打印到控制台，不会影响 RSS 任务的执行。

**排查方法**: 检查服务器日志中是否有 `[RSS] Notification failed:` 的错误信息。

---

### 5. ⚠️ 通知接收端 URL 配置错误
**常见错误**:
- Bark URL 格式错误（应该是 `https://api.day.app/YOUR_KEY`）
- Webhook URL 无法访问
- 网络问题导致请求超时（10秒超时）

**排查方法**: 
1. 在设置页面点击"发送测试通知"按钮
2. 检查服务器日志中的通知发送结果

---

### 6. ⚠️ 数据库值类型问题
**问题**: 数据库中的布尔值可能存储为字符串 `'true'` 或 `'false'`，而不是布尔值 `true` 或 `false`。

**代码检查**: `notificationService.js` 第 49-50 行
```javascript
enabled: settingsMap['notify_enabled'] === 'true',  // ✅ 正确：使用字符串比较
notifyOnDownloadStart: settingsMap['notify_on_download_start'] === 'true',  // ✅ 正确
```

这个逻辑是正确的，使用了字符串比较。

---

## 排查步骤

### 步骤 1: 检查通知设置
```sql
-- 检查所有通知相关设置
SELECT * FROM settings WHERE key LIKE 'notify_%' OR key = 'notification_receivers';
```

**预期结果**:
```
notify_enabled = 'true'
notify_on_download_start = 'true'
notification_receivers = '[{"id":"...","type":"bark","name":"...","url":"...","enabled":true}]'
```

### 步骤 2: 检查服务器日志
查找以下关键日志：
```
[Notify] Sending notification "✨ RSS 匹配成功: ..." to X receivers
[Notify] Sent to Bark: ...
[RSS] Notification failed: ...
```

### 步骤 3: 测试通知功能
1. 在设置页面点击"发送测试通知"
2. 检查是否收到通知
3. 如果收到，说明通知配置正确，问题可能在 RSS 调用逻辑
4. 如果未收到，说明通知配置有问题

### 步骤 4: 检查 RSS 任务执行
查找 RSS 任务执行日志：
```
[RSS] Executing task: ...
[RSS] Match found: ... Adding to downloader...
[RSS] Successfully added: ...
```

如果看到 "Successfully added" 但没有看到 "Sending notification"，说明通知调用被跳过了。

### 步骤 5: 手动触发 RSS 任务
在任务管理页面手动执行一次 RSS 任务，观察：
1. 是否成功匹配资源
2. 是否成功添加到下载器
3. 是否发送通知
4. 服务器日志中的详细信息

---

## 可能的 Bug

### Bug 1: 通知调用时机问题
**当前代码**: 只有在 `result.success` 为 `true` 时才发送通知

```javascript
if (result.success) {
    db.prepare('INSERT INTO task_history ...').run(...);
    
    // Send notification
    try {
        await notificationService.notifyNewTorrent(...);
    } catch (notifyErr) {
        console.error('[RSS] Notification failed:', notifyErr.message);
    }
}
```

**问题**: 如果下载器返回成功但 `result.success` 不是严格的 `true`（例如是 `1` 或其他真值），通知不会发送。

**建议**: 检查 `downloaderService.addTorrent` 和 `downloaderService.addTorrentFromData` 的返回值格式。

---

### Bug 2: 异步通知未等待
**当前代码**: 使用 `await` 等待通知发送

```javascript
await notificationService.notifyNewTorrent(...);
```

这是正确的，不会有问题。

---

### Bug 3: 通知服务返回值检查
**当前代码**: `notifyNewTorrent` 方法没有返回值

```javascript
async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
    const config = await this.getSettings();
    if (!config.enabled || !config.notifyOnDownloadStart) return;  // ⚠️ 静默返回
    
    const title = `✨ RSS 匹配成功: ${taskName}`;
    const message = `${torrentTitle}\\n体积: ${sizeStr}`;
    await this.send(title, message, config);
}
```

**问题**: 如果通知被跳过（因为开关未启用），不会有任何日志提示。

**建议**: 添加日志，明确说明通知被跳过的原因。

---

## 建议的改进

### 改进 1: 添加调试日志
在 `notifyNewTorrent` 方法中添加日志：

```javascript
async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
    const config = await this.getSettings();
    
    console.log('[Notify] RSS notification check:', {
        enabled: config.enabled,
        notifyOnDownloadStart: config.notifyOnDownloadStart,
        receivers: config.receivers.length
    });
    
    if (!config.enabled) {
        console.log('[Notify] Notification disabled globally');
        return;
    }
    
    if (!config.notifyOnDownloadStart) {
        console.log('[Notify] Download start notification disabled');
        return;
    }

    const title = `✨ RSS 匹配成功: ${taskName}`;
    const message = `${torrentTitle}\\n体积: ${sizeStr}`;
    await this.send(title, message, config);
}
```

### 改进 2: 返回通知结果
让 `notifyNewTorrent` 返回通知结果，以便调用方知道是否成功：

```javascript
async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
    const config = await this.getSettings();
    if (!config.enabled || !config.notifyOnDownloadStart) {
        return { success: false, reason: 'disabled' };
    }

    const title = `✨ RSS 匹配成功: ${taskName}`;
    const message = `${torrentTitle}\\n体积: ${sizeStr}`;
    return await this.send(title, message, config);
}
```

在 `rssService.js` 中检查结果：

```javascript
try {
    const FormatUtils = require('../utils/formatUtils');
    const notifyResult = await notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));
    if (notifyResult && !notifyResult.success) {
        if (enableLogs) console.log(`[RSS] Notification skipped or failed:`, notifyResult.reason || notifyResult.error);
    }
} catch (notifyErr) {
    console.error('[RSS] Notification failed:', notifyErr.message);
}
```

---

## 快速诊断命令

### 检查通知设置
```bash
# 进入容器
docker exec -it ptdownload sh

# 查询设置
sqlite3 /app/data/ptmanager.db "SELECT key, value FROM settings WHERE key LIKE 'notify_%' OR key = 'notification_receivers';"
```

### 查看服务器日志
```bash
# 查看最近的日志
docker logs ptdownload --tail 100

# 实时查看日志
docker logs ptdownload -f
```

### 手动测试通知
在浏览器控制台执行：
```javascript
fetch('/api/settings/test-notification', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
}).then(r => r.json()).then(console.log);
```

---

## 总结

通知未发送的最可能原因（按概率排序）：

1. **"资源下载通知"开关未启用** (80%)
2. **通知总开关未启用** (10%)
3. **没有配置通知接收端** (5%)
4. **通知接收端 URL 配置错误** (3%)
5. **网络问题导致通知发送失败** (2%)

**建议操作**:
1. 先检查设置页面的两个开关是否都已启用
2. 检查是否配置了至少一个通知接收端
3. 点击"发送测试通知"验证配置
4. 查看服务器日志确认问题
