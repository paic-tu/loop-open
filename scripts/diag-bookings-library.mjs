// ============================================================
// تشخيص مشاكل جدول bookings و library_files
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

    // ========== 1) جدول BOOKINGS ==========
    console.log("═══════════════════════════════════════════");
    console.log("📋 1) فحص هيكل جدول bookings:");
    console.log("═══════════════════════════════════════════");
    const { rows: colsBook } = await client.query(`
      SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'bookings'
      ORDER BY c.ordinal_position;
    `);
    if (colsBook.length === 0) console.log("   ❌ جدول bookings غير موجود!");
    for (const r of colsBook) {
      const flags = [];
      if (r.is_nullable === "NO") flags.push("NOT NULL");
      if (r.column_default) flags.push(`DEFAULT: ${String(r.column_default).slice(0, 60)}`);
      console.log(
        `   • ${r.column_name.padEnd(22)} : ${r.data_type.padEnd(15)} ${r.udt_name.padEnd(22)} ${flags.join("  ")}`
      );
    }
    console.log();

    // 2) قيم enum booking_status_enum
    console.log("📋 2) قيم booking_status_enum:");
    const { rows: enBook } = await client.query(`
      SELECT e.enumlabel AS val, e.enumsortorder AS ord
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname ILIKE '%booking%status%'
      ORDER BY e.enumsortorder;
    `);
    if (enBook.length === 0) {
      console.log("   ℹ️  لا يوجد enum booking_status_enum. عمود status قد يكون text!");
      // هل عمود status في bookings نوعه text؟
      const statusCol = colsBook.find((c) => c.column_name === "status");
      if (statusCol) console.log(`   • نوع status الحالي: ${statusCol.udt_name} (${statusCol.data_type})`);
    } else {
      for (const v of enBook) console.log(`   [${v.ord}] "${v.val}"`);
    }
    console.log();

    // 3) RLS policies لـ bookings
    console.log("📋 3) RLS Policies على جدول bookings:");
    const { rows: polBook } = await client.query(`
      SELECT polname AS policy_name, cmd AS command,
             pg_get_expr(polqual, polrelid) AS using_expr,
             pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polrelid = 'public.bookings'::regclass
      ORDER BY polname;
    `);
    if (polBook.length === 0) {
      console.log("   ⚠️  لا توجد RLS policies على جدول bookings!");
      const { rows: rls } = await client.query(
        `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.bookings'::regclass;`
      );
      console.log(`   • حالة RLS: ${rls[0]?.rls ? "مفعّل" : "غير مفعّل"}`);
    } else {
      for (const p of polBook) {
        console.log(`   • [${p.command}] ${p.policy_name}`);
        if (p.using_expr) console.log(`     USING: ${p.using_expr}`);
        if (p.with_check) console.log(`     WITH CHECK: ${p.with_check}`);
      }
    }
    console.log();

    // 4) عدد صفوف bookings الحالية
    const { rows: cntBook } = await client.query(`SELECT COUNT(*)::int AS n FROM public.bookings;`);
    console.log(`📊 عدد حجوزات الاستشارات الموجودة حالياً: ${cntBook[0].n}  صف\n`);

    // ========== 5) جدول LIBRARY_FILES ==========
    console.log("═══════════════════════════════════════════");
    console.log("📚 5) فحص هيكل جدول library_files:");
    console.log("═══════════════════════════════════════════");
    const { rows: colsLib } = await client.query(`
      SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'library_files'
      ORDER BY c.ordinal_position;
    `);
    if (colsLib.length === 0) console.log("   ❌ جدول library_files غير موجود!");
    for (const r of colsLib) {
      const flags = [];
      if (r.is_nullable === "NO") flags.push("NOT NULL");
      if (r.column_default) flags.push(`DEFAULT: ${String(r.column_default).slice(0, 60)}`);
      console.log(
        `   • ${r.column_name.padEnd(22)} : ${r.data_type.padEnd(15)} ${r.udt_name.padEnd(22)} ${flags.join("  ")}`
      );
    }
    console.log();

    // التحقق من عمود created_by (يستخدم في createOrUpdateLibraryFile L126)
    const hasCreatedBy = colsLib.some((c) => c.column_name === "created_by");
    console.log(`   • ℹ️  عمود created_by موجود؟ ${hasCreatedBy ? "✅ نعم" : "❌ لا — مصدر خطأ تعذر الحفظ عند إضافة ملف جديد!"}`);
    console.log();

    // 6) RLS policies لـ library_files
    console.log("📚 6) RLS Policies على جدول library_files:");
    const { rows: polLib } = await client.query(`
      SELECT polname AS policy_name, cmd AS command,
             pg_get_expr(polqual, polrelid) AS using_expr,
             pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polrelid = 'public.library_files'::regclass
      ORDER BY polname;
    `);
    if (polLib.length === 0) {
      console.log("   ⚠️  لا توجد RLS policies على جدول library_files!");
      const { rows: rls } = await client.query(
        `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.library_files'::regclass;`
      );
      console.log(`   • حالة RLS: ${rls[0]?.rls ? "مفعّل" : "غير مفعّل"}`);
    } else {
      for (const p of polLib) {
        console.log(`   • [${p.command}] ${p.policy_name}`);
        if (p.using_expr) console.log(`     USING: ${p.using_expr}`);
        if (p.with_check) console.log(`     WITH CHECK: ${p.with_check}`);
      }
    }
    console.log();

    // 7) عدد ملفات المكتبة الحالية
    const { rows: cntLib } = await client.query(`SELECT COUNT(*)::int AS n FROM public.library_files;`);
    console.log(`📊 عدد ملفات المكتبة الموجودة حالياً: ${cntLib[0].n}  ملف\n`);

    // 8) فحص Buckets storage المطلوبة
    console.log("💾 8) فحص Storage Buckets (documents و library):");
    try {
      const { rows: buck } = await client.query(`
        SELECT id, name, public, file_size_limit
        FROM storage.buckets
        WHERE name IN ('documents', 'library')
        ORDER BY name;
      `);
      const docExists = buck.some((b) => b.name === "documents");
      const libExists = buck.some((b) => b.name === "library");
      if (buck.length === 0) {
        console.log("   ❌ لا يوجد أي Bucket!");
      } else {
        for (const b of buck) {
          console.log(`   • ${b.name}  | public=${b.public} | limit=${b.file_size_limit ?? "بدون"}`);
        }
      }
      if (!docExists) console.log("   ⚠️  Bucket 'documents' (مستخدم في إرفاق استشارات) غير موجود!");
      if (!libExists) console.log("   ⚠️  Bucket 'library' (مستخدم في مكتبة الملفات) غير موجود!");
    } catch (storageErr) {
      console.log("   ⚠️  تعذر فحص storage.buckets:", storageErr.message);
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
