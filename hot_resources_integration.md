# 热门资源功能整合到搜索页面

## 概述

将独立的"热门资源"页面功能整合到"资源搜索"页面中，当用户不输入关键词进行搜索时，自动计算并显示热门指数。

## 实现方案

### 1. 后端改造

**文件**: `server/src/routes/search.js`

- 引入 `hotResourcesService` 用于计算热门分数
- 当搜索无关键词时（`query.trim() === ''`），为每个结果计算热门分数
- 使用 `hotResourcesService.calculateHotScore()` 计算分数和详细分解
- 按热门分数降序排序结果
- 添加 `parseSizeToBytes` 辅助函数转换大小字符串

**核心逻辑**:
```javascript
if (!query.trim()) {
    // 无关键词 = 热门资源模式
    const resultsWithScores = results.map(result => {
        const resource = {
            title: result.name,
            seeders: result.seeders || 0,
            leechers: result.leechers || 0,
            size: parseSizeToBytes(result.size),
            promotion: result.freeType || '',
            publishTime: result.date,
            category: result.category
        };
        
        const scoreResult = hotResourcesService.calculateHotScore(resource, rules, true);
        
        return {
            ...result,
            hotScore: scoreResult.total,
            scoreBreakdown: scoreResult.breakdown
        };
    });
    
    // 按热度排序
    resultsWithScores.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
}
```

### 2. 前端改造

**文件**: `client/src/pages/SearchPage.jsx`

#### 新增功能:

1. **热门分数颜色函数**:
```javascript
const getHotScoreColor = (score) => {
    if (score >= 80) return 'text-red-500';    // 极热
    if (score >= 60) return 'text-orange-500'; // 很热
    if (score >= 40) return 'text-yellow-500'; // 较热
    return 'text-green-500';                   // 一般
};
```

2. **桌面端表格视图**:
   - 在发布时间列后添加"🔥 热度"列（仅在 `searchMode === 'recent'` 时显示）
   - 显示热门分数，大号字体，带颜色标识
   - 支持点击列头按热度排序

3. **移动端卡片视图**:
   - 在资源信息行添加热门分数标签
   - 紧凑显示：`🔥{hotScore}`
   - 带背景色和颜色标识

### 3. 清理工作

**移除的内容**:
- `client/src/components/Sidebar.jsx`: 移除 `hot-resources` 菜单项
- `client/src/App.jsx`: 移除 `HotResourcesPage` 导入和路由
- 保留 `HotResourcesPage.jsx` 文件（可能在设置页面还有引用）

## 用户体验

### 使用方式

1. **查看热门资源**:
   - 打开"资源搜索"页面
   - 不输入任何关键词
   - 直接点击"搜索"按钮
   - 系统自动显示最近资源并计算热门指数

2. **关键词搜索**:
   - 输入关键词搜索
   - 不显示热门指数列
   - 按种子数排序（原有逻辑）

### 热门分数说明

热门分数由多个因素组成：
- **促销加分** (0-50分): 2xFree(50) > Free(35) > 50%(20) > 30%(10)
- **新鲜度加分** (0-30分): 发布时间越近分数越高
- **种子数加分** (0-15分): 种子数越多分数越高
- **下载数加分** (0-10分): 下载数越多分数越高
- **文件大小加分** (0-10分): 合理大小(5-50GB)加分
- **关键词匹配** (0-N分): 匹配用户设置的关键词

**分数颜色**:
- 🔴 红色 (≥80分): 极度热门
- 🟠 橙色 (≥60分): 非常热门
- 🟡 黄色 (≥40分): 比较热门
- 🟢 绿色 (<40分): 一般热门

## 优势

1. **功能整合**: 减少菜单项，简化界面
2. **一站式体验**: 搜索和热门资源在同一页面
3. **智能切换**: 根据是否输入关键词自动切换模式
4. **数据准确**: 使用 web 解析获取准确的种子数和下载数
5. **可视化**: 直观的热度分数和颜色标识

## 配置

热门资源的计算规则仍然在"系统设置 > 热门资源"中配置：
- 最低种子数
- 最低下载数
- 文件大小范围
- 发布时间范围
- 分类筛选
- 关键词筛选
- 促销类型

## 技术细节

### 性能优化
- 只在无关键词搜索时计算热门分数
- 计算在后端完成，前端只负责显示
- 使用已有的搜索结果，无额外网络请求

### 兼容性
- 桌面端和移动端都有良好的显示效果
- 支持排序功能
- 响应式设计

## 后续优化建议

1. 可以在搜索框添加提示："留空搜索查看热门资源"
2. 可以添加一个快捷按钮"查看热门"直接触发无关键词搜索
3. 可以缓存热门资源结果，减少重复计算
