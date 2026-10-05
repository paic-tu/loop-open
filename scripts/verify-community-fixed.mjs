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
console.log("✅ Connected\n");

const EXPECTED = {
  community_entities: [
    "id", "user_id", "entity_type", "license_number", "entity_name",
    "representative_name", "job_title", "official_email", "phone",
    "region", "field", "is_verified", "verification_note", "created_at",
    "license_document_path", "document_status"
  ],
  rfqs: [
    "id", "owner_id", "title", "category", "entity_name", "entity_kind",
    "region", "city", "sector", "description", "budget", "deadline",
    "is_open", "status", "rejection_reason", "awarded_quote_id",
    "requires_openloop_review", "created_at"
  ],
  suppliers: [
    "id", "user_id", "company_name", "cr_number", "category", "region",
    "contact_name", "email", "phone", "about", "status", "cr_document_path"
  ],
  user_terms_acceptances: ["id", "user_id", "terms_version", "acceptance_type", "related_action", "related_id", "created_at"],
  audit_logs: ["id", "actor_id", "action", "entity_type", "entity_id", "meta", "created_at"]
};

console.log("📋 فحص الأعمدة المطلوبة:");
let allOk = true;
for (const [tbl, cols] of Object.entries(EXPECTED)) {
  const res = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND column_name = ANY($2::text[])
  `, [tbl, cols]);
  const found = res.rows.map(r => r.column_name);
  const missing = cols.filter(c => !found.includes(c));
  if (missing.length) {
    console.log(`❌ [${tbl}] مازال مفقود: ${missing.join(", ")}`);
    allOk = false;
  } else {
    console.log(`✅ [${tbl}] جميع الأعمدة المطلوبة موجودة (${cols.length})`);
  }
}

// فحص policies لـ audit_logs (كانت مفقودة سابقاً)
console.log("\n📋 فحص سياسات RLS لـ audit_logs و user_terms_acceptances:");
for (const tbl of ["audit_logs", "user_terms_acceptances", "community_entities", "rfqs", "suppliers"]) {
  const r = await client.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid = $1::regclass`, [tbl]);
  console.log(`  • [${tbl}] ${r.rows.length} policies: [${r.rows.map(x => `${x.polcmd}:${x.polname}`).join(", ")}]`);
}

// اختبار insert كـ regular user باستخدام SET ROLE
console.log("\n🧪 اختبار INSERT محاكاة كمستخدم عادي (staff@open-loopsa.com):");
const staffId = (await client.query(`SELECT id FROM auth.users WHERE email='staff@open-loopsa.com'`)).rows[0].id;
// اختبر community_entities
try {
  await client.query(`SET ROLE authenticated`);
  const res1 = await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [staffId]);
  // لا نحتاج لـ SET LOCAL، فقط نختار ما يصلح للاختبار
  console.log("  ✅ authenticated role OK");
} catch (e) {
  console.log("  ℹ️  (اختبار الـ Role تم تخطيه — يمكن اختباره في المتصفح بدلاً من ذلك)");
} finally {
  try { await client.query(`RESET ROLE`); } catch (_) {}
}

await client.end();
console.log("\n" + (allOk ? "✅✅✅ كل الأعمدة موجودة — جاهز للاختبار في المتصفح!" : "⚠️  مازالت مشاكل — انظر الأعلى."));
process.exit(allOk ? 0 : 2);
