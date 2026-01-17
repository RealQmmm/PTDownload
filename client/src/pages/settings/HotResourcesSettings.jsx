import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSettings } from './hooks/useSettings';

/**
 * Hot Resources Settings Component
 * Handles: Detection interval, auto-download, scoring rules
 */
const HotResourcesSettings = ({ darkMode, authenticatedFetch }) => {
    const { saving, message, saveSettings } = useSettings(authenticatedFetch);

    const [settings, setSettings] = useState({
        enabled: false,
        checkInterval: '30',
        autoDownload: false,
        defaultClient: '',
        notifyEnabled: false,
        enableSearchIntegration: true,
        rules: {
            minSeeders: 3,
            scoreThreshold: 30,
            excludeKeywords: []
        }
    });

    const [showScoreGuide, setShowScoreGuide] = useState(false);

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();

            setSettings({
                enabled: data.hot_resources_enabled === 'true',
                checkInterval: data.hot_resources_check_interval || '30',
                autoDownload: data.hot_resources_auto_download === 'true',
                defaultClient: data.hot_resources_default_client || '',
                notifyEnabled: data.notify_on_hot_resource === 'true',
                enableSearchIntegration: data.hot_resources_enable_search_integration !== 'false',
                rules: data.hot_resources_rules
                    ? (typeof data.hot_resources_rules === 'string'
                        ? JSON.parse(data.hot_resources_rules)
                        : data.hot_resources_rules)
                    : settings.rules
            });
        } catch (err) {
            console.error('Failed to fetch hot resources settings:', err);
        }
    };

    const handleSave = async () => {
        await saveSettings({
            hot_resources_enabled: settings.enabled,
            hot_resources_check_interval: settings.checkInterval,
            hot_resources_auto_download: settings.autoDownload,
            hot_resources_default_client: settings.defaultClient,
            notify_on_hot_resource: settings.notifyEnabled ? 'true' : 'false',
            hot_resources_enable_search_integration: settings.enableSearchIntegration ? 'true' : 'false',
            hot_resources_rules: typeof settings.rules === 'string' ? settings.rules : JSON.stringify(settings.rules)
        });
    };

    const handleToggle = async () => {
        const newEnabled = !settings.enabled;
        setSettings({ ...settings, enabled: newEnabled });
        await saveSettings({ hot_resources_enabled: newEnabled });
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Master Switch */}
            <Card darkMode={darkMode}>
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`text-lg font-semibold ${textPrimary}`}>热门资源检测</h3>
                        <p className={`text-sm ${textSecondary} mt-1`}>
                            自动检测站点中的热门资源并推送通知
                        </p>
                    </div>
                    <button
                        onClick={handleToggle}
                        className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full ${settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                    >
                        <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.enabled ? 'left-6.5' : 'left-0.5'
                            }`} />
                    </button>
                </div>
            </Card>

            {/* Detection Settings */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>检测设置</h3>

                <div className="space-y-4">
                    <Input
                        label="检测间隔 (分钟)"
                        type="number"
                        value={settings.checkInterval}
                        onChange={(e) => setSettings({ ...settings, checkInterval: e.target.value })}
                        darkMode={darkMode}
                        min="5"
                    />

                    <div className="space-y-2">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={settings.autoDownload}
                                onChange={(e) => setSettings({ ...settings, autoDownload: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className={textPrimary}>自动下载</span>
                        </label>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={settings.notifyEnabled}
                                onChange={(e) => setSettings({ ...settings, notifyEnabled: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className={textPrimary}>发现时通知</span>
                        </label>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={settings.enableSearchIntegration}
                                onChange={(e) => setSettings({ ...settings, enableSearchIntegration: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className={textPrimary}>搜索页显示热度评分</span>
                        </label>
                    </div>
                </div>
            </Card>

            {/* Scoring Rules */}
            <Card darkMode={darkMode}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>评分规则</h3>
                    <button
                        onClick={() => setShowScoreGuide(!showScoreGuide)}
                        className={`text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}
                    >
                        {showScoreGuide ? '隐藏' : '显示'}评分说明
                    </button>
                </div>

                {showScoreGuide && (
                    <div className={`mb-4 p-4 rounded-lg ${bgSecondary} text-xs ${textSecondary}`}>
                        <h4 className="font-bold mb-2">TDI 2.0 评分梯度</h4>
                        <ul className="space-y-1">
                            <li>• <span className="text-green-400">80-100分</span>: 绝佳机会 - 高做种/低下载，极易上传</li>
                            <li>• <span className="text-blue-400">60-79分</span>: 安全理财 - 稳定上传机会</li>
                            <li>• <span className="text-yellow-400">40-59分</span>: 可选资源 - 中等风险</li>
                            <li>• <span className="text-orange-400">20-39分</span>: 需谨慎 - 较高风险</li>
                            <li>• <span className="text-red-400">0-19分</span>: 不推荐 - 高风险</li>
                        </ul>
                    </div>
                )}

                <div className="space-y-4">
                    <Input
                        label="最低做种数"
                        type="number"
                        value={settings.rules.minSeeders}
                        onChange={(e) => setSettings({
                            ...settings,
                            rules: { ...settings.rules, minSeeders: parseInt(e.target.value) || 0 }
                        })}
                        darkMode={darkMode}
                        min="0"
                    />

                    <Input
                        label="最低热度评分"
                        type="number"
                        value={settings.rules.scoreThreshold}
                        onChange={(e) => setSettings({
                            ...settings,
                            rules: { ...settings.rules, scoreThreshold: parseInt(e.target.value) || 0 }
                        })}
                        darkMode={darkMode}
                        min="0"
                        max="100"
                    />

                    <Input
                        label="排除关键词 (逗号分隔)"
                        value={settings.rules.excludeKeywords?.join(', ') || ''}
                        onChange={(e) => setSettings({
                            ...settings,
                            rules: {
                                ...settings.rules,
                                excludeKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                            }
                        })}
                        darkMode={darkMode}
                        placeholder="例如: 4K, REMUX"
                    />
                </div>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} darkMode={darkMode}>
                    {saving ? '保存中...' : '保存设置'}
                </Button>
            </div>
        </div>
    );
};

export default HotResourcesSettings;
