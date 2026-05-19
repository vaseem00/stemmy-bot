// ═══════════════════════════════════════════════════════════
//  /stats — Vocabulary Statistics Dashboard
// ═══════════════════════════════════════════════════════════

const db = require('../services/db');
const fmt = require('../services/formatter');
const { connectedProfiles } = require('./start');

function register(bot) {
    bot.command('stats', async (ctx) => {
        const chatId = ctx.chat.id;

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
                '📊 <b>Stats require database</b>\n\n' +
                'Your connection is working! ✅\n' +
                'Set up Supabase to enable full stats.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        try {
            const stats = await db.getStats(profile.user_id);
            if (!stats || stats.total === 0) {
                await ctx.reply(fmt.noWordsYet(), { parse_mode: 'HTML' });
                return;
            }
            await ctx.reply(fmt.statsDashboard(stats), { parse_mode: 'HTML' });
        } catch (err) {
            console.error('[/stats] Error:', err);
            await ctx.reply('❌ Failed to fetch stats. Please try again.');
        }
    });
}

module.exports = { register };
