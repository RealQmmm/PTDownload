import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SettingsPage = () => {
    const { darkMode, themeMode, setThemeMode, siteName, setSiteName } = useTheme();
    const [subTab, setSubTab] = useState('general');
    const [tempSiteName, setTempSiteName] = useState(siteName);
    const [logSettings, setLogSettings] = useState({
        log_retention_days: '7',
        log_max_count: '100'
    });
    const [searchLimit, setSearchLimit] = useState('1');
    const [notifySettings, setNotifySettings] = useState({
        notify_enabled: false,
        notify_bark_url: '',
        notify_webhook_url: '',
        notify_webhook_method: 'GET'
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        setTempSiteName(siteName);
        fetchSettings();
    }, [siteName]);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setLogSettings({
                log_retention_days: data.log_retention_days || '7',
                log_max_count: data.log_max_count || '100'
            });
            setSearchLimit(data.search_page_limit || '1');
            setNotifySettings({
                notify_enabled: data.notify_enabled === 'true',
                notify_bark_url: data.notify_bark_url || '',
                notify_webhook_url: data.notify_webhook_url || '',
                notify_webhook_method: data.notify_webhook_method || 'GET'
            });
        } catch (err) {
            console.error('Fetch settings failed:', err);
        }
    };

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

    const handleSaveGeneral = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_name: tempSiteName,
                    search_page_limit: searchLimit,
                    ...logSettings
                })
            });
            if (res.ok) {
                setSiteName(tempSiteName);
                setMessage({ type: 'success', text: '设置已保存' });
            } else {
                setMessage({ type: 'error', text: '保存失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '保存出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleSaveNotify = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notifySettings)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: '通知设置已保存' });
            } else {
                setMessage({ type: 'error', text: '保存失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '保存出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleTestNotify = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings/test-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🔔 PT Manager 测试通知',
                    message: '如果您收到了这条消息，说明您的通知配置工作正常。',
                    config: {
                        enabled: notifySettings.notify_enabled,
                        barkUrl: notifySettings.notify_bark_url,
                        webhookUrl: notifySettings.notify_webhook_url,
                        webhookMethod: notifySettings.notify_webhook_method
                    }
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message || '测试通知已发送' });
            } else {
                setMessage({ type: 'error', text: data.error || '发送失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '请求失败' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleExport = () => {
        window.location.href = '/api/settings/export';
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('导入备份将覆盖当前所有数据（站点、任务、统计等）！确定要继续吗？')) {
            e.target.value = '';
            return;
        }

        setSaving(true);
        setMessage(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const res = await fetch('/api/settings/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();
                if (res.ok) {
                    setMessage({ type: 'success', text: result.message || '导入成功' });
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    setMessage({ type: 'error', text: result.error || '导入失败' });
                }
            } catch (err) {
                setMessage({ type: 'error', text: '文件解析失败，请确保是有效的 JSON 备份文件' });
            } finally {
                setSaving(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const renderContent = () => {
        switch (subTab) {
            case 'general':
                return (
                    <div className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={`${bgSecondary} p-4 rounded-xl border ${borderColor} space-y-6`}>
                            {/* Section 1: Site Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-2 uppercase tracking-wider`}>站点名称</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            value={tempSiteName}
                                            onChange={(e) => setTempSiteName(e.target.value)}
                                            className={`flex-1 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1.5 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                            placeholder="PT Manager"
                                        />
                                    </div>
                                    <p className={`text-[10px] ${textSecondary} mt-1`}>侧边栏顶部显示的名称</p>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-2 uppercase tracking-wider`}>界面语言</label>
                                    <select className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1.5 text-sm ${textPrimary} outline-none focus:border-blue-500`}>
                                        <option>简体中文</option>
                                        <option>English</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-2 uppercase tracking-wider`}>搜索抓取页数</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={searchLimit}
                                        onChange={(e) => setSearchLimit(e.target.value)}
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1.5 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                        title="每次搜索时抓取的最大页数"
                                    />
                                </div>
                                <p className={`text-[10px] ${textSecondary} mt-1`}>每次搜索请求抓取的页面数量 (1-50)</p>
                            </div>

                            <hr className={borderColor} />

                            {/* Section 2: Log Management */}
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>日志清理逻辑</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>保留天数</p>
                                            <p className={`text-[10px] ${textSecondary}`}>自动清理超过此天数的日志</p>
                                        </div>
                                        <input
                                            type="number"
                                            value={logSettings.log_retention_days}
                                            onChange={(e) => setLogSettings({ ...logSettings, log_retention_days: e.target.value })}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>最大条数/任务</p>
                                            <p className={`text-[10px] ${textSecondary}`}>每个任务保留的最新的日志数</p>
                                        </div>
                                        <input
                                            type="number"
                                            value={logSettings.log_max_count}
                                            onChange={(e) => setLogSettings({ ...logSettings, log_max_count: e.target.value })}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className={borderColor} />

                            {/* Section 3: Interface */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                                <div>
                                    <p className={`text-sm font-medium ${textPrimary}`}>视觉主题</p>
                                    <p className={`text-[10px] ${textSecondary}`}>选择您偏好的界面显示模式</p>
                                </div>
                                <div className={`flex items-center ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} p-1 rounded-lg border ${borderColor}`}>
                                    {[
                                        { id: 'light', name: '浅色', icon: '☀️' },
                                        { id: 'dark', name: '深色', icon: '🌙' },
                                        { id: 'system', name: '系统', icon: '🖥️' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setThemeMode(mode.id)}
                                            className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center space-x-1.5 ${themeMode === mode.id
                                                ? 'bg-blue-600 text-white shadow-sm font-bold'
                                                : `${textSecondary} hover:${textPrimary} hover:bg-gray-200/50 dark:hover:bg-gray-600/30`}`}
                                        >
                                            <span>{mode.icon}</span>
                                            <span>{mode.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Save Button Row */}
                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={handleSaveGeneral}
                                    disabled={saving}
                                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-bold text-sm disabled:opacity-50 shadow-lg shadow-blue-600/20"
                                >
                                    {saving ? '保存中...' : '提交所有设置'}
                                </button>
                            </div>
                        </div>
                    </div >
                );
            case 'notifications':
                return (
                    <div className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={`${bgSecondary} p-6 rounded-xl border ${borderColor} space-y-8`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className={`text-sm font-bold ${textPrimary}`}>推送通知</h3>
                                    <p className={`text-[10px] ${textSecondary}`}>在 RSS 匹配到合适资源并成功下种时发送通知</p>
                                </div>
                                <button
                                    onClick={() => setNotifySettings({ ...notifySettings, notify_enabled: !notifySettings.notify_enabled })}
                                    className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${notifySettings.notify_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${notifySettings.notify_enabled ? 'left-6.5' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <hr className={borderColor} />

                            <div className={`space-y-6 ${notifySettings.notify_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>Bark 通知 (iOS 专用)</label>
                                    <input
                                        type="text"
                                        value={notifySettings.notify_bark_url}
                                        onChange={(e) => setNotifySettings({ ...notifySettings, notify_bark_url: e.target.value })}
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-4 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                        placeholder="例如: https://api.day.app/YourKey"
                                    />
                                    <p className={`text-[10px] ${textSecondary} mt-2`}>留空则不使用。推送内容将自动追加到 URL 后方。</p>
                                </div>

                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>自定义 Webhook</label>
                                    <div className="flex space-x-2 mb-2">
                                        <select
                                            value={notifySettings.notify_webhook_method}
                                            onChange={(e) => setNotifySettings({ ...notifySettings, notify_webhook_method: e.target.value })}
                                            className={`w-24 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-2 text-sm ${textPrimary} outline-none focus:border-blue-500`}
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={notifySettings.notify_webhook_url}
                                            onChange={(e) => setNotifySettings({ ...notifySettings, notify_webhook_url: e.target.value })}
                                            className={`flex-1 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-4 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                            placeholder="https://example.com/api/notify"
                                        />
                                    </div>
                                    <p className={`text-[10px] ${textSecondary}`}>GET 方式将通过 Query 参数提交 title 和 message；POST 方式将发送 JSON Body。</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button
                                    onClick={handleTestNotify}
                                    disabled={saving || !notifySettings.notify_enabled}
                                    className={`px-6 py-2 border ${borderColor} ${textSecondary} hover:${textPrimary} rounded-lg transition-all font-bold text-sm disabled:opacity-30`}
                                >
                                    发送测试通知
                                </button>
                                <button
                                    onClick={handleSaveNotify}
                                    disabled={saving}
                                    className="px-10 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-bold text-sm disabled:opacity-50 shadow-lg shadow-blue-600/20"
                                >
                                    {saving ? '保存中...' : '保存通知设置'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'backup':
                return (
                    <div className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={`${bgSecondary} p-6 rounded-xl border ${borderColor} space-y-8`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider`}>导出数据</h3>
                                    <p className={`text-xs ${textSecondary}`}>
                                        点击下方按钮将下载一个包含所有配置、站点、任务、客户端及历史统计数据的 JSON 文件。
                                    </p>
                                    <button
                                        onClick={handleExport}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        立即导出备份
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider`}>导入数据</h3>
                                    <p className={`text-xs ${textSecondary}`}>
                                        警告：导入操作将清除并替换掉当前系统中所有的现有数据。请谨慎操作。
                                    </p>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImport}
                                            disabled={saving}
                                            className="hidden"
                                            id="import-backup"
                                        />
                                        <label
                                            htmlFor="import-backup"
                                            className={`flex items-center justify-center w-full py-3 border-2 border-dashed ${borderColor} rounded-lg cursor-pointer ${hoverBg} transition-all font-bold text-sm ${textPrimary}`}
                                        >
                                            {saving ? '正在导入...' : '选择备份文件并导入'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3`}>
                                <span className="text-xl">⚠️</span>
                                <div className="text-xs text-amber-500">
                                    <p className="font-bold mb-1">提示事项：</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>导入成功后应用会自动刷新页面。</li>
                                        <li>如果导入的是在不同环境下生成的备份，请确保站点 Cookies 与客户端地址仍然有效。</li>
                                        <li>建议在执行重大更新或迁移服务器前先手动导出一份备份。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'network':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>代理设置</h3>
                            <div className={`${bgSecondary} rounded-lg p-4 border ${borderColor} space-y-4`}>
                                <div>
                                    <label className={`block text-sm ${textSecondary} mb-1`}>HTTP 代理</label>
                                    <input
                                        type="text"
                                        placeholder="http://127.0.0.1:7890"
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded px-3 py-2 ${textPrimary}`}
                                        disabled
                                    />
                                </div>
                                <p className="text-xs text-yellow-500">代理功能开发中...</p>
                            </div>
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="text-center py-10">
                        <div className="text-4xl mb-4">📦</div>
                        <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>PT Download Manager</h2>
                        <p className={textSecondary}>Version 0.1.0 (Alpha)</p>
                        <div className={`mt-8 p-4 ${bgSecondary} rounded-lg border ${borderColor} text-left text-sm ${textSecondary}`}>
                            <p>Powered by React, Express, and Docker.</p>
                            <p className="mt-2">Made with ❤️ for PT users.</p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary} mb-6 md:mb-8`}>系统设置</h1>

            <div className={`flex-1 flex flex-col lg:flex-row ${bgMain} rounded-xl border ${borderColor} overflow-hidden`}>
                {/* Settings Navigation */}
                <div className={`w-full lg:w-48 ${bgMain} border-b lg:border-b-0 lg:border-r ${borderColor} p-2 md:p-4`}>
                    <nav className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                        {[
                            { id: 'general', name: '通用', icon: '⚙️' },
                            { id: 'notifications', name: '通知', icon: '🔔' },
                            { id: 'backup', name: '备份', icon: '💾' },
                            { id: 'network', name: '网络', icon: '🌐' },
                            { id: 'about', name: '关于', icon: 'ℹ️' }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setSubTab(item.id)}
                                className={`flex-shrink-0 lg:flex-none flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${subTab === item.id
                                    ? 'bg-blue-600 text-white lg:bg-blue-600/20 lg:text-blue-400'
                                    : `${textSecondary} ${hoverBg} hover:${textPrimary}`
                                    }`}
                            >
                                <span className="mr-2 lg:mr-3">{item.icon}</span>
                                {item.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Settings Content */}
                <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
