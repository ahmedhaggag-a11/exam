const https = require('https');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';
const TEACHER_ID = '2ccbdf5d-f9c9-46f9-a472-297f594e0f16';

const UNIT1 = 'الوحدة الأولى: النظام البيئي المائي';
const UNIT2 = 'الوحدة الثانية: الغلاف الجوي';

const OFFICIAL = [
  { match: /الغلاف|كوكب|الأرض/, lesson: 'الغلاف المائي على كوكب الأرض', chapter: UNIT1 },
  { match: /كيميائ/, lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { match: /فيزيائ/, lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { match: /محاليل|محلول/, lesson: 'المحاليل المائية وخواصها', chapter: UNIT1 },
  { match: /بيولوجي|أهمية/, lesson: 'الأهمية البيولوجية للماء', chapter: UNIT1 },
  { match: /تكيف/, lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { match: /غاز|هواء/, lesson: 'تأثير غازات الهواء الجوي على البيئات المائية', chapter: UNIT1 },
  { match: /ضوء|إشعاع|شمس/, lesson: 'تأثير الضوء والإشعاع الشمسي على البيئات المائية', chapter: UNIT1 },
  { match: /ضغط/, lesson: 'تأثير الضغط المائي على الكائنات الحية', chapter: UNIT1 },
  { match: /توازن|إنسان|استدامة|تنوع/, lesson: 'التوازن البيئي ودور الإنسان في استدامة الحياة المائية', chapter: UNIT1 },

  { match: /مكونات|طبقات/, lesson: 'مكونات وطبقات الغلاف الجوي', chapter: UNIT2 },
  { match: /تفاعل/, lesson: 'التفاعلات الكيميائية في الغلاف الجوي', chapter: UNIT2 },
  { match: /عوامل|رياح/, lesson: 'العوامل الفيزيائية وتأثيرها في الغلاف الجوي', chapter: UNIT2 },
  { match: /علم|مناخ|أوزون|احتباس/, lesson: 'الغلاف الجوي ودور العلم في استدامته', chapter: UNIT2 },
];

const VALID_LESSONS = OFFICIAL.map(o => o.lesson);

async function cleanAll1579() {
  let all = [];
  for (let offset = 0; offset <= 2000; offset += 1000) {
    const batch = await new Promise(r => {
      const req = https.request({
        hostname: 'amfisynpwpftzvtatpso.supabase.co',
        path: `/rest/v1/questions?teacher_id=eq.${TEACHER_ID}&select=id,lesson,chapter&limit=1000&offset=${offset}`,
        headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
      }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
      });
      req.end();
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all = all.concat(batch);
  }
  console.log(`Total questions: ${all.length}`);

  let fixed = 0;
  for (const q of all) {
    const isCleanLesson = VALID_LESSONS.includes(q.lesson);
    const isCleanChapter = q.chapter === UNIT1 || q.chapter === UNIT2;

    if (!isCleanLesson || !isCleanChapter) {
      const t = ((q.lesson || '') + ' ' + (q.chapter || '')).replace(/[^\u0621-\u064A]/g, '');
      let matched = null;
      for (const off of OFFICIAL) {
        if (off.match.test(t)) {
          matched = off;
          break;
        }
      }
      if (!matched) matched = OFFICIAL[2];

      await new Promise(r => {
        const bodyStr = JSON.stringify({ lesson: matched.lesson, chapter: matched.chapter });
        const preq = https.request({
          hostname: 'amfisynpwpftzvtatpso.supabase.co',
          path: `/rest/v1/questions?id=eq.${q.id}`,
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(bodyStr, 'utf8')
          }
        }, pres => { pres.on('data', ()=>{}); pres.on('end', r); });
        preq.write(bodyStr, 'utf8');
        preq.end();
      });

      fixed++;
      console.log(`[${q.id}] fixed to: [${matched.chapter}] "${matched.lesson}"`);
    }
  }

  console.log(`Done! Fixed ${fixed} rows.`);
}

cleanAll1579().catch(console.error);
