const axios = require('axios');
const { getDB } = require('../db');

class NotificationService {
    async getSettings() {
        const db = getDB();
        try {
            const settings = db.prepare('SELECT * FROM settings WHERE key LIKE "notify_%"').all();
            const settingsMap = {};
            settings.forEach(s => {
                settingsMap[s.key] = s.value;
            });
            return {
                enabled: settingsMap['notify_enabled'] === 'true',
                barkUrl: settingsMap['notify_bark_url'] || '',
                webhookUrl: settingsMap['notify_webhook_url'] || '',
                webhookMethod: settingsMap['notify_webhook_method'] || 'GET'
            };
        } catch (err) {
            console.error('[Notify] Failed to get settings:', err.message);
            return { enabled: false };
        }
    }

    async send(title, message) {
        const config = await this.getSettings();
        if (!config.enabled) return;

        console.log(`[Notify] Sending notification: ${title}`);

        // 1. Bark Notification
        if (config.barkUrl) {
            try {
                const url = config.barkUrl.endsWith('/') ? config.barkUrl : `${config.barkUrl}/`;
                const fullUrl = `${url}${encodeURIComponent(title)}/${encodeURIComponent(message)}`;
                await axios.get(fullUrl, { timeout: 10000 });
                console.log('[Notify] Bark notification sent');
            } catch (err) {
                console.error('[Notify] Bark failed:', err.message);
            }
        }

        // 2. Custom Webhook
        if (config.webhookUrl) {
            try {
                if (config.webhookMethod === 'POST') {
                    await axios.post(config.webhookUrl, { title, message }, { timeout: 10000 });
                } else {
                    const url = new URL(config.webhookUrl);
                    url.searchParams.append('title', title);
                    url.searchParams.append('message', message);
                    await axios.get(url.toString(), { timeout: 10000 });
                }
                console.log('[Notify] Webhook notification sent');
            } catch (err) {
                console.error('[Notify] Webhook failed:', err.message);
            }
        }
    }

    /**
     * Send notification for a new torrent match
     */
    async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
        const title = `✨ 匹配到新资源: ${taskName}`;
        const message = `${torrentTitle}\n体积: ${sizeStr}`;
        await this.send(title, message);
    }
}

module.exports = new NotificationService();
