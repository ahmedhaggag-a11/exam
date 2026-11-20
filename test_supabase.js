const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, teacher_id, chapter, lesson')
    .ilike('lesson', '%الخصائص%');

  console.log('Error:', error);
  console.log('Questions matching الخصائص:', questions?.length);
  if (questions?.length) {
    console.log(questions.slice(0, 5));
  }

  const { data: allTeachers } = await supabase.from('profiles').select('id, name, email');
  console.log('Teachers:', allTeachers);
}

run();
