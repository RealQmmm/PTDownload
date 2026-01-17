import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSettings } from './hooks/useSettings';

/**
 * Notification Settings Component
 * Handles: Bark, Webhook, PWA push notifications
 */
const NotificationSettings = ({ darkMode, authenticatedFetch }) => {
    const { saving, message, saveSettings } = useSettings(authenticatedFetch);

    const [notifySettings, setNotifySettings] = useState({
        notify_enabled: false,
        notify_on_download_start: false,
        notify_on_rss_match: true,
        notification_receivers: []
    });

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

    const handleSave = async () => {
        await saveSettings({
            ...notifySettings,
            notification_receivers: JSON.stringify(notifySettings.notification_receivers)
        });
    };

    const addReceiver = (type) => {
        const newReceiver = {
            id: crypto.randomUUID(),
            type,
            name: type === 'bark' ? '新 Bark 通知' : '新 Webhook',
            url: '',
            enabled: true,
            ...(type === 'webhook' && { method: 'GET' })
        };
        setNotifySettings({
            ...notifySettings,
            notification_receivers: [...notifySettings.notification_receivers, newReceiver]
        });
    };

    const removeReceiver = (id) => {
        setNotifySettings({
            ...notifySettings,
            notification_receivers: notifySettings.notification_receivers.filter(r => r.id !== id)
        });
    };

    const updateReceiver = (id, field, value) => {
        setNotifySettings({
            ...notifySettings,
            notification_receivers: notifySettings.notification_receivers.map(r =>
                r.id === id ? { ...r, [field]: value } : r
            )
        });
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

            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>通知开关</h3>

                <div className="space-y-3">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={notifySettings.notify_enabled}
                            onChange={(e) => setNotifySettings({ ...notifySettings, notify_enabled: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className={textPrimary}>启用通知</span>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={notifySettings.notify_on_download_start}
                            onChange={(e) => setNotifySettings({ ...notifySettings, notify_on_download_start: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className={textPrimary}>下载开始时通知</span>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={notifySettings.notify_on_rss_match}
                            onChange={(e) => setNotifySettings({ ...notifySettings, notify_on_rss_match: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className={textPrimary}>RSS 匹配时通知</span>
                    </label>
                </div>
            </Card>

            <Card darkMode={darkMode}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>通知接收器</h3>
                    <div className="flex gap-2">
                        <Button onClick={() => addReceiver('bark')} darkMode={darkMode} size="sm">
                            + Bark
                        </Button>
                        <Button onClick={() => addReceiver('webhook')} darkMode={darkMode} size="sm">
                            + Webhook
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {notifySettings.notification_receivers.map(receiver => (
                        <div key={receiver.id} className={`p-3 rounded border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <Input
                                    value={receiver.name}
                                    onChange={(e) => updateReceiver(receiver.id, 'name', e.target.value)}
                                    darkMode={darkMode}
                                    placeholder="接收器名称"
                                />
                                <button
                                    onClick={() => removeReceiver(receiver.id)}
                                    className="ml-2 text-red-500 hover:text-red-400"
                                >
                                    删除
                                </button>
                            </div>
                            <Input
                                value={receiver.url}
                                onChange={(e) => updateReceiver(receiver.id, 'url', e.target.value)}
                                darkMode={darkMode}
                                placeholder={receiver.type === 'bark' ? 'Bark URL' : 'Webhook URL'}
                            />
                            {receiver.type === 'webhook' && (
                                <select
                                    value={receiver.method}
                                    onChange={(e) => updateReceiver(receiver.id, 'method', e.target.value)}
                                    className={`mt-2 w-full px-3 py-2 rounded ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                </select>
                            )}
                        </div>
                    ))}

                    {notifySettings.notification_receivers.length === 0 && (
                        <p className={`text-center py-4 ${textSecondary}`}>
                            暂无接收器，点击上方按钮添加
                        </p>
                    )}
                </div>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} darkMode={darkMode}>
                    {saving ? '保存中...' : '保存设置'}
                </Button>
            </div>
        </div>
    );
};

export default NotificationSettings;
