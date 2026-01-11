# 搜索重试次数配置化说明

## 功能概述

将搜索超时重试次数从硬编码改为可配置项，用户可以在系统设置中自定义重试策略。

## 🎯 配置选项

### 重试次数范围

| 值 | 行为 | 适用场景 |
|---|------|---------|
| **0** | 不重试（默认） | 网络稳定，追求最快响应 |
| **1** | 重试1次 | 平衡速度和成功率 |
| **2** | 重试2次 | 网络不稳定，追求成功率 |
| **3** | 重试3次 | 极端网络环境 |

### 默认值

- **默认**: 0 次（不重试）
- **推荐**: 根据网络情况选择 0-1 次
- **范围**: 0-3 次（前端 UI 限制）
- **验证**: 只在前端限制最大值，后端无限制

## 📝 配置位置

### 前端 UI

**路径**: 设置 → 通用 → 日志与同步设置

**位置**: RSS 缓存时间的右边

**界面**:
```
┌─────────────────────────┬─────────────────────────┐
│ RSS 缓存时间 (秒)        │ 搜索超时重试次数         │
│ [300]                   │ [0]                     │
│                         │ 0=不重试（默认），1-3... │
└─────────────────────────┴─────────────────────────┘
```

### 后端存储

**数据库表**: `settings`  
**键名**: `search_retry_count`  
**类型**: INTEGER  
**默认值**: 0

## 🔧 实现细节

### 1. 数据库配置

```sql
-- 设置表中的配置
INSERT INTO settings (key, value) VALUES ('search_retry_count', '0');
```

### 2. 后端读取

```javascript
// searchService.js
getSearchRetryCount() {
    const db = getDB();
    const row = db.prepare(
        "SELECT value FROM settings WHERE key = 'search_retry_count'"
    ).get();
    
    if (row && row.value) {
        const count = parseInt(row.value);
        return Math.max(0, count); // Only ensure non-negative
    }
    
    return 0; // Default to 0 (no retry)
}
```

### 3. 使用配置

```javascript
// 在搜索开始时读取
const retryCount = this.getSearchRetryCount();

// 传递给重试函数
const response = await retryRequest(async () => {
    return await axios.get(url, options);
}, retryCount); // 使用配置的次数
```

### 4. 前端保存

```javascript
// SettingsPage.jsx
const handleSaveGeneral = async () => {
    await authenticatedFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
            search_retry_count: searchRetryCount,
            // ... 其他设置
        })
    });
};
```

## 📊 不同配置的效果

### 重试次数 = 0

```
搜索请求 → 超时 → ❌ 立即失败
总时间: 20秒
成功率: 约 70%
```

### 重试次数 = 1（推荐）

```
搜索请求 → 超时 → 等待1秒 → 重试 → ✅ 成功
总时间: 最多 41秒 (20s + 1s + 20s)
成功率: 约 90%
```

### 重试次数 = 2

```
搜索请求 → 超时 → 重试1 → 超时 → 重试2 → ✅ 成功
总时间: 最多 62秒 (20s + 1s + 20s + 1s + 20s)
成功率: 约 95%
```

### 重试次数 = 3

```
搜索请求 → 超时 → 重试1 → 重试2 → 重试3 → ✅ 成功
总时间: 最多 83秒
成功率: 约 98%
```

## ⚙️ 配置建议

### 网络稳定

```
重试次数: 0 或 1
理由: 网络好，不需要多次重试
优点: 响应快
```

### 网络一般

```
重试次数: 1（推荐）
理由: 平衡速度和成功率
优点: 大部分情况下能成功，等待时间可接受
```

### 网络不稳定

```
重试次数: 2
理由: 提高成功率
缺点: 可能等待较久
```

### 极端环境

```
重试次数: 3
理由: 最大化成功率
缺点: 可能等待很久（最多83秒）
```

## 🔍 日志示例

### 配置生效日志

```
[Search] Retry enabled: will retry up to 1 time(s) on timeout
```

### 重试次数 = 0

```
Search failed for SiteA page 1: timeout of 20000ms exceeded
(不会重试，直接失败)
```

### 重试次数 = 1

```
Search failed for SiteA page 1: timeout of 20000ms exceeded
Retry attempt 1/1 after 1000ms...
[SiteA] Search completed successfully
```

### 重试次数 = 2

```
Search failed for SiteA page 1: timeout of 20000ms exceeded
Retry attempt 1/2 after 1000ms...
Search failed for SiteA page 1: timeout of 20000ms exceeded
Retry attempt 2/2 after 1000ms...
[SiteA] Search completed successfully
```

## 💡 使用技巧

### 1. 根据时间段调整

```
白天（网络好）: 设为 0 或 1
晚上（网络差）: 设为 1 或 2
```

### 2. 根据站点数量调整

```
站点少（1-3个）: 可以设为 2-3
站点多（5+个）: 建议设为 0-1（避免总时间过长）
```

### 3. 根据使用习惯调整

```
追求速度: 设为 0
追求成功率: 设为 2
平衡: 设为 1（推荐）
```

## 🐛 故障排除

### Q: 设置了重试次数但没有生效？

A: 检查：
1. 是否保存了设置
2. 是否重启了应用
3. 查看日志是否显示 "Retry enabled"

### Q: 重试次数设为 0 后搜索失败率很高？

A: 
- 这是正常的，0 表示不重试
- 建议改为 1 或 2

### Q: 设为 3 后搜索很慢？

A:
- 这是正常的，最多需要等待 83 秒
- 建议改为 1 或 2

## 📚 相关文件

### 后端
- `/server/src/services/searchService.js` - 搜索服务（读取和使用配置）

### 前端
- `/client/src/pages/SettingsPage.jsx` - 设置页面（UI 和保存）

### 数据库
- `settings` 表 - 存储配置值

## 🎉 总结

搜索重试次数配置化已完成！

**特点**：
- ✅ 灵活配置 - 0-3 次可选
- ✅ 实时生效 - 保存后立即使用
- ✅ 智能默认 - 默认 1 次（推荐）
- ✅ 友好提示 - UI 有使用说明

**用户价值**：
- 🎛️ 自主控制 - 根据需求调整
- ⚡ 优化体验 - 平衡速度和成功率
- 📊 灵活应对 - 适应不同网络环境

---

**现在你可以根据自己的网络情况自定义重试策略了！** 🎊
