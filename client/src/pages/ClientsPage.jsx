import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const ClientsPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';
    const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

    const [formData, setFormData] = useState({
        name: '',
        type: 'qBittorrent',
        host: 'localhost',
        port: 8080,
        username: '',
        password: '',
        is_default: false
    });

    const [testingId, setTestingId] = useState(null);

    const fetchClients = async () => {
        try {
            const res = await authenticatedFetch('/api/clients');
            const data = await res.json();
            setClients(data);
        } catch (err) {
            console.error('Failed to fetch clients:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const testConnection = async (client) => {
        setTestingId(client.id);
        try {
            const res = await authenticatedFetch('/api/clients/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
            const data = await res.json();
            alert(data.message);
        } catch (err) {
            alert('测试失败: ' + err.message);
        } finally {
            setTestingId(null);
        }
    };

    const handleEdit = (client) => {
        setEditingClient(client);
        setFormData({
            name: client.name || '',
            type: client.type,
            host: client.host,
            port: client.port,
            username: client.username || '',
            username: client.username || '',
            password: client.password || '',
            is_default: !!client.is_default
        });
        setShowModal(true);
    };

    const handleAdd = () => {
        setEditingClient(null);
        setFormData({
            name: '',
            type: 'qBittorrent',
            host: 'localhost',
            port: 8080,
            username: '',
            username: '',
            password: '',
            is_default: false
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const method = editingClient ? 'PUT' : 'POST';
        const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';

        try {
            await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowModal(false);
            fetchClients();
        } catch (err) {
            alert('保存失败');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定删除吗？')) return;
        await authenticatedFetch(`/api/clients/${id}`, { method: 'DELETE' });
        fetchClients();
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>下载客户端</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>配置您的下载器（qBittorrent, Transmission 等）</p>
                </div>
                <button
                    onClick={() => {
                        setEditingClient(null);
                        setFormData({ type: 'qbittorrent', host: '', port: '8080', username: '', password: '' });
                        setShowModal(true);
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                >
                    + 添加客户端
                </button>
            </div>

            {loading ? (
                <div className={textSecondary}>加载中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => (
                        <div key={client.id} className={`${bgMain} rounded-xl p-6 border ${borderColor} shadow-sm`}>
                            <div className="flex justify-between mb-4">
                                <div className="flex items-center">
                                    <div className={`text-2xl mr-3 w-12 h-12 ${darkMode ? 'bg-green-900/30' : 'bg-green-100'} rounded-lg flex items-center justify-center`}>📥</div>
                                    <div>
                                        <h3 className={`font-bold ${textPrimary}`}>{client.name || client.type}</h3>
                                        <p className={`text-sm ${textSecondary}`}>
                                            {client.host}:{client.port}
                                            {!!client.is_default && (
                                                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-800">默认</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleEdit(client)} className={`${textSecondary} hover:text-blue-400`} title="编辑">✏️</button>
                                    <button onClick={() => handleDelete(client.id)} className={`${textSecondary} hover:text-red-400`} title="删除">🗑️</button>
                                </div>
                            </div>
                            <div className={`flex justify-between items-center mt-4 pt-4 border-t ${borderColor}`}>
                                <div className={`text-xs ${textSecondary}`}>
                                    用户: {client.username || '匿名'}
                                </div>
                                <button
                                    disabled={testingId === client.id}
                                    onClick={() => testConnection(client)}
                                    className={`text-xs px-3 py-1 rounded border transition-colors ${testingId === client.id
                                        ? 'border-gray-600 text-gray-500'
                                        : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10'
                                        }`}
                                >
                                    {testingId === client.id ? '测试中...' : '测试连接'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {clients.length === 0 && (
                        <div className={`col-span-full py-12 text-center ${textSecondary} ${bgMain} rounded-xl border border-dashed ${borderColor}`}>
                            暂无下载客户端，点击上方按钮添加。
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-xl w-full max-w-md border ${borderColor} shadow-2xl`}>
                        <div className={`p-6 border-b ${borderColor}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>
                                {editingClient ? '编辑下载客户端' : '添加下载客户端'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>自定义名称</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    placeholder="例如：主下载器、NAS-QB 等"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>类型</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                >
                                    <option value="qBittorrent">qBittorrent</option>
                                    <option value="Transmission">Transmission</option>
                                    <option value="Aria2">Aria2</option>
                                    <option value="Mock">Mock (Testing)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${textSecondary} mb-1`}>地址</label>
                                    <input
                                        type="text"
                                        value={formData.host}
                                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${textSecondary} mb-1`}>端口</label>
                                    <input
                                        type="number"
                                        value={formData.port}
                                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>用户名</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>密码</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    id="is_default"
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_default" className={`ml-2 text-sm font-medium ${textSecondary}`}>设为默认下载器</label>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className={`px-4 py-2 ${textSecondary} hover:${textPrimary} transition-colors`}>取消</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg text-white font-medium transition-colors">
                                    {editingClient ? '更新' : '添加'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};


export default ClientsPage;
