import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
  const email = 'admin@examforge.com';
  const password = 'password123';

  console.log(`Creating user ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (authError) {
    if (authError.message.includes("already registered") || authError.message.includes("User already exists")) {
       console.log("User already exists in auth. Let's update the profile.");
       const { data: usersData } = await supabase.auth.admin.listUsers();
       const user = usersData.users.find(u => u.email === email);
       if(user) {
         await updateProfile(user.id);
       }
       return;
    } else {
      console.error("Error creating user:", authError);
      return;
    }
  }

  console.log("User created in Auth. ID:", authData.user.id);
  await updateProfile(authData.user.id);
}

async function updateProfile(userId) {
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: 'admin@examforge.com',
    full_name: 'System Admin',
    role: 'admin'
  });

  if (profileError) {
    console.error("Error creating profile:", profileError);
  } else {
    console.log("Admin profile created successfully!");
    console.log("-------------------------------------------------");
    console.log("Email: admin@examforge.com");
    console.log("Password: password123");
    console.log("-------------------------------------------------");
  }
}

createAdmin();
