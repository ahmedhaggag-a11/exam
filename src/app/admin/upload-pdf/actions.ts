'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
    // 1. Upload file to Storage using admin key (bypasses RLS)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `${teacherId}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();
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
        status: 'completed',
      })
      .select()
      .single();

    if (sourceError) throw new Error(`خطأ في حفظ بيانات المصدر: ${sourceError.message}`);

    // 3. Seed sample questions
    const sampleQuestions = [
      {
        teacher_id: teacherId,
        source_id: sourceData.id,
        text: `احسب مقدار سعة المكثف في الدائرة الكهربية في ${chapterName}:`,
        question_type: 'mcq',
        difficulty: 'medium',
        subject: subject,
        chapter: chapterName,
        grade_level: 'الصف الثالث الثانوي',
        source: sourceName,
        marks: 2,
        needs_review: false,
      },
      {
        teacher_id: teacherId,
        source_id: sourceData.id,
        text: `استنتج العلاقة الرياضية لحساب القوة الدافعة الكهربية المستحثة في ${chapterName}.`,
        question_type: 'essay',
        difficulty: 'hard',
        subject: subject,
        chapter: chapterName,
        grade_level: 'الصف الثالث الثانوي',
        source: sourceName,
        marks: 4,
        needs_review: false,
      },
    ];

    const { data: createdQs, error: qError } = await supabaseAdmin
      .from('questions')
      .insert(sampleQuestions)
      .select();

    if (qError) throw new Error(`خطأ في إضافة الأسئلة: ${qError.message}`);

    if (createdQs && createdQs[0]) {
      await supabaseAdmin.from('question_choices').insert([
        { question_id: createdQs[0].id, choice_code: 'أ', text: '10 ميكروفاراد', is_correct: true, order_index: 0 },
        { question_id: createdQs[0].id, choice_code: 'ب', text: '20 ميكروفاراد', is_correct: false, order_index: 1 },
        { question_id: createdQs[0].id, choice_code: 'ج', text: '30 ميكروفاراد', is_correct: false, order_index: 2 },
        { question_id: createdQs[0].id, choice_code: 'د', text: '40 ميكروفاراد', is_correct: false, order_index: 3 },
      ]);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ غير متوقع' };
  }
}
