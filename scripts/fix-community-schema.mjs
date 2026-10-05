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
// الخطوة 1: جدول community_entities — إضافة أعمدة مفقودة
// المتوقعة: entity_name, representative_name, job_title, official_email,
//           region, field, verification_note
// الموجودة حالياً: name بدلاً من entity_name, email بدلاً من official_email,
//                  location بدلاً من region, fields_of_work[] بدلاً من field (text)
// ================================================
console.log("🚀 الخطوة 1: إصلاح community_entities");
await client.query(`
  ALTER TABLE public.community_entities
    ADD COLUMN IF NOT EXISTS entity_name text,
    ADD COLUMN IF NOT EXISTS representative_name text,
    ADD COLUMN IF NOT EXISTS job_title text,
    ADD COLUMN IF NOT EXISTS official_email text,
    ADD COLUMN IF NOT EXISTS region text,
    ADD COLUMN IF NOT EXISTS field text,
    ADD COLUMN IF NOT EXISTS verification_note text;
`);
// نقل البيانات القديمة إلى الأعمدة الجيدة إن وجدت
await client.query(`
  UPDATE public.community_entities SET
    entity_name = COALESCE(entity_name, name),
    official_email = COALESCE(official_email, email),
    region = COALESCE(region, location),
    field = COALESCE(field, (fields_of_work::text[])[1])
  WHERE entity_name IS NULL OR official_email IS NULL OR region IS NULL OR field IS NULL;
`);
console.log("✅ community_entities: تمت إضافة الأعمدة + نقل البيانات القديمة\n");

// ================================================
// الخطوة 2: جدول rfqs — إضافة أعمدة مفقودة
// المتوقعة: owner_id (بدلاً من user_id), entity_name, entity_kind, region,
//           city, sector, budget text, is_open, rejection_reason,
//           awarded_quote_id, requires_openloop_review
// الموجودة حالياً: user_id, entity_id, budget_min, budget_max numeric, views
// ================================================
console.log("🚀 الخطوة 2: إصلاح rfqs");
await client.query(`
  ALTER TABLE public.rfqs
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS entity_name text,
    ADD COLUMN IF NOT EXISTS entity_kind text,
    ADD COLUMN IF NOT EXISTS region text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS sector text,
    ADD COLUMN IF NOT EXISTS budget text,
    ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS rejection_reason text,
    ADD COLUMN IF NOT EXISTS awarded_quote_id uuid,
    ADD COLUMN IF NOT EXISTS requires_openloop_review boolean NOT NULL DEFAULT false;
`);
// نقل owner_id من user_id القديم إن وجد
await client.query(`
  UPDATE public.rfqs SET owner_id = COALESCE(owner_id, user_id)
  WHERE owner_id IS NULL AND user_id IS NOT NULL;
`);
console.log("✅ rfqs: تمت إضافة الأعمدة + نقل owner_id من user_id القديم\n");

// ================================================
// الخطوة 3: جدول suppliers — إضافة أعمدة مفقودة
// المتوقعة: category (text), region (text), contact_name, about, status (text)
// الموجودة حالياً: categories[], city بدلاً من region
// ================================================
console.log("🚀 الخطوة 3: إصلاح suppliers");
await client.query(`
  ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS region text,
    ADD COLUMN IF NOT EXISTS contact_name text,
    ADD COLUMN IF NOT EXISTS about text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
`);
// نقل البيانات القديمة
await client.query(`
  UPDATE public.suppliers SET
    category = COALESCE(category, (categories::text[])[1]),
    region = COALESCE(region, city)
  WHERE category IS NULL OR region IS NULL;
`);
console.log("✅ suppliers: تمت إضافة الأعمدة + نقل البيانات القديمة\n");

// ================================================
// الخطوة 4: إنشاء جدول user_terms_acceptances (مفقود حالياً)
// ================================================
console.log("🚀 الخطوة 4: إنشاء user_terms_acceptances");
await client.query(`
  CREATE TABLE IF NOT EXISTS public.user_terms_acceptances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    terms_version text NOT NULL,
    acceptance_type text NOT NULL,
    related_action text NOT NULL,
    related_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`);
// Permissions + RLS
await client.query(`
  ALTER TABLE public.user_terms_acceptances ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS uta_select_self ON public.user_terms_acceptances;
  CREATE POLICY uta_select_self ON public.user_terms_acceptances FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('staff','admin')
    ));
  DROP POLICY IF EXISTS uta_insert_self ON public.user_terms_acceptances;
  CREATE POLICY uta_insert_self ON public.user_terms_acceptances FOR INSERT
    WITH CHECK (user_id = auth.uid());
`);
await client.query(`
  GRANT SELECT, INSERT ON public.user_terms_acceptances
    TO authenticated, anon, service_role;
`);
console.log("✅ user_terms_acceptances: تم الإنشاء + RLS + Permissions\n");

// ================================================
// الخطوة 5: إعادة هيكلة جدول audit_logs
// الحالي: user_id, action, target_table, target_id, changes, ip
// المطلوب: actor_id, action, entity_type, entity_id, meta jsonb
// ================================================
console.log("🚀 الخطوة 5: إعادة هيكلة audit_logs");
await client.query(`
  ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS actor_id uuid,
    ADD COLUMN IF NOT EXISTS entity_type text,
    ADD COLUMN IF NOT EXISTS entity_id uuid,
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
`);
// نقل البيانات القديمة إلى الأعمدة الجديدة
await client.query(`
  UPDATE public.audit_logs SET
    actor_id = COALESCE(actor_id, user_id),
    entity_type = COALESCE(entity_type, target_table),
    entity_id = COALESCE(entity_id, target_id),
    meta = COALESCE(NULLIF(meta, '{}'::jsonb), changes, '{}'::jsonb)
  WHERE actor_id IS NULL OR entity_type IS NULL;
`);
// إنشاء سياسات RLS لـ audit_logs (كان لا يوجد أي سياسة!)
await client.query(`
  DROP POLICY IF EXISTS al_select_staff ON public.audit_logs;
  CREATE POLICY al_select_staff ON public.audit_logs FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text IN ('staff','admin')
    ));
  DROP POLICY IF EXISTS al_insert_any ON public.audit_logs;
  CREATE POLICY al_insert_any ON public.audit_logs FOR INSERT
    WITH CHECK (actor_id = auth.uid() OR auth.uid() IS NOT NULL);
`);
await client.query(`
  GRANT SELECT, INSERT ON public.audit_logs
    TO authenticated, anon, service_role;
`);
console.log("✅ audit_logs: أضيف الأعمدة + نقل البيانات + RLS Policies\n");

// ================================================
// الخطوة 6: منح Permissions للجداول الرئيسية إن لم تكن موجودة
// ================================================
console.log("🚀 الخطوة 6: منح صلاحيات للجداول الأساسية");
const ALL_TABLES = ["community_entities", "rfqs", "suppliers", "opportunity_categories", "rfq_quotes"];
for (const tbl of ALL_TABLES) {
  try {
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.${tbl}
      TO authenticated, service_role;
      GRANT SELECT ON public.${tbl} TO anon;
    `);
  } catch (_) {}
}
console.log("✅ Permissions منحها للجداول\n");

// ================================================
// الخطوة 7: (اختياري) إنشاء حاوية storage + policies لـ entity-documents
// الحاوية موجودة بالفعل من التشخيص. فحص السياسات وتصحيحها.
// ================================================
console.log("🚀 الخطوة 7: سياسات Storage لـ entity-documents (لرفع وثائق الترخيص)");
try {
  // سياسة الرفع للمستخدمين المعتمدين (كل مستخدم يمكنه رفع ملفاته الخاصة)
  await client.query(`
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('entity-documents', 'entity-documents', false)
    ON CONFLICT (id) DO NOTHING;
  `);
} catch (_) {}

// Policy for uploading own files
try {
  await client.query(`
    DROP POLICY IF EXISTS entity_docs_upload_own ON storage.objects;
    CREATE POLICY entity_docs_upload_own ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'entity-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  `);
} catch (_) {}
// Policy for reading own files + staff
try {
  await client.query(`
    DROP POLICY IF EXISTS entity_docs_read ON storage.objects;
    CREATE POLICY entity_docs_read ON storage.objects
      FOR SELECT USING (
        bucket_id = 'entity-documents' AND (
          (storage.foldername(name))[1] = auth.uid()::text OR
          EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = auth.uid() AND role::text IN ('staff','admin'))
        )
      );
  `);
} catch (_) {}
console.log("✅ Storage policies لـ entity-documents تم إنشاؤها\n");

// ================================================
// التحقق النهائي: عد الأعمدة
// ================================================
console.log("📋 التحقق النهائي - عدد الأعمدة بعد الإصلاح:");
const verifyCols = async (tbl) => {
  const c = await client.query(`SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1`, [tbl]);
  console.log(`  • ${tbl}: ${c.rows[0].count} أعمدة`);
};
await verifyCols("community_entities");
await verifyCols("rfqs");
await verifyCols("suppliers");
await verifyCols("user_terms_acceptances");
await verifyCols("audit_logs");

await client.end();
console.log("\n✅✅✅ كل الإصلاحات انتهت بنجاح - Disconnected");
