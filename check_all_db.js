const https = require('https');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

async function fetchAll(table, select, filter = '') {
  let all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const chunk = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'amfisynpwpftzvtatpso.supabase.co',
        path: `/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}&offset=${offset}&limit=${limit}`,
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY
        }
      }, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    if (!chunk || chunk.length === 0) break;
    all = all.concat(chunk);
    if (chunk.length < limit) break;
    offset += limit;
  }
  return all;
}

async function main() {
  const teachers = await fetchAll('profiles', 'id,name,role,email');
  console.log('Teachers/Profiles count:', teachers.length);
  teachers.forEach(t => console.log(t.id, t.name, t.email, t.role));

  const questions = await fetchAll('questions', 'id,teacher_id,chapter,lesson');
  console.log('Total questions in DB:', questions.length);

  const distinctLessons = new Set(questions.map(q => q.lesson));
  console.log('Distinct lessons count across DB:', distinctLessons.size);
  
  const searchTerms = ['الخصائص', 'العوامل', 'طبقات'];
  for (const q of questions) {
    for (const term of searchTerms) {
      if ((q.lesson && q.lesson.includes(term)) || (q.chapter && q.chapter.includes(term))) {
        console.log(`Matched term [${term}]: teacher=${q.teacher_id}, chapter="${q.chapter}", lesson="${q.lesson}"`);
        break;
      }
    }
  }

  const distinctChapters = new Set(questions.map(q => q.chapter));
  console.log('\nDistinct chapters count across DB:', distinctChapters.size);
  for (const ch of distinctChapters) {
    console.log('Chapter:', ch);
  }
}

main().catch(console.error);
