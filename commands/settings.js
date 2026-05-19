// ═══════════════════════════════════════════════════════════
//  /settings — User Preferences
// ═══════════════════════════════════════════════════════════

const { InlineKeyboard } = require('grammy');
const db = require('../services/db');
const fmt = require('../services/formatter');

function register(bot) {
    bot.command('settings', async (ctx) => {
        const chatId = ctx.chat.id;
        const settings = await db.getSettings(chatId);

        await ctx.reply(fmt.settingsPanel(settings), {
            parse_mode: 'HTML',
            reply_markup: settingsKeyboard(settings)
        });
    });
}

function settingsKeyboard(settings) {
    const kb = new InlineKeyboard();

    // Batch size row
    kb.text(settings.batchSize === 3 ? '• 3' : '3', 'set:batch:3')
      .text(settings.batchSize === 5 ? '• 5' : '5', 'set:batch:5')
      .text(settings.batchSize === 10 ? '• 10' : '10', 'set:batch:10')
      .row();

    // Card style row
    kb.text(settings.cardStyle === 'all' ? '• 🎲 All' : '🎲 All', 'set:style:all')
      .text(settings.cardStyle === 'classic' ? '• 📖 Classic' : '📖 Classic', 'set:style:classic')
      .text(settings.cardStyle === 'quiz' ? '• 🧩 Quiz' : '🧩 Quiz', 'set:style:quiz')
      .row();

    // Notifications toggle
    kb.text(settings.notifications ? '🔔 Notifications: ON' : '🔕 Notifications: OFF', 'set:notif:toggle');

    return kb;
}

module.exports = { register, settingsKeyboard };
