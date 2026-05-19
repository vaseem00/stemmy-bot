// ═══════════════════════════════════════════════════════════
//  Spaced Repetition — FSRS Algorithm
//  Identical to the Chrome extension's ts-fsrs implementation
//  so Telegram & extension reviews produce the same DB state
// ═══════════════════════════════════════════════════════════

const { FSRS, Rating, createEmptyCard } = require('ts-fsrs');

// Single FSRS instance (uses default optimal parameters)
const fsrs = new FSRS();

// ─── Quality → FSRS Rating map ────────────────────────────
const QUALITY_TO_RATING = {
    1: Rating.Again,
    2: Rating.Hard,
    3: Rating.Good,
    4: Rating.Easy
};

// ─── FSRS State-based mastery levels ──────────────────────
// State 0 = New, 1 = Learning, 2 = Review, 3 = Relearning
const MASTERY_LEVELS = {
    NEW:        { label: '🆕 New',       state: 0 },
    LEARNING:   { label: '📗 Learning',  state: 1 },
    REVIEWING:  { label: '📘 Reviewing', state: 2 },
    RELEARNING: { label: '🔄 Relearning', state: 3 },
    MASTERED:   { label: '🏆 Mastered',  state: -1 }  // Custom: state 2 + high reps
};

/**
 * Compute the next review using FSRS — mirrors the extension's
 * vocabularyService.updateAfterReview() exactly.
 *
 * @param {Object} word - Full vocabulary row from Supabase
 * @param {number} quality - User rating: 1=Again, 2=Hard, 3=Good, 4=Easy
 * @returns {Object} All FSRS fields to write back to the DB
 */
function computeNextReview(word, quality) {
    const rating = QUALITY_TO_RATING[quality] || Rating.Good;

    // Reconstruct the FSRS Card from DB fields, or create empty
    let card;
    if (word.fsrs_state !== undefined && word.fsrs_state !== null) {
        card = {
            due: word.next_review ? new Date(word.next_review) : new Date(),
            stability: word.fsrs_stability || 0,
            difficulty: word.fsrs_difficulty || 0,
            elapsed_days: word.fsrs_elapsed_days || 0,
            scheduled_days: word.fsrs_scheduled_days || 0,
            reps: word.fsrs_reps || 0,
            lapses: word.fsrs_lapses || 0,
            state: word.fsrs_state || 0,
            last_review: word.fsrs_last_review ? new Date(word.fsrs_last_review) : undefined
        };
    } else {
        card = createEmptyCard();
    }

    // Run FSRS scheduling — identical to extension
    const schedulingCards = fsrs.repeat(card, new Date());
    const scheduled = schedulingCards[rating].card;

    return {
        next_review: scheduled.due.toISOString(),
        repetitions: scheduled.reps,             // Keep legacy field aligned
        fsrs_stability: scheduled.stability,
        fsrs_difficulty: scheduled.difficulty,
        fsrs_elapsed_days: scheduled.elapsed_days,
        fsrs_scheduled_days: scheduled.scheduled_days,
        fsrs_reps: scheduled.reps,
        fsrs_lapses: scheduled.lapses,
        fsrs_state: scheduled.state,
        fsrs_last_review: scheduled.last_review
            ? scheduled.last_review.toISOString()
            : new Date().toISOString()
    };
}

/**
 * Get mastery level using FSRS state + reps
 */
function getMasteryLevel(word) {
    const state = word.fsrs_state ?? word.state ?? null;
    const reps = word.fsrs_reps ?? word.repetitions ?? 0;

    // Mastered: in Review state with high reps
    if (state === 2 && reps >= 5) return MASTERY_LEVELS.MASTERED;

    switch (state) {
        case 0: return MASTERY_LEVELS.NEW;
        case 1: return MASTERY_LEVELS.LEARNING;
        case 2: return MASTERY_LEVELS.REVIEWING;
        case 3: return MASTERY_LEVELS.RELEARNING;
        default:
            // Fallback for words without FSRS state (legacy)
            if (reps >= 5) return MASTERY_LEVELS.MASTERED;
            if (reps >= 3) return MASTERY_LEVELS.REVIEWING;
            if (reps >= 1) return MASTERY_LEVELS.LEARNING;
            return MASTERY_LEVELS.NEW;
    }
}

/**
 * Format scheduled_days as human-readable string
 */
function formatInterval(scheduledDays) {
    if (!scheduledDays || scheduledDays < 1) return '<1d';
    if (scheduledDays < 7) return `${Math.round(scheduledDays)}d`;
    if (scheduledDays < 30) return `${Math.round(scheduledDays / 7)}w`;
    if (scheduledDays < 365) return `${Math.round(scheduledDays / 30)}mo`;
    return `${Math.round(scheduledDays / 365)}y`;
}

/**
 * Format next_review date relative to now
 */
function formatNextReview(nextReviewIso) {
    if (!nextReviewIso) return 'now';
    const diff = new Date(nextReviewIso).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
}

module.exports = {
    QUALITY_TO_RATING,
    MASTERY_LEVELS,
    computeNextReview,
    getMasteryLevel,
    formatInterval,
    formatNextReview
};
