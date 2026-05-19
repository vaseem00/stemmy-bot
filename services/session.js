// ═══════════════════════════════════════════════════════════
//  Session Manager — Tracks active review sessions
// ═══════════════════════════════════════════════════════════

const activeSessions = new Map(); // chatId -> sessionData

/**
 * sessionData structure:
 * {
 *    userId: string,
 *    words: Array,
 *    currentIndex: number,
 *    settings: Object,
 *    startTime: Date
 * }
 */

function startSession(chatId, userId, words, settings) {
    const session = {
        userId,
        words,
        currentIndex: 0,
        settings,
        startTime: new Date(),
        isProcessing: false
    };
    activeSessions.set(chatId, session);
    return session;
}

function getSession(chatId) {
    return activeSessions.get(chatId);
}

function advanceSession(chatId) {
    const session = activeSessions.get(chatId);
    if (session) {
        session.currentIndex += 1;
    }
    return session;
}

function clearSession(chatId) {
    activeSessions.delete(chatId);
}

module.exports = {
    startSession,
    getSession,
    advanceSession,
    clearSession
};
