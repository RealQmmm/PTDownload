# NAS Docker 图形化界面部署指南

## 适用场景

本指南适用于通过 NAS 的 Docker 图形化界面（如群晖 Container Manager、威联通 Container Station）部署 PTDownload 的用户。

## 🎯 核心配置

使用外部数据库只需配置一个关键的**卷映射**：

```
宿主机路径 → 容器内路径
/share/Container/PTdownload → /external_db
```

系统会自动检测 `/external_db` 目录，如果存在则使用外部数据库，否则使用内置数据库。

## 📝 群晖 NAS (Synology) 配置步骤

### 步骤 1：准备工作

1. 打开 **File Station**
2. 创建共享文件夹用于存储数据库：
   ```
   /docker/ptdownload-db
   ```
   或使用您已有的路径：
   ```
   /Container/PTdownload
   ```

### 步骤 2：上传/拉取 Docker 镜像

#### 方法 A：从 Docker Hub 拉取
1. 打开 **Container Manager**（或 Docker 套件）
2. 进入 **注册表** (Registry)
3. 搜索 `realqmmm/pt-download`
4. 下载最新版本

#### 方法 B：上传本地镜像
1. 在本地构建镜像：
   ```bash
   docker build -t pt-download:latest .
   docker save pt-download:latest -o pt-download.tar
   ```
2. 将 `pt-download.tar` 上传到 NAS
3. 在 Container Manager 中导入镜像

### 步骤 3：创建容器

1. 在 **Container Manager** 中，点击 **映像** → 选择 `pt-download` → 点击 **启动**

2. **常规设置**
   - 容器名称：`pt-app` 或 `ptdownload`
   - 启用自动重新启动：✅ 勾选

3. **端口设置**
   ```
   本地端口    容器端口    类型
   3000   →   3000       TCP
   ```
   
   > 💡 如果 3000 端口被占用，可以改为其他端口，如 3001

4. **卷（Volume）设置** ⭐ **重点配置**

   添加两个文件夹映射：

   **映射 1：内置数据目录（必需）**
   ```
   文件/文件夹：/docker/ptdownload-data
   装载路径：/data
   ```

   **映射 2：外部数据库目录（可选，推荐）**
   ```
   文件/文件夹：/docker/ptdownload-db
   装载路径：/external_db
   ```
   
   或者使用您的路径：
   ```
   文件/文件夹：/Container/PTdownload
   装载路径：/external_db
   ```

   > ⚠️ **关键点**：
   > - 如果配置了 `/external_db` 映射 → 自动使用外部数据库
   > - 如果不配置 `/external_db` 映射 → 自动使用内置数据库
   > - 容器内路径 `/external_db` 必须准确，不要改

5. **环境变量设置**（可选）

   基础配置（推荐设置）：
   ```
   变量名          值
   PORT           3000
   TZ             Asia/Shanghai
   ```

   > 💡 **无需设置** `USE_EXTERNAL_DB` 或 `EXTERNAL_DB_PATH`，系统会自动检测！

6. 点击 **完成** 启动容器

### 步骤 4：验证配置

1. 在 Container Manager 中查看容器日志：
   - 选择容器 → 点击 **详情** → 切换到 **日志** 标签
   - 查找包含 `[Database]` 的日志行

2. **使用外部数据库时**，应该看到：
   ```
   [Database] External directory detected at: /external_db
   [Database] Using EXTERNAL database at: /external_db/ptdownload.db
   ```

3. **使用内置数据库时**，应该看到：
   ```
   [Database] External directory not found, using INTERNAL database
   [Database] Using INTERNAL database at: /data/ptdownload.db
   ```

4. 访问应用：
   ```
   http://NAS的IP:3000
   ```

5. 登录后，进入 **设置** → **常规设置** → **数据库配置**
   - 查看当前数据库模式标签
   - 🟢 绿色"外部" = 使用外部数据库
   - 🔵 蓝色"内置" = 使用内置数据库

## 📝 威联通 NAS (QNAP) 配置步骤

### 步骤 1：准备工作

1. 打开 **File Station**
2. 创建共享文件夹：
   ```
   /share/Container/ptdownload-db
   ```

### 步骤 2：Container Station 配置

1. 打开 **Container Station**
2. 点击 **创建容器**

3. **映像**
   - 选择或搜索 `realqmmm/pt-download`

4. **名称**
   - 容器名称：`pt-app`

5. **网络**
   - 网络模式：Bridge
   - 端口转发：
     ```
     主机端口: 3000 → 容器端口: 3000
     ```

6. **共享文件夹** ⭐ **重点配置**

   添加两个挂载点：

   **挂载点 1：内置数据（必需）**
   ```
   主机路径：/share/Container/ptdownload-data
   挂载点：/data
   ```

   **挂载点 2：外部数据库（可选，推荐）**
   ```
   主机路径：/share/Container/ptdownload-db
   挂载点：/external_db
   ```

7. **环境变量**（可选）
   ```
   PORT=3000
   TZ=Asia/Shanghai
   ```

8. 点击 **创建** 启动容器

### 步骤 3：验证

查看容器日志，确认数据库路径。

## 🔄 配置对比

### 使用内置数据库

**卷映射：**
```
/docker/ptdownload-data → /data
```

**数据库位置：**
```
/docker/ptdownload-data/ptdownload.db
```

### 使用外部数据库（推荐）

**卷映射：**
```
/docker/ptdownload-data → /data
/docker/ptdownload-db → /external_db  ← 添加这个
```

**数据库位置：**
```
/docker/ptdownload-db/ptdownload.db
```

## 💡 常见问题

### Q1: 如何切换到外部数据库？

**答：** 
1. 停止容器
2. 编辑容器设置
3. 添加卷映射：`/your/path → /external_db`
4. 启动容器

### Q2: 已有数据如何迁移？

**答：**
1. 在应用中导出数据库：**设置** → **系统设置** → **备份与恢复** → **导出数据库文件**
2. 将下载的 `.db` 文件上传到 NAS 的外部数据库目录
3. 重命名为 `ptdownload.db`
4. 重启容器

### Q3: 如何确认使用的是哪个数据库？

**答：**
1. 查看容器日志中的 `[Database]` 行
2. 或在 Web UI 中查看：**设置** → **常规设置** → **数据库配置**

### Q4: 端口 3000 被占用怎么办？

**答：**
修改端口映射为其他端口，例如：
```
本地端口: 3001 → 容器端口: 3000
```
然后访问 `http://NAS的IP:3001`

### Q5: 权限问题怎么解决？

**答：**
在 NAS 的 File Station 中：
1. 右键点击数据库目录
2. 选择 **属性** → **权限**
3. 确保有读写权限

## 📋 配置检查清单

部署前检查：
- [ ] 已创建数据存储目录
- [ ] 已上传或拉取 Docker 镜像
- [ ] 已配置端口映射（3000:3000）
- [ ] 已配置内置数据卷（/data）
- [ ] （可选）已配置外部数据库卷（/external_db）
- [ ] 已设置时区环境变量（TZ）

部署后验证：
- [ ] 容器正常运行
- [ ] 可以访问 Web 界面
- [ ] 日志显示正确的数据库路径
- [ ] 可以正常登录和使用

## 🎯 推荐配置（群晖示例）

```
容器名称: pt-app
自动重启: ✅

端口设置:
  3000 → 3000 (TCP)

卷设置:
  /docker/ptdownload-data → /data
  /Container/PTdownload → /external_db  ← 您的路径

环境变量:
  PORT=3000
  TZ=Asia/Shanghai
```

## 📸 配置截图说明

### 群晖 Container Manager

1. **卷设置界面**
   ```
   [添加文件夹]
   文件/文件夹: [浏览] → 选择 /Container/PTdownload
   装载路径: /external_db
   [确定]
   ```

2. **环境变量界面**
   ```
   [+] 添加
   变量: PORT
   值: 3000
   
   [+] 添加
   变量: TZ
   值: Asia/Shanghai
   ```

## 🚀 快速开始

**最简配置（使用外部数据库）：**

1. 创建目录：`/Container/PTdownload`
2. 上传镜像并创建容器
3. 配置卷映射：
   - `/docker/ptdownload-data` → `/data`
   - `/Container/PTdownload` → `/external_db`
4. 配置端口：`3000:3000`
5. 启动容器
6. 访问 `http://NAS的IP:3000`

就这么简单！🎉
