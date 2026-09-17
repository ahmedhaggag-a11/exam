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

  const prompt = `أنت خبير تربوي متخصص في استخراج الأسئلة من الكتب المدرسية والمراجع.

المهمة: استخرج جميع الأسئلة الموجودة في هذا الملف.

المعلومات:
- المادة: ${subject}
- الفصل / الموضوع: ${chapterName}
- المصدر: ${sourceName}

التعليمات الصارمة:
1. استخرج كل سؤال موجود في الملف بالكامل - لا تفوّت أي سؤال
2. أنواع الأسئلة المسموح بها: mcq (اختيار من متعدد) أو essay (مقالي) أو true_false (صح وخطأ)
3. إذا كان السؤال اختياراً من متعدد، استخرج الإجابة الصحيحة
4. إذا وجد نموذج إجابة، استخرجه واحفظه في model_answer
5. لا تخترع أسئلة غير موجودة في الملف
6. إذا كان السؤال غير واضح، ضع needs_review: true

يجب أن يكون الناتج بصيغة JSON متوافقة مع هذا المخطط الدقيق (مصفوفة من الأسئلة داخل كائن):
{
  "questions": [
    {
      "text": "نص السؤال كاملاً",
      "question_type": "mcq",
      "difficulty": "medium",
      "choices": [
        {"code": "أ", "text": "نص الاختيار الأول", "is_correct": true},
        {"code": "ب", "text": "نص الاختيار الثاني", "is_correct": false},
        {"code": "ج", "text": "نص الاختيار الثالث", "is_correct": false},
        {"code": "د", "text": "نص الاختيار الرابع", "is_correct": false}
      ],
      "model_answer": null,
      "needs_review": false
    },
    {
      "text": "نص السؤال المقالي",
      "question_type": "essay",
      "difficulty": "hard",
      "choices": [],
      "model_answer": "الإجابة النموذجية إذا وجدت",
      "needs_review": false
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

    let insertedCount = 0;

    if (extractedQuestions.length > 0) {
      // Insert each extracted question
      for (const q of extractedQuestions) {
        const questionRow = {
          teacher_id: teacherId,
          source_id: sourceData.id,
          text: q.text,
          question_type: q.question_type || 'mcq',
          difficulty: q.difficulty || 'medium',
          subject: subject,
          chapter: chapterName,
          grade_level: 'الصف الثالث الثانوي',
          marks: q.question_type === 'essay' ? 4 : 2,
          model_answer: q.model_answer || null,
          needs_review: q.needs_review || false,
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

        // Insert choices for MCQ and true/false
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
    }

    // Update source status
    await supabaseAdmin
      .from('sources')
      .update({ status: 'completed' })
      .eq('id', sourceData.id);

    return {
      success: true,
      questionsExtracted: insertedCount,
      message: insertedCount > 0
        ? `تم استخراج ${insertedCount} سؤال بنجاح من الملف!`
        : 'تم رفع الملف. لم يتم استخراج أسئلة (تحقق من مفتاح Gemini API).'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ غير متوقع' };
  }
}
