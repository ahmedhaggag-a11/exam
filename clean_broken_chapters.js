const https = require('https');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';
const TEACHER_ID = '2ccbdf5d-f9c9-46f9-a472-297f594e0f16';

const UNIT1 = 'الوحدة الأولى: النظام البيئي المائي';
const UNIT2 = 'الوحدة الثانية: الغلاف الجوي';

const OFFICIAL_MAP = {
  // Unit 1
  'الغلاف المائي على كوكب الأرض': UNIT1,
  'الخواص الكيميائية للماء': UNIT1,
  'الخواص الفيزيائية للماء': UNIT1,
  'المحاليل المائية وخواصها': UNIT1,
  'الأهمية البيولوجية للماء': UNIT1,
  'التكيفات البيولوجية للكائنات الحية في البيئة المائية': UNIT1,
  'تأثير غازات الهواء الجوي على البيئات المائية': UNIT1,
  'تأثير الضوء والإشعاع الشمسي على البيئات المائية': UNIT1,
  'تأثير الضغط المائي على الكائنات الحية': UNIT1,
  'التوازن البيئي ودور الإنسان في استدامة الحياة المائية': UNIT1,

  // Unit 2
  'مكونات وطبقات الغلاف الجوي': UNIT2,
  'التفاعلات الكيميائية في الغلاف الجوي': UNIT2,
  'العوامل الفيزيائية وتأثيرها في الغلاف الجوي': UNIT2,
  'الغلاف الجوي ودور العلم في استدامته': UNIT2,
};

function fetchBatch(offset, limit) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'amfisynpwpftzvtatpso.supabase.co',
      path: `/rest/v1/questions?teacher_id=eq.${TEACHER_ID}&select=id,lesson,chapter&limit=${limit}&offset=${offset}`,
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function updateRow(id, lesson, chapter) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify({ lesson, chapter });
    const req = https.request({
      hostname: 'amfisynpwpftzvtatpso.supabase.co',
      path: `/rest/v1/questions?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8')
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(bodyStr, 'utf8');
    req.end();
  });
}

async function run() {
  const batch0 = await fetchBatch(0, 1000);
  const batch1 = await fetchBatch(1000, 1000);
  const all = batch0.concat(batch1);
  console.log(`Total questions fetched across all pages: ${all.length}`);

  let fixed = 0;
  for (const q of all) {
    let exactLesson = q.lesson;
    let exactChapter = OFFICIAL_MAP[exactLesson];

    if (!exactChapter) {
      // Find matching official lesson by keyword
      const clean = (q.lesson || '').replace(/[^\u0621-\u064A]/g, '');
      for (const off of Object.keys(OFFICIAL_MAP)) {
        const offClean = off.replace(/[^\u0621-\u064A]/g, '');
        if (clean.includes(offClean.slice(0, 6)) || offClean.includes(clean.slice(0, 6))) {
          exactLesson = off;
          exactChapter = OFFICIAL_MAP[off];
          break;
        }
      }
      if (!exactLesson || !exactChapter) {
        if ((q.lesson || '').includes('كيميائ')) { exactLesson = 'الخواص الكيميائية للماء'; exactChapter = UNIT1; }
        else if ((q.lesson || '').includes('فيزيائ')) { exactLesson = 'الخواص الفيزيائية للماء'; exactChapter = UNIT1; }
        else if ((q.lesson || '').includes('ضوء')) { exactLesson = 'تأثير الضوء والإشعاع الشمسي على البيئات المائية'; exactChapter = UNIT1; }
        else if ((q.lesson || '').includes('ضغط')) { exactLesson = 'تأثير الضغط المائي على الكائنات الحية'; exactChapter = UNIT1; }
        else if ((q.lesson || '').includes('محاليل')) { exactLesson = 'المحاليل المائية وخواصها'; exactChapter = UNIT1; }
        else if ((q.lesson || '').includes('أهمية') || (q.lesson || '').includes('بيولوج')) { exactLesson = 'الأهمية البيولوجية للماء'; exactChapter = UNIT1; }
        else { exactLesson = 'الغلاف المائي على كوكب الأرض'; exactChapter = UNIT1; }
      }
    }

    if (q.lesson !== exactLesson || q.chapter !== exactChapter) {
      await updateRow(q.id, exactLesson, exactChapter);
      fixed++;
      console.log(`[${q.id}] fixed to: [${exactChapter}] "${exactLesson}"`);
    }
  }

  console.log(`\nFinished! Fixed ${fixed} rows.`);

  // Verify final distribution
  const v0 = await fetchBatch(0, 1000);
  const v1 = await fetchBatch(1000, 1000);
  const vAll = v0.concat(v1);

  const counts = {};
  for (const q of vAll) {
    const k = '[' + q.chapter + '] ' + q.lesson;
    counts[k] = (counts[k] || 0) + 1;
  }

  console.log('\n=============================================');
  console.log(`FINAL CLEAN LESSON COUNT: ${Object.keys(counts).length}`);
  console.log('=============================================');
  for (const [k, v] of Object.entries(counts).sort((a,b)=>b[1]-a[1])) {
    console.log(v + '\t' + k);
  }
}

run().catch(console.error);
