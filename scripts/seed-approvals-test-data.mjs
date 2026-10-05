// ============================================================
// إضافة فرص RFQ جديدة في حالة pending للتجربة + جهة مجتمعية pending + مورد pending
// حتى يكون هناك دائماً عناصر لاختبار الاعتمادات
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
    .then((r) => {
      console.log(`  ✅ ${label}`);
      return r;
    })
    .catch((e) => {
      if (/already exists|duplicate key/i.test(e.message)) {
        console.log(`  ℹ️  ${label} — موجود/تم تجاوزه`);
      } else {
        console.log(`  ⚠️  ${label}: ${e.message.substring(0, 140)}`);
      }
      return { rows: [] };
    });
}

try {
  await client.connect();
  console.log("✅ Connected\n");

  // جلب المستخدم العادي user@open-loopsa.com لاستخدامه كمالك
  const users = await client.query(
    `SELECT id, email FROM auth.users WHERE email IN ('admin@open-loopsa.com','user@open-loopsa.com','staff@open-loopsa.com') ORDER BY email`
  );
  const admin = users.rows.find((u) => u.email === "admin@open-loopsa.com");
  const user = users.rows.find((u) => u.email === "user@open-loopsa.com");
  const staff = users.rows.find((u) => u.email === "staff@open-loopsa.com");
  console.log(`   المستخدمون: admin=${admin?.id?.substring(0, 8)}, user=${user?.id?.substring(0, 8)}, staff=${staff?.id?.substring(0, 8)}`);

  // 1) فرصة RFQ جديدة حالتها pending للتجربة
  console.log("\n========== 1) فرص RFQ جديدة pending ==========");
  const rfqOwner = user?.id || admin?.id;
  await run(
    "فرصة: استشارة صياغة مذكرة تفاهم تنمية موارد",
    `
    INSERT INTO public.rfqs (
      id, owner_id, title, entity_name, entity_type, category, sector, region,
      city, budget, deadline, deadline_date, description, status, is_open,
      requires_openloop_review, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'استشارة صياغة مذكرة تفاهم شراكة استراتيجية لتنمية الموارد',
      'جمعية البر والخير بالمنطقة الشرقية',
      'جمعية أهلية',
      'استشارات تنمية الموارد',
      'تنمية الموارد والوقف',
      'المنطقة الشرقية',
      'الدمام',
      '30000 - 50000 ريال',
      '2026-12-15',
      '2026-12-15',
      'نحتاج فريق عمل استشاري متخصص لصياغة مذكرة تفاهم شراكة بين جمعيتنا و 6 شركات خاصة لبرنامج تنمية موارد مستدام لمدة عامين. المطلوب: تحليل احتياجات، وكتابة صياغات قانونية، ووضع مؤشرات قياس للأثر.',
      'pending', false, true, now(), now()
    )
    `,
    [rfqOwner]
  );
  await run(
    "فرصة: ورش تدريبية إعداد كوادر الجمعيات للكوارث",
    `
    INSERT INTO public.rfqs (
      id, owner_id, title, entity_name, entity_type, category, sector, region,
      city, budget, deadline, deadline_date, description, status, is_open,
      requires_openloop_review, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'برنامج تدريبي إعداد قادة الجمعيات الأهلية لمواجهة الكوارث',
      'الهيئة الوطنية لإدارة الطوارئ والأزمات والكوارث',
      'جهة حكومية',
      'تدريب وتطوير',
      'التدريب المؤسسي',
      'الرياض',
      'الرياض',
      '80,000 - 120,000 ريال',
      '2027-01-20',
      '2027-01-20',
      'نبحث عن مقدم تدريب معتمد لتقديم 4 ورش تدريبية لمدة 3 أيام لكل ورشة تستهدف 120 قائد وقيادية من 18 جمعية أهلية بمنطقتي مكة والرياض. الأوراق العمل وملخص النتائج مطلوب.',
      'pending', false, true, now(), now()
    )
    `,
    [rfqOwner]
  );

  // 2) مورد/مقدم خدمة جديد حالته pending للتجربة
  console.log("\n========== 2) موردين جدد pending ==========");
  const supOwner = user?.id || admin?.id;
  await run(
    "مورد: شركة سماء لخدمات الأحداث والتجهيزات الفنية",
    `
    INSERT INTO public.suppliers (
      id, user_id, company_name, license_number, cr_number, category,
      region, city, description, status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'شركة سماء لخدمات الأحداث والتجهيزات الفنية المحدودة',
      '7008890234',
      '1010567890',
      'خدمات إدارة الفعاليات والتجهيزات',
      'الرياض',
      'الرياض',
      'متخصصون في تنظيم وتجهيز المؤتمرات والمعارض والفعاليات الخيرية والحملات التوعوية؛ فريق عمل 45 شخص.',
      'pending', now(), now()
    )
    `,
    [supOwner]
  );
  // مورد ثاني جديد
  await run(
    "مورد: مكتب مسار للمحاسبة والاستشارات الضريبية للجمعيات",
    `
    INSERT INTO public.suppliers (
      id, user_id, company_name, license_number, cr_number, category,
      region, city, description, status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'مكتب مسار للمحاسبة والاستشارات الضريبية',
      '5001200233',
      '7010443211',
      'استشارات مالية وضريبية ومراجعة حسابات',
      'مكة المكرمة',
      'جدة',
      'مكتب متخصص بالجمعيات الأهلية: تراخيص، إقرار ضريبي، مراجعة مالية سنوية، توثيق عقود وقف ومحاسبة على أساس IFRS للمنظمات غير الربحية.',
      'pending', now(), now()
    )
    `,
    [staff?.id || rfqOwner]
  );

  // 3) جهة مجتمعية جديدة pending للتجربة
  console.log("\n========== 3) جهات مجتمعية جديدة pending ==========");
  await run(
    "جهة: مؤسسة رواد الخير للتنمية المجتمعية (جدة)",
    `
    INSERT INTO public.community_entities (
      id, user_id, entity_name, entity_type, license_number, region,
      city, field, status, is_verified, document_status,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'مؤسسة رواد الخير للتنمية المجتمعية',
      'مؤسسة أهلية',
      '3300078119',
      'مكة المكرمة',
      'جدة',
      'برامج تنمية الأسرة ومحو الأمية',
      'pending', false, 'pending', now(), now()
    )
    `,
    [staff?.id || rfqOwner]
  );
  await run(
    "جهة: نادي أصحاب الحرف اليدوية بالمدينة المنورة",
    `
    INSERT INTO public.community_entities (
      id, user_id, entity_name, entity_type, license_number, region,
      city, field, status, is_verified, document_status,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1,
      'نادي أصحاب الحرف اليدوية بالمدينة المنورة',
      'جمعية أهلية',
      '4400055112',
      'المدينة المنورة',
      'المدينة المنورة',
      'صناعات يدوية وحرفية تقليدية وتسويق المنتجات',
      'pending', false, 'pending', now(), now()
    )
    `,
    [supOwner]
  );

  // 4) ملخص الحالة الآن
  console.log("\n========== 4) ملخص الحالة النهائية ==========");
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.community_entities WHERE status='pending') AS ce_pend,
      (SELECT COUNT(*) FROM public.suppliers WHERE status='pending') AS sup_pend,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='pending') AS rfq_pend,
      (SELECT COUNT(*) FROM public.community_entities WHERE status='approved') AS ce_ok,
      (SELECT COUNT(*) FROM public.suppliers WHERE status='approved') AS sup_ok,
      (SELECT COUNT(*) FROM public.rfqs WHERE status='published') AS rfq_pub
  `);
  const c = counts.rows[0];
  console.log(`   جهات مجتمعية: ${Number(c.ce_ok) + Number(c.ce_pend)} (معتمد:${c.ce_ok} / جديد:${c.ce_pend})`);
  console.log(`   موردين/مقدمين: ${Number(c.sup_ok) + Number(c.sup_pend)} (معتمد:${c.sup_ok} / جديد:${c.sup_pend})`);
  console.log(`   فرص RFQ:      ${Number(c.rfq_pub) + Number(c.rfq_pend)} (منشورة:${c.rfq_pub} / جديد:${c.rfq_pend})`);

  console.log("\n✅ Exit=0 — تمت إضافة عناصر جديدة بحالة pending لصفحة الاعتمادات");
  process.exit(0);
} catch (e) {
  console.error("Fatal:", e && e.message ? e.message : e);
  process.exit(1);
}
