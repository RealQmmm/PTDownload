# 查询种子超时优化方案

## 问题分析

当前搜索超时设置为 10 秒，在以下情况下容易超时：
1. PT 站点响应慢
2. 网络延迟高
3. 同时搜索多个站点
4. 搜索多页结果

## 🎯 优化方案

### 方案 1: 增加超时时间（简单有效）

**优点**: 实现简单，立即生效  
**缺点**: 可能让用户等待更久

#### 实现
```javascript
// searchService.js line 106
timeout: 20000,  // 从 10秒 增加到 20秒

// M-Team 已经是 15秒，可以保持或增加到 20秒
timeout: 20000,  // line 174
```

### 方案 2: 分批并发搜索（推荐）

**优点**: 避免同时请求太多站点导致超时  
**缺点**: 需要修改代码逻辑

#### 实现思路
```javascript
// 将站点分批，每批最多 3 个站点同时搜索
const batchSize = 3;
for (let i = 0; i < enabledSites.length; i += batchSize) {
    const batch = enabledSites.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(searchSite));
    allResults.push(...batchResults);
}
```

### 方案 3: 添加重试机制（推荐）

**优点**: 提高成功率，自动恢复  
**缺点**: 可能增加总时间

#### 实现思路
```javascript
async function fetchWithRetry(url, options, maxRetries = 2) {
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await axios.get(url, options);
        } catch (err) {
            if (i === maxRetries || err.code !== 'ECONNABORTED') {
                throw err;
            }
            console.log(`Retry ${i + 1}/${maxRetries} for ${url}`);
            await new Promise(r => setTimeout(r, 1000)); // 等待 1 秒后重试
        }
    }
}
```

### 方案 4: 优先返回快速站点（推荐）

**优点**: 用户能更快看到结果  
**缺点**: 慢站点的结果会延迟显示

#### 实现思路
```javascript
// 使用 Promise.allSettled 而不是 Promise.all
const resultsArrays = await Promise.allSettled(searchPromises);
const successResults = resultsArrays
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .flat();
```

### 方案 5: 添加缓存机制

**优点**: 相同搜索立即返回  
**缺点**: 可能返回过期数据

#### 实现思路
```javascript
const cache = new Map();
const cacheKey = `${query}-${siteName}-${page}`;
const cached = cache.get(cacheKey);
if (cached && Date.now() - cached.time < 300000) { // 5分钟缓存
    return cached.data;
}
```

## 🚀 推荐组合方案

结合多个方案，达到最佳效果：

### 组合 A: 快速响应（推荐）
1. **增加超时到 20秒**
2. **使用 Promise.allSettled**（优先返回成功的）
3. **添加简单重试**（超时重试 1 次）

### 组合 B: 稳定可靠
1. **增加超时到 30秒**
2. **分批并发**（每批 3 个站点）
3. **添加缓存**（5 分钟）

### 组合 C: 极致性能
1. **增加超时到 15秒**
2. **Promise.allSettled**
3. **添加缓存**
4. **后台预加载热门搜索**

## 📊 各方案对比

| 方案 | 实现难度 | 效果 | 副作用 |
|------|---------|------|--------|
| 增加超时 | ⭐ | ⭐⭐⭐ | 用户等待更久 |
| 分批并发 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 总时间可能增加 |
| 重试机制 | ⭐⭐ | ⭐⭐⭐⭐ | 失败时间更长 |
| 优先返回 | ⭐⭐ | ⭐⭐⭐⭐⭐ | 结果分批显示 |
| 添加缓存 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 可能不是最新 |

## 💡 立即可用的快速修复

### 最简单方案（5分钟实现）

只需修改两处超时时间：

```javascript
// 1. 普通搜索超时：10秒 → 20秒
timeout: 20000,  // line 106

// 2. M-Team 搜索超时：15秒 → 20秒
timeout: 20000,  // line 174
```

### 进阶方案（15分钟实现）

增加超时 + 使用 allSettled：

```javascript
// 将 Promise.all 改为 Promise.allSettled
const resultsArrays = await Promise.allSettled(searchPromises);
const allResults = resultsArrays
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .flat();

// 记录失败的站点
resultsArrays
    .filter(r => r.status === 'rejected')
    .forEach(r => console.warn('Site search failed:', r.reason.message));
```

## 🔧 配置化超时时间

更好的方案是将超时时间配置化：

```javascript
// 在 settings 表中添加配置
search_timeout: 20000  // 默认 20秒

// 在代码中读取
const timeout = this.getSearchTimeout(); // 从数据库读取
```

## 📈 监控和优化

### 添加性能监控

```javascript
const startTime = Date.now();
try {
    const response = await axios.get(url, options);
    const duration = Date.now() - startTime;
    console.log(`${site.name} responded in ${duration}ms`);
} catch (err) {
    const duration = Date.now() - startTime;
    console.error(`${site.name} failed after ${duration}ms:`, err.message);
}
```

### 记录慢站点

```javascript
if (duration > 5000) {
    console.warn(`Slow site detected: ${site.name} took ${duration}ms`);
    // 可以考虑降低该站点的优先级
}
```

## 🎯 我的建议

**立即实施**：
1. 增加超时到 20秒（立即生效）
2. 使用 Promise.allSettled（防止一个站点失败影响全部）

**后续优化**：
1. 添加重试机制（提高成功率）
2. 添加缓存（减少重复请求）
3. 分批并发（避免同时请求太多）

**长期规划**：
1. 添加性能监控
2. 自动调整超时时间
3. 站点健康度评分
4. 智能路由（优先查询快速站点）

---

**需要我帮你实现哪个方案？** 我推荐先实现"增加超时 + allSettled"的组合，这样既简单又有效。
