# PWA 安全区域适配说明

## 问题描述

在 PWA 全屏模式下，移动设备的特殊屏幕特性会影响内容显示：

- **刘海屏（Notch）**: iPhone X 及以上机型顶部有刘海遮挡
- **圆角屏幕**: 现代手机屏幕四角带圆弧
- **底部手势条**: iOS 设备底部有 Home Indicator

这些区域会遮挡应用内容，导致菜单、按钮等元素无法正常显示或点击。

## 解决方案

### 1. Viewport 配置

在 `index.html` 中添加 `viewport-fit=cover`：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
```

- `viewport-fit=cover`: 允许内容延伸到安全区域外
- `user-scalable=no`: 防止用户缩放（PWA 推荐）

### 2. CSS 安全区域变量

在 `index.css` 中定义安全区域变量：

```css
:root {
    --safe-area-inset-top: env(safe-area-inset-top);
    --safe-area-inset-right: env(safe-area-inset-right);
    --safe-area-inset-bottom: env(safe-area-inset-bottom);
    --safe-area-inset-left: env(safe-area-inset-left);
}

body {
    padding-top: env(safe-area-inset-top);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
}
```

### 3. 组件级适配

#### Sidebar 顶部
```javascript
<div 
    className="p-6 pt-safe shrink-0 flex items-center"
    style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
>
```

#### 移动端 Header
```javascript
<header 
    className="lg:hidden flex items-center justify-between p-2 sm:p-4"
    style={{ 
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))'
    }}
>
```

## 安全区域值说明

### 不同设备的安全区域

| 设备 | 顶部 | 底部 | 左右 |
|------|------|------|------|
| iPhone X/11/12/13 (竖屏) | 44px | 34px | 0px |
| iPhone X/11/12/13 (横屏) | 0px | 21px | 44px |
| iPhone 14 Pro/15 Pro | 59px | 34px | 0px |
| Android 刘海屏 | 24-48px | 0-24px | 0px |
| 普通设备 | 0px | 0px | 0px |

### max() 函数的作用

```css
padding-top: max(1.5rem, env(safe-area-inset-top));
```

- 确保至少有 `1.5rem` 的内边距（设计需要）
- 如果安全区域更大，则使用安全区域值
- 在普通设备上，安全区域为 0，使用 `1.5rem`

## 测试方法

### 1. iOS Safari 模拟器

1. 打开 Safari 开发者工具
2. 选择 iPhone 设备
3. 进入全屏模式测试

### 2. Chrome DevTools

1. 打开 DevTools (F12)
2. 切换到设备模拟模式
3. 选择 iPhone X 或更新机型
4. 刷新页面查看效果

### 3. 实机测试

1. 在 iPhone X 及以上机型安装 PWA
2. 从主屏幕打开应用
3. 检查顶部和底部是否有遮挡

## 常见问题

### Q: 为什么要同时设置 body 和组件的 padding？

A: 
- **body padding**: 确保整体内容不被遮挡
- **组件 padding**: 针对特定区域（如 header）的精细控制

### Q: 为什么使用 inline style 而不是 className？

A: 
- `env()` 函数在 Tailwind 中支持有限
- inline style 可以直接使用 CSS 函数
- 更灵活地组合 `max()` 和 `env()`

### Q: 普通浏览器访问会有问题吗？

A: 
- 不会！`env(safe-area-inset-*)` 在不支持的环境返回 0
- `max()` 函数确保始终有最小内边距
- 完全向下兼容

### Q: 横屏模式需要特殊处理吗？

A: 
- 当前实现已自动适配横屏
- `env()` 会根据方向自动调整值
- 左右安全区域在横屏时生效

## 最佳实践

### 1. 固定顶部元素

```javascript
<header style={{
    paddingTop: 'max(1rem, env(safe-area-inset-top))'
}}>
```

### 2. 固定底部元素

```javascript
<footer style={{
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
}}>
```

### 3. 全屏弹窗

```javascript
<div style={{
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)'
}}>
```

### 4. 横向滚动容器

```javascript
<div style={{
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)'
}}>
```

## 参考资源

- [Apple: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [CSS Tricks: The Notch and CSS](https://css-tricks.com/the-notch-and-css/)

## 更新日志

- **2026-01-11**: 初始实现，支持顶部和左右安全区域
- 适配 Sidebar 和移动端 Header
- 添加 body 级别的全局安全区域支持

---

**现在 PTDownload 已完美适配刘海屏和圆角屏幕！** 🎉
