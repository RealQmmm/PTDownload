# 安全配置指南 (Security Guide)

## 1. 基础安全加固 (Basic Hardening)

本项目已内置以下安全措施：
- **API 限流 (Rate Limiting)**: 默认 API 限制为 1000 次/15分钟。
- **登录防护**: 登录接口 (`/api/auth/login`) 限制为 **5 次/分钟**，防止暴力破解。
- **安全日志**: 失败的登录尝试会被记录到控制台日志中 (搜索 `[Security]` 关键字)。

## 2. 生产环境部署建议 (Production Deployment)

如果您将本服务暴露在公网，**强烈建议**采取以下措施：

### 2.1 启用 HTTPS (Enable HTTPS)
Node.js 服务默认运行在 HTTP 模式。请使用反向代理（如 Nginx, Caddy, Apache）来处理 HTTPS 加密。

**Nginx 示例配置**:
```nginx
server {
    listen 443 ssl;
    server_name pt.your-domain.com;

    # SSL 证书配置 ...

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.2 限制 CORS 来源 (Restrict CORS Origin)
默认情况下，API 允许所有来源跨域访问。为了防止 CSRF/XSS 攻击利用，请在环境变量中指定允许的域名。

在 `.env` 文件或 `docker-compose.yml` 中添加：
```bash
CORS_ORIGIN=https://pt.your-domain.com
```

### 2.3 修改默认账号
首次启动后，请立即修改默认的 `admin` 账号密码。

### 2.4 防止暴力破解 (Fail2Ban)
您可以配置 Fail2Ban 监控 Docker 日志，自动封禁多次尝试登录失败的 IP。
- **日志特征**: `[Security] Failed login attempt`
