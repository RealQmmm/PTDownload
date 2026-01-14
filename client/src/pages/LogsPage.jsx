import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from '../components/ui/Button';

const LogsPage = () => {
    const { darkMode, authenticatedFetch, user: me } = useTheme();
    const [activeTab, setActiveTab] = useState('task'); // task, login
    const [logs, setLogs] = useState([]);
    const [loginLogs, setLoginLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, success, error
    const [enableSystemLogs, setEnableSystemLogs] = useState(false);
    const scrollRef = useRef(null);

    const isAdmin = me?.role === 'admin';

    // Theme-aware classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    const fetchConfig = async () => {
        try {
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();
            setEnableSystemLogs(data.enable_system_logs === 'true');
        } catch (err) {
            console.error('Fetch config failed:', err);
        }
    };

    const fetchLogs = async () => {
        if (activeTab !== 'task') return;
        setLoading(true);
        try {
            const res = await authenticatedFetch(`/api/logs?limit=500`);
            const data = await res.json();
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch logs failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLoginLogs = async () => {
        if (activeTab !== 'login') return;
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/auth/login-logs');
            if (res.ok) {
                const data = await res.json();
                setLoginLogs(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Fetch login logs failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'task') {
            fetchLogs();
            fetchConfig();
        } else {
            fetchLoginLogs();
        }

        // Only poll for task logs
        let interval;
        if (activeTab === 'task') {
            interval = setInterval(fetchLogs, 60000);
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (interval) clearInterval(interval);
            } else {
                if (activeTab === 'task') {
                    fetchLogs();
                    interval = setInterval(fetchLogs, 60000);
                } else {
                    fetchLoginLogs();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (interval) clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeTab]);

    const handleToggleSystemLogs = async () => {
        const newValue = !enableSystemLogs;
        setEnableSystemLogs(newValue);
        try {
            await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enable_system_logs: String(newValue) })
            });
        } catch (err) {
            console.error('Save log setting failed:', err);
        }
    };

    const handleClearLogs = async () => {
        const isTask = activeTab === 'task';
        const msg = isTask ? '确定要清空所有运行日志吗？' : '确定要清空所有登录记录吗？';
        if (!confirm(msg)) return;

        try {
            const endpoint = isTask ? '/api/logs' : '/api/auth/login-logs';
            const res = await authenticatedFetch(endpoint, { method: 'DELETE' });
            if (res.ok) {
                if (isTask) setLogs([]);
                else setLoginLogs([]);
            }
        } catch (err) {
            alert('清空失败');
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'all') return true;
        if (filter === 'success') return log.status === 'success' || log.status === 'info';
        return log.status === filter;
    });

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col">
            {/* Header with Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
                <div className="flex flex-col space-y-2">
                    <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('task')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'task'
                                ? 'bg-white dark:bg-gray-800 text-blue-500 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            运行日志
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('login')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'login'
                                    ? 'bg-white dark:bg-gray-800 text-blue-500 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                登录记录
                            </button>
                        )}
                    </div>
                    {activeTab === 'task' ? (
                        <div className="flex items-center space-x-4">
                            <p className={`${textSecondary} text-xs`}>所有后台任务的实时运行状态记录</p>
                            <div className="flex items-center space-x-2 border-l border-gray-500/30 pl-4">
                                <span className={`text-[10px] font-bold ${textSecondary} uppercase tracking-tight`}>详细系统日志</span>
                                <button
                                    onClick={handleToggleSystemLogs}
                                    className={`relative inline-block w-8 h-4 transition duration-200 ease-in-out rounded-full cursor-pointer ${enableSystemLogs ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'}`}
                                >
                                    <span className={`absolute top-0.5 inline-block w-3 h-3 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${enableSystemLogs ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className={`${textSecondary} text-xs`}>最近的系统登录活动记录</p>
                    )}
                </div>

                <div className="flex space-x-3 w-full sm:w-auto">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={activeTab === 'task' ? fetchLogs : fetchLoginLogs}
                        disabled={loading}
                    >
                        <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                        </svg>
                        刷新
                    </Button>
                    {activeTab === 'task' && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={handleClearLogs}
                        >
                            <span className="mr-2">🗑️</span> 清空
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className={`${bgMain} border ${borderColor} rounded-2xl overflow-hidden flex flex-col flex-1 shadow-inner relative`}>
                {activeTab === 'task' ? (
                    <>
                        {/* Task Logs Filter Header */}
                        <div className={`p-4 border-b ${borderColor} flex items-center justify-between ${bgSecondary} z-10`}>
                            <div className="flex space-x-2">
                                {[
                                    { id: 'all', name: '全部日志' },
                                    { id: 'success', name: '成功记录' },
                                    { id: 'error', name: '异常提醒' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setFilter(f.id)}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${filter === f.id
                                            ? `bg-blue-600 text-white shadow-md border-blue-600`
                                            : `${textSecondary} border-transparent hover:bg-gray-200 dark:hover:bg-gray-800`
                                            }`}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                            <div className={`text-[10px] ${textSecondary} font-mono hidden md:block`}>
                                {filteredLogs.length} 条记录已加载
                            </div>
                        </div>

                        {/* Console Style Area */}
                        <div
                            ref={scrollRef}
                            className={`flex-1 overflow-y-auto p-4 font-mono text-[12px] md:text-[13px] leading-relaxed custom-scrollbar ${darkMode ? 'bg-[rgb(11,15,25)]' : 'bg-gray-50'}`}
                        >
                            {loading && logs.length === 0 ? (
                                <div className="flex justify-center items-center h-full text-gray-500 animate-pulse">
                                    正在接入系统日志流...
                                </div>
                            ) : (
                                <div className="space-y-1.5 text-left">
                                    {filteredLogs.map((log) => (
                                        <div key={log.id} className="flex flex-col md:flex-row md:items-start group hover:bg-blue-500/5 px-2 py-1 rounded-lg transition-colors border-l-2 border-transparent hover:border-blue-500/30">
                                            <span className="text-gray-500 shrink-0 select-none mr-3 opacity-50">
                                                [{new Date(log.run_time).toLocaleString('sv-SE').replace('T', ' ')}]
                                            </span>
                                            <span className={`shrink-0 mr-3 font-bold ${(log.status === 'success' || log.status === 'info') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {(log.status === 'success' || log.status === 'info') ? '[INFO] ' : '[ERR]  '}
                                            </span>
                                            <span className="shrink-0 mr-3 text-blue-400 font-bold opacity-80">
                                                {log.task_name ? `[${log.task_name}]` : '[SYSTEM]'}
                                            </span>
                                            <span className={`${(log.status === 'error' || log.status === 'warning') ? 'text-rose-500' : textSecondary} break-all`}>
                                                {log.message}
                                                {(log.items_found > 0 || log.items_matched > 0) && (
                                                    <span className="ml-2 py-0.5 px-1.5 rounded bg-gray-500/10 text-[11px] text-gray-500">
                                                        Found: {log.items_found} | Matched: {log.items_matched}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                    {filteredLogs.length === 0 && (
                                        <div className="py-20 text-center text-gray-500 italic">
                                            暂无运行日志记录
                                        </div>
                                    ) || (
                                            <div className="pt-4 text-center text-gray-600 text-[10px] opacity-30 select-none">
                                                --- 已加载最新 {filteredLogs.length} 条记录 ---
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Login Logs Table */
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className={`sticky top-0 ${bgSecondary} z-10 border-b ${borderColor}`}>
                                <tr>
                                    <th className={`p-4 ${textSecondary} font-bold text-xs uppercase`}>登录时间</th>
                                    <th className={`p-4 ${textSecondary} font-bold text-xs uppercase`}>用户名</th>
                                    <th className={`p-4 ${textSecondary} font-bold text-xs uppercase`}>状态</th>
                                    <th className={`p-4 ${textSecondary} font-bold text-xs uppercase`}>IP 地址</th>
                                    <th className={`p-4 ${textSecondary} font-bold text-xs uppercase`}>设备环境</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {loading && loginLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-20 text-center text-gray-500 animate-pulse">
                                            加载登录记录中...
                                        </td>
                                    </tr>
                                ) : loginLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="p-4 whitespace-nowrap font-mono text-xs opacity-70">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className={`p-4 font-bold ${textPrimary}`}>{log.username || 'Unknown'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {log.status === 'success' ? '登录成功' : `失败: ${log.message || '未知'}`}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-blue-400">{log.ip}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col space-y-0.5 min-w-[150px]">
                                                <span className={`text-xs ${textPrimary} font-medium`}>{log.device_name || '未知设备'}</span>
                                                <span className="text-[10px] opacity-50 truncate">{log.os || '-'} / {log.browser || '-'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {loginLogs.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="5" className="p-20 text-center text-gray-500 italic">暂无登录历史记录</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${darkMode ? '#374151' : '#d1d5db'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${darkMode ? '#4b5563' : '#9ca3af'};
                }
            `}} />
        </div>
    );
};

export default LogsPage;

