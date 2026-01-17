# PT Download Manager (PT 下载管理助手)

这是一个现代化、高性能且全自动化的 PT (Private Tracker) 资源管理助手。它不仅仅是一个搜索工具，更是您的私人 PT 资产管家，提供从**资源发现、智能评分、精密订阅、全速下载到流量统计**的全生命周期管理功能。

---

## ✨ 核心特性

### 1. 📊 智能仪表盘 (Precision Monitoring)
- **实时流动统计**：基于服务端增量计算，精准捕捉每一位流量的起伏，支持 7x24 小时流量趋势分析。
- **全量种子监控**：自动发现并管理手动添加、RSS 订阅或外部注入（如直接在 qB 添加）的所有种子。
- **状态感知**：实时监控各站点 Cookie 状态、上传下载总量及分享率。

### 2. � 热门资源探测 (TDI 2.0 Scoring Engine)
- **多维度评分**：基于做种人数、下载人数及发布时间，采用 **TDI 2.0 (Transmission Difficulty Index)** 算法评估资源上传潜力。
- **自动捡漏**：自动识别“绝佳机会”与“安全理财”资源，支持发现即通知或自动推送到下载器。
- **可视化评分**：搜索结果实时显示热度评分，通过色块区分风险等级。

### 3. 📡 智能 RSS 订阅 (Smart Subscription)
- **精密剧集追踪**：内置 `EpisodeTracker`，通过跨任务、跨站点的历史数据比对，智能识别更新，杜绝重复下载。
- **灵活过滤体系**：支持关键词正则表达式、文件大小限制，配合自定义执行周期。
- **下载协调逻辑**：`DownloadCoordinator` 确保下载指令下发成功，失败自动执行回滚逻辑维护数据一致性。

### 4. 🔍 聚合搜索与促销感知
- **跨站一键搜索**：统一展示多个 NexuPHP 站点的搜索结果，排版整洁一致。
- **促销信息透传**：实时识别并标记“免费 (Free)”、“2X免费”、“50%”等站点促销状态。
- **精密日期解析**：精准识别发布日期与存活时间（TTL），即使是“2 小时前”这种相对日期也能准确转化为绝对时间统计。

### 5. ⚙️ 企业级管理体验
- **多用户架构**：支持用户增删改查及权限控制（管理员/普通用户）。
- **极简部署**：深度优化 Docker 镜像，支持自动挂载外部数据库。
- **安全保障**：支持强密码策略，提供 JSON 配置与原生 SQLite 数据库双重备份机制。


---

## 🛠️ 技术栈

### 核心架构
- **前端**: React 18 + Vite + Vanilla CSS
- **后端**: Node.js 18 + Express
- **存储**: SQLite (better-sqlite3) + 自动持久化映射

### 关键库
- **解析**: Cheerio (HTML), Axios (HTTP)
- **调度**: Node-Schedule (定时规则)
- **安全**: JWT (身份验证), Crypto (密码加密)
- **UI**: Lucide React (图标), Modern CSS Grid/Flexbox

---

## 📦 项目结构

```
PTDownload/
├── client/                 # 现代化前端界面
│   ├── src/pages/          # 页面组件
│   │   ├── settings/       # 模块化设置组件 (新)
│   │   └── SearchPage.jsx  # 聚合搜索核心
│   └── ...
├── server/                 # 高性能后端服务
│   ├── src/services/       # 业务逻辑层
│   │   ├── rss/            # RSS 核心逻辑 (EpisodeTracker, DownloadCoordinator)
│   │   └── ...
│   ├── src/routes/         # 聚合 API 路由
│   └── src/db/             # 数据库层 (优化的索引结构)
├── data/                   # 持久化数据
├── Dockerfile              # 多阶段构建
└── docker-compose.yml      # 一键编排
```

---

## � 快速部署

### 1. 环境准备
确保已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。

### 2. 一键启动
创建 `docker-compose.yml`:
```yaml
version: '3.8'
services:
  pt-manager:
    image: realqmmm/pt-download:latest
    container_name: pt-app
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      # 推荐：挂载外部数据库路径实现无缝升级
      # - /path/to/db:/external_db
    environment:
      - TZ=Asia/Shanghai
    restart: unless-stopped
```

执行启动：
```bash
docker-compose up -d
```
访问 `http://localhost:3000` 即可开始您的 PT 管理之旅。

---

## 📂 数据库存储模式

系统提供**自动数据库检测**机制，适配不同存储习惯：

- **模式 A (简单型)**：仅挂载 `/data` 卷。数据存储在 `./data/ptdownload.db`。
- **模式 B (专业型)**：额外挂载宿主机目录到 `/external_db`。系统将自动检测并切换到该路径，**升级容器无需导出导入设置**。

> 💡 **建议**：强烈推荐使用模式 B，配合 NAS 的外部存储，让您的数据更安全且迁移更无忧。

---

## 🤝 参与贡献
欢迎提交 Issue 报告 Bug，或发起 Pull Request 贡献代码。

## 📄 许可证
本项目采用 [MIT License](LICENSE) 许可。
