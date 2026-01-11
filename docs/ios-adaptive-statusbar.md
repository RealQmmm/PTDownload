# iPhone 自适应状态栏配置说明

## 问题背景

Android 设备的状态栏会自动根据应用的背景色调整文字颜色（深色背景显示白色文字，浅色背景显示黑色文字）。

但 iPhone 的状态栏需要手动配置，之前使用 `black-translucent` 导致状态栏始终是黑色半透明，不会随主题变化。

## 解决方案

### 1. iOS 状态栏样式说明

iPhone 支持三种状态栏样式：

| 样式 | 效果 | 适用场景 |
|------|------|---------|
| `default` | 白色背景 + 黑色文字 | 浅色主题 |
| `black` | 黑色背景 + 白色文字 | 深色主题 |
| `black-translucent` | 黑色半透明 + 白色文字 | ❌ 已废弃，不推荐 |

### 2. 实现方案

#### 方案 A: 静态配置（简单但不完美）

在 `index.html` 中设置：

```html
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

**优点**: 简单  
**缺点**: 只适配浅色模式，深色模式下状态栏仍是白色

#### 方案 B: 动态配置（推荐，已实现）

使用 React Hook 动态更新状态栏样式：

```javascript
// hooks/useAdaptiveStatusBar.js
export const useAdaptiveStatusBar = (darkMode) => {
    useEffect(() => {
        const statusBarMeta = document.querySelector(
            'meta[name="apple-mobile-web-app-status-bar-style"]'
        );
        
        // 深色模式用 black，浅色模式用 default
        const style = darkMode ? 'black' : 'default';
        statusBarMeta.setAttribute('content', style);
    }, [darkMode]);
};
```

**优点**: 完美适配深色/浅色模式  
**缺点**: 需要 JavaScript 支持

## 已实现的功能

### 1. 自动检测系统主题

```javascript
// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateThemeColor);
```

### 2. 动态更新状态栏

```javascript
// App.jsx 中使用
useAdaptiveStatusBar(computedDarkMode);
```

### 3. 同步更新 theme-color

```javascript
// 同时更新 Android 的主题颜色
const color = darkMode ? '#0f172a' : '#ffffff';
themeColorMeta.setAttribute('content', color);
```

## 效果对比

### 修改前
- ❌ 状态栏始终黑色半透明
- ❌ 浅色模式下状态栏看起来突兀
- ❌ 不随主题切换

### 修改后
- ✅ 浅色模式：白色状态栏 + 黑色文字
- ✅ 深色模式：黑色状态栏 + 白色文字
- ✅ 自动跟随系统主题
- ✅ 手动切换主题立即生效

## 与 Android 的对比

| 特性 | Android | iPhone (修改后) |
|------|---------|----------------|
| 自动适配 | ✅ 原生支持 | ✅ 通过 JS 实现 |
| 深色模式 | ✅ 自动 | ✅ 动态更新 |
| 浅色模式 | ✅ 自动 | ✅ 动态更新 |
| 系统主题跟随 | ✅ | ✅ |
| 手动切换响应 | ✅ | ✅ |

现在 iPhone 和 Android 的行为完全一致！

## 测试方法

### 1. iPhone 实机测试

1. 安装 PWA 到主屏幕
2. 从主屏幕打开应用
3. 切换深色/浅色模式
4. 观察状态栏是否跟随变化

### 2. Safari 模拟器测试

1. 打开 Safari 开发者工具
2. 选择 iPhone 设备
3. 切换系统主题（深色/浅色）
4. 观察状态栏变化

### 3. 验证要点

- ✅ 浅色模式：状态栏白色，文字黑色
- ✅ 深色模式：状态栏黑色，文字白色
- ✅ 切换主题时立即更新
- ✅ 状态栏与应用背景色协调

## 技术细节

### Meta 标签更新时机

```javascript
useEffect(() => {
    // 立即更新
    updateStatusBar();
    
    // 延迟更新（确保 DOM 就绪）
    setTimeout(() => {
        updateStatusBar();
    }, 100);
}, [darkMode]);
```

### 为什么需要延迟更新？

- iOS Safari 有时需要一点时间来识别 meta 标签变化
- 100ms 的延迟确保更新生效
- 不影响用户体验

### 兼容性处理

```javascript
// 创建 meta 标签（如果不存在）
if (!statusBarMeta) {
    statusBarMeta = document.createElement('meta');
    statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(statusBarMeta);
}
```

## 常见问题

### Q: 为什么不用 `black-translucent`？

A: 
- ❌ 已废弃，Apple 不推荐使用
- ❌ 半透明效果在现代 iOS 上表现不一致
- ❌ 无法适配浅色模式

### Q: 状态栏更新有延迟怎么办？

A: 
- 这是 iOS 的限制，meta 标签更新需要时间
- 已添加 100ms 延迟确保更新生效
- 可以增加延迟时间（不推荐超过 200ms）

### Q: 为什么要同时更新 theme-color？

A: 
- `theme-color` 影响 Android 和桌面浏览器
- `apple-mobile-web-app-status-bar-style` 只影响 iOS
- 两者配合实现全平台一致性

### Q: 能否让状态栏完全透明？

A: 
- iOS 不支持完全透明的状态栏
- `black-translucent` 是最接近的选项，但已废弃
- 推荐使用 `default` 或 `black` 匹配背景色

## 最佳实践

### 1. 优先使用 `default` 和 `black`

```javascript
const style = darkMode ? 'black' : 'default';
```

### 2. 同步更新所有相关 meta 标签

```javascript
updateThemeColor();      // Android
updateIOSStatusBar();    // iOS
```

### 3. 监听主题变化

```javascript
useEffect(() => {
    updateStatusBar();
}, [darkMode, themeMode]);
```

### 4. 提供降级方案

```javascript
// 如果 meta 标签不存在，创建它
if (!statusBarMeta) {
    statusBarMeta = document.createElement('meta');
    // ...
}
```

## 参考资源

- [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [MDN: apple-mobile-web-app-status-bar-style](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#apple-mobile-web-app-status-bar-style)
- [Web.dev: Adaptive icon](https://web.dev/adaptive-icon/)

---

**现在 iPhone 的状态栏已经像 Android 一样自适应了！** 🎉
