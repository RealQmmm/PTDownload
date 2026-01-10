# 数据库配置 - 超简单版

## 🎯 核心理念

**只需配置 volume 映射，系统自动检测！**

- ✅ 配置了 `/external_db` 映射 → 自动使用外部数据库
- ✅ 没有配置映射 → 自动使用内置数据库
- ✅ 无需设置任何环境变量！

## 📝 使用方法

### 方式一：使用内置数据库（默认）

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - ./data:/data
    # 不配置 /external_db 映射，自动使用内置数据库
```

**就这么简单！** 启动后数据库在 `./data/ptdownload.db`

### 方式二：使用外部数据库

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - ./data:/data
      - /share/Container/PTdownload:/external_db  # 添加这一行即可！
```

**就这么简单！** 启动后数据库在 `/share/Container/PTdownload/ptdownload.db`

## 🚀 快速开始

### 场景 1：全新部署（使用 NAS）

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pt-app
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - /share/Container/PTdownload:/external_db  # 你的 NAS 路径
    environment:
      - PORT=3000
      - TZ=Asia/Shanghai
    restart: unless-stopped
```

```bash
# 启动
docker-compose up -d

# 查看日志确认
docker logs pt-app | grep Database
# 应该看到：[Database] Using EXTERNAL database
```

### 场景 2：从内置迁移到外部

```bash
# 1. 停止容器
docker-compose down

# 2. 复制数据库到外部路径
mkdir -p /share/Container/PTdownload
cp ./data/ptdownload.db /share/Container/PTdownload/

# 3. 修改 docker-compose.yml，添加 volume 映射
# volumes:
#   - /share/Container/PTdownload:/external_db

# 4. 启动
docker-compose up -d
```

### 场景 3：从外部切换回内置

```bash
# 1. 停止容器
docker-compose down

# 2. 复制数据库回内置路径（可选）
cp /share/Container/PTdownload/ptdownload.db ./data/

# 3. 修改 docker-compose.yml，注释掉外部映射
# volumes:
#   - ./data:/data
#   # - /share/Container/PTdownload:/external_db  # 注释掉

# 4. 启动
docker-compose up -d
```

## 🔍 如何验证

### 方法 1：查看日志

```bash
docker logs pt-app | grep Database
```

**内置数据库：**
```
[Database] External directory not found, using INTERNAL database
[Database] Using INTERNAL database at: /data/ptdownload.db
```

**外部数据库：**
```
[Database] External directory detected at: /external_db
[Database] Using EXTERNAL database at: /external_db/ptdownload.db
```

### 方法 2：Web UI

1. 登录系统
2. 进入 **设置** → **常规设置**
3. 查看 **数据库配置** 部分
4. 查看标签颜色：
   - 🔵 蓝色"内置" = 使用内置数据库
   - 🟢 绿色"外部" = 使用外部数据库

## 📋 常见路径示例

```yaml
# NAS (群晖)
- /share/Container/PTdownload:/external_db

# NAS (威联通)
- /share/CACHEDEV1_DATA/Container/PTdownload:/external_db

# Linux 本地目录
- /home/user/ptdownload-db:/external_db

# 相对路径（不推荐）
- ../ptdownload-db:/external_db
```

## ⚠️ 注意事项

1. **路径必须存在**：确保宿主机路径已创建
   ```bash
   mkdir -p /share/Container/PTdownload
   ```

2. **权限正确**：确保 Docker 有读写权限
   ```bash
   chmod 755 /share/Container/PTdownload
   ```

3. **重启生效**：修改配置后需要重启容器
   ```bash
   docker-compose restart
   ```

## 💡 优势对比

| 特性 | 旧方案 | 新方案 |
|------|--------|--------|
| 配置复杂度 | 需要设置环境变量 | 只需配置 volume |
| 环境变量 | USE_EXTERNAL_DB<br/>EXTERNAL_DB_PATH | 无需设置 |
| 切换方式 | 修改环境变量 + volume | 只修改 volume |
| 自动检测 | ❌ | ✅ |
| 用户友好度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 🎉 总结

**一句话总结：**
> 想用外部数据库？加一行 volume 映射就行了！

**配置前：**
```yaml
volumes:
  - ./data:/data
```

**配置后：**
```yaml
volumes:
  - ./data:/data
  - /your/path:/external_db  # 就这一行！
```

就是这么简单！🚀
