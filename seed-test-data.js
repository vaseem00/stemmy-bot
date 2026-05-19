// Re-seed test data with FSRS fields
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { createEmptyCard } = require('ts-fsrs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = '2fa59361-d795-4a23-ace2-4895295ed355';

const emptyCard = createEmptyCard();

const testWords = [
    {
        user_id: USER_ID, term: 'ephemeral',
        definition: {
            word: 'ephemeral', phonetic: '/ɪˈfɛm(ə)r(ə)l/', partOfSpeech: 'adjective',
            definition: 'Lasting for a very short time; transient.',
            example: 'The ephemeral beauty of cherry blossoms makes them all the more precious.',
            synonyms: ['fleeting', 'transient', 'momentary', 'brief'],
            antonyms: ['permanent', 'enduring'],
            root: 'ephemeros', rootLanguage: 'Greek', rootMeaning: 'lasting only a day'
        },
        dna: { root: 'ephemeros', rootMeaning: 'lasting only a day', rootLanguage: 'Greek', etymology: 'From Greek ephemeros', wordFamily: ['ephemera'] },
        next_review: new Date(Date.now() - 60000).toISOString(),
        repetitions: 0, ease_factor: 2.5, interval: 0,
        fsrs_stability: emptyCard.stability, fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_reps: 0,
        fsrs_lapses: 0, fsrs_state: 0, fsrs_last_review: null
    },
    {
        user_id: USER_ID, term: 'gregarious',
        definition: {
            word: 'gregarious', phonetic: '/ɡrɪˈɡɛːrɪəs/', partOfSpeech: 'adjective',
            definition: 'Fond of company; sociable.',
            example: 'Her gregarious nature made her the life of every party.',
            synonyms: ['sociable', 'outgoing', 'extroverted', 'convivial'],
            antonyms: ['introverted', 'reclusive'],
            root: 'gregarius', rootLanguage: 'Latin', rootMeaning: 'belonging to a flock'
        },
        dna: { root: 'gregarius', rootMeaning: 'belonging to a flock', rootLanguage: 'Latin', etymology: 'From Latin gregarius', wordFamily: ['congregation', 'aggregate'] },
        next_review: new Date(Date.now() - 60000).toISOString(),
        repetitions: 0, ease_factor: 2.5, interval: 0,
        fsrs_stability: emptyCard.stability, fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_reps: 0,
        fsrs_lapses: 0, fsrs_state: 0, fsrs_last_review: null
    },
    {
        user_id: USER_ID, term: 'sanguine',
        definition: {
            word: 'sanguine', phonetic: '/ˈsæŋɡwɪn/', partOfSpeech: 'adjective',
            definition: 'Optimistic or positive, especially in a difficult situation.',
            example: 'Despite the setbacks, she remained sanguine about the project\'s future.',
            synonyms: ['optimistic', 'hopeful', 'buoyant', 'positive'],
            antonyms: ['pessimistic', 'gloomy'],
            root: 'sanguis', rootLanguage: 'Latin', rootMeaning: 'blood'
        },
        dna: { root: 'sanguis', rootMeaning: 'blood', rootLanguage: 'Latin', etymology: 'From Latin sanguineus', wordFamily: ['sanguinary', 'consanguinity'] },
        next_review: new Date(Date.now() - 60000).toISOString(),
        repetitions: 0, ease_factor: 2.5, interval: 0,
        fsrs_stability: emptyCard.stability, fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_reps: 0,
        fsrs_lapses: 0, fsrs_state: 0, fsrs_last_review: null
    },
    {
        user_id: USER_ID, term: 'tenacious',
        definition: {
            word: 'tenacious', phonetic: '/tɪˈneɪʃəs/', partOfSpeech: 'adjective',
            definition: 'Tending to keep a firm hold of something; persistent and determined.',
            example: 'The tenacious reporter refused to give up on the story.',
            synonyms: ['persistent', 'determined', 'dogged', 'resolute'],
            antonyms: ['irresolute', 'yielding'],
            root: 'tenax', rootLanguage: 'Latin', rootMeaning: 'holding fast'
        },
        dna: { root: 'tenax', rootMeaning: 'holding fast', rootLanguage: 'Latin', etymology: 'From Latin tenax', wordFamily: ['tenacity', 'tenant', 'retain'] },
        next_review: new Date(Date.now() - 60000).toISOString(),
        repetitions: 0, ease_factor: 2.5, interval: 0,
        fsrs_stability: emptyCard.stability, fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_reps: 0,
        fsrs_lapses: 0, fsrs_state: 0, fsrs_last_review: null
    },
    {
        user_id: USER_ID, term: 'serendipity',
        definition: {
            word: 'serendipity', phonetic: '/ˌsɛr.ənˈdɪp.ɪ.ti/', partOfSpeech: 'noun',
            definition: 'The occurrence of events by chance in a happy or beneficial way.',
            example: 'Finding that rare book at a garage sale was pure serendipity.',
            synonyms: ['luck', 'fortune', 'chance', 'providence'],
            antonyms: ['misfortune'],
            root: 'Serendip', rootLanguage: 'Persian', rootMeaning: 'old name for Sri Lanka'
        },
        dna: { root: 'Serendip', rootMeaning: 'old name for Sri Lanka', rootLanguage: 'Persian', etymology: 'Coined by Horace Walpole in 1754', wordFamily: ['serendipitous'] },
        next_review: new Date(Date.now() - 60000).toISOString(),
        repetitions: 0, ease_factor: 2.5, interval: 0,
        fsrs_stability: emptyCard.stability, fsrs_difficulty: emptyCard.difficulty,
        fsrs_elapsed_days: 0, fsrs_scheduled_days: 0, fsrs_reps: 0,
        fsrs_lapses: 0, fsrs_state: 0, fsrs_last_review: null
    }
];

async function seed() {
    console.log(`Seeding ${testWords.length} words with FSRS fields...`);
    await supabase.from('vocabulary').delete().eq('user_id', USER_ID);
    const { data, error } = await supabase.from('vocabulary').insert(testWords).select('id, term, fsrs_state');
    if (error) { console.error('❌', error.message); process.exit(1); }
    console.log('✅ Seeded:');
    data.forEach(w => console.log(`   ${w.term} (fsrs_state=${w.fsrs_state})`));
    process.exit(0);
}
seed();
