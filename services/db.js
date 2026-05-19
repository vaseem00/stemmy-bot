// ═══════════════════════════════════════════════════════════
//  Database Service — Supabase abstraction layer
// ═══════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function init() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !key.includes('your-service-role-key')) {
        supabase = createClient(url, key);
        return true;
    }
    return false;
}

function isConnected() {
    return !!supabase;
}

// ─── Token Operations ─────────────────────────────────────

async function findToken(token) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('telegram_auth_tokens')
        .select('*')
        .eq('token', token)
        .single();
    if (error) return null;
    return data;
}

async function deleteToken(token) {
    if (!supabase) return;
    await supabase.from('telegram_auth_tokens').delete().eq('token', token);
}

async function insertToken(token, userId, expiresAt) {
    if (!supabase) return false;
    const { error } = await supabase.from('telegram_auth_tokens').insert({
        token, user_id: userId, expires_at: expiresAt
    });
    return !error;
}

// ─── Profile Operations ───────────────────────────────────

async function upsertProfile(userId, chatId, username) {
    if (!supabase) return false;
    const { error } = await supabase
        .from('telegram_profiles')
        .upsert({
            user_id: userId,
            chat_id: chatId,
            telegram_username: username,
            updated_at: new Date().toISOString()
        }, { onConflict: 'chat_id' });
    return !error;
}

async function getProfileByChatId(chatId) {
    if (!supabase) return null;
    const { data } = await supabase
        .from('telegram_profiles')
        .select('*')
        .eq('chat_id', chatId)
        .single();
    return data || null;
}

async function getProfileByUserId(userId) {
    if (!supabase) return null;
    const { data } = await supabase
        .from('telegram_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    return data || null;
}

async function deleteProfile(chatId) {
    if (!supabase) return;
    await supabase.from('telegram_profiles').delete().eq('chat_id', chatId);
}

// ─── Vocabulary Operations ────────────────────────────────

async function getDueWords(userId, limit = 5) {
    if (!supabase) return [];
    const now = new Date().toISOString();
    const { data } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review', now)
        .order('next_review', { ascending: true })
        .limit(limit);
    return data || [];
}

async function getWordById(id) {
    if (!supabase) return null;
    const { data } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('id', id)
        .single();
    return data || null;
}

async function updateWordReview(id, updates) {
    if (!supabase) return false;
    const { error } = await supabase
        .from('vocabulary')
        .update(updates)
        .eq('id', id);
    return !error;
}

async function getRandomWords(userId, excludeId, limit = 3) {
    if (!supabase) return [];
    // Get random words for quiz distractors
    const { data } = await supabase
        .from('vocabulary')
        .select('term, definition')
        .eq('user_id', userId)
        .neq('id', excludeId)
        .limit(20);
    if (!data || data.length === 0) return [];
    // Shuffle and take `limit`
    const shuffled = data.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
}

async function upsertWord(wordEntry) {
    if (!supabase) return false;
    // Check if word already exists to avoid duplicates, since there's no unique constraint
    const { data: existing, error: selectError } = await supabase
        .from('vocabulary')
        .select('id')
        .eq('user_id', wordEntry.user_id)
        .eq('term', wordEntry.term)
        .maybeSingle();
        
    if (selectError) {
        console.error('upsertWord lookup error:', selectError);
        return false;
    }
        
    if (!existing) {
        const { error } = await supabase.from('vocabulary').insert(wordEntry);
        if (error) {
            console.error('upsertWord error:', error);
            return false;
        }
    }
    return true;
}

async function upsertWordsBatch(wordEntries) {
    if (!supabase) return false;
    if (!wordEntries || wordEntries.length === 0) return true;
    
    // Get existing terms for this user
    const userId = wordEntries[0].user_id;
    const { data: existing } = await supabase
        .from('vocabulary')
        .select('term')
        .eq('user_id', userId);
        
    const existingTerms = new Set((existing || []).map(e => e.term));
    
    // Deduplicate incoming batch by term to prevent inserting duplicates
    const uniqueWordEntries = [];
    const seenIncoming = new Set();
    for (const w of wordEntries) {
        if (!seenIncoming.has(w.term)) {
            seenIncoming.add(w.term);
            uniqueWordEntries.push(w);
        }
    }
    
    const newWords = uniqueWordEntries.filter(w => !existingTerms.has(w.term));
    
    if (newWords.length > 0) {
        const { error } = await supabase.from('vocabulary').insert(newWords);
        if (error) {
            console.error('upsertWordsBatch error:', error);
            return false;
        }
    }
    return true;
}

// ─── Stats Operations ─────────────────────────────────────

async function getStats(userId) {
    if (!supabase) return null;

    const [totalRes, dueRes, masteredRes, recentRes] = await Promise.all([
        supabase.from('vocabulary').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('vocabulary').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('next_review', new Date().toISOString()),
        // Mastered = FSRS state 2 (Review) with 5+ reps
        supabase.from('vocabulary').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('fsrs_state', 2).gte('fsrs_reps', 5),
        supabase.from('vocabulary').select('term, repetitions, fsrs_state, fsrs_reps, fsrs_scheduled_days, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ]);

    const uniqueRecent = [];
    const seen = new Set();
    for (const word of (recentRes.data || [])) {
        const term = word.term.toLowerCase();
        if (!seen.has(term)) {
            seen.add(term);
            uniqueRecent.push(word);
            if (uniqueRecent.length === 5) break;
        }
    }

    return {
        total: totalRes.count || 0,
        due: dueRes.count || 0,
        mastered: masteredRes.count || 0,
        recent: uniqueRecent
    };
}

// ─── Settings Operations ──────────────────────────────────

async function getSettings(chatId) {
    if (!supabase) return getDefaultSettings();
    const { data } = await supabase
        .from('telegram_profiles')
        .select('settings')
        .eq('chat_id', chatId)
        .single();
    return { ...getDefaultSettings(), ...(data?.settings || {}) };
}

async function saveSettings(chatId, settings) {
    if (!supabase) return false;
    const { error } = await supabase
        .from('telegram_profiles')
        .update({ settings })
        .eq('chat_id', chatId);
    return !error;
}

function getDefaultSettings() {
    return {
        batchSize: 5,
        cardStyle: 'all',      // 'all' | 'classic' | 'quiz'
        notifications: true,
        dailyTime: '09:00'
    };
}

// ─── All Connected Profiles (for scheduler) ──────────────

async function getAllProfiles() {
    if (!supabase) return [];
    const { data } = await supabase
        .from('telegram_profiles')
        .select('*');
    return data || [];
}

module.exports = {
    init, isConnected,
    findToken, deleteToken, insertToken,
    upsertProfile, getProfileByChatId, getProfileByUserId, deleteProfile,
    getDueWords, getWordById, updateWordReview, getRandomWords,
    upsertWord, upsertWordsBatch,
    getStats,
    getSettings, saveSettings, getDefaultSettings,
    getAllProfiles
};
