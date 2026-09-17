'use server';

import { createClient } from '@supabase/supabase-js';

// Use the service role key to bypass RLS and email confirmation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

export async function createTeacherAccount(data: {
  email: string;
  password: string;
  fullName: string;
  subjects: string[];
  grades: string[];
}) {
  try {
    // 1. Create the user in Auth, automatically confirming their email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // This is the magic!
      user_metadata: {
        full_name: data.fullName,
        role: 'teacher'
      }
    });

    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('فشل الحصول على معرف الحساب التلقائي');

    // 2. Insert into the profiles table
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      role: 'teacher',
      subjects: data.subjects,
      grades: data.grades,
    });

    if (profileError) throw profileError;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
