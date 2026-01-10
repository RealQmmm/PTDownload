const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';
const JWT_EXPIRES_IN = '7d';

class AuthService {
    async login(username, password, loginInfo = {}) {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        try {
            if (!user) {
                throw new Error('Invalid username or password');
            }

            // Check if user is disabled
            if (user.enabled === 0) {
                throw new Error('User account is disabled');
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                throw new Error('Invalid username or password');
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role || 'admin' },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Record successful login
            this.recordLogin({
                userId: user.id,
                username: user.username,
                status: 'success',
                ...loginInfo
            });

            return {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role || 'admin'
                }
            };
        } catch (err) {
            // Record failed login
            this.recordLogin({
                userId: user ? user.id : null,
                username: username,
                status: 'failed',
                message: err.message,
                ...loginInfo
            });
            throw err;
        }
    }

    recordLogin(data) {
        const db = getDB();
        const { userId, username, ip, userAgent, status, message } = data;

        // Simple UA parsing
        const browser = this.parseBrowser(userAgent);
        const os = this.parseOS(userAgent);
        const deviceName = this.parseDevice(userAgent);

        try {
            db.prepare(`
                INSERT INTO login_logs (user_id, username, ip, user_agent, device_name, browser, os, status, message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, username, ip, userAgent, deviceName, browser, os, status, message);
        } catch (err) {
            console.error('Failed to record login log:', err);
        }
    }

    parseBrowser(ua) {
        if (!ua) return 'Unknown';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        return 'Other';
    }

    parseOS(ua) {
        if (!ua) return 'Unknown';
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac OS X')) return 'macOS';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        if (ua.includes('Linux')) return 'Linux';
        return 'Other';
    }

    parseDevice(ua) {
        if (!ua) return 'Unknown';
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Android')) {
            const match = ua.match(/\(([^;]+);/);
            return match ? match[1] : 'Android Device';
        }
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Macintosh')) return 'Mac';
        return 'Unknown Device';
    }

    async createUser(username, password, role = 'user') {
        const db = getDB();
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
                .run(username, hashedPassword, role);
            return result.lastInsertRowid;
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                throw new Error('Username already exists');
            }
            throw err;
        }
    }

    async changePassword(userId, oldPassword, newPassword) {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new Error('Old password incorrect');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?')
            .run(hashedNewPassword, userId);
    }

    // 修改用户名
    async changeUsername(userId, newUsername) {
        const db = getDB();

        // 检查新用户名是否已存在
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, userId);
        if (existing) {
            throw new Error('Username already exists');
        }

        db.prepare('UPDATE users SET username = ? WHERE id = ?')
            .run(newUsername, userId);

        return { username: newUsername };
    }

    // 获取所有用户列表（不包含密码）
    getAllUsers() {
        const db = getDB();
        return db.prepare("SELECT id, username, role, permissions, enabled, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM users ORDER BY created_at ASC").all();
    }

    // 获取用户信息
    getUserById(userId) {
        const db = getDB();
        const user = db.prepare("SELECT id, username, role, permissions, enabled, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM users WHERE id = ?").get(userId);
        return user;
    }

    // 切换用户启用状态
    async toggleUserStatus(userId, currentUserId) {
        if (userId === currentUserId) {
            throw new Error('Cannot disable your own account');
        }
        const db = getDB();
        const user = db.prepare('SELECT enabled FROM users WHERE id = ?').get(userId);
        if (!user) throw new Error('User not found');

        const newStatus = user.enabled === 1 ? 0 : 1;
        db.prepare('UPDATE users SET enabled = ? WHERE id = ?').run(newStatus, userId);
        return { enabled: newStatus };
    }

    // 获取登录日志
    getLoginLogs(limit = 100) {
        const db = getDB();
        return db.prepare(`
            SELECT *, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at 
            FROM login_logs 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(limit);
    }

    // 清空登录日志
    clearLoginLogs() {
        const db = getDB();
        return db.prepare('DELETE FROM login_logs').run();
    }

    // 删除用户
    async deleteUser(userId, currentUserId) {
        const db = getDB();

        // 不能删除自己
        if (userId === currentUserId) {
            throw new Error('Cannot delete yourself');
        }

        // 检查是否是最后一个管理员
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
        if (user && user.role === 'admin') {
            const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count;
            if (adminCount <= 1) {
                throw new Error('Cannot delete the last admin user');
            }
        }

        const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        if (result.changes === 0) {
            throw new Error('User not found');
        }
        return true;
    }

    // 更新用户角色
    async updateUserRole(userId, newRole, currentUserId) {
        const db = getDB();

        // 验证角色值
        if (!['admin', 'user'].includes(newRole)) {
            throw new Error('Invalid role');
        }

        // 如果是降级管理员，检查是否是最后一个
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
        if (user && user.role === 'admin' && newRole === 'user') {
            const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count;
            if (adminCount <= 1) {
                throw new Error('Cannot demote the last admin user');
            }
        }

        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
        return true;
    }

    // 更新用户权限
    async updateUserPermissions(userId, permissions) {
        const db = getDB();
        const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
        db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permissionsJson, userId);
        return true;
    }

    // 管理员重置用户密码
    async resetUserPassword(userId, newPassword) {
        const db = getDB();
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
        return true;
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return null;
        }
    }

    async initDefaultAdmin() {
        const db = getDB();
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

        if (userCount === 0) {
            console.log('No users found, creating default admin user...');
            await this.createUser('admin', 'admin123', 'admin');
            console.log('Default admin user created: admin / admin123');
            console.warn('PLEASE CHANGE THE DEFAULT PASSWORD IMMEDIATELY!');
        }
    }
}

module.exports = new AuthService();
