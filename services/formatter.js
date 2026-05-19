// ═══════════════════════════════════════════════════════════
//  Message Formatter — Beautiful Telegram HTML messages
// ═══════════════════════════════════════════════════════════

const { esc } = require('../utils/escape');
const { getMasteryLevel, formatInterval, formatNextReview } = require('./spaced-rep');

// ─── Progress Bar ─────────────────────────────────────────

function progressBar(current, total, width = 10) {
    if (total === 0) return '░'.repeat(width);
    const filled = Math.round((current / total) * width);
    return '▓'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
}

// ─── Mastery Badge ────────────────────────────────────────

function masteryBadge(word) {
    // Accepts a word object (with fsrs_state, fsrs_reps, repetitions)
    const level = getMasteryLevel(word);
    return level.label;
}

// ─── Welcome Message ──────────────────────────────────────

function welcomeMessage(firstName) {
    return `👋 <b>Hey ${esc(firstName)}!</b>\n\n` +
        `I'm <b>Stemmy Bot</b> — your vocabulary review companion. 🌱\n\n` +
        `To connect your Stemmy extension:\n` +
        `1️⃣ Open Stemmy → Settings → Integrations\n` +
        `2️⃣ Click <b>Connect Telegram</b>\n` +
        `3️⃣ It will bring you back here automatically!\n\n` +
        `Once connected, I'll send you creative reviews:\n` +
        `📰 Micro-stories using your words\n` +
        `🧩 Fill-in-the-blank challenges\n` +
        `💡 Fun etymology facts\n` +
        `🎯 Synonym showdowns\n\n` +
        `<i>Start building your vocabulary superpower!</i>`;
}

// ─── Connection Success ───────────────────────────────────

function connectionSuccess() {
    return `✅ <b>Successfully connected to Stemmy!</b>\n\n` +
        `I'll now send you spaced repetition reviews right here.\n\n` +
        `<b>Commands:</b>\n` +
        `/review — Start a review session\n` +
        `/stats — See your progress\n` +
        `/settings — Customize your experience\n` +
        `/help — Show all commands\n\n` +
        `<i>💡 Tip: Use /review to start your first session!</i>`;
}

// ─── Stats Dashboard ──────────────────────────────────────

function statsDashboard(stats) {
    const { total, due, mastered, recent } = stats;

    let msg = `<b>Vocabulary Overview</b>\n\n`;

    msg += `Total Words: <b>${total}</b>\n`;
    msg += `Due Today: <b>${due}</b>\n`;
    msg += `Mastered: <b>${mastered}</b>\n\n`;

    if (recent && recent.length > 0) {
        msg += `<b>Recent Additions:</b>\n`;
        for (const word of recent) {
            msg += `• <i>${esc(word.term)}</i>\n`;
        }
        msg += `\n`;
    }

    if (due > 0) {
        msg += `<i>Use /review to study your ${due} due word${due > 1 ? 's' : ''}.</i>`;
    } else {
        msg += `<i>All caught up. Keep browsing to collect new words.</i>`;
    }

    return msg;
}

// ─── Review Session Header ────────────────────────────────

function reviewHeader(total, batchSize) {
    const showing = Math.min(total, batchSize);
    return `🧠 <b>Review Time!</b>\n\n` +
        `${showing} word${showing > 1 ? 's' : ''} ready for review\n` +
        `${progressBar(0, showing, 12)}\n\n` +
        `<i>Tap each card to reveal and rate</i>`;
}

function reviewProgress(current, total) {
    return `📝 <b>Card ${current}/${total}</b>  ${progressBar(current, total, 10)}`;
}

function reviewComplete(reviewed, streakDays) {
    let msg = `🎉 <b>Review Complete!</b>\n\n`;
    msg += `✅ Reviewed: <b>${reviewed}</b> word${reviewed > 1 ? 's' : ''}\n`;
    if (streakDays > 0) {
        msg += `🔥 Streak: <b>${streakDays} day${streakDays > 1 ? 's' : ''}</b>\n`;
    }
    msg += `\n<i>Great work! Your brain thanks you. 🧠</i>`;
    return msg;
}

// ─── Settings Panel ───────────────────────────────────────

function settingsPanel(settings) {
    return `⚙️ <b>Settings</b>\n\n` +
        `📦 <b>Batch Size:</b> ${settings.batchSize} words/session\n` +
        `🎨 <b>Card Style:</b> ${cardStyleLabel(settings.cardStyle)}\n` +
        `🔔 <b>Notifications:</b> ${settings.notifications ? 'On' : 'Off'}\n\n` +
        `<i>Tap the buttons below to adjust</i>`;
}

function cardStyleLabel(style) {
    const labels = {
        all: '🎲 All Formats',
        classic: '📖 Classic Only',
        quiz: '🧩 Quiz Only'
    };
    return labels[style] || labels.all;
}

// ─── Help Message ─────────────────────────────────────────

function helpMessage() {
    return `🌱 <b>Stemmy Bot — Commands</b>\n\n` +
        `<b>Core</b>\n` +
        `/review — Start a flashcard review session\n` +
        `/stats — View your vocabulary dashboard\n` +
        `/settings — Customize your experience\n\n` +
        `<b>Account</b>\n` +
        `/start — Connect your Stemmy extension\n` +
        `/status — Check connection status\n` +
        `/disconnect — Unlink your account\n\n` +
        `<b>How It Works</b>\n` +
        `I deliver your saved vocabulary through creative formats:\n` +
        `🧬 Word DNA cards with etymology\n` +
        `📰 Micro-stories using your words\n` +
        `🧩 Fill-in-the-blank challenges\n` +
        `💡 Fun fact drops\n` +
        `🎯 Synonym showdowns\n\n` +
        `Each review uses <b>spaced repetition</b> — words you find ` +
        `harder appear more often, while easy words space out naturally.\n\n` +
        `<i>🔗 Install the Stemmy Chrome extension to collect vocabulary while browsing!</i>`;
}

// ─── Rated Confirmation ───────────────────────────────────

function ratedConfirmation(term, quality, nextReviewIso) {
    const labels = { 1: '🔴 Again', 2: '🟠 Hard', 3: '🟢 Good', 4: '🔵 Easy' };
    return `✅ <b>${esc(term)}</b> — ${labels[quality]}\n` +
        `<i>Next review in ${formatNextReview(nextReviewIso)}</i>`;
}

// ─── Not Connected ────────────────────────────────────────

function notConnected() {
    return `🔗 <b>Not connected yet!</b>\n\n` +
        `Open the Stemmy Chrome extension:\n` +
        `Settings → Integrations → <b>Connect Telegram</b>\n\n` +
        `<i>This links your vocabulary wallet to this bot.</i>`;
}

// ─── No Words Due ─────────────────────────────────────────

function noWordsDue() {
    return `✨ <b>All caught up!</b>\n\n` +
        `No words are due for review right now.\n\n` +
        `Keep browsing and collecting new vocabulary with the Stemmy extension! 🌐`;
}

// ─── No Words At All ──────────────────────────────────────

function noWordsYet() {
    return `📭 <b>Your vocabulary wallet is empty!</b>\n\n` +
        `Start collecting words:\n` +
        `1️⃣ Browse any webpage\n` +
        `2️⃣ Click on a word you want to learn\n` +
        `3️⃣ Stemmy saves it with definition & context\n\n` +
        `<i>Once you've collected words, come back for reviews!</i>`;
}

module.exports = {
    progressBar, masteryBadge,
    welcomeMessage, connectionSuccess,
    statsDashboard, reviewHeader, reviewProgress, reviewComplete,
    settingsPanel, helpMessage,
    ratedConfirmation, notConnected, noWordsDue, noWordsYet
};
