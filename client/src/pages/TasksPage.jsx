import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const TasksPage = () => {
    const { darkMode } = useTheme();
    const [tasks, setTasks] = useState([]);
    const [sites, setSites] = useState([]);
    const [clients, setClients] = useState([]);
    const [rssSources, setRSSSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showRSSModal, setShowRSSModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedTaskLogs, setSelectedTaskLogs] = useState([]);
    const [logLoading, setLogLoading] = useState(false);

    // Helpers for Human-readable CRON
    const cronToHuman = (cron) => {
        if (!cron) return '未设置';
        if (cron.startsWith('*/') && cron.endsWith(' * * * *')) {
            return `每 ${cron.split(' ')[0].replace('*/', '')} 分钟`;
        }
        if (cron.startsWith('0 */') && cron.endsWith(' * * *')) {
            return `每 ${cron.split(' ')[1].replace('*/', '')} 小时`;
        }
        if (cron.startsWith('0 0 */') && cron.endsWith(' * *')) {
            return `每 ${cron.split(' ')[2].replace('*/', '')} 天`;
        }
        return cron; // Fallback to raw cron if complex
    };

    const parseCron = (cron) => {
        if (!cron) return { value: 15, unit: 'm' };
        if (cron.startsWith('*/') && cron.endsWith(' * * * *')) return { value: cron.split(' ')[0].replace('*/', ''), unit: 'm' };
        if (cron.startsWith('0 */') && cron.endsWith(' * * *')) return { value: cron.split(' ')[1].replace('*/', ''), unit: 'h' };
        if (cron.startsWith('0 0 */') && cron.endsWith(' * *')) return { value: cron.split(' ')[2].replace('*/', ''), unit: 'd' };
        return { value: 15, unit: 'm', isComplex: true };
    };

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

    const [formData, setFormData] = useState({
        name: '',
        type: 'rss',
        cron: '*/15 * * * *',
        site_id: '',
        rss_url: '',
        filter_config: { keywords: '', exclude: '', size_min: '', size_max: '' },
        client_id: '',
        save_path: '',
        category: '',
        enabled: 1
    });

    const [rssFormData, setRSSFormData] = useState({
        site_id: '',
        name: '',
        url: ''
    });

    const fetchData = async () => {
        try {
            const [tasksRes, sitesRes, clientsRes, rssSourcesRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/sites'),
                fetch('/api/clients'),
                fetch('/api/rss-sources')
            ]);

            const [tasksData, sitesData, clientsData, rssSourcesData] = await Promise.all([
                tasksRes.json(),
                sitesRes.json(),
                clientsRes.json(),
                rssSourcesRes.json()
            ]);

            setTasks(tasksData);
            setSites(sitesData);
            setClients(clientsData);
            setRSSSources(rssSourcesData);
        } catch (err) {
            console.error('Fetch data failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = () => {
        setEditingTask(null);
        setFormData({
            name: '',
            type: 'rss',
            cron: '*/15 * * * *',
            site_id: sites[0]?.id || '',
            rss_url: '',
            filter_config: { keywords: '', exclude: '', size_min: '', size_max: '' },
            client_id: clients[0]?.id || '',
            save_path: '',
            category: '',
            enabled: 1
        });
        setShowModal(true);
    };

    const handleEdit = (task) => {
        setEditingTask(task);
        setFormData({
            ...task,
            filter_config: typeof task.filter_config === 'string'
                ? JSON.parse(task.filter_config)
                : (task.filter_config || { keywords: '', exclude: '', size_min: '', size_max: '' })
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            filter_config: JSON.stringify(formData.filter_config)
        };

        try {
            const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
            const method = editingTask ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowModal(false);
                fetchData();
            } else {
                alert('保存失败');
            }
        } catch (err) {
            alert('服务器连接失败');
        }
    };

    const toggleTask = async (task) => {
        try {
            await fetch(`/api/tasks/${task.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !task.enabled })
            });
            fetchData();
        } catch (err) {
            alert('操作失败');
        }
    };

    const deleteTask = async (id) => {
        if (!confirm('确定删除该自动化任务吗？')) return;
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        fetchData();
    };

    const executeTask = async (task) => {
        try {
            const res = await fetch(`/api/tasks/${task.id}/execute`, { method: 'POST' });
            if (res.ok) {
                alert('任务已开始执行，请稍后刷新查看结果');
                setTimeout(fetchData, 2000);
            } else {
                alert('执行失败');
            }
        } catch (err) {
            alert('服务器连接失败');
        }
    };

    const viewLogs = async (task) => {
        setEditingTask(task);
        setShowLogsModal(true);
        setLogLoading(true);
        try {
            const res = await fetch(`/api/tasks/${task.id}/logs`);
            const data = await res.json();
            setSelectedTaskLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch logs failed:', err);
        } finally {
            setLogLoading(false);
        }
    };

    const handleRSSSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/rss-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rssFormData)
            });
            if (res.ok) {
                setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
                fetchData();
            }
        } catch (err) {
            alert('保存失败');
        }
    };

    const deleteRSSSource = async (id) => {
        if (!confirm('确定删除该订阅源吗？')) return;
        await fetch(`/api/rss-sources/${id}`, { method: 'DELETE' });
        fetchData();
    };

    const handleSelectSource = (source) => {
        setFormData({
            ...formData,
            name: source.name,
            site_id: source.site_id,
            rss_url: source.url
        });
        setShowRSSModal(false);
        setShowModal(true);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>自动任务</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>无人值守的 RSS 订阅与自动下种规则管理</p>
                </div>
                <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowRSSModal(true)}
                        className={`px-6 py-3 border ${borderColor} ${textSecondary} hover:${textPrimary} hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-all`}
                    >
                        订阅源维护
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                    >
                        + 创建任务
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载任务中...</div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tasks.map((task) => {
                        const site = sites.find(s => s.id === task.site_id);
                        const client = clients.find(c => c.id === task.client_id);
                        const matchingSource = rssSources.find(s => s.url === task.rss_url);

                        return (
                            <div key={task.id} className={`${bgMain} border ${borderColor} rounded-xl p-4 md:p-6 transition-all hover:shadow-md group shadow-sm`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center space-x-3">
                                            <span className={`w-2 h-2 rounded-full ${task.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                                            <h3 className={`text-xl font-bold ${textPrimary}`}>{task.name}</h3>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">RSS 订阅</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-y-2 text-sm text-gray-500 space-x-4">
                                            <div className="flex items-center">
                                                <span className="mr-1">🌐</span> {site?.name || '未知站点'}
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-1">📥</span> {client?.type || '默认客户端'}
                                            </div>
                                            <div className="flex items-center font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                                <span className="mr-1">⏰</span> {cronToHuman(task.cron)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-4 md:mt-0 space-x-3 w-full md:w-auto justify-end">
                                        <button
                                            onClick={() => viewLogs(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${borderColor} text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}
                                        >
                                            任务日志
                                        </button>
                                        <button
                                            onClick={() => executeTask(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors`}
                                        >
                                            立即执行
                                        </button>
                                        <button
                                            onClick={() => toggleTask(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${task.enabled
                                                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                                : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                }`}
                                        >
                                            {task.enabled ? '暂停' : '启动'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${borderColor} ${textSecondary} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {task.last_run && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 flex justify-between items-center">
                                        <span>上次运行: {new Date(task.last_run).toLocaleString()}</span>
                                        <div className="flex items-center max-w-[50%]">
                                            {matchingSource ? (
                                                <div className="flex items-center bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                                    <span className="mr-1">📑</span>
                                                    <span className="text-blue-500 font-bold truncate">{matchingSource.name}</span>
                                                </div>
                                            ) : (
                                                <span className="truncate opacity-50 font-mono">{task.rss_url}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {tasks.length === 0 && (
                        <div className={`text-center py-20 ${bgMain} border border-dashed ${borderColor} rounded-2xl`}>
                            <div className="text-4xl mb-4 text-gray-400">⚡</div>
                            <p className={textSecondary}>目前还没有任何自动任务，快去创建一个吧！</p>
                        </div>
                    )}
                </div>
            )}

            {/* Task Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-2xl border ${borderColor} shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>
                                {editingTask ? '编辑自动任务' : '创建新 RSS 任务'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>任务名称</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        placeholder="例如：M-Team 热门种追剧"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>关联站点</label>
                                    <select
                                        value={formData.site_id}
                                        onChange={(e) => setFormData({ ...formData, site_id: parseInt(e.target.value) })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    >
                                        <option value="">选择站点</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>执行周期</label>
                                    <div className="flex space-x-2">
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            value={parseCron(formData.cron).value}
                                            onChange={(e) => {
                                                const current = parseCron(formData.cron);
                                                const val = e.target.value;
                                                let newCron = '';
                                                if (current.unit === 'm') newCron = `*/${val} * * * *`;
                                                else if (current.unit === 'h') newCron = `0 */${val} * * *`;
                                                else if (current.unit === 'd') newCron = `0 0 */${val} * *`;
                                                setFormData({ ...formData, cron: newCron });
                                            }}
                                            className={`w-20 ${inputBg} border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center`}
                                        />
                                        <select
                                            value={parseCron(formData.cron).unit}
                                            onChange={(e) => {
                                                const current = parseCron(formData.cron);
                                                const unit = e.target.value;
                                                let newCron = '';
                                                if (unit === 'm') newCron = `*/${current.value} * * * *`;
                                                else if (unit === 'h') newCron = `0 */${current.value} * * *`;
                                                else if (unit === 'd') newCron = `0 0 */${current.value} * *`;
                                                setFormData({ ...formData, cron: newCron });
                                            }}
                                            className={`flex-1 ${inputBg} border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500`}
                                        >
                                            <option value="m">分钟</option>
                                            <option value="h">小时</option>
                                            <option value="d">天</option>
                                        </select>
                                    </div>
                                    {parseCron(formData.cron).isComplex && (
                                        <p className="text-[10px] text-amber-500 mt-1">检测到复杂 Cron 表达式，已重置为简单模式</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className={`block text-xs font-bold ${textSecondary} uppercase tracking-wider`}>RSS 订阅链接</label>
                                        <div className="flex space-x-2">
                                            {rssSources.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowModal(false); setShowRSSModal(true); }}
                                                    className="text-blue-500 text-[10px] hover:underline"
                                                >
                                                    从订阅源库选择
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {(() => {
                                        const matched = rssSources.find(s => s.url === formData.rss_url);
                                        return matched ? (
                                            <div className={`mb-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-center justify-between`}>
                                                <div className="flex items-center overflow-hidden">
                                                    <span className="mr-2 text-lg">📑</span>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-blue-500 truncate">{matched.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate font-mono">{formData.rss_url}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, rss_url: '' })}
                                                    className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                                                >
                                                    清除
                                                </button>
                                            </div>
                                        ) : (
                                            <input
                                                required
                                                type="url"
                                                value={formData.rss_url}
                                                onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 mb-2`}
                                                placeholder="https://example.com/rss.php?..."
                                            />
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className={`p-4 rounded-xl border ${borderColor} ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                                <h3 className={`text-sm font-bold ${textPrimary} mb-4 flex items-center`}>
                                    <span className="mr-2">🔍</span> 过滤规则
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>包含关键词 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.filter_config.keywords}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, keywords: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="例如: 2160p, H265, HEVC"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>排除关键词 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.filter_config.exclude}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, exclude: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="例如: 720p, Dubbed"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>最小体积 (MB)</label>
                                        <input
                                            type="number"
                                            value={formData.filter_config.size_min}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_min: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>最大体积 (MB)</label>
                                        <input
                                            type="number"
                                            value={formData.filter_config.size_max}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_max: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="无限制"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>下载客户端</label>
                                    <select
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    >
                                        <option value="">默认下载器</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.type} ({c.host})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>保存路径 (可选)</label>
                                    <input
                                        type="text"
                                        value={formData.save_path}
                                        onChange={(e) => setFormData({ ...formData, save_path: e.target.value })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        placeholder="/downloads/movies"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => setShowModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} transition-colors`}>取消</button>
                                <button type="submit" className="px-10 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20">
                                    {editingTask ? '保存更改' : '创建任务'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RSS Source Management Modal */}
            {showRSSModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-3xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>RSS 订阅源维护</h2>
                            <button onClick={() => setShowRSSModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form onSubmit={handleRSSSubmit} className={`p-4 rounded-xl border-2 border-dashed ${borderColor} mb-6 space-y-4`}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>关联站点</label>
                                        <select
                                            required
                                            value={rssFormData.site_id}
                                            onChange={(e) => setRSSFormData({ ...rssFormData, site_id: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                        >
                                            <option value="">选择站点</option>
                                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>用途描述 (如: 剧集、热门种)</label>
                                        <input
                                            required
                                            type="text"
                                            value={rssFormData.name}
                                            onChange={(e) => setRSSFormData({ ...rssFormData, name: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="输入此订阅源的用途"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>RSS URL</label>
                                        <div className="flex space-x-2">
                                            <input
                                                required
                                                type="url"
                                                value={rssFormData.url}
                                                onChange={(e) => setRSSFormData({ ...rssFormData, url: e.target.value })}
                                                className={`flex-1 ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                                placeholder="https://..."
                                            />
                                            <button type="submit" className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors">
                                                添加
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="space-y-3">
                                <h3 className={`text-sm font-bold ${textPrimary} mb-2`}>已维护的订阅源 ({rssSources.length})</h3>
                                {rssSources.length === 0 ? (
                                    <p className={`text-center py-8 text-sm ${textSecondary}`}>暂无订阅源，请先添加</p>
                                ) : (
                                    rssSources.map(source => (
                                        <div key={source.id} className={`flex items-center justify-between p-3 border ${borderColor} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                            <div className="flex-1 min-w-0 mr-4">
                                                <div className="flex items-center space-x-2">
                                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 uppercase border border-gray-200 dark:border-gray-600">
                                                        {source.site_name}
                                                    </span>
                                                    <span className={`font-bold text-sm ${textPrimary}`}>{source.name}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 truncate">{source.url}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleSelectSource(source)}
                                                    className="px-3 py-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded text-xs font-medium transition-colors"
                                                >
                                                    选用
                                                </button>
                                                <button
                                                    onClick={() => deleteRSSSource(source.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className={`p-4 border-t ${borderColor} bg-gray-50/50 dark:bg-gray-900/50 flex justify-end`}>
                            <button onClick={() => setShowRSSModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>关闭</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Logs Modal */}
            {showLogsModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-4xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>任务执行日志: {editingTask?.name}</h2>
                            <button onClick={() => setShowLogsModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            {logLoading ? (
                                <div className="flex justify-center items-center h-64">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className={`sticky top-0 ${bgSecondary} z-10 border-b ${borderColor}`}>
                                        <tr className="text-[10px] uppercase tracking-widest text-gray-500">
                                            <th className="py-3 px-6 font-bold">时间</th>
                                            <th className="py-3 px-4 font-bold">状态</th>
                                            <th className="py-3 px-4 font-bold text-center">抓取/匹配</th>
                                            <th className="py-3 px-4 font-bold">消息</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {selectedTaskLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                                <td className="py-3 px-6 text-xs font-mono text-gray-400">
                                                    {new Date(log.run_time).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.status === 'success'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : 'bg-red-500/10 text-red-500'
                                                        }`}>
                                                        {log.status === 'success' ? '成功' : '失败'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center font-mono text-xs text-gray-500">
                                                    {log.items_found} / {log.items_matched}
                                                </td>
                                                <td className={`py-3 px-4 text-sm ${log.status === 'error' ? 'text-red-400' : textSecondary} italic`}>
                                                    {log.message}
                                                </td>
                                            </tr>
                                        ))}
                                        {selectedTaskLogs.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="py-20 text-center text-gray-500 italic">
                                                    暂无执行日志记录
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className={`p-4 border-t ${borderColor} bg-gray-50/50 dark:bg-gray-900/50 flex justify-end`}>
                            <button onClick={() => setShowLogsModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksPage;
