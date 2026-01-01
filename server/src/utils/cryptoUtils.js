const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const SECRET_FILE = path.join(__dirname, '../../../data/.secret');

let secretKey = null;

// Ensure we have a secret key
function getSecretKey() {
    if (secretKey) return secretKey;

    if (process.env.APP_SECRET) {
        // Use provided env var (hashed to ensure 32 bytes)
        secretKey = crypto.createHash('sha256').update(process.env.APP_SECRET).digest();
    } else {
        // Check for persisted key file
        if (fs.existsSync(SECRET_FILE)) {
            const fileContent = fs.readFileSync(SECRET_FILE, 'utf8');
            secretKey = Buffer.from(fileContent, 'hex');
        } else {
            // Generate new random key and save it
            secretKey = crypto.randomBytes(32);
            // Ensure directory exists
            const dir = path.dirname(SECRET_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(SECRET_FILE, secretKey.toString('hex'));
            console.log('Generated and saved new application secret key.');
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
