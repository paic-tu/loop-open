// ============================================================
// التحقق النهائي بعد اعتماد فرصة RFQ عبر صفحة الاعتمادات
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
  console.log("✅ Connected\n");

  // 1) حالة فرصة RFQ بعد الاعتماد
  console.log("=".repeat(60));
  console.log("1) حالة فرصة توريد سلال غذائية بعد اعتمادها من لوحة الإدارة");
  console.log("=".repeat(60));
  const rfqs = await client.query(`
    SELECT id, title, status, is_open, approved_at, published_at, rejected_at,
           rejection_reason, entity_name, category, region, city, sector,
           created_at, updated_at, deadline
    FROM public.rfqs
    WHERE title ILIKE '%سلال%'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  if (rfqs.rows.length === 0) console.log("⚠️  لم يتم العثور على فرصة سلال غذائية");
  else {
    const r = rfqs.rows[0];
    console.log("  الأساسيات:");
    console.log(`    ID:           ${r.id}`);
    console.log(`    العنوان:      ${r.title}`);
    console.log(`    الجهة:        ${r.entity_name}`);
    console.log(`    المنطقة:      ${r.region} / ${r.city}`);
    console.log(`    القطاع:       ${r.sector} | التصنيف: ${r.category}`);
    console.log("\n  الحالة (أهم ما يخص عملية الاعتماد):");
    const statusOK = r.status === "published";
    const isOpenOK = r.is_open === true;
    const appAtOK = r.approved_at !== null;
    const pubAtOK = r.published_at !== null;
    console.log(`    status:       ${r.status} ${statusOK ? "✅ مطابق (published)" : "❌ غير مطابق!"}`);
    console.log(`    is_open:      ${r.is_open} ${isOpenOK ? "✅ true" : "❌"}`);
    console.log(`    approved_at:  ${r.approved_at} ${appAtOK ? "✅ محدد" : "❌ لا يزال NULL!"}`);
    console.log(`    published_at: ${r.published_at} ${pubAtOK ? "✅ محدد" : "❌ لا يزال NULL!"}`);
    console.log(`    rejected_at:  ${r.rejected_at} ${r.rejected_at === null ? "✅ NULL (صحيح للاعتماد)" : "❌ لا يجب أن يكون محدداً للعملية المعتمدة"}`);
    console.log(`    deadline:     ${r.deadline}`);
    console.log(`    created_at:   ${r.created_at}`);
    console.log(`    updated_at:   ${r.updated_at}`);
    const passes = [statusOK, isOpenOK, appAtOK, pubAtOK].filter(Boolean).length;
    console.log(`\n  🎯 نجاح الاعتماد: ${passes}/4 نقاط`);
  }

  // 2) جدول approvals — سجل الاعتماد الجديد
  console.log("\n" + "=".repeat(60));
  console.log("2) جدول approvals (سجل التتبع للاعتمادات)");
  console.log("=".repeat(60));
  const app = await client.query(`
    SELECT id, entity_type, entity_id, status, reviewer_id,
           reviewed_at, created_at, type, target_id, applicant_id, reason
    FROM public.approvals
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log(`   عدد السجلات الآن: ${app.rows.length}`);
  if (app.rows.length > 0) {
    console.table(app.rows.map((r) => ({
      id: r.id?.substring(0, 8),
      entity_type: r.entity_type,
      status: r.status,
      reviewer_id: r.reviewer_id?.substring(0, 8) || null,
      reviewed_at: r.reviewed_at ? "✅ موجود" : null,
      created_at: r.created_at,
    })));
    const last = app.rows[0];
    if (last.entity_type === "rfqs" && last.status === "published") {
      console.log(`   ✅ آخر سجل هو لـ rfqs بحالة published — هذا هو سجل الاعتماد الجديد!`);
    } else if (last.entity_type && last.status) {
      console.log(`   ℹ️  آخر سجل: entity_type=${last.entity_type}, status=${last.status}`);
    }
  } else console.log("   ⚠️  لا توجد سجلات — فشل إدراج سجل الاعتماد (لكن التحديث الرئيسي نجح!)");

  // 3) جدول audit_logs
  console.log("\n" + "=".repeat(60));
  console.log("3) جدول audit_logs (سجل التدقيق)");
  console.log("=".repeat(60));
  const audits = await client.query(`
    SELECT id, action, entity_type, entity_id, actor_id, created_at, meta::text AS meta_text
    FROM public.audit_logs
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.log(`   عدد السجلات الآن: ${audits.rows.length}`);
  if (audits.rows.length > 0) {
    console.table(audits.rows.map((r) => ({
      id: r.id?.substring(0, 8),
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id?.substring(0, 8),
      actor_id: r.actor_id?.substring(0, 8),
      created_at: r.created_at,
      has_meta: r.meta_text && r.meta_text !== "{}" ? "✅" : "—",
    })));
    const last = audits.rows[0];
    if (last.action === "rfqs.published" || last.action === "rfqs.approved") {
      console.log(`   ✅ آخر فعل تدقيق هو لـ RFQ معتمدة/منشورة — الإجراء متتبع!`);
    } else {
      console.log(`   ℹ️  آخر فعل تدقيق: ${last.action} على entity_type=${last.entity_type}`);
    }
  }

  // 4) ملخص الحالة العامة لجداول الاعتمادات
  console.log("\n" + "=".repeat(60));
  console.log("4) ملخص عام الحالة النهائية");
  console.log("=".repeat(60));
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.rfqs) AS rfq,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='pending') AS rfq_pend,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='published') AS rfq_pub,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='rejected') AS rfq_rej,
      (SELECT COUNT(*) FROM public.community_entities) AS ce,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='approved') AS ce_ok,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='pending') AS ce_pend,
      (SELECT COUNT(*) FROM public.suppliers) AS sup,
      (SELECT COUNT(*) FROM public.approvals) AS app
  `);
  const c = counts.rows[0];
  console.log(`   جهات المجتمع: ${c.ce} (معتمد:${c.ce_ok} | في الانتظار:${c.ce_pend})`);
  console.log(`   موردون/مقدمون: ${c.sup}`);
  console.log(`   فرص RFQ: ${c.rfq} (منشورة:${c.rfq_pub} | في الانتظار:${c.rfq_pend} | مرفوضة:${c.rfq_rej})`);
  console.log(`   سجلات الاعتمادات: ${c.app}`);

  process.exit(0);
} catch (e) {
  console.error("Fatal error:", e && e.message ? e.message : e);
  process.exit(1);
}
