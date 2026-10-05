// ============================================================
// تشخيص متابع: RLS policies لـ bookings و library_files + structure library_files
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

    // 1) RLS على bookings
    console.log("📋 1) فحص حالة RLS على جدول bookings:");
    const { rows: rlsBook } = await client.query(`
      SELECT relrowsecurity AS rls_enabled FROM pg_class WHERE oid = 'public.bookings'::regclass;
    `);
    console.log(`   • RLS مفعّل؟ ${rlsBook[0].rls_enabled ? "✅ نعم" : "❌ لا"}`);

    console.log("\n📋 2) RLS Policies على جدول bookings:");
    const { rows: polBook } = await client.query(`
      SELECT polname AS policy_name,
             CASE polcmd
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               ELSE polcmd::text END AS cmd,
             pg_get_expr(polqual, polrelid) AS using_expr,
             pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polrelid = 'public.bookings'::regclass
      ORDER BY polname;
    `);
    if (polBook.length === 0) {
      console.log("   ⚠️  لا توجد سياسات على جدول bookings! إذا كان RLS مفعّلاً سيُرفض كل شيء.");
    } else {
      for (const p of polBook) {
        console.log(`   • [${p.cmd}] ${p.policy_name}`);
        if (p.using_expr) console.log(`     USING: ${p.using_expr}`);
        if (p.with_check) console.log(`     WITH CHECK: ${p.with_check}`);
      }
    }

    // 2) library_files
    console.log("\n═══════════════════════════════════════════");
    console.log("📚 3) فحص هيكل جدول library_files:");
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
      if (r.column_default) flags.push(`DEFAULT: ${String(r.column_default).slice(0, 70)}`);
      console.log(
        `   • ${r.column_name.padEnd(22)} : ${r.data_type.padEnd(15)} ${r.udt_name.padEnd(22)} ${flags.join("  ")}`
      );
    }
    const hasCreatedBy = colsLib.some((c) => c.column_name === "created_by");
    const hasFileName = colsLib.some((c) => c.column_name === "file_name");
    const hasFileSize = colsLib.some((c) => c.column_name === "file_size");
    const hasMimeType = colsLib.some((c) => c.column_name === "mime_type");
    const hasDownloadCount = colsLib.some((c) => c.column_name === "download_count");
    const hasIsPublished = colsLib.some((c) => c.column_name === "is_published");
    const hasSortOrder = colsLib.some((c) => c.column_name === "sort_order");
    const hasIconName = colsLib.some((c) => c.column_name === "icon_name");
    const hasCategory = colsLib.some((c) => c.column_name === "category");
    console.log(`\n   • created_by موجود؟ ${hasCreatedBy ? "✅" : "❌"} → يُستخدم في L126 library.ts`);
    console.log(`   • file_name موجود؟   ${hasFileName ? "✅" : "❌"} → يُستخدم في L123 library.ts`);
    console.log(`   • file_size موجود؟   ${hasFileSize ? "✅" : "❌"} → يُستخدم في L124 library.ts`);
    console.log(`   • mime_type موجود؟   ${hasMimeType ? "✅" : "❌"} → يُستخدم في L125 library.ts`);
    console.log(`   • download_count؟    ${hasDownloadCount ? "✅" : "❌"} → يُستخدم في L12 library.ts`);
    console.log(`   • is_published؟      ${hasIsPublished ? "✅" : "❌"} → يُستخدم في L23 library.ts`);
    console.log(`   • sort_order؟        ${hasSortOrder ? "✅" : "❌"} → يُستخدم في L14 library.ts`);
    console.log(`   • icon_name؟         ${hasIconName ? "✅" : "❌"} → يُستخدم في L15 library.ts`);
    console.log(`   • category؟          ${hasCategory ? "✅" : "❌"} → يُستخدم في L7 library.ts`);

    // RLS على library_files
    console.log("\n📚 4) RLS Policies على جدول library_files:");
    const { rows: rlsLib } = await client.query(`
      SELECT relrowsecurity AS rls_enabled FROM pg_class WHERE oid = 'public.library_files'::regclass;
    `);
    console.log(`   • RLS مفعّل؟ ${rlsLib[0].rls_enabled ? "✅ نعم" : "❌ لا"}`);

    const { rows: polLib } = await client.query(`
      SELECT polname AS policy_name,
             CASE polcmd
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               ELSE polcmd::text END AS cmd,
             pg_get_expr(polqual, polrelid) AS using_expr,
             pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polrelid = 'public.library_files'::regclass
      ORDER BY polname;
    `);
    if (polLib.length === 0) {
      console.log("   ⚠️  لا توجد سياسات على جدول library_files! إذا كان RLS مفعّلاً سيُرفض كل شيء.");
    } else {
      for (const p of polLib) {
        console.log(`   • [${p.cmd}] ${p.policy_name}`);
        if (p.using_expr) console.log(`     USING: ${p.using_expr}`);
        if (p.with_check) console.log(`     WITH CHECK: ${p.with_check}`);
      }
    }

    // storage buckets
    console.log("\n💾 5) فحص Storage Buckets:");
    try {
      const { rows: buck } = await client.query(`
        SELECT id, name, public, file_size_limit FROM storage.buckets
        WHERE name IN ('documents', 'library') ORDER BY name;
      `);
      const docExists = buck.some((b) => b.name === "documents");
      const libExists = buck.some((b) => b.name === "library");
      if (buck.length === 0) console.log("   ❌ لا يوجد أي Bucket!");
      for (const b of buck) {
        console.log(`   • ${b.name}  | public=${b.public} | limit=${b.file_size_limit ?? "بدون"}`);
      }
      if (!docExists) console.log("   ⚠️  Bucket 'documents' غير موجود!");
      if (!libExists) console.log("   ⚠️  Bucket 'library' غير موجود!");
    } catch (e) {
      console.log("   ⚠️  تعذر فحص storage:", e.message);
    }

    // 6) function increment_library_download
    console.log("\n📚 6) فحص RPC function increment_library_download:");
    try {
      const { rows: rpc } = await client.query(`
        SELECT proname FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND proname = 'increment_library_download';
      `);
      console.log(`   • الـ RPC موجود؟ ${rpc.length > 0 ? "✅ نعم" : "⚠️  لا — سيستخدم Fallback"}`);
    } catch (e) {
      console.log("   ⚠️  تعذر فحص الـ RPC:", e.message);
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
