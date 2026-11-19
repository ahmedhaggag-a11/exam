// Apply SQL migration via Supabase pg direct
// Use the pg connection string approach with the REST API
const projectRef = 'amfisynpwpftzvtatpso';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZmlzeW5wd3BmdHp2dGF0cHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYzNzAyMywiZXhwIjoyMTA1MjEzMDIzfQ.CR05yi8YZTXaTDEvJiYbLqNaBt3sAh7pUDiMzI-NdAY';

// Create the helper function first to allow running SQL
const createFn = `
CREATE OR REPLACE FUNCTION public.run_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;
`;

// Use pg REST endpoint with service role 
// The /pg endpoint exists on Supabase - try running via postgres-meta
const headers = {
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

// Try postgres-meta API
const urls = [
  `https://${projectRef}.supabase.co/pg/query`,
  `https://${projectRef}.supabase.co/rest/v1/rpc/pg_query`,
];

for (const url of urls) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'SELECT 1' }),
  });
  console.log(url, res.status, await res.text().then(t => t.substring(0, 100)));
}
