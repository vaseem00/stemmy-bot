// ═══════════════════════════════════════════════════════════
//  /help — Command Reference
// ═══════════════════════════════════════════════════════════

const fmt = require('../services/formatter');

function register(bot) {
    bot.command('help', async (ctx) => {
        await ctx.reply(fmt.helpMessage(), { parse_mode: 'HTML' });
    });
}

module.exports = { register };
