const webpush = require('web-push');
const { getDB } = require('../db');

class PWAPush {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            const db = getDB();
            const publicKey = db.prepare("SELECT value FROM settings WHERE key = 'pwa_vapid_public_key'").get()?.value;
            const privateKey = db.prepare("SELECT value FROM settings WHERE key = 'pwa_vapid_private_key'").get()?.value;

            if (publicKey && privateKey) {
                webpush.setVapidDetails(
                    'mailto:admin@ptdownload.local',
                    publicKey,
                    privateKey
                );
                this.initialized = true;
            }
        } catch (err) {
            console.error('[PWA-Push] Init failed:', err.message);
        }
    }

    async sendToUser(userId, title, body, url = '/') {
        await this.init();
        if (!this.initialized) return;

        const db = getDB();
        const subscriptions = db.prepare('SELECT * FROM pwa_subscriptions WHERE user_id = ?').all(userId);

        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({
            title,
            body,
            url
        });

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
            } catch (err) {
                console.error(`[PWA-Push] Push failed for endpoint ${sub.endpoint}:`, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM pwa_subscriptions WHERE endpoint = ?').run(sub.endpoint);
                }
            }
        }
    }

    async sendToAll(title, body, url = '/') {
        await this.init();
        if (!this.initialized) return;

        const db = getDB();
        const subscriptions = db.prepare('SELECT * FROM pwa_subscriptions').all();

        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({
            title,
            body,
            url
        });

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
            } catch (err) {
                console.error(`[PWA-Push] Push failed for endpoint ${sub.endpoint}:`, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM pwa_subscriptions WHERE endpoint = ?').run(sub.endpoint);
                }
            }
        }
    }
}

module.exports = new PWAPush();
