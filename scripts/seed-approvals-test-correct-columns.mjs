// ============================================================
// إنشاء سجلات اختبار بحالة PENDING للثلاثة أنواع (CE + SUP + RFQ)
// باستخدام الأعمدة الحقيقية الموجودة فقط في الجداول حالياً
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

function run(label, sql, params) {
  return client
    .query(sql, params || [])
    .then(() => console.log(`  ✅ ${label}`))
    .catch((e) => {
      if (/already exists|duplicate key/i.test(e.message || "")) {
        console.log(`  ℹ️  ${label} — موجود بالفعل`);
      } else {
        console.log(`  ⚠️  ${label}: ${(e.message || "").substring(0, 140)}`);
      }
    });
}

try {
  await client.connect();
  console.log("✅ Connected\n");

  // جلب المستخدمين
  const users = await client.query(
    `SELECT id, email FROM auth.users WHERE email IN ('admin@open-loopsa.com','user@open-loopsa.com','staff@open-loopsa.com') ORDER BY email`
  );
  const admin = users.rows.find((u) => u.email === "admin@open-loopsa.com");
  const user = users.rows.find((u) => u.email === "user@open-loopsa.com");
  const staff = users.rows.find((u) => u.email === "staff@open-loopsa.com");
  console.log(`   المستخدمون: admin=${admin?.id?.substring(0, 8)}, user=${user?.id?.substring(0, 8)}, staff=${staff?.id?.substring(0, 8)}`);

  // 1) جهات مجتمعية جديدة بحالة pending — فقط الأعمدة الموجودة فعلياً في جدول community_entities
  console.log("\n========== 1) جهات مجتمعية جديدة PENDING ==========");
  const ceCols = `id, user_id, entity_name, entity_type, license_number, region, field, description, status, is_verified, document_status, created_at, updated_at`;
  await run(
    "جهة 1: مؤسسة رواد الخير للتنمية المجتمعية (جدة)",
    `INSERT INTO public.community_entities (${ceCols}) VALUES (
      gen_random_uuid(), $1,
      'مؤسسة رواد الخير للتنمية المجتمعية',
      'مؤسسة أهلية', '3300078119',
      'مكة المكرمة', 'برامج تنمية الأسرة ومحو الأمية',
      'نسعى لتحقيق تنمية مستدامة من خلال برامج تمكينية للأسرة في محافظات جدة.',
      'pending', false, 'pending_verification', now(), now()
    )`,
    [staff?.id || admin?.id]
  );
  await run(
    "جهة 2: نادي أصحاب الحرف اليدوية بالمدينة المنورة",
    `INSERT INTO public.community_entities (${ceCols}) VALUES (
      gen_random_uuid(), $1,
      'نادي أصحاب الحرف اليدوية بالمدينة المنورة',
      'جمعية أهلية', '4400055112',
      'المدينة المنورة', 'صناعات يدوية وحرفية تقليدية',
      'نادي مهني يضمّ 240 حرفياً من أبناء المدينة ويعمل على تطوير منتجاتهم وتسويقها محلياً ودولياً.',
      'pending', false, 'pending_verification', now(), now()
    )`,
    [user?.id || admin?.id]
  );

  // 2) موردين/مقدمي خدمة جدد بحالة pending — فقط الأعمدة الموجودة فعلياً في جدول suppliers
  console.log("\n========== 2) موردين جدد PENDING ==========");
  const supCols = `id, user_id, company_name, cr_number, category, region, city, description, status, is_verified, document_status, created_at, updated_at`;
  await run(
    "مورد 1: شركة سماء لخدمات الأحداث والتجهيزات الفنية",
    `INSERT INTO public.suppliers (${supCols}) VALUES (
      gen_random_uuid(), $1,
      'شركة سماء لخدمات الأحداث والتجهيزات الفنية',
      '1010567890',
      'خدمات إدارة الفعاليات والتجهيزات',
      'الرياض', 'الرياض',
      'تتخصص الشركة في تنظيم المؤتمرات والمعارض والفعاليات الخيرية والحملات التوعوية، وفريق عملها مكوّن من 45 متخصصاً.',
      'pending', false, 'pending_verification', now(), now()
    )`,
    [user?.id || admin?.id]
  );
  await run(
    "مورد 2: مكتب مسار للمحاسبة والاستشارات الضريبية",
    `INSERT INTO public.suppliers (${supCols}) VALUES (
      gen_random_uuid(), $1,
      'مكتب مسار للمحاسبة والاستشارات الضريبية للجمعيات',
      '7010443211',
      'استشارات مالية وضريبية ومراجعة حسابات',
      'مكة المكرمة', 'جدة',
      'مكتب متخصص بالجمعيات الأهلية: إصدار تراخيص، إقرارات ضريبية، مراجعة مالية سنوية، وتوثيق عقود الوقف والمحاسبة وفق IFRS للمنظمات غير الربحية.',
      'pending', false, 'pending_verification', now(), now()
    )`,
    [staff?.id || admin?.id]
  );

  // 3) فرص RFQ جديدة بحالة pending — فقط الأعمدة الموجودة فعلياً في جدول rfqs
  console.log("\n========== 3) فرص RFQ جديدة PENDING ==========");
  const rfqCols = `id, owner_id, title, entity_name, category, region, city, sector, budget, description, status, is_open, requires_openloop_review, deadline, metadata, created_at, updated_at`;
  await run(
    "فرصة 1: استشارة صياغة مذكرة تفاهم شراكة تنمية موارد",
    `INSERT INTO public.rfqs (${rfqCols}) VALUES (
      gen_random_uuid(), $1,
      'استشارة صياغة مذكرة تفاهم شراكة استراتيجية لتنمية الموارد',
      'جمعية البر والخير بالمنطقة الشرقية',
      'استشارات تنمية الموارد',
      'المنطقة الشرقية', 'الدمام',
      'تنمية الموارد والوقف',
      '30000 - 50000 ريال',
      'نحتاج فريق عمل استشاري متخصص لصياغة مذكرة تفاهم شراكة بين جمعيتنا و 6 شركات خاصة لبرنامج تنمية موارد مستدام مدته عامين.',
      'pending', false, true,
      '2026-12-15', '{}'::jsonb, now(), now()
    )`,
    [user?.id || admin?.id]
  );
  await run(
    "فرصة 2: برنامج تدريبي إعداد قادة الجمعيات الأهلية لمواجهة الكوارث",
    `INSERT INTO public.rfqs (${rfqCols}) VALUES (
      gen_random_uuid(), $1,
      'برنامج تدريبي إعداد قادة الجمعيات الأهلية لمواجهة الكوارث والطوارئ',
      'الهيئة الوطنية لإدارة الطوارئ والأزمات والكوارث',
      'تدريب وتطوير',
      'الرياض', 'الرياض',
      'التدريب المؤسسي',
      '80000 - 120000 ريال',
      'نبحث عن مقدم تدريب معتمد لتقديم 4 ورش تدريبية لمدة 3 أيام لكل ورشة تستهدف 120 قائد وقيادية من 18 جمعية أهلية بالرياض ومكة المكرمة.',
      'pending', false, true,
      '2027-01-20', '{}'::jsonb, now(), now()
    )`,
    [admin?.id]
  );

  // ملخص بعد الإضافة
  console.log("\n========== 4) ملخص الحالة النهائية ==========");
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.community_entities) AS ce,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='pending') AS ce_p,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='approved') AS ce_a,
      (SELECT COUNT(*) FROM public.suppliers) AS s,
      (SELECT COUNT(*) FROM public.suppliers WHERE status='pending') AS s_p,
      (SELECT COUNT(*) FROM public.rfqs) AS r,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='pending') AS r_p,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='published') AS r_pub
  `);
  const c = counts.rows[0];
  console.log(`   جهات مجتمعية: ${c.ce} (جديدة:${c.ce_p} / معتمدة:${c.ce_a})`);
  console.log(`   موردين/مقدمين: ${c.s} (جديدة:${c.s_p})`);
  console.log(`   فرص RFQ:      ${c.r} (جديدة:${c.r_p} / منشورة:${c.r_pub})`);

  console.log("\n✅ Exit=0 — تم إنشاء سجلات اختبار جديدة بشكل صحيح، الآن صفحة الاعتمادات تحتوي على عناصر للاختبار!");
  process.exit(0);
} catch (e) {
  console.error("Fatal:", e && e.message ? e.message : e);
  process.exit(1);
}
