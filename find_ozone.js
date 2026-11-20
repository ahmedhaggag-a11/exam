const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  let offset = 0;
  let all = [];
  while (true) {
    const { data } = await supabase.from('questions').select('id, text, chapter, lesson').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  
  const found = all.filter(q => q.text && (q.text.includes('الأوزون') || q.text.includes('الاوزون')));
  console.log('Found matching questions for ozone:', found.length);
  for (const q of found) {
    console.log(`- ID: ${q.id}`);
    console.log(`  Chapter: "${q.chapter}"`);
    console.log(`  Lesson: "${q.lesson}"`);
    console.log(`  Text: ${q.text.substring(0, 100)}`);
  }
}

run();
