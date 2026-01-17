import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import GeneralSettings from './settings/GeneralSettings';
import NotificationSettings from './settings/NotificationSettings';
import HotResourcesSettings from './settings/HotResourcesSettings';
import SecuritySettings from './settings/SecuritySettings';
import BackupSettings from './settings/BackupSettings';
import UserManagement from './settings/UserManagement';

/**
 * Refactored Settings Page
 * Uses modular sub-components for better maintainability
 */
const SettingsPageRefactored = () => {
    const { darkMode, siteName, setSiteName, authenticatedFetch, user } = useTheme();
    const [activeTab, setActiveTab] = useState('general');

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    // Define available tabs based on user permissions
    const tabs = [
        { id: 'general', label: '通用设置', component: GeneralSettings },
        { id: 'notifications', label: '通知设置', component: NotificationSettings },
        { id: 'hot-resources', label: '热门资源', component: HotResourcesSettings },
        { id: 'security', label: '安全设置', component: SecuritySettings },
        { id: 'backup', label: '备份与恢复', component: BackupSettings },
        // User management - admin only
        ...(user?.role === 'admin' ? [{ id: 'users', label: '用户管理', component: UserManagement }] : []),
        // { id: 'hot-resources', label: '热门资源', component: HotResourcesSettings },
        // { id: 'security', label: '安全设置', component: SecuritySettings },
        // { id: 'backup', label: '备份与恢复', component: BackupSettings },
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

    return (
        <div className="p-4 md:p-8">
            <h1 className={`text-3xl font-bold mb-6 ${textPrimary}`}>设置</h1>

            {/* Tab Navigation */}
            <div className={`flex gap-2 mb-6 border-b ${borderColor} overflow-x-auto`}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                            ? `${textPrimary} border-b-2 border-blue-500`
                            : `${textSecondary} hover:${textPrimary}`
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Active Tab Content */}
            <div>
                {ActiveComponent && (
                    <ActiveComponent
                        darkMode={darkMode}
                        authenticatedFetch={authenticatedFetch}
                        siteName={siteName}
                        setSiteName={setSiteName}
                        user={user}
                        currentUser={user}
                    />
                )}
            </div>
        </div>
    );
};

export default SettingsPageRefactored;
