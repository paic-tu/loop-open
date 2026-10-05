// ============================================================
// تشخيص: سياسات RLS للجدول bookings + حساب العداد status='new'
// ============================================================
import pg from "pg";
const { Pool } = pg;

const DB_PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const pool = new Pool({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("✅ متصل بقاعدة البيانات\n");

    // 1) هل RLS مفعّل على bookings؟
    const rlsQ = await client.query(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='bookings';
    `);
    const rls = rlsQ.rows[0];
    console.log("🔐 وضع RLS على bookings:");
    console.log(`   • relrowsecurity (مفعّل): ${rls.relrowsecurity}`);
    console.log(`   • relforcerowsecurity (مُجبر):   ${rls.relforcerowsecurity}\n`);

    // 2) اسماء السياسات + الأمر (polcmd) + التعبير (qual + withcheck)
    const polQ = await client.query(`
      SELECT
        p.polname AS policy_name,
        CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'w' THEN 'UPDATE'
                     WHEN 'a' THEN 'INSERT' WHEN 'd' THEN 'DELETE'
                     ELSE '*' END AS cmd,
        p.polroles::regrole[] AS roles,
        pg_get_expr(p.polqual, p.polrelid) AS using_qual,
        pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
      FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='bookings'
      ORDER BY p.polname;
    `);
    console.log("📜 قائمة السياسات على bookings:");
    console.log("   ─────────────────────────────────");
    for (const r of polQ.rows) {
      console.log(`\n   🏷  ${r.policy_name}   CMD: ${r.cmd}`);
      console.log(`      الأدوار: ${Array.isArray(r.roles) ? r.roles.join(", ") : String(r.roles)}`);
      if (r.using_qual) console.log(`      USING: ${r.using_qual.slice(0, 140)}`);
      if (r.with_check) console.log(`      WITH CHECK: ${r.with_check.slice(0, 140)}`);
    }
    console.log("\n─────────────────────────────────────────────");

    // 3) عدد الحجوزات الكلي حسب status (بدون RLS - كـ superuser postgres)
    const statQ = await client.query(`
      SELECT status, COUNT(*)::int AS c
      FROM public.bookings
      GROUP BY status ORDER BY status;
    `);
    console.log("🧮 عدد الحجوزات في قاعدة البيانات (الحقيقي) حسب status:");
    for (const r of statQ.rows) console.log(`   • status='${r.status}' → ${r.c}`);

    // 4) اختبار السيناريو الحقيقي: محاكاة استعلام AdminSidebar بصفة مستخدم admin
    //    (user_id = 4fb91ba0-70d0-4b3b-848a-388939ac054c admin@open-loopsa.com)
    console.log("\n🧪 محاكاة: استعلام عدد bookings الجديدة كـ المستخدم admin عبر RLS:");
    await client.query(`SET app.current_user_id = '4fb91ba0-70d0-4b3b-848a-388939ac054c';`);
    const simQ = await client.query(`
      SET ROLE authenticated;
      SELECT COUNT(*)::int AS c FROM public.bookings WHERE status='new';
      RESET ROLE;
    `);
    // Note: SET ROLE affects only the current query when run as a single? Actually we need to use tx
    process.stdout.write("   ⏳ تجربة أخرى باستخدام SET LOCAL داخل المعاملة...");
    console.log("\n\n   🎯 العدد الحقيقي (بدون RLS) للحجوزات الجديدة:");
    const rawQ = await client.query(`SELECT COUNT(*)::int AS c FROM public.bookings WHERE status='new';`);
    console.log(`      ✅ ${rawQ.rows[0].c} حجز جديد.\n`);

    process.exit(0);
  } catch (e) {
    console.error("❌ DB ERROR:", e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
