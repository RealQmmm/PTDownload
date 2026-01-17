import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useSettings } from './hooks/useSettings';

/**
 * Security Settings Component
 * Handles: Password change, user info display
 */
const SecuritySettings = ({ darkMode, authenticatedFetch, user }) => {
    const { saving, message, showMessage, saveSettings } = useSettings(authenticatedFetch);

    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';

    const handleChangePassword = async () => {
        // Validation
        if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            showMessage('error', '请填写所有密码字段');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showMessage('error', '两次输入的新密码不一致');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            showMessage('error', '新密码长度至少为 8 位');
            return;
        }

        // Password strength check
        const hasLetter = /[a-zA-Z]/.test(passwordData.newPassword);
        const hasNumber = /\d/.test(passwordData.newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword);

        if (!(hasLetter && (hasNumber || hasSpecial))) {
            showMessage('error', '新密码需包含字母和数字/符号');
            return;
        }

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
                showMessage('success', '密码修改成功');
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                showMessage('error', data.error || '密码修改失败');
            }
        } catch (err) {
            showMessage('error', '密码修改出错');
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

            {/* Current User Info */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>当前用户信息</h3>

                <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} flex items-center justify-center text-2xl`}>
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className={`text-lg font-semibold ${textPrimary}`}>
                                {user?.username}
                            </p>
                            <p className={`text-sm ${textSecondary}`}>
                                角色: {user?.role === 'admin' ? '管理员' : '普通用户'}
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Change Password */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>🔐 修改密码</h3>

                <div className="space-y-4 max-w-2xl">
                    <Input
                        label="当前密码"
                        type="password"
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                        placeholder="请输入当前密码"
                        darkMode={darkMode}
                    />

                    <Input
                        label="新密码"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="≥8位，需含字母/数字/符号"
                        darkMode={darkMode}
                    />

                    <Input
                        label="确认新密码"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="请再次输入新密码"
                        darkMode={darkMode}
                    />
                </div>

                <div className="mt-4">
                    <Button onClick={handleChangePassword} disabled={saving} darkMode={darkMode}>
                        {saving ? '保存中...' : '修改密码'}
                    </Button>
                </div>
            </Card>

            {/* Security Tips */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>🛡️ 安全建议</h3>

                <div className={`space-y-2 text-sm ${textSecondary}`}>
                    <p>• 定期更换密码，建议每 3-6 个月更换一次</p>
                    <p>• 使用强密码：至少 8 位，包含字母、数字和特殊符号</p>
                    <p>• 不要在多个网站使用相同的密码</p>
                    <p>• 不要与他人分享您的账户密码</p>
                </div>
            </Card>
        </div>
    );
};

export default SecuritySettings;
