import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSettings } from './hooks/useSettings';

/**
 * User Management Component (Admin Only)
 * Handles: User CRUD, role management, permissions
 */
const UserManagement = ({ darkMode, authenticatedFetch, currentUser }) => {
    const { saving, setSaving, message, showMessage } = useSettings(authenticatedFetch);

    const [users, setUsers] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUserData, setNewUserData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'user'
    });

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await authenticatedFetch('/api/users');
            const data = await res.json();
            setUsers(data || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const handleAddUser = async () => {
        if (!newUserData.username || !newUserData.password || !newUserData.confirmPassword) {
            showMessage('error', '请填写所有字段');
            return;
        }

        if (newUserData.password !== newUserData.confirmPassword) {
            showMessage('error', '两次输入的密码不一致');
            return;
        }

        if (newUserData.password.length < 8) {
            showMessage('error', '密码长度至少为 8 位');
            return;
        }

        setSaving(true);
        try {
            const res = await authenticatedFetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: newUserData.username,
                    password: newUserData.password,
                    role: newUserData.role
                })
            });

            const data = await res.json();

            if (res.ok) {
                showMessage('success', '用户添加成功');
                setShowAddModal(false);
                setNewUserData({ username: '', password: '', confirmPassword: '', role: 'user' });
                fetchUsers();
            } else {
                showMessage('error', data.error || '添加失败');
            }
        } catch (err) {
            showMessage('error', '添加出错');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';

        setSaving(true);
        try {
            const res = await authenticatedFetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                showMessage('success', '角色修改成功');
                fetchUsers();
            } else {
                const data = await res.json();
                showMessage('error', data.error || '修改失败');
            }
        } catch (err) {
            showMessage('error', '修改出错');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 1 ? 0 : 1;

        setSaving(true);
        try {
            const res = await authenticatedFetch(`/api/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newStatus })
            });

            if (res.ok) {
                showMessage('success', newStatus === 1 ? '用户已启用' : '用户已禁用');
                fetchUsers();
            } else {
                const data = await res.json();
                showMessage('error', data.error || '操作失败');
            }
        } catch (err) {
            showMessage('error', '操作出错');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复！`)) {
            return;
        }

        setSaving(true);
        try {
            const res = await authenticatedFetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showMessage('success', '用户删除成功');
                fetchUsers();
            } else {
                const data = await res.json();
                showMessage('error', data.error || '删除失败');
            }
        } catch (err) {
            showMessage('error', '删除出错');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <Card darkMode={darkMode}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>
                        👥 用户管理
                    </h3>
                    <Button onClick={() => setShowAddModal(true)} darkMode={darkMode} size="sm">
                        + 添加用户
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b ${borderColor}`}>
                                <th className={`text-left py-2 px-2 ${textSecondary} font-medium`}>用户名</th>
                                <th className={`text-left py-2 px-2 ${textSecondary} font-medium`}>角色</th>
                                <th className={`hidden sm:table-cell text-left py-2 px-2 ${textSecondary} font-medium`}>创建时间</th>
                                <th className={`text-right py-2 px-2 ${textSecondary} font-medium`}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className={`border-b ${borderColor} ${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                                    <td className={`py-3 px-2 ${textPrimary}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} flex items-center justify-center text-xs`}>
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{user.username}</span>
                                            {user.id === currentUser?.id && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">当前</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2 py-0.5 rounded text-xs w-fit ${user.role === 'admin'
                                                    ? 'bg-purple-500/20 text-purple-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {user.role === 'admin' ? '管理员' : '普通用户'}
                                            </span>
                                            {user.enabled === 0 && (
                                                <span className="px-2 py-0.5 rounded text-xs w-fit bg-rose-500/20 text-rose-500">
                                                    已禁用
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`hidden sm:table-cell py-3 px-2 ${textSecondary} text-xs`}>
                                        {user.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        {user.id !== currentUser?.id && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleRole(user.id, user.role)}
                                                    className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} ${textSecondary}`}
                                                    disabled={saving}
                                                >
                                                    {user.role === 'admin' ? '降为用户' : '升为管理员'}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user.id, user.enabled)}
                                                    className={`text-xs px-2 py-1 rounded ${user.enabled === 1
                                                            ? 'bg-orange-900/10 text-orange-500 hover:bg-orange-900/20'
                                                            : 'bg-emerald-900/10 text-emerald-500 hover:bg-emerald-900/20'
                                                        }`}
                                                    disabled={saving}
                                                >
                                                    {user.enabled === 1 ? '禁用' : '启用'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                                    className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-red-900/30 hover:bg-red-900/50' : 'bg-red-100 hover:bg-red-200'} text-red-500`}
                                                    disabled={saving}
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className={`mt-4 text-xs ${textSecondary}`}>
                    共有 {users.length} 名注册用户
                </p>
            </Card>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                    <div className={`${bgMain} rounded-lg p-6 w-full max-w-md mx-4 shadow-xl`} onClick={(e) => e.stopPropagation()}>
                        <h3 className={`text-lg font-bold ${textPrimary} mb-4`}>添加新用户</h3>

                        <div className="space-y-4">
                            <Input
                                label="用户名"
                                value={newUserData.username}
                                onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                                placeholder="请输入用户名 (≥2位)"
                                darkMode={darkMode}
                            />

                            <Input
                                label="密码"
                                type="password"
                                value={newUserData.password}
                                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                placeholder="需包含字母、数字及符号 (≥8位)"
                                darkMode={darkMode}
                            />

                            <Input
                                label="确认密码"
                                type="password"
                                value={newUserData.confirmPassword}
                                onChange={(e) => setNewUserData({ ...newUserData, confirmPassword: e.target.value })}
                                placeholder="请再次输入密码"
                                darkMode={darkMode}
                            />

                            <div>
                                <label className={`block text-xs font-bold ${textSecondary} mb-2`}>角色</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="user"
                                            checked={newUserData.role === 'user'}
                                            onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                            className="w-4 h-4"
                                        />
                                        <span className={textPrimary}>普通用户</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="admin"
                                            checked={newUserData.role === 'admin'}
                                            onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                            className="w-4 h-4"
                                        />
                                        <span className={textPrimary}>管理员</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <Button onClick={handleAddUser} disabled={saving} darkMode={darkMode} className="flex-1">
                                {saving ? '添加中...' : '添加用户'}
                            </Button>
                            <Button onClick={() => setShowAddModal(false)} variant="secondary" darkMode={darkMode} className="flex-1">
                                取消
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
