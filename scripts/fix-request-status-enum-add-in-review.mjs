// ============================================================
// إضافة القيمة المفقودة 'in_review' إلى enum request_status_enum
// مع التحقق من عدم وجودها مسبقاً لتجنب أخطاء التكرار
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

    // ⚠️ مهم: ALTER TYPE ADD VALUE لا يمكن تنفيذه داخل DO Block أو Transaction مع غيره
    // لذلك نستخدم أولاً فحصاً برمجياً ثم ننفذ ALTER TYPE خارجياً إن لم توجد القيمة
    console.log("🛠  1) فحص وجود 'in_review' في enum request_status_enum:");
    const { rows: has } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'request_status_enum'
          AND e.enumlabel = 'in_review'
      ) AS ex;
    `);
    const alreadyExists = has[0].ex;
    console.log("   • 'in_review' موجودة؟", alreadyExists ? "نعم (لا حاجة لإضافة)" : "لا (سيتم إضافتها الآن)\n");

    if (!alreadyExists) {
      console.log("🛠  2) إضافة 'in_review' إلى enum request_status_enum (BEFORE 'in_progress'):");
      try {
        await client.query(`
          ALTER TYPE public.request_status_enum
          ADD VALUE IF NOT EXISTS 'in_review' BEFORE 'in_progress';
        `);
        console.log("   ✅ تمت الإضافة بنجاح.\n");
      } catch (alterErr) {
        // بعض إصدارات Postgres القديمة لا تدعم IF NOT EXISTS في ALTER TYPE ADD VALUE
        // في حال فشل نستبدلها بـ ALTER TYPE بدون IF NOT EXISTS ولكن فقط إذا لم توجد
        if (String(alterErr.message).includes("syntax error") && alterErr.message.includes("IF NOT EXISTS")) {
          console.log("   ℹ️ Postgres لا يدعم IF NOT EXISTS في ALTER TYPE ADD VALUE، سنقوم بالإضافة المباشرة...");
          await client.query(`
            ALTER TYPE public.request_status_enum
            ADD VALUE 'in_review' BEFORE 'in_progress';
          `);
          console.log("   ✅ تمت الإضافة بنجاح (بطريقة مباشرة).\n");
        } else {
          throw alterErr;
        }
      }
    }

    // 3) تأكيد أن جميع القيم صحيحة الآن
    console.log("🛠  3) قيم Enum بعد التحديث:");
    const { rows: finalEnum } = await client.query(`
      SELECT e.enumlabel AS val, e.enumsortorder AS ord
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'request_status_enum'
      ORDER BY e.enumsortorder;
    `);
    for (const v of finalEnum) {
      console.log(`   [${v.ord}] "${v.val}"`);
    }

    console.log("\n✅ الانتهاء بنجاح.");
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
