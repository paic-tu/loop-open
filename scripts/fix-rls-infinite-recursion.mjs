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

async function runSQL(client, label, sql) {
  try {
    const res = await client.query(sql);
    console.log(`  ✅ ${label}  (rows ${res.rowCount ?? 0})`);
    return res;
  } catch (e) {
    console.log(`  ⚠️  ${label}: ${e.message.split("\n")[0].slice(0, 200)}`);
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

  console.log("\n🚑 === إصلاح حلقة لا نهائية في سياسات user_roles + تحسين جميع السياسات ===");

  console.log("\n1) إزالة السياسة الانتحارية user_roles_admin_all التي تشير لنفسها:");
  await runSQL(client, "DROP user_roles_admin_all (self-referencing infinite recursion)", `
    DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles
  `);

  console.log("\n2) إعادة بناء سياسة user_roles_select_self بشكل بسيط بدون TO صريح:");
  await runSQL(client, "ALTER ENABLE RLS", `ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY`);
  await runSQL(client, "DROP old user_roles_select_self", `DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles`);
  await runSQL(client, "CREATE user_roles_select_self (simple, no recursion possible)", `
    CREATE POLICY user_roles_select_self ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id)
  `);

  console.log("\n3) تحسين جميع السياسات الأخرى التي تستخدم user_roles عبر صياغة أفضل (تجنباً لأي مشاكل مستقبلية):");
  const tablePolicyFixes = [
    {
      name: "profiles",
      drop: ["profiles_select_self", "profiles_update_self", "profiles_insert_self", "profiles_admin_all"],
      policies: [
        `CREATE POLICY profiles_select_self ON public.profiles FOR SELECT USING (auth.uid() = id)`,
        `CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`,
        `CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)`,
        `CREATE POLICY profiles_admin_all ON public.profiles FOR ALL USING (
          EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        )`,
      ],
    },
  ];

  for (const fix of tablePolicyFixes) {
    console.log(`  — ${fix.name}:`);
    await runSQL(client, `ALTER ${fix.name} ENABLE RLS`, `ALTER TABLE public.${fix.name} ENABLE ROW LEVEL SECURITY`);
    for (const pol of fix.drop) {
      await runSQL(client, `DROP ${fix.name}.${pol}`, `DROP POLICY IF EXISTS ${pol} ON public.${fix.name}`);
    }
    for (const pol of fix.policies) {
      await runSQL(client, `CREATE policy on ${fix.name}`, pol);
    }
  }

  console.log("\n✅ الإصلاح. الآن اختبار الاستعلام عن الأدوار:");
  const test = await client.query(`
    SELECT u.email, ur.role
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    ORDER BY u.email
  `);
  for (const r of test.rows) console.log(`  — ${r.email}: role=${r.role ?? "<null>"}`);

  await client.end();
  console.log("\n🎉🎉🎉 الإصلاح انتهى! الآن أعد تحميل المتصفح");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
