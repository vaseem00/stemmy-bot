// Quick test: verify settings column exists
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    // Test settings column
    console.log('Testing telegram_profiles.settings...');
    const { data, error } = await supabase
        .from('telegram_profiles')
        .select('settings')
        .limit(1);
    
    if (error) {
        console.log('❌ Settings column missing:', error.message);
        console.log('\n👉 Run this SQL in Supabase SQL Editor:');
        console.log('ALTER TABLE telegram_profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT \'{}\'::jsonb;');
    } else {
        console.log('✅ Settings column exists');
    }

    // Test vocabulary table
    console.log('\nTesting vocabulary table...');
    const { data: vocabData, error: vocabErr } = await supabase
        .from('vocabulary')
        .select('id')
        .limit(1);
    
    if (vocabErr) {
        console.log('❌ Vocabulary table issue:', vocabErr.message);
    } else {
        console.log('✅ Vocabulary table exists, sample rows:', vocabData.length);
    }

    // Check linked profiles
    console.log('\nChecking profiles...');
    const { data: profiles } = await supabase.from('telegram_profiles').select('*');
    console.log('Profiles:', JSON.stringify(profiles, null, 2));

    process.exit(0);
}
test();
