const https = require('https');

/**
 * Download M-Team torrent file using native HTTPS module
 * This is more reliable than axios in Docker environments
 */
async function downloadMTeamTorrent(downloadUrl) {
    return new Promise((resolve, reject) => {
        const urlParsed = new URL(downloadUrl);

        const options = {
            hostname: urlParsed.hostname,
            port: urlParsed.port || 443,
            path: urlParsed.pathname + urlParsed.search,
            method: 'GET',
            timeout: 60000,
            rejectUnauthorized: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        };

        console.log(`[M-Team Download] Making HTTPS request to: ${urlParsed.hostname}${urlParsed.pathname}`);

        const req = https.request(options, (res) => {
            console.log(`[M-Team Download] Response status: ${res.statusCode}, headers:`, res.headers);

            // Handle redirects manually - allow M-Team domains and their CDN
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location;
                console.log(`[M-Team Download] Received redirect to: ${redirectUrl}`);

                // Check if redirect is to M-Team domains (api.m-team.cc or CDN halomt.com)
                try {
                    const redirectParsed = new URL(redirectUrl);
                    const allowedDomains = ['api.m-team.cc', 'api.m-team.io', 'halomt.com'];
                    const isAllowed = allowedDomains.some(domain =>
                        redirectParsed.hostname === domain || redirectParsed.hostname.endsWith('.' + domain)
                    );

                    if (isAllowed) {
                        console.log(`[M-Team Download] Following redirect to M-Team CDN: ${redirectParsed.hostname}`);
                        return downloadMTeamTorrent(redirectUrl).then(resolve).catch(reject);
                    } else {
                        console.error(`[M-Team Download] Refusing to follow external redirect to: ${redirectParsed.hostname}`);
                        return reject(new Error(`M-Team API 重定向到未知域名 ${redirectParsed.hostname}`));
                    }
                } catch (e) {
                    console.error(`[M-Team Download] Invalid redirect URL: ${redirectUrl}`);
                    return reject(new Error(`无效的重定向 URL: ${redirectUrl}`));
                }
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }

            // Handle gzip/deflate compression
            const zlib = require('zlib');
            let stream = res;
            const encoding = res.headers['content-encoding'];

            if (encoding === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                stream = res.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

            const chunks = [];
            let totalLength = 0;

            stream.on('data', (chunk) => {
                chunks.push(chunk);
                totalLength += chunk.length;
                if (totalLength % 10240 === 0) { // Log every 10KB
                    console.log(`[M-Team Download] Downloaded: ${totalLength} bytes`);
                }
            });

            stream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`[M-Team Download] Download complete, total size: ${buffer.length} bytes`);
                resolve(buffer);
            });

            res.on('error', (err) => {
                console.error(`[M-Team Download] Response error:`, err);
                reject(err);
            });
        });

        req.on('error', (err) => {
            console.error(`[M-Team Download] Request error:`, err);
            reject(err);
        });

        req.on('timeout', () => {
            console.error(`[M-Team Download] Request timeout after 60 seconds`);
            req.destroy();
            reject(new Error('Request timeout after 60 seconds'));
        });

        req.end();
    });
}

module.exports = { downloadMTeamTorrent };
