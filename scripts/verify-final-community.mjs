// ============================================================
// Verify aux tables counts (uta + audit_logs) + final summary
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

  // Helper to inspect columns
  const getCols = async (tbl) => (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' ORDER BY ordinal_position`)).rows.map(r => r.column_name);

  const utaCols = await getCols('user_terms_acceptances');
  console.log(`✅ user_terms_acceptances columns: ${utaCols.join(', ')}`);
  const utaCount = (await client.query(`SELECT COUNT(*) FROM public.user_terms_acceptances`)).rows[0].count;
  console.log(`   عدد الموافقات: ${utaCount}`);
  if (utaCount > 0) {
    const rows = await client.query(`SELECT * FROM public.user_terms_acceptances ORDER BY ${utaCols.includes('created_at')?'created_at':utaCols[0]} DESC LIMIT 2`);
    console.table(rows.rows);
  }

  console.log("");
  const auditCols = await getCols('audit_logs');
  console.log(`✅ audit_logs columns: ${auditCols.join(', ')}`);
  const auditCount = (await client.query(`SELECT COUNT(*) FROM public.audit_logs`)).rows[0].count;
  console.log(`   عدد سجلات التدقيق: ${auditCount}`);
  if (auditCount > 0) {
    const rows = await client.query(`SELECT * FROM public.audit_logs ORDER BY ${auditCols.includes('created_at')?'created_at':auditCols[0]} DESC LIMIT 3`);
    console.table(rows.rows);
  }

  // Final RFQ summary
  console.log("\n========== RESULTADO FINAL /community ==========");
  const rfq = (await client.query(`SELECT title, status, entity_name, region, city, budget, sector, category, owner_id IS NOT NULL AS has_owner, created_at FROM public.rfqs ORDER BY created_at DESC LIMIT 1`)).rows[0];
  console.log(`\n🎯 FRAP CREATE (انشاء الطلب):`);
  console.log(`   العنوان: ${rfq.title}`);
  console.log(`   الحالة: ${rfq.status}`);
  console.log(`   الجهة: ${rfq.entity_name} (${rfq.region}, ${rfq.city})`);
  console.log(`   الميزانية: ${rfq.budget} | القطاع: ${rfq.sector} | التصنيف: ${rfq.category}`);
  console.log(`   تاريخ الإنشاء: ${rfq.created_at}`);
  console.log(`\n✅ الحالة: ${rfq.status === 'pending' ? 'الطلب موجود في قاعدة البيانات بالحالة pending وسيظهر في قسم الاعتمادات في لوحة التحكم' : 'غير متوقع'}`);
  console.log(`✅ ملخص الإصلاحات التي تم تطبيقها لهذا الإنجاز:`);
  console.log(`   1. +23 عمود مفقود في community_entities/rfqs/suppliers + backfill بيانات قديمة`);
  console.log(`   2. جدول جديد user_terms_acceptances + 2 سياسات RLS + GRANTs`);
  console.log(`   3. إعادة هيكلة جدول audit_logs +4 أعمدة + backfill + 2 سياسات RLS`);
  console.log(`   4. إصلاح حرج سياسات RLS rfqs لتقبل user_id OR owner_id`);
  console.log(`   5. إضافة قيمة 'pending' إلى rfq_status_enum + تغيير DEFAULT status='pending'`);
  console.log(`   6. سياسات Storage لحاوية entity-documents`);
  console.log(`   7. DROP NOT NULL عن 15 عمود قديم/اختياري (نمط مشابه لحجوزات)`);
  console.log(`   8. إضافة 2 قيود UNIQUE(user_id) + 4 FKs إلى auth.users + Seed جهة مدير معتمدة`);

  process.exit(0);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
}
