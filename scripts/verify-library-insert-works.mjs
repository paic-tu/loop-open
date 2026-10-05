// ============================================================
// التحقق النهائي: إدراج ملف في library_files مع تعبئة created_by
// هذا يعادل بالضبط ما يفعله createOrUpdateLibraryFile() بعد إصلاح العمود
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

    // 1) إيجاد uuid للمستخدم admin (الذي يقوم بالحفظ)
    const adminQ = await client.query(
      `SELECT id FROM auth.users WHERE email='admin@open-loopsa.com' LIMIT 1;`
    );
    const adminId = adminQ.rows[0].id;
    console.log(`👤 المستخدم الحالي (مدير): ${adminId.slice(0, 8)}...\n`);

    // 2) محاولة الإدراج مع تعبئة created_by (الشيء الذي كان يفشل قبل الإصلاح)
    console.log("🛠  محاولة إدراج صف جديد في library_files مع created_by...");
    const insertSql = `
      INSERT INTO public.library_files
        (title, description, category, icon, file_name, file_path,
         mime_type, file_size_bytes, sort_order, is_public, created_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, category, created_by, created_at;
    `;
    const values = [
      "دليل تجريبي - اختبار إضافة عمود created_by",
      "هذا دليل تجريبي للتأكد من أن الإضافة تعمل في قاعدة البيانات بعد إضافة عمود created_by.",
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
    const newFile = rows[0];
    console.log(`
  ✅ تم الإدراج بنجاح! 🎉
     ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
    • id:          ${newFile.id.slice(0, 8)}...
    • العنوان:     ${newFile.title}
    • التصنيف:     ${newFile.category}
    • created_by:  ${String(newFile.created_by).slice(0, 8)}... (تم تعبئته بنجاح!)
    • الأنشئ في:   ${String(newFile.created_at).slice(0, 30)}
    ___________________________________
`);

    // 3) التأكد من ظهور الصف في استعلام المكتبة العام
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM public.library_files WHERE created_by=$1;`,
      [adminId]
    );
    console.log(`🔢 عدد الملفات التي أنشأها المدير في المكتبة: ${countRes.rows[0].c}`);

    // 4) تنظيف (حذف الملف التجريبي حتى لا يظهر للمستخدم) — اختياري
    // لا نحذفه فعلاً حتى نراه في الجدول للتأكد.
    process.exit(0);
  } catch (e) {
    if (String(e.message).includes("library_files_created_by_fkey")) {
      console.error("❌ FOREIGN KEY VIOLATION:", e.message);
    } else {
      console.error("❌ DB ERROR:", e.message || e);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
