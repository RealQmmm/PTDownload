import React from 'react';
import { useTheme } from '../App';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const { darkMode, siteName, expiredCookiesCount, handleLogout } = useTheme();

    const menus = [
        { id: 'dashboard', name: '仪表盘', icon: '📊' },
        { id: 'search', name: '资源搜索', icon: '🔍' },
        { id: 'series', name: '我的追剧', icon: '📺' },
        { id: 'tasks', name: '自动任务', icon: '⏰' },
        { id: 'sites', name: '站点管理', icon: '🌐', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'clients', name: '下载客户端', icon: '📥' },
        { id: 'settings', name: '系统设置', icon: '⚙️' },
        { id: 'help', name: '使用帮助', icon: '❓' },
    ];

    return (
        <div className="w-64 bg-white dark:bg-surface-900 h-screen flex flex-col border-r border-gray-100 dark:border-gray-800 transition-colors duration-300">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                    {siteName}
                </h1>
            </div>
            <nav className="flex-1 px-4 space-y-2 mt-2 custom-scrollbar overflow-y-auto">
                {menus.map((menu) => {
                    const isActive = activeTab === menu.id;
                    return (
                        <button
                            key={menu.id}
                            onClick={() => setActiveTab(menu.id)}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 hover:text-primary-600 dark:hover:text-primary-400'
                                }`}
                        >
                            <span className={`mr-3 text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                {menu.icon}
                            </span>
                            <span className="font-medium flex-1 text-left">{menu.name}</span>

                            {/* Active Indicator Pulse */}
                            {isActive && (
                                <span className="absolute right-2 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse"></span>
                            )}

                            {menu.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm ${isActive
                                        ? 'bg-white text-primary-600'
                                        : 'bg-red-500 text-white'
                                    }`}>
                                    {menu.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-surface-800/50">
                    <div className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        运行正常
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-xs font-medium px-2 py-1 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                        退出
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
