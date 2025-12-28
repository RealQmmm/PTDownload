const axios = require('axios');
const { getDB } = require('../db');

class NotificationService {
    async getSettings() {
        const db = getDB();
        try {
            const settings = db.prepare("SELECT * FROM settings WHERE key LIKE 'notify_%'").all();
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

    async send(title, message, overrideConfig = null) {
        const config = overrideConfig || await this.getSettings();

        if (!config.enabled && !overrideConfig) {
            return { success: false, error: '通知功能已禁用' };
        }

        console.log(`[Notify] Sending notification: ${title}`);
        const results = { bark: null, webhook: null };

        // 1. Bark Notification
        if (config.barkUrl) {
            try {
                const url = config.barkUrl.endsWith('/') ? config.barkUrl : `${config.barkUrl}/`;
                const fullUrl = `${url}${encodeURIComponent(title)}/${encodeURIComponent(message)}`;
                await axios.get(fullUrl, { timeout: 10000 });
                results.bark = { success: true };
                console.log('[Notify] Bark notification sent');
            } catch (err) {
                results.bark = { success: false, error: err.message };
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
                results.webhook = { success: true };
                console.log('[Notify] Webhook notification sent');
            } catch (err) {
                results.webhook = { success: false, error: err.message };
                console.error('[Notify] Webhook failed:', err.message);
            }
        }

        const anySent = results.bark?.success || results.webhook?.success;
        const anyFailed = (results.bark && !results.bark.success) || (results.webhook && !results.webhook.success);

        if (!config.barkUrl && !config.webhookUrl) {
            return { success: false, error: '未配置任何通知地址' };
        }

        return {
            success: anySent && !anyFailed,
            partial: anySent && anyFailed,
            results
        };
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
