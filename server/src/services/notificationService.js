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
                webhookMethod: settingsMap['notify_webhook_method'] || 'GET',
                notifyOnDownloadStart: settingsMap['notify_on_download_start'] === 'true'
            };
        } catch (err) {
            console.error('[Notify] Failed to get settings:', err.message);
            return { enabled: false, notifyOnDownloadStart: false };
        }
    }

    async send(title, message, overrideConfig = null) {
        const config = overrideConfig || await this.getSettings();

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
     * Send notification for a new torrent match (RSS)
     */
    async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
        const config = await this.getSettings();
        if (!config.notifyOnDownloadStart) return;

        const title = `✨ RSS 匹配成功: ${taskName}`;
        const message = `${torrentTitle}\n体积: ${sizeStr}`;
        await this.send(title, message, config);
    }

    /**
     * Send notification when a manual download starts
     */
    async notifyDownloadStart(torrentTitle, sizeStr) {
        const config = await this.getSettings();
        if (!config.notifyOnDownloadStart) return;

        const title = `🚀 开始下载资源`;
        const message = `${torrentTitle}\n体积: ${sizeStr || '未知'}`;
        await this.send(title, message, config);
    }

    /**
     * Send notification for generic system errors
     */
    async notifySystemError(errorTitle, errorMessage) {
        const config = await this.getSettings();
        // Always send system errors if notification is globally enabled
        if (!config.enabled) return;

        const title = `⚠️ 系统错误: ${errorTitle}`;
        await this.send(title, errorMessage, config);
    }

    /**
     * Send notification for cookie expiration
     */
    async notifyCookieExpiration(siteName) {
        const config = await this.getSettings();
        if (!config.enabled) return;

        const title = `🚨 Cookie 已过期`;
        const message = `站点: ${siteName}\n您的登录状态已失效，请尽快更新 Cookie 以免影响自动任务。`;
        await this.send(title, message, config);
    }

    /**
     * Send notification for check-in failure
     */
    async notifyCheckinFailed(siteName, reason) {
        const config = await this.getSettings();
        if (!config.enabled) return;

        const title = `❌ 签到失败`;
        const message = `站点: ${siteName}\n原因: ${reason || '未知错误'}\n请检查 Cookie 或网络连接。`;
        await this.send(title, message, config);
    }
}

module.exports = new NotificationService();
