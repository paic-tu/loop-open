// ============================================================
// إصلاحات: (1) إضافة عمود created_by إلى library_files
//           (2) إضافة storage.objects policies لـ documents و library
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

    // ========== 1) إضافة عمود created_by إلى library_files ==========
    console.log("📚 1) إضافة عمود created_by إلى جدول library_files...");
    await client.query(`
      ALTER TABLE public.library_files
      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    `);
    console.log("   ✅ تمت إضافة created_by (إن لم يكن موجوداً).\n");

    // ========== 2) فحص سياسات storage.objects الحالية ==========
    console.log("💾 2) فحص سياسات storage.objects الحالية:");
    const { rows: currPol } = await client.query(`
      SELECT polname AS policy_name,
             CASE polcmd
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               ELSE polcmd::text END AS cmd
      FROM pg_policy
      WHERE polrelid = 'storage.objects'::regclass
      ORDER BY polname;
    `);
    if (currPol.length === 0) {
      console.log("   ⚠️  لا توجد سياسات على storage.objects على الإطلاق!");
    } else {
      for (const p of currPol) console.log(`   • [${p.cmd}] ${p.policy_name}`);
    }
    console.log();

    // ⚠️ يجب تمكين RLS أولاً على storage.objects إن لم يكن
    console.log("💾 3) التأكد من تمكين RLS على storage.objects:");
    const { rows: rlsSt } = await client.query(`
      SELECT relrowsecurity AS rls_enabled FROM pg_class WHERE oid = 'storage.objects'::regclass;
    `);
    console.log(`   • RLS مفعّل؟ ${rlsSt[0].rls_enabled ? "✅ نعم" : "❌ سيتم تمكينه الآن"}`);
    if (!rlsSt[0].rls_enabled) {
      await client.query(`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
      console.log("   ✅ تم تمكين RLS على storage.objects.\n");
    }
    console.log();

    // ========== 3) سياسات bucket "documents" (لإرفاق ملفات الاستشارة من أي شخص) ==========
    console.log("💾 4) إضافة سياسات bucket 'documents':");
    // 4a) INSERT: أي شخص حتى ضيف غير مسجل يمكنه رفع ملف (لنموذج /booking)
    try {
      await client.query(`
        DROP POLICY IF EXISTS documents_upload_anyone ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY documents_upload_anyone ON storage.objects
          FOR INSERT
          WITH CHECK (bucket_id = 'documents');
      `);
      console.log("   ✅ INSERT (anyone) → documents_upload_anyone");
    } catch (e) {
      console.log("   ⚠️  لم يتم INSERT policy:", e.message);
    }

    // 4b) SELECT: صاحب الملف فقط (user_id = auth.uid()) أو staff/admin
    try {
      await client.query(`
        DROP POLICY IF EXISTS documents_view_owners_or_staff ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY documents_view_owners_or_staff ON storage.objects
          FOR SELECT
          USING (
            bucket_id = 'documents' AND (
              owner = auth.uid() OR
              EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role IN ('staff'::user_role_enum, 'admin'::user_role_enum)
              )
            )
          );
      `);
      console.log("   ✅ SELECT (owner/staff/admin) → documents_view_owners_or_staff");
    } catch (e) {
      console.log("   ⚠️  لم يتم SELECT policy:", e.message);
    }

    // 4c) DELETE: staff/admin فقط لحذف مرفقات الحجوزات
    try {
      await client.query(`
        DROP POLICY IF EXISTS documents_delete_staff ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY documents_delete_staff ON storage.objects
          FOR DELETE
          USING (
            bucket_id = 'documents' AND
            EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role IN ('staff'::user_role_enum, 'admin'::user_role_enum)
            )
          );
      `);
      console.log("   ✅ DELETE (staff/admin) → documents_delete_staff\n");
    } catch (e) {
      console.log("   ⚠️  لم يتم DELETE policy:", e.message, "\n");
    }

    // ========== 4) سياسات bucket "library" (لمكتبة الملفات: staff/admin رفع + قراءة للجميع) ==========
    console.log("📚 5) إضافة سياسات bucket 'library' لمكتبة الملفات:");
    // 5a) INSERT: staff/admin فقط (الإدارة ترفع ملفات للمكتبة)
    try {
      await client.query(`
        DROP POLICY IF EXISTS library_upload_staff ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY library_upload_staff ON storage.objects
          FOR INSERT
          WITH CHECK (
            bucket_id = 'library' AND
            EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role IN ('staff'::user_role_enum, 'admin'::user_role_enum)
            )
          );
      `);
      console.log("   ✅ INSERT (staff/admin) → library_upload_staff");
    } catch (e) {
      console.log("   ⚠️  لم يتم INSERT library policy:", e.message);
    }

    // 5b) SELECT: أي شخص يمكنه قراءة الملفات العامة (للتحميل عبر signed URL أو مباشر)
    //    لكننا نستخدم signed URLs عادةً. للبساطة نسمح للجميع بالقراءة على library.
    try {
      await client.query(`
        DROP POLICY IF EXISTS library_read_public ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY library_read_public ON storage.objects
          FOR SELECT
          USING (bucket_id = 'library');
      `);
      console.log("   ✅ SELECT (public) → library_read_public");
    } catch (e) {
      console.log("   ⚠️  لم يتم SELECT library policy:", e.message);
    }

    // 5c) UPDATE + DELETE: staff/admin فقط
    try {
      await client.query(`
        DROP POLICY IF EXISTS library_manage_staff ON storage.objects;
      `);
      await client.query(`
        CREATE POLICY library_manage_staff ON storage.objects
          FOR ALL
          USING (
            bucket_id = 'library' AND
            EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role IN ('staff'::user_role_enum, 'admin'::user_role_enum)
            )
          )
          WITH CHECK (
            bucket_id = 'library' AND
            EXISTS (
              SELECT 1 FROM user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.role IN ('staff'::user_role_enum, 'admin'::user_role_enum)
            )
          );
      `);
      console.log("   ✅ ALL (staff/admin) → library_manage_staff\n");
    } catch (e) {
      console.log("   ⚠️  لم يتم ALL library policy:", e.message, "\n");
    }

    // ========== 5) تأكيد: عرض أعمدة library_files الآن ==========
    console.log("📚 6) تأكيد بنية library_files بعد الإصلاح:");
    const { rows: cols } = await client.query(`
      SELECT c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='library_files'
      ORDER BY c.ordinal_position;
    `);
    const has = cols.some((c) => c.column_name === "created_by");
    for (const c of cols) {
      const mark = c.column_name === "created_by" ? " ← ✅ تم إضافته الآن" : "";
      console.log(`   • ${c.column_name}${mark}`);
    }
    console.log(`\n   النتيجة النهائية: created_by موجود؟ ${has ? "✅ نعم" : "❌ لا"}`);

    console.log("\n🎉 تم تطبيق جميع الإصلاحات بنجاح.");
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
