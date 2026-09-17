$envLocal = Get-Content .env.local -Raw
$url = ""
$anon = ""
$service = ""
$gemini = ""

if ($envLocal -match 'NEXT_PUBLIC_SUPABASE_URL=(.*)') { $url = $Matches[1].Trim() }
if ($envLocal -match 'NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)') { $anon = $Matches[1].Trim() }
if ($envLocal -match 'SUPABASE_SERVICE_ROLE_KEY=(.*)') { $service = $Matches[1].Trim() }
if ($envLocal -match 'GEMINI_API_KEY=(.*)') { $gemini = $Matches[1].Trim() }

vercel --prod --yes --force -b "NEXT_PUBLIC_SUPABASE_URL=$url" -b "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon" -b "SUPABASE_SERVICE_ROLE_KEY=$service" -b "GEMINI_API_KEY=$gemini" -e "NEXT_PUBLIC_SUPABASE_URL=$url" -e "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon" -e "SUPABASE_SERVICE_ROLE_KEY=$service" -e "GEMINI_API_KEY=$gemini" 2>&1
