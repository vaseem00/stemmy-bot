// ═══════════════════════════════════════════════════════════
//  Callback Query Handlers
//  Handles all inline keyboard button presses
// ═══════════════════════════════════════════════════════════

const db = require('../services/db');
const fmt = require('../services/formatter');
const cards = require('../services/cards');
const sr = require('../services/spaced-rep');
const { settingsKeyboard } = require('../commands/settings');

function register(bot) {
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const chatId = ctx.chat.id;

        try {
            // ── Reveal Definition ──
            if (data.startsWith('reveal:')) {
                await handleReveal(ctx, data);
            }
            // ── Rate Word ──
            else if (data.startsWith('rate:')) {
                await handleRate(ctx, data);
            }
            // ── Quiz Correct ──
            else if (data.startsWith('quiz_correct:')) {
                await handleQuizCorrect(ctx, data);
            }
            // ── Quiz Wrong ──
            else if (data.startsWith('quiz_wrong:')) {
                await handleQuizWrong(ctx, data);
            }
            // ── Settings ──
            else if (data.startsWith('set:')) {
                await handleSettings(ctx, data, chatId);
            }
            // ── Unknown ──
            else {
                await ctx.answerCallbackQuery({ text: 'Unknown action' });
            }
        } catch (err) {
            console.error('[callback] Error:', err.message);
            await ctx.answerCallbackQuery({ text: '❌ Something went wrong' }).catch(() => {});
        }
    });
}

// ─── Reveal Definition ────────────────────────────────────

async function handleReveal(ctx, data) {
    // Format: reveal:wordId:index:total
    const parts = data.split(':');
    const wordId = parts[1];
    const index = parseInt(parts[2]) || 1;
    const total = parseInt(parts[3]) || 1;

    if (!db.isConnected()) {
        await ctx.answerCallbackQuery({ text: 'Database not connected' });
        return;
    }

    const word = await db.getWordById(wordId);
    if (!word) {
        await ctx.answerCallbackQuery({ text: 'Word not found' });
        return;
    }

    const card = cards.revealedCard(word, index, total);
    await ctx.editMessageText(card.text, {
        parse_mode: 'HTML',
        reply_markup: card.keyboard
    });
    await ctx.answerCallbackQuery();
}

// ─── Rate Word ────────────────────────────────────────────

async function handleRate(ctx, data) {
    // Format: rate:wordId:quality:index:total
    const parts = data.split(':');
    const wordId = parts[1];
    const quality = parseInt(parts[2]);
    const index = parseInt(parts[3]) || 1;
    const total = parseInt(parts[4]) || 1;

    const sessionManager = require('../services/session');
    const { sendNextCard } = require('../commands/review');
    const chatId = ctx.chat.id;
    const session = sessionManager.getSession(chatId);

    // Double-tap / Race condition protection
    if (session && session.words[session.currentIndex]?.id === wordId) {
        if (session.isProcessing) {
            await ctx.answerCallbackQuery();
            return;
        }
        session.isProcessing = true;
    }

    if (!db.isConnected()) {
        if (session) session.isProcessing = false;
        await ctx.answerCallbackQuery({ text: 'Database not connected' });
        return;
    }

    const word = await db.getWordById(wordId);
    if (!word) {
        if (session) session.isProcessing = false;
        await ctx.answerCallbackQuery({ text: 'Word not found' });
        return;
    }

    // Compute next review using FSRS (same algorithm as extension)
    const result = sr.computeNextReview(word, quality);

    // Write ALL FSRS fields back — identical to extension's updateAfterReview()
    await db.updateWordReview(wordId, {
        next_review: result.next_review,
        repetitions: result.repetitions,
        fsrs_stability: result.fsrs_stability,
        fsrs_difficulty: result.fsrs_difficulty,
        fsrs_elapsed_days: result.fsrs_elapsed_days,
        fsrs_scheduled_days: result.fsrs_scheduled_days,
        fsrs_reps: result.fsrs_reps,
        fsrs_lapses: result.fsrs_lapses,
        fsrs_state: result.fsrs_state,
        fsrs_last_review: result.fsrs_last_review
    });

    const def = word.definition || {};
    const term = def.word || word.term;

    // Update the message with confirmation (pass next_review ISO)
    const confirmText = fmt.ratedConfirmation(term, quality, result.next_review);
    await ctx.editMessageText(confirmText, { parse_mode: 'HTML' });
    await ctx.answerCallbackQuery({ text: '✅ Progress saved!' });

    console.log(`[rate] ${term}: quality=${quality}, next=${sr.formatNextReview(result.next_review)}, state=${result.fsrs_state}, reps=${result.fsrs_reps}`);

    // Advance session and send next card
    if (session && session.words[session.currentIndex]?.id === wordId) {
        sessionManager.advanceSession(chatId);
        session.isProcessing = false; // Release lock for next card
        // Add a tiny delay so the UI transition feels smooth
        setTimeout(() => {
            sendNextCard(ctx, chatId).catch(e => console.error('Error sending next card:', e));
        }, 300);
    }
}

// ─── Quiz Correct ─────────────────────────────────────────

async function handleQuizCorrect(ctx, data) {
    // Format: quiz_correct:wordId:index:total
    const parts = data.split(':');
    const wordId = parts[1];
    const index = parseInt(parts[2]) || 1;
    const total = parseInt(parts[3]) || 1;

    if (!db.isConnected()) {
        await ctx.answerCallbackQuery({ text: 'Database not connected' });
        return;
    }

    const word = await db.getWordById(wordId);
    if (!word) {
        await ctx.answerCallbackQuery({ text: 'Word not found' });
        return;
    }

    const card = cards.quizCorrectCard(word, index, total);
    await ctx.editMessageText(card.text, {
        parse_mode: 'HTML',
        reply_markup: card.keyboard
    });
    await ctx.answerCallbackQuery({ text: '🎉 Correct!' });
}

// ─── Quiz Wrong ───────────────────────────────────────────

async function handleQuizWrong(ctx, data) {
    // Format: quiz_wrong:wordId:index:total:wrongAnswer
    const parts = data.split(':');
    const wordId = parts[1];
    const index = parseInt(parts[2]) || 1;
    const total = parseInt(parts[3]) || 1;
    const wrongAnswer = parts.slice(4).join(':'); // In case answer contains ':'

    if (!db.isConnected()) {
        await ctx.answerCallbackQuery({ text: 'Database not connected' });
        return;
    }

    const word = await db.getWordById(wordId);
    if (!word) {
        await ctx.answerCallbackQuery({ text: 'Word not found' });
        return;
    }

    const card = cards.quizWrongCard(word, wrongAnswer, index, total);
    await ctx.editMessageText(card.text, {
        parse_mode: 'HTML',
        reply_markup: card.keyboard
    });
    await ctx.answerCallbackQuery({ text: '❌ Not quite!' });
}

// ─── Settings Handlers ───────────────────────────────────

async function handleSettings(ctx, data, chatId) {
    // Format: set:category:value
    const parts = data.split(':');
    const category = parts[1];
    const value = parts[2];

    const settings = await db.getSettings(chatId);

    switch (category) {
        case 'batch':
            settings.batchSize = parseInt(value);
            break;
        case 'style':
            settings.cardStyle = value;
            break;
        case 'notif':
            settings.notifications = !settings.notifications;
            break;
        default:
            await ctx.answerCallbackQuery({ text: 'Unknown setting' });
            return;
    }

    // Save settings
    if (db.isConnected()) {
        await db.saveSettings(chatId, settings);
    }

    // Update the settings panel
    await ctx.editMessageText(fmt.settingsPanel(settings), {
        parse_mode: 'HTML',
        reply_markup: settingsKeyboard(settings)
    });

    const labels = {
        batch: `Batch size: ${settings.batchSize}`,
        style: `Card style: ${settings.cardStyle}`,
        notif: `Notifications: ${settings.notifications ? 'ON' : 'OFF'}`
    };
    await ctx.answerCallbackQuery({ text: `✅ ${labels[category]}` });
}

module.exports = { register };
