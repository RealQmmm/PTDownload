import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './ui/Button';

const CategoryMapEditor = ({ disabled }) => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [mapData, setMapData] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Local state for inputs
    const [aliasInputs, setAliasInputs] = useState({});

    // Theme classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const bgCard = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgInput = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const tagBg = darkMode ? 'bg-blue-900/40 text-blue-200 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200';

    // Fetch data independently
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();
            if (data.category_map) {
                try {
                    const parsed = JSON.parse(data.category_map);
                    setMapData(parsed);
                    // Init inputs
                    const initialInputs = {};
                    Object.keys(parsed).forEach(k => initialInputs[k] = '');
                    setAliasInputs(initialInputs);
                } catch (e) {
                    console.error('JSON Parse error', e);
                }
            }
        } catch (err) {
            console.error('Fetch settings failed', err);
        } finally {
            setLoading(false);
        }
    };

    const saveData = async (newData) => {
        // Optimistic update
        setMapData(newData);
        setSaving(true);
        try {
            await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_map: JSON.stringify(newData) })
            });
        } catch (err) {
            console.error('Save failed', err);
            alert('保存失败，请刷新重试');
            fetchData(); // Revert on error
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        if (mapData[newCategoryName.trim()]) {
            alert('该类型已存在');
            return;
        }
        const newData = { ...mapData, [newCategoryName.trim()]: [] };
        saveData(newData);
        setAliasInputs(prev => ({ ...prev, [newCategoryName.trim()]: '' }));
        setNewCategoryName('');
    };

    const handleDeleteCategory = (category) => {
        if (!confirm(`确定要删除类型 "${category}" 及其配置吗？`)) return;
        const newData = { ...mapData };
        delete newData[category];
        saveData(newData);
    };

    const handleAddAlias = (category, e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = aliasInputs[category]?.trim();
            if (!val) return;

            const currentAliases = mapData[category] || [];
            if (currentAliases.includes(val)) {
                setAliasInputs(prev => ({ ...prev, [category]: '' }));
                return;
            }

            const newData = {
                ...mapData,
                [category]: [...currentAliases, val]
            };
            saveData(newData);
            setAliasInputs(prev => ({ ...prev, [category]: '' }));
        }
    };

    const handleRemoveAlias = (category, aliasToRemove) => {
        const currentAliases = mapData[category] || [];
        const newData = {
            ...mapData,
            [category]: currentAliases.filter(a => a !== aliasToRemove)
        };
        saveData(newData);
    };

    // Default category configuration
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

    const handleResetToDefault = () => {
        if (confirm('⚠️ 确定要重置为默认配置吗？\n当前的所有自定义类型和别名将被覆盖，且无法恢复。')) {
            saveData(defaultMap);
        }
    };

    // Helper to get icon based on category name
    const getCategoryIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('电影') || n.includes('movie') || n.includes('film')) return '🎬';
        if (n.includes('剧集') || n.includes('tv') || n.includes('series') || n.includes('season')) return '📺';
        if (n.includes('动画') || n.includes('anime')) return '🌸';
        if (n.includes('音乐') || n.includes('music') || n.includes('audio')) return '🎵';
        if (n.includes('综艺') || n.includes('variety')) return '🎤';
        if (n.includes('纪录') || n.includes('doc')) return '🌍';
        if (n.includes('游戏') || n.includes('game')) return '🎮';
        if (n.includes('软件') || n.includes('app') || n.includes('soft')) return '💾';
        if (n.includes('体育') || n.includes('sport')) return '⚽';
        if (n.includes('学习') || n.includes('study') || n.includes('book') || n.includes('rbook')) return '📚';
        if (n.includes('xx') || n.includes('adult')) return '🔞';
        return '📦';
    };

    if (loading) {
        return (
            <div className={`flex justify-center items-center py-8 ${textSecondary}`}>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                加载配置中...
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Header / Add Category */}
            <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 flex space-x-2">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="输入新类型名称 (如: 4K电影)"
                        className={`flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border ${borderColor} ${bgInput} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    />
                    <Button onClick={handleAddCategory} size="sm" variant="secondary" disabled={!newCategoryName.trim() || saving}>
                        {saving ? '保存中...' : '+ 添加'}
                    </Button>
                </div>

                <Button
                    onClick={handleResetToDefault}
                    size="sm"
                    variant="danger" // Assuming danger variant exists or will fallback to secondary/default style but intended for red
                    className={`${darkMode ? 'text-red-400 border-red-900 bg-red-900/10 hover:bg-red-900/30' : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'} border`}
                    disabled={saving}
                >
                    ↻ 重置默认
                </Button>
            </div>

            {/* Categories Grid */}
            <div className="space-y-3">
                {Object.entries(mapData).map(([category, aliases]) => (
                    <div key={category} className={`p-4 rounded-lg border ${borderColor} ${bgCard} transition-all hover:shadow-sm`}>
                        <div className="flex justify-between items-start mb-3">
                            <h4 className={`font-bold ${textPrimary} flex items-center`}>
                                <span className="mr-2 text-xl">{getCategoryIcon(category)}</span>
                                {category}
                                <span className={`ml-2 text-xs font-normal ${textSecondary}`}>({aliases.length} 个别名)</span>
                            </h4>
                            <button
                                onClick={() => handleDeleteCategory(category)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="删除此类型"
                            >
                                🗑️
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                            {aliases.map((alias, idx) => (
                                <span
                                    key={idx}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${tagBg}`}
                                >
                                    {alias}
                                    <button
                                        onClick={() => handleRemoveAlias(category, alias)}
                                        className="ml-1.5 hover:text-red-500 focus:outline-none"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}

                            <input
                                type="text"
                                value={aliasInputs[category] || ''}
                                onChange={(e) => setAliasInputs(prev => ({ ...prev, [category]: e.target.value }))}
                                onKeyDown={(e) => handleAddAlias(category, e)}
                                onBlur={(e) => {
                                    if (aliasInputs[category]?.trim()) {
                                        const val = aliasInputs[category]?.trim();
                                        if (val && !mapData[category].includes(val)) {
                                            const newData = { ...mapData, [category]: [...mapData[category], val] };
                                            saveData(newData);
                                            setAliasInputs(prev => ({ ...prev, [category]: '' }));
                                        }
                                    }
                                }}
                                placeholder="+ 添加别名 (按回车)"
                                className={`w-36 px-2 py-1 text-xs rounded border border-dashed ${borderColor} bg-transparent ${textSecondary} focus:w-48 transition-all focus:border-blue-500 focus:outline-none focus:text-blue-500 placeholder-gray-400`}
                            />
                        </div>
                    </div>
                ))}

                {Object.keys(mapData).length === 0 && (
                    <div className={`text-center py-8 border-2 border-dashed ${borderColor} rounded-lg ${textSecondary} text-sm`}>
                        暂无配置，请点击上方按钮添加类型。
                    </div>
                )}
            </div>

            {saving && (
                <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">
                    正在保存配置...
                </div>
            )}
        </div>
    );
};

export default CategoryMapEditor;
