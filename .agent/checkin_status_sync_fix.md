# 签到状态同步修复

## 问题描述

后台任务每隔一定时间会检查站点数据，如果发现站点上已经签到过，则会同步点亮卡片上的"今日已签到"图标。但由于是每日签到，第二天站点上会自动变成未签到状态，之前的程序不会同步取消卡片上的"今日已签到"图标。

## 问题根源

在 `siteService.js` 的 `checkCookie` 和 `refreshUserStats` 方法中：

1. **当检测到已签到时**（`stats.isCheckedIn === true`）：会更新 `last_checkin_at` 为当前时间
2. **当检测到未签到时**（`stats.isCheckedIn === false`）：不做任何处理，`last_checkin_at` 保持不变

这导致的问题：
- 第一天签到后，`last_checkin_at` 被设置为今天的日期
- 第二天，站点自动变成未签到状态
- 后台任务检查时发现未签到，但不会清除或更新 `last_checkin_at`
- 因此 `last_checkin_at` 仍然保留昨天的日期
- 虽然前端的 `isToday()` 函数理论上能正确判断，但在某些边缘情况下可能会出现显示不一致的问题

## 解决方案

修改了 `checkCookie` 和 `refreshUserStats` 两个方法，增加了以下逻辑：

```javascript
if (stats.isCheckedIn) {
    // 已签到：更新 last_checkin_at 为当前时间
    sql += ', last_checkin_at = ?';
    params.push(now);
} else {
    // 未签到：检查 last_checkin_at 是否为今天
    const lastCheckinDate = site.last_checkin_at ? new Date(site.last_checkin_at).toDateString() : null;
    const todayDate = new Date().toDateString();
    if (lastCheckinDate && lastCheckinDate !== todayDate) {
        // 如果 last_checkin_at 不是今天，清空该字段
        sql += ', last_checkin_at = NULL';
    }
}
```

## 修改的文件

- `/Users/qinming/Codes/PTDownload/server/src/services/siteService.js`
  - `checkCookie` 方法（第 169-177 行）
  - `refreshUserStats` 方法（第 273-281 行）

## 效果

现在当后台任务检查站点数据时：
1. **站点已签到**：同步更新 `last_checkin_at` 为当前时间，前端显示"今日已签到"图标
2. **站点未签到且 `last_checkin_at` 是过期日期**：清空 `last_checkin_at`，前端不显示"今日已签到"图标
3. **站点未签到且 `last_checkin_at` 为空或为今天**：保持不变

这样确保了前端显示的"今日已签到"图标能够准确反映站点的实际签到状态。

## 测试建议

1. 在某个站点手动签到或等待自动签到
2. 确认前端卡片显示"今日已签到"图标
3. 等到第二天（或手动修改系统时间）
4. 触发后台任务检查（等待定时任务或手动点击"一键同步"）
5. 确认前端卡片的"今日已签到"图标消失
