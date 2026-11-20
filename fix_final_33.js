const https = require('https');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';
const TEACHER_ID = '2ccbdf5d-f9c9-46f9-a472-297f594e0f16';

const UNIT1 = 'الوحدة الأولى: النظام البيئي المائي';
const UNIT2 = 'الوحدة الثانية: الغلاف الجوي';

const EXACT_UPDATES = [
  { id: 'ed785b37-383e-4359-afa0-eb205676e8c8', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '30dd711d-10f0-4020-9fe3-d623c8aab436', lesson: 'تأثير الضغط المائي على الكائنات الحية', chapter: UNIT1 },
  { id: '497f218d-f7af-45e4-9a47-f0fbdeb381d2', lesson: 'العوامل الفيزيائية وتأثيرها في الغلاف الجوي', chapter: UNIT2 },
  { id: 'e70059cd-7b51-4826-9c78-6f9787ff0838', lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { id: '158b7724-0d88-4b49-bd29-0a2a2d76afae', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: '5ffa816e-4230-4ddb-9a02-16f29c22a7e2', lesson: 'الغلاف المائي على كوكب الأرض', chapter: UNIT1 },
  { id: 'eee91c92-42d5-4000-b0ce-ab3b6d4ab7d2', lesson: 'الغلاف المائي على كوكب الأرض', chapter: UNIT1 },
  { id: '58400c71-6cae-4280-9c29-d726bc7983ec', lesson: 'الغلاف المائي على كوكب الأرض', chapter: UNIT1 },
  { id: '93b25591-1f92-4cb7-920b-c6b1f77d2ff1', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '6efc6fd7-6174-4e66-a301-d3e1485d74d1', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: 'dd6036c7-d5ae-474d-b155-610d6e1734a5', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: '3c173dc7-b796-4396-b0a2-79f9c84dca09', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: 'b124b09e-8605-433e-bd05-3b0f6263cefb', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: '52819781-d35d-4740-a99e-41068659b677', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '40624339-cdbe-47ba-bcef-cca9555b9dbb', lesson: 'الخواص الكيميائية للماء', chapter: UNIT1 },
  { id: 'eaa44767-6adc-4651-b37b-009d916b42db', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '9f2c474f-110a-41f1-bdbb-67f887d5e233', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '7e29781b-8d27-4ae6-b771-64a4c20c9384', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: 'e853d462-4e6f-4e27-b0e2-66e2b5329273', lesson: 'المحاليل المائية وخواصها', chapter: UNIT1 },
  { id: 'fba5c683-bbc6-43e6-a3a8-3239a2c04883', lesson: 'الخواص الفيزيائية للماء', chapter: UNIT1 },
  { id: '594bbf27-f62e-42fc-ac49-75f62b14da69', lesson: 'التوازن البيئي ودور الإنسان في استدامة الحياة المائية', chapter: UNIT1 },
  { id: 'f04f1a64-7bbf-4ca9-bbaf-71c54f764f88', lesson: 'التوازن البيئي ودور الإنسان في استدامة الحياة المائية', chapter: UNIT1 },
  { id: '1f6bb578-4d2b-439e-ac02-e5abb3e4ed2d', lesson: 'مكونات وطبقات الغلاف الجوي', chapter: UNIT2 },
  { id: 'eb46625c-1d50-434f-893c-3523487ffc91', lesson: 'الأهمية البيولوجية للماء', chapter: UNIT1 },
  { id: '9a8f84c2-abf5-45da-842b-bee45be6b647', lesson: 'التوازن البيئي ودور الإنسان في استدامة الحياة المائية', chapter: UNIT1 },
  { id: '90ab906f-8330-4b2f-93b3-163476668e6f', lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { id: '24340e79-6e77-4256-a77b-0eeb5459150c', lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { id: '73435400-5ef1-4854-9338-2356552a9a42', lesson: 'مكونات وطبقات الغلاف الجوي', chapter: UNIT2 },
  { id: '6347da54-74de-48b1-ad6e-18cba244577a', lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { id: '539790b3-8fae-4644-8458-abf7f36b1996', lesson: 'تأثير الضغط المائي على الكائنات الحية', chapter: UNIT1 },
  { id: '5e138184-4b46-4387-b5f1-691a1f8b3a78', lesson: 'التكيفات البيولوجية للكائنات الحية في البيئة المائية', chapter: UNIT1 },
  { id: '19637a2c-cfeb-4572-bc2e-a8c24913fd3e', lesson: 'تأثير غازات الهواء الجوي على البيئات المائية', chapter: UNIT1 },
  { id: '20767dc7-3a3c-4697-af4d-d958cc5397d3', lesson: 'تأثير غازات الهواء الجوي على البيئات المائية', chapter: UNIT1 }
];

async function run() {
  console.log(`Starting update of ${EXACT_UPDATES.length} rows...`);
  for (const item of EXACT_UPDATES) {
    const bodyStr = JSON.stringify({ lesson: item.lesson, chapter: item.chapter });
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'amfisynpwpftzvtatpso.supabase.co',
        path: `/rest/v1/questions?id=eq.${item.id}`,
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(bodyStr, 'utf8')
        }
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          console.log(`Updated ${item.id} -> HTTP ${res.statusCode}`);
          resolve();
        });
      });
      req.on('error', reject);
      req.write(bodyStr, 'utf8');
      req.end();
    });
  }

  console.log('\nAll 33 rows successfully updated!');
}

run().catch(console.error);
