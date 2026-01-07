class FormatUtils {
    /**
     * Parse size string to bytes
     * Supports formats like "1.5 GB", "500MB", "1024"
     * @param {string|number} sizeStr 
     * @returns {number} bytes
     */
    static parseSizeToBytes(sizeStr) {
        if (!sizeStr) return 0;
        if (typeof sizeStr === 'number') return Math.floor(sizeStr);

        // Remove commas and cleanup
        const cleanStr = String(sizeStr).replace(/,/g, '').trim();

        // Try precise match with unit
        const match = cleanStr.match(/^([\d.]+)\s*([KMGT]B?)$/i);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            // Standardize unit to uppercase first char
            const multiplierMap = {
                'K': 1024,
                'M': 1024 * 1024,
                'G': 1024 * 1024 * 1024,
                'T': 1024 * 1024 * 1024 * 1024,
                'KB': 1024,
                'MB': 1024 * 1024,
                'GB': 1024 * 1024 * 1024,
                'TB': 1024 * 1024 * 1024 * 1024
            };

            // Handle unit like "KB" or just "K"
            const multiplier = multiplierMap[unit] || 1;
            return Math.floor(value * multiplier);
        }

        // Try direct number
        const val = parseFloat(cleanStr);
        return isNaN(val) ? 0 : Math.floor(val);
    }

    static formatBytes(bytes, decimals = 2) {
        const numBytes = parseFloat(bytes);
        if (isNaN(numBytes) || numBytes <= 0) return '0 B';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(numBytes) / Math.log(k));

        return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = FormatUtils;
