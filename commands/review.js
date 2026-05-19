// ═══════════════════════════════════════════════════════════
//  /review — Spaced Repetition Review Session
// ═══════════════════════════════════════════════════════════

const db = require('../services/db');
const fmt = require('../services/formatter');
const cards = require('../services/cards');
const { connectedProfiles } = require('./start');
const sessionManager = require('../services/session');

async function sendNextCard(ctx, chatId) {
    const session = sessionManager.getSession(chatId);
    if (!session) return;

    if (session.currentIndex >= session.words.length) {
        // Session complete!
        const stats = await db.getStats(session.userId);
        const streakDays = 0; // TODO: Calculate actual streak if needed
        await ctx.reply(fmt.reviewComplete(session.words.length, streakDays), { parse_mode: 'HTML' });
        sessionManager.clearSession(chatId);
        return;
    }

    const word = session.words[session.currentIndex];
    const index = session.currentIndex + 1;
    const total = session.words.length;

    let card;
    try {
        const cardType = cards.pickCardType(session.settings.cardStyle);

        switch (cardType) {
            case 'story':
                card = cards.storyCard(word, index, total);
                break;
            case 'fill': {
                const distractors = await db.getRandomWords(session.userId, word.id, 3);
                if (distractors.length < 2) card = cards.dnaCard(word, index, total);
                else card = cards.fillCard(word, distractors, index, total);
                break;
            }
            case 'synonym': {
                const def = word.definition || {};
                const synonyms = def.synonyms || [];
                if (synonyms.length === 0) {
                    card = cards.dnaCard(word, index, total);
                } else {
                    const distractors = await db.getRandomWords(session.userId, word.id, 3);
                    if (distractors.length < 2) card = cards.dnaCard(word, index, total);
                    else card = cards.synonymCard(word, distractors, index, total);
                }
                break;
            }
            case 'fact':
                card = cards.factCard(word, index, total);
                break;
            default:
                card = cards.dnaCard(word, index, total);
                break;
        }
    } catch (cardErr) {
        console.error(`[/review] Card error for "${word.term}":`, cardErr.message);
        card = cards.dnaCard(word, index, total);
    }

    try {
        await ctx.reply(card.text, {
            parse_mode: 'HTML',
            reply_markup: card.keyboard
        });
    } catch (sendErr) {
        console.error(`[/review] Send error for "${word.term}":`, sendErr.message);
        await ctx.reply(`📖 ${word.term}\n\n${(word.definition || {}).definition || 'No definition'}`).catch(() => {});
    }
}

function register(bot) {
    bot.command('review', async (ctx) => {
        const chatId = ctx.chat.id;

        // Get user profile
        let profile = connectedProfiles.get(chatId);
        if (!profile && db.isConnected()) {
            profile = await db.getProfileByChatId(chatId);
            if (profile) connectedProfiles.set(chatId, profile);
        }

        if (!profile) {
            await ctx.reply(fmt.notConnected(), { parse_mode: 'HTML' });
            return;
        }

        if (!db.isConnected()) {
            await ctx.reply(
                '📚 <b>Database not connected</b>\n\n' +
                'Reviews require a Supabase connection.\n' +
                'The bot is in test mode — your connection is working! ✅',
                { parse_mode: 'HTML' }
            );
            return;
        }

        try {
            // Cancel active session if any
            if (sessionManager.getSession(chatId)) {
                sessionManager.clearSession(chatId);
            }

            const settings = await db.getSettings(chatId);
            const batchSize = settings.batchSize || 5;
            const dueWords = await db.getDueWords(profile.user_id, batchSize);

            if (dueWords.length === 0) {
                const stats = await db.getStats(profile.user_id);
                if (stats && stats.total === 0) {
                    await ctx.reply(fmt.noWordsYet(), { parse_mode: 'HTML' });
                } else {
                    await ctx.reply(fmt.noWordsDue(), { parse_mode: 'HTML' });
                }
                return;
            }

            // Start new session
            sessionManager.startSession(chatId, profile.user_id, dueWords, settings);

            // Send review header
            await ctx.reply(fmt.reviewHeader(dueWords.length, batchSize), { parse_mode: 'HTML' });

            // Send ONLY the first card
            await sendNextCard(ctx, chatId);

        } catch (err) {
            console.error('[/review] Critical error:', err);
            await ctx.reply('❌ Failed to fetch review words. Please try again.', { parse_mode: 'HTML' });
        }
    });
}

module.exports = { register, sendNextCard };
