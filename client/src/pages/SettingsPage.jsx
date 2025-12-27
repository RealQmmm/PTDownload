import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SettingsPage = () => {
    const { darkMode, toggleDarkMode, siteName, setSiteName } = useTheme();
    const [subTab, setSubTab] = useState('general');
    const [tempSiteName, setTempSiteName] = useState(siteName);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        setTempSiteName(siteName);
    }, [siteName]);

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
                body: JSON.stringify({ site_name: tempSiteName })
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
                    <div className="space-y-6">
                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}
                        <div>
                            <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>站点设置</h3>
                            <div className={`${bgSecondary} p-4 rounded-lg border ${borderColor} space-y-4`}>
                                <div>
                                    <label className={`block text-sm ${textSecondary} mb-1`}>站点名称</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            value={tempSiteName}
                                            onChange={(e) => setTempSiteName(e.target.value)}
                                            className={`flex-1 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded px-3 py-2 ${textPrimary} focus:border-blue-500 outline-none`}
                                            placeholder="PT Manager"
                                        />
                                        <button
                                            onClick={handleSaveGeneral}
                                            disabled={saving}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                                        >
                                            {saving ? '保存中...' : '保存'}
                                        </button>
                                    </div>
                                    <p className={`text-xs ${textSecondary} mt-1`}>显示在侧边栏顶部的名称</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>界面设置</h3>
                            <div className={`flex items-center justify-between p-4 ${bgSecondary} rounded-lg border ${borderColor}`}>
                                <div>
                                    <h4 className={`${textPrimary} font-medium`}>深色模式</h4>
                                    <p className={`text-sm ${textSecondary}`}>
                                        {darkMode ? '当前使用深色主题' : '当前使用浅色主题'}
                                    </p>
                                </div>
                                <button
                                    onClick={toggleDarkMode}
                                    className={`relative inline-block w-14 h-7 transition duration-200 ease-in-out rounded-full cursor-pointer ${darkMode ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${darkMode ? 'left-7' : 'left-0.5'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <div>
                            <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>语言</h3>
                            <select className={`w-full ${bgSecondary} border ${borderColor} rounded-lg px-4 py-2 ${textPrimary} outline-none focus:border-blue-500`}>
                                <option>简体中文</option>
                                <option>English</option>
                            </select>
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
