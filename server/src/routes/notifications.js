const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const webpush = require('web-push');

/**
 * Get VAPID public key
 */
router.get('/vapid-key', async (req, res) => {
    try {
        const db = getDB();
        let publicKey = db.prepare("SELECT value FROM settings WHERE key = 'pwa_vapid_public_key'").get()?.value;

        if (!publicKey) {
            // Generate keys if not existing
            const vapidKeys = webpush.generateVAPIDKeys();
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('pwa_vapid_public_key', vapidKeys.publicKey);
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('pwa_vapid_private_key', vapidKeys.privateKey);
            publicKey = vapidKeys.publicKey;
        }

        res.json({ success: true, publicKey });
    } catch (err) {
        console.error('[PWA-Route] Failed to get VAPID key:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Subscribe to PWA notifications
 */
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, deviceName } = req.body;
        const userId = req.user.id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, message: 'Invalid subscription data' });
        }

        const db = getDB();

        // Save to database
        db.prepare(`
            INSERT OR REPLACE INTO pwa_subscriptions (user_id, endpoint, p256dh, auth, device_name)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            userId,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
            deviceName || 'Unknown Device'
        );

        res.json({ success: true, message: '订阅成功' });
    } catch (err) {
        console.error('[PWA-Route] Subscription failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Test push notification
 */
router.post('/test', async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDB();

        const subscriptions = db.prepare('SELECT * FROM pwa_subscriptions WHERE user_id = ?').all(userId);

        if (subscriptions.length === 0) {
            return res.status(400).json({ success: false, message: '未找到该用户的订阅记录' });
        }

        const publicKey = db.prepare("SELECT value FROM settings WHERE key = 'pwa_vapid_public_key'").get()?.value;
        const privateKey = db.prepare("SELECT value FROM settings WHERE key = 'pwa_vapid_private_key'").get()?.value;

        if (!publicKey || !privateKey) {
            return res.status(500).json({ success: false, message: 'VAPID 密钥未初始化' });
        }

        webpush.setVapidDetails(
            'mailto:admin@ptdownload.local',
            publicKey,
            privateKey
        );

        const payload = JSON.stringify({
            title: 'PT 推送测试',
            body: '这是一条来自 PTDownload 的测试通知',
            url: '/'
        });

        let successCount = 0;
        for (const sub of subscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };
                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
            } catch (err) {
                console.error(`[PWA-Route] Push failed for endpoint ${sub.endpoint}:`, err.message);
                // If 410 or 404, the subscription is expired or invalid
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM pwa_subscriptions WHERE endpoint = ?').run(sub.endpoint);
                }
            }
        }

        res.json({ success: true, message: `测试发送完成，成功: ${successCount}` });
    } catch (err) {
        console.error('[PWA-Route] Test failed:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
