// ============================================================
// Verify Community RFQ was created successfully after submit
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

try {
  await client.connect();
  console.log("✅ Connected to Supabase DB directly\n");

  // 1) Check rfqs for the new RFQ
  console.log("========== 1) أحدث 3 فرص RFQ ==========");
  const rfqs = await client.query(`
    SELECT id, title, category, sector, entity_type, entity_name,
           region, city, deadline_date, budget, status, owner_id::text,
           requires_openloop_review, created_at
    FROM public.rfqs
    ORDER BY created_at DESC
    LIMIT 3
  `);
  console.table(rfqs.rows);
  if (rfqs.rows.length > 0) {
    const latest = rfqs.rows[0];
    console.log(`\n📌 آخر فرصة RFQ:`);
    console.log(`   - ID: ${latest.id}`);
    console.log(`   - العنوان: ${latest.title}`);
    console.log(`   - الحالة: ${latest.status}`);
    console.log(`   - الجهة: ${latest.entity_name} (${latest.entity_type})`);
    console.log(`   - المنطقة/المدينة: ${latest.region} / ${latest.city}`);
    console.log(`   - التاريخ: ${latest.deadline_date?.toISOString()?.split('T')[0] || latest.deadline_date}`);
    console.log(`   - الميزانية: ${latest.budget}`);
    console.log(`   - طلب مراجعة Open Loop: ${latest.requires_openloop_review ? 'نعم' : 'لا'}`);
    console.log(`   - الإنشاء: ${latest.created_at}`);
    if (latest.title.includes("الإفطار الصيامي 2026") && latest.status === 'pending') {
      console.log("\n✅ تم العثور على فرصة السلال الغذائية بالحالة pending = نجاح الإنشاء 100% ✅");
    }
  }

  // 2) Check user_terms_acceptances
  console.log("\n========== 2) أحدث 3 موافقات على الشروط ==========");
  const uta = await client.query(`
    SELECT id, user_id::text, terms_version, accepted_at, ip_address
    FROM public.user_terms_acceptances
    ORDER BY accepted_at DESC
    LIMIT 3
  `);
  console.table(uta.rows);

  // 3) Check audit_logs
  console.log("\n========== 3) أحدث 5 سجلات تدقيق audit_logs ==========");
  const audits = await client.query(`
    SELECT id, actor_id::text, action, entity_type, entity_id, created_at
    FROM public.audit_logs
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.table(audits.rows);

  // 4) Summary
  console.log("\n========== 4) ملخص الحالة العامة ==========");
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.community_entities) AS community_entities,
      (SELECT COUNT(*) FROM public.rfqs) AS rfqs,
      (SELECT COUNT(*) FROM public.suppliers) AS suppliers,
      (SELECT COUNT(*) FROM public.user_terms_acceptances) AS uta,
      (SELECT COUNT(*) FROM public.audit_logs) AS audit_logs
  `);
  const c = counts.rows[0];
  console.log(`   - جهات مجتمعية معتمدة/مسجلة: ${c.community_entities}`);
  console.log(`   - إجمالي فرص RFQ: ${c.rfqs}`);
  console.log(`   - موردون/مقدمو خدمات: ${c.suppliers}`);
  console.log(`   - موافقات الشروط: ${c.uta}`);
  console.log(`   - سجلات التدقيق: ${c.audit_logs}`);

  // 5) RLS policies for rfqs
  console.log("\n========== 5) سياسات RLS لجدول rfqs ==========");
  const policies = await client.query(`
    SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck
    FROM pg_policy
    WHERE polrelid = 'public.rfqs'::regclass
  `);
  console.table(policies.rows);

  process.exit(0);
} catch (e) {
  console.error("❌ Fatal error:", e.message);
  process.exit(1);
}
