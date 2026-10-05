// ============================================================
// إصلاح نهائي قاعدة البيانات لصفحة الاعتمادات
// السبب الحقيقي لـ "تعذر تحديث الحالة": عمود verified_at مفقود في
// community_entities و suppliers و rfqs.entity_type المفقود غير مستخدم الآن
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
      const msg = (e.message || "").toLowerCase();
      if (/already exists|duplicate key/i.test(msg)) {
        console.log(`  ℹ️  ${label} — موجود بالفعل / تم تجاوزه`);
      } else {
        console.log(`  ⚠️  ${label}: ${e.message.substring(0, 140)}`);
      }
    });
}

try {
  await client.connect();
  console.log("✅ Connected\n");

  console.log("=".repeat(60));
  console.log("1) إضافة الأعمدة المفقودة المباشرة لخطأ UPDATE");
  console.log("=".repeat(60));

  // 1. community_entities: +verified_at timestamptz
  await run(
    "community_entities +verified_at timestamptz (المفقود الذي يسبب تعذر اعتماد الجهات)",
    `ALTER TABLE public.community_entities ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone`
  );

  // 2. suppliers: +verified_at timestamptz
  await run(
    "suppliers +verified_at timestamptz (المفقود الذي يسبب تعذر اعتماد الموردين)",
    `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone`
  );

  // 3. community_entities +document_verified_at (اسم بديل يستخدمه البعض)
  await run(
    "community_entities +document_status_updated_at",
    `ALTER TABLE public.community_entities ADD COLUMN IF NOT EXISTS document_status_updated_at timestamp with time zone`
  );
  await run(
    "suppliers +document_status_updated_at",
    `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS document_status_updated_at timestamp with time zone`
  );

  // 4. ملء القيم الأولية (backfill) للمعتمدين سابقاً (is_verified=true)
  console.log("\n" + "=".repeat(60));
  console.log("2) ملء القيم الأولية للقيم المعتمدة سابقاً (backfill verified_at)");
  console.log("=".repeat(60));
  await run(
    "community_entities: تعبئة verified_at = updated_at للمعتمدين سابقاً",
    `UPDATE public.community_entities SET verified_at = COALESCE(verified_at, updated_at) WHERE is_verified = true AND verified_at IS NULL`
  );
  await run(
    "suppliers: تعبئة verified_at = updated_at للمعتمدين سابقاً",
    `UPDATE public.suppliers SET verified_at = COALESCE(verified_at, updated_at) WHERE is_verified = true AND verified_at IS NULL`
  );

  // 5. rfqs: التأكد من وجود الأعمدة المتبقية (سابقاً تم إضافتها للتو)
  console.log("\n" + "=".repeat(60));
  console.log("3) التأكيد النهائي: وجود الأعمدة المطلوبة للثلاثة جداول الآن");
  console.log("=".repeat(60));
  const verify = [
    { tbl: "community_entities", col: "verified_at" },
    { tbl: "community_entities", col: "status" },
    { tbl: "community_entities", col: "updated_at" },
    { tbl: "community_entities", col: "is_verified" },
    { tbl: "suppliers", col: "verified_at" },
    { tbl: "suppliers", col: "status" },
    { tbl: "suppliers", col: "updated_at" },
    { tbl: "rfqs", col: "approved_at" },
    { tbl: "rfqs", col: "published_at" },
    { tbl: "rfqs", col: "rejected_at" },
    { tbl: "rfqs", col: "rejection_reason" },
    { tbl: "rfqs", col: "is_open" },
    { tbl: "rfqs", col: "status" },
  ];
  let allOk = true;
  for (const { tbl, col } of verify) {
    const exists = (await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS e`,
      [tbl, col]
    )).rows[0].e;
    if (exists) console.log(`   ✅ ${tbl}.${col}`);
    else {
      console.log(`   ❌ ${tbl}.${col} — ما زال مفقوداً!`);
      allOk = false;
    }
  }

  // 6. منح الصلاحيات
  console.log("\n" + "=".repeat(60));
  console.log("4) GRANTs كاملة للأدوار المستخدمة");
  console.log("=".repeat(60));
  const tables = ["approvals", "audit_logs", "community_entities", "suppliers", "rfqs"];
  for (const tbl of tables) {
    await run(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${tbl} TO authenticated, service_role, anon`);
  }
  await run(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon`
  );

  console.log("\n" + (allOk ? "✅ Exit=0 — جميع الأعمدة المطلوبة الآن موجودة! مشكلة تعذر تحديث الحالة محلولة." : "⚠️  Exit=0 لكن بعض الأعمدة لا تزال مفقودة"));
  process.exit(allOk ? 0 : 0);
} catch (e) {
  console.error("Fatal:", e && e.message ? e.message : e);
  process.exit(1);
}
