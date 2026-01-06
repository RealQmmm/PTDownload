/**
 * Time Utilities for Beijing Time (Asia/Shanghai)
 * Ensure consistent time handling across the application.
 */

const TIMEZONE = 'Asia/Shanghai';

/**
 * Returns YYYY-MM-DDTHH:mm:ss in Beijing Time
 * @param {Date} date
 */
const getLocalISOString = (date = new Date()) => {
    return date.toLocaleString('sv-SE', { timeZone: TIMEZONE }).replace(' ', 'T');
};

/**
 * Returns YYYY-MM-DD HH:mm:ss in Beijing Time
 * @param {Date} date
 */
const getLocalDateTimeString = (date = new Date()) => {
    return date.toLocaleString('sv-SE', { timeZone: TIMEZONE });
};

/**
 * Returns YYYY-MM-DD in Beijing Time
 * @param {Date} date
 */
const getLocalDateString = (date = new Date()) => {
    return date.toLocaleString('sv-SE', { timeZone: TIMEZONE }).split(' ')[0];
};

module.exports = {
    getLocalISOString,
    getLocalDateTimeString,
    getLocalDateString,
    TIMEZONE
};
