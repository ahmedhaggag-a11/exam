'use server';

import { createClient } from '@supabase/supabase-js';
import { ExamPaperConfig, DEFAULT_PAPER_CONFIG } from '@/types/paper-config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amfisynpwpftzvtatpso.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Load config for a specific teacher or the default global config
export async function getPaperTemplateConfig(teacherId?: string): Promise<ExamPaperConfig> {
  try {
    // 1. Try to fetch teacher-specific custom template first
    if (teacherId) {
      const { data: teacherFile, error: tErr } = await supabaseAdmin.storage
        .from('pdfs')
        .download(`templates/teacher_${teacherId}.json`);

      if (!tErr && teacherFile) {
        const text = await teacherFile.text();
        const parsed = JSON.parse(text);
        return { ...DEFAULT_PAPER_CONFIG, ...parsed };
      }
    }

    // 2. Try to fetch global template configured by Admin
    const { data: globalFile, error: gErr } = await supabaseAdmin.storage
      .from('pdfs')
      .download('templates/global_default.json');

    if (!gErr && globalFile) {
      const text = await globalFile.text();
      const parsed = JSON.parse(text);
      return { ...DEFAULT_PAPER_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Could not read saved paper config, using default:', err);
  }

  return DEFAULT_PAPER_CONFIG;
}

// Save config for global default (Admin) or a specific teacher
export async function savePaperTemplateConfig(config: ExamPaperConfig, teacherId?: string) {
  try {
    const filename = teacherId ? `templates/teacher_${teacherId}.json` : 'templates/global_default.json';
    const payload = JSON.stringify(config, null, 2);
    const buffer = Buffer.from(payload, 'utf-8');

    const { error } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(filename, buffer, {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Save paper config error:', err);
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ القالب' };
  }
}

// Fetch list of all teachers to allow Admin to customize individual teacher configs
export async function getTeachersListForAdmin() {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, subjects, grades')
      .eq('role', 'teacher')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return { success: true, teachers: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, teachers: [] };
  }
}
