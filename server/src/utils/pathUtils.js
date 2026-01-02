
const path = require('path');

const pathUtils = {
    /**
     * Sanitize a string to be safe for use as a filename/directory name
     * Replaces illegal characters with dots or underscores
     */
    sanitizeFilename: (name) => {
        if (!name) return '';
        // Replace / \ : * ? " < > | with .
        // Also usually wise to replace multiple spaces with dots for scene standard or single space
        let clean = name.replace(/[\\/:*?"<>|]/g, '.');
        // Replace multiple dots with single dot
        clean = clean.replace(/\.+/g, '.');
        // Replace multiple spaces with single dot (Scene Naming Convention preference)
        clean = clean.replace(/\s+/g, '.');
        // Trim dots from start/end
        clean = clean.replace(/^\.+|\.+$/g, '');
        return clean;
    },

    /**
     * Join paths safely
     */
    join: (...args) => {
        return path.join(...args);
    }
};

module.exports = pathUtils;
