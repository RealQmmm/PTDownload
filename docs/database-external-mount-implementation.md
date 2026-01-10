# 数据库外部挂载功能实现总结

## 实现内容

已成功实现数据库外部挂载功能，用户现在可以选择使用内置数据库或外部挂载的数据库。

## 修改的文件

### 1. `docker-compose.yml`
- 添加了 `USE_EXTERNAL_DB` 环境变量（默认为 `false`）
- 添加了 `EXTERNAL_DB_PATH` 环境变量（外部数据库路径）
- 添加了详细的注释说明如何配置外部数据库挂载
- 移除了旧的 `DB_PATH` 环境变量（现在由代码自动处理）

### 2. `server/src/db/index.js`
- 实现了数据库路径选择逻辑
- 根据 `USE_EXTERNAL_DB` 环境变量决定使用内置或外部数据库
- 添加了详细的日志输出，便于调试
- 自动创建数据库目录（如果不存在）

### 3. 新增文件

#### `.env.example`
- 环境变量配置示例文件
- 包含所有可配置的环境变量及说明

#### `docs/database-external-mount.md`
- 详细的使用指南
- 包含配置方法、迁移步骤、常见问题等
- 提供了多个实际使用场景的示例

#### `docker-compose.external-db.yml`
- 外部数据库配置的完整示例
- 用户可以直接复制使用

#### `README.md`（更新）
- 更新了环境变量部分
- 添加了数据库配置的详细说明
- 提供了配置示例和文档链接

## 使用方法

### 默认模式（内置数据库）

无需任何配置，直接运行：
```bash
docker-compose up -d
```

数据存储在 `./data/ptdownload.db`

### 外部数据库模式

1. 修改 `docker-compose.yml`：
```yaml
volumes:
  - ./data:/data
  - /your/database/path:/external_db  # 修改这里

environment:
  - USE_EXTERNAL_DB=true  # 改为 true
  - EXTERNAL_DB_PATH=/external_db/ptdownload.db
```

2. 启动容器：
```bash
docker-compose up -d --build
```

## 优势

### 对用户的好处
1. **简化迁移流程**：不再需要每次迁移都备份和导入设置
2. **数据安全**：数据与容器分离，更新镜像不影响数据
3. **灵活部署**：支持 NAS、网络存储等多种存储方式
4. **向后兼容**：默认使用内置数据库，不影响现有用户

### 技术优势
1. **配置简单**：只需修改环境变量，无需改动代码
2. **自动创建**：数据库目录不存在时自动创建
3. **日志清晰**：启动时明确显示使用的数据库路径
4. **错误处理**：完善的错误处理和默认值

## 验证方法

启动容器后查看日志：
```bash
docker logs pt-app | grep Database
```

应该看到：
- 内置数据库：`[Database] Using INTERNAL database at: /data/ptdownload.db`
- 外部数据库：`[Database] Using EXTERNAL database at: /external_db/ptdownload.db`

## 迁移示例

### 从内置迁移到外部
```bash
# 1. 停止容器
docker-compose down

# 2. 复制数据库
cp ./data/ptdownload.db /your/database/path/

# 3. 修改 docker-compose.yml（设置 USE_EXTERNAL_DB=true）

# 4. 启动容器
docker-compose up -d
```

### 跨服务器迁移（使用外部数据库）
```bash
# 旧服务器
docker-compose down
scp /your/database/path/ptdownload.db user@new-server:/your/database/path/

# 新服务器
# 配置相同的 docker-compose.yml
docker-compose up -d
```

## 注意事项

1. 外部数据库路径必须在 `volumes` 中正确挂载
2. 确保挂载的目录有读写权限
3. 首次使用外部数据库时，如果文件不存在会自动创建
4. 修改配置后建议重新构建镜像：`docker-compose up -d --build`

## 文档位置

- 详细使用指南：`docs/database-external-mount.md`
- 环境变量示例：`.env.example`
- 外部数据库配置示例：`docker-compose.external-db.yml`
- README 更新：`README.md`（环境变量部分）
