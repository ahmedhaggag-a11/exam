import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DEFAULT_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzcwMjMsImV4cCI6MjEwNTIxMzAyM30.GmcQzdFrMNEnqVeVLUIswp_YN7T6XKtkbDXoZjhWUN0';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

export async function createServerSupabaseClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

export async function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;
  const cookieStore = cookies();

  return createServerClient(
    url,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

