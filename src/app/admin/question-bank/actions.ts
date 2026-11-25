'use server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Upload a base64 image and update the question's image_urls in the DB.
 * Returns the new public URL or null on error.
 */
export async function updateQuestionImageAction(
  questionId: string,
  teacherId: string,
  base64Data: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // 1. Detect format and strip data URI prefix
    const isPng = base64Data.startsWith('data:image/png');
    const ext = isPng ? 'png' : 'jpg';
    const contentType = isPng ? 'image/png' : 'image/jpeg';
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    const fileName = `images/${teacherId}/recrop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // 2. Upload to Supabase storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    // 3. Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('pdfs').getPublicUrl(fileName);
    const newUrl = urlData.publicUrl;

    // 4. Update question in DB - prepend new URL (keep old ones as fallback)
    const { data: qData, error: qErr } = await supabaseAdmin
      .from('questions')
      .select('image_urls')
      .eq('id', questionId)
      .single();

    if (qErr) throw new Error(qErr.message);

    const existingUrls: string[] = qData?.image_urls || [];
    // Put the new crop first, keep old ones after
    const updatedUrls = [newUrl, ...existingUrls.filter((u: string) => u !== newUrl)];

    const { error: updateErr } = await supabaseAdmin
      .from('questions')
      .update({ image_urls: updatedUrls })
      .eq('id', questionId);

    if (updateErr) throw new Error(updateErr.message);

    return { success: true, url: newUrl };
  } catch (err: any) {
    console.error('updateQuestionImageAction error:', err);
    return { success: false, error: err.message || 'خطأ أثناء رفع الصورة' };
  }
}

/**
 * Get the PDF storage URL for a source (to load in the browser for re-crop).
 */
export async function getSourcePdfUrlAction(
  sourceId: string
): Promise<{ success: boolean; url?: string; storagePath?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sources')
      .select('storage_path, file_url')
      .eq('id', sourceId)
      .single();

    if (error || !data) throw new Error(error?.message || 'المصدر غير موجود');

    // Try to get a signed URL (60 min expiry) or public URL for the PDF
    if (data.storage_path) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('pdfs')
        .createSignedUrl(data.storage_path, 3600);

      if (!signErr && signed?.signedUrl) {
        return { success: true, url: signed.signedUrl, storagePath: data.storage_path };
      }

      const { data: pubData } = supabaseAdmin.storage
        .from('pdfs')
        .getPublicUrl(data.storage_path);
      if (pubData?.publicUrl) {
        return { success: true, url: pubData.publicUrl, storagePath: data.storage_path };
      }
    }

    // Fallback to file_url if exists
    if (data.file_url) {
      return { success: true, url: data.file_url, storagePath: data.storage_path };
    }

    return { success: false, error: 'ملف PDF غير متاح في التخزين. يرجى رفع الملف مرة أخرى.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove/Clear all images from a question (e.g. if an image was mistakenly attached to a text-only question).
 */
export async function removeQuestionImageAction(
  questionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: updateErr } = await supabaseAdmin
      .from('questions')
      .update({ image_urls: [] })
      .eq('id', questionId);

    if (updateErr) throw new Error(updateErr.message);
    return { success: true };
  } catch (err: any) {
    console.error('removeQuestionImageAction error:', err);
    return { success: false, error: err.message || 'خطأ أثناء حذف الصورة' };
  }
}

/**
 * Move a question to a different chapter / lesson (and optionally grade_level / term).
 */
export async function moveQuestionLessonAction(
  questionId: string,
  data: {
    chapter: string;
    lesson?: string | null;
    grade_level?: string | null;
    term?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!questionId) throw new Error('معرف السؤال مفقود');
    if (!data.chapter || !data.chapter.trim()) throw new Error('يجب تحديد اسم الفصل / الباب');

    const updatePayload: Record<string, any> = {
      chapter: data.chapter.trim(),
      lesson: data.lesson && data.lesson.trim() ? data.lesson.trim() : null,
    };

    if (data.grade_level !== undefined && data.grade_level !== null) {
      updatePayload.grade_level = data.grade_level;
    }
    if (data.term !== undefined && data.term !== null) {
      updatePayload.term = data.term;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('questions')
      .update(updatePayload)
      .eq('id', questionId);

    if (updateErr) throw new Error(updateErr.message);

    return { success: true };
  } catch (err: any) {
    console.error('moveQuestionLessonAction error:', err);
    return { success: false, error: err.message || 'خطأ أثناء نقل السؤال للدرس الآخر' };
  }
}

/**
 * Update the answer of a question (MCQ choices/correct, Essay model answer, True/False answer).
 */
export async function updateQuestionAnswerAction(payload: {
  questionId: string;
  questionText?: string;
  questionType: 'mcq' | 'essay' | 'true_false';
  modelAnswer?: string | null;
  trueFalseAnswer?: 'صح' | 'خطأ';
  choices?: Array<{
    id?: string;
    choice_code: string;
    text: string;
    is_correct: boolean;
    order_index: number;
  }>;
}): Promise<{ success: boolean; error?: string; question?: any }> {
  try {
    const { questionId, questionText, questionType, modelAnswer, trueFalseAnswer, choices } = payload;
    if (!questionId) throw new Error('معرف السؤال مفقود');

    // 1. Prepare questions table updates
    const questionUpdates: Record<string, any> = {};
    if (questionText !== undefined) {
      questionUpdates.text = questionText.trim();
    }

    if (questionType === 'essay') {
      questionUpdates.model_answer = modelAnswer && modelAnswer.trim() ? modelAnswer.trim() : null;
    } else if (questionType === 'true_false') {
      const tfVal = trueFalseAnswer === 'خطأ' ? 'خطأ' : 'صح';
      questionUpdates.model_answer = tfVal;

      // Also ensure choices for true_false are synced
      const { data: existingChoices } = await supabaseAdmin
        .from('question_choices')
        .select('id, choice_code, text, is_correct, order_index')
        .eq('question_id', questionId)
        .order('order_index');

      if (existingChoices && existingChoices.length >= 2) {
        // Update existing choices
        for (const ec of existingChoices) {
          const isCorrect = tfVal === 'صح' 
            ? (ec.text.includes('صح') || ec.text.includes('صواب') || ec.choice_code === 'أ' || ec.order_index === 0)
            : (ec.text.includes('خطأ') || ec.choice_code === 'ب' || ec.order_index === 1);
          await supabaseAdmin
            .from('question_choices')
            .update({ is_correct: isCorrect })
            .eq('id', ec.id);
        }
      } else {
        // If no choices existed, create 2 standard choices for True/False
        if (existingChoices && existingChoices.length > 0) {
          await supabaseAdmin.from('question_choices').delete().eq('question_id', questionId);
        }
        await supabaseAdmin.from('question_choices').insert([
          {
            question_id: questionId,
            choice_code: 'أ',
            text: 'صح',
            is_correct: tfVal === 'صح',
            order_index: 0,
          },
          {
            question_id: questionId,
            choice_code: 'ب',
            text: 'خطأ',
            is_correct: tfVal === 'خطأ',
            order_index: 1,
          },
        ]);
      }
    } else if (questionType === 'mcq') {
      if (choices && choices.length > 0) {
        const correctChoice = choices.find((c) => c.is_correct);
        if (correctChoice) {
          questionUpdates.model_answer = `${correctChoice.choice_code}. ${correctChoice.text}`.trim();
        }

        // Fetch existing choices from DB
        const { data: existingChoices } = await supabaseAdmin
          .from('question_choices')
          .select('id')
          .eq('question_id', questionId);

        const existingIds = (existingChoices || []).map((c) => c.id);
        const incomingIds = choices.filter((c) => c.id).map((c) => c.id!);

        // Delete removed choices
        const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
          await supabaseAdmin.from('question_choices').delete().in('id', idsToDelete);
        }

        // Update or Insert choices
        for (let i = 0; i < choices.length; i++) {
          const c = choices[i];
          const choicePayload = {
            question_id: questionId,
            choice_code: c.choice_code || ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][i] || `${i + 1}`,
            text: c.text.trim(),
            is_correct: Boolean(c.is_correct),
            order_index: i,
          };

          if (c.id && existingIds.includes(c.id)) {
            const { error: updErr } = await supabaseAdmin
              .from('question_choices')
              .update(choicePayload)
              .eq('id', c.id);
            if (updErr) throw new Error(updErr.message);
          } else {
            const { error: insErr } = await supabaseAdmin
              .from('question_choices')
              .insert(choicePayload);
            if (insErr) throw new Error(insErr.message);
          }
        }
      }
    }

    // Update questions table
    if (Object.keys(questionUpdates).length > 0) {
      const { error: qUpdErr } = await supabaseAdmin
        .from('questions')
        .update(questionUpdates)
        .eq('id', questionId);

      if (qUpdErr) throw new Error(qUpdErr.message);
    }

    // Fetch full updated question to return
    const { data: updatedQuestion, error: fetchErr } = await supabaseAdmin
      .from('questions')
      .select('*, choices:question_choices(*)')
      .eq('id', questionId)
      .single();

    if (fetchErr) throw new Error(fetchErr.message);

    return { success: true, question: updatedQuestion };
  } catch (err: any) {
    console.error('updateQuestionAnswerAction error:', err);
    return { success: false, error: err.message || 'خطأ أثناء تحديث إجابة السؤال' };
  }
}

/**
 * Check if a pre-rendered single page image exists in cloud storage (`pages/{sourceId}/page_{pageNumber}.jpg`)
 * and return its signed/public URL.
 */
export async function getSourcePageImageUrlAction(
  sourceId: string,
  pageNumber: number
): Promise<{ success: boolean; url?: string }> {
  try {
    if (!sourceId || !pageNumber || pageNumber < 1) {
      return { success: false };
    }

    const folder = `pages/${sourceId}`;
    const fileName = `page_${pageNumber}.jpg`;
    const fullPath = `${folder}/${fileName}`;

    // Verify existence via list
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('pdfs')
      .list(folder, { search: fileName, limit: 5 });

    if (listErr || !files || !files.some((f) => f.name === fileName)) {
      return { success: false };
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('pdfs')
      .createSignedUrl(fullPath, 3600);

    if (!signErr && signed?.signedUrl) {
      return { success: true, url: signed.signedUrl };
    }

    const { data: pubData } = supabaseAdmin.storage.from('pdfs').getPublicUrl(fullPath);
    if (pubData?.publicUrl) {
      return { success: true, url: pubData.publicUrl };
    }

    return { success: false };
  } catch (err) {
    return { success: false };
  }
}

/**
 * Cache a single rendered page JPEG to cloud storage (`pages/{sourceId}/page_{pageNumber}.jpg`)
 * so future recrops on any device open this page instantaneously.
 */
export async function uploadSourcePageImageAction(
  sourceId: string,
  pageNumber: number,
  base64Data: string
): Promise<{ success: boolean }> {
  try {
    if (!sourceId || !pageNumber || !base64Data) return { success: false };

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const storagePath = `pages/${sourceId}/page_${pageNumber}.jpg`;

    const { error } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: true,
      });

    return { success: !error };
  } catch (err) {
    return { success: false };
  }
}


