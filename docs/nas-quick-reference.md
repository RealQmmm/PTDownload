# NAS Docker 图形界面配置 - 快速参考

## 🎯 核心配置（3 步搞定）

### 1️⃣ 创建存储目录
在 NAS 上创建文件夹：
```
/Container/PTdownload
```

### 2️⃣ 配置卷映射
在 Docker 容器设置中添加：

| 宿主机路径 | 容器内路径 | 说明 |
|-----------|-----------|------|
| `/docker/ptdownload-data` | `/data` | 内置数据（必需） |
| `/Container/PTdownload` | `/external_db` | 外部数据库（可选） |

### 3️⃣ 配置端口
```
3000 → 3000
```

## ✅ 就这么简单！

- ✅ **配置了** `/external_db` 映射 → 使用外部数据库
- ✅ **没配置** `/external_db` 映射 → 使用内置数据库
- ✅ **无需设置**任何环境变量！

## 🔍 如何验证

### 方法 1：查看容器日志
```
[Database] External directory detected at: /external_db
[Database] Using EXTERNAL database at: /external_db/ptdownload.db
```

### 方法 2：Web UI
访问 `http://NAS的IP:3000`
→ **设置** → **常规设置** → **数据库配置**
→ 查看标签颜色：
- 🟢 绿色"外部" = 外部数据库 ✅
- 🔵 蓝色"内置" = 内置数据库

## 📋 群晖配置示例

```
容器名称: pt-app
端口: 3000:3000

卷:
  ✅ /docker/ptdownload-data → /data
  ✅ /Container/PTdownload → /external_db

环境变量:
  PORT=3000
  TZ=Asia/Shanghai
```

## 🎯 关键点

1. **容器内路径必须是 `/external_db`**（不要改）
2. **宿主机路径可以自定义**（改成你的实际路径）
3. **系统会自动检测**（无需手动配置）

## 📖 详细指南

查看完整配置步骤：[NAS Docker 图形化界面部署指南](nas-docker-gui-guide.md)
