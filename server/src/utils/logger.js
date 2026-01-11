const timeUtils = require('./timeUtils');

/**
 * Get formatted timestamp
 * @returns {string} - Formatted timestamp like [2026-01-11 19:39:42]
 */
function getTimestamp() {
    return `[${timeUtils.getLocalDateTimeString()}]`;
}

/**
 * Global console override to add timestamps
 */
function setupGlobalLogger() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args) => {
        originalLog.apply(console, [getTimestamp(), ...args]);
    };

    console.info = (...args) => {
        originalInfo.apply(console, [getTimestamp(), '[INFO]', ...args]);
    };

    console.warn = (...args) => {
        originalWarn.apply(console, [getTimestamp(), '[WARN]', ...args]);
    };

    console.error = (...args) => {
        originalError.apply(console, [getTimestamp(), '[ERROR]', ...args]);
    };

    originalLog.apply(console, [getTimestamp(), '[SYSTEM] Global logger initialized with timestamps']);
}

module.exports = {
    setupGlobalLogger,
    getTimestamp
};
