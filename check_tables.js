const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const tables = ['curriculum', 'curriculums', 'curriculum_lessons', 'lessons', 'chapters', 'topics', 'exam_templates', 'exams'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    if (!error) {
      console.log(`Table ${t} exists! rows:`, data?.length);
      if (data?.length) console.log(JSON.stringify(data[0], null, 2));
    }
  }
}

run();
