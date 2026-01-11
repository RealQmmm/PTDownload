const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';

// 密钥文件路径逻辑：跟随数据库位置
// 如果使用外部数据库，密钥也存储在外部目录
// 如果使用内置数据库，密钥存储在内置目录
function getSecretFilePath() {
    const externalDBDir = '/external_db';
    const externalDBPath = path.join(externalDBDir, 'ptdownload.db');
    const internalSecretPath = '/data/.secret';
    const externalSecretPath = path.join(externalDBDir, '.secret');

    // 逻辑与 db/index.js 保持一致
    if (fs.existsSync(externalDBPath)) {
        // 使用外部数据库，密钥也存储在外部
        return externalSecretPath;
    } else {
        // 使用内置数据库，密钥存储在 /data 目录
        return internalSecretPath;
    }
}

let secretKey = null;

// Ensure we have a secret key
function getSecretKey() {
    if (secretKey) return secretKey;

    const SECRET_FILE = getSecretFilePath();

    if (process.env.APP_SECRET) {
        // Use provided env var (hashed to ensure 32 bytes)
        secretKey = crypto.createHash('sha256').update(process.env.APP_SECRET).digest();
        console.log('[Crypto] Using APP_SECRET from environment variable');
    } else {
        // Check for persisted key file
        if (fs.existsSync(SECRET_FILE)) {
            const fileContent = fs.readFileSync(SECRET_FILE, 'utf8');
            secretKey = Buffer.from(fileContent, 'hex');
            console.log(`[Crypto] Loaded secret key from: ${SECRET_FILE}`);
        } else {
            // Generate new random key and save it
            secretKey = crypto.randomBytes(32);
            // Ensure directory exists
            const dir = path.dirname(SECRET_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(SECRET_FILE, secretKey.toString('hex'));
            console.log(`[Crypto] Generated and saved new secret key to: ${SECRET_FILE}`);
        }
    }
    return secretKey;
}

const cryptoUtils = {
    encrypt: (text) => {
        if (!text) return text;
        try {
            const key = getSecretKey();
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return `enc:${iv.toString('hex')}:${encrypted}`;
        } catch (err) {
            console.error('Encryption failed:', err);
            return text; // Return original if fail (should not happen)
        }
    },

    decrypt: (text) => {
        if (!text || !text.startsWith('enc:')) return text;
        try {
            const parts = text.split(':');
            if (parts.length !== 3) return text;

            const iv = Buffer.from(parts[1], 'hex');
            const encryptedText = parts[2];
            const key = getSecretKey();

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (err) {
            console.error('Decryption failed:', err);
            return text; // Return original (likely broken)
        }
    },

    isEncrypted: (text) => {
        return text && typeof text === 'string' && text.startsWith('enc:');
    }
};

module.exports = cryptoUtils;
