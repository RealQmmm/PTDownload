# 类型映射配置前端编辑功能实现方案

## 概述

允许用户在设置页面通过文本框编辑 `category_map` 配置，实现自定义类型映射规则。

## 已完成的后端工作

### 1. 数据库配置
✅ 在 `/server/src/db/index.js` 中添加了 `category_map` 默认配置
✅ 配置以 JSON 字符串形式存储在 settings 表中

### 2. 后端读取逻辑
✅ 修改了 `/server/src/utils/siteParsers.js`
✅ 添加了 `getCategoryMap()` 函数从数据库读取配置
✅ 如果数据库读取失败，自动回退到内置默认配置

## 需要完成的前端工作

### 步骤 1：在 SettingsPage.jsx 添加状态

在文件开头的 useState 部分添加：

```javascript
const [categoryMap, setCategoryMap] = useState('');
const [categoryMapError, setCategoryMapError] = useState('');
```

### 步骤 2：在 fetchSettings 中加载配置

在 `fetchSettings` 函数中添加：

```javascript
// 在 fetchSettings 函数中
if (data.category_map) {
    try {
        const parsed = JSON.parse(data.category_map);
        setCategoryMap(JSON.stringify(parsed, null, 2)); // 格式化显示
    } catch (e) {
        console.error('Parse category_map error:', e);
    }
}
```

### 步骤 3：添加保存函数

```javascript
const handleSaveCategoryMap = async () => {
    setSaving(true);
    setMessage(null);
    setCategoryMapError('');
    
    try {
        // 验证 JSON 格式
        const parsed = JSON.parse(categoryMap);
        
        // 验证数据结构
        for (const [key, value] of Object.entries(parsed)) {
            if (!Array.isArray(value)) {
                throw new Error(`"${key}" 的值必须是数组`);
            }
        }
        
        // 保存到后端
        const res = await authenticatedFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_map: JSON.stringify(parsed) // 压缩后保存
            })
        });
        
        if (res.ok) {
            setMessage({ type: 'success', text: '类型映射已保存，刷新页面后生效' });
        } else {
            setMessage({ type: 'error', text: '保存失败' });
        }
    } catch (err) {
        setCategoryMapError(err.message || 'JSON 格式错误');
        setMessage({ type: 'error', text: 'JSON 格式错误，请检查' });
    } finally {
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    }
};

const handleResetCategoryMap = () => {
    if (!confirm('确定要重置为默认配置吗？')) return;
    
    const defaultMap = {
        '电影': ['电影', 'movie', 'movies', 'film', 'films', 'bluray', 'bd', 'dvd', '401', '402', '403', '404', '405'],
        '剧集': ['剧集', 'tv', 'series', 'tvshow', 'drama', '美剧', '日剧', '韩剧', '国产剧', 'episode', '411', '412', '413', '414', '415'],
        '动画': ['动画', 'anime', 'animation', 'cartoon', '动漫', '番剧', 'ova', 'ona', '421', '422', '423'],
        '音乐': ['音乐', 'music', 'audio', 'mp3', 'flac', 'ape', 'wav', 'album', '演唱', '演唱会', 'concert', 'live', 'mv', '431', '432', '433'],
        '综艺': ['综艺', 'variety', 'show', 'reality', '真人秀', '441', '442'],
        '纪录片': ['纪录片', 'documentary', 'docu', 'nature', 'bbc', 'discovery', '451', '452'],
        '软件': ['软件', 'software', 'app', 'application', 'program', '461', '462'],
        '游戏': ['游戏', 'game', 'games', 'gaming', 'pc', 'console', '471', '472'],
        '体育': ['体育', 'sport', 'sports', 'fitness', '481', '482'],
        '学习': ['学习', 'education', 'tutorial', 'course', 'ebook', '电子书', '491', '492'],
        '其他': ['其他', 'other', 'misc', 'miscellaneous', '499']
    };
    
    setCategoryMap(JSON.stringify(defaultMap, null, 2));
    setCategoryMapError('');
};
```

### 步骤 4：添加 UI（在 renderContent 的 switch 中添加新 case）

```javascript
case 'category':
    return (
        <div className="space-y-4">
            {message && (
                <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <Card className="space-y-4">
                <div>
                    <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-2`}>
                        类型映射配置
                    </h3>
                    <p className={`text-xs ${textSecondary} mb-4`}>
                        配置资源类型的识别规则。格式为 JSON 对象，键为标准类型名称，值为别名数组。
                    </p>
                </div>

                <div>
                    <label className={`block text-xs font-bold ${textSecondary} mb-2`}>
                        配置内容 (JSON 格式)
                    </label>
                    <textarea
                        value={categoryMap}
                        onChange={(e) => {
                            setCategoryMap(e.target.value);
                            setCategoryMapError('');
                        }}
                        className={`w-full h-96 p-3 rounded-lg border ${
                            categoryMapError 
                                ? 'border-red-500' 
                                : borderColor
                        } ${bgMain} ${textPrimary} font-mono text-xs`}
                        style={{ fontFamily: 'Monaco, Consolas, monospace' }}
                        placeholder='{\n  "电影": ["电影", "movie", "film"],\n  "剧集": ["剧集", "tv", "series"]\n}'
                    />
                    {categoryMapError && (
                        <p className="text-xs text-red-500 mt-1">
                            ❌ {categoryMapError}
                        </p>
                    )}
                </div>

                <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'} border ${darkMode ? 'border-blue-800' : 'border-blue-200'}`}>
                    <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'} font-bold mb-2`}>
                        💡 使用说明
                    </p>
                    <ul className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'} space-y-1 list-disc list-inside`}>
                        <li>每个标准类型（如"电影"）对应一个别名数组</li>
                        <li>别名可以是中文、英文、类型ID等</li>
                        <li>匹配时不区分大小写，支持部分匹配</li>
                        <li>修改后需要保存并刷新页面才能生效</li>
                    </ul>
                </div>

                <div className="flex justify-end space-x-3">
                    <Button
                        variant="secondary"
                        onClick={handleResetCategoryMap}
                        disabled={saving}
                    >
                        重置为默认
                    </Button>
                    <Button
                        onClick={handleSaveCategoryMap}
                        disabled={saving}
                    >
                        {saving ? '保存中...' : '保存配置'}
                    </Button>
                </div>
            </Card>
        </div>
    );
```

### 步骤 5：添加菜单项

在 SettingsPage 的菜单部分添加：

```javascript
const tabs = [
    { id: 'general', name: '常规', icon: '⚙️' },
    { id: 'category', name: '类型映射', icon: '🏷️' }, // 新增
    { id: 'notifications', name: '通知', icon: '🔔' },
    { id: 'password', name: '密码', icon: '🔒' },
    { id: 'cleanup', name: '清理', icon: '🗑️' },
    { id: 'backup', name: '备份', icon: '💾' },
    { id: 'maintenance', name: '维护', icon: '🔧' },
    { id: 'logs', name: '日志', icon: '📋' }
];
```

## 配置示例

```json
{
  "电影": [
    "电影",
    "movie",
    "movies",
    "film",
    "films",
    "bluray",
    "bd",
    "dvd",
    "401",
    "402"
  ],
  "剧集": [
    "剧集",
    "tv",
    "series",
    "tvshow",
    "drama",
    "美剧",
    "日剧",
    "韩剧",
    "411",
    "412"
  ],
  "音乐": [
    "音乐",
    "music",
    "audio",
    "演唱",
    "演唱会",
    "concert",
    "live",
    "mv",
    "431"
  ]
}
```

## 测试步骤

1. 访问设置页面 → 类型映射标签
2. 查看当前配置
3. 修改配置（例如添加新的别名）
4. 点击保存
5. 刷新页面
6. 搜索资源测试类型识别是否正确

## 注意事项

1. **JSON 格式验证**：保存前必须验证 JSON 格式正确
2. **数据结构验证**：确保每个值都是数组
3. **刷新生效**：修改后需要刷新页面（或重启 Docker）
4. **备份建议**：修改前建议先导出备份
5. **错误处理**：显示清晰的错误提示

## 完整文件位置

- 后端配置：`/server/src/db/index.js`
- 后端读取：`/server/src/utils/siteParsers.js`
- 前端编辑：`/client/src/pages/SettingsPage.jsx`（需要添加）

## 当前状态

✅ 后端已完成
⏳ 前端待实现（按照上述步骤添加代码即可）
