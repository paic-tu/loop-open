// ============================================================
// تأكيد وتأمين: هل سياسة INSERT لأي شخص على bucket 'documents' موجودة فعلاً؟
// أعد إنشاءها بشكل صريح إن لم تكن.
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

    // عرض ALL policies على storage.objects
    console.log("💾 قائمة جميع السياسات على storage.objects:");
    const { rows: pols } = await client.query(`
      SELECT polname AS policy_name,
             CASE polcmd
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               WHEN '*' THEN 'ALL (rwda)'
               ELSE polcmd::text END AS cmd,
             pg_get_expr(polqual, polrelid) AS using_expr,
             pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_policy
      WHERE polrelid = 'storage.objects'::regclass
      ORDER BY polname;
    `);
    for (const p of pols) {
      console.log(`\n  ┌─────────────────────────────────────────────`);
      console.log(`  │ [${p.cmd}] ${p.policy_name}`);
      if (p.using_expr) console.log(`  │ USING:  ${p.using_expr}`);
      if (p.with_check) console.log(`  │ WITH:   ${p.with_check}`);
      console.log(`  └─────────────────────────────────────────────`);
    }

    // البحث عن سياسة تسمح لـ ANYONE ب INSERT على documents
    const insertDocs = pols.filter(
      (p) =>
        (p.cmd === "INSERT" || p.cmd === "ALL (rwda)") &&
        String((p.using_expr ?? "") + (p.with_check ?? "")).includes("documents")
    );
    console.log(`\n🔎 عدد سياسات INSERT/ALL تخص documents: ${insertDocs.length}`);

    const hasAnonInsert = pols.some(
      (p) =>
        (p.cmd === "INSERT" || p.cmd === "ALL (rwda)") &&
        String(p.with_check ?? "") === "(bucket_id = 'documents'::text)"
    );
    console.log(`🔎 هل يوجد INSERT anyone على documents؟ ${hasAnonInsert ? "✅ نعم" : "❌ لا — سيتم إنشاؤها الآن"}`);

    if (!hasAnonInsert) {
      console.log("\n🛠  إنشاء documents_upload_anyone policy...");
      try {
        await client.query(`DROP POLICY IF EXISTS documents_upload_anyone ON storage.objects;`);
        await client.query(`
          CREATE POLICY documents_upload_anyone ON storage.objects
          FOR INSERT
          WITH CHECK (bucket_id = 'documents');
        `);
        console.log("   ✅ تم إنشاء السياسة بنجاح — الآن الضيوف المستخدمين يمكنهم رفع مرفقات الاستشارة.");
      } catch (e) {
        console.log("   ❌ فشل إنشاء السياسة:", e.message);
        process.exit(1);
      }
    }

    // تأكيد إضافي: تأكد من أن السياسة العامة authenticated_all_storage لا تمنع
    // (لا توجد مشكلة – multiple policies يتم OR-ingها بينها)

    console.log("\n✅ الانتهاء من التحقق.");
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
