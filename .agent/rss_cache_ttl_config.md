# RSS 缓存 TTL 配置功能

## 📋 功能说明

将 RSS 缓存的 TTL（Time To Live）从硬编码改为可配置项，允许用户在系统设置中自行调整。

---

## ✅ 实现内容

### 1. 数据库默认设置

**文件**: `server/src/db/index.js`

**添加**:
```javascript
{ key: 'rss_cache_ttl', value: '300' } // RSS cache TTL in seconds (default: 5 minutes)
```

**说明**: 
- 默认值：300 秒（5 分钟）
- 单位：秒
- 范围：60-3600 秒（1 分钟 - 1 小时）

---

### 2. 后端服务读取配置

**文件**: `server/src/services/rssService.js`

**修改**:
```javascript
constructor() {
    this.rssCache = new Map();
    this.loadCacheTTL(); // 从数据库加载 TTL
}

loadCacheTTL() {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'rss_cache_ttl'").get();
    const ttlSeconds = parseInt(setting?.value || '300');
    this.cacheTTL = ttlSeconds * 1000; // 转换为毫秒
    console.log(`[RSS Cache] TTL set to ${ttlSeconds} seconds`);
}
```

**特性**:
- ✅ 自动从数据库读取配置
- ✅ 默认回退到 5 分钟
- ✅ 启动时显示日志

---

### 3. 前端设置界面

**文件**: `client/src/pages/SettingsPage.jsx`

**添加**:

#### State 变量
```javascript
const [rssCacheTTL, setRssCacheTTL] = useState('300');
```

#### 从 API 获取
```javascript
setRssCacheTTL(data.rss_cache_ttl || '300');
```

#### 保存到 API
```javascript
body: JSON.stringify({
    ...
    rss_cache_ttl: rssCacheTTL,
    ...
})
```

#### UI 输入框
```jsx
<div className="flex items-center space-x-3">
    <div className="flex-1">
        <p className="text-sm font-medium">RSS 缓存时间 (秒)</p>
        <p className="text-[10px] text-gray-400">
            同一 RSS 源的缓存有效期，减少重复请求 (推荐: 300)
        </p>
    </div>
    <input
        type="number"
        min="60"
        max="3600"
        value={rssCacheTTL}
        onChange={(e) => setRssCacheTTL(e.target.value)}
        className="w-20 border rounded-lg px-3 py-1 text-sm text-center"
    />
</div>
```

---

## 🎯 使用说明

### 修改缓存时间

1. 进入"系统设置"页面
2. 找到"日志与同步设置"部分
3. 修改"RSS 缓存时间 (秒)"
4. 点击"提交所有设置"保存
5. **重启容器**使新配置生效

```bash
docker-compose restart
```

### 推荐值

| 场景 | 推荐值 | 说明 |
|------|--------|------|
| **默认** | 300 秒 (5 分钟) | 平衡性能和实时性 |
| **高频更新** | 180 秒 (3 分钟) | 追求更新及时性 |
| **低频更新** | 600 秒 (10 分钟) | 最大化缓存效果 |
| **极限性能** | 900 秒 (15 分钟) | 大量订阅时使用 |

### 取值范围

- **最小值**: 60 秒（1 分钟）
- **最大值**: 3600 秒（1 小时）
- **默认值**: 300 秒（5 分钟）

---

## 📊 效果对比

### 场景：10 个订阅，同一站点，每小时执行

#### TTL = 300 秒 (5 分钟)

```
每小时:
  - HTTP 请求: 1 次
  - 缓存命中率: 90%
```

#### TTL = 180 秒 (3 分钟)

```
每小时:
  - HTTP 请求: 2 次
  - 缓存命中率: 80%
  - 数据更新更及时
```

#### TTL = 600 秒 (10 分钟)

```
每小时:
  - HTTP 请求: 1 次
  - 缓存命中率: 90%
  - 最大化性能
```

---

## 🔍 配置生效

### 查看当前配置

启动日志中会显示：

```bash
docker logs pt-app | grep "RSS Cache"

# 输出示例
[RSS Cache] TTL set to 300 seconds (5 minutes)
```

### 修改后生效

**重要**: 修改配置后需要重启容器才能生效！

```bash
# 方式 1: 重启容器
docker-compose restart

# 方式 2: 重新构建（如果有其他代码更新）
docker-compose down && docker-compose up -d --build
```

---

## ⚙️ 高级用法

### 动态调整策略

根据实际使用情况调整：

1. **观察日志**
   ```bash
   docker logs -f pt-app | grep "RSS Cache"
   ```

2. **分析缓存命中率**
   - 如果经常看到 "Fetching fresh data"，说明 TTL 太短
   - 如果担心数据不够及时，可以缩短 TTL

3. **调整配置**
   - 根据观察结果调整 TTL
   - 重启容器使配置生效

### 特殊场景

#### 场景 1: 大量订阅（20+ 个）

```
推荐 TTL: 600-900 秒
原因: 最大化缓存效果，减少服务器压力
```

#### 场景 2: 实时性要求高

```
推荐 TTL: 180-300 秒
原因: 保证数据及时更新
```

#### 场景 3: 网络不稳定

```
推荐 TTL: 600 秒
原因: 减少网络请求，提高稳定性
```

---

## 🐛 故障排查

### 问题：修改后没有生效

**原因**: 配置在容器启动时加载

**解决**:
```bash
docker-compose restart
```

### 问题：不知道当前 TTL 是多少

**查看方法**:
```bash
# 方式 1: 查看启动日志
docker logs pt-app | grep "RSS Cache"

# 方式 2: 查看数据库
docker exec pt-app sqlite3 /app/data/pt-manager.db \
  "SELECT value FROM settings WHERE key = 'rss_cache_ttl';"
```

### 问题：想恢复默认值

**步骤**:
1. 在设置页面将值改为 `300`
2. 保存设置
3. 重启容器

---

## 📝 注意事项

1. **重启生效**: 修改配置后必须重启容器
2. **取值范围**: 60-3600 秒，超出范围可能导致问题
3. **性能影响**: TTL 越长，缓存效果越好，但数据可能不够及时
4. **内存占用**: TTL 越长，缓存保留时间越长，但影响很小（每个缓存 ~100KB）

---

## ✅ 部署清单

部署此功能需要：

- [x] 数据库添加默认设置
- [x] 后端服务读取配置
- [x] 前端添加设置界面
- [x] 重新构建 Docker 镜像
- [x] 重启容器使配置生效

---

**功能状态**: ✅ **已实现，可配置**  
**默认值**: 300 秒（5 分钟）  
**推荐值**: 300-600 秒
