# PT Download Manager (PT下载管理助手)

这是一个现代化、轻量级且强大的 PT (Private Tracker) 资源聚合管理工具。它通过统一的界面为您提供多站点的资源搜索、RSS 订阅、自动化下载以及实时流量统计，旨在成为您的私人 PT 管家。

## ✨ 主要功能

*   **📊 综合仪表盘**: 
    - **实时监控**：直观展示下载/上传速度、活动任务进度。
    - **流量统计**：基于差值计算的精准今日流量统计，支持最近 7 天流量趋势图。
    - **智能同步**：采用服务端缓存与接口聚合技术，实现毫秒级的数据响应体验。
*   **🔍 智能聚合搜索**:
    - **全站搜索**：一键横跨多个 PT 站点搜索排版优美的资源列表。
    - **近期资源发现**：特有的“近期资源”模式，无需关键词即可发现全站最新发布的种子。
    - **精准日期解析**：内置智能解析器，支持绝对日期、相对日期（如：2 小时前）以及复杂的“存活时间”计算。
*   **📡 自动化 RSS 订阅**:
    - **灵活订阅**：管理多个 RSS 源，支持自定义执行周期（Cron）。
    - **精细化过滤器**：支持关键词包含/排除、文件大小范围限制。
    - **自动化流水线**：匹配成功的资源将自动推送到下载客户端并发送通知。
*   **⚙️ 客户端与站点管理**:
    - **多客户端支持**：深度集成 qBittorrent 和 Transmission。
    - **站点适配**：完美适配 NexusPHP 架构站点，支持 Cookie 认证。
*   **🔔 消息通知**:
    - 支持 **Bark** 和 **自定义 Webhook**，让您随时随地掌握下载动态。
*   **🌓 极致视觉体验**:
    - **现代化 UI**：极速、流畅的响应式界面，支持浅色、深色及系统跟随模式。
    - **移动端适配**：针对手机端进行了专门的排版优化。

## 🛠️ 技术栈

### 前端 (Client)
*   **React 18** + **Vite** (构建速度极快)
*   **Vanilla CSS** (精雕细琢的现代美学设计)
*   **Lucide React** (高质图标库)

### 后端 (Server)
*   **Node.js** + **Express**
*   **SQLite (Better-SQLite3)** (轻量高性能)
*   **Cheerio** (强大的 HTML 解析能力)
*   **Node-Schedule** (精准任务定时)

### 部署与性能
*   **Docker & Docker Compose** (一键式多阶段构建)
*   **智能缓存层**：减少下载器 API 负担，提升页面加载速度。

## 🚀 快速开始 (使用 Docker)

### 前置要求
*   安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。

### 部署步骤

1.  **准备环境**
    ```bash
    mkdir -p PTDownload/data
    cd PTDownload
    ```

2.  **创建 docker-compose.yml**
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
        restart: unless-stopped
    ```

3.  **启动服务**
    ```bash
    docker-compose up -d
    ```

4.  **访问应用**
    打开浏览器访问 `http://localhost:3000`。默认端口为 3000。

## � 环境变量

| 变量名 | 默认值 | 描述 |
| ------ | ------ | ---- |
| PORT | 3000 | 服务运行端口 |
| DB_PATH | /data/ptdownload.db | SQLite 数据库持久化路径 |

## 📦 目录结构
```
PTDownload/
├── client/                 # 前端代码 (React)
├── server/                 # 后端代码 (Node.js)
├── data/                   # 数据库持久化目录
├── Dockerfile              # 多阶段镜像构建配置
└── docker-compose.yml      # 容器编排配置
```

## 🤝 贡献
如果您在使用过程中发现任何问题，欢迎提交 Issue 或 Pull Request。

## 📄 许可证
[MIT License](LICENSE)
