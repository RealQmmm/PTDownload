# ✅ 类型映射配置完全数据库化

## 变更说明

已移除 `siteParsers.js` 中的内置默认映射，现在类型映射配置**完全依赖数据库**。

## 修改内容

### 修改前

```javascript
// Get category map from database or use default
const getCategoryMap = () => {
    try {
        const db = getDB();
        const row = db.prepare("SELECT value FROM settings WHERE key = 'category_map'").get();
        if (row && row.value) {
            return JSON.parse(row.value);
        }
    } catch (e) {
        console.error('[CategoryMap] Failed to load from database:', e.message);
    }
    
    // Fallback to default - 内置了完整的默认映射
    return {
        '电影': ['电影', 'movie', 'movies', ...],
        '剧集': ['剧集', 'tv', 'series', ...],
        // ... 更多类型
    };
};
```

### 修改后

```javascript
// Get category map from database
const getCategoryMap = () => {
    try {
        const db = getDB();
        const row = db.prepare("SELECT value FROM settings WHERE key = 'category_map'").get();
        if (row && row.value) {
            return JSON.parse(row.value);
        }
    } catch (e) {
        console.error('[CategoryMap] Failed to load from database:', e.message);
    }
    
    // Return empty object if no config found
    // This will cause unmatched categories to use default path fallback
    return {};
};
```

## 工作流程

### 场景 1：有数据库配置（正常情况）

```
PT 站点类型: "演唱"
    ↓
getCategoryMap() → 从数据库读取配置
    ↓
normalizeCategory("演唱") → 匹配到 "音乐"
    ↓
前端显示: 🎵 音乐
    ↓
路径推荐: 📁 音乐 (/downloads/music)
```

### 场景 2：无数据库配置（空配置）

```
PT 站点类型: "演唱"
    ↓
getCategoryMap() → 返回 {}（空对象）
    ↓
normalizeCategory("演唱") → 无匹配
    ↓
返回原始值: "演唱"（首字母大写）
    ↓
前端显示: 📦 演唱（灰色标签）
    ↓
路径推荐: 
  1. 尝试类型匹配 → 无匹配 ✗
  2. 尝试关键词匹配 → 无匹配 ✗
  3. 查找默认路径 → 📁 其他 ✓
  4. 使用第一个路径 → 📁 电影 ✓
```

### 场景 3：类型在配置中但无对应路径

```
PT 站点类型: "演唱"
    ↓
getCategoryMap() → 从数据库读取
    ↓
normalizeCategory("演唱") → 匹配到 "音乐"
    ↓
前端显示: 🎵 音乐
    ↓
路径推荐:
  1. 尝试类型匹配 → 无"音乐"路径 ✗
  2. 尝试关键词匹配 → 无匹配 ✗
  3. 查找默认路径 → 📁 其他 ✓
```

## 优势

### 1. **完全可配置**
- ✅ 所有类型映射规则都在数据库中
- ✅ 用户可以通过前端界面完全控制
- ✅ 无需修改代码

### 2. **灵活的回退机制**
- ✅ 未配置的类型 → 显示原始名称
- ✅ 自动使用默认路径回退
- ✅ 不会因为配置缺失而报错

### 3. **清晰的数据流**
```
数据库配置 (唯一数据源)
    ↓
类型标准化
    ↓
前端显示 + 路径推荐
    ↓
默认路径回退（如果需要）
```

## 默认路径回退机制

当类型无法匹配到任何路径时，按以下优先级回退：

1. **类型字段精确匹配** - 尝试匹配类型名称
2. **关键词匹配** - 基于种子名称关键词
3. **默认路径** - 查找"其他"/"默认"路径 ⭐
4. **第一个路径** - 使用第一个可用路径 ⭐

## 推荐配置

### 建议创建的路径

为了确保所有资源都能找到合适的路径，建议创建：

```
ID  名称      路径                说明
1   电影      /downloads/movies   电影资源
2   剧集      /downloads/series   剧集资源
3   动画      /downloads/anime    动画资源
4   音乐      /downloads/music    音乐资源
5   其他      /downloads/other    默认/未分类 ⭐ 重要
```

**"其他"路径的作用**：
- 作为所有未匹配资源的默认目标
- 避免资源因无法匹配而使用第一个路径
- 提供更清晰的资源组织

## 数据库配置示例

在设置页面的"类型映射"中配置：

```json
{
  "电影": ["电影", "movie", "film", "401"],
  "剧集": ["剧集", "tv", "series", "411"],
  "动画": ["动画", "anime", "421"],
  "音乐": ["音乐", "music", "演唱", "演唱会", "concert", "431"],
  "其他": ["其他", "other", "misc"]
}
```

## 测试场景

### 测试 1：配置的类型

```
输入: "演唱"
配置: "音乐": ["演唱", "演唱会"]
结果: ✅ 匹配到"音乐"
显示: 🎵 音乐
推荐: 📁 音乐
```

### 测试 2：未配置的类型

```
输入: "Special"
配置: {}（空）
结果: ❌ 无匹配
显示: 📦 Special
推荐: 📁 其他（如果有）或 📁 第一个路径
```

### 测试 3：配置了但无对应路径

```
输入: "演唱"
配置: "音乐": ["演唱"]
路径: 只有"电影"和"剧集"
结果: ✅ 匹配到"音乐"
显示: 🎵 音乐
推荐: 📁 其他（如果有）或 📁 电影（第一个）
```

## 注意事项

⚠️ **重要提示**

1. **首次使用**：数据库已包含默认配置，无需手动配置
2. **修改配置**：通过设置页面 → 类型映射进行修改
3. **创建"其他"路径**：强烈建议创建，作为默认回退路径
4. **刷新生效**：修改配置后需要刷新页面

## 文件修改

**`/server/src/utils/siteParsers.js`**
- ✅ 移除内置默认映射
- ✅ 改为返回空对象（如果数据库无配置）
- ✅ 依赖默认路径回退机制

## 部署状态

- ✅ Docker 已重新构建
- ✅ 服务器正在运行
- ✅ 配置完全数据库化
- ✅ 默认路径回退机制已启用

## 总结

现在系统的类型映射配置：
- ✅ **完全数据库化** - 无代码硬编码
- ✅ **用户可控** - 通过前端界面管理
- ✅ **优雅降级** - 未配置类型自动使用默认路径
- ✅ **灵活扩展** - 随时添加新类型映射

所有未匹配的类型都会自动推荐到"其他"或第一个可用路径！🎉
