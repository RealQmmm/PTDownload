import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './ui/Button';

const RSSFilterRules = ({ onClose }) => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [rules, setRules] = useState({ exclude: [], include: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Local state for inputs
    const [inputs, setInputs] = useState({ exclude: '', include: '' });

    // Theme helpers
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const bgCard = darkMode ? 'bg-gray-800' : 'bg-white';
    const tagBg = (type) => {
        if (type === 'include') return darkMode ? 'bg-green-900/40 text-green-200 border-green-800' : 'bg-green-50 text-green-700 border-green-200';
        return darkMode ? 'bg-red-900/40 text-red-200 border-red-800' : 'bg-red-50 text-red-700 border-red-200';
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();
            if (data.rss_filter_rules) {
                try {
                    const parsed = JSON.parse(data.rss_filter_rules);
                    setRules({
                        exclude: parsed.exclude || [],
                        include: parsed.include || []
                    });
                } catch (e) {
                    console.error('Failed to parse rules', e);
                }
            }
        } catch (err) {
            console.error('Failed to fetch settings', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (newRules) => {
        setSaving(true);
        // Optimistic update
        setRules(newRules);
        try {
            await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rss_filter_rules: JSON.stringify(newRules)
                })
            });
        } catch (err) {
            alert('保存失败');
            fetchRules(); // Revert
        } finally {
            setSaving(false);
        }
    };

    const handleAddKeyword = (type, e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = inputs[type]?.trim();
            if (!val) return;

            const currentKeywords = rules[type] || [];
            if (currentKeywords.includes(val)) {
                setInputs(prev => ({ ...prev, [type]: '' }));
                return;
            }

            const newRules = {
                ...rules,
                [type]: [...currentKeywords, val]
            };
            handleSave(newRules);
            setInputs(prev => ({ ...prev, [type]: '' }));
        }
    };

    const handleRemoveKeyword = (type, keyword) => {
        const newKeywords = rules[type].filter(k => k !== keyword);
        const newRules = { ...rules, [type]: newKeywords };
        handleSave(newRules);
    };

    const renderSection = (type, title, icon, description) => {
        const keywords = rules[type] || [];
        const isInclude = type === 'include';

        return (
            <div className={`p-4 rounded-lg border ${borderColor} ${bgCard} transition-all hover:shadow-sm`}>
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className={`font-bold ${textPrimary} flex items-center`}>
                            <span className={`mr-2 flex items-center justify-center w-6 h-6 rounded-full ${isInclude ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} text-sm`}>
                                {icon}
                            </span>
                            {title}
                            <span className={`ml-2 text-xs font-normal ${textSecondary}`}>({keywords.length})</span>
                        </h4>
                        <p className={`text-xs ${textSecondary} mt-1 ml-8`}>{description}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center ml-8">
                    {keywords.map((keyword, idx) => (
                        <span
                            key={idx}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${tagBg(type)}`}
                        >
                            {keyword}
                            <button
                                onClick={() => handleRemoveKeyword(type, keyword)}
                                className="ml-1.5 hover:opacity-75 focus:outline-none font-bold"
                            >
                                ×
                            </button>
                        </span>
                    ))}

                    <input
                        type="text"
                        value={inputs[type] || ''}
                        onChange={(e) => setInputs(prev => ({ ...prev, [type]: e.target.value }))}
                        onKeyDown={(e) => handleAddKeyword(type, e)}
                        onBlur={(e) => {
                            if (inputs[type]?.trim()) {
                                const val = inputs[type]?.trim();
                                if (val && !rules[type].includes(val)) {
                                    const newRules = { ...rules, [type]: [...rules[type], val] };
                                    handleSave(newRules);
                                    setInputs(prev => ({ ...prev, [type]: '' }));
                                }
                            }
                        }}
                        placeholder="+ 添加关键词 (按回车)"
                        className={`w-40 px-2 py-1 text-xs rounded border border-dashed ${borderColor} bg-transparent ${textSecondary} focus:w-56 transition-all focus:border-blue-500 focus:outline-none focus:text-blue-500 placeholder-gray-400`}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className={`p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5`}>
                <h4 className="font-bold text-yellow-600 mb-2 flex items-center text-sm">
                    <span className="mr-2">💡</span> 智能源筛选规则说明
                </h4>
                <p className="text-xs text-yellow-600/80 leading-relaxed">
                    系统在执行追剧任务时，会根据 RSS 源的“用途描述”进行智能筛选，以减少不必要的扫描。您可以配置关键词来控制筛选逻辑。
                </p>
            </div>

            <div className="space-y-4">
                {renderSection(
                    'include',
                    '必定扫描 (Include)',
                    '✔',
                    '只要源描述中包含这些关键词，系统必定会扫描该源（优先级最高）。'
                )}

                {renderSection(
                    'exclude',
                    '排除过滤 (Exclude)',
                    '✖',
                    '如果源描述包含这些关键词（且不包含上方必定扫描的词），则跳过扫描。'
                )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={onClose} variant="ghost">完成配置</Button>
            </div>
        </div>
    );
};

export default RSSFilterRules;
