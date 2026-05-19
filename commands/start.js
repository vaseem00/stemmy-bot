// ═══════════════════════════════════════════════════════════
//  /start — Connection & Deep Link Handler
// ═══════════════════════════════════════════════════════════

const db = require('../services/db');
const fmt = require('../services/formatter');

// In-memory token store (works even without Supabase)
const pendingTokens = new Map();

// Clean expired tokens every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of pendingTokens) {
        if (new Date(data.expires_at).getTime() < now) {
            pendingTokens.delete(token);
        }
    }
}, 5 * 60 * 1000);

function register(bot) {
    bot.command('start', async (ctx) => {
        const token = ctx.match;
        const chatId = ctx.chat.id;
        const username = ctx.from?.username || null;
        const firstName = ctx.from?.first_name || 'there';

        console.log(`[/start] chatId=${chatId}, user=@${username}, token="${token || '(none)'}"`);

        // No token — check if already connected, or show welcome
        if (!token) {
            // Check if this user is already linked
            let existingProfile = connectedProfiles.get(chatId);
            if (!existingProfile && db.isConnected()) {
                existingProfile = await db.getProfileByChatId(chatId);
                if (existingProfile) connectedProfiles.set(chatId, existingProfile);
            }

            if (existingProfile) {
                await ctx.reply(
                    `✅ <b>You're already connected!</b>\n\n` +
                    `📱 Device: <code>${existingProfile.user_id.slice(0, 8)}...</code>\n\n` +
                    `<b>Commands:</b>\n` +
                    `/review — Start a review session\n` +
                    `/stats — See your progress\n` +
                    `/settings — Customize your experience\n` +
                    `/disconnect — Unlink your account`,
                    { parse_mode: 'HTML' }
                );
            } else {
                await ctx.reply(fmt.welcomeMessage(firstName), { parse_mode: 'HTML' });
            }
            return;
        }

        // ── Validate token ──
        let tokenData = null;

        // Check Supabase
        if (db.isConnected()) {
            try {
                tokenData = await db.findToken(token);
                if (tokenData) console.log(`[/start] Token found in Supabase`);
            } catch (e) {
                console.warn('[/start] Supabase lookup failed:', e.message);
            }
        }

        // Fallback: in-memory
        if (!tokenData && pendingTokens.has(token)) {
            tokenData = pendingTokens.get(token);
            console.log(`[/start] Token found in memory`);
        }

        if (!tokenData) {
            await ctx.reply(
                '❌ <b>Invalid or expired token</b>\n\n' +
                'Please generate a new one from the Stemmy extension:\n' +
                'Settings → Integrations → <b>Connect Telegram</b>',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // Check expiry
        if (new Date(tokenData.expires_at) < new Date()) {
            pendingTokens.delete(token);
            if (db.isConnected()) await db.deleteToken(token).catch(() => {});
            await ctx.reply(
                '⏰ <b>Token expired</b>\n\nPlease generate a new one from the Stemmy extension.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // ── Link the user ──
        if (db.isConnected()) {
            const success = await db.upsertProfile(tokenData.user_id, chatId, username);
            if (success) {
                console.log(`[/start] Profile saved to Supabase`);
                await db.deleteToken(token).catch(() => {});
            } else {
                console.error(`[/start] Failed to save profile`);
            }
        }

        // Always save to memory
        connectedProfiles.set(chatId, {
            user_id: tokenData.user_id,
            chat_id: chatId,
            telegram_username: username,
            updated_at: new Date().toISOString()
        });
        pendingTokens.delete(token);

        console.log(`[/start] ✅ Linked: chatId=${chatId} → device=${tokenData.user_id.slice(0, 8)}...`);
        await ctx.reply(fmt.connectionSuccess(), { parse_mode: 'HTML' });
    });

    // /status command
    bot.command('status', async (ctx) => {
        const chatId = ctx.chat.id;
        let profile = connectedProfiles.get(chatId);

        if (!profile && db.isConnected()) {
            profile = await db.getProfileByChatId(chatId);
            if (profile) connectedProfiles.set(chatId, profile);
        }

        if (profile) {
            await ctx.reply(
                `✅ <b>Connected</b>\n\n` +
                `📱 Device: <code>${profile.user_id.slice(0, 8)}...</code>\n` +
                `🔗 Since: ${new Date(profile.updated_at || profile.created_at || Date.now()).toLocaleDateString()}`,
                { parse_mode: 'HTML' }
            );
        } else {
            await ctx.reply(fmt.notConnected(), { parse_mode: 'HTML' });
        }
    });

    // /disconnect command
    bot.command('disconnect', async (ctx) => {
        const chatId = ctx.chat.id;
        connectedProfiles.delete(chatId);
        if (db.isConnected()) await db.deleteProfile(chatId).catch(() => {});
        await ctx.reply(
            '🔓 <b>Disconnected</b>\n\n' +
            'Your Telegram is unlinked from Stemmy.\n' +
            'Use the extension to reconnect anytime.',
            { parse_mode: 'HTML' }
        );
    });
}

// Shared in-memory store for connected profiles
const connectedProfiles = new Map();

module.exports = { register, pendingTokens, connectedProfiles };
