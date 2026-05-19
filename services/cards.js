// ═══════════════════════════════════════════════════════════
//  Card Generators — 5 Creative Content Delivery Formats
//  Each function returns { text, keyboard }
// ═══════════════════════════════════════════════════════════

const { InlineKeyboard } = require('grammy');
const { esc } = require('../utils/escape');
const { getMasteryLevel } = require('./spaced-rep');

// ─── Card Type Registry ──────────────────────────────────

const CARD_TYPES = ['dna', 'story', 'fill', 'fact', 'synonym'];

/**
 * Pick a random card type based on settings
 * @param {'all'|'classic'|'quiz'} style - User's card style preference
 */
function pickCardType(style) {
    if (style === 'classic') return 'dna';
    if (style === 'quiz') {
        const quizTypes = ['fill', 'synonym'];
        return quizTypes[Math.floor(Math.random() * quizTypes.length)];
    }
    // 'all' — weighted random (classic cards appear more often)
    const weights = [
        { type: 'dna', weight: 30 },
        { type: 'story', weight: 25 },
        { type: 'fill', weight: 20 },
        { type: 'fact', weight: 15 },
        { type: 'synonym', weight: 10 }
    ];
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;
    for (const w of weights) {
        random -= w.weight;
        if (random <= 0) return w.type;
    }
    return 'dna';
}

// ═══════════════════════════════════════════════════════════
//  1. 🧬 WORD DNA CARD — Classic reveal with etymology
// ═══════════════════════════════════════════════════════════

function dnaCard(word, index, total) {
    const def = word.definition || {};
    const mastery = getMasteryLevel(word);

    let text = `🧬 <b>Word DNA</b>  ·  ${index}/${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📖 <b>${esc(def.word || word.term)}</b>\n`;

    if (def.phonetic) {
        text += `<i>${esc(def.phonetic)}</i>\n`;
    }

    text += `\n${mastery.label}\n`;

    // Show etymology if available
    if (def.etymology || def.root) {
        text += `\n🌿 `;
        if (def.root) {
            text += `Root: <b>${esc(def.root)}</b>`;
            if (def.rootLanguage) text += ` (${esc(def.rootLanguage)})`;
            if (def.rootMeaning) text += ` — "${esc(def.rootMeaning)}"`;
        } else if (def.etymology) {
            text += esc(def.etymology);
        }
        text += `\n`;
    }

    text += `\n<i>↓ Tap to reveal the definition</i>`;

    const keyboard = new InlineKeyboard()
        .text('👁 Reveal Definition', `reveal:${word.id}:${index}:${total}`);

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  2. 📰 MICRO-STORY — Short contextual story
// ═══════════════════════════════════════════════════════════

const STORY_TEMPLATES = [
    (word) => `The old professor smiled knowingly. "${esc(word)}" he whispered, scribbling the word onto the chalkboard. "Remember this one — you'll need it."`,
    (word) => `She opened her journal and wrote: "Today I learned the word <b>${esc(word)}</b>." Little did she know how often she'd use it in the weeks to come.`,
    (word) => `The crossword puzzle had one clue remaining. Seven letters. The answer was <b>${esc(word)}</b>, but its meaning escaped him completely.`,
    (word) => `"If I had to describe this sunset in one word," she said, gazing at the horizon, "it would be <b>${esc(word)}</b>."`,
    (word) => `The translator paused mid-sentence. There was no equivalent for <b>${esc(word)}</b> in the other language — it captured something uniquely specific.`,
    (word) => `In the library's oldest section, a dusty etymology dictionary fell open to one page: <b>${esc(word)}</b>. It was exactly what the writer needed.`,
    (word) => `The child pointed at the painting and asked, "What's that called?" The guide thought for a moment. "<b>${esc(word)}</b>," she replied. "It means..."`,
    (word) => `During the debate, one participant used the word <b>${esc(word)}</b> so precisely that even the opposition paused to appreciate it.`
];

function storyCard(word, index, total) {
    const def = word.definition || {};
    const term = def.word || word.term;
    const template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];

    let text = `📰 <b>Word in the Wild</b>  ·  ${index}/${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `<i>${template(term)}</i>\n\n`;
    text += `🤔 <b>What does "${esc(term)}" mean?</b>\n\n`;
    text += `<i>↓ Tap to reveal</i>`;

    const keyboard = new InlineKeyboard()
        .text('🔮 Show the Meaning', `reveal:${word.id}:${index}:${total}`);

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  3. 🧩 FILL-IN-THE-BLANK — Pick the correct word
// ═══════════════════════════════════════════════════════════

function fillCard(word, distractors, index, total) {
    const def = word.definition || {};
    const term = def.word || word.term;
    const definition = def.definition || 'No definition available';

    let text = `🧩 <b>Quick Challenge</b>  ·  ${index}/${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Which word matches this definition?\n\n`;
    text += `<blockquote>"${esc(definition)}"</blockquote>\n`;

    // Build options: correct answer + distractors
    const options = [
        { term: term, correct: true },
        ...distractors.slice(0, 2).map(d => ({
            term: d.definition?.word || d.term,
            correct: false
        }))
    ].sort(() => Math.random() - 0.5);

    // If we don't have enough distractors, fall back to DNA card
    if (options.length < 3) {
        return dnaCard(word, index, total);
    }

    const letters = ['A', 'B', 'C'];
    const keyboard = new InlineKeyboard();

    options.forEach((opt, i) => {
        text += `\n${letters[i]}) <b>${esc(opt.term)}</b>`;
        const action = opt.correct ? `quiz_correct:${word.id}:${index}:${total}` : `quiz_wrong:${word.id}:${index}:${total}:${esc(opt.term)}`;
        keyboard.text(`${letters[i]}) ${opt.term}`, action);
    });

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  4. 💡 FUN FACT DROP — Etymology-based fun fact
// ═══════════════════════════════════════════════════════════

const FACT_TEMPLATES = [
    (word, def) => {
        if (def.root && def.rootLanguage) {
            return `The word "<b>${esc(word)}</b>" comes from the ${esc(def.rootLanguage)} word "<b>${esc(def.root)}</b>"${def.rootMeaning ? ` meaning "${esc(def.rootMeaning)}"` : ''}.`;
        }
        if (def.etymology) return esc(def.etymology);
        return `The word "<b>${esc(word)}</b>" has been in use for centuries, evolving through multiple languages to its current meaning.`;
    },
    (word, def) => {
        const synCount = def.synonyms?.length || 0;
        if (synCount > 0) {
            return `"<b>${esc(word)}</b>" has ${synCount} known synonym${synCount > 1 ? 's' : ''}, including "<b>${esc(def.synonyms[0])}</b>". Yet each carries a subtly different shade of meaning.`;
        }
        return `"<b>${esc(word)}</b>" is one of those words that's hard to replace — no synonym captures quite the same nuance.`;
    }
];

function factCard(word, index, total) {
    const def = word.definition || {};
    const term = def.word || word.term;
    const template = FACT_TEMPLATES[Math.floor(Math.random() * FACT_TEMPLATES.length)];

    let text = `💡 <b>Did You Know?</b>  ·  ${index}/${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `${template(term, def)}\n\n`;
    text += `📖 <b>${esc(term)}</b>`;
    if (def.partOfSpeech) text += ` <i>(${esc(def.partOfSpeech)})</i>`;
    text += `\n`;
    text += `${esc(def.definition || 'No definition')}\n`;

    if (def.example) {
        text += `\n<i>"${esc(def.example)}"</i>\n`;
    }

    text += `\n<b>How well do you know this word?</b>`;

    const keyboard = new InlineKeyboard()
        .text('🔴 Again', `rate:${word.id}:1:${index}:${total}`)
        .text('🟠 Hard', `rate:${word.id}:2:${index}:${total}`)
        .text('🟢 Good', `rate:${word.id}:3:${index}:${total}`)
        .text('🔵 Easy', `rate:${word.id}:4:${index}:${total}`);

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  5. 🎯 SYNONYM SHOWDOWN — Match the closest synonym
// ═══════════════════════════════════════════════════════════

function synonymCard(word, distractors, index, total) {
    const def = word.definition || {};
    const term = def.word || word.term;
    const synonyms = def.synonyms || [];

    // Need at least 1 synonym to play
    if (synonyms.length === 0 || distractors.length < 2) {
        return factCard(word, index, total);
    }

    const correctSynonym = synonyms[Math.floor(Math.random() * synonyms.length)];

    let text = `🎯 <b>Synonym Match</b>  ·  ${index}/${total}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `Which word is closest in meaning to\n"<b>${esc(term)}</b>"?\n`;

    const options = [
        { term: correctSynonym, correct: true },
        ...distractors.slice(0, 2).map(d => ({
            term: d.definition?.word || d.term,
            correct: false
        }))
    ].sort(() => Math.random() - 0.5);

    const letters = ['A', 'B', 'C'];
    const keyboard = new InlineKeyboard();

    options.forEach((opt, i) => {
        text += `\n${letters[i]}) ${esc(opt.term)}`;
        const action = opt.correct
            ? `quiz_correct:${word.id}:${index}:${total}`
            : `quiz_wrong:${word.id}:${index}:${total}:${esc(opt.term)}`;
        keyboard.text(`${letters[i]}) ${opt.term}`, action);
    });

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  Revealed Card (shown after user taps Reveal)
// ═══════════════════════════════════════════════════════════

function revealedCard(word, index, total) {
    const def = word.definition || {};
    const mastery = getMasteryLevel(word);

    let text = `📖 <b>${esc(def.word || word.term)}</b>`;
    if (def.phonetic) text += `  <i>${esc(def.phonetic)}</i>`;
    text += `\n`;

    if (def.partOfSpeech) text += `<i>${esc(def.partOfSpeech)}</i>\n`;
    text += `\n`;

    text += `${esc(def.definition || 'No definition')}\n`;

    if (def.example) {
        text += `\n<i>"${esc(def.example)}"</i>\n`;
    }

    if (def.synonyms && def.synonyms.length > 0) {
        text += `\n🔗 <b>Synonyms:</b> ${def.synonyms.slice(0, 4).map(s => esc(s)).join(', ')}\n`;
    }

    if (def.root) {
        text += `\n🌿 <b>Root:</b> ${esc(def.root)}`;
        if (def.rootLanguage) text += ` (${esc(def.rootLanguage)})`;
        if (def.rootMeaning) text += ` — "${esc(def.rootMeaning)}"`;
        text += `\n`;
    }

    text += `\n${mastery.label}  ·  ${index}/${total}\n`;
    text += `\n<b>How well did you know this?</b>`;

    const keyboard = new InlineKeyboard()
        .text('🔴 Again', `rate:${word.id}:1:${index}:${total}`)
        .text('🟠 Hard', `rate:${word.id}:2:${index}:${total}`)
        .text('🟢 Good', `rate:${word.id}:3:${index}:${total}`)
        .text('🔵 Easy', `rate:${word.id}:4:${index}:${total}`);

    return { text, keyboard };
}

// ═══════════════════════════════════════════════════════════
//  Quiz Result Card
// ═══════════════════════════════════════════════════════════

function quizCorrectCard(word, index, total) {
    const def = word.definition || {};
    let text = `✅ <b>Correct!</b>\n\n`;
    text += `📖 <b>${esc(def.word || word.term)}</b>`;
    if (def.partOfSpeech) text += ` <i>(${esc(def.partOfSpeech)})</i>`;
    text += `\n${esc(def.definition || '')}\n`;

    if (def.example) text += `\n<i>"${esc(def.example)}"</i>\n`;

    text += `\n<b>How easy was that?</b>`;

    const keyboard = new InlineKeyboard()
        .text('🟢 Good', `rate:${word.id}:3:${index}:${total}`)
        .text('🔵 Easy', `rate:${word.id}:4:${index}:${total}`);

    return { text, keyboard };
}

function quizWrongCard(word, wrongAnswer, index, total) {
    const def = word.definition || {};
    let text = `❌ <b>Not quite!</b>\n`;
    text += `You picked: <s>${esc(wrongAnswer)}</s>\n\n`;
    text += `📖 The correct answer is <b>${esc(def.word || word.term)}</b>`;
    if (def.partOfSpeech) text += ` <i>(${esc(def.partOfSpeech)})</i>`;
    text += `\n${esc(def.definition || '')}\n`;

    if (def.example) text += `\n<i>"${esc(def.example)}"</i>\n`;

    text += `\n<b>Study it and rate:</b>`;

    const keyboard = new InlineKeyboard()
        .text('🔴 Again', `rate:${word.id}:1:${index}:${total}`)
        .text('🟠 Hard', `rate:${word.id}:2:${index}:${total}`);

    return { text, keyboard };
}

module.exports = {
    CARD_TYPES, pickCardType,
    dnaCard, storyCard, fillCard, factCard, synonymCard,
    revealedCard, quizCorrectCard, quizWrongCard
};
