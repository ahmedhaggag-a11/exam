const https = require('https');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

async function fetchPage(offset) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'amfisynpwpftzvtatpso.supabase.co',
      path: '/rest/v1/questions?teacher_id=eq.2ccbdf5d-f9c9-46f9-a472-297f594e0f16&select=id,chapter,lesson&offset=' + offset + '&limit=1000',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const p1 = await fetchPage(0);
  const p2 = await fetchPage(1000);
  const all = [...p1, ...p2];
  console.log('Total questions for Mustafa:', all.length);

  const chapters = {};
  const lessonsByChapter = {};

  all.forEach(q => {
    chapters[q.chapter] = (chapters[q.chapter] || 0) + 1;
    if (!lessonsByChapter[q.chapter]) lessonsByChapter[q.chapter] = {};
    lessonsByChapter[q.chapter][q.lesson] = (lessonsByChapter[q.chapter][q.lesson] || 0) + 1;
  });

  console.log('Chapters:');
  for (const [ch, cnt] of Object.entries(chapters)) {
    console.log(`  "${ch}": ${cnt}`);
  }

  console.log('\nLessons grouped by chapter:');
  for (const [ch, lessons] of Object.entries(lessonsByChapter)) {
    console.log(`\n[Chapter: "${ch}"]`);
    for (const [les, cnt] of Object.entries(lessons)) {
      console.log(`    - "${les}": ${cnt}`);
    }
  }
}

main().catch(console.error);
