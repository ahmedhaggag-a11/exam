const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ALI_ID = '12b7edf6-694b-4ea9-9d71-89cbde315ea8';

async function checkScience() {
  const { data: questions } = await supabase
    .from('questions')
    .select('id, text, chapter, lesson, source_id')
    .eq('teacher_id', ALI_ID)
    .neq('source_id', '579b64b3-fb2d-4468-b459-cca1889d3664');

  console.log('Total Integrated Science questions for Ali:', questions?.length);

  const byLesson = {};
  questions?.forEach(q => {
    byLesson[q.lesson] = (byLesson[q.lesson] || 0) + 1;
  });

  console.log('Current lessons in Ali Science questions:');
  for (const [l, cnt] of Object.entries(byLesson)) {
    console.log(`  - "${l}": ${cnt}`);
  }
}

checkScience();
