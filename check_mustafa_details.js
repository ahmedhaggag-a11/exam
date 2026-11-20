const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  let offset = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, chapter, lesson')
      .eq('teacher_id', '2ccbdf5d-f9c9-46f9-a472-297f594e0f16')
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log('Total for Mustafa:', all.length);

  const byChapter = {};
  for (const q of all) {
    if (!byChapter[q.chapter]) byChapter[q.chapter] = {};
    byChapter[q.chapter][q.lesson] = (byChapter[q.chapter][q.lesson] || 0) + 1;
  }

  for (const [ch, lessons] of Object.entries(byChapter)) {
    console.log(`\nChapter: "${ch}" (length ${ch.length})`);
    for (const [l, cnt] of Object.entries(lessons)) {
      console.log(`   - "${l}": ${cnt}`);
    }
  }
}

run();
