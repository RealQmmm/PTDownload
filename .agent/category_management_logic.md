# 分类管理与智能下载逻辑说明

## 修改时间
2026-01-03 22:12

## 功能概述

在多路径管理模式下，增加了**分类管理**功能的支持，实现了三种不同的下载模式。

---

## 完整逻辑架构

### 模式分类

系统根据三个开关的组合，提供不同的下载体验：

1. **`enableMultiPath`** - 多路径管理总开关
2. **`enableCategoryManagement`** - 分类管理开关（依赖多路径管理）
3. **`autoDownloadEnabled`** - 智能下载开关（依赖分类管理）

---

## 简单模式（多路径管理关闭）

**条件**: `enableMultiPath = false`

### 场景 1: 单下载器
- 显示简化确认框
- 使用默认下载路径
- 用户确认后下载

### 场景 2: 多下载器
- 显示下载器选择模态框
- 不显示路径选择
- 使用默认下载路径

---

## 多路径模式（多路径管理开启）

**条件**: `enableMultiPath = true`

### 模式 1: 分类管理关闭

**条件**: `enableCategoryManagement = false`

**行为**:
- ❌ 不进行路径匹配
- 显示完整选择模态框
- 用户手动选择路径和下载器

```
点击下载
    ↓
显示模态框
    ├─ 路径选择: 手动选择
    └─ 下载器选择: 手动选择
```

---

### 模式 2: 分类管理开启 + 智能下载关闭

**条件**: 
- `enableCategoryManagement = true`
- `autoDownloadEnabled = false`

**行为**:
- ✅ 自动匹配路径
- 显示模态框（路径已预选）
- 用户可以修改路径或下载器
- 点击下载器后确认下载

```
点击下载
    ↓
自动匹配路径 ✨
    ↓
显示模态框
    ├─ 路径选择: 已预选匹配的路径（可修改）
    └─ 下载器选择: 手动选择
    ↓
用户点击下载器
    ↓
下载
```

**特点**:
- 🎯 自动匹配路径，减少用户操作
- ✋ 用户仍可修改路径
- 👁️ 用户可以看到匹配结果

---

### 模式 3: 分类管理开启 + 智能下载开启

**条件**: 
- `enableCategoryManagement = true`
- `autoDownloadEnabled = true`

**行为**:
- ✅ 自动匹配路径
- ✅ 自动选择下载器
- ⚠️ **弹出确认框**显示匹配信息
- 用户确认后下载

```
点击下载
    ↓
自动匹配路径 ✨
    ↓
自动选择下载器 ✨
    ↓
弹出确认框 ⚠️
┌────────────────────────────────────┐
│ 智能下载确认                        │
│                                    │
│ 下载器: [qBittorrent]              │
│ 保存路径: 电影 (/downloads/movies) │
│                                    │
│ 资源: "某电影.2160p.BluRay.mkv"    │
│ 大小: 25.6 GB                      │
│                                    │
│ 确认下载吗？                        │
│        [取消]    [确定]            │
└────────────────────────────────────┘
    ↓
用户点击确定
    ↓
下载
```

**特点**:
- 🚀 全自动匹配
- ⚠️ 需要用户确认，防止误操作
- 📋 显示完整的下载信息

---

## 代码实现

### 1. 新增状态变量

```javascript
const [enableCategoryManagement, setEnableCategoryManagement] = useState(false);
```

### 2. 加载设置

```javascript
const categoryMgmt = settingsData.enable_category_management !== 'false';
const autoEnabled = settingsData.auto_download_enabled === 'true';
setEnableCategoryManagement(categoryMgmt);
setAutoDownloadEnabled(categoryMgmt && autoEnabled);
```

### 3. 路径匹配逻辑

```javascript
// 使用智能路径推荐（分类管理开启时才匹配）
let suggestedPath = null;
if (enableCategoryManagement) {
    try {
        suggestedPath = suggestPathByTorrentName(item, downloadPaths, suggestOptions);
    } catch (e) {
        console.warn('Smart path suggestion failed:', e);
    }
}

if (suggestedPath) {
    setSelectedPath(suggestedPath.path);  // 预选路径
    setIsCustomPath(false);
}
```

### 4. 智能下载确认框

```javascript
if (autoDownloadEnabled) {
    const defaultClient = clients.find(c => c.is_default) || clients[0];
    const clientName = defaultClient.name || defaultClient.type;

    if (!suggestedPath) {
        // 匹配失败，询问是否手动选择
        if (confirm('智能下载路径匹配失败...是否手动选择路径？')) {
            setPendingDownload(item);
            setShowClientModal(true);
        }
        return;
    }

    // 弹出确认框显示匹配的路径
    const pathName = downloadPaths.find(p => p.path === suggestedPath.path)?.name || '自动匹配';
    const pathInfo = suggestedPath.path 
        ? `\n保存路径: ${pathName} (${suggestedPath.path})`
        : '\n保存路径: 下载器默认路径';
    
    if (window.confirm(`智能下载确认\n\n下载器: [${clientName}]${pathInfo}\n\n资源: "${item.name}"\n大小: ${item.size}\n\n确认下载吗？`)) {
        executeDownload(item, defaultClient.id, suggestedPath.path);
    }
    return;
}
```

---

## 完整决策树

```
点击下载按钮
    ↓
检查下载器 ❌ → 提示添加
    ↓ ✅
┌─────────────────────────────────────┐
│ enableMultiPath = true?             │
└─────────────────────────────────────┘
    ↓ ✅ 多路径模式
    ├─ enableCategoryManagement = true?
    │   ↓ ✅ 分类管理开启
    │   ├─ 自动匹配路径 ✨
    │   │
    │   ├─ autoDownloadEnabled = true?
    │   │   ↓ ✅ 智能下载开启
    │   │   ├─ 匹配成功？
    │   │   │   ↓ ✅
    │   │   │   └─ 弹出确认框 ⚠️
    │   │   │       └─ 确认 → 下载
    │   │   │
    │   │   └─ 匹配失败？
    │   │       ↓ ❌
    │   │       └─ 询问手动选择
    │   │
    │   └─ autoDownloadEnabled = false?
    │       ↓ ❌ 智能下载关闭
    │       └─ 显示模态框（路径已预选）
    │
    └─ enableCategoryManagement = false?
        ↓ ❌ 分类管理关闭
        └─ 显示模态框（手动选择）
    
    ↓ ❌ 简单模式
    └─ clients.length = 1?
        ↓ ✅ → 简化确认框
        ↓ ❌ → 下载器选择模态框
```

---

## 模式对比表

| 模式 | 多路径 | 分类管理 | 智能下载 | 路径匹配 | 用户操作 |
|------|--------|---------|---------|---------|---------|
| **简单模式** | ❌ | - | - | ❌ | 确认框 |
| **手动选择** | ✅ | ❌ | - | ❌ | 模态框（手动选择）|
| **辅助选择** | ✅ | ✅ | ❌ | ✅ | 模态框（已预选）|
| **智能下载** | ✅ | ✅ | ✅ | ✅ | 确认框 |

---

## 用户体验对比

### 简单模式
```
点击 → 确认框 → 下载
```
**优点**: 最简单
**缺点**: 无法分类

### 手动选择模式
```
点击 → 模态框 → 选择路径 → 选择下载器 → 下载
```
**优点**: 完全控制
**缺点**: 操作步骤多

### 辅助选择模式 ⭐ 推荐
```
点击 → 模态框（路径已选）→ 选择下载器 → 下载
```
**优点**: 自动匹配 + 可修改
**缺点**: 需要点击下载器

### 智能下载模式
```
点击 → 确认框 → 下载
```
**优点**: 最快速
**缺点**: 无法修改（需取消重新操作）

---

## 配置建议

### 新手用户
1. 关闭多路径管理
2. 配置默认下载路径
3. 享受简单模式

### 进阶用户 ⭐ 推荐
1. 开启多路径管理
2. 开启分类管理
3. **关闭**智能下载
4. 享受辅助选择模式（自动匹配 + 可修改）

### 高级用户
1. 开启多路径管理
2. 开启分类管理
3. 开启智能下载
4. 享受全自动下载（需确认）

---

## 安全性考虑

### 为什么智能下载需要确认框？

1. **防止误操作** 🔒
   - 自动匹配可能出错
   - 用户可能点错资源
   - 大文件下载需要谨慎

2. **信息透明** 📋
   - 显示匹配的路径
   - 显示下载器
   - 显示资源信息

3. **用户控制** ✋
   - 用户可以取消
   - 用户可以看到所有信息
   - 避免"黑盒"操作

---

## 测试场景

### 场景 1: 分类管理关闭
- 配置: `enableMultiPath = true`, `enableCategoryManagement = false`
- 预期: 显示模态框，手动选择路径
- 验证: ✅

### 场景 2: 分类管理开启 + 智能下载关闭
- 配置: `enableMultiPath = true`, `enableCategoryManagement = true`, `autoDownloadEnabled = false`
- 预期: 自动匹配路径，显示模态框（路径已预选）
- 验证: ✅

### 场景 3: 智能下载开启 + 匹配成功
- 配置: `enableMultiPath = true`, `enableCategoryManagement = true`, `autoDownloadEnabled = true`
- 预期: 自动匹配路径，弹出确认框，显示完整信息
- 验证: ✅

### 场景 4: 智能下载开启 + 匹配失败
- 配置: 同上，但资源无法匹配
- 预期: 询问是否手动选择路径
- 验证: ✅

---

## 总结

### 核心改进

1. ✅ 增加了分类管理开关的支持
2. ✅ 智能下载增加了确认环节
3. ✅ 提供了三种多路径模式供用户选择
4. ✅ 保持了简单模式的易用性

### 优势

1. **灵活性** 🔄
   - 三种多路径模式适应不同需求
   - 简单模式保持易用

2. **安全性** 🔒
   - 智能下载需要确认
   - 防止误操作

3. **透明性** 📋
   - 所有操作都有明确提示
   - 用户知道系统在做什么

4. **渐进式** 📈
   - 从简单到高级
   - 用户可以逐步学习
