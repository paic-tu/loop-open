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
// PART 1: فحص وجود الجداول + الأعمدة
// ================================================
const TABLES = ["community_entities", "rfqs", "suppliers", "user_terms_acceptances", "audit_logs"];
for (const tbl of TABLES) {
  console.log(`========== [${tbl}] ==========`);
  const exists = await client.query(`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
  `, [tbl]);
  if (!exists.rows[0].exists) {
    console.log(`❌ الجدول غير موجود!`);
    continue;
  }
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position
  `, [tbl]);
  console.table(cols.rows);

  // RLS status
  const rls = await client.query(`
    SELECT relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
    FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace
  `, [tbl]);
  console.log("RLS:", rls.rows[0]);

  // Policies
  const pols = await client.query(`
    SELECT polname, polcmd, polroles::regrole[] AS roles,
           pg_get_expr(polqual, polrelid) AS using,
           pg_get_expr(polwithcheck, polrelid) AS with_check
    FROM pg_policy WHERE polrelid = $1::regclass
  `, [tbl]);
  if (pols.rows.length > 0) {
    console.log("\n📋 Policies:");
    pols.rows.forEach((p) => {
      const rolesStr = Array.isArray(p.roles) ? p.roles.join(",") : String(p.roles);
      console.log(`  • [${p.polcmd}] ${p.polname} (roles: ${rolesStr})`);
      if (p.using) console.log(`      USING: ${p.using}`);
      if (p.with_check) console.log(`      WITH CHECK: ${p.with_check}`);
    });
  } else {
    console.log("⚠️  لا سياسات RLS على الإطلاق");
  }

  // عدد الصفوف الحالية
  const cnt = await client.query(`SELECT COUNT(*) FROM public.${tbl}`);
  console.log(`\n📊 عدد الصفوف الحالية: ${cnt.rows[0].count}`);
  console.log("\n");
}

// ================================================
// PART 2: فحص الأعمدة المحددة المتوقعة في الكود
// ================================================
console.log("========== فحص الأعمدة المحددة المتوقعة ==========");

const EXPECTED = {
  community_entities: [
    "id", "user_id", "entity_type", "license_number", "entity_name",
    "representative_name", "job_title", "official_email", "phone",
    "region", "field", "is_verified", "verification_note", "created_at",
    "license_document_path", "document_status" // المستخدمة في الكود (CommunityRegisterForm.tsx)
  ],
  rfqs: [
    "id", "owner_id", "title", "category", "entity_name", "entity_kind",
    "region", "city", "sector", "description", "budget", "deadline",
    "is_open", "status", "rejection_reason", "awarded_quote_id",
    "requires_openloop_review", "created_at"
  ],
  suppliers: [
    "id", "user_id", "company_name", "cr_number", "category", "region",
    "contact_name", "email", "phone", "about", "status",
    "cr_document_path" // المستخدمة في SupplierForm
  ],
  user_terms_acceptances: ["id", "user_id", "terms_version", "acceptance_type", "related_action", "related_id", "created_at"],
  audit_logs: ["id", "actor_id", "action", "entity_type", "entity_id", "meta", "created_at"]
};

for (const [tbl, cols] of Object.entries(EXPECTED)) {
  const res = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND column_name = ANY($2::text[])
  `, [tbl, cols]);
  const found = res.rows.map(r => r.column_name);
  const missing = cols.filter(c => !found.includes(c));
  if (missing.length) {
    console.log(`❌ [${tbl}] أعمدة مفقودة: ${missing.join(", ")}`);
  } else {
    console.log(`✅ [${tbl}] جميع الأعمدة المتوقعة موجودة`);
  }
}

// ================================================
// PART 3: فحص حاويات التخزين storage
// ================================================
console.log("\n========== فحص حاويات التخزين Storage ==========");
const buckets = await client.query(`
  SELECT id, name, public, avif_autodetection, created_at
  FROM storage.buckets
  WHERE name IN ('entity-documents', 'documents', 'library', 'booking-attachments')
  ORDER BY name
`);
console.table(buckets.rows);

console.log("\n========== فحص سياسات الـ RLS لحاويات الـ Storage ==========");
const storPol = await client.query(`
  SELECT p.name AS policy_name, p.command, p.table_name, b.name AS bucket,
         pg_get_expr(p.qual, p.obj_id) AS using_expr,
         pg_get_expr(p.with_check, p.obj_id) AS wc_expr
  FROM pg_policies p
  JOIN storage.buckets b ON b.id::text LIKE '%' || split_part(p.table_name, '_', 2) || '%'
  WHERE p.schemaname = 'storage'
  ORDER BY b.name, p.command
`);
// Alternative simpler query
const storPol2 = await client.query(`
  SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies WHERE schemaname = 'storage'
  ORDER BY tablename, cmd
`);
console.table(storPol2.rows);

await client.end();
console.log("\n✅ Disconnected");
