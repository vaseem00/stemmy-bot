// ─── HTML Entity Escaping for Telegram ─────────────────
// Telegram's HTML parse mode requires these 4 characters escaped

function esc(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = { esc };
