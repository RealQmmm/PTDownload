const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';
const JWT_EXPIRES_IN = '7d';

class AuthService {
    async login(username, password) {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            throw new Error('Invalid username or password');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid username or password');
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return {
            token,
            user: {
                id: user.id,
                username: user.username
            }
        };
    }

    async createUser(username, password) {
        const db = getDB();
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
                .run(username, hashedPassword);
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
            await this.createUser('admin', 'admin123');
            console.log('Default admin user created: admin / admin123');
            console.warn('PLEASE CHANGE THE DEFAULT PASSWORD IMMEDIATELY!');
        }
    }
}

module.exports = new AuthService();
