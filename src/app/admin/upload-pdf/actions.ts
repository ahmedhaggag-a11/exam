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
  chapterName: string,
  sourceName: string
): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('No Gemini API key, using empty extraction');
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  const pdfBase64 = bufferToBase64(pdfBuffer);

  const prompt = `أنت خبير تربوي متخصص في استخراج الأسئلة من الكتب المدرسية.

المهمة: استخرج جميع الأسئلة الموجودة في هذا الملف.

التعليمات الصارمة:
1. استخرج كل سؤال بالكامل.
2. أنواع الأسئلة: mcq (اختيار من متعدد) أو essay (مقالي) أو true_false (صح وخطأ).
3. إذا كان السؤال اختياراً من متعدد، استخرج الإجابة الصحيحة.
4. إذا كان السؤال يعتمد على صورة أو رسم بياني (مثل الدوائر الكهربائية، الخرائط، إلخ)، قم بتحديد إحداثيات الصورة بدقة.
استخدم تنسيق الإحداثيات التالي: [ymin, xmin, ymax, xmax] (حيث القيم بين 0 و 1000).
5. يجب أن تعطي رقم الصفحة التي توجد بها الصورة (رقم الصفحة يبدأ من 1).

يجب أن يكون الناتج بصيغة JSON متوافقة مع هذا المخطط الدقيق:
{
  "questions": [
    {
      "text": "نص السؤال كاملاً",
      "question_type": "mcq",
      "difficulty": "medium",
      "choices": [
        {"code": "أ", "text": "نص", "is_correct": true}
      ],
      "model_answer": null,
      "needs_review": false,
      "has_image": true,
      "image_page_number": 1,
      "image_box": [200, 300, 500, 600]
    }
  ]
}`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.text;
    if (!responseText) return [];
    
    const parsed = JSON.parse(responseText);
    return parsed.questions || [];
}

export async function uploadPdfAndSeedBank(formData: FormData) {
  const file = formData.get('file') as File;
  const teacherId = formData.get('teacherId') as string;
  const subject = formData.get('subject') as string;
  const chapterName = formData.get('chapterName') as string;
  const sourceName = formData.get('sourceName') as string;

  if (!file || !teacherId) {
    return { success: false, error: 'بيانات ناقصة: يرجى اختيار الملف والمعلم' };
  }

  try {
    const fileBuffer = await file.arrayBuffer();

    // 1. Upload file to Storage using admin key (bypasses RLS)
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
        grade_level: 'الصف الثالث الثانوي',
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (sourceError) throw new Error(`خطأ في حفظ بيانات المصدر: ${sourceError.message}`);

    // 3. Extract questions using Gemini AI
    const extractedQuestions = await extractQuestionsFromPDF(
      fileBuffer,
      subject,
      chapterName,
      sourceName
    );

    // Return the source data and the extracted questions to the client
    // so the client can process image cropping via PDF.js before saving
    return {
      success: true,
      sourceData: sourceData,
      questions: extractedQuestions,
      message: 'تم استخراج الأسئلة. جاري معالجة الصور...'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ غير متوقع' };
  }
}

export async function saveQuestionsBulk(
  teacherId: string, 
  sourceId: string, 
  subject: string, 
  chapter: string, 
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
        chapter: chapter,
        grade_level: 'الصف الثالث الثانوي',
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

      if (qError) continue;

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
