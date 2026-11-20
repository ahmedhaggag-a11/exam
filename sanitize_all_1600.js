const https = require('https');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';
const TEACHER_ID = '2ccbdf5d-f9c9-46f9-a472-297f594e0f16';

const UNIT1 = 'الوحدة الأولى: النظام البيئي المائي';
const UNIT2 = 'الوحدة الثانية: الغلاف الجوي';

const OFFICIAL = [
  { match: /الغلاف.*المائي|كوكب.*الأرض|الغلاف/i, lesson: 'الغلاف المائي على كوكب الأرض', chapter: UNIT1 },
  { match: /كيميائ/i, lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { match: /فيزيائ/i, lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { match: /محاليل|محلول/i, lesson: 'المحاليل المائية وخواصها', chapter: UNIT1 },
  { match: /أهمية|بيولوج/i, lesson: 'الأهمية البيولوجية للماء', chapter: UNIT1 },
  { match: /تكيف/i, lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { match: /غاز|هواء/i, lesson: 'تأثير غازات الهواء الجوي على البيئات المائية', chapter: UNIT1 },
  { match: /ضوء|إشعاع|شمس/i, lesson: 'تأثير الضوء والإشعاع الشمسي على البيئات المائية', chapter: UNIT1 },
  { match: /ضغط/i, lesson: 'تأثير الضغط المائي على الكائنات الحية', chapter: UNIT1 },
  { match: /توازن|إنسان|استدامة/i, lesson: 'التوازن البيئي ودور الإنسان في استدامة الحياة المائية', chapter: UNIT1 },

  { match: /مكونات|طبقات/i, lesson: 'مكونات وطبقات الغلاف الجوي', chapter: UNIT2 },
  { match: /تفاعل/i, lesson: 'التفاعلات الكيميائية في الغلاف الجوي', chapter: UNIT2 },
  { match: /عوامل|رياح/i, lesson: 'العوامل الفيزيائية وتأثيرها في الغلاف الجوي', chapter: UNIT2 },
  { match: /علم|مناخ|استدامة.*غلاف/i, lesson: 'الغلاف الجوي ودور العلم في استدامته', chapter: UNIT2 }
];

const VALID_LESSONS = OFFICIAL.map(o => o.lesson);

async function main() {
  let all = [];
  for (let offset = 0; offset <= 3000; offset += 1000) {
    const batch = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'amfisynpwpftzvtatpso.supabase.co',
        path: `/rest/v1/questions?teacher_id=eq.${TEACHER_ID}&select=id,lesson,chapter&limit=1000&offset=${offset}`,
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

  console.log(`Loaded ${all.length} total questions.`);

  let fixCount = 0;
  for (const q of all) {
    const isCleanLesson = VALID_LESSONS.includes(q.lesson);
    const isCleanChapter = q.chapter === UNIT1 || q.chapter === UNIT2;

    if (!isCleanLesson || !isCleanChapter) {
      // Clean non-Arabic letters
      const cleanText = ((q.lesson || '') + ' ' + (q.chapter || '')).replace(/[^\u0621-\u064A]/g, '');

      let matched = null;
      for (const off of OFFICIAL) {
        if (off.match.test(cleanText)) {
          matched = off;
          break;
        }
      }
      if (!matched) matched = OFFICIAL[0];

      await new Promise(resolve => {
        const bodyStr = JSON.stringify({ lesson: matched.lesson, chapter: matched.chapter });
        const preq = https.request({
          hostname: 'amfisynpwpftzvtatpso.supabase.co',
          path: `/rest/v1/questions?id=eq.${q.id}`,
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json; charset=utf-8',
            'Prefer': 'return=minimal',
            'Content-Length': Buffer.byteLength(bodyStr, 'utf8')
          }
        }, pres => {
          pres.on('data', () => {});
          pres.on('end', resolve);
        });
        preq.write(bodyStr, 'utf8');
        preq.end();
      });

      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} questions.`);
}

main().catch(console.error);
