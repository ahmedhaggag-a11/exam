const https = require('https');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';
const TEACHER_ID = '2ccbdf5d-f9c9-46f9-a472-297f594e0f16';

async function check() {
  let all = [];
  for (let offset = 0; offset <= 3000; offset += 1000) {
    const batch = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'amfisynpwpftzvtatpso.supabase.co',
        path: `/rest/v1/questions?teacher_id=eq.${TEACHER_ID}&select=lesson,chapter&limit=1000&offset=${offset}`,
        headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
      }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.end();
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all = all.concat(batch);
  }

  const counts = {};
  for (const q of all) {
    const k = '[' + q.chapter + '] ' + q.lesson;
    counts[k] = (counts[k] || 0) + 1;
  }

  console.log('======================================================');
  console.log(`TOTAL DISTINCT LESSONS: ${Object.keys(counts).length}`);
  console.log('======================================================');
  for (const [k, v] of Object.entries(counts).sort((a,b) => b[1] - a[1])) {
    console.log(v + '\t' + k);
  }
  console.log(`\nTotal questions in bank: ${all.length}`);
}

check().catch(console.error);
