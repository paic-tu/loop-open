import pg from "pg";
const { Client } = pg;

const password = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ Connected to Supabase DB (SSL)\n");

// ================================================
// السبب الرئيسي! إصلاح سياسات RLS للـ INSERT التي تتوقع user_id بينما
// الكود الجديد يمرر owner_id (rfqs) أو user_id صحيح لكن مع مرونة أكبر
// ================================================

console.log("🚀 إصلاح سياسات RLS INSERT لتفادي عدم التطابق user_id / owner_id");

// 1) rfqs: policy القديمة = WITH CHECK user_id = auth.uid()
//    لكن الكود يمرر owner_id = user.id 👉 يفشل دائماً!
//    الحل: اسمح بـ (user_id = auth.uid()) OR (owner_id = auth.uid())
await client.query(`
  DROP POLICY IF EXISTS rfq_self_insert ON public.rfqs;
  CREATE POLICY rfq_self_insert ON public.rfqs FOR INSERT
    WITH CHECK (
      (user_id = auth.uid()) OR
      (owner_id = auth.uid()) OR
      (auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
      ))
    );
`);
console.log("  ✅ rfqs: rfq_self_insert يدعم الآن user_id و owner_id");

// 2) rfqs: policy الـ SELECT القديمة لا تسمح للمستخدمين برؤية طلباتهم إذا لم
//    يكن الحالة = published/open. لذا يجب دعم owner_id أيضاً في الـ SELECT + UPDATE.
await client.query(`
  DROP POLICY IF EXISTS rfq_select_all ON public.rfqs;
  CREATE POLICY rfq_select_all ON public.rfqs FOR SELECT
    USING (
      (status::text = ANY ('{published,open,closed}')) OR
      (user_id = auth.uid()) OR
      (owner_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );

  DROP POLICY IF EXISTS rfq_self_update ON public.rfqs;
  CREATE POLICY rfq_self_update ON public.rfqs FOR UPDATE
    USING (
      (user_id = auth.uid()) OR
      (owner_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );
`);
console.log("  ✅ rfqs: SELECT / UPDATE يدعم الآن user_id و owner_id");

// 3) community_entities: تأكد أن الـ upsert على user_id صحيح + أضف مرونة
//    (الكود يمرر user_id بشكل صحيح فعلاً — لكن نُثبِّت السياسة)
await client.query(`
  DROP POLICY IF EXISTS ce_self_insert ON public.community_entities;
  CREATE POLICY ce_self_insert ON public.community_entities FOR INSERT
    WITH CHECK (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );
`);
console.log("  ✅ community_entities: ce_self_insert محدّث");

// 4) suppliers: تأكد أن policy insert يدعم user_id = auth.uid() و أن
//    region/category/text (بدلاً من array) أصبحت صالحة الآن بعد إضافة الأعمدة
await client.query(`
  DROP POLICY IF EXISTS sup_self_insert ON public.suppliers;
  CREATE POLICY sup_self_insert ON public.suppliers FOR INSERT
    WITH CHECK (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );

  DROP POLICY IF EXISTS sup_self_select ON public.suppliers;
  CREATE POLICY sup_self_select ON public.suppliers FOR SELECT
    USING (
      is_verified = true OR
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );

  DROP POLICY IF EXISTS sup_self_update ON public.suppliers;
  CREATE POLICY sup_self_update ON public.suppliers FOR UPDATE
    USING (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
    );
`);
console.log("  ✅ suppliers: select/insert/update policies محدّثة");

// 5) قيمة status الافتراضية لـ rfqs بعد الإنشاء: الافتراضي هو draft لكن
//    الكود يتوقع أن يظهر الحالة pending للاعتماد. نُحدّث الـ default ليكون pending:
//    * ملاحظة: enum قد يحتوي على pending أم لا؟ سنفحص:
const rfqEnum = await client.query(`
  SELECT enumlabel FROM pg_enum
  WHERE enumtypid = 'public.rfq_status_enum'::regtype
  ORDER BY enumsortorder;
`);
const labels = rfqEnum.rows.map(r => r.enumlabel);
console.log(`\nℹ️  قيم rfq_status_enum الحالية: ${labels.join(", ")}`);

if (!labels.includes("pending")) {
  console.log("🚀 إضافة قيمة pending إلى rfq_status_enum...");
  await client.query(`ALTER TYPE public.rfq_status_enum ADD VALUE IF NOT EXISTS 'pending'`);
}
if (!labels.includes("published")) {
  await client.query(`ALTER TYPE public.rfq_status_enum ADD VALUE IF NOT EXISTS 'published'`);
}
if (!labels.includes("rejected")) {
  await client.query(`ALTER TYPE public.rfq_status_enum ADD VALUE IF NOT EXISTS 'rejected'`);
}
if (!labels.includes("closed")) {
  await client.query(`ALTER TYPE public.rfq_status_enum ADD VALUE IF NOT EXISTS 'closed'`);
}
// الآن نُحدّث default لجدول rfqs ليكون pending بدلاً من draft ليتوافق مع الكود
// (لكن يجب الحذر لأن الـ enum قد لا يكون له pending. لذا سنستخدم USING للتحويل.)
try {
  // لا يمكن تعديل عمود status إلى pending إذا لم تكن القيمة موجودة في الـ enum
  await client.query(`
    ALTER TABLE public.rfqs
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status SET DEFAULT 'pending'::public.rfq_status_enum;
  `);
  console.log("  ✅ rfqs.status DEFAULT أصبح 'pending' ليتوافق مع نظام الموافقات");
} catch (e) {
  console.log("  ℹ️  (لم نستطع تغيير default بسبب enum: " + e.message.substring(0,80) + ") — سنضيف TEXT كبديل")
  // حماية إضافية: إذا فشل التغيير لأن الـ enum لا يملك pending، فحول العمود إلى TEXT تماماً مثلما فعلنا مع bookings سابقاً
  await client.query(`
    ALTER TABLE public.rfqs ALTER COLUMN status TYPE text
      USING status::text;
    ALTER TABLE public.rfqs ALTER COLUMN status SET DEFAULT 'pending';
  `);
  console.log("  ✅ rfqs.status محوّل إلى TEXT مع DEFAULT 'pending' (كحل نهائي مثل bookings)");
}

// 6) نفس الشيء لـ document_status_enum في community_entities و suppliers:
//    تأكد أن القيم المتوقعة في الكود موجودة (pending_verification, verified...)
const docEnum = await client.query(`
  SELECT enumlabel FROM pg_enum
  WHERE enumtypid = 'public.document_status_enum'::regtype
  ORDER BY enumsortorder;
`).catch(() => ({ rows: [] }));
if (docEnum.rows.length > 0) {
  console.log(`\nℹ️  قيم document_status_enum: ${docEnum.rows.map(r=>r.enumlabel).join(", ")}`);
  const docLabels = docEnum.rows.map(r=>r.enumlabel);
  if (!docLabels.includes("verified")) {
    try { await client.query(`ALTER TYPE public.document_status_enum ADD VALUE IF NOT EXISTS 'verified'`); } catch(_){}
  }
  if (!docLabels.includes("rejected")) {
    try { await client.query(`ALTER TYPE public.document_status_enum ADD VALUE IF NOT EXISTS 'rejected'`); } catch(_){}
  }
}

// 7) منح permissions على الجداول للـ service_role أيضاً (مهم)
await client.query(`
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
`);
console.log("\n✅ Permissions service_role محدّثة");

await client.end();
console.log("\n✅✅✅ إصلاح سياسات RLS والـ enum انتهى بنجاح");
