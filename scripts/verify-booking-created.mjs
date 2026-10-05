// ============================================================
// التحقق: هل تم إنشاء صف حجز محمد الغامدي؟
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

    // 1) أحدث 5 صفوف في bookings مرتبة DESC حسب created_at
    console.log("📋 أحدث 5 حجوزات:");
    const { rows } = await client.query(`
      SELECT id, full_name, entity_name, email, phone,
             service_category, status, created_at, is_spam
      FROM public.bookings
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      console.log(`\n   ┌── (${i + 1}) id: ${r.id.slice(0, 8)}`);
      console.log(`   │  الاسم:        ${r.full_name}`);
      console.log(`   │  الجهة:        ${r.entity_name ?? "(بدون)"}`);
      console.log(`   │  البريد:       ${r.email}`);
      console.log(`   │  الجوال:       ${r.phone ?? "(بدون)"}`);
      console.log(`   │  المجال:       ${r.service_category ?? "(بدون)"}`);
      console.log(`   │  الحالة:       ${r.status}`);
      console.log(`   │  is_spam:      ${r.is_spam}`);
      console.log(`   │  أنشئ في:      ${String(r.created_at).slice(0, 30)}`);
      console.log(`   └─────────────`);
    }
    if (rows.length === 0) console.log("   ❌ لا يوجد حجوزات!");

    // 2) أحدث صف يكون هو محمد الغامدي؟
    const last = rows[0];
    console.log("\n🔎 التحقق من نجاح الإرسال:");
    if (last && last.full_name && last.full_name.includes("محمد")) {
      console.log("   ✅ نعم! حجز محمد الغامدي تم حفظه بنجاح ✨");
    } else {
      console.log("   ⚠️  لم يظهر محمد في أول 5 صفوف - ربما هناك خطأ لم يلتقطه المتصفح!");
    }

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
