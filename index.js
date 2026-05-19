// ═══════════════════════════════════════════════════════════
//  🌱 Stemmy Telegram Bot — Production Entry Point
//  grammy (long polling) + Supabase + HTTP Token API
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const http = require('http');
const { Bot, webhookCallback } = require('grammy');

// ─── Services ─────────────────────────────────────────────
const db = require('./services/db');

// ─── Commands ─────────────────────────────────────────────
const startCmd = require('./commands/start');
const reviewCmd = require('./commands/review');
const statsCmd = require('./commands/stats');
const settingsCmd = require('./commands/settings');
const helpCmd = require('./commands/help');

// ─── Handlers ─────────────────────────────────────────────
const callbackHandlers = require('./handlers/callbacks');

// ─── Config ───────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_PORT = process.env.PORT || 3847;

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required in .env');
    process.exit(1);
}

// ─── Initialize ───────────────────────────────────────────
console.log('🌱 Stemmy Bot starting...');

// Database
const dbConnected = db.init();
console.log(dbConnected ? '✅ Supabase connected' : '⚠️  Supabase not configured — using in-memory storage');

// Bot
const bot = new Bot(BOT_TOKEN);

// Set bot commands (shown in Telegram menu)
bot.api.setMyCommands([
    { command: 'review', description: '🧠 Start a review session' },
    { command: 'stats', description: '📊 View your vocabulary dashboard' },
    { command: 'settings', description: '⚙️ Customize your experience' },
    { command: 'status', description: '🔗 Check connection status' },
    { command: 'help', description: '❓ Show all commands' },
]).catch(err => console.warn('Could not set bot commands:', err.message));

// ─── Register All Handlers ────────────────────────────────
// Order matters — commands first, then callbacks, then fallback
startCmd.register(bot);
reviewCmd.register(bot);
statsCmd.register(bot);
settingsCmd.register(bot);
helpCmd.register(bot);
callbackHandlers.register(bot);

// ─── Fallback for unknown messages ────────────────────────
bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    // Ignore if it's a command (already handled above)
    if (text.startsWith('/')) return;

    await ctx.reply(
        '🤔 I didn\'t understand that.\n\n' +
        'Try one of these:\n' +
        '/review — Start a review\n' +
        '/stats — See your progress\n' +
        '/help — All commands',
        { parse_mode: 'HTML' }
    );
});

// ─── Global Error Handler ─────────────────────────────────
bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    console.error(`[BOT ERROR] Update ${ctx?.update?.update_id}:`, e.message || e);
});

// ═══════════════════════════════════════════════════════════
//  HTTP API — Extension ↔ Bot Communication
// ═══════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // ── Webhook Endpoint ──
    const webhookPath = `/webhook/${BOT_TOKEN}`;
    if (req.method === 'POST' && req.url === webhookPath) {
        return webhookCallback(bot, 'http')(req, res);
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const json = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // ── POST /register-token ──
    if (req.method === 'POST' && req.url === '/register-token') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { token, user_id, expires_at } = JSON.parse(body);
                if (!token || !user_id) return json(400, { error: 'token and user_id required' });

                startCmd.pendingTokens.set(token, {
                    user_id,
                    expires_at: expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                    created_at: new Date().toISOString()
                });

                // Also insert into Supabase if available
                if (db.isConnected()) {
                    db.insertToken(token, user_id, expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString())
                        .catch(e => console.warn('[API] Supabase insert failed:', e.message));
                }

                console.log(`[API] Token registered: ${token.slice(0, 8)}... → device ${user_id.slice(0, 8)}...`);
                json(200, { success: true });
            } catch (e) {
                json(400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    // ── GET /check-connection ──
    if (req.method === 'GET' && req.url?.startsWith('/check-connection')) {
        const url = new URL(req.url, `http://localhost:${API_PORT}`);
        const userId = url.searchParams.get('user_id');
        if (!userId) return json(400, { error: 'user_id required' });

        let connected = false;

        // Check in-memory
        for (const [, profile] of startCmd.connectedProfiles) {
            if (profile.user_id === userId) {
                connected = true;
                break;
            }
        }

        // Check Supabase
        if (!connected && db.isConnected()) {
            try {
                const profile = await db.getProfileByUserId(userId);
                if (profile) connected = true;
            } catch (e) { /* ignore */ }
        }

        json(200, { connected });
        return;
    }

    // ── POST /disconnect ──
    if (req.method === 'POST' && req.url === '/disconnect') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { user_id } = JSON.parse(body);
                if (!user_id) return json(400, { error: 'user_id required' });

                // Remove from in-memory profiles
                for (const [chatId, profile] of startCmd.connectedProfiles) {
                    if (profile.user_id === user_id) {
                        startCmd.connectedProfiles.delete(chatId);
                        // Also remove from Supabase
                        if (db.isConnected()) {
                            await db.deleteProfile(chatId).catch(() => {});
                        }
                        console.log(`[API] Disconnected: device ${user_id.slice(0, 8)}... (chatId=${chatId})`);
                        return json(200, { success: true });
                    }
                }

                // Not in memory — try Supabase directly
                if (db.isConnected()) {
                    const profile = await db.getProfileByUserId(user_id);
                    if (profile) {
                        await db.deleteProfile(profile.chat_id).catch(() => {});
                        console.log(`[API] Disconnected via Supabase: device ${user_id.slice(0, 8)}...`);
                        return json(200, { success: true });
                    }
                }

                json(200, { success: true }); // Already disconnected
            } catch (e) {
                json(400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    // ── POST /sync-word ──
    if (req.method === 'POST' && req.url === '/sync-word') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { wordEntry, user_id } = JSON.parse(body);
                if (!wordEntry) return json(400, { error: 'wordEntry required' });
                
                if (user_id && !wordEntry.user_id) {
                    wordEntry.user_id = user_id;
                }

                if (!wordEntry.user_id) return json(400, { error: 'user_id required' });

                if (db.isConnected()) {
                    const success = await db.upsertWord(wordEntry);
                    if (success) {
                        console.log(`[API] Synced word: ${wordEntry.term} for user ${wordEntry.user_id.slice(0, 8)}...`);
                        return json(200, { success: true });
                    } else {
                        return json(500, { error: 'Database upsert failed' });
                    }
                }
                json(500, { error: 'Database not connected' });
            } catch (e) {
                json(400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    // ── POST /sync-words-batch ──
    if (req.method === 'POST' && req.url === '/sync-words-batch') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { wordEntries } = JSON.parse(body);
                if (!wordEntries || !Array.isArray(wordEntries)) return json(400, { error: 'wordEntries array required' });

                if (db.isConnected()) {
                    const success = await db.upsertWordsBatch(wordEntries);
                    if (success) {
                        console.log(`[API] Batch synced ${wordEntries.length} words.`);
                        return json(200, { success: true });
                    } else {
                        return json(500, { error: 'Database batch upsert failed' });
                    }
                }
                json(500, { error: 'Database not connected' });
            } catch (e) {
                json(400, { error: 'Invalid JSON' });
            }
        });
        return;
    }

    // ── GET /health ──
    if (req.url === '/health') {
        json(200, {
            status: 'ok',
            version: '2.0.0',
            supabase: db.isConnected(),
            pending_tokens: startCmd.pendingTokens.size,
            connected_profiles: startCmd.connectedProfiles.size,
            uptime: Math.round(process.uptime())
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

// ═══════════════════════════════════════════════════════════
//  Start Everything
// ═══════════════════════════════════════════════════════════

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const isProduction = process.env.NODE_ENV === 'production' || WEBHOOK_URL;

server.listen(API_PORT, async () => {
    console.log(`📡 Token API: http://localhost:${API_PORT}`);
    
    if (isProduction && WEBHOOK_URL) {
        try {
            const webhookEndpoint = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
            await bot.api.setWebhook(webhookEndpoint, {
                allowed_updates: ['message', 'callback_query']
            });
            console.log(`🚀 Stemmy Bot is live! (Webhook mode)`);
            console.log(`🔗 Webhook URL: ${WEBHOOK_URL}/webhook/[HIDDEN]`);
        } catch (e) {
            console.error('❌ Failed to set webhook:', e.message);
        }
    } else {
        bot.start({
            onStart: () => {
                console.log('🌱 Stemmy Bot is live! (Long polling mode)');
            },
            allowed_updates: ['message', 'callback_query']
        });
    }
    console.log('─────────────────────────────────────');
});

// ─── Graceful Shutdown ────────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    bot.stop();
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    bot.stop();
    server.close();
    process.exit(0);
});
