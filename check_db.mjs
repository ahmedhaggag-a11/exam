import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://amfisynpwpftzvtatpso.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: s, error: se } = await sb.from('sources').select('*').limit(1);
if (se) console.log('sources error:', se.message);
else console.log('sources columns:', s && s[0] ? Object.keys(s[0]) : 'empty table');

const { data: q, error: qe } = await sb.from('questions').select('*').limit(1);
if (qe) console.log('questions error:', qe.message);
else console.log('questions columns:', q && q[0] ? Object.keys(q[0]) : 'empty table');
