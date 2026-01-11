# PWA 功能说明

PTDownload 现已支持 PWA（Progressive Web App）功能，可以像原生应用一样安装和使用。

## ✨ 功能特性

### 📱 应用安装
- **Android/Chrome**: 自动显示安装提示，一键安装到桌面
- **iOS/Safari**: 通过分享菜单添加到主屏幕
- **桌面浏览器**: 地址栏显示安装图标

### 🚀 性能优化
- **离线缓存**: 静态资源自动缓存，加载更快
- **网络优先**: API 数据始终获取最新，失败时使用缓存
- **智能更新**: 检测到新版本时自动提示更新

### 🎯 用户体验
- **全屏显示**: 隐藏浏览器地址栏，更像原生应用
- **快捷方式**: 支持应用内快捷方式（仪表盘、搜索、追剧）
- **主题适配**: 自动适配系统深色/浅色模式

## 📲 安装指南

### Android 设备

1. 使用 Chrome 浏览器访问 PTDownload
2. 等待自动弹出安装提示
3. 点击"立即安装"按钮
4. 应用将添加到桌面

**手动安装**：
1. 点击浏览器菜单（三个点）
2. 选择"添加到主屏幕"或"安装应用"
3. 确认安装

### iOS 设备

1. 使用 Safari 浏览器访问 PTDownload
2. 点击底部分享按钮 📤
3. 滚动找到"添加到主屏幕"
4. 点击"添加"确认

### 桌面浏览器

1. 访问 PTDownload
2. 地址栏右侧会显示安装图标 ⊕
3. 点击图标并确认安装
4. 应用将添加到应用列表

## 🔧 技术要求

### 必需条件
- **HTTPS 连接**（或 localhost）
  - PWA 需要安全连接才能工作
  - 建议配置 SSL 证书（Let's Encrypt 免费）

### 浏览器支持
- ✅ Chrome/Edge 90+
- ✅ Safari 14+
- ✅ Firefox 90+
- ✅ Opera 76+

## 🛠️ 配置 HTTPS（推荐）

### 方案 1: Nginx 反向代理 + Let's Encrypt

```nginx
server {
    listen 443 ssl http2;
    server_name your-nas-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方案 2: Caddy（自动 HTTPS）

```caddy
your-nas-domain.com {
    reverse_proxy localhost:3000
}
```

### 方案 3: 内网自签名证书

如果只在内网使用，可以使用自签名证书：

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /path/to/selfsigned.key \
  -out /path/to/selfsigned.crt
```

**注意**: 自签名证书需要在设备上手动信任。

## 📊 缓存策略

### 静态资源（JS/CSS/图片）
- **策略**: 缓存优先
- **更新**: 后台自动更新
- **好处**: 极快的加载速度

### API 数据
- **策略**: 网络优先
- **降级**: 网络失败时使用缓存
- **好处**: 数据始终最新，离线可用

### HTML 页面
- **策略**: 网络优先
- **降级**: 使用缓存或首页
- **好处**: 内容最新，离线可访问

## 🔄 更新机制

### 自动检测
- Service Worker 会自动检测新版本
- 发现更新时弹出提示
- 用户确认后立即更新

### 手动清除缓存
如需清除所有缓存，打开浏览器开发者工具：

```javascript
// 在控制台执行
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
});
caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
});
```

## 🎨 自定义图标

如需更换应用图标，替换以下文件：

```
client/public/icons/
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
└── icon-512.png
```

**要求**：
- 正方形图片
- PNG 格式
- 建议使用圆角设计

## 🐛 故障排除

### 安装提示不显示
1. 确认使用 HTTPS 连接
2. 检查浏览器是否支持 PWA
3. 清除浏览器缓存后重试
4. 查看控制台是否有错误

### 离线功能不工作
1. 确认 Service Worker 已注册
2. 打开开发者工具 → Application → Service Workers
3. 检查缓存状态
4. 尝试注销并重新注册 Service Worker

### iOS 安装后图标不显示
1. 确认 `apple-touch-icon` 路径正确
2. 图标尺寸至少 192x192
3. 重新添加到主屏幕

## 📝 开发说明

### 修改 Service Worker

编辑 `client/public/service-worker.js` 后需要：

1. 更新 `CACHE_NAME` 版本号
2. 重新构建应用
3. 用户访问时会自动更新

### 修改 Manifest

编辑 `client/public/manifest.json` 可以修改：

- 应用名称和描述
- 主题颜色
- 启动 URL
- 快捷方式

## 🎯 最佳实践

1. **定期更新缓存版本**: 发布新版本时更新 Service Worker
2. **监控缓存大小**: 避免缓存过多数据
3. **测试离线功能**: 确保关键功能离线可用
4. **优化图标**: 使用压缩后的图标减少加载时间

## 📚 相关资源

- [PWA 官方文档](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

**享受 PWA 带来的原生应用体验！** 🎉
