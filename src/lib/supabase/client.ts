import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzcwMjMsImV4cCI6MjEwNTIxMzAyM30.GmcQzdFrMNEnqVeVLUIswp_YN7T6XKtkbDXoZjhWUN0';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  return createBrowserClient(url, key);
}

