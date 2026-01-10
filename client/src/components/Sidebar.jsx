import React from 'react';
import { useTheme } from '../App';

const Sidebar = ({ activeTab, setActiveTab, user, collapsed, onToggle }) => {
    const { darkMode, siteName, expiredCookiesCount, handleLogout, themeMode, setThemeMode } = useTheme();

    const getNextThemeMode = () => {
        if (themeMode === 'system') return 'light';
        if (themeMode === 'light') return 'dark';
        return 'system';
    };

    const themeIcons = {
        light: '☀️',
        dark: '🌙',
        system: '🖥️'
    };

    const allMenus = [
        { id: 'dashboard', name: '仪表盘', icon: '📊' },
        { id: 'search', name: '资源搜索', icon: '🔍' },
        { id: 'series', name: '我的追剧', icon: '📺' },
        { id: 'tasks', name: '自动任务', icon: '⏰' },
        { id: 'sites', name: '站点管理', icon: '🌐', badge: expiredCookiesCount > 0 ? expiredCookiesCount : null },
        { id: 'clients', name: '下载客户端', icon: '📥' },

        { id: 'settings', name: '系统设置', icon: '⚙️' },
        { id: 'help', name: '使用帮助', icon: '❓' },
    ];

    // Filter menus based on user permissions
    let allowedMenus = [];
    if (user?.role === 'admin') {
        allowedMenus = allMenus.map(m => m.id);
    } else {
        let permissions = null;
        if (user?.permissions) {
            try {
                permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            } catch (e) {
                console.error('Parse permissions error', e);
            }
        }

        // Priority: 1. permission.menus (even if empty) 2. default fallback (only if no permissions at all)
        if (permissions && Array.isArray(permissions.menus)) {
            allowedMenus = permissions.menus;
        } else {
            allowedMenus = ['dashboard', 'search', 'series', 'help'];
        }
    }

    const menus = allMenus.filter(m => allowedMenus.includes(m.id));

    return (
        <div className={`${collapsed ? 'lg:w-20' : 'lg:w-64'} w-64 bg-white dark:bg-surface-900 h-full flex flex-col border-r border-gray-100 dark:border-gray-800 transition-all duration-300 relative group/sidebar`}>
            {/* Collapse Toggle Button (PC only) */}
            <button
                onClick={onToggle}
                className={`hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-surface-800 border border-gray-100 dark:border-gray-700 rounded-full items-center justify-center shadow-sm z-50 hover:text-primary-500 transition-colors`}
            >
                <span className={`text-[10px] transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>◀</span>
            </button>

            <div className={`p-6 shrink-0 flex items-center ${collapsed ? 'justify-center transition-all' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center justify-between w-full overflow-hidden">
                        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600 truncate mr-2">
                            {siteName}
                        </h1>
                        {/* Theme Toggle Button (PC only in Sidebar) */}
                        <button
                            onClick={() => setThemeMode(getNextThemeMode())}
                            className={`hidden lg:flex p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors text-sm shrink-0`}
                            title={`当前模式: ${themeMode === 'system' ? '系统' : themeMode === 'light' ? '浅色' : '深色'}`}
                        >
                            {themeIcons[themeMode]}
                        </button>
                    </div>
                )}
                {collapsed && (
                    <div className="hidden lg:flex w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/20">
                        {siteName.charAt(0)}
                    </div>
                )}

                {/* Mobile Logout (Visible only on mobile header) */}
                <button
                    onClick={handleLogout}
                    className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="退出登录"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>

            <nav className={`flex-1 ${collapsed ? 'lg:px-2' : 'px-4'} px-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar min-h-0`}>
                {menus.map((menu) => {
                    const isActive = activeTab === menu.id;
                    return (
                        <button
                            key={menu.id}
                            onClick={() => setActiveTab(menu.id)}
                            title={collapsed ? menu.name : ''}
                            className={`w-full flex items-center ${collapsed ? 'lg:justify-center' : 'px-4'} px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden shrink-0 ${isActive
                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 hover:text-primary-600 dark:hover:text-primary-400'
                                }`}
                        >
                            <span className={`text-xl transition-transform duration-200 ${collapsed ? 'lg:mr-0 mr-3' : 'mr-3'} ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                {menu.icon}
                            </span>
                            <span className={`font-medium flex-1 text-left truncate ${collapsed ? 'lg:hidden' : ''}`}>{menu.name}</span>

                            {/* Active Indicator Pulse */}
                            {isActive && (collapsed ? 'lg:hidden' : 'block') && (
                                <span className={`absolute right-2 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse ${collapsed ? 'lg:hidden' : ''}`}></span>
                            )}

                            {menu.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm ${collapsed ? 'lg:absolute lg:top-1 lg:right-1' : ''} ${isActive
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

            <div className={`p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-surface-900 hidden lg:block`}>
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl bg-gray-50 dark:bg-surface-800/50`}>
                    {!collapsed && (
                        <div className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 overflow-hidden">
                            <span className="relative flex h-2 w-2 mr-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="truncate">{user?.username || '运行正常'}</span>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        title={collapsed ? '退出登录' : ''}
                        className={`text-xs font-medium rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 ${collapsed ? 'p-2' : 'px-2 py-1'} flex items-center justify-center`}
                    >
                        <svg className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4 mr-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {!collapsed && <span>退出</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
