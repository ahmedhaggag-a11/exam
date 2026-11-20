'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Convert PDF buffer to base64 for Gemini Vision
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Extract questions using Gemini Multimodal Vision API (supports PDF or image arrays)
async function extractQuestionsMultimodal(
  parts: Array<{ inlineData: { data: string; mimeType: string } }>,
  subject: string,
  defaultChapterName: string,
  sourceName: string,
  targetChapter?: string,
  targetLesson?: string,
  allBookSections?: Array<{ chapter: string; lesson: string; startPage: number; endPage: number }>
): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح Gemini API غير متوفر في إعدادات السيرفر (GEMINI_API_KEY). يرجى مراجعة المسؤول.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Sanitize default chapter/lesson to ensure NO "الجزء" or page numbers ever leak in
  const isGenericOrChunk = (str?: string) => !str || str.includes('الجزء') || /ص\s*\d+/.test(str);
  const chapterContext = !isGenericOrChunk(targetChapter) 
    ? targetChapter! 
    : (!isGenericOrChunk(defaultChapterName) ? defaultChapterName : (subject || 'الفصل الأول'));
  const lessonContext = !isGenericOrChunk(targetLesson) ? targetLesson! : 'الدرس الأول';

  // Build lessons reference menu for the prompt if book sections exist
  const lessonsMenu = allBookSections && allBookSections.length > 0
    ? `\nقائمة الفصول والدروس الرسمية المعتمدة لهذا الكتاب:\n${allBookSections.map((s, idx) => `${idx + 1}. [${s.chapter}] -> ${s.lesson}`).join('\n')}\n`
    : '';

  const prompt = `أنت خبير تربوي وموجّه أول متخصص في تحليل المناهج والكتب المدرسية واستخراج بنوك الأسئلة بدقة فائقة.

المهمة: استخرج جميع الأسئلة والتمارين والتدريبات الموجودة في هذا الجزء مع تفكيك وتصنيف دقيق لكل سؤال.
ملاحظة هامة: قد يحتوي الملف على صفحات شرح ونظري ومقدمات؛ تجاهل صفحات الشرح تماماً ولا تستخرج منها أي نص، وركّز فقط وحصراً على استخراج الأسئلة الفعلية والتدريبات واختبارات الفصول ونماذج الامتحانات إن وجدت. وإذا لم تجد أي أسئلة في هذا الجزء، أرجع قائمة أسئلة فارغة [] بكل بساطة دون أي خطأ.

السياق الدراسي والمنهجي المبدئي لهذا الجزء:
- الفصل / الوحدة المبدئية: "${chapterContext}"
- الدرس / الموضوع المبدئي: "${lessonContext}"
${lessonsMenu}

التعليمات الصارمة والمشددة لمنع اختلاط أسئلة الدروس ببعضها:
1. استخراج نص السؤال: استخرج نص السؤال كاملاً كما هو مكتوب في الكتاب دون اختصار.
2. ⚠️ قاعدة التصنيف العلمي الدقيق للدرس (lesson) والفصل (chapter):
   - 🚫 تحذير شديد: لا تعتمد عميانياً على الدرس المبدئي للجزء! صفحات الكتب قد تحتوي على أسئلة لموضوعات متعددة أو صفحات مراجعة تضم أكثر من درس.
   - يجب فحص "المفهوم العلمي والموضوع الدقيق" لكل سؤال ومطابقته بدقة متناهية مع درسه الحقيقي من القائمة المعتمدة أعلاه:
     * أسئلة نسب المياه وتوزيعها ودورة الماء في الطبيعة -> تتبع "الغلاف المائي على كوكب الأرض".
     * أسئلة الروابط الهيدروجينية، قطبية الماء، التحليل الكهربي، والتركيب الكيميائي -> تتبع "الخواص الكيميائية للماء".
     * أسئلة الكثافة، شذوذ الماء، درجات الغليان والتجمد، الحرارة النوعية، التوتر السطحي -> تتبع "الخواص الفيزيائية للماء".
     * أسئلة الذوبان، المذاب والمذيب، المحاليل الغروية والمعلقة، والتركيز، والتوصيل الكهربي للمحاليل -> تتبع "المحاليل المائية وخواصها".
     * أسئلة دور الماء في العمليات الحيوية، البناء الضوئي، الدم ونقل الغذاء والفضلات في الكائنات الحية -> تتبع "الأهمية البيولوجية للماء".
     * أسئلة الخياشيم، الزعانف، كيس العوم، تكيفات الأسماك والحيتان والنباتات المائية للعيش في الماء -> تتبع "التكيفات البيولوجية للكائنات الحية في البيئة المائية".
     * أسئلة تركيز الأكسجين الذائب وتنفس الكائنات المائية، وذوبان CO2 وتحمض المحيطات -> تتبع "تأثير غازات الهواء الجوي على البيئات المائية".
     * أسئلة نفاذية الضوء في الماء والمناطق المضاءة والمظلمة والبناء الضوئي في الأعماق -> تتبع "تأثير الضوء والإشعاع الشمسي على البيئات المائية".
     * أسئلة حساب الضغط الهيدروستاتيكي في الأعماق (P = ρgh) وتكيف الكائنات مع الضغط العالي -> تتبع "تأثير الضغط المائي على الكائنات الحية".
     * أسئلة التلوث المائي، الصيد الجائر، الإثراء الغذائي، وحماية النظم المائية واستدامتها -> تتبع "التوازن البيئي ودور الإنسان في استدامة الحياة المائية".
     * أسئلة طبقات الغلاف الجوي (تروبوسفير، ستراتوسفير...) ونسب الغازات -> تتبع "مكونات وطبقات الغلاف الجوي".
     * أسئلة تفاعلات الأوزون، الضباب الدخاني، والأمطار الحمضية -> تتبع "التفاعلات الكيميائية في الغلاف الجوي".
     * أسئلة الضغط الجوي، الرياح، الرطوبة، السحب، ودرجات الحرارة -> تتبع "العوامل الفيزيائية وتأثيرها في الغلاف الجوي".
     * أسئلة الاحتباس الحراري، التغير المناخي، وثقب الأوزون ورصد المناخ -> تتبع "الغلاف الجوي ودور العلم في استدامته".
   - ⚠️ يجب استخدام "الاسم الحرفي الدقيق" للدرس كما هو في القائمة المعتمدة دون إضافة أي بادئات مثل (الدرس الأول:) ودون وضع (الجزء X) أو أرقام الصفحات.
3. نوع السؤال (question_type):
   - mcq: اختيار من متعدد
   - essay: أسئلة مقالية، علل، ما النتائج المترتبة، مسائل حسابية
   - true_false: صح أو خطأ
4. مستوى الصعوبة التربوي (difficulty):
   - easy: أسئلة التذكر والمفاهيم المباشرة البسيطة.
   - medium: أسئلة الفهم والتطبيق الحسابي المعتاد.
   - hard: أسئلة مستويات التفكير العليا، والمسائل المركبة، وأسئلة الفائقين.
5. إذا كان السؤال اختياراً من متعدد (mcq)، استخرج جميع الخيارات مع كود الخيار (أ، ب، ج، د)، وحدد الخيار الصحيح بـ is_correct: true.
6. ⚠️ قاعدة صارمة جداً بخصوص الصور والرسومات (has_image):
   - إذا كان السؤال نصياً فقط (سواء كان معه خيارات أو بدون) ولا يحتوي على رسم، يُمنع منعاً باتاً استخراج أو قص صورة له! اجعل السؤال نصاً كاملاً فقط مع خياراته، وضع has_image: false و image_box: null.
   - استخرج صورة فقط وفقط وحصراً إذا كان السؤال يحتوي على: رسم بياني، أو دائرة كهربية، أو شكل هندسي، أو خريطة، أو جهاز تجريبي، أو رسمة علمية لا يمكن فهم السؤال بدونها!
   - في حال وجود رسمة توضيحية، حدد إحداثيات صندوق الرسمة فقط (وليس نص السؤال ولا الخيارات) بدقة [ymin, xmin, ymax, xmax] حيث القيم بين 0 و 1000. ورقم الصفحة يبدأ من 1.

يجب أن يكون الناتج بصيغة JSON متوافقة مع هذا المخطط الدقيق:
{
  "questions": [
    {
      "text": "نص السؤال كاملاً بدون قص",
      "chapter": "${chapterContext}",
      "lesson": "${lessonContext}",
      "question_type": "mcq",
      "difficulty": "medium",
      "choices": [
        {"code": "أ", "text": "نص الاختيار الأول", "is_correct": false},
        {"code": "ب", "text": "نص الاختيار الثاني", "is_correct": true},
        {"code": "ج", "text": "نص الاختيار الثالث", "is_correct": false},
        {"code": "د", "text": "نص الاختيار الرابع", "is_correct": false}
      ],
      "model_answer": "شرح الحل النموذجي إن وجد",
      "needs_review": false,
      "has_image": false,
      "image_page_number": null,
      "image_box": null
    }
  ]
}`;

  const CANDIDATE_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
  ];

  let lastError: any = null;
  let responseText: string | undefined = undefined;

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                ...parts,
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (result && result.text) {
          responseText = result.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini extraction attempt ${attempt + 1} failed with model ${modelName}:`, err?.message || err);
        // Exponential backoff for 503 high demand spikes
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    if (responseText) break;
  }

  if (!responseText) {
    if (lastError) throw new Error(`خطأ في معالجة الذكاء الاصطناعي: ${lastError.message || lastError}`);
    throw new Error('لم يتم استرجاع أي نص من الذكاء الاصطناعي');
  }
  
  try {
    let qs: any[] = [];
    try {
      const parsed = JSON.parse(responseText);
      qs = parsed.questions || [];
    } catch (parseErr) {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const fallbackParsed = JSON.parse(jsonMatch[1]);
        qs = fallbackParsed.questions || [];
      } else {
        throw parseErr;
      }
    }

    // Strict Sanitization: Guarantee NO technical chunk index ever becomes a chapter/lesson name
    for (const q of qs) {
      if (!q.chapter || q.chapter.includes('الجزء') || /ص\s*\d+/.test(q.chapter)) {
        q.chapter = chapterContext;
      }
      if (q.lesson && (q.lesson.includes('الجزء') || /ص\s*\d+/.test(q.lesson))) {
        q.lesson = lessonContext;
      }
      if (!q.lesson) {
        q.lesson = lessonContext;
      }
    }

    return qs;
  } catch (parseErr: any) {
    console.error('Failed to parse Gemini response JSON:', parseErr, responseText.substring(0, 500));
    throw new Error(`تعذر قراءة إجابة الذكاء الاصطناعي: ${parseErr.message}`);
  }
}

export async function registerSourceRecord(
  teacherId: string,
  sourceName: string,
  fileName: string,
  fileSize: number,
  subject: string,
  gradeLevel: string
) {
  try {
    const finalName = sourceName || fileName;

    // Check if a source with the exact same name already exists for this teacher
    const { data: existingSource } = await supabaseAdmin
      .from('sources')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('name', finalName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSource) {
      console.log(`Found existing source record (${existingSource.id}) for "${finalName}". Reusing it.`);
      return { success: true, sourceData: existingSource };
    }

    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('sources')
      .insert({
        teacher_id: teacherId,
        name: finalName,
        original_filename: fileName,
        storage_path: `registered/${Date.now()}_${fileName}`,
        file_url: 'https://supabase.co',
        subject: subject,
        grade_level: gradeLevel,
        file_size: fileSize,
        status: 'processing',
      })
      .select()
      .single();

    if (sourceError) throw new Error(sourceError.message);
    return { success: true, sourceData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =====================================================
// =====================================================
// Analyze book structure (TOC) using Gemini Vision
// Supports: Standalone Index photo/PDF, or pages from the book
// =====================================================
export async function analyzeBookStructureAction(
  tocPagesInput: { 
    pdfBase64?: string; 
    imagesBase64?: string[]; 
    pageLabels?: number[];
    isStandaloneIndex?: boolean;
  },
  totalPages: number = 0
): Promise<{
  success: boolean;
  sections?: Array<{ label: string; chapter: string; lesson: string; startPage: number; endPage: number }>;
  error?: string;
}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('مفتاح Gemini API غير متوفر في إعدادات السيرفر (GEMINI_API_KEY)');
    const ai = new GoogleGenAI({ apiKey });

    let parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    if (tocPagesInput.pdfBase64) {
      parts = [{ inlineData: { data: tocPagesInput.pdfBase64, mimeType: 'application/pdf' } }];
    } else if (tocPagesInput.imagesBase64 && tocPagesInput.imagesBase64.length > 0) {
      parts = tocPagesInput.imagesBase64.map((b64) => {
        let mimeType = 'image/jpeg';
        let data = b64;
        if (b64.startsWith('data:')) {
          const match = b64.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            data = match[2];
          }
        }
        return { inlineData: { data, mimeType } };
      });
    } else {
      throw new Error('لم يتم إرسال أي صورة أو صفحة للتحليل');
    }

    const isStandalone = tocPagesInput.isStandaloneIndex || totalPages <= 0;

    const pageLabels = tocPagesInput.pageLabels;
    const pageContextNote = pageLabels && pageLabels.length > 0
      ? `ملاحظة: الصفحات المُرسَلة مأخوذة من أرقام الصفحات: [${pageLabels.join(', ')}] من إجمالي ${totalPages} صفحة.`
      : ``;

    const prompt = isStandalone
      ? `أنت محلل محتوى ومناهج تربوية خبير متخصص في تحليل فهارس وجداول محتويات الكتب المدرسية.

المهمة المطلوبة:
اقرأ صورة أو مستند الفهرس (جدول المحتويات) المرفق بدقة فائقة جداً وبصيرة عالية.
استخرج الهيكل الكامل والشامل للمنهج والكتاب بجميع وحداته وفصوله ودروسه كما هي مكتوبة في الفهرس حرفياً وبلا أي نقص أو اختصار.

قواعد صارمة ومشددة:
1. ⚠️ استخرج جميع الوحدات (الوحدة الأولى، الوحدة الثانية...) وجميع الدروس داخل كل وحدة بالتفصيل والترتيب المنهجي الكامل (مثال: إذا كان في الفهرس 14 درساً، يجب استخراج الـ 14 درساً جميعاً دون تفويت أي درس).
2. ⚠️ اسم الفصل / الوحدة (chapter): الاسم الكامل كما هو في الفهرس (مثال: "الوحدة الأولى: النظام البيئي المائي").
3. ⚠️ اسم الدرس (lesson): اسم الموضوع أو الدرس المحدد بدقة (مثال: "الدرس الأول: الغلاف المائي على كوكب الأرض"، "الدرس الثاني: الخواص الكيميائية للماء").
4. 🚫 ممنوع منعاً باتاً وضع (الجزء X) أو أرقام صفحات في خانة اسم الفصل أو الدرس.
5. أرقام الصفحات (startPage و endPage):
   - إذا كانت أرقام الصفحات مكتوبة بجوار الدروس في الفهرس، استخرج رقم صفحة البداية ورقم النهاية بدقة.
   - إذا لم تكن أرقام الصفحات مكتوبة أو غير ظاهرة، اجعل startPage: 1 و endPage: 1.

يجب أن يكون الناتج بصيغة JSON حصراً بهذا المخطط:
{
  "sections": [
    {
      "label": "الوحدة الأولى: النظام البيئي المائي › الدرس الأول: الغلاف المائي على كوكب الأرض",
      "chapter": "الوحدة الأولى: النظام البيئي المائي",
      "lesson": "الدرس الأول: الغلاف المائي على كوكب الأرض",
      "startPage": 1,
      "endPage": 20
    }
  ]
}`
      : `أنت محلل محتوى خبير في الكتب المدرسية والمناهج التعليمية المصرية والعربية.

المهمة: اقرأ جدول المحتويات أو الفهرس في الصفحات المرفقة بدقة بالغة، واستخرج الهيكل الكامل والشامل للكتاب بجميع وحداته وفصوله ودروسه.
${pageContextNote}

قواعد صارمة ومشددة:
1. استخرج كل وحدة، وكل فصل داخل الوحدة، وكل درس داخل الفصل بالتفصيل بلا أي اختصار أو تفويت.
2. ⚠️ اسم الفصل (chapter): يجب أن يكون الاسم الحقيقي والكامل للفصل/الوحدة (مثال: "الوحدة الأولى: النظام البيئي المائي" أو "الفصل الأول: التيار الكهربي وقانون أوم").
3. ⚠️ اسم الدرس (lesson): يجب أن يكون اسم الدرس أو الموضوع العلمي المحدد المكتوب في الفهرس (مثال: "الدرس الأول: الغلاف المائي على كوكب الأرض").
4. 🚫 ممنوع منعاً باتاً وقاطعاً وضع (الجزء X) أو (ص X-Y) أو أرقام الصفحات كاسم فصل أو درس.
5. أرقام الصفحات:
   - startPage: هو رقم الصفحة المكتوب في الفهرس كبداية لهذا الدرس.
   - endPage: هو (رقم بداية الدرس التالي - 1)، وآخر درس ينتهي بالصفحة ${totalPages}.
6. تأكد من أن جميع الصفحات من 1 إلى ${totalPages} مغطاة بدون أي فراغات. إذا كانت هناك صفحات تمهيد قبل أول درس (مثلاً ص 1 إلى 8)، ضمّها للدرس الأول.

الناتج المطلوب بصيغة JSON متوافقة حصراً مع هذا المخطط:
{
  "sections": [
    {
      "label": "الوحدة الأولى: النظام البيئي المائي › الدرس الأول: الغلاف المائي على كوكب الأرض",
      "chapter": "الوحدة الأولى: النظام البيئي المائي",
      "lesson": "الدرس الأول: الغلاف المائي على كوكب الأرض",
      "startPage": 1,
      "endPage": 37
    }
  ]
}`;

    const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
    let responseText: string | undefined;
    let lastError: any;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
          config: { responseMimeType: 'application/json' },
        });
        if (result?.text) { responseText = result.text; break; }
      } catch (err: any) {
        lastError = err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!responseText) throw new Error(lastError?.message || 'فشل تحليل هيكل وفهرس الكتاب');

    const parsed = JSON.parse(responseText);
    const sections = parsed.sections || [];
    if (!sections.length) throw new Error('لم يتم اكتشاف أي فصول أو دروس في الصورة أو الصفحات المُرسَلة');

    return { success: true, sections };
  } catch (err: any) {
    console.error('analyzeBookStructureAction error:', err);
    return { success: false, error: err.message || 'تعذر تحليل هيكل وفهرس الكتاب' };
  }
}

export async function extractQuestionsFromChunkAction(
  chunkInput: string | { pdfBase64?: string; imagesBase64?: string[] },
  subject: string,
  sourceName: string,
  chunkLabel: string,
  targetChapter?: string,
  targetLesson?: string,
  allBookSections?: Array<{ chapter: string; lesson: string; startPage: number; endPage: number }>
) {
  try {
    let parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

    if (typeof chunkInput === 'string') {
      parts = [{ inlineData: { data: chunkInput, mimeType: 'application/pdf' } }];
    } else if (chunkInput && chunkInput.pdfBase64) {
      parts = [{ inlineData: { data: chunkInput.pdfBase64, mimeType: 'application/pdf' } }];
    } else if (chunkInput && chunkInput.imagesBase64 && chunkInput.imagesBase64.length > 0) {
      parts = chunkInput.imagesBase64.map((b64) => ({
        inlineData: {
          data: b64,
          mimeType: 'image/jpeg',
        },
      }));
    } else {
      throw new Error('لم يتم إرسال أي صفحات صالحة للمعالجة');
    }

    const extractedQuestions = await extractQuestionsMultimodal(
      parts,
      subject,
      chunkLabel,
      sourceName,
      targetChapter,
      targetLesson,
      allBookSections
    );

    // Post-extraction normalization: Ensure every question uses the exact clean lesson name from allBookSections without "الدرس X:" prefixes
    const normalizedQuestions = (extractedQuestions || []).map((q) => {
      let l = (q.lesson || '').trim();
      let ch = (q.chapter || '').trim();

      // Remove prefixes like "الدرس الأول: " or "الدرس 1: "
      l = l.replace(/^الدرس\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|\d+)[\s:ـ-]+/i, '').trim();

      // If allBookSections exist, match to the exact official name
      if (allBookSections && allBookSections.length > 0) {
        const cleanOfficialLessons = allBookSections.map(s => ({
          ...s,
          cleanName: s.lesson.replace(/^الدرس\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|\d+)[\s:ـ-]+/i, '').trim()
        }));

        const exactMatch = cleanOfficialLessons.find((s) => s.cleanName === l || s.lesson === l);
        if (exactMatch) {
          l = exactMatch.cleanName;
          ch = exactMatch.chapter;
        }
      }

      return {
        ...q,
        lesson: l || targetLesson || 'الدرس الأول',
        chapter: ch || targetChapter || 'الوحدة الأولى',
      };
    });

    return {
      success: true,
      questions: normalizedQuestions,
    };
  } catch (err: any) {
    console.error('extractQuestionsFromChunkAction error:', err);
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء معالجة الجزء',
      questions: [],
    };
  }
}

export async function uploadPdfAndSeedBank(formData: FormData) {
  const file = formData.get('file') as File;
  const teacherId = formData.get('teacherId') as string;
  const subject = formData.get('subject') as string;
  const gradeLevel = (formData.get('gradeLevel') as string) || 'الصف الثالث الثانوي';
  const term = (formData.get('term') as string) || 'الترم الأول';
  const sourceName = formData.get('sourceName') as string;

  if (!file || !teacherId) {
    return { success: false, error: 'بيانات ناقصة: يرجى اختيار الملف والمعلم' };
  }

  try {
    const fileBuffer = await file.arrayBuffer();

    // 1. Upload file to Storage using admin key
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `${teacherId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(`خطأ في رفع الملف: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage.from('pdfs').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // 2. Insert source record
    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('sources')
      .insert({
        teacher_id: teacherId,
        name: sourceName || file.name,
        original_filename: file.name,
        storage_path: storagePath,
        file_url: publicUrl,
        subject: subject,
        grade_level: gradeLevel,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (sourceError) throw new Error(`خطأ في حفظ بيانات المصدر: ${sourceError.message}`);

    // 3. Extract questions using Gemini Vision AI
    const pdfBase64 = bufferToBase64(fileBuffer);
    const extractedQuestions = await extractQuestionsMultimodal(
      [{ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } }],
      subject,
      '',
      sourceName
    );

    if (!extractedQuestions || extractedQuestions.length === 0) {
      return {
        success: false,
        error: 'لم يتم العثور على أي أسئلة داخل هذا الملف أو أن محتوى الـ PDF غير واضح للذكاء الاصطناعي.',
      };
    }

    return {
      success: true,
      sourceData: sourceData,
      questions: extractedQuestions,
      message: 'تم استخراج الأسئلة وتصنيف الفصول والصعوبة بنجاح.'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ غير متوقع' };
  }
}

export async function saveQuestionsBulk(
  teacherId: string, 
  sourceId: string, 
  subject: string, 
  gradeLevel: string,
  term: string,
  questions: any[]
) {
  try {
    let insertedCount = 0;
    for (const q of questions) {
      let cleanChapter = q.chapter || 'عام';
      if (cleanChapter.includes('الجزء') || /ص\s*\d+/.test(cleanChapter)) {
        cleanChapter = subject || 'الفصل الأول';
      }
      let cleanLesson = q.lesson || null;
      if (cleanLesson && (cleanLesson.includes('الجزء') || /ص\s*\d+/.test(cleanLesson))) {
        cleanLesson = null;
      }

      const questionRow = {
        teacher_id: teacherId,
        source_id: sourceId,
        text: q.text,
        question_type: q.question_type || 'mcq',
        difficulty: q.difficulty || 'medium',
        subject: subject,
        chapter: cleanChapter,
        lesson: cleanLesson,
        grade_level: gradeLevel || 'الصف الثالث الثانوي',
        term: term || 'الترم الأول',
        marks: q.question_type === 'essay' ? 4 : 2,
        model_answer: q.model_answer || null,
        needs_review: q.needs_review || false,
        image_urls: q.final_image_url ? [q.final_image_url] : [],
      };

      const { data: createdQ, error: qError } = await supabaseAdmin
        .from('questions')
        .insert(questionRow)
        .select()
        .single();

      if (qError) {
        console.error('Error inserting question:', qError);
        continue;
      }

      if (createdQ && q.choices && q.choices.length > 0) {
        const choiceRows = q.choices.map((c: any, idx: number) => ({
          question_id: createdQ.id,
          choice_code: c.code || String.fromCharCode(65 + idx),
          text: c.text,
          is_correct: c.is_correct || false,
          order_index: idx,
        }));
        await supabaseAdmin.from('question_choices').insert(choiceRows);
      }
      insertedCount++;
    }

    await supabaseAdmin.from('sources').update({ status: 'completed' }).eq('id', sourceId);
    return { success: true, count: insertedCount };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadImageFromBase64(base64Data: string, teacherId: string): Promise<string | null> {
  try {
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    const fileName = `images/${teacherId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabaseAdmin.storage.from('pdfs').getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Error uploading image:', err);
    return null;
  }
}
