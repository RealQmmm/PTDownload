import React from 'react';
import { useTheme } from '../App';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const { darkMode, siteName, expiredCookiesCount, handleLogout } = useTheme();

    const menus = [
        { id: 'dashboard', name: '仪表盘', icon: '📊' },
        { id: 'search', name: '资源搜索', icon: '🔍', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'series', name: '我的追剧', icon: '📺', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'tasks', name: '自动任务', icon: '⏰', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'sites', name: '站点管理', icon: '🌐', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'clients', name: '下载客户端', icon: '📥', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'settings', name: '系统设置', icon: '⚙️', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'help', name: '使用帮助', icon: '❓', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
    ];

    const bgColor = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

    return (
        <div className={`w-64 ${bgColor} h-screen flex flex-col border-r ${borderColor}`}>
            <div className="p-6">
                <h1 className="text-2xl font-bold text-blue-400">{siteName}</h1>
            </div>
            <nav className="flex-1 px-4 space-y-2 mt-4">
                {menus.map((menu) => (
                    <button
                        key={menu.id}
                        onClick={() => setActiveTab(menu.id)}
                        className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === menu.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : `${textSecondary} ${hoverBg} hover:text-white`
                            }`}
                    >
                        <span className="mr-3 text-xl">{menu.icon}</span>
                        <span className="font-medium flex-1 text-left">{menu.name}</span>
                        {menu.badge && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {menu.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>
            <div className={`p-4 border-t ${borderColor}`}>
                <div className="flex items-center justify-between">
                    <div className={`flex items-center ${textSecondary} text-sm`}>
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        服务运行中
                    </div>
                    <button
                        onClick={handleLogout}
                        className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${textSecondary} ${hoverBg} hover:text-red-400`}
                    >
                        退出登录
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
