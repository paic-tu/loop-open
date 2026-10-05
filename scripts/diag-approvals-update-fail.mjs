// ============================================================
// تشخيص سبب "تعذر تحديث الحالة" في صفحة الاعتمادات /admin/approvals
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
  console.log("✅ Connected to Supabase DB directly (SSL 5432)\n");

  // 1) هل جدول approvals موجود؟
  console.log("=".repeat(60));
  console.log("1) جدول approvals (الذي يحاول الكود الإدراج فيه)");
  console.log("=".repeat(60));
  const approvalsExists = (await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema='public' AND table_name='approvals'
    ) AS e
  `)).rows[0].e;
  console.log(`   موجود؟ ${approvalsExists ? "✅ نعم" : "❌ لا — هذا يفشل أي إدراج ويؤدي إلى الخطأ!"}`);

  if (approvalsExists) {
    const cols = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='approvals' ORDER BY ordinal_position`);
    console.table(cols.rows);
  }

  // 2) أعمدة rfqs
  console.log("\n" + "=".repeat(60));
  console.log("2) أعمدة الجداول الأساسية مطلوبة من الكود (AdminMarketplace.tsx)");
  console.log("=".repeat(60));
  for (const { tbl, needed, cols } of [
    {
      tbl: "rfqs",
      cols: [
        { col: "id" },
        { col: "title" },
        { col: "entity_name" },
        { col: "category" },
        { col: "city" },
        { col: "region" },
        { col: "sector" },
        { col: "status" },
        { col: "deadline", note: "يستخدمه السطر 122 — قد يكون اسمه deadline_date في reality" },
        { col: "requires_openloop_review" },
        { col: "approved_at", note: "يُعين عند الاعتماد سطر 175" },
        { col: "is_open", note: "يعين true عند الاعتماد / false عند الرفض" },
        { col: "rejection_reason", note: "يعين عند الرفض سطر 183" },
        { col: "published_at" },
        { col: "rejected_at" },
      ],
    },
    {
      tbl: "suppliers",
      cols: [
        { col: "id" },
        { col: "company_name" },
        { col: "cr_number", note: "السطر 110 — قد يكون اسمه license_number" },
        { col: "category" },
        { col: "region" },
        { col: "status" },
      ],
    },
    {
      tbl: "community_entities",
      cols: [
        { col: "id" },
        { col: "entity_name" },
        { col: "entity_type" },
        { col: "license_number" },
        { col: "status" },
        { col: "region" },
        { col: "is_verified", note: "يعين true عند الاعتماد سطر 71" },
      ],
    },
  ]) {
    console.log(`\n   — جدول ${tbl}:`);
    const existCols = (await client.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [tbl]
    )).rows;
    const existColSet = new Set(existCols.map((c) => c.column_name));
    for (const { col, note } of cols) {
      const exists = existColSet.has(col);
      const mark = exists ? "✅" : "❌";
      console.log(`     ${mark} ${col}${note ? ` (${note})` : ""} ${!exists ? "— مفقود!" : ""}`);
    }
    // إظهار عمود status نوعه إن وجد
    const statusRow = existCols.find((c) => c.column_name === "status");
    if (statusRow) {
      console.log(
        `     ℹ️  نوع عمود status: ${statusRow.data_type}${
          statusRow.column_default ? ` (DEFAULT: ${statusRow.column_default})` : ""
        } | NULLABLE: ${statusRow.is_nullable}`
      );
    }
  }

  // 3) قيم enum rfq_status_enum و community_entity_status_enum و supplier_status_enum
  console.log("\n" + "=".repeat(60));
  console.log("3) قيم الأنواع المعدّة (Enum) المطلوبة: approved/rejected/published");
  console.log("=".repeat(60));
  const enumNames = ["rfq_status_enum", "community_entity_status_enum", "supplier_status_enum"];
  for (const en of enumNames) {
    try {
      const vals = await client.query(
        `SELECT enumlabel FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname=$1) ORDER BY enumsortorder`,
        [en]
      );
      const list = vals.rows.map((r) => r.enumlabel);
      const marks = [];
      if (en === "rfq_status_enum") for (const v of ["published", "rejected"]) if (!list.includes(v)) marks.push(`❌ مفقود: ${v}`);
      else for (const v of ["approved", "rejected"]) if (!list.includes(v)) marks.push(`❌ مفقود: ${v}`);
      console.log(`   ${en}: [${list.join(", ")}] ${marks.length ? "— " + marks.join(" و ") : "✅ جميع القيم المطلوبة موجودة"}`);
    } catch {
      console.log(`   ℹ️  النوع ${en} غير موجود (قد يكون عمود status TEXT وليس ENUM)`);
    }
  }

  // 4) سياسات RLS لكل جدول
  console.log("\n" + "=".repeat(60));
  console.log("4) سياسات RLS (UPDATE هي السبب الأكثر تكراراً لخطأ تعذر التحديث)");
  console.log("=".repeat(60));
  for (const tbl of ["community_entities", "suppliers", "rfqs", "approvals", "audit_logs"]) {
    const tblExists = (await client.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}') AS e`)).rows[0].e;
    if (!tblExists) {
      console.log(`\n   جدول ${tbl}: ❌ غير موجود`);
      continue;
    }
    const rls = (await client.query(`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='public.${tbl}'::regclass`)).rows[0].enabled;
    const rlsStr = rls ? "ENABLED" : "DISABLED";
    console.log("\n   — جدول " + tbl + " (RLS=" + rlsStr + "):");
    const policies = await client.query(`
      SELECT polname, polcmd,
             array_to_string(polroles::regrole[], ',') AS roles,
             pg_get_expr(polqual, polrelid) AS using,
             pg_get_expr(polwithcheck, polrelid) AS withcheck
      FROM pg_policy WHERE polrelid='public.${tbl}'::regclass ORDER BY polcmd, polname`);
    if (policies.rows.length === 0) console.log("     ⚠️  0 سياسات!");
    else for (const p of policies.rows) {
      const isUpdate = p.polcmd.includes("r") ? "READ" : p.polcmd.includes("w") ? "WRITE/UPDATE" : p.polcmd === "*" ? "ALL" : p.polcmd.toUpperCase();
      console.log(`     [${isUpdate}] ${p.polname}  roles=[${p.roles}]`);
      if (p.using) console.log(`       USING: ${String(p.using).slice(0,140)}`);
      if (p.withcheck) console.log(`       WITH CHECK: ${String(p.withcheck).slice(0,140)}`);
    }
  }

  process.exit(0);
} catch (e) {
  console.error("Fatal error:", e && e.message ? e.message : e);
  process.exit(1);
}
