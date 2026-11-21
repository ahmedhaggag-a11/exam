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
    // 1. Remove data URI prefix
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    const fileName = `images/${teacherId}/recrop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;

    // 2. Upload to Supabase storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
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
