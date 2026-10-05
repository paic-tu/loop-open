// ============================================================
// التحقق النهائي: هل تم حفظ الحالة "in_review" على الطلب #b124015c؟
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

    console.log("🛠  حالة الطلب #b124015c (الذي غيّرناه إلى قيد المراجعة):");
    const { rows } = await client.query(`
      SELECT id, status, created_at, updated_at, closed_at
      FROM public.requests
      WHERE id::text LIKE 'b124015c%'
      ORDER BY created_at DESC
      LIMIT 3;
    `);
    for (const r of rows) {
      console.log(`   • id: ${r.id.slice(0, 8)}`);
      console.log(`   • status: "${r.status}"  ←  ✅ يجب أن يكون in_review`);
      console.log(`   • created_at: ${r.created_at}`);
      console.log(`   • updated_at: ${r.updated_at}`);
      console.log(`   • closed_at: ${r.closed_at ?? "null (صحيح — قيد المراجعة لا يغلق الطلب)"}`);
    }

    console.log("\n🛠  قيم enum request_status_enum الكاملة الآن:");
    const { rows: en } = await client.query(`
      SELECT e.enumlabel AS val, e.enumsortorder AS ord
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'request_status_enum'
      ORDER BY e.enumsortorder;
    `);
    for (const v of en) console.log(`   [${v.ord}] "${v.val}"`);

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
