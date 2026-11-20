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
  targetLesson?: string
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

  const prompt = `أنت خبير تربوي وموجّه أول متخصص في تحليل المناهج والكتب المدرسية واستخراج بنوك الأسئلة بدقة فائقة.

المهمة: استخرج جميع الأسئلة والتمارين والتدريبات الموجودة في هذا الجزء مع تفكيك وتصنيف دقيق لكل سؤال.
ملاحظة هامة: قد يحتوي الملف على صفحات شرح ونظري ومقدمات؛ تجاهل صفحات الشرح تماماً ولا تستخرج منها أي نص، وركّز فقط وحصراً على استخراج الأسئلة الفعلية والتدريبات واختبارات الفصول ونماذج الامتحانات إن وجدت. وإذا لم تجد أي أسئلة في هذا الجزء، أرجع قائمة أسئلة فارغة [] بكل بساطة دون أي خطأ.

السياق الدراسي والمنهجي المحدد لهذا الجزء من الكتاب:
- الفصل / الوحدة الرئيسية: "${chapterContext}"
- الدرس / الموضوع الفرعي: "${lessonContext}"

التعليمات الصارمة والمشددة:
1. استخراج نص السؤال: استخرج نص السؤال كاملاً كما هو مكتوب في الكتاب دون اختصار.
2. ⚠️ تصنيف الفصل (chapter):
   - يجب أن يكون اسم الفصل هو: "${chapterContext}" (أو اسم الوحدة/الباب الحقيقي من ترويسة الصفحة).
   - 🚫 ممنوع منعاً باتاً وقاطعاً وضع (الجزء X) أو (ص X-Y) أو أي إشارة لأرقام الأجزاء أو أرقام الصفحات كاسم فصل! يجب أن يكون اسماً تعليمياً حقيقياً يظهر في بنك الأسئلة.
3. ⚠️ تصنيف الدرس (lesson):
   - يجب أن يكون اسم الدرس هو: "${lessonContext}" أو الموضوع العلمي المحدد الدقيق المذكور في ترويسة الدرس.
   - 🚫 ممنوع منعاً باتاً تسمية الدرس برقم الجزء أو أرقام الصفحات.
4. نوع السؤال (question_type):
   - mcq: اختيار من متعدد
   - essay: أسئلة مقالية، علل، ما النتائج المترتبة، مسائل حسابية
   - true_false: صح أو خطأ
5. مستوى الصعوبة التربوي (difficulty):
   - easy: أسئلة التذكر والمفاهيم المباشرة البسيطة.
   - medium: أسئلة الفهم والتطبيق الحسابي المعتاد.
   - hard: أسئلة مستويات التفكير العليا، والمسائل المركبة، وأسئلة الفائقين.
6. إذا كان السؤال اختياراً من متعدد (mcq)، استخرج جميع الخيارات مع كود الخيار (أ، ب، ج، د)، وحدد الخيار الصحيح بـ is_correct: true.

7. ⚠️ قاعدة صارمة جداً بخصوص الصور والرسومات (has_image):
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
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
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
// Analyze book structure (TOC) using Gemini Vision
// =====================================================
export async function analyzeBookStructureAction(
  tocPagesInput: { pdfBase64?: string; imagesBase64?: string[]; pageLabels?: number[] },
  totalPages: number
): Promise<{
  success: boolean;
  sections?: Array<{ label: string; chapter: string; lesson: string; startPage: number; endPage: number }>;
  error?: string;
}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    const ai = new GoogleGenAI({ apiKey });

    let parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    if (tocPagesInput.pdfBase64) {
      parts = [{ inlineData: { data: tocPagesInput.pdfBase64, mimeType: 'application/pdf' } }];
    } else if (tocPagesInput.imagesBase64 && tocPagesInput.imagesBase64.length > 0) {
      parts = tocPagesInput.imagesBase64.map((b64) => ({ inlineData: { data: b64, mimeType: 'image/jpeg' } }));
    } else {
      throw new Error('لم يتم إرسال صفحات للتحليل');
    }

    // Build page context note for Gemini so it knows exact page numbers of the sent images
    const pageLabels = tocPagesInput.pageLabels;
    const pageContextNote = pageLabels && pageLabels.length > 0
      ? `ملاحظة هامة جداً: الصور المُرسَلة ليست صفحات متتالية — كل صورة مأخوذة من صفحة محددة في الكتاب الأصلي لاكتشاف فهارس كل الأجزاء. ترتيب أرقام الصفحات المُرسَلة بالتسلسل هو: [${pageLabels.join(', ')}] من إجمالي ${totalPages} صفحة. استخدم هذه الأرقام بدقة عند تحديد startPage لكل فصل أو درس تجده في الفهارس.`
      : `الصور المُرسَلة هي الصفحات الأولى من الكتاب.`;

    const prompt = `أنت محلل محتوى خبير في الكتب المدرسية المصرية والعربية، ومتخصص في الكتب المجمّعة من أجزاء متعددة.

المهمة: حلّل الصفحات المُرسَلة وأعد الهيكل الكامل والشامل للكتاب بكل أجزائه ودروسه واختباراته.

${pageContextNote}

**تعليمات خاصة بالكتب المجمّعة من أجزاء متعددة:**
- هذا الكتاب قد يحتوي على: كتاب أول + كتاب ثانٍ + اختبارات شاملة، كل جزء له فهرسه الخاص في بداية هذا الجزء.
- ابحث عن كل فهرس أو جدول محتويات في الصفحات المُرسَلة، حتى لو ظهر في منتصف القائمة.
- استخرج هيكل كل جزء بشكل مستقل وأدمجهم في قائمة sections واحدة متسلسلة ومرتبة حسب رقم الصفحة.
- الاختبارات الشاملة (نهاية الفصل / اختبار تراكمي / اختبار شامل) تُصنَّف كـ chapter مستقل باسمها الحقيقي في الكتاب.

**التعليمات العامة:**
1. ابحث عن جدول المحتويات (فهرس المحتويات / Table of Contents) في أي من الصفحات المُرسَلة.
2. استخرج كل فصل (وحدة / باب) ودروسه الفرعية مع رقم بداية كل منها كما هو مكتوب في الكتاب.
3. رقم نهاية كل قسم = رقم بداية القسم التالي - 1. آخر قسم ينتهي بالصفحة ${totalPages}.
4. إذا لم يوجد جدول محتويات في صفحة ما، اقرأ ترويسة الصفحة واستنتج الفصل والدرس.
5. ضمّ الدروس القصيرة (أقل من 3 صفحات) مع الدرس الذي قبلها أو بعدها.
6. كل section يجب أن يغطي على الأقل 3 صفحات وأقصاه 25 صفحة.
7. 🚫 ممنوع منعاً باتاً استخدام كلمة "الجزء X" أو أرقام الصفحات كاسم للفصل أو الدرس — يجب أن تكون أسماء تعليمية حقيقية مثل "الوحدة الأولى: النظام البيئي".

**الناتج المطلوب بصيغة JSON فقط:**
{
  "sections": [
    {
      "label": "الوحدة الأولى - الدرس الأول: قانون أوم",
      "chapter": "الوحدة الأولى: الكهرباء",
      "lesson": "الدرس الأول: قانون أوم وشدة التيار",
      "startPage": 5,
      "endPage": 18
    }
  ]
}

**مهم جداً:** أعد JSON فقط بدون أي نص إضافي. تأكد أن جميع الصفحات من 1 إلى ${totalPages} مغطاة بدون فجوات. إذا لم تعثر على فهرس في صفحة ما، تجاهلها وركّز على الصفحات التي تحتوي على فهرس.`;

    const CANDIDATE_MODELS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
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

    if (!responseText) throw new Error(lastError?.message || 'فشل تحليل هيكل الكتاب');

    const parsed = JSON.parse(responseText);
    const sections = parsed.sections || [];
    if (!sections.length) throw new Error('لم يتم اكتشاف أي فصول أو دروس في الصفحات المُرسَلة');

    return { success: true, sections };
  } catch (err: any) {
    console.error('analyzeBookStructureAction error:', err);
    return { success: false, error: err.message || 'تعذر تحليل هيكل الكتاب' };
  }
}

export async function extractQuestionsFromChunkAction(
  chunkInput: string | { pdfBase64?: string; imagesBase64?: string[] },
  subject: string,
  sourceName: string,
  chunkLabel: string,
  targetChapter?: string,
  targetLesson?: string
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
      targetLesson
    );

    return {
      success: true,
      questions: extractedQuestions || [],
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
