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

// Extract questions from PDF using Gemini Vision API
async function extractQuestionsFromPDF(
  pdfBuffer: ArrayBuffer,
  subject: string,
  defaultChapterName: string,
  sourceName: string
): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح Gemini API غير متوفر في إعدادات السيرفر (GEMINI_API_KEY). يرجى مراجعة المسؤول.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const pdfBase64 = bufferToBase64(pdfBuffer);

  const prompt = `أنت خبير تربوي وموجّه أول متخصص في تحليل المناهج والكتب المدرسية واستخراج بنوك الأسئلة بدقة فائقة.

المهمة: استخرج جميع الأسئلة والتمارين والتدريبات الموجودة في هذا الجزء مع تفكيك وتصنيف دقيق لكل سؤال.
ملاحظة هامة: قد يحتوي الملف على صفحات شرح ونظري ومقدمات؛ تجاهل صفحات الشرح تماماً ولا تستخرج منها أي نص، وركّز فقط وحصراً على استخراج الأسئلة الفعلية والتدريبات واختبارات الفصول ونماذج الامتحانات إن وجدت. وإذا لم تجد أي أسئلة في هذا الجزء، أرجع قائمة أسئلة فارغة [] بكل بساطة دون أي خطأ.

التعليمات الصارمة والمشددة:
1. استخراج نص السؤال: استخرج نص السؤال كاملاً كما هو مكتوب.
2. فصل الفصول والأبواب (chapter): استخرج اسم الفصل أو الباب الذي ينتمي إليه السؤال بدقة من ترويسة أو سياق الكتاب (مثال: "الفصل الأول: التيار الكهربي وقانون أوم"، "الباب الثاني: المغناطيسية"). إذا لم يُذكر، استخدم "${defaultChapterName || 'الفصل الأول'}".
3. فصل أسماء الدروس (lesson): استخرج اسم الدرس أو الموضوع الفرعي المحدد بدقة (مثال: "الدرس الأول: شدة التيار وفرق الجهد"، "الدرس الثاني: المقاومة النوعية"، "قانونا كيرشوف").
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
      "chapter": "اسم الفصل أو الباب بدقة",
      "lesson": "اسم الدرس المحدد",
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
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  let lastError: any = null;
  let responseText: string | undefined = undefined;

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: pdfBase64,
                    mimeType: 'application/pdf',
                  },
                },
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
        console.warn(`Gemini extraction attempt failed with model ${modelName}:`, err?.message || err);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (responseText) break;
  }

  if (!responseText) {
    if (lastError) throw new Error(`خطأ في معالجة الذكاء الاصطناعي: ${lastError.message || lastError}`);
    throw new Error('لم يتم استرجاع أي نص من الذكاء الاصطناعي');
  }
  
  try {
    const parsed = JSON.parse(responseText);
    const qs = parsed.questions || [];
    if (qs.length === 0) {
      console.warn('Gemini returned empty questions array. Raw response:', responseText.substring(0, 300));
    }
    return qs;
  } catch (parseErr: any) {
    console.error('Failed to parse Gemini response JSON:', parseErr, responseText.substring(0, 500));
    // Try to extract JSON between backticks if model wrapped in markdown
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const fallbackParsed = JSON.parse(jsonMatch[1]);
        return fallbackParsed.questions || [];
      } catch (e2) {}
    }
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
    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('sources')
      .insert({
        teacher_id: teacherId,
        name: sourceName || fileName,
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

export async function extractQuestionsFromChunkAction(
  chunkBufferBase64: string,
  subject: string,
  sourceName: string,
  chunkLabel: string
) {
  try {
    const binary = atob(chunkBufferBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    const extractedQuestions = await extractQuestionsFromPDF(
      buffer,
      subject,
      chunkLabel,
      sourceName
    );

    return {
      success: true,
      questions: extractedQuestions,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء معالجة الجزء',
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
    const extractedQuestions = await extractQuestionsFromPDF(
      fileBuffer,
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
      const questionRow = {
        teacher_id: teacherId,
        source_id: sourceId,
        text: q.text,
        question_type: q.question_type || 'mcq',
        difficulty: q.difficulty || 'medium',
        subject: subject,
        chapter: q.chapter || 'عام',
        lesson: q.lesson || null,
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
