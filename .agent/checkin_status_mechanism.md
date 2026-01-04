# stats.isCheckedIn 状态变化机制详解

## 概述

`stats.isCheckedIn` 是一个布尔值，表示站点是否已经签到。这个状态**不是存储在数据库中的**，而是每次从站点 HTML 页面**实时解析**出来的。

## 解析位置

**文件：** `/server/src/utils/siteParsers.js`  
**函数：** `parseUserStats(html, type)` 第 327-397 行

## 判断逻辑

### NexusPHP 类型站点（第 348-392 行）

```javascript
// Check-in status detection - Enhanced with more keywords and debug logging
// Check for disabled checkin button (more specific pattern to avoid false positives)
const disabledCheckinPattern = /<[^>]*disabled[^>]*(签到|checkin|attendance)[^>]*>|<[^>]*(签到|checkin|attendance)[^>]*disabled[^>]*>/i;
const hasDisabledCheckin = disabledCheckinPattern.test(html);

const alreadyCheckedIn = text.includes('已经签到') ||
    text.includes('今日已签到') ||
    text.includes('签到成功') ||
    text.includes('已签到') ||
    text.includes('今天已签') ||
    text.includes('您今天已经签到') ||
    text.includes('您已签到') ||
    text.includes('连续签到') ||
    text.includes('签到已得') ||
    text.includes('这是您的第') ||  // "这是您的第X次签到"
    text.includes('次签到') ||
    text.includes('Attendance successful') ||
    text.includes('You have already attended') ||
    text.includes('You have already earned') ||
    text.includes('Already checked in') ||
    text.includes('already signed in') ||
    text.includes('checked in today') ||
    html.includes('已签到') ||
    html.includes('signed_in') ||
    html.includes('checked_in') ||
    html.includes('attendance_yes') ||
    hasDisabledCheckin;

stats.isCheckedIn = alreadyCheckedIn;
```

### Mock 类型站点（第 329 行）

```javascript
return { 
    username: 'MockUser', 
    upload: '12.5 TB', 
    download: '2.3 TB', 
    ratio: '5.43', 
    bonus: '15,204', 
    level: '精英用户', 
    isCheckedIn: false  // 固定为 false
};
```

---

## 检测关键词列表

### 中文关键词
- ✅ `已经签到`
- ✅ `今日已签到`
- ✅ `签到成功`
- ✅ `已签到`
- ✅ `今天已签`
- ✅ `您今天已经签到`
- ✅ `您已签到`
- ✅ `连续签到`
- ✅ `签到已得`
- ✅ `这是您的第`
- ✅ `次签到`

### 英文关键词
- ✅ `Attendance successful`
- ✅ `You have already attended`
- ✅ `You have already earned`
- ✅ `Already checked in`
- ✅ `already signed in`
- ✅ `checked in today`

### HTML 标记
- ✅ `signed_in` (class 或 id)
- ✅ `checked_in` (class 或 id)
- ✅ `attendance_yes` (class 或 id)

### 按钮状态检测
- ✅ 签到按钮被禁用（`<button disabled>签到</button>`）
- ✅ 签到链接被禁用（`<a disabled>checkin</a>`）

---

## 状态变化时机

### 1. Cookie 检查时（自动）

**触发：** 定时任务或手动刷新  
**位置：** `/server/src/services/siteService.js` 第 123-204 行

```javascript
async checkCookie(id) {
    // ...
    const response = await axios.get(site.url, { ... });
    const html = response.data;
    
    // 解析用户数据，包括 isCheckedIn
    const stats = siteParsers.parseUserStats(html, site.type);
    
    if (stats.isCheckedIn) {
        // 检测到已签到，更新 last_checkin_at
        sql += ', last_checkin_at = ?';
        params.push(now);
    } else {
        // 未签到，清除过期的签到记录
        const lastCheckinDate = site.last_checkin_at ? new Date(site.last_checkin_at).toDateString() : null;
        const todayDate = new Date().toDateString();
        if (lastCheckinDate && lastCheckinDate !== todayDate) {
            sql += ', last_checkin_at = NULL';
        }
    }
}
```

**变化逻辑：**
- 🔄 每次访问站点首页时，从 HTML 重新解析
- ✅ 如果 HTML 包含已签到关键词 → `isCheckedIn = true` → 更新 `last_checkin_at`
- ❌ 如果 HTML 不包含已签到关键词 → `isCheckedIn = false` → 清除过期的 `last_checkin_at`

---

### 2. 刷新用户数据时（手动）

**触发：** 用户点击刷新按钮  
**位置：** `/server/src/services/siteService.js` 第 206-294 行

```javascript
async refreshUserStats(id) {
    // ...
    const response = await axios.get(site.url, { ... });
    const html = response.data;
    
    const stats = siteParsers.parseUserStats(html, site.type);
    
    if (stats.isCheckedIn) {
        sql += ', last_checkin_at = ?';
        params.push(now);
    } else {
        const lastCheckinDate = site.last_checkin_at ? new Date(site.last_checkin_at).toDateString() : null;
        const todayDate = new Date().toDateString();
        if (lastCheckinDate && lastCheckinDate !== todayDate) {
            sql += ', last_checkin_at = NULL';
        }
    }
}
```

**变化逻辑：** 与 Cookie 检查相同

---

### 3. 手动签到后（间接）

**触发：** 用户点击签到按钮  
**位置：** `/server/src/services/siteService.js` 第 323-401 行

```javascript
async checkinSite(id) {
    // 访问签到 URL
    const response = await axios.get(checkinUrls[0], { ... });
    
    // 解析响应，检查是否成功
    const stats = siteParsers.parseUserStats(response.data, site.type);
    const isSuccess = response.status === 200 || (stats && stats.isCheckedIn);
    
    if (isSuccess) {
        // 直接更新 last_checkin_at
        db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?')
            .run(new Date().toISOString(), id);
    }
}
```

**变化逻辑：**
- 🔄 访问签到页面后，从返回的 HTML 解析 `isCheckedIn`
- ✅ 如果签到成功，HTML 会包含 "签到成功" 等关键词 → `isCheckedIn = true`
- ⚠️ 注意：这里直接更新 `last_checkin_at`，不依赖 `isCheckedIn` 的持久化

---

## 重要特性

### ⚠️ 非持久化状态

`isCheckedIn` **不存储在数据库中**，每次都是从 HTML 实时解析：

```javascript
// ❌ 数据库中没有 isCheckedIn 字段
CREATE TABLE sites (
    id INTEGER PRIMARY KEY,
    name TEXT,
    last_checkin_at DATETIME,  // ✅ 只存储签到时间
    // ❌ 没有 isCheckedIn 字段
);
```

### 🔄 实时解析

每次调用 `parseUserStats(html, type)` 都会重新判断：

```javascript
// 每次都从 HTML 重新解析
const stats = siteParsers.parseUserStats(html, site.type);
console.log(stats.isCheckedIn);  // 可能是 true 或 false
```

### 📅 跨天自动重置

因为是从 HTML 实时解析，所以：
- **今天签到后：** HTML 包含 "已签到" → `isCheckedIn = true`
- **第二天凌晨后：** HTML 不再包含 "已签到" → `isCheckedIn = false`

**站点的 HTML 内容会自动变化**，不需要手动重置。

---

## 调试日志

当启用系统日志时（`enable_system_logs = true`），会输出调试信息：

```javascript
if (enableLogs) {
    // 提取签到相关的文本片段
    const checkinRelatedText = text.match(/.{0,50}(签到|checkin|attendance).{0,50}/gi);
    if (checkinRelatedText && checkinRelatedText.length > 0) {
        console.log(`[Checkin Debug] Found checkin-related text: `, checkinRelatedText.slice(0, 3));
    }
    console.log(`[Checkin Debug] isCheckedIn: ${alreadyCheckedIn}`);
}
```

**示例输出：**
```
[Checkin Debug] Found checkin-related text: ['您今天已经签到，这是您的第15次签到', '连续签到 5 天', '签到已得 100 魔力值']
[Checkin Debug] isCheckedIn: true
```

---

## 状态流转图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户访问站点首页                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              获取 HTML 内容                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         parseUserStats(html, type)                          │
│         检查 HTML 中是否包含已签到关键词                     │
└─────────────┬───────────────────────┬───────────────────────┘
              │                       │
    包含关键词 │                       │ 不包含关键词
              ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ isCheckedIn=true │    │ isCheckedIn=false│
    └────────┬─────────┘    └────────┬─────────┘
             │                       │
             ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ 更新数据库：      │    │ 清除过期记录：    │
    │ last_checkin_at  │    │ last_checkin_at  │
    │ = 当前时间        │    │ = NULL (如果过期) │
    └──────────────────┘    └──────────────────┘
```

---

## 典型场景分析

### 场景 1：今天首次签到

**时间：** 2026-01-04 09:00

1. **签到前：**
   - 访问首页 → HTML 不包含 "已签到" → `isCheckedIn = false`
   - `last_checkin_at = NULL` 或昨天的时间

2. **点击签到：**
   - 访问 `/attendance.php` → 签到成功
   - 返回的 HTML 包含 "签到成功" → `isCheckedIn = true`
   - 更新 `last_checkin_at = 2026-01-04 09:00:00`

3. **签到后：**
   - 再次访问首页 → HTML 包含 "今日已签到" → `isCheckedIn = true`
   - `last_checkin_at` 保持不变

---

### 场景 2：跨天后首次访问

**时间：** 2026-01-05 00:01（第二天凌晨）

1. **访问首页：**
   - HTML 不再包含 "已签到"（站点自动重置）→ `isCheckedIn = false`
   - `last_checkin_at = 2026-01-04 09:00:00`（昨天的时间）

2. **Cookie 检查或刷新：**
   - 检测到 `isCheckedIn = false`
   - 检测到 `last_checkin_at` 不是今天
   - 清除 `last_checkin_at = NULL`

3. **结果：**
   - 前端不再显示 "今日已签到" 标识
   - 签到图标恢复未签到状态

---

### 场景 3：自动签到

**时间：** 2026-01-04 09:00（定时任务）

1. **定时任务触发：**
   - 调用 `checkinAllSites()`
   - 对每个启用了 `auto_checkin` 的站点执行签到

2. **签到过程：**
   - 访问 `/attendance.php`
   - 检查返回的 HTML → `isCheckedIn = true`
   - 更新 `last_checkin_at = 2026-01-04 09:00:00`

3. **下次 Cookie 检查：**
   - 访问首页 → HTML 包含 "已签到" → `isCheckedIn = true`
   - 确认 `last_checkin_at` 是今天 → 保持不变

---

## 常见问题

### Q1: 为什么 `isCheckedIn` 不存储在数据库中？

**A:** 因为签到状态是站点的**实时状态**，每天都会变化。存储在数据库中会导致：
- 需要手动重置（复杂）
- 可能与站点实际状态不同步（不可靠）

通过实时解析 HTML，可以确保状态始终准确。

---

### Q2: 如果站点的 HTML 格式变化怎么办？

**A:** 需要更新 `siteParsers.js` 中的关键词列表。当前已经包含了大量常见关键词，覆盖了大部分 NexusPHP 站点。

如果发现某个站点无法正确检测，可以：
1. 启用系统日志（`enable_system_logs = true`）
2. 查看 `[Checkin Debug]` 输出
3. 添加新的关键词到检测列表

---

### Q3: `last_checkin_at` 和 `isCheckedIn` 的关系？

**A:**
- **`isCheckedIn`**: 实时解析的签到状态（不存储）
- **`last_checkin_at`**: 数据库中存储的最后签到时间（持久化）

**关系：**
```javascript
if (isCheckedIn) {
    // 检测到已签到，更新数据库
    last_checkin_at = 当前时间;
} else {
    // 未签到，清除过期记录
    if (last_checkin_at 不是今天) {
        last_checkin_at = NULL;
    }
}
```

---

### Q4: 如何确保签到状态准确？

**A:** 系统通过多个时机检查：
1. **定时 Cookie 检查**（每小时）
2. **手动刷新用户数据**（用户触发）
3. **手动签到**（用户触发）

每次检查都会重新解析 HTML，确保状态准确。

---

## 总结

### 核心机制
- ✅ `isCheckedIn` 是**实时解析**的，不存储在数据库
- ✅ 每次访问站点时，从 HTML 重新判断
- ✅ 通过检测大量关键词和 HTML 标记来判断

### 状态变化
- 🔄 **签到前**: HTML 不包含关键词 → `isCheckedIn = false`
- ✅ **签到后**: HTML 包含 "已签到" → `isCheckedIn = true`
- 🌅 **第二天**: 站点 HTML 自动重置 → `isCheckedIn = false`

### 数据库同步
- 📝 `isCheckedIn = true` → 更新 `last_checkin_at` 为当前时间
- 🗑️ `isCheckedIn = false` 且 `last_checkin_at` 过期 → 清除 `last_checkin_at`

### 调试方法
- 🔍 启用系统日志查看 `[Checkin Debug]` 输出
- 📊 检查 HTML 中是否包含签到相关关键词
- 🧪 手动访问站点首页，查看实际显示内容
