# 从内置数据库迁移到外部数据库指南

## 📋 迁移场景

如果您已经在使用 PTDownload，并且想要将现有的内置数据库迁移到外部存储，请按照以下步骤操作。

## 🎯 迁移步骤

### 方法一：手动迁移（推荐）

#### 1. 停止容器
```bash
cd /path/to/PTDownload
docker-compose down
```

#### 2. 准备外部数据库目录
```bash
# 创建外部数据库存储目录
mkdir -p /path/to/your/external/database

# 示例：使用 NAS
# mkdir -p /mnt/nas/ptdownload/db

# 示例：使用本地目录
# mkdir -p /home/user/ptdb
```

#### 3. 复制现有数据库到外部目录
```bash
# 复制数据库文件
cp ./data/ptdownload.db /path/to/your/external/database/

# 验证文件是否复制成功
ls -lh /path/to/your/external/database/ptdownload.db
```

#### 4. 修改 docker-compose.yml

编辑 `docker-compose.yml` 文件：

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pt-app
    ports:
      - "3000:3000"
    volumes:
      # 内置数据目录（保留用于其他数据）
      - ./data:/data
      # 外部数据库挂载 - 修改为你的实际路径
      - /path/to/your/external/database:/external_db
    environment:
      - PORT=3000
      - TZ=Asia/Shanghai
      # 数据库配置 - 启用外部数据库
      - USE_EXTERNAL_DB=true
      - EXTERNAL_DB_PATH=/external_db/ptdownload.db
    restart: unless-stopped
```

#### 5. 启动容器
```bash
docker-compose up -d
```

#### 6. 验证迁移成功
```bash
# 查看日志，确认使用外部数据库
docker logs pt-app | grep Database

# 应该看到：
# [Database] Using EXTERNAL database at: /external_db/ptdownload.db
```

#### 7. 访问应用验证数据
打开浏览器访问 `http://localhost:3000`，检查：
- ✅ 站点配置是否完整
- ✅ RSS 任务是否存在
- ✅ 历史记录是否保留
- ✅ 系统设置是否正常

#### 8. （可选）清理旧数据库
确认一切正常后，可以删除内置数据库：
```bash
# 备份一份以防万一
cp ./data/ptdownload.db ./data/ptdownload.db.backup

# 删除旧数据库（可选）
# rm ./data/ptdownload.db
```

---

### 方法二：使用迁移脚本（自动化）

我为您创建了一个自动化迁移脚本：

#### 1. 下载并运行迁移脚本
```bash
cd /path/to/PTDownload

# 运行迁移脚本
chmod +x migrate-to-external-db.sh
./migrate-to-external-db.sh /path/to/your/external/database
```

脚本会自动：
- ✅ 停止容器
- ✅ 创建外部目录
- ✅ 复制数据库文件
- ✅ 备份原 docker-compose.yml
- ✅ 更新配置
- ✅ 重启容器
- ✅ 验证迁移结果

---

## 📝 具体示例

### 示例 1：迁移到本地目录

```bash
# 1. 停止容器
docker-compose down

# 2. 创建外部目录
mkdir -p /home/user/ptdb

# 3. 复制数据库
cp ./data/ptdownload.db /home/user/ptdb/

# 4. 修改 docker-compose.yml
# volumes:
#   - /home/user/ptdb:/external_db
# environment:
#   - USE_EXTERNAL_DB=true

# 5. 启动
docker-compose up -d

# 6. 验证
docker logs pt-app | grep Database
```

### 示例 2：迁移到 NAS

```bash
# 1. 确保 NAS 已挂载
ls /mnt/nas

# 2. 停止容器
docker-compose down

# 3. 创建 NAS 目录
mkdir -p /mnt/nas/ptdownload/db

# 4. 复制数据库
cp ./data/ptdownload.db /mnt/nas/ptdownload/db/

# 5. 修改 docker-compose.yml
# volumes:
#   - /mnt/nas/ptdownload/db:/external_db
# environment:
#   - USE_EXTERNAL_DB=true

# 6. 启动
docker-compose up -d

# 7. 验证
docker logs pt-app | grep Database
```

---

## ⚠️ 注意事项

### 1. 权限问题
确保外部目录有正确的读写权限：
```bash
# 设置权限
chmod -R 755 /path/to/your/external/database

# 如果是 NAS，可能需要：
chown -R 1000:1000 /path/to/your/external/database
```

### 2. 路径映射
- **宿主机路径**：`/path/to/your/external/database`（你的实际路径）
- **容器内路径**：`/external_db`（固定，不要改）
- **数据库文件**：`ptdownload.db`（文件名固定）

### 3. 数据完整性
迁移前建议：
```bash
# 备份当前数据库
cp ./data/ptdownload.db ./data/ptdownload.db.backup.$(date +%Y%m%d)

# 验证文件大小
ls -lh ./data/ptdownload.db
```

### 4. 回滚方案
如果迁移后出现问题，可以快速回滚：
```bash
# 1. 停止容器
docker-compose down

# 2. 恢复原配置
# 将 USE_EXTERNAL_DB 改回 false

# 3. 启动容器
docker-compose up -d
```

---

## 🔍 故障排查

### 问题 1：容器启动失败
```bash
# 查看详细日志
docker logs pt-app

# 常见原因：
# - 外部目录不存在
# - 权限不足
# - 路径配置错误
```

### 问题 2：数据丢失
```bash
# 检查数据库文件是否存在
docker exec pt-app ls -lh /external_db/ptdownload.db

# 如果文件不存在，检查 volume 挂载
docker inspect pt-app | grep Mounts -A 20
```

### 问题 3：无法写入数据库
```bash
# 检查容器内权限
docker exec pt-app ls -lh /external_db/

# 修复权限
chmod 666 /path/to/your/external/database/ptdownload.db
```

---

## ✅ 迁移检查清单

- [ ] 已停止容器
- [ ] 已创建外部目录
- [ ] 已复制数据库文件
- [ ] 已验证文件完整性（大小、md5）
- [ ] 已修改 docker-compose.yml
- [ ] 已设置正确的路径
- [ ] 已启用 USE_EXTERNAL_DB=true
- [ ] 已重启容器
- [ ] 日志显示使用外部数据库
- [ ] 应用可以正常访问
- [ ] 数据完整（站点、任务、历史）
- [ ] 已备份原数据库

---

## 🎉 迁移成功后的优势

迁移到外部数据库后，您将享受到：

1. **无缝迁移**：更新镜像时无需备份导入
2. **数据安全**：数据独立于容器
3. **灵活部署**：可以轻松迁移到其他服务器
4. **NAS 支持**：数据存储在 NAS 上更安全

---

## 📚 相关文档

- [数据库外部挂载详细指南](database-external-mount.md)
- [快速参考](database-quick-reference.md)
- [配置示例](../docker-compose.external-db.yml)
