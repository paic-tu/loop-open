import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");
const envVars = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const idx = s.indexOf("=");
    if (idx < 0) continue;
    const k = s.slice(0, idx).trim();
    const v = s.slice(idx + 1).trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    envVars[k] = v;
  }
}

const DB_PASSWORD = process.argv[2] || envVars.DB_PASSWORD || "9A182SlQ0Zfo1yRX";

async function runSQL(client, sql) {
  try {
    const res = await client.query(sql);
    console.log(`  ✅ OK (${res.rowCount ?? 0} rows)`);
    return res;
  } catch (e) {
    console.log(`  ⚠️ : ${e.message.split("\n")[0].slice(0, 150)}`);
    return { error: e };
  }
}

async function main() {
  const client = new Client({
    host: envVars.SUPABASE_DIRECT_HOST || "db.berprxhuguniggtnerfq.supabase.co",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
  await client.connect();

  console.log("\n--- 1) Existing user_roles RLS policies ---");
  const pl = await client.query(
    `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
     FROM pg_policies WHERE tablename = 'user_roles'`
  );
  if (pl.rows.length === 0) {
    console.log("  ❌ NO POLICIES FOUND FOR user_roles!");
  } else {
    for (const p of pl.rows) console.log(`  - ${p.policyname} [${p.cmd}] qual=${p.qual ?? "-"}`);
  }

  console.log("\n--- 2) user_roles rows ---");
  const urs = await client.query(
    `SELECT u.email, ur.user_id, ur.role
     FROM public.user_roles ur LEFT JOIN auth.users u ON u.id = ur.user_id
     ORDER BY u.email`
  );
  for (const r of urs.rows) console.log(`  - ${r.email ?? "NULL"}  role=${r.role}`);

  console.log("\n--- 3) Ensure staff role row exists for staff@open-loopsa.com ---");
  const staffQ = await client.query(`SELECT id FROM auth.users WHERE email = 'staff@open-loopsa.com'`);
  if (staffQ.rows.length === 0) {
    console.log("  ❌ staff@open-loopsa.com user does not exist in auth.users");
  } else {
    const staffId = staffQ.rows[0].id;
    const existing = await client.query(`SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role='staff'`, [staffId]);
    if (existing.rows.length > 0) {
      console.log("  ✅ staff role already present");
    } else {
      await runSQL(client, `INSERT INTO public.user_roles (user_id, role) VALUES ('${staffId}', 'staff')`);
      console.log(`  ✅ Inserted staff role for staff@open-loopsa.com (${staffId})`);
    }
    console.log("  Now ensuring staff also has a profile...");
    const profCheck = await client.query(`SELECT 1 FROM public.profiles WHERE id=$1`, [staffId]);
    if (profCheck.rows.length === 0) {
      await runSQL(client, `INSERT INTO public.profiles (id, full_name) VALUES ('${staffId}', 'موظف أوبن لوب')`);
    } else {
      console.log("  ✅ staff profile already exists");
    }
  }

  console.log("\n--- 4) FORCE re-create user_roles RLS SELECT policies (root cause fix) ---");
  await runSQL(client, `ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY`);
  await runSQL(client, `DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles`);
  await runSQL(client, `CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id)`);
  await runSQL(client, `DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles`);
  await runSQL(client, `CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  )`);
  console.log("\n   ✅ user_roles RLS SELF + ADMIN policies recreated with TO authenticated");

  console.log("\n--- 5) Also ensure profiles RLS policy select self exists ---");
  await runSQL(client, `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`);
  await runSQL(client, `DROP POLICY IF EXISTS profiles_select_self ON public.profiles`);
  await runSQL(client, `CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id)`);
  await runSQL(client, `DROP POLICY IF EXISTS profiles_update_self ON public.profiles`);
  await runSQL(client, `CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`);
  await runSQL(client, `DROP POLICY IF EXISTS profiles_insert_self ON public.profiles`);
  await runSQL(client, `CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)`);
  await runSQL(client, `DROP POLICY IF EXISTS profiles_admin_all ON public.profiles`);
  await runSQL(client, `CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )`);
  console.log("\n   ✅ profiles RLS policies recreated");

  console.log("\n--- 6) FINAL user_roles rows (post-fix) ---");
  const urs2 = await client.query(
    `SELECT u.email, ur.user_id, ur.role
     FROM public.user_roles ur LEFT JOIN auth.users u ON u.id = ur.user_id
     ORDER BY u.email`
  );
  for (const r of urs2.rows) console.log(`  - ${r.email ?? "NULL"}  role=${r.role}`);

  await client.end();
  console.log("\n✅✅ Done! Now refresh /admin in browser.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
