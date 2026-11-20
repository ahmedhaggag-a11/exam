const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const tables = ['questions', 'sources', 'exams'];
  for (const t of tables) {
    const { data: cols } = await supabase.from(t).select('*').limit(1);
    if (!cols || !cols[0]) continue;
    const colNames = Object.keys(cols[0]);
    for (const c of colNames) {
      if (typeof cols[0][c] === 'string' || cols[0][c] === null) {
        try {
          const { data } = await supabase.from(t).select(`id, ${c}`).ilike(c, '%الاختبارات%');
          if (data && data.length > 0) {
            console.log(`Found in table "${t}", column "${c}": ${data.length} matches!`);
            console.log(data.slice(0, 3));
          }
        } catch(e) {}
      }
    }
  }
}

run();
