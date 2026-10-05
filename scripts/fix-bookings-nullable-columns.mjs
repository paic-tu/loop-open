// ============================================================
// إصلاح جدول bookings: إزالة NOT NULL من الأعمدة القديمة/الاختيارية
// Cause: عمود "service" NOT NULL لكن كود createBooking() لا يملأه
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

    // 1) قائمة الأعمدة التي يجب جعلها NULLABLE (الكود لا يملأها دائماً)
    const nullableCols = [
      // الأعمدة القديمة (Legacy Schema) التي لم يعد الكود يستخدمها
      "service",       // كان مطلوباً قديماً — الآن نستخدم service_category
      "company",       // مكرر entity_name
      "booking_date",  // اختياري — لم يعد يُجبر عليه
      "booking_time",  // اختياري
      "attachment_name", // اختياري (يحفظه الكود القديم فقط)
      "source",        // اختياري
      // الأعمدة الجديدة التي واضح أنها اختيارية
      "phone",         // (قد تكون بالفعل اختيارية، نتأكد)
      "internal_notes",
      "attachment_path",
      "entity_name",
      "service_category",
      "note",
      "assigned_to",
      "closed_at",
      "user_id",
    ];
    console.log(`🛠  إزالة قيد NOT NULL من ${nullableCols.length} عمود...`);
    let changed = 0;
    for (const col of nullableCols) {
      try {
        await client.query(
          `ALTER TABLE public.bookings ALTER COLUMN ${col} DROP NOT NULL;`
        );
        changed++;
        console.log(`   ✅ ${col}`);
      } catch (e) {
        // إذا كان بالفعل DROP NOT NULL فلن يظهر خطأ صارخ
        if (String(e.message).includes("is not nullable")) {
          console.log(`   ℹ️  ${col} كان بالفعل NOT NULL مع قاعدة بيانات أخرى — تخطي`);
        } else if (String(e.message).includes("does not exist")) {
          console.log(`   ℹ️  العمود ${col} غير موجود في الجدول — تخطي`);
        } else {
          console.log(`   ⚠️  ${col}: ${e.message}`);
        }
      }
    }
    console.log(`\n🎉 تم إصلاح ${changed} عمود.\n`);

    // 2) تأكيد: أعمدة NOT NULL المتبقية هي فقط تلك المهمة
    console.log("🔍 أسماء الأعمدة التي لا تزال NOT NULL (يجب أن تكون أساسية):");
    const { rows } = await client.query(`
      SELECT c.column_name FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='bookings'
        AND c.is_nullable='NO'
      ORDER BY c.ordinal_position;
    `);
    for (const r of rows) console.log(`   • NOT NULL: ${r.column_name}`);

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
