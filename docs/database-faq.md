# 数据库配置常见问题 (FAQ)

## 🤔 通用问题

### Q1: 我应该选择内置数据库还是外部数据库？

**答：** 取决于您的使用场景：

- **选择内置数据库**：如果您只是想快速测试或单机使用，不需要频繁迁移
- **选择外部数据库**：如果您需要频繁更新镜像、迁移服务器，或使用 NAS 存储

### Q2: 外部数据库真的能避免备份导入吗？

**答：** 是的！使用外部数据库后：
- ✅ 更新镜像时，只需 `docker-compose pull && docker-compose up -d`
- ✅ 迁移服务器时，只需复制数据库文件和 docker-compose.yml
- ✅ 数据与容器完全分离，不会因为容器删除而丢失

### Q3: 我已经在使用内置数据库，如何迁移到外部？

**答：** 非常简单！使用我们提供的自动化脚本：

```bash
./migrate-to-external-db.sh /path/to/your/external/database
```

或者查看 [详细迁移指南](migrate-to-external-db.md)

---

## 🔧 配置问题

### Q4: 外部数据库路径应该填什么？

**答：** 分为两个部分：

1. **宿主机路径**（在 volumes 中）：您实际存储数据库的位置
   ```yaml
   volumes:
     - /home/user/ptdb:/external_db  # 左边是宿主机路径
   ```

2. **容器内路径**（在 environment 中）：固定为 `/external_db/ptdownload.db`
   ```yaml
   environment:
     - EXTERNAL_DB_PATH=/external_db/ptdownload.db  # 容器内路径，不要改
   ```

### Q5: 可以使用相对路径吗？

**答：** 可以，但不推荐。建议使用绝对路径以避免混淆：

```yaml
# ✅ 推荐：使用绝对路径
volumes:
  - /home/user/ptdb:/external_db

# ⚠️ 可以但不推荐：相对路径
volumes:
  - ../ptdb:/external_db
```

### Q6: NAS 路径应该怎么配置？

**答：** 确保 NAS 已正确挂载到宿主机，然后使用挂载点路径：

```yaml
# 假设 NAS 挂载在 /mnt/nas
volumes:
  - /mnt/nas/ptdownload/db:/external_db

environment:
  - USE_EXTERNAL_DB=true
  - EXTERNAL_DB_PATH=/external_db/ptdownload.db
```

---

## 🐛 故障排查

### Q7: 启动容器后提示数据库文件不存在？

**答：** 检查以下几点：

1. **确认 volume 挂载正确**：
   ```bash
   docker inspect pt-app | grep Mounts -A 20
   ```

2. **检查宿主机目录是否存在**：
   ```bash
   ls -la /path/to/your/external/database
   ```

3. **如果是首次使用外部数据库**，系统会自动创建，这是正常的

### Q8: 提示权限不足？

**答：** 设置正确的权限：

```bash
# 方法 1: 设置目录权限
chmod -R 755 /path/to/your/external/database

# 方法 2: 如果是 NAS，可能需要设置所有者
chown -R 1000:1000 /path/to/your/external/database

# 方法 3: 设置数据库文件权限
chmod 666 /path/to/your/external/database/ptdownload.db
```

### Q9: 日志显示使用的是内置数据库，但我配置了外部数据库？

**答：** 检查以下配置：

1. **确认 USE_EXTERNAL_DB 设置为 true**：
   ```bash
   docker-compose config | grep USE_EXTERNAL_DB
   ```

2. **重启容器**：
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **查看日志验证**：
   ```bash
   docker logs pt-app | grep Database
   ```

### Q10: 迁移后数据丢失了？

**答：** 不要慌，数据可能还在：

1. **检查原数据库是否还在**：
   ```bash
   ls -lh ./data/ptdownload.db
   ```

2. **检查外部数据库文件**：
   ```bash
   ls -lh /path/to/your/external/database/ptdownload.db
   ```

3. **如果文件存在但应用看不到**，检查 volume 挂载：
   ```bash
   docker exec pt-app ls -lh /external_db/
   ```

4. **回滚到内置数据库**：
   ```bash
   docker-compose down
   # 修改 docker-compose.yml，设置 USE_EXTERNAL_DB=false
   docker-compose up -d
   ```

---

## 🔄 迁移问题

### Q11: 迁移脚本执行失败怎么办？

**答：** 手动执行迁移步骤：

1. 停止容器：`docker-compose down`
2. 创建外部目录：`mkdir -p /path/to/external/db`
3. 复制数据库：`cp ./data/ptdownload.db /path/to/external/db/`
4. 修改 docker-compose.yml
5. 启动容器：`docker-compose up -d`

详见 [迁移指南](migrate-to-external-db.md)

### Q12: 迁移后如何验证数据完整性？

**答：** 检查以下内容：

1. **访问应用**：`http://localhost:3000`
2. **检查站点配置**：所有站点是否都在
3. **检查 RSS 任务**：任务列表是否完整
4. **检查历史记录**：下载历史是否保留
5. **检查系统设置**：各项设置是否正常

### Q13: 可以在不停止容器的情况下迁移吗？

**答：** 不建议。迁移过程中必须停止容器，以确保：
- 数据库文件不会被锁定
- 避免数据写入冲突
- 确保数据完整性

---

## 🚀 性能问题

### Q14: 外部数据库会影响性能吗？

**答：** 几乎没有影响：

- **本地磁盘**：性能与内置数据库相同
- **NAS（千兆网络）**：可能有轻微延迟（<10ms），但对应用影响很小
- **NAS（万兆网络）**：几乎无差异

### Q15: 数据库文件会越来越大吗？

**答：** 会的，但增长速度很慢：

- **正常使用**：每月增长约 1-5MB
- **大量任务**：每月增长约 5-20MB
- **定期清理**：可以在设置中配置日志保留天数

---

## 🔐 安全问题

### Q16: 外部数据库更安全吗？

**答：** 是的，因为：

- ✅ 数据独立于容器，不会因容器删除而丢失
- ✅ 可以使用 NAS 的备份功能自动备份
- ✅ 可以设置更严格的文件权限
- ✅ 便于加密存储（如果 NAS 支持）

### Q17: 如何备份外部数据库？

**答：** 非常简单：

```bash
# 方法 1: 直接复制文件
cp /path/to/external/db/ptdownload.db /backup/ptdownload.db.$(date +%Y%m%d)

# 方法 2: 使用 rsync
rsync -av /path/to/external/db/ptdownload.db /backup/

# 方法 3: 如果使用 NAS，使用 NAS 的快照功能
```

---

## 📚 其他问题

### Q18: 可以同时运行多个 PTDownload 实例吗？

**答：** 可以，但每个实例必须使用独立的数据库：

```yaml
# 实例 1
volumes:
  - /path/to/db1:/external_db

# 实例 2
volumes:
  - /path/to/db2:/external_db
```

### Q19: 如何查看当前使用的数据库路径？

**答：** 查看容器日志：

```bash
docker logs pt-app | grep Database

# 输出示例：
# [Database] Using EXTERNAL database at: /external_db/ptdownload.db
```

### Q20: 还有其他问题？

**答：** 查看以下文档：

- [数据库外部挂载使用指南](database-external-mount.md)
- [迁移指南](migrate-to-external-db.md)
- [快速参考](database-quick-reference.md)

或者提交 Issue：[GitHub Issues](https://github.com/your-repo/issues)
