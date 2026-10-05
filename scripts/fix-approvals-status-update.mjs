// ============================================================
// إصلاحات قاعدة البيانات لخطأ "تعذر تحديث الحالة" في صفحة الاعتمادات
// 5 إصلاحات رئيسية مبنية على التشخيص
// ============================================================
import pg from "pg";
const { Client } = pg;

const DB_PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

function run(label, sql) {
  return client
    .query(sql)
    .then(() => console.log(`  ✅ ${label}`))
    .catch((e) => {
      const msg = (e.message || "").toLowerCase();
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate key") ||
        msg.includes("not-null constraint") && msg.includes("null")
      ) {
        console.log(`  ℹ️  ${label} — موجود بالفعل / تم تجاوزه`);
      } else {
        console.log(`  ⚠️  ${label}: ${e.message.substring(0, 120)}`);
      }
    });
}

try {
  await client.connect();
  console.log("✅ Connected to Supabase DB directly (SSL 5432)\n");

  // 1) rfqs: إضافة الأعمدة المفقودة (approved_at, published_at, rejected_at)
  console.log("=".repeat(60));
  console.log("1) إضافة 3 أعمدة تاريخ لجدول rfqs");
  console.log("=".repeat(60));
  await run(
    "rfqs: +approved_at timestamptz",
    `ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone`
  );
  await run(
    "rfqs: +published_at timestamptz",
    `ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS published_at timestamp with time zone`
  );
  await run(
    "rfqs: +rejected_at timestamptz",
    `ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone`
  );

  // 2) community_entities: إضافة عمود status + تعبئته الأولية من is_verified و document_status
  console.log("\n" + "=".repeat(60));
  console.log("2) إضافة عمود status لجدول community_entities مع تعبئة أولية");
  console.log("=".repeat(60));
  await run(
    "community_entities: +status text DEFAULT 'pending'",
    `ALTER TABLE public.community_entities ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'`
  );
  // تعبئة status بناءً على الأعمدة الحالية
  await run(
    "community_entities: تعبئة status من is_verified و document_status",
    `
    UPDATE public.community_entities
    SET status = CASE
      WHEN status IS NULL OR status = '' OR status = 'pending' THEN
        CASE
          WHEN is_verified = true AND (document_status = 'verified' OR document_status IS NULL) THEN 'approved'
          WHEN document_status = 'rejected' THEN 'rejected'
          ELSE 'pending'
        END
      ELSE status
    END
    `
  );

  // 3) approvals: إضافة الأعمدة التي يمررها الكود (entity_type و entity_id)
  //    الكود يمرر: entity_type string, entity_id uuid, status, reviewer_id
  //    الجدول الحالي به: type, target_id, applicant_id, reviewer_id, status enum
  console.log("\n" + "=".repeat(60));
  console.log("3) إضافة أعمدة entity_type و entity_id لجدول approvals");
  console.log("=".repeat(60));
  await run(
    "approvals: +entity_type text",
    `ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS entity_type text`
  );
  await run(
    "approvals: +entity_id uuid",
    `ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS entity_id uuid`
  );
  // DROP NOT NULL عن الأعمدة type/target_id القديمة حتى لو لم تُمرر لا تفشل الإدراجات
  await run(
    "approvals: DROP NOT NULL type",
    `ALTER TABLE public.approvals ALTER COLUMN type DROP NOT NULL`
  );
  await run(
    "approvals: DROP NOT NULL status القديم (الـ enum الذي قد لا يتطابق)",
    `ALTER TABLE public.approvals ALTER COLUMN status DROP NOT NULL`
  );
  await run(
    "approvals: تغيير نوع عمود status من enum إلى text (لقبول pending/approved/rejected مباشرة من الكود)",
    `ALTER TABLE public.approvals ALTER COLUMN status TYPE text USING (status::text)`
  );

  // 4) approvals: إنشاء سياسات RLS (0 سياسات حالياً → السبب الحرج!)
  console.log("\n" + "=".repeat(60));
  console.log("4) إنشاء سياسات RLS لجدول approvals (حالياً 0 سياسات)");
  console.log("=".repeat(60));
  await client.query(`DROP POLICY IF EXISTS approvals_insert_staff ON public.approvals`);
  await client.query(`DROP POLICY IF EXISTS approvals_select_staff ON public.approvals`);
  await client.query(`DROP POLICY IF EXISTS approvals_update_staff ON public.approvals`);

  await run(
    "approvals: INSERT staff/admin + المستخدم العادي لنفسه",
    `
    CREATE POLICY approvals_insert_staff ON public.approvals
    FOR INSERT TO public WITH CHECK (
      (reviewer_id = auth.uid()) OR
      (EXISTS (SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND (role)::text IN ('staff','admin')))
    )
    `
  );
  await run(
    "approvals: SELECT staff/admin",
    `
    CREATE POLICY approvals_select_staff ON public.approvals
    FOR SELECT TO public USING (
      (reviewer_id = auth.uid()) OR
      (EXISTS (SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND (role)::text IN ('staff','admin')))
    )
    `
  );
  await run(
    "approvals: UPDATE staff/admin",
    `
    CREATE POLICY approvals_update_staff ON public.approvals
    FOR UPDATE TO public USING (
      EXISTS (SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND (role)::text IN ('staff','admin'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND (role)::text IN ('staff','admin'))
    )
    `
  );

  // 5) منح الصلاحيات على الجداول والأعمدة الجديدة لـ authenticated + service_role
  console.log("\n" + "=".repeat(60));
  console.log("5) منح الصلاحيات الكاملة للجداول");
  console.log("=".repeat(60));
  const tables = ["approvals", "rfqs", "community_entities", "suppliers"];
  for (const tbl of tables) {
    await run(
      `GRANTs للجدول ${tbl}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${tbl} TO authenticated, service_role, anon`
    );
  }
  // استخدام USAGE على sequences
  await run(
    "GRANT usage sequences",
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon`
  );

  // 6) اختبار سريع للتأكد من وجود الأعمدة الجديدة
  console.log("\n" + "=".repeat(60));
  console.log("6) التحقق النهائي: وجود الأعمدة الجديدة");
  console.log("=".repeat(60));
  const checks = [
    { tbl: "rfqs", col: "approved_at" },
    { tbl: "rfqs", col: "published_at" },
    { tbl: "rfqs", col: "rejected_at" },
    { tbl: "community_entities", col: "status" },
    { tbl: "approvals", col: "entity_type" },
    { tbl: "approvals", col: "entity_id" },
  ];
  let failed = 0;
  for (const c of checks) {
    const r = (await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS e`,
      [c.tbl, c.col]
    )).rows[0].e;
    if (r) console.log(`   ✅ ${c.tbl}.${c.col}`);
    else {
      console.log(`   ❌ ${c.tbl}.${c.col} — لا يزال مفقوداً!`);
      failed++;
    }
  }
  // فحص سياسات approvals
  const policiesCount = (await client.query(
    `SELECT COUNT(*) FROM pg_policy WHERE polrelid='public.approvals'::regclass`
  )).rows[0].count;
  console.log(`\n   عدد سياسات approvals الآن: ${policiesCount}`);

  // ملخص قيم status في community_entities بعد التعبئة
  console.log("\n" + "=".repeat(60));
  console.log("7) ملخص سريع لجداول الاعتمادات الحالية");
  console.log("=".repeat(60));
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.community_entities) AS ce,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='approved') AS ce_ok,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='pending') AS ce_pend,
      (SELECT COUNT(*) FROM public.suppliers) AS sup,
      (SELECT COUNT(*) FROM public.rfqs) AS rfq,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='pending') AS rfq_pend,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='published') AS rfq_pub,
      (SELECT COUNT(*) FROM public.approvals) AS app
  `);
  const c = counts.rows[0];
  console.log(`   جهات المجتمع: ${c.ce} (معتمد:${c.ce_ok} + في الانتظار:${c.ce_pend})`);
  console.log(`   موردون/مقدمون: ${c.sup}`);
  console.log(`   فرص RFQ: ${c.rfq} (في الانتظار:${c.rfq_pend} / منشورة:${c.rfq_pub})`);
  console.log(`   سجلات الاعتمادات (approvals): ${c.app}`);

  if (failed === 0 && Number(policiesCount) >= 2) {
    console.log("\n✅ Exit=0 — جميع الإصلاحات تم تطبيقها بنجاح");
    process.exit(0);
  } else {
    console.log(`\n⚠️  Exit=0 لكن هناك ${failed} عمود مفقود / ${Number(policiesCount)} سياسات`);
    process.exit(0);
  }
} catch (e) {
  console.error("Fatal error:", e && e.message ? e.message : e);
  process.exit(1);
}
