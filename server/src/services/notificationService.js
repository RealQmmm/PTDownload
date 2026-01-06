const axios = require('axios');
const { getDB } = require('../db');

class NotificationService {
    async getSettings() {
        const db = getDB();
        try {
            const settings = db.prepare("SELECT * FROM settings WHERE key LIKE 'notify_%' OR key = 'notification_receivers'").all();
            const settingsMap = {};
            settings.forEach(s => {
                settingsMap[s.key] = s.value;
            });

            // Parse receivers list
            let receivers = [];
            if (settingsMap['notification_receivers']) {
                try {
                    receivers = JSON.parse(settingsMap['notification_receivers']);
                } catch (e) {
                    console.error('[Notify] Failed to parse notification_receivers JSON:', e);
                }
            }

            // Fallback for backward compatibility (Soft Migration)
            // If no receivers defined but old keys exist, treat them as receivers
            if (receivers.length === 0) {
                if (settingsMap['notify_bark_url']) {
                    receivers.push({
                        id: 'legacy_bark',
                        type: 'bark',
                        name: 'Default Bark',
                        url: settingsMap['notify_bark_url'],
                        enabled: true
                    });
                }
                if (settingsMap['notify_webhook_url']) {
                    receivers.push({
                        id: 'legacy_webhook',
                        type: 'webhook',
                        name: 'Default Webhook',
                        url: settingsMap['notify_webhook_url'],
                        method: settingsMap['notify_webhook_method'] || 'GET',
                        enabled: true
                    });
                }
            }

            return {
                enabled: settingsMap['notify_enabled'] === 'true',
                notifyOnDownloadStart: settingsMap['notify_on_download_start'] === 'true',
                // RSS match notification: default to true for backward compatibility
                // If the key doesn't exist, assume user wants RSS notifications
                notifyOnRssMatch: settingsMap['notify_on_rss_match'] !== 'false',
                receivers: receivers.filter(r => r.enabled)
            };
        } catch (err) {
            console.error('[Notify] Failed to get settings:', err.message);
            return { enabled: false, notifyOnDownloadStart: false, receivers: [] };
        }
    }

    async send(title, message, overrideConfig = null) {
        const config = overrideConfig || await this.getSettings();

        // If specific receivers provided in overrideConfig (for test), use them, else use config.receivers
        const receivers = config.receivers || []; // handle case where test passes different structure

        if (receivers.length === 0) {
            // Check compatibility mode if overrideConfig has legacy fields (e.g. from older test payload)
            if (config.barkUrl) receivers.push({ type: 'bark', url: config.barkUrl, enabled: true });
            if (config.webhookUrl) receivers.push({ type: 'webhook', url: config.webhookUrl, method: config.webhookMethod, enabled: true });
        }

        if (receivers.length === 0) {
            return { success: false, error: '未配置任何有效通知接收端' };
        }

        console.log(`[Notify] Sending notification "${title}" to ${receivers.length} receivers`);
        const results = [];

        // Send to all receivers in parallel
        const promises = receivers.map(async (receiver) => {
            if (!receiver.enabled) return null;

            try {
                if (receiver.type === 'bark') {
                    const url = receiver.url.endsWith('/') ? receiver.url : `${receiver.url}/`;
                    const fullUrl = `${url}${encodeURIComponent(title)}/${encodeURIComponent(message)}`;
                    await axios.get(fullUrl, { timeout: 10000 });
                    console.log(`[Notify] Sent to Bark: ${receiver.name || receiver.url}`);
                    return { receiver: receiver.name || 'Bark', success: true };
                }
                else if (receiver.type === 'webhook') {
                    if (receiver.method === 'POST') {
                        await axios.post(receiver.url, { title, message }, { timeout: 10000 });
                    } else {
                        const url = new URL(receiver.url);
                        url.searchParams.append('title', title);
                        url.searchParams.append('message', message);
                        await axios.get(url.toString(), { timeout: 10000 });
                    }
                    console.log(`[Notify] Sent to Webhook: ${receiver.name || receiver.url}`);
                    return { receiver: receiver.name || 'Webhook', success: true };
                }
            } catch (err) {
                console.error(`[Notify] Failed to send to ${receiver.name || receiver.type}:`, err.message);
                return { receiver: receiver.name || receiver.type, success: false, error: err.message };
            }
            return null; // Should not happen given types
        });

        const sendResults = (await Promise.all(promises)).filter(r => r !== null);

        const successCount = sendResults.filter(r => r.success).length;
        const failCount = sendResults.length - successCount;

        if (successCount === 0 && failCount > 0) {
            return {
                success: false,
                error: '所有通知发送失败',
                results: sendResults
            };
        }

        return {
            success: true,
            partial: failCount > 0,
            message: `发送成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : ''),
            results: sendResults
        };
    }

    /**
     * Send notification for a new torrent match (RSS)
     */
    async notifyNewTorrent(taskName, torrentTitle, sizeStr) {
        const config = await this.getSettings();

        const loggerService = require('./loggerService');

        if (!config.enabled) {
            loggerService.log(`📢 通知未发送: 通知功能已禁用`, 'info');
            return { success: false, reason: 'disabled' };
        }

        // Use RSS-specific notification setting, NOT the download_start setting
        // RSS match is a different event than manual download start
        if (!config.notifyOnRssMatch) {
            loggerService.log(`📢 通知未发送: RSS匹配通知已禁用`, 'info');
            return { success: false, reason: 'rss_notify_disabled' };
        }

        const title = `✨ RSS 匹配成功: ${taskName}`;
        const message = `${torrentTitle}\n体积: ${sizeStr}`;

        // 记录通知接收端信息
        const receivers = config.receivers || [];
        const enabledReceivers = receivers.filter(r => r.enabled);

        if (enabledReceivers.length === 0) {
            loggerService.log(`📢 通知未发送: 未配置有效的通知接收端`, 'warning');
            return { success: false, reason: 'no_receivers' };
        }

        // 构建接收端信息字符串 - 类型、备注、URL 在一行显示
        const receiverInfo = enabledReceivers.map(r => {
            const type = r.type === 'bark' ? 'Bark' : r.type === 'webhook' ? 'Webhook' : r.type;
            const name = r.name || '未命名';
            const url = r.url || '';
            return `[${type}] ${name} ${url}`;
        }).join(' | ');

        loggerService.log(`📢 发送通知: ${torrentTitle} → ${receiverInfo}`, 'success');

        const result = await this.send(title, message, config);

        // 记录发送结果
        if (result.success) {
            if (result.partial) {
                loggerService.log(`📢 通知部分成功: ${result.message}`, 'warning');
            } else {
                loggerService.log(`📢 通知发送成功: ${result.message}`, 'success');
            }
        } else {
            loggerService.log(`📢 通知发送失败: ${result.error || '未知错误'}`, 'error');
        }

        return result;
    }

    /**
     * Send notification when a manual download starts
     */
    async notifyDownloadStart(torrentTitle, sizeStr) {
        const config = await this.getSettings();
        // Check global enable first
        if (!config.enabled || !config.notifyOnDownloadStart) return;

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
