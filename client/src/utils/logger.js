/**
 * Logger utility for client-side timestamps
 */

function getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
}

export function setupClientLogger() {
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

    originalLog.apply(console, [getTimestamp(), '[SYSTEM] Client logger initialized']);
}
