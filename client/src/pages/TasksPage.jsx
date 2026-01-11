import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import RSSFilterRules from '../components/RSSFilterRules';

const TasksPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [tasks, setTasks] = useState([]);
    const [sites, setSites] = useState([]);
    const [clients, setClients] = useState([]);
    const [rssSources, setRSSSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showRSSModal, setShowRSSModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [editingRSSSource, setEditingRSSSource] = useState(null);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedTaskLogs, setSelectedTaskLogs] = useState([]);
    const [logLoading, setLogLoading] = useState(false);
    const [downloadPaths, setDownloadPaths] = useState([]);
    const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
    const [enableMultiPath, setEnableMultiPath] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);


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
                authenticatedFetch('/api/tasks'),
                authenticatedFetch('/api/sites'),
                authenticatedFetch('/api/clients'),
                authenticatedFetch('/api/rss-sources')
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

    const fetchDownloadPaths = async () => {
        try {
            const res = await authenticatedFetch('/api/download-paths');
            const data = await res.json();
            setDownloadPaths(data);
        } catch (err) {
            console.error('Fetch download paths failed:', err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch('/api/settings');
            const data = await res.json();
            setDefaultDownloadPath(data.default_download_path || '');
            setEnableMultiPath(data.enable_multi_path === 'true' || data.enable_multi_path === true);
        } catch (err) {
            console.error('Fetch settings failed:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchDownloadPaths();
        fetchSettings();
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

        // If multi-path is disabled, pre-set to default path
        if (!enableMultiPath && defaultDownloadPath) {
            setFormData(prev => ({ ...prev, save_path: defaultDownloadPath }));
        }

        setShowModal(true);
    };

    const handleEdit = (task) => {
        setEditingTask(task);

        // Determine if path is one of the presets
        const isPresetPath = downloadPaths.some(p => p.path === task.save_path);
        const savePathValue = isPresetPath ? task.save_path : 'custom';
        const customPathValue = isPresetPath ? '' : task.save_path;

        setFormData({
            ...task,
            save_path: savePathValue,
            custom_path: customPathValue,
            filter_config: typeof task.filter_config === 'string'
                ? JSON.parse(task.filter_config)
                : (task.filter_config || { keywords: '', exclude: '', size_min: '', size_max: '' })
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 处理自定义路径
        const finalSavePath = formData.save_path === 'custom'
            ? formData.custom_path
            : formData.save_path;

        const payload = {
            ...formData,
            save_path: finalSavePath,
            filter_config: JSON.stringify(formData.filter_config)
        };

        try {
            const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
            const method = editingTask ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
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
            await authenticatedFetch(`/api/tasks/${task.id}/toggle`, {
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
        const task = tasks.find(t => t.id === id);

        if (task && (task.name.startsWith('[追剧]') || task.name.startsWith('[Series]'))) {
            alert("⚠️ 禁止删除\n\n该任务由【追剧订阅】自动生成，不能直接删除。\n请前往「追剧管理」页面删除对应的订阅，系统将自动清理该任务。");
            return;
        }

        if (!confirm('确定删除该自动化任务吗？')) return;
        try {
            console.log('Deleting task:', id);
            const res = await authenticatedFetch(`/api/tasks/${id}`, { method: 'DELETE' });
            console.log('Delete response:', res.status);
            if (res.ok) {
                fetchData();
            } else {
                const error = await res.text();
                console.error('Delete failed:', error);
                alert('删除失败: ' + error);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('删除失败: ' + err.message);
        }
    };

    const executeTask = async (task) => {
        try {
            const res = await authenticatedFetch(`/api/tasks/${task.id}/execute`, { method: 'POST' });
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
            const res = await authenticatedFetch(`/api/tasks/${task.id}/logs`);
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
        const method = editingRSSSource ? 'PUT' : 'POST';
        const url = editingRSSSource ? `/api/rss-sources/${editingRSSSource.id}` : '/api/rss-sources';

        try {
            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rssFormData)
            });
            if (res.ok) {
                setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
                setEditingRSSSource(null);
                fetchData();
            }
        } catch (err) {
            alert('保存失败');
        }
    };

    const openRSSEdit = (source) => {
        setEditingRSSSource(source);
        setRSSFormData({
            site_id: source.site_id,
            name: source.name,
            url: source.url
        });
    };

    const cancelRSSEdit = () => {
        setEditingRSSSource(null);
        setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
    };

    const deleteRSSSource = async (id) => {
        if (!confirm('确定删除该订阅源吗？')) return;
        await authenticatedFetch(`/api/rss-sources/${id}`, { method: 'DELETE' });
        fetchData();
    };

    const handleSelectSource = (source) => {
        setFormData({
            ...formData,
            name: editingTask ? formData.name : source.name,
            site_id: source.site_id,
            rss_url: source.url
        });
        setEditingRSSSource(null);
        setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
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
                    <Button
                        onClick={() => setShowRSSModal(true)}
                        variant="secondary"
                    >
                        订阅源维护
                    </Button>
                    <Button
                        onClick={handleAdd}
                        variant="primary"
                    >
                        + 创建任务
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载任务中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => {
                        const site = sites.find(s => s.id === task.site_id);
                        const client = clients.find(c => c.id === task.client_id);
                        const matchingSource = rssSources.find(s => s.url === task.rss_url);

                        const isSmartTask = task.type === 'smart_rss' || task.rss_url === 'SMART_AGGREGATION';

                        return (
                            <Card key={task.id} hover className="group">
                                <div className="flex flex-col space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${task.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                                            <h3 className={`text-lg font-bold leading-tight ${textPrimary} break-all`}>{task.name}</h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${darkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'} border`}>RSS 订阅</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex flex-wrap items-center gap-y-2 text-xs text-gray-500 space-x-3 min-w-0 flex-1">
                                            <div className="flex items-center">
                                                <span className="mr-1">🌐</span> {isSmartTask ? '⚡ 跨站点聚合' : (site?.name || '未知站点')}
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-1">📥</span> {client?.name || client?.type || '默认客户端'}
                                            </div>
                                            <div className={`flex items-center font-mono text-[10px] ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded`}>
                                                <span className="mr-1">⏰</span> {cronToHuman(task.cron)}
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            <Button
                                                onClick={() => viewLogs(task)}
                                                variant="secondary"
                                                size="sm"
                                                className="text-blue-500 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 whitespace-nowrap shrink-0"
                                            >
                                                日志
                                            </Button>
                                            <Button
                                                onClick={() => executeTask(task)}
                                                variant="secondary"
                                                size="sm"
                                                className="text-blue-500 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 whitespace-nowrap"
                                            >
                                                运行
                                            </Button>
                                            <Button
                                                onClick={() => toggleTask(task)}
                                                variant="secondary"
                                                size="sm"
                                                className={`whitespace-nowrap ${task.enabled
                                                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                                    : 'text-green-500 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                                    }`}
                                            >
                                                {task.enabled ? '暂停' : '启动'}
                                            </Button>
                                            <Button
                                                onClick={() => handleEdit(task)}
                                                variant="secondary"
                                                size="sm"
                                                className="whitespace-nowrap"
                                            >
                                                编辑
                                            </Button>
                                            <Button
                                                onClick={() => deleteTask(task.id)}
                                                variant="danger"
                                                size="xs"
                                                className="!p-2 shrink-0"
                                                title="删除任务"
                                            >
                                                🗑️
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {task.last_run && (
                                    <div className={`mt-2 pt-2 border-t ${borderColor} text-[10px] ${textSecondary} flex justify-between items-center`}>
                                        <span>上次运行: {new Date(task.last_run).toLocaleString()}</span>
                                        <div className="flex items-center max-w-[50%]">
                                            {matchingSource ? (
                                                <div className={`flex items-center ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'} px-2 py-0.5 rounded border`}>
                                                    <span className="mr-1 text-[10px]">📑</span>
                                                    <span className="text-blue-500 font-bold truncate text-[10px]">{matchingSource.name}</span>
                                                </div>
                                            ) : (
                                                <span className="truncate opacity-50 font-mono">{task.rss_url}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
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
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingTask ? '编辑自动任务' : '创建新 RSS 任务'}
                size="lg"
                className="w-full max-w-[95vw] sm:max-w-4xl overflow-x-hidden"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            {editingTask ? '保存更改' : '创建任务'}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <Input
                                label="任务名称"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="例如：M-Team 热门种追剧"
                            />
                        </div>

                        {/* Merged RSS URL and Execution Cycle Row */}
                        <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-start">
                            {/* Left: RSS URL (Flex Grow) */}
                            <div className="flex-1 w-full min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RSS 订阅链接</label>
                                    {rssSources.length > 0 && formData.type !== 'smart_rss' && (
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); setShowRSSModal(true); }}
                                            className="text-blue-500 text-xs hover:underline"
                                        >
                                            从订阅源库选择
                                        </button>
                                    )}
                                </div>

                                {(() => {
                                    // Smart Task Read-only View
                                    if (formData.type === 'smart_rss') {
                                        return (
                                            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 h-[72px]">
                                                <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-1">
                                                    <span className="mr-2">⚡</span> 智能跨站聚合
                                                </div>
                                                <p className="text-xs text-indigo-500/80 truncate">RSS 链接由「剧集订阅」自动管理。</p>
                                            </div>
                                        );
                                    }

                                    const matched = rssSources.find(s => s.url === formData.rss_url);
                                    return matched ? (
                                        <div className={`mb-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between h-[42px]`}>
                                            <div className="flex items-center overflow-hidden">
                                                <span className="mr-2 text-lg">📑</span>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-bold text-blue-500 truncate">{matched.name}</p>
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
                                        <Input
                                            required
                                            type="url"
                                            value={formData.rss_url}
                                            onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                                            placeholder="https://example.com/rss.php?..."
                                            className="h-[42px]"
                                        />
                                    );
                                })()}
                            </div>

                            {/* Right: Execution Cycle (Compact) */}
                            <div className="w-full md:w-auto flex-shrink-0">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">执行周期</label>
                                <div className="flex bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden h-[42px]">
                                    <input
                                        type="number"
                                        min="1"
                                        required
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
                                        className="flex-1 md:w-15 px-2 text-center text-base bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700"
                                    />
                                    <div className="relative w-16 md:w-20">
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
                                            className="w-full h-full pl-2 pr-6 md:pl-3 md:pr-8 text-sm bg-transparent focus:outline-none cursor-pointer text-gray-700 dark:text-gray-200 appearance-none"
                                        >
                                            <option value="m">分钟</option>
                                            <option value="h">小时</option>
                                            <option value="d">天</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                            <span className="mr-2">🔍</span> 过滤规则
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <div className="flex items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mr-2">智能正则匹配 (Smart Regex)</label>
                                    <div className="relative group">
                                        <button type="button" className="text-blue-500 hover:text-blue-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                            <p className="font-bold mb-1">支持标准 JavaScript 正则</p>
                                            <ul className="list-disc pl-3 space-y-1 text-[10px] text-gray-300">
                                                <li><code>.*</code> : 匹配任意字符</li>
                                                <li><code>S0?1</code> : 匹配 S1 或 S01</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <Input
                                    value={formData.filter_config.smart_regex || ''}
                                    onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, smart_regex: e.target.value } })}
                                    placeholder="例如: Game\.of\.Thrones.*S0?1.*(2160p|4k)"
                                    className="font-mono text-base"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">优先使用正则匹配，关键词作为二次过滤。</p>
                            </div>
                            <div>
                                <Input
                                    label="包含关键词 (逗号分隔)"
                                    value={formData.filter_config.keywords}
                                    onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, keywords: e.target.value } })}
                                    placeholder="例如: 2160p, H265"
                                />
                            </div>
                            <div>
                                <Input
                                    label="排除关键词 (逗号分隔)"
                                    value={formData.filter_config.exclude}
                                    onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, exclude: e.target.value } })}
                                    placeholder="例如: 720p, CAM"
                                />
                            </div>
                            <div>
                                <Input
                                    label="最小体积 (MB)"
                                    type="number"
                                    value={formData.filter_config.size_min}
                                    onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_min: e.target.value } })}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <Input
                                    label="最大体积 (MB)"
                                    type="number"
                                    value={formData.filter_config.size_max}
                                    onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_max: e.target.value } })}
                                    placeholder="无限制"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Select
                                label="分类 (Category)"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="">请选择分类</option>
                                <optgroup label="一次性下载（自动禁用）">
                                    <option value="Movies">🎬 电影</option>
                                    <option value="Music">🎵 音乐</option>
                                    <option value="Books">📚 书籍</option>
                                    <option value="Games">🎮 游戏</option>
                                </optgroup>
                                <optgroup label="持续订阅（持续运行）">
                                    <option value="Series">📺 剧集</option>
                                    <option value="Anime">🎌 动画</option>
                                    <option value="Documentary">🎥 纪录片</option>
                                    <option value="Variety">🎭 综艺</option>
                                    <option value="Other">📦 其他</option>
                                </optgroup>
                            </Select>
                            {formData.category && (() => {
                                const oneTimeCategories = ['movie', 'movies', 'film', 'films', '电影', 'music', 'album', '音乐', 'book', 'books', '书籍', 'game', 'games', '游戏'];
                                const isOneTime = oneTimeCategories.some(cat => formData.category.toLowerCase().includes(cat));
                                return (
                                    <p className={`text-[10px] mt-1 ${isOneTime ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {isOneTime ? 'ℹ️ 一次性任务，匹配后自动禁用' : 'ℹ️ 持续运行，适合追剧'}
                                    </p>
                                );
                            })()}
                        </div>
                        <div>
                            <Select
                                label="下载客户端"
                                value={formData.client_id}
                                onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
                            >
                                <option value="">默认下载器</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.type} ({c.host})</option>)}
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">保存路径</label>
                            <div className="flex space-x-2">
                                <Select
                                    value={formData.save_path}
                                    onChange={(e) => setFormData({ ...formData, save_path: e.target.value })}
                                    className="flex-1"
                                >
                                    <option value="">请选择路径</option>
                                    {enableMultiPath ? (
                                        // 多路径管理模式：显示所有配置的路径
                                        <>
                                            {downloadPaths.map(p => (
                                                <option key={p.id} value={p.path}>
                                                    {p.is_default ? '⭐ ' : ''}{p.name} ({p.path})
                                                </option>
                                            ))}
                                        </>
                                    ) : (
                                        // 简单模式：只显示默认路径
                                        <>
                                            {defaultDownloadPath && (
                                                <option value={defaultDownloadPath}>
                                                    📂 默认路径 ({defaultDownloadPath})
                                                </option>
                                            )}
                                        </>
                                    )}
                                    <option value="custom">✏️ 自定义路径...</option>
                                </Select>

                            </div>
                            {formData.save_path === 'custom' && (
                                <Input
                                    value={formData.custom_path || ''}
                                    onChange={(e) => setFormData({ ...formData, custom_path: e.target.value })}
                                    placeholder="/downloads/custom"
                                    className="mt-2"
                                />
                            )}
                            {!enableMultiPath && !defaultDownloadPath && (
                                <p className="text-xs text-amber-500 mt-1">
                                    💡 提示：请先在「系统设置 - 下载」中配置默认下载路径
                                </p>
                            )}
                        </div>
                    </div>
                </form>
            </Modal>

            {/* RSS Source Management Modal */}
            <Modal
                isOpen={showRSSModal}
                onClose={() => { setShowRSSModal(false); cancelRSSEdit(); }}
                title="RSS 订阅源维护"
                size="lg"
                footer={
                    <Button variant="ghost" onClick={() => { setShowRSSModal(false); cancelRSSEdit(); }}>
                        关闭
                    </Button>
                }
            >
                <div className="space-y-6">
                    <form onSubmit={handleRSSSubmit} className={`p-4 rounded-xl border-2 ${editingRSSSource ? 'border-blue-500/50 bg-blue-500/5' : 'border-dashed border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className={`text-xs font-bold ${editingRSSSource ? 'text-blue-500' : 'text-gray-500'} uppercase`}>
                                {editingRSSSource ? '编辑现有订阅源' : '添加新订阅源'}
                            </h4>
                            {editingRSSSource && (
                                <button
                                    type="button"
                                    onClick={cancelRSSEdit}
                                    className="text-[10px] text-blue-500 hover:underline font-bold"
                                >
                                    取消编辑
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Select
                                    label="关联站点"
                                    required
                                    value={rssFormData.site_id}
                                    onChange={(e) => setRSSFormData({ ...rssFormData, site_id: e.target.value })}
                                >
                                    <option value="">选择站点</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </Select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-1">用途描述</label>
                                        <div className="relative group cursor-help">
                                            <span className="text-gray-400">❓</span>
                                            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                <p className="font-bold mb-1">用于跨站智能聚合筛选</p>
                                                <p className="text-gray-300">系统根据名称自动决定是否扫描该源：</p>
                                                <ul className="list-disc pl-3 mt-1 space-y-1">
                                                    <li>包含 <b>剧集, TV, 综合</b> 等：必扫</li>
                                                    <li>包含 <b>电影, Game</b> 等：跳过</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowRulesModal(true)}
                                        className="text-[10px] text-blue-500 hover:underline"
                                    >
                                        ⚙️ 配置筛选规则
                                    </button>
                                </div>
                                <Input
                                    required
                                    value={rssFormData.name}
                                    onChange={(e) => setRSSFormData({ ...rssFormData, name: e.target.value })}
                                    placeholder="输入如：剧集、热门种"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">RSS URL</label>
                                <div className="flex space-x-2">
                                    <Input
                                        required
                                        type="url"
                                        value={rssFormData.url}
                                        onChange={(e) => setRSSFormData({ ...rssFormData, url: e.target.value })}
                                        placeholder="https://..."
                                        className="flex-1"
                                    />
                                    <Button
                                        type="submit"
                                        variant={editingRSSSource ? 'secondary' : 'primary'}
                                        className={`${editingRSSSource ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''} whitespace-nowrap shrink-0`}
                                    >
                                        {editingRSSSource ? '更新' : '添加'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">已维护的订阅源 ({rssSources.length})</h3>
                        {rssSources.length === 0 ? (
                            <p className="text-center py-8 text-sm text-gray-500">暂无订阅源，请先添加</p>
                        ) : (
                            rssSources.map(source => (
                                <div key={source.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <div className="flex items-center space-x-2">
                                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase">
                                                {source.site_name}
                                            </span>
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{source.name}</span>
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
                                            onClick={() => openRSSEdit(source)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                                            title="编辑"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => deleteRSSSource(source.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                            title="删除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {/* Rules Config Modal */}
            <Modal
                isOpen={showRulesModal}
                onClose={() => setShowRulesModal(false)}
                title="智能筛选规则配置"
                size="lg"
            >
                <RSSFilterRules onClose={() => setShowRulesModal(false)} />
            </Modal>

            {/* Task Logs Modal */}
            <Modal
                isOpen={showLogsModal}
                onClose={() => setShowLogsModal(false)}
                title={`任务执行日志: ${editingTask?.name || ''}`}
                size="xl"
                footer={
                    <Button variant="ghost" onClick={() => setShowLogsModal(false)}>关闭</Button>
                }
            >
                <div>
                    {logLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50 z-10 border-b border-gray-200 dark:border-gray-700">
                                    <tr className="text-[10px] uppercase tracking-widest text-gray-500">
                                        <th className="py-3 px-6 font-bold">时间</th>
                                        <th className="py-3 px-4 font-bold">状态</th>
                                        <th className="py-3 px-4 font-bold text-center">抓取/匹配</th>
                                        <th className="py-3 px-4 font-bold">消息</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {selectedTaskLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="py-3 px-6 text-xs font-mono text-gray-400">
                                                {new Date(log.run_time).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${(log.status === 'success' || log.status === 'info')
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {(log.status === 'success' || log.status === 'info') ? '成功' : '失败'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono text-xs text-gray-500">
                                                {log.items_found} / {log.items_matched}
                                            </td>
                                            <td className={`py-3 px-4 text-sm ${log.status === 'error' ? 'text-red-400' : 'text-gray-600 dark:text-gray-400'} italic`}>
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
                        </div>
                    )}
                </div>
            </Modal>


        </div >
    );
};

export default TasksPage;
