# 智能路径推荐 - 默认路径回退机制

## 功能概述

增强了智能路径推荐功能，添加了多级回退机制，确保即使无法精确匹配类型，也能自动选择合适的默认路径。

## 推荐优先级

智能路径推荐按照以下优先级进行：

### 🥇 第一优先级：类型字段精确匹配

```javascript
if (torrentItem.category) {
    const exactMatch = downloadPaths.find(p =>
        p.name.toLowerCase() === category.toLowerCase() ||
        p.name.includes(category) ||
        category.includes(p.name)
    );
    if (exactMatch) {
        return exactMatch;  // 直接返回
    }
}
```

**示例**：
- 类型：`"电影"` → 匹配路径：`"电影"` ✓
- 类型：`"Movie"` → 匹配路径：`"电影"` ✓（包含匹配）

### 🥈 第二优先级：种子名称关键词匹配

```javascript
// 基于种子名称中的关键词进行评分匹配
// 电影关键词：movie, film, bluray, remux...
// 剧集关键词：s01, season, episode...
// 动画关键词：anime, animation...
```

**示例**：
- 种子名：`"Avatar.2022.2160p.BluRay"` → 匹配路径：`"电影"` ✓（包含 bluray）
- 种子名：`"The.Last.of.Us.S01E05"` → 匹配路径：`"剧集"` ✓（包含 s01）

### 🥉 第三优先级：默认路径回退（新增）

```javascript
// 优先级：其他 > 默认 > Default > Other
const defaultPath = downloadPaths.find(p => 
    ['其他', '默认', 'default', 'other'].includes(p.name.toLowerCase())
);
```

**示例**：
- 类型：`"Unknown"` + 种子名无关键词 → 匹配路径：`"其他"` ✓
- 类型：`"Special"` + 种子名无关键词 → 匹配路径：`"默认"` ✓

### 🏅 第四优先级：第一个路径（最后回退）

```javascript
// 如果连默认路径都没有，使用第一个路径
return downloadPaths.length > 0 ? downloadPaths[0] : null;
```

**示例**：
- 无任何匹配 + 无默认路径 → 使用第一个路径（通常是 ID 最小的）

## 推荐流程图

```
开始
  ↓
有类型字段？
  ├─ 是 → 类型名称匹配？
  │        ├─ 是 → 返回匹配路径 ✓
  │        └─ 否 → 继续
  └─ 否 → 继续
  ↓
种子名关键词匹配？
  ├─ 是 → 返回最高分路径 ✓
  └─ 否 → 继续
  ↓
有"其他"/"默认"路径？
  ├─ 是 → 返回默认路径 ✓
  └─ 否 → 继续
  ↓
有任何路径？
  ├─ 是 → 返回第一个路径 ✓
  └─ 否 → 返回 null
```

## 实际应用示例

### 示例 1：标准电影（第一优先级）

```
种子信息：
  名称: Avatar.The.Way.of.Water.2022.2160p.BluRay
  类型: 电影

匹配过程：
  1. 类型字段匹配 → "电影" = "电影" ✓
  
推荐结果：📁 电影 (/downloads/movies)
```

### 示例 2：英文站点（第一优先级）

```
种子信息：
  名称: Inception.2010.1080p
  类型: Movie

匹配过程：
  1. 类型字段匹配 → "movie" 包含在 "电影" 的别名中 ✓
  
推荐结果：📁 电影 (/downloads/movies)
```

### 示例 3：无类型字段（第二优先级）

```
种子信息：
  名称: The.Last.of.Us.S01E05.2023.2160p
  类型: (无)

匹配过程：
  1. 类型字段匹配 → 跳过（无类型）
  2. 关键词匹配 → "s01" 匹配剧集关键词 ✓
  
推荐结果：📁 剧集 (/downloads/series)
```

### 示例 4：未知类型（第三优先级 - 新增）

```
种子信息：
  名称: Special.Content.2023
  类型: Unknown

匹配过程：
  1. 类型字段匹配 → "unknown" 无匹配
  2. 关键词匹配 → "special.content" 无匹配
  3. 默认路径回退 → 找到 "其他" 路径 ✓
  
推荐结果：📁 其他 (/downloads/other)
```

### 示例 5：完全无法匹配（第四优先级 - 新增）

```
种子信息：
  名称: Random.File.2023
  类型: (无)

存储路径列表：
  1. 电影 (/downloads/movies)
  2. 剧集 (/downloads/series)
  (无"其他"或"默认"路径)

匹配过程：
  1. 类型字段匹配 → 跳过（无类型）
  2. 关键词匹配 → 无匹配
  3. 默认路径回退 → 无"其他"/"默认"路径
  4. 第一个路径回退 → 使用第一个路径 ✓
  
推荐结果：📁 电影 (/downloads/movies)
```

## 默认路径名称优先级

当查找默认路径时，按以下顺序匹配（不区分大小写）：

1. **其他** - 最推荐的默认路径名称
2. **默认** - 中文默认路径
3. **default** - 英文默认路径
4. **other** - 英文其他路径

**建议**：创建一个名为 "其他" 的路径作为默认回退路径。

## 配置建议

### 推荐的路径配置

```
ID  名称      路径                    说明
1   电影      /downloads/movies      电影资源
2   剧集      /downloads/series      剧集资源
3   动画      /downloads/anime       动画资源
4   音乐      /downloads/music       音乐资源
5   纪录片    /downloads/documentary 纪录片资源
6   综艺      /downloads/variety     综艺资源
7   其他      /downloads/other       默认/未分类资源 ⭐
```

### 最小配置

如果只想配置最少的路径：

```
ID  名称      路径                说明
1   默认      /downloads         所有资源的默认位置
```

在这种情况下，所有无法匹配的资源都会自动使用"默认"路径。

## 用户体验改进

### 改进前

```
未知类型资源 → 无法匹配 → 返回 null → 用户必须手动选择
```

### 改进后

```
未知类型资源 → 无法匹配 → 自动选择"其他"路径 → 用户可以直接下载 ✓
```

## 技术细节

### 代码变更

**文件**：`/client/src/utils/pathUtils.js`

**修改内容**：
- 添加默认路径查找逻辑（第 84-89 行）
- 添加第一个路径回退逻辑（第 92 行）

**新增代码**：
```javascript
// 如果没有匹配，尝试查找默认路径
const defaultPath = downloadPaths.find(p => 
    ['其他', '默认', 'default', 'other'].includes(p.name.toLowerCase())
);

if (defaultPath) {
    return defaultPath;
}

// 如果没有默认路径，返回第一个路径
return downloadPaths.length > 0 ? downloadPaths[0] : null;
```

## 测试用例

| 场景 | 类型 | 种子名 | 路径列表 | 预期结果 |
|------|------|--------|---------|---------|
| 精确匹配 | 电影 | Avatar.2022 | [电影, 剧集, 其他] | 电影 |
| 关键词匹配 | (无) | Movie.2022.BluRay | [电影, 剧集, 其他] | 电影 |
| 默认路径 | Unknown | Random.File | [电影, 剧集, 其他] | 其他 |
| 第一个路径 | Unknown | Random.File | [电影, 剧集] | 电影 |
| 无路径 | 电影 | Avatar.2022 | [] | null |

## 优势

1. **✅ 始终有推荐**：即使无法精确匹配，也会提供合理的默认路径
2. **✅ 减少手动操作**：用户无需每次都手动选择路径
3. **✅ 灵活配置**：支持自定义默认路径名称
4. **✅ 向后兼容**：不影响现有的精确匹配逻辑
5. **✅ 优雅降级**：多级回退确保总能找到合适的路径

## 注意事项

1. 如果不希望使用自动回退，可以不创建"其他"/"默认"路径
2. 第一个路径回退是最后的保障，建议至少创建一个"其他"路径
3. 路径名称匹配不区分大小写
4. 推荐创建一个 ID 较大的"其他"路径，避免成为"第一个路径"
