import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import LogsPage from './LogsPage';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PathManager from '../components/PathManager';
import CategoryMapEditor from '../components/CategoryMapEditor';

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
    const [notifySettings, setNotifySettings] = useState({
        notify_enabled: false,
        notify_on_download_start: false,
        notification_receivers: []
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

    const [autoDownloadEnabled, setAutoDownloadEnabled] = useState(false);
    // Auto download sub-options
    const [matchByCategory, setMatchByCategory] = useState(true);
    const [matchByKeyword, setMatchByKeyword] = useState(true);
    const [fallbackToDefaultPath, setFallbackToDefaultPath] = useState(true);
    const [useDownloaderDefault, setUseDownloaderDefault] = useState(true);
    const [enableCategoryManagement, setEnableCategoryManagement] = useState(true);

    // Default download path (simple mode)
    const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
    // Multi-path management switch
    const [enableMultiPath, setEnableMultiPath] = useState(false);
    // Create series subfolder
    const [createSeriesSubfolder, setCreateSeriesSubfolder] = useState(false);


    // Theme helpers
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const activeSelectionClass = darkMode ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50';

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



            // Load auto download setting
            setAutoDownloadEnabled(data.auto_download_enabled === 'true');
            setMatchByCategory(data.match_by_category !== 'false');
            setMatchByKeyword(data.match_by_keyword !== 'false');
            setFallbackToDefaultPath(data.fallback_to_default_path !== 'false');
            setUseDownloaderDefault(data.use_downloader_default !== 'false');
            setEnableCategoryManagement(data.enable_category_management !== 'false');

            // Load default download path and multi-path switch
            setDefaultDownloadPath(data.default_download_path || '');
            setEnableMultiPath(data.enable_multi_path === 'true' || data.enable_multi_path === true);
            setCreateSeriesSubfolder(data.create_series_subfolder === 'true' || data.create_series_subfolder === true);
        } catch (err) {
            console.error('Fetch settings failed:', err);
        }
    };

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
                    notification_receivers: JSON.stringify(notifySettings.notification_receivers)
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
        if (newValue && !confirm('⚠️ 严重警告 ⚠️\n\n开启此功能后，系统将自动删除满足条件的种子和已下载的资源！\n\n请务必确认：\n1. 您已设置了合理的“最小分享率”和“最长做种时间”。\n2. 您了解此操作是不可逆的。\n\n是否确认开启？')) {
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



    const handleToggleAutoDownload = async (newValue) => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auto_download_enabled: newValue
                })
            });

            if (res.ok) {
                setAutoDownloadEnabled(newValue);
                setMessage({
                    type: 'success',
                    text: newValue ? '智能下载已开启，点击下载将自动添加' : '智能下载已关闭，下载前将显示确认对话框'
                });
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


    const handleToggleAutoDownloadOption = async (key, value) => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });

            if (res.ok) {
                if (key === 'match_by_category') setMatchByCategory(value);
                if (key === 'match_by_keyword') setMatchByKeyword(value);
                if (key === 'fallback_to_default_path') setFallbackToDefaultPath(value);
                if (key === 'use_downloader_default') setUseDownloaderDefault(value);
                if (key === 'enable_category_management') setEnableCategoryManagement(value);
            } else {
                setMessage({ type: 'error', text: '保存失败' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '保存出错' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDefaultPath = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ default_download_path: defaultDownloadPath })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: '默认下载路径已保存' });
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

    const handleToggleMultiPath = async (newValue) => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enable_multi_path: newValue })
            });
            if (res.ok) {
                setEnableMultiPath(newValue);
                setMessage({
                    type: 'success',
                    text: newValue ? '多路径管理已开启' : '多路径管理已关闭'
                });
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

    const handleToggleSeriesSubfolder = async (newValue) => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ create_series_subfolder: newValue })
            });
            if (res.ok) {
                setCreateSeriesSubfolder(newValue);
                setMessage({
                    type: 'success',
                    text: newValue ? '剧集子文件夹已启用' : '剧集子文件夹已禁用'
                });
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
                    <div key="general" className="space-y-6">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <Card className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Input
                                        label="站点名称"
                                        value={tempSiteName}
                                        onChange={(e) => setTempSiteName(e.target.value)}
                                        placeholder="PT Manager"
                                    />
                                    <p className={`text-[10px] ${textSecondary} mt-1`}>侧边栏顶部显示的名称</p>
                                </div>
                                <Select label="界面语言">
                                    <option>简体中文</option>
                                    <option>English</option>
                                </Select>
                            </div>

                            <hr className={borderColor} />

                            <div>
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-4`}>日志与同步设置</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="日志保留天数"
                                        type="number"
                                        value={logSettings.log_retention_days}
                                        onChange={(e) => setLogSettings({ ...logSettings, log_retention_days: e.target.value })}
                                        placeholder="7"
                                    />
                                    <Input
                                        label="最大日志条数/任务"
                                        type="number"
                                        value={logSettings.log_max_count}
                                        onChange={(e) => setLogSettings({ ...logSettings, log_max_count: e.target.value })}
                                        placeholder="100"
                                    />
                                    <Input
                                        label="站点数据检查间隔 (分钟)"
                                        type="number"
                                        min="5"
                                        value={cookieCheckInterval}
                                        onChange={(e) => setCookieCheckInterval(e.target.value)}
                                        placeholder="60"
                                    />
                                    <Input
                                        label="每日自动签到时间"
                                        type="time"
                                        value={checkinTime}
                                        onChange={(e) => setCheckinTime(e.target.value)}
                                    />
                                    <Input
                                        label="RSS 缓存时间 (秒)"
                                        type="number"
                                        min="60"
                                        max="3600"
                                        value={rssCacheTTL}
                                        onChange={(e) => setRssCacheTTL(e.target.value)}
                                    />
                                </div>
                            </div>

                            <hr className={borderColor} />

                            <div>
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-4`}>安全设置</h3>
                                <div className="max-w-xs">
                                    <Input
                                        label="登录限流 (次/分钟)"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={securitySettings?.security_login_limit || '5'}
                                        onChange={(e) => setSecuritySettings({ ...securitySettings, security_login_limit: e.target.value })}
                                    />
                                </div>
                            </div>

                            <hr className={borderColor} />

                            <div>
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-4`}>搜索模式</h3>
                                <div className="space-y-4">
                                    <div>
                                        <Input
                                            label="搜索结果最大页数 (1-10)"
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={searchLimit}
                                            onChange={(e) => setSearchLimit(e.target.value)}
                                            disabled={searchMode === 'rss'}
                                            className={searchMode === 'rss' ? 'opacity-50 cursor-not-allowed' : ''}
                                        />
                                        {searchMode === 'rss' && <p className="text-xs text-yellow-500 mt-1">RSS 模式下不支持分页限制</p>}
                                    </div>

                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-2`}>搜索模式</label>
                                        <div className="flex space-x-4">
                                            <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border ${searchMode === 'browse' ? activeSelectionClass : borderColor} transition-colors flex-1`}>
                                                <input
                                                    type="radio"
                                                    name="search_mode"
                                                    value="browse"
                                                    checked={searchMode === 'browse'}
                                                    onChange={(e) => setSearchMode(e.target.value)}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className={`font-medium ${textPrimary}`}>网页解析 (默认)</div>
                                                    <div className="text-xs text-gray-500">模拟浏览器访问搜索页面解析结果</div>
                                                </div>
                                            </label>
                                            <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border ${searchMode === 'rss' ? activeSelectionClass : borderColor} transition-colors flex-1`}>
                                                <input
                                                    type="radio"
                                                    name="search_mode"
                                                    value="rss"
                                                    checked={searchMode === 'rss'}
                                                    onChange={(e) => setSearchMode(e.target.value)}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
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

                            <div>
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-4`}>TMDB 刮削设置</h3>
                                <div className="space-y-4">
                                    <Input
                                        label="API Key"
                                        value={tmdbSettings.tmdb_api_key}
                                        onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_api_key: e.target.value })}
                                        placeholder="例如: 107492d..."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="API Base URL"
                                            value={tmdbSettings.tmdb_base_url}
                                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_base_url: e.target.value })}
                                            placeholder="默认: https://api.themoviedb.org/3"
                                        />
                                        <Input
                                            label="Image Base URL"
                                            value={tmdbSettings.tmdb_image_base_url}
                                            onChange={(e) => setTmdbSettings({ ...tmdbSettings, tmdb_image_base_url: e.target.value })}
                                            placeholder="默认: https://image.tmdb.org/t/p/w300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Theme Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div>
                                <p className={`text-sm font-medium ${textPrimary}`}>视觉主题</p>
                                <p className={`text-[10px] ${textSecondary}`}>选择您偏好的界面显示模式</p>
                            </div>
                            <div className={`flex items-center ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} p-1 rounded-lg mt-2 sm:mt-0`}>
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
                                            : `${textSecondary} hover:${textPrimary}`}`}
                                    >
                                        <span>{mode.icon}</span>
                                        <span>{mode.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSaveGeneral} disabled={saving}>
                                {saving ? '保存中...' : '提交所有设置'}
                            </Button>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div key="notifications" className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <Card className="space-y-6">
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

                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className={`block text-xs font-bold ${textSecondary} uppercase tracking-wider`}>通知接收端 ({notifySettings.notification_receivers.length})</label>
                                    <Button
                                        size="xs"
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
                                    >
                                        + 添加接收端
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {notifySettings.notification_receivers.map((receiver, index) => (
                                        <div key={receiver.id} className={`p-4 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                                                <Select
                                                    value={receiver.type}
                                                    onChange={(e) => {
                                                        const updated = [...notifySettings.notification_receivers];
                                                        updated[index].type = e.target.value;
                                                        setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                    }}
                                                    containerClassName="w-full sm:w-32 flex-shrink-0"
                                                >
                                                    <option value="bark">Bark</option>
                                                    <option value="webhook">Webhook</option>
                                                </Select>
                                                <div className="flex-1 flex space-x-2">
                                                    <Input
                                                        value={receiver.name}
                                                        onChange={(e) => {
                                                            const updated = [...notifySettings.notification_receivers];
                                                            updated[index].name = e.target.value;
                                                            setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                        }}
                                                        placeholder="备注名称"
                                                        containerClassName="flex-1"
                                                    />
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => {
                                                            const updated = notifySettings.notification_receivers.filter((_, i) => i !== index);
                                                            setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                        }}
                                                        className="flex-shrink-0"
                                                    >
                                                        🗑️
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {receiver.type === 'webhook' && (
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`text-xs ${textSecondary} w-16`}>Method:</span>
                                                        <Select
                                                            value={receiver.method || 'GET'}
                                                            onChange={(e) => {
                                                                const updated = [...notifySettings.notification_receivers];
                                                                updated[index].method = e.target.value;
                                                                setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                            }}
                                                            className="w-24"
                                                        >
                                                            <option value="GET">GET</option>
                                                            <option value="POST">POST</option>
                                                        </Select>
                                                    </div>
                                                )}

                                                <div className="flex items-center space-x-2">
                                                    <span className={`text-xs ${textSecondary} w-16`}>URL:</span>
                                                    <div className="flex-1">
                                                        <Input
                                                            value={receiver.url}
                                                            onChange={(e) => {
                                                                const updated = [...notifySettings.notification_receivers];
                                                                updated[index].url = e.target.value;
                                                                setNotifySettings({ ...notifySettings, notification_receivers: updated });
                                                            }}
                                                            placeholder={receiver.type === 'bark' ? "https://api.day.app/Key" : "https://example.com/api"}
                                                            containerClassName="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {notifySettings.notification_receivers.length === 0 && (
                                        <div className={`text-center py-8 text-xs ${textSecondary} border border-dashed ${borderColor} rounded-lg`}>
                                            暂无通知接收端，请点击上方“添加”按钮。
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <Button
                                    variant="secondary"
                                    onClick={handleTestNotify}
                                    disabled={saving || !notifySettings.notify_on_download_start}
                                >
                                    发送测试通知
                                </Button>
                                <Button onClick={handleSaveNotify} disabled={saving}>
                                    {saving ? '保存中...' : '保存通知设置'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                );

            case 'backup':
                return (
                    <div key="backup" className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <Card className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider`}>导出数据</h3>
                                    <p className={`text-xs ${textSecondary}`}>
                                        点击下方按钮将下载一个包含所有配置、站点、任务、客户端及历史统计数据的 JSON 文件。
                                    </p>
                                    <Button onClick={handleExport} className="w-full">
                                        立即导出备份
                                    </Button>
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
                                            className={`flex items-center justify-center w-full py-2.5 border-2 border-dashed ${borderColor} rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-bold text-sm ${textPrimary}`}
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
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    </div>
                );

            case 'maintenance':
                return (
                    <div key="maintenance" className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <Card className="space-y-6">
                            <div className="space-y-4">
                                <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider flex items-center`}>
                                    <span className="mr-2">🧩</span> 历史数据校正
                                </h3>
                                <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'} border ${darkMode ? 'border-blue-500/20' : 'border-blue-200'}`}>
                                    <p className={`text-xs ${textPrimary} font-medium leading-relaxed`}>
                                        如果您之前通过其他方式添加了种子，或者系统的完成时间记录不准，可以使用此功能。
                                    </p>
                                    <ul className={`mt-2 space-y-1 text-[11px] ${textSecondary}`}>
                                        <li>• 自动校验下载器中的种子与本地历史记录。</li>
                                        <li>• 优先从下载器获取精确的 <b>完成时间</b> 和 <b>创建时间</b>。</li>
                                        <li>• 自动校验并更新 <b>Hash 唯一标识</b>。</li>
                                    </ul>
                                </div>
                                <Button onClick={handleSyncHistory} disabled={saving} className="w-full sm:w-auto">
                                    {saving ? '同步中...' : '立即开始全局数据同步'}
                                </Button>
                            </div>

                            <hr className={borderColor} />

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
                                        <Input
                                            label="最小分享率"
                                            type="number"
                                            step="0.1"
                                            value={cleanupSettings.cleanup_min_ratio}
                                            onChange={(e) => setCleanupSettings({ ...cleanupSettings, cleanup_min_ratio: e.target.value })}
                                        />
                                        <p className={`text-[10px] ${textSecondary} mt-1`}>大于等于此分享率时删除</p>
                                    </div>
                                    <div>
                                        <Input
                                            label="最长做种时间 (小时)"
                                            type="number"
                                            value={cleanupSettings.cleanup_max_seeding_time}
                                            onChange={(e) => setCleanupSettings({ ...cleanupSettings, cleanup_max_seeding_time: e.target.value })}
                                        />
                                        <p className={`text-[10px] ${textSecondary} mt-1`}>大于等于此时间时删除 ({(cleanupSettings.cleanup_max_seeding_time / 24).toFixed(1)} 天)</p>
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
                                        <Button
                                            variant="secondary"
                                            onClick={handleSaveCleanupConfig}
                                            disabled={saving}
                                            className="w-full text-blue-600 dark:text-blue-400"
                                        >
                                            保存清理策略
                                        </Button>
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
                                        className={`p-3 border ${borderColor} rounded-lg text-xs ${textSecondary} text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
                                    >
                                        <p className="font-bold mb-1 text-red-400">清空全部热力数据</p>
                                        <p>删除所有站点的历史上传记录图表</p>
                                    </button>
                                    <button
                                        onClick={handleClearTasks}
                                        disabled={saving}
                                        className={`p-3 border ${borderColor} rounded-lg text-xs ${textSecondary} text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
                                    >
                                        <p className="font-bold mb-1 text-red-400">清理任务历史与日志</p>
                                        <p>删除所有下载记录及 RSS 运行日志</p>
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </div>
                );

            case 'network':
                return (
                    <div key="network">
                        <Card>
                            <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>代理设置</h3>
                            <div className="space-y-4">
                                <Input
                                    label="HTTP 代理"
                                    placeholder="http://127.0.0.1:7890"
                                    disabled
                                />
                                <p className="text-xs text-yellow-500">代理功能开发中...</p>
                            </div>
                        </Card>
                    </div>
                );

            case 'security':
                return (
                    <div key="security" className="space-y-4">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <Card className="space-y-6">
                            <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider`}>修改密码</h3>
                            <div className="space-y-4 max-w-md">
                                <Input
                                    label="当前密码"
                                    type="password"
                                    value={passwordData.oldPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                />
                                <Input
                                    label="新密码"
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                />
                                <Input
                                    label="确认新密码"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                />
                            </div>
                            <div className="pt-2">
                                <Button onClick={handleSavePassword} disabled={saving}>
                                    {saving ? '保存中...' : '修改密码'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                );

            case 'about':
                return (
                    <div key="about" className="text-center py-10">
                        <div className="text-4xl mb-4">📦</div>
                        <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>{siteName}</h2>
                        <p className={textSecondary}>Version 0.1.0 (Alpha)</p>
                        <div className={`mt-8 p-4 ${bgMain} rounded-lg border ${borderColor} text-left text-sm ${textSecondary} inline-block max-w-sm`}>
                            <p>Powered by React, Express, and Docker.</p>
                            <p className="mt-2">Made with ❤️ for PT users.</p>
                        </div>
                    </div>
                );

            case 'category':
                return (
                    <div key="category" className="space-y-6">
                        {message && (
                            <div className={`p-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        {/* 0. 默认下载路径和自动创建剧集子文件夹 (并排显示) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 默认下载路径 */}
                            <Card>
                                <h3 className={`text-base font-bold ${textPrimary} mb-1 flex items-center`}>
                                    <span className="mr-2">📂</span> 默认下载路径
                                </h3>
                                <p className={`text-xs ${textSecondary} mb-3`}>
                                    所有下载任务默认使用的存储路径，如果未启用多路径管理则使用此路径
                                </p>
                                <div className="flex items-center space-x-2">
                                    <Input
                                        value={defaultDownloadPath}
                                        onChange={(e) => setDefaultDownloadPath(e.target.value)}
                                        placeholder="例如: /downloads 或留空使用下载器默认"
                                        containerClassName="flex-1"
                                        className="py-1.5"
                                    />
                                    <Button
                                        onClick={handleSaveDefaultPath}
                                        disabled={saving}
                                        size="sm"
                                        className="whitespace-nowrap"
                                    >
                                        保存
                                    </Button>
                                </div>
                            </Card>

                            {/* 自动创建剧集子文件夹 */}
                            <Card>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 mr-4">
                                        <h3 className={`text-base font-bold ${textPrimary} mb-1 flex items-center`}>
                                            <span className="mr-2">📁</span> 自动创建剧集子文件夹
                                        </h3>
                                        <p className={`text-xs ${textSecondary}`}>
                                            检测到种子名称包含季数标识（如 S01, Season 1）时，自动创建父文件夹来组织集数。适用于剧集、综艺等多集内容
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleSeriesSubfolder(!createSeriesSubfolder)}
                                        disabled={saving}
                                        className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer flex-shrink-0 ${createSeriesSubfolder ? 'bg-blue-600' : 'bg-gray-300'
                                            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${createSeriesSubfolder ? 'left-6.5' : 'left-0.5'
                                            }`} />
                                    </button>
                                </div>
                            </Card>
                        </div>

                        {/* 1. 多路径管理总开关 */}
                        <Card>
                            <div className="flex items-start justify-between">
                                <div className="flex-1 mr-4">
                                    <h3 className={`text-base font-bold ${textPrimary} mb-1 flex items-center`}>
                                        <span className="mr-2">🔀</span> 多路径管理
                                    </h3>
                                    <p className={`text-xs ${textSecondary}`}>
                                        启用后可配置多个下载路径，并使用分类管理和智能下载功能
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleToggleMultiPath(!enableMultiPath)}
                                    disabled={saving}
                                    className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer flex-shrink-0 ${enableMultiPath ? 'bg-blue-600' : 'bg-gray-300'
                                        } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${enableMultiPath ? 'left-6.5' : 'left-0.5'
                                        }`} />
                                </button>
                            </div>
                        </Card>

                        {/* 以下内容仅在多路径管理开启时可见 */}
                        {enableMultiPath && (
                            <>
                                {/* 2. 路径管理 */}
                                <Card>
                                    <PathManager />
                                </Card>

                                {/* 3. 智能分类管理开关 */}
                                <Card>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 mr-4">
                                            <h3 className={`text-base font-bold ${textPrimary} mb-1 flex items-center`}>
                                                <span className="mr-2">🗂️</span> 智能分类管理功能
                                            </h3>
                                            <p className={`text-xs ${textSecondary}`}>
                                                启用后可使用高级的类型映射与智能路径匹配策略
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleToggleAutoDownloadOption('enable_category_management', !enableCategoryManagement)}
                                            disabled={saving}
                                            className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${enableCategoryManagement ? 'bg-blue-600' : 'bg-gray-300'
                                                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${enableCategoryManagement ? 'left-6.5' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    {/* 智能分类管理的子选项 */}
                                    {enableCategoryManagement && (
                                        <div className={`mt-4 pt-4 border-t ${borderColor} space-y-3`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-sm ${textPrimary}`}>类型精确匹配</p>
                                                    <p className={`text-xs ${textSecondary}`}>优先使用 PT 站点提供的类型字段匹配</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={matchByCategory}
                                                    onChange={(e) => handleToggleAutoDownloadOption('match_by_category', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    disabled={saving}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-sm ${textPrimary}`}>关键词评分匹配</p>
                                                    <p className={`text-xs ${textSecondary}`}>根据标题关键词模糊匹配</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={matchByKeyword}
                                                    onChange={(e) => handleToggleAutoDownloadOption('match_by_keyword', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    disabled={saving}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-sm ${textPrimary}`}>使用默认路径兜底</p>
                                                    <p className={`text-xs ${textSecondary}`}>如果未匹配到类型，使用标记为默认的路径</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={fallbackToDefaultPath}
                                                    onChange={(e) => handleToggleAutoDownloadOption('fallback_to_default_path', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    disabled={saving}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-sm ${textPrimary}`}>使用下载器默认路径</p>
                                                    <p className={`text-xs ${textSecondary}`}>当所有规则都不匹配时，不指定路径</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={useDownloaderDefault}
                                                    onChange={(e) => handleToggleAutoDownloadOption('use_downloader_default', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    disabled={saving}
                                                />
                                            </div>

                                            {/* 一键下载 */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`text-sm ${textPrimary} font-bold`}>⚡ 一键下载</p>
                                                    <p className={`text-xs ${textSecondary}`}>开启后，点击下载将无需弹出多路劲选择框</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleAutoDownload(!autoDownloadEnabled)}
                                                    disabled={saving}
                                                    className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer ${autoDownloadEnabled ? 'bg-blue-600' : 'bg-gray-300'
                                                        } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <span className={`absolute top-0.5 inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${autoDownloadEnabled ? 'left-6.5' : 'left-0.5'
                                                        }`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Card>



                                {/* 4. 类型映射配置 (受控) */}
                                <div className={`transition-opacity duration-300 ${enableCategoryManagement ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                                    <Card className="space-y-4 relative">
                                        {!enableCategoryManagement && <div className="absolute inset-0 z-10 bg-gray-100/10 dark:bg-black/10 cursor-not-allowed"></div>}
                                        <div>
                                            <h3 className={`text-sm font-bold ${textPrimary} uppercase tracking-wider mb-2`}>
                                                类型映射配置
                                            </h3>
                                            <p className={`text-xs ${textSecondary} mb-4`}>
                                                配置资源类型的识别规则。添加"类型"并为其指定多个"别名"（如 movie, film）。
                                            </p>
                                        </div>

                                        <div>
                                            <CategoryMapEditor
                                                disabled={!enableCategoryManagement}
                                            />
                                        </div>
                                    </Card>
                                </div>
                            </>
                        )}
                    </div>
                );

            case 'logs':
                return <div key="logs"><LogsPage /></div>;

            default:
                return null;
        }
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary} mb-6 md:mb-8`}>系统设置</h1>

            <div className={`flex-1 flex flex-col lg:flex-row ${bgMain} rounded-xl border ${borderColor} overflow-hidden shadow-sm`}>
                {/* Settings Navigation */}
                <div className={`w-full lg:w-48 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} border-b lg:border-b-0 lg:border-r ${borderColor} p-2 md:p-4`}>
                    <nav className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
                        {[
                            { id: 'general', name: '通用', icon: '⚙️' },
                            { id: 'category', name: '下载', icon: '⚡' },
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
                                className={`flex-shrink-0 lg:flex-none flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${subTab === item.id
                                    ? 'bg-blue-600 text-white lg:bg-blue-600/10 lg:text-blue-600 dark:lg:text-blue-400 shadow-sm lg:shadow-none'
                                    : `${textSecondary} hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:${textPrimary}`
                                    }`}
                            >
                                <span className="mr-2 lg:mr-3 w-6 text-center">{item.icon}</span>
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

