// ============================================================
// إعادة اختبار: إدراج ملف في library_files مع أسماء الأعمدة الصحيحة (من library.ts)
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

    const adminQ = await client.query(
      `SELECT id FROM auth.users WHERE email='admin@open-loopsa.com' LIMIT 1;`
    );
    const adminId = adminQ.rows[0].id;
    console.log(`👤 المستخدم (مدير): ${adminId.slice(0, 8)}...\n`);

    console.log("🛠  محاولة إدراج ملف تجريبي في library_files...");
    const insertSql = `
      INSERT INTO public.library_files
        (title, description, category, icon_name, file_name, file_path,
         mime_type, file_size, sort_order, is_published, created_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      "دليل تجريبي - اختبار إضافة عمود created_by",
      "هذا دليل تجريبي للتأكد من أن إضافة ملف تعمل الآن بعد إصلاح الأعمدة.",
      "templates",
      "FileText",
      "dummy-test-guide.pdf",
      "library/9999-dummy-test-guide.pdf",
      "application/pdf",
      1024,
      99,
      true,
      adminId,
    ];
    const { rows } = await client.query(insertSql, values);
    const f = rows[0];
    console.log(`
🎉 ✅ تم الإدراج بنجاح! الحل يعمل 100%!
   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
    • id:              ${f.id.slice(0, 10)}...
    • title:           ${f.title}
    • category:        ${f.category}
    • icon_name:       ${f.icon_name}
    • created_by:      ${String(f.created_by).slice(0, 10)}... ✅ (موجود!)
    • created_at:      ${String(f.created_at).slice(0, 30)}
    • is_published:    ${f.is_published}
    ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
`);

    // هام: نحذف الملف التجريبي حتى لا يظهر للمستخدم في جدول المكتبة
    await client.query(`DELETE FROM public.library_files WHERE id=$1;`, [f.id]);
    console.log("🧹 تم حذف الملف التجريبي نظيفاً بعد الاختبار.\n");
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
