# 签到状态检测问题诊断指南

## 问题描述
刷新站点信息后，"今日已签到"图标没有被自动点亮，但站点上已经是已签到状态。

---

## 诊断步骤

### 步骤1: 启用系统日志 📝

**位置**: 设置页面 → 系统设置

```
enable_system_logs = true
```

启用后，系统会输出详细的调试信息。

---

### 步骤2: 手动刷新站点 🔄

1. 打开站点管理页面
2. 找到已签到的站点
3. 点击 🔄 刷新按钮
4. 查看后端日志输出

---

### 步骤3: 查看日志输出 🔍

#### 正常情况（检测到签到）✅
```bash
[Checkin Debug] Found checkin-related text: [
  '今日已签到，这是您的第365次签到',
  '连续签到 30 天'
]
[Checkin Debug] isCheckedIn: true
[Checkin] 站点名 detected as already checked in (via refresh)
```

#### 异常情况（未检测到签到）❌
```bash
[Checkin Debug] Found checkin-related text: [
  '点击签到获取魔力值'
]
[Checkin Debug] isCheckedIn: false
```

---

### 步骤4: 分析签到文本 📊

如果日志显示 `isCheckedIn: false`，请检查 `Found checkin-related text` 中的内容。

#### 可能的原因

| 原因 | 说明 | 解决方案 |
|------|------|---------|
| **关键词不匹配** | 站点使用了未覆盖的签到文本 | 添加新关键词 |
| **HTML结构特殊** | 签到状态在特殊标签中 | 调整解析逻辑 |
| **Cookie失效** | 未登录状态，看不到签到信息 | 更新Cookie |
| **站点类型错误** | 站点类型不是NexusPHP | 修改站点类型 |

---

## 当前支持的签到关键词

### 中文关键词 🇨🇳
```javascript
✅ '已经签到'
✅ '今日已签到'
✅ '签到成功'
✅ '已签到'
✅ '今天已签'
✅ '您今天已经签到'
✅ '您已签到'
✅ '连续签到'
✅ '签到已得'           // 新增
✅ '这是您的第'         // 新增："这是您的第X次签到"
✅ '次签到'             // 新增
```

### 英文关键词 🇬🇧
```javascript
✅ 'Attendance successful'
✅ 'You have already attended'
✅ 'You have already earned'
✅ 'Already checked in'
✅ 'already signed in'
✅ 'checked in today'    // 新增
```

### HTML标识 🏷️
```javascript
✅ 'signed_in'          // CSS类名
✅ 'checked_in'         // CSS类名
✅ 'attendance_yes'     // 新增
✅ disabled + 签到      // 新增：禁用的签到按钮
```

---

## 添加新关键词

### 如果你的站点使用了不同的签到文本

#### 步骤1: 查看日志中的签到相关文本
```bash
[Checkin Debug] Found checkin-related text: [
  '您已完成今日签到任务'  ← 新的签到文本
]
```

#### 步骤2: 添加到关键词列表

**文件**: `server/src/utils/siteParsers.js:259-280`

```javascript
const alreadyCheckedIn = text.includes('已经签到') ||
    text.includes('今日已签到') ||
    // ... 其他关键词 ...
    text.includes('您已完成今日签到任务') ||  // ← 添加新关键词
    // ...
```

#### 步骤3: 重启服务
```bash
# Docker环境
docker-compose restart

# 或者
npm run dev
```

---

## 常见站点签到文本示例

### NexusPHP站点
```
✅ "今日已签到，这是您的第365次签到"
✅ "签到已得 5 魔力值"
✅ "连续签到 30 天"
✅ "您今天已经签到过了"
```

### M-Team
```
✅ "今日已签到"
✅ "连续签到 X 天"
```

### HDChina
```
✅ "签到成功"
✅ "您已签到"
```

### 其他站点
如果你的站点签到文本不在上述列表中，请：
1. 启用系统日志
2. 刷新站点
3. 查看日志输出
4. 将签到文本反馈给我

---

## 调试技巧

### 技巧1: 手动检查HTML

1. 在浏览器中打开站点首页
2. 按 F12 打开开发者工具
3. 在 Console 中运行：
```javascript
document.body.innerText.match(/.{0,50}签到.{0,50}/gi)
```
4. 查看包含"签到"的文本片段

### 技巧2: 检查Cookie是否有效

如果签到状态检测失败，可能是Cookie失效：

```bash
# 日志中会显示
[Status] 站点名 cookie is valid
# 或
Cookie 已失效，请及时处理
```

### 技巧3: 检查站点类型

确保站点类型设置正确：
- NexusPHP: 大部分中文PT站点
- Gazelle: RED, OPS等
- Unit3D: UNIT3D框架站点

---

## 代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| 签到检测逻辑 | `server/src/utils/siteParsers.js` | 258-295 |
| 关键词列表 | `server/src/utils/siteParsers.js` | 259-280 |
| 调试日志 | `server/src/utils/siteParsers.js` | 283-292 |
| 刷新统计 | `server/src/services/siteService.js` | 197-276 |
| Cookie检查 | `server/src/services/siteService.js` | 123-194 |

---

## 快速诊断清单 ✅

### 检查项目

- [ ] 系统日志已启用 (`enable_system_logs = true`)
- [ ] 站点Cookie有效（显示"Cookie 正常"）
- [ ] 站点类型正确（通常是 NexusPHP）
- [ ] 站点确实已签到（在浏览器中确认）
- [ ] 查看了后端日志输出
- [ ] 日志中显示了签到相关文本

### 如果仍然无法检测

请提供以下信息：

1. **站点名称**: _____________
2. **站点类型**: _____________
3. **日志输出**:
```
[Checkin Debug] Found checkin-related text: [
  // 粘贴日志内容
]
[Checkin Debug] isCheckedIn: false/true
```
4. **签到页面文本**: （在浏览器中复制签到相关的文本）

---

## 临时解决方案

### 方案1: 手动签到
如果自动检测不工作，可以手动点击签到按钮：
1. 打开站点管理页面
2. 点击站点名称旁边的 ⏰ 图标
3. 手动签到

### 方案2: 使用自动签到
启用自动签到功能：
1. 编辑站点
2. 勾选"启用每日自动签到"
3. 设置签到时间（设置 → `checkin_time`）

---

## 最新优化

### 新增关键词（2026-01-02）
- ✅ `签到已得`
- ✅ `这是您的第`
- ✅ `次签到`
- ✅ `checked in today`
- ✅ `attendance_yes`
- ✅ 禁用的签到按钮检测

### 新增调试功能
- ✅ 自动输出签到相关文本
- ✅ 显示检测结果
- ✅ 只在启用系统日志时输出

---

## 总结

### 签到检测流程

```
刷新站点
    ↓
访问站点首页（带Cookie）
    ↓
解析HTML
    ↓
提取文本内容
    ↓
检查23个签到关键词
    ↓
检测到？
    ├─ 是 → 更新 last_checkin_at → 前端显示 ✅
    └─ 否 → 不更新 → 前端不显示
```

### 如何确保检测成功

1. ✅ Cookie有效
2. ✅ 站点类型正确
3. ✅ 签到文本包含支持的关键词
4. ✅ 启用系统日志查看调试信息

**如果按照上述步骤仍无法解决，请提供日志输出，我会帮你添加新的关键词！** 🎯
