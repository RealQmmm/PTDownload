import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SettingsPage = () => {
    const { darkMode, toggleDarkMode, siteName, setSiteName } = useTheme();
    const [subTab, setSubTab] = useState('general');
    const [tempSiteName, setTempSiteName] = useState(siteName);
    const [logSettings, setLogSettings] = useState({
        log_retention_days: '7',
        log_max_count: '100'
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

    const handleSaveGeneral = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_name: tempSiteName,
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={`text-sm font-medium ${textPrimary}`}>深色模式</p>
                                    <p className={`text-[10px] ${textSecondary}`}>切换系统的视觉主题</p>
                                </div>
                                <button
                                    onClick={toggleDarkMode}
                                    className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${darkMode ? 'left-6.5' : 'left-0.5'}`} />
                                </button>
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
                            { id: 'network', name: '网络', icon: '🌐' },
                            { id: 'about', name: '关于', icon: 'ℹ️' }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setSubTab(item.id)}
                                className={`flex-shrink-0 lg:flex-none flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${subTab === item.id
                                    ? 'bg-blue-600 text-white lg:bg-blue-600/20 lg:text-blue-400'
                                    : `${textSecondary} ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} hover:${textPrimary}`
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
