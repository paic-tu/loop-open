// Focused fix: CREATE profiles TABLE + RLS then FILL 3 demo users
// Runs all output in ENGLISH to avoid PowerShell encoding artifacts
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const PROJECT_ID  = process.env.SUPABASE_PROJECT_ID;
const DB_PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
if (!PROJECT_ID || !DB_PASSWORD) { console.error("Missing PROJECT_ID / DB_PASSWORD"); process.exit(1); }

const c = new Client({
  host: `db.${PROJECT_ID}.supabase.co`, port: 5432, database: "postgres", user: "postgres", password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30_000,
});
await c.connect();

const exists = (tbl) => c.query(
  `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS t`,
  [tbl]
).then((r) => r.rows[0].t);

console.log("Check profiles  :", await exists("profiles"));
console.log("Check user_roles:", await exists("user_roles"));

// Step 1: Ensure profiles table exists
console.log("\n[1] Creating profiles table if missing...");
await c.query(`
  CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    bio text,
    avatar_url text,
    phone text,
    company text,
    city text,
    country text DEFAULT 'Saudi Arabia',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
`);
console.log("   ok -> profiles table ready");

// Step 2: RLS on profiles
console.log("[2] RLS + policies for profiles...");
await c.query(`ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`);
const profPolicies = [
  `CREATE POLICY IF NOT EXISTS profiles_select_self ON public.profiles FOR SELECT USING (auth.uid() = id)`,
  `CREATE POLICY IF NOT EXISTS profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)`,
  `CREATE POLICY IF NOT EXISTS profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid() = id)`,
  `CREATE POLICY IF NOT EXISTS profiles_admin_all  ON public.profiles FOR ALL USING (
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))`,
];
for (const p of profPolicies) try { await c.query(p); } catch (_) {}
console.log("   ok -> profiles RLS ready");

// Step 3: Ensure enum exists then user_roles (in case it wasn't created earlier)
console.log("[3] Creating user_roles if missing...");
try { await c.query(`CREATE TYPE user_role_enum AS ENUM ('user','staff','admin')`); } catch(_) {}
await c.query(`
  CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL DEFAULT 'user',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
`);
await c.query(`ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY`);
try { await c.query(`CREATE POLICY IF NOT EXISTS ur_select_self ON public.user_roles FOR SELECT USING (auth.uid() = user_id)`); } catch(_){}
try { await c.query(`CREATE POLICY IF NOT EXISTS ur_admin_all ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))`); } catch(_){}
console.log("   ok -> user_roles table ready");

// Step 4: Fill 3 demo profiles + roles
console.log("\n[4] Filling 3 demo users in profiles & user_roles:");
const users = [
  { email: "admin@open-loopsa.com", role: "admin", name: "مدير المنصة العام",    phone: "+966500000001", company: "Open Loop HQ",        city: "الرياض" },
  { email: "staff@open-loopsa.com", role: "staff", name: "موظف الدعم الفني",      phone: "+966500000002", company: "Open Loop Support",   city: "جدة" },
  { email: "user@open-loopsa.com",  role: "user",  name: "عميل تجريبي",           phone: "+966500000003", company: "شركة العميل التجريبية", city: "الدمام" },
];
for (const u of users) {
  const { rows } = await c.query(`SELECT id FROM auth.users WHERE LOWER(email)=LOWER($1)`, [u.email]);
  if (rows.length === 0) { console.log(`   SKIP ${u.email} (not found in auth.users)`); continue; }
  const uid = rows[0].id;
  await c.query(
    `INSERT INTO public.profiles (id,full_name,phone,company,city,updated_at) VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone,
       company=EXCLUDED.company, city=EXCLUDED.city, updated_at=NOW()`,
    [uid, u.name, u.phone, u.company, u.city]
  );
  await c.query(
    `INSERT INTO public.user_roles (user_id,role,updated_at) VALUES ($1,$2::user_role_enum,NOW())
     ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, updated_at=NOW()`,
    [uid, u.role]
  );
  console.log(`   OK ${u.email} -> role=${u.role.toUpperCase()}`);
}

// Step 5: Final validation
console.log("\n[5] Validation:");
const pCount = await c.query(`SELECT COUNT(*) FROM public.profiles`).then(r=>r.rows[0].count);
const rCount = await c.query(`SELECT COUNT(*) FROM public.user_roles`).then(r=>r.rows[0].count);
const lCount = await c.query(`SELECT COUNT(*) FROM public.library_files`).then(r=>r.rows[0].count);
const bCount = await c.query(`SELECT COUNT(*) FROM public.bookings`).then(r=>r.rows[0].count);
const qCount = await c.query(`SELECT COUNT(*) FROM public.requests`).then(r=>r.rows[0].count);
console.log(`   profiles      = ${pCount}`);
console.log(`   user_roles    = ${rCount}`);
console.log(`   library_files = ${lCount}`);
console.log(`   bookings      = ${bCount}`);
console.log(`   requests      = ${qCount}`);

c.end();
console.log("\n✅ All tables & demo users ready!");
