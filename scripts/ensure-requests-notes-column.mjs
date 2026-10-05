// ============================================================
// تشخيص + إضافة الأعمدة المفقودة في جدول requests (internal_notes, updated_at)
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

    // 1) طباعة الأعمدة الحالية في جدول requests
    console.log("📋 1) الأعمدة الحالية في public.requests:");
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='requests'
      ORDER BY ordinal_position
    `);
    const colMap = {};
    cols.rows.forEach((r) => {
      colMap[r.column_name] = r;
      console.log(
        `   • ${r.column_name.padEnd(20)} | ${r.data_type.padEnd(15)} | nullable: ${r.is_nullable} | default: ${r.column_default ?? "—"}`
      );
    });

    // 2) إضافة الأعمدة المفقودة
    console.log("\n🛠  2) إضافة الأعمدة المفقودة إن وجدت:");

    // internal_notes (text)
    if (!colMap["internal_notes"]) {
      await client.query(
        "ALTER TABLE public.requests ADD COLUMN internal_notes text"
      );
      console.log("   ✅ internal_notes أضيف");
    } else {
      console.log("   ✅ internal_notes موجود فعلاً");
    }

    // updated_at (timestamptz)
    if (!colMap["updated_at"]) {
      await client.query(
        "ALTER TABLE public.requests ADD COLUMN updated_at timestamptz DEFAULT NOW()"
      );
      console.log("   ✅ updated_at أضيف");
    } else {
      console.log("   ✅ updated_at موجود فعلاً");
    }

    // 3) إنشاء trigger لتحديث updated_at تلقائياً عند كل UPDATE
    console.log("\n⚙️  3) إنشاء trigger تحديث updated_at تلقائياً:");
    const triggerExists = await client.query(`
      SELECT 1 FROM pg_trigger WHERE tgname = 'requests_set_updated_at'
    `);
    if (triggerExists.rowCount === 0) {
      await client.query(`
        CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

        CREATE TRIGGER requests_set_updated_at
        BEFORE UPDATE ON public.requests
        FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
      `);
      console.log("   ✅ trigger requests_set_updated_at أنشئ");
    } else {
      console.log("   ✅ trigger موجود فعلاً");
    }

    // 4) طباعة السجل الأخير في requests للتأكد من أن كل شيء يعمل
    console.log("\n🗂  4) آخر طلب مسجل في قاعدة البيانات:");
    const last = await client.query(`
      SELECT id, type, title, status, created_at, internal_notes
      FROM public.requests ORDER BY created_at DESC LIMIT 1
    `);
    if (last.rows.length > 0) {
      const r = last.rows[0];
      console.log(`   • ID      : ${r.id.slice(0, 12)}…`);
      console.log(`   • type    : ${r.type}`);
      console.log(`   • title   : ${r.title ?? "—"}`);
      console.log(`   • status  : ${r.status}`);
      console.log(`   • notes   : ${r.internal_notes ?? "لا توجد ملاحظات"}`);
      console.log(`   • created : ${r.created_at}`);
    } else {
      console.log("   لا توجد طلبات بعد.");
    }

    console.log("\n✅ انتهى التنفيذ بنجاح");
  } catch (e) {
    console.error("❌ خطأ:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void run();
