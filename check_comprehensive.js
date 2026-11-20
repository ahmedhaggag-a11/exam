const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const { data } = await supabase
    .from('questions')
    .select('id, teacher_id, chapter, lesson')
    .ilike('chapter', '%الاختبارات%');

  console.log('Questions with chapter الاختبارات:', data?.length);
  if (data?.length) {
    const teachers = {};
    data.forEach(q => teachers[q.teacher_id] = (teachers[q.teacher_id] || 0) + 1);
    console.log('By teacher:', teachers);
    console.log('Sample row:', data[0]);
  }

  // Also check profiles to see all teacher names and emails
  const { data: profs } = await supabase.from('profiles').select('id, full_name, role, email');
  console.log('All profiles:', profs);
}

run();
