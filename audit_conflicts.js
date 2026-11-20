const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// الدروس الرسمية الـ14
const OFFICIAL_LESSONS = [
  'الغلاف المائي على كوكب الأرض',
  'الخواص الكيميائية للماء',
  'الخواص الفيزيائية للماء',
  'المحاليل المائية وخواصها',
  'الأهمية البيولوجية للماء',
  'التكيفات البيولوجية للكائنات الحية في البيئة المائية',
  'تأثير غازات الهواء الجوي على البيئات المائية',
  'تأثير الضوء والإشعاع الشمسي على البيئات المائية',
  'تأثير الضغط المائي على الكائنات الحية',
  'التوازن البيئي ودور الإنسان في استدامة الحياة المائية',
  'مكونات وطبقات الغلاف الجوي',
  'التفاعلات الكيميائية في الغلاف الجوي',
  'العوامل الفيزيائية وتأثيرها في الغلاف الجوي',
  'الغلاف الجوي ودور العلم في استدامته',
];

// قواعد تصنيف عريضة لكشف التضارب
const LESSON_KEYWORDS = {
  'الخواص الفيزيائية للماء': ['كثافة', 'شذوذ الماء', 'غليان', 'تجمد', 'حرارة نوعية', 'توتر سطحي', 'خاصية الشعرية'],
  'الخواص الكيميائية للماء': ['رابطة هيدروجينية', 'تحليل كهربي', 'قطبية', 'تركيب كيميائي', 'H2O', 'ذرة'],
  'المحاليل المائية وخواصها': ['مذاب', 'مذيب', 'محلول', 'غرواني', 'معلق', 'تركيز', 'توصيل كهربي'],
  'الأهمية البيولوجية للماء': ['بناء ضوئي', 'دم', 'تنفس خلوي', 'بروتوبلازم', 'هضم', 'نقل غذاء'],
  'التكيفات البيولوجية للكائنات الحية في البيئة المائية': ['خياشيم', 'زعانف', 'كيس عوم', 'تكيف'],
  'تأثير الضغط المائي على الكائنات الحية': ['ضغط هيدروستاتيكي', 'P = ρgh', 'أعماق', 'ضغط مائي'],
  'تأثير غازات الهواء الجوي على البيئات المائية': ['أكسجين ذائب', 'CO2', 'تحمض', 'غاز ذائب'],
  'تأثير الضوء والإشعاع الشمسي على البيئات المائية': ['نفاذية ضوء', 'منطقة مضاءة', 'منطقة مظلمة', 'بناء ضوئي في الأعماق'],
  'التوازن البيئي ودور الإنسان في استدامة الحياة المائية': ['تلوث', 'صيد جائر', 'استدامة', 'إثراء غذائي'],
  'مكونات وطبقات الغلاف الجوي': ['تروبوسفير', 'ستراتوسفير', 'ميزوسفير', 'ثيرموسفير', 'طبقات الغلاف', 'نسب الغازات'],
  'التفاعلات الكيميائية في الغلاف الجوي': ['أوزون', 'ضباب دخاني', 'أمطار حمضية', 'NO2', 'تفاعل كيميائي غلاف'],
  'العوامل الفيزيائية وتأثيرها في الغلاف الجوي': ['ضغط جوي', 'رياح', 'رطوبة', 'سحب', 'أمطار', 'مناخ'],
  'الغلاف الجوي ودور العلم في استدامته': ['احتباس حراري', 'تغير مناخي', 'ثقب الأوزون', 'رصد المناخ', 'الغلاف الجوي ودور'],
};

// ---- CROSS CHECK: هل نص السؤال يحتوي على كلمات درس آخر؟ ----
function detectConflict(q) {
  const text = (q.text || '').toLowerCase();
  const lesson = q.lesson;
  const conflicts = [];

  for (const [otherLesson, keywords] of Object.entries(LESSON_KEYWORDS)) {
    if (otherLesson === lesson) continue;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        conflicts.push({ keyword: kw, suggestedLesson: otherLesson });
        break;
      }
    }
  }

  return conflicts;
}

async function run() {
  let offset = 0;
  let all = [];
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, text, chapter, lesson, teacher_id')
      .eq('teacher_id', '2ccbdf5d-f9c9-46f9-a472-297f594e0f16')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  console.log('=== تقرير مراجعة دقة التصنيف ===');
  console.log('إجمالي أسئلة م. مصطفى:', all.length);

  // 1. كم سؤال في كل درس
  const byLesson = {};
  for (const q of all) {
    byLesson[q.lesson] = (byLesson[q.lesson] || 0) + 1;
  }
  console.log('\n--- توزيع الأسئلة على الدروس ---');
  for (const [l, cnt] of Object.entries(byLesson)) {
    const official = OFFICIAL_LESSONS.includes(l) ? '✅' : '❌ غير رسمي!';
    console.log(`${official} "${l}": ${cnt}`);
  }

  // 2. كشف التضارب المحتمل
  const conflicted = [];
  for (const q of all) {
    const conflicts = detectConflict(q);
    if (conflicts.length > 0) {
      conflicted.push({ ...q, conflicts });
    }
  }
  console.log(`\n--- أسئلة مشتبه بتصنيفها الخاطئ: ${conflicted.length} سؤال ---`);
  
  // إحصاء حسب الدرس الحالي والمقترح
  const conflictSummary = {};
  for (const c of conflicted) {
    const key = `"${c.lesson}" ← "${c.conflicts[0].suggestedLesson}"`;
    conflictSummary[key] = (conflictSummary[key] || 0) + 1;
  }
  console.log('ملخص التضاربات:');
  for (const [pair, cnt] of Object.entries(conflictSummary)) {
    console.log(`  ${cnt} سؤال محتمل الخطأ: ${pair}`);
  }

  // 3. أمثلة على المشتبه بها
  if (conflicted.length > 0) {
    console.log('\n--- أمثلة أسئلة مشتبه بتصنيفها (أول 5 نماذج) ---');
    for (const c of conflicted.slice(0, 5)) {
      console.log(`ID: ${c.id}`);
      console.log(`  الدرس الحالي: "${c.lesson}"`);
      console.log(`  الدرس المقترح: "${c.conflicts[0].suggestedLesson}" (بسبب كلمة: "${c.conflicts[0].keyword}")`);
      console.log(`  نص السؤال: ${c.text.substring(0, 120)}`);
      console.log('');
    }
  }
}

run().catch(console.error);
