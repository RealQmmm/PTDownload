# 数据库配置快速参考

## 🎯 两种模式对比

| 特性 | 内置数据库 | 外部数据库 |
|------|-----------|-----------|
| **配置难度** | ⭐ 简单 | ⭐⭐ 中等 |
| **迁移便利性** | ❌ 需要备份导入 | ✅ 直接挂载即可 |
| **数据安全性** | ⚠️ 与容器绑定 | ✅ 独立存储 |
| **适用场景** | 快速测试、单机部署 | 生产环境、频繁迁移 |
| **NAS 支持** | ❌ 不支持 | ✅ 完美支持 |

## 📝 快速配置

### 内置数据库（默认）
```yaml
# docker-compose.yml
environment:
  - USE_EXTERNAL_DB=false  # 或不设置
```

### 外部数据库
```yaml
# docker-compose.yml
volumes:
  - /your/path:/external_db  # 修改这里

environment:
  - USE_EXTERNAL_DB=true
  - EXTERNAL_DB_PATH=/external_db/ptdownload.db
```

## 🔄 常见操作

### 切换到外部数据库
```bash
# 1. 停止容器
docker-compose down

# 2. 复制数据库
mkdir -p /your/database/path
cp ./data/ptdownload.db /your/database/path/

# 3. 修改 docker-compose.yml
# 设置 USE_EXTERNAL_DB=true
# 添加 volume 挂载

# 4. 重启
docker-compose up -d
```

### 迁移到新服务器
```bash
# 使用外部数据库时，只需：
# 1. 复制数据库文件到新服务器
# 2. 使用相同的 docker-compose.yml
# 3. docker-compose up -d
```

## ⚠️ 注意事项

1. **路径权限**：确保挂载目录有读写权限
   ```bash
   chmod -R 755 /your/database/path
   ```

2. **首次使用**：外部数据库文件不存在时会自动创建

3. **验证配置**：查看日志确认数据库路径
   ```bash
   docker logs pt-app | grep Database
   ```

## 📚 更多信息

- 详细指南：[docs/database-external-mount.md](database-external-mount.md)
- 配置示例：[docker-compose.external-db.yml](../docker-compose.external-db.yml)
- 环境变量：[.env.example](../.env.example)
