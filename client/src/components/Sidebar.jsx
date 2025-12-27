import React from 'react';
import { useTheme } from '../App';

const Sidebar = ({ activeTab, setActiveTab }) => {
    const { darkMode } = useTheme();

    const menus = [
        { id: 'dashboard', name: '仪表盘', icon: '📊' },
        { id: 'search', name: '资源搜索', icon: '🔍' },
        { id: 'sites', name: '站点管理', icon: '🌐' },
        { id: 'clients', name: '下载客户', icon: '📥' },
        { id: 'tasks', name: '自动任务', icon: '⏰' },
        { id: 'settings', name: '系统设置', icon: '⚙️' },
    ];

    const bgColor = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

    return (
        <div className={`w-64 ${bgColor} h-screen flex flex-col border-r ${borderColor}`}>
            <div className="p-6">
                <h1 className="text-2xl font-bold text-blue-400">PT Manager</h1>
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
                        <span className="font-medium">{menu.name}</span>
                    </button>
                ))}
            </nav>
            <div className={`p-4 border-t ${borderColor}`}>
                <div className={`flex items-center ${textSecondary} text-sm`}>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    服务运行中
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
