import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import LogsPage from './LogsPage';

const SettingsPage = () => {
    const { darkMode, themeMode, setThemeMode, siteName, setSiteName, authenticatedFetch } = useTheme();
    const [subTab, setSubTab] = useState('general');
    const [tempSiteName, setTempSiteName] = useState(siteName);
    const [logSettings, setLogSettings] = useState({
        log_retention_days: '7',
        log_max_count: '100',
        enable_system_logs: false
    });
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [searchLimit, setSearchLimit] = useState('1');
    const [searchMode, setSearchMode] = useState('browse');
    const [tmdbSettings, setTmdbSettings] = useState({
        tmdb_api_key: '',
        tmdb_base_url: '',
        tmdb_image_base_url: ''
    });

    const handleSavePassword = async () => {
        if (!passwordData.oldPassword || !passwordData.newPassword) {
            setMessage({ type: 'error', text: '请填写完整信息' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: '两次输入的新密码不一致' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldPassword: passwordData.oldPassword,
                    newPassword: passwordData.newPassword
                })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: '密码修改成功' });
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setMessage({ type: 'error', text: data.error || '修改失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '请求出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };


    const [notifySettings, setNotifySettings] = useState({
        notify_enabled: false,
        notify_on_download_start: false,
        notification_receivers: [] // JSONArray of {id, type, name, url, method, enabled}
    });
    const [securitySettings, setSecuritySettings] = useState({
        security_login_limit: '5'
    });
    const [cleanupSettings, setCleanupSettings] = useState({
        cleanup_enabled: false,
        cleanup_min_ratio: '2.0',
        cleanup_max_seeding_time: '336',
        cleanup_delete_files: true
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [cookieCheckInterval, setCookieCheckInterval] = useState('60');
    const [checkinTime, setCheckinTime] = useState('09:00');
    const [rssCacheTTL, setRssCacheTTL] = useState('300');

    useEffect(() => {
        setTempSiteName(siteName);
        fetchSettings();
    }, [siteName]);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();
            setLogSettings({
                log_retention_days: data.log_retention_days || '7',
                log_max_count: data.log_max_count || '100',
                enable_system_logs: data.enable_system_logs === 'true'
            });
            setSearchLimit(data.search_page_limit || '1');
            setSearchMode(data.search_mode || 'browse');
            setTmdbSettings({
                tmdb_api_key: data.tmdb_api_key || '',
                tmdb_base_url: data.tmdb_base_url || '',
                tmdb_image_base_url: data.tmdb_image_base_url || ''
            });
            setSecuritySettings({
                security_login_limit: data.security_login_limit || '5'
            });

            const newNotifySettings = {
                notify_enabled: data.notify_enabled === 'true',
                notify_on_download_start: data.notify_on_download_start === 'true',
                notification_receivers: []
            };

            if (data.notification_receivers) {
                try {
                    const receivers = JSON.parse(data.notification_receivers);
                    newNotifySettings.notification_receivers = receivers;
                } catch (e) { console.error('Parse error', e); }
            } else if (data.notify_bark_url || data.notify_webhook_url) {
                // Migration from old fields if new field is empty
                const migrated = [];
                if (data.notify_bark_url) {
                    migrated.push({ id: crypto.randomUUID(), type: 'bark', name: '默认 Bark', url: data.notify_bark_url, enabled: true });
                }
                if (data.notify_webhook_url) {
                    migrated.push({ id: crypto.randomUUID(), type: 'webhook', name: '默认 Webhook', url: data.notify_webhook_url, method: data.notify_webhook_method || 'GET', enabled: true });
                }
                newNotifySettings.notification_receivers = migrated;
            }
            setNotifySettings(newNotifySettings);
            setCleanupSettings({
                cleanup_enabled: data.cleanup_enabled === 'true',
                cleanup_min_ratio: data.cleanup_min_ratio || '2.0',
                cleanup_max_seeding_time: data.cleanup_max_seeding_time || '336',
                cleanup_delete_files: data.cleanup_delete_files === undefined || data.cleanup_delete_files === 'true'
            });
            setCookieCheckInterval(data.cookie_check_interval || '60');
            setCheckinTime(data.checkin_time || '09:00');
            setRssCacheTTL(data.rss_cache_ttl || '300');
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
    const activeSelectionClass = darkMode ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50';

    const handleSaveGeneral = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_name: tempSiteName,
                    search_page_limit: searchLimit,
                    search_mode: searchMode,
                    cookie_check_interval: cookieCheckInterval,
                    checkin_time: checkinTime,
                    rss_cache_ttl: rssCacheTTL,
                    ...logSettings,
                    ...securitySettings,
                    ...tmdbSettings
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
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...notifySettings,
                    notification_receivers: JSON.stringify(notifySettings.notification_receivers) // Send as JSON string for storage
                })
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
            const res = await authenticatedFetch('/api/settings/test-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🔔 PT Manager 测试通知',
                    message: '如果您收到了这条消息，说明您的通知配置工作正常。',
                    config: {
                        enabled: notifySettings.notify_enabled,
                        receivers: notifySettings.notification_receivers
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

    const handleExport = async () => {
        try {
            const res = await authenticatedFetch('/api/settings/export');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pt-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('导出失败');
            }
        } catch (err) {
            alert('导出出错');
        }
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
                const res = await authenticatedFetch('/api/settings/import', {
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

    const handleSyncHistory = async () => {
        if (!confirm('此操作将扫描所有下载客户端中的种子，并更新历史记录的完成时间、创建时间及完成状态。确定要继续吗？')) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings/maintenance/sync-history', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message || '历史数据同步成功' });
            } else {
                setMessage({ type: 'error', text: data.error || '同步失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '请求出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleClearTasks = async () => {
        if (!confirm('警告：此操作将永久删除所有 RSS 运行日志和已下载资源的记录！确定要开始初始化吗？')) return;
        setSaving(true);
        try {
            const res = await authenticatedFetch('/api/settings/maintenance/clear-tasks', { method: 'POST' });
            const data = await res.json();
            if (res.ok) setMessage({ type: 'success', text: data.message });
            else setMessage({ type: 'error', text: data.error });
        } catch (err) {
            setMessage({ type: 'error', text: '请求出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleClearHeatmap = async () => {
        if (!confirm('警告：此操作将永久清空所有站点的历史上传贡献数据！确定要继续吗？')) return;
        setSaving(true);
        try {
            const res = await authenticatedFetch('/api/settings/maintenance/clear-heatmap', { method: 'POST' });
            const data = await res.json();
            if (res.ok) setMessage({ type: 'success', text: data.message });
            else setMessage({ type: 'error', text: data.error });
        } catch (err) {
            setMessage({ type: 'error', text: '请求出错' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleSaveCleanup = async (newValue) => {
        // If enabling, show warning
        if (newValue && !confirm('⚠️ 严重警告 ⚠️\n\n开启此功能后，系统将自动删除满足条件的种子和已下载的资源(根据设置的选项)！\n\n请务必确认：\n1. 您已设置了合理的“最小分享率”和“最长做种时间”。\n2. 您了解此操作是不可逆的。\n\n是否确认开启？')) {
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const newSettings = {
                ...cleanupSettings,
                cleanup_enabled: newValue
            };

            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });

            if (res.ok) {
                setCleanupSettings(newSettings);
                setMessage({ type: 'success', text: newValue ? '自动清理已开启' : '自动清理已关闭' });
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

    const handleSaveCleanupConfig = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanupSettings)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: '清理策略已保存' });
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

                            {/* Section 2: Log & Sync Management */}
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>日志与同步设置</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>日志保留天数</p>
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
                                            <p className={`text-sm ${textPrimary} font-medium`}>最大日志条数/任务</p>
                                            <p className={`text-[10px] ${textSecondary}`}>每个任务最大保留条目数</p>
                                        </div>
                                        <input
                                            type="number"
                                            value={logSettings.log_max_count}
                                            onChange={(e) => setLogSettings({ ...logSettings, log_max_count: e.target.value })}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>站点数据检查间隔 (分钟)</p>
                                            <p className={`text-[10px] ${textSecondary}`}>后台自动检查站点数据的频率(包含Cookie检查)</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="5"
                                            value={cookieCheckInterval}
                                            onChange={(e) => setCookieCheckInterval(e.target.value)}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>每日自动签到时间</p>
                                            <p className={`text-[10px] ${textSecondary}`}>PT 站点每日自动打卡时间</p>
                                        </div>
                                        <input
                                            type="time"
                                            value={checkinTime}
                                            onChange={(e) => setCheckinTime(e.target.value)}
                                            className={`w-32 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center outline-none focus:border-blue-500`}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>RSS 缓存时间 (秒)</p>
                                            <p className={`text-[10px] ${textSecondary}`}>同一 RSS 源的缓存有效期，减少重复请求 (推荐: 300)</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="60"
                                            max="3600"
                                            value={rssCacheTTL}
                                            onChange={(e) => setRssCacheTTL(e.target.value)}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                </div>
                            </div>


                            <hr className={borderColor} />

                            {/* Section: Security Settings */}
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>安全设置</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${textPrimary} font-medium`}>登录限流 (次/分钟)</p>
                                            <p className={`text-[10px] ${textSecondary}`}>同一 IP 每分钟允许的最大失败尝试次数(推荐: 3-5)</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={securitySettings?.security_login_limit || '5'}
                                            onChange={(e) => setSecuritySettings({ ...securitySettings, security_login_limit: e.target.value })}
                                            className={`w-20 ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-1 text-sm ${textPrimary} text-center`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className={borderColor} />

                            {/* Section: Search Mode */}
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>搜索模式</label>
                                <div className="space-y-4">
                                    <div>
                                        <label className={`block text-sm font-medium ${textSecondary} mb-2`}>搜索结果最大页数 (1-10)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={searchLimit}
                                            onChange={(e) => setSearchLimit(e.target.value)}
                                            disabled={searchMode === 'rss'}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none ${searchMode === 'rss' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                        {searchMode === 'rss' && <p className="text-xs text-yellow-500 mt-1">RSS 模式下不支持分页限制，默认返回前 50 条</p>}
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium ${textSecondary} mb-2`}>搜索模式</label>
                                        <div className="flex space-x-4">
                                            <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border ${searchMode === 'browse' ? activeSelectionClass : borderColor}`}>
                                                <input
                                                    type="radio"
                                                    name="search_mode"
                                                    value="browse"
                                                    checked={searchMode === 'browse'}
                                                    onChange={(e) => setSearchMode(e.target.value)}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className={`font-medium ${textPrimary}`}>网页解析 (默认)</div>
                                                    <div className="text-xs text-gray-500">模拟浏览器访问搜索页面解析结果</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border ${searchMode === 'rss' ? activeSelectionClass : borderColor}`}>
                                                <input
                                                    type="radio"
                                                    name="search_mode"
                                                    value="rss"
                                                    checked={searchMode === 'rss'}
                                                    onChange={(e) => setSearchMode(e.target.value)}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className={`font-medium ${textPrimary}`}>RSS 订阅源</div>
                                                    <div className="text-xs text-gray-500">使用 RSS 接口搜索，兼容性更好</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className={borderColor} />

                            {/* Section: TMDB Settings */}
                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-3 uppercase tracking-wider`}>TMDB 刮削设置 (图片/元数据)</label>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className={`block text-xs ${textSecondary} mb-1`}>API Key</label>
                                        <input
                                            type="text"
                                            value={tmdbSettings.tmdb_api_key}
                                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_api_key: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                            placeholder="例如: 107492d..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs ${textSecondary} mb-1`}>API Base URL (可用于代理)</label>
                                            <input
                                                type="text"
                                                value={tmdbSettings.tmdb_base_url}
                                                onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_base_url: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                                placeholder="默认: https://api.themoviedb.org/3"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs ${textSecondary} mb-1`}>Image Base URL</label>
                                            <input
                                                type="text"
                                                value={tmdbSettings.tmdb_image_base_url}
                                                onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_image_base_url: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                                placeholder="默认: https://image.tmdb.org/t/p/w300"
                                            />
                                        </div>
                                    </div>
                                    <p className={`text-[10px] ${textSecondary}`}>注意: 如果您在国内无法访问 TMDB，请修改 Base URL 为可用的镜像或反代地址。</p>
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
                                    <h3 className={`text-sm font-bold ${textPrimary}`}>资源下载通知</h3>
                                    <p className={`text-[10px] ${textSecondary}`}>当 RSS 自动匹配或手动搜索点击下载时发送通知</p>
                                </div>
                                <button
                                    onClick={() => setNotifySettings({ ...notifySettings, notify_on_download_start: !notifySettings.notify_on_download_start })}
                                    className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${notifySettings.notify_on_download_start ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${notifySettings.notify_on_download_start ? 'left-6.5' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <hr className={borderColor} />

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className={`block text-xs font-bold ${textSecondary} uppercase tracking-wider`}>通知接收端 ({notifySettings.notification_receivers.length})</label>
                                        <button
                                            onClick={() => {
                                                const newReceiver = {
                                                    id: crypto.randomUUID(),
                                                    type: 'bark',
                                                    name: '新接收端',
                                                    url: '',
                                                    enabled: true,
                                                    method: 'GET'
                                                };
                                                setNotifySettings({
                                                    ...notifySettings,
                                                    notification_receivers: [...notifySettings.notification_receivers, newReceiver]
                                                });
                                            }}
                                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                                        >
                                            + 添加接收端
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {notifySettings.notification_receivers.map((receiver, index) => (
                                            <div key={receiver.id} className={`p-4 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <select
                                                        value={receiver.type}
                                                        onChange={(e) => {
                                                            const updated = [...notifySettings.notification_receivers];
                                                            updated[index].type = e.target.value;
                                                            setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                        }}
                                                        className={`w-28 ${inputBg} border rounded px-2 py-1 text-xs`}
                                                    >
                                                        <option value="bark">Bark</option>
                                                        <option value="webhook">Webhook</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={receiver.name}
                                                        onChange={(e) => {
                                                            const updated = [...notifySettings.notification_receivers];
                                                            updated[index].name = e.target.value;
                                                            setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                        }}
                                                        className={`flex-1 ${inputBg} border rounded px-2 py-1 text-xs`}
                                                        placeholder="备注名称"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const updated = notifySettings.notification_receivers.filter((_, i) => i !== index);
                                                            setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                        }}
                                                        className="text-red-400 hover:text-red-500 p-1"
                                                        title="删除"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>

                                                <div className="space-y-2">
                                                    {receiver.type === 'webhook' && (
                                                        <div className="flex items-center space-x-2">
                                                            <span className={`text-xs ${textSecondary} w-10`}>Method:</span>
                                                            <select
                                                                value={receiver.method || 'GET'}
                                                                onChange={(e) => {
                                                                    const updated = [...notifySettings.notification_receivers];
                                                                    updated[index].method = e.target.value;
                                                                    setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                                }}
                                                                className={`w-20 ${inputBg} border rounded px-2 py-1 text-xs`}
                                                            >
                                                                <option value="GET">GET</option>
                                                                <option value="POST">POST</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center space-x-2">
                                                        <span className={`text-xs ${textSecondary} w-10`}>URL:</span>
                                                        <input
                                                            type="text"
                                                            value={receiver.url}
                                                            onChange={(e) => {
                                                                const updated = [...notifySettings.notification_receivers];
                                                                updated[index].url = e.target.value;
                                                                setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                            }}
                                                            className={`flex-1 ${inputBg} border rounded px-2 py-1 text-xs`}
                                                            placeholder={receiver.type === 'bark' ? "https://api.day.app/Key" : "https://example.com/api"}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {notifySettings.notification_receivers.length === 0 && (
                                            <div className={`text-center py-4 text-xs ${textSecondary} border border-dashed ${borderColor} rounded-lg`}>
                                                暂无通知接收端，请点击上方“添加”按钮。
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button
                                    onClick={handleTestNotify}
                                    disabled={saving || !notifySettings.notify_on_download_start}
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
            case 'maintenance':
                return (
                    <div className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={`${bgSecondary} p-6 rounded-xl border ${borderColor} space-y-6`}>
                            <div className="space-y-4">
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider flex items-center`}>
                                    <span className="mr-2">🧩</span> 历史数据校正
                                </h3>
                                <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'} border ${darkMode ? 'border-blue-500/20' : 'border-blue-200'}`}>
                                    <p className={`text-xs ${textPrimary} font-medium leading-relaxed`}>
                                        如果您之前通过其他方式添加了种子，或者系统的完成时间记录不准，可以使用此功能。
                                    </p>
                                    <ul className={`mt-2 space-y-1 text-[11px] ${textSecondary}`}>
                                        <li>• 自动 matching 下载器中的种子与本地历史记录。</li>
                                        <li>• 优先从下载器获取精确的 <b>完成时间</b> 和 <b>创建时间</b>。</li>
                                        <li>• 自动校验并更新 <b>Hash 唯一标识</b>。</li>
                                        <li>• 同步 <b>完成状态</b>，修复卡在“下载中”的历史条目。</li>
                                    </ul>
                                </div>
                                <button
                                    onClick={handleSyncHistory}
                                    disabled={saving}
                                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2"
                                >
                                    <span>{saving ? '同步中...' : '立即开始全局数据同步'}</span>
                                </button>
                            </div>

                            <hr className={borderColor} />

                            {/* Section: Auto Cleanup */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider flex items-center`}>
                                            <span className="mr-2">🧹</span> 自动清理 (实验性)
                                        </h3>
                                        <p className={`text-xs ${textSecondary} mt-1`}>
                                            根据分享率或做种时间自动删除下载器中的任务和文件。
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleSaveCleanup(!cleanupSettings.cleanup_enabled)}
                                        className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${cleanupSettings.cleanup_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                                    >
                                        <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${cleanupSettings.cleanup_enabled ? 'left-6.5' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-100/50'} border ${borderColor}`}>
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-2 uppercase`}>最小分享率</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={cleanupSettings.cleanup_min_ratio}
                                                onChange={(e) => setCleanupSettings({ ...cleanupSettings, cleanup_min_ratio: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500`}
                                            />
                                            <span className={`text-xs ${textSecondary}`}>Ratio</span>
                                        </div>
                                        <p className={`text-[10px] ${textSecondary} mt-1`}>大于等于此分享率时删除</p>
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-2 uppercase`}>最长做种时间 (小时)</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                value={cleanupSettings.cleanup_max_seeding_time}
                                                onChange={(e) => setCleanupSettings({ ...cleanupSettings, cleanup_max_seeding_time: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500`}
                                            />
                                            <span className={`text-xs ${textSecondary}`}>Hours</span>
                                        </div>
                                        <p className={`text-[10px] ${textSecondary} mt-1`}>大于等于此做种时间时删除 ({(cleanupSettings.cleanup_max_seeding_time / 24).toFixed(1)} 天)</p>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className={`block text-xs font-bold ${textSecondary} uppercase`}>同时删除文件</label>
                                                <p className={`text-[10px] ${textSecondary}`}>如果关闭，仅移除下载器中的任务，保留硬盘上的文件</p>
                                            </div>
                                            <button
                                                onClick={() => setCleanupSettings({ ...cleanupSettings, cleanup_delete_files: !cleanupSettings.cleanup_delete_files })}
                                                className={`relative inline-block w-10 h-5 transition duration-200 ease-in-out rounded-full cursor-pointer ${cleanupSettings.cleanup_delete_files ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-0.5 inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${cleanupSettings.cleanup_delete_files ? 'left-5.5' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 pt-2">
                                        <button
                                            onClick={handleSaveCleanupConfig}
                                            disabled={saving}
                                            className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold transition-all border border-blue-600/20"
                                        >
                                            保存清理策略
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <hr className={borderColor} />

                            <div className="space-y-4">
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider flex items-center text-red-400`}>
                                    <span className="mr-2">⚠️</span> 危险操作
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={handleClearHeatmap}
                                        disabled={saving}
                                        className={`p-3 border ${borderColor} rounded-lg text-xs ${textSecondary} text-left ${hoverBg} transition-all`}
                                    >
                                        <p className="font-bold mb-1 text-red-400">清空全部热力数据</p>
                                        <p>删除所有站点的历史上传记录图表</p>
                                    </button>
                                    <button
                                        onClick={handleClearTasks}
                                        disabled={saving}
                                        className={`p-3 border ${borderColor} rounded-lg text-xs ${textSecondary} text-left ${hoverBg} transition-all`}
                                    >
                                        <p className="font-bold mb-1 text-red-400">清理任务历史与日志</p>
                                        <p>删除所有下载记录及 RSS 运行日志</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={`${bgSecondary} p-6 rounded-xl border ${borderColor} space-y-6`}>
                            <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider`}>修改密码</h3>

                            <div className="space-y-4 max-w-md">
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-2`}>当前密码</label>
                                    <input
                                        type="password"
                                        value={passwordData.oldPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-2`}>新密码</label>
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-2`}>确认新密码</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className={`w-full ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg px-3 py-2 text-sm ${textPrimary} focus:border-blue-500 outline-none`}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={handleSavePassword}
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-bold text-sm disabled:opacity-50 shadow-lg shadow-blue-600/20"
                                >
                                    {saving ? '保存中...' : '修改密码'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="text-center py-10">
                        <div className="text-4xl mb-4">📦</div>
                        <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>{siteName}</h2>
                        <p className={textSecondary}>Version 0.1.0 (Alpha)</p>
                        <div className={`mt-8 p-4 ${bgSecondary} rounded-lg border ${borderColor} text-left text-sm ${textSecondary}`}>
                            <p>Powered by React, Express, and Docker.</p>
                            <p className="mt-2">Made with ❤️ for PT users.</p>
                        </div>
                    </div>
                );
            case 'logs':
                return <LogsPage />;
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
                            { id: 'maintenance', name: '维护', icon: '🛠️' },
                            { id: 'network', name: '网络', icon: '🌐' },
                            { id: 'logs', name: '日志', icon: '📜' },
                            { id: 'security', name: '安全', icon: '🔒' },
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
