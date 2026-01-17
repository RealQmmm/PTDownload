import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSettings } from './hooks/useSettings';

/**
 * General Settings Component
 * Handles: Site name, search limits, intervals, TMDB settings
 */
const GeneralSettings = ({
    darkMode,
    authenticatedFetch,
    siteName,
    setSiteName
}) => {
    const { saving, message, saveSettings } = useSettings(authenticatedFetch);

    // Local state
    const [tempSiteName, setTempSiteName] = useState(siteName);
    const [searchLimit, setSearchLimit] = useState('1');
    const [cookieCheckInterval, setCookieCheckInterval] = useState('60');
    const [checkinTime, setCheckinTime] = useState('09:00');
    const [rssCacheTTL, setRssCacheTTL] = useState('300');
    const [dashboardActiveInterval, setDashboardActiveInterval] = useState('10');
    const [dashboardIdleInterval, setDashboardIdleInterval] = useState('30');

    // TMDB Settings
    const [showTmdbDetails, setShowTmdbDetails] = useState(false);
    const [tmdbSettings, setTmdbSettings] = useState({
        tmdb_api_key: '',
        tmdb_base_url: '',
        tmdb_image_base_url: ''
    });

    // Theme helpers
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    const handleSave = async () => {
        const result = await saveSettings({
            site_name: tempSiteName,
            search_page_limit: searchLimit,
            cookie_check_interval: cookieCheckInterval,
            checkin_time: checkinTime,
            rss_cache_ttl: rssCacheTTL,
            dashboard_active_interval: dashboardActiveInterval,
            dashboard_idle_interval: dashboardIdleInterval,
            ...tmdbSettings
        });

        if (result.success) {
            setSiteName(tempSiteName);
        }
    };

    return (
        <div className="space-y-6">
            {/* Message Display */}
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Basic Settings */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>基础设置</h3>

                <div className="space-y-4">
                    <Input
                        label="站点名称"
                        value={tempSiteName}
                        onChange={(e) => setTempSiteName(e.target.value)}
                        darkMode={darkMode}
                    />

                    <Input
                        label="搜索页数限制"
                        type="number"
                        value={searchLimit}
                        onChange={(e) => setSearchLimit(e.target.value)}
                        darkMode={darkMode}
                        min="1"
                        max="10"
                    />

                    <Input
                        label="Cookie 检查间隔 (分钟)"
                        type="number"
                        value={cookieCheckInterval}
                        onChange={(e) => setCookieCheckInterval(e.target.value)}
                        darkMode={darkMode}
                    />

                    <Input
                        label="自动签到时间"
                        type="time"
                        value={checkinTime}
                        onChange={(e) => setCheckinTime(e.target.value)}
                        darkMode={darkMode}
                    />
                </div>
            </Card>

            {/* Performance Settings */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>性能设置</h3>

                <div className="space-y-4">
                    <Input
                        label="RSS 缓存时间 (秒)"
                        type="number"
                        value={rssCacheTTL}
                        onChange={(e) => setRssCacheTTL(e.target.value)}
                        darkMode={darkMode}
                        min="60"
                    />

                    <Input
                        label="仪表盘活跃刷新间隔 (秒)"
                        type="number"
                        value={dashboardActiveInterval}
                        onChange={(e) => setDashboardActiveInterval(e.target.value)}
                        darkMode={darkMode}
                        min="5"
                    />

                    <Input
                        label="仪表盘空闲刷新间隔 (秒)"
                        type="number"
                        value={dashboardIdleInterval}
                        onChange={(e) => setDashboardIdleInterval(e.target.value)}
                        darkMode={darkMode}
                        min="10"
                    />
                </div>
            </Card>

            {/* TMDB Settings (Collapsible) */}
            <Card darkMode={darkMode}>
                <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setShowTmdbDetails(!showTmdbDetails)}
                >
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>TMDB 设置</h3>
                    <span className={textSecondary}>{showTmdbDetails ? '▼' : '▶'}</span>
                </div>

                {showTmdbDetails && (
                    <div className="mt-4 space-y-4">
                        <Input
                            label="API Key"
                            value={tmdbSettings.tmdb_api_key}
                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_api_key: e.target.value })}
                            darkMode={darkMode}
                        />
                        <Input
                            label="Base URL"
                            value={tmdbSettings.tmdb_base_url}
                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_base_url: e.target.value })}
                            darkMode={darkMode}
                        />
                        <Input
                            label="Image Base URL"
                            value={tmdbSettings.tmdb_image_base_url}
                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_image_base_url: e.target.value })}
                            darkMode={darkMode}
                        />
                    </div>
                )}
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    darkMode={darkMode}
                >
                    {saving ? '保存中...' : '保存设置'}
                </Button>
            </div>
        </div>
    );
};

export default GeneralSettings;
