const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const downloaderService = require('../services/downloaderService');

// Pause torrent
router.post('/pause', async (req, res) => {
    try {
        const { clientId, hash } = req.body;

        if (!clientId || !hash) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }

        const client = clientService.getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: '未找到下载客户端' });
        }

        const result = await downloaderService.pauseTorrent(client, hash);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        console.error('Pause torrent error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Resume torrent
router.post('/resume', async (req, res) => {
    try {
        const { clientId, hash } = req.body;

        if (!clientId || !hash) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }

        const client = clientService.getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: '未找到下载客户端' });
        }

        const result = await downloaderService.resumeTorrent(client, hash);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        console.error('Resume torrent error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete torrent
router.post('/delete', async (req, res) => {
    try {
        const { clientId, hash, deleteFiles = true } = req.body;

        if (!clientId || !hash) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }

        const client = clientService.getClientById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: '未找到下载客户端' });
        }

        const result = await downloaderService.deleteTorrent(client, hash, deleteFiles);
        if (result.success) {
            res.json({ success: true, message: '已删除任务' });
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        console.error('Delete torrent error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
