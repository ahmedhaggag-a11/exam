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
      .select('id, teacher_id, chapter, lesson')
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log('Total questions in DB:', all.length);

  const byTeacher = {};
  for (const q of all) {
    if (!byTeacher[q.teacher_id]) byTeacher[q.teacher_id] = new Set();
    byTeacher[q.teacher_id].add(q.lesson);
  }

  for (const [tId, lessons] of Object.entries(byTeacher)) {
    console.log(`\nTeacher ${tId} has ${lessons.size} distinct lessons:`);
    for (const l of lessons) {
      console.log('   -', l);
    }
  }
}

run();
