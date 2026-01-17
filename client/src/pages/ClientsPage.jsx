import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const ClientsPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);

    // Theme-aware classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

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
                <Button onClick={handleAdd}>
                    + 添加客户端
                </Button>
            </div>

            {loading ? (
                <div className={textSecondary}>加载中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => (
                        <Card key={client.id} className="p-6">
                            <div className="flex justify-between mb-4">
                                <div className="flex items-center">
                                    <div className={`text-2xl mr-3 w-12 h-12 ${darkMode ? 'bg-green-900/30' : 'bg-green-100'} rounded-lg flex items-center justify-center`}>📥</div>
                                    <div>
                                        <h3 className={`font-bold ${textPrimary}`}>{client.name || client.type}</h3>
                                        <p className={`text-sm ${textSecondary}`}>
                                            {client.host}:{client.port}
                                            {!!client.is_default && (
                                                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded dark:bg-blue-900/50 dark:text-blue-200">默认</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <Button size="xs" variant="ghost" onClick={() => handleEdit(client)} title="编辑">✏️</Button>
                                    <Button size="xs" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(client.id)} title="删除">🗑️</Button>
                                </div>
                            </div>
                            <div className={`flex justify-between items-center mt-4 pt-4 border-t ${borderColor}`}>
                                <div className={`text-xs ${textSecondary}`}>
                                    用户: {client.username || '匿名'}
                                </div>
                                <Button
                                    size="xs"
                                    variant="secondary"
                                    disabled={testingId === client.id}
                                    onClick={() => testConnection(client)}
                                >
                                    {testingId === client.id ? '测试中...' : '测试连接'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {clients.length === 0 && (
                        <div className={`col-span-full py-12 text-center ${textSecondary} ${bgMain} rounded-xl border border-dashed ${borderColor}`}>
                            暂无下载客户端，点击上方按钮添加。
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingClient ? '编辑下载客户端' : '添加下载客户端'}
                footer={null}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="自定义名称"
                        placeholder="例如：主下载器、NAS-QB 等"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    <Select
                        label="类型"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                        <option value="qBittorrent">qBittorrent</option>
                        <option value="Transmission">Transmission</option>
                        <option value="Aria2">Aria2</option>
                        <option value="Mock">Mock (Testing)</option>
                    </Select>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <Input
                                label="地址"
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <Input
                                label="端口"
                                type="number"
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="用户名"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                        <Input
                            label="密码"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center pt-2">
                        <input
                            id="is_default"
                            type="checkbox"
                            checked={formData.is_default}
                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="is_default" className={`ml-2 text-sm font-medium ${textSecondary} cursor-pointer`}>设为默认下载器</label>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button variant="secondary" onClick={() => setShowModal(false)}>取消</Button>
                        <Button type="submit">
                            {editingClient ? '更新' : '添加'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ClientsPage;
