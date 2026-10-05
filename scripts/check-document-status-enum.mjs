// ============================================================
// فحص: قيم enum document_status_enum + إضافة أي قيم مفقودة
// (كما نضيف قيم approved/rejected للـ enum القديمة)
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

async function addEnumValue(enumName, value) {
  try {
    await client.query(`ALTER TYPE public.${enumName} ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`  ✅ ${enumName}: القيمة ${value} مضافة/موجودة`);
  } catch (e) {
    const msg = (e.message || "").toLowerCase();
    if (/already exists|enum label/i.test(msg)) {
      console.log(`  ℹ️  ${enumName}: القيمة ${value} موجودة بالفعل`);
    } else {
      console.log(`  ⚠️  ${enumName}: ${value} — ${e.message.substring(0, 120)}`);
    }
  }
}

try {
  await client.connect();
  console.log("✅ Connected\n");

  const enumsList = [
    "document_status_enum",
    "approval_status_enum",
    "approval_type_enum",
    "community_entity_status_enum",
    "supplier_status_enum",
    "rfq_status_enum",
  ];
  for (const en of enumsList) {
    try {
      const vals = await client.query(
        `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname=$1) ORDER BY enumsortorder`,
        [en]
      );
      const labels = vals.rows.map((r) => r.enumlabel);
      if (labels.length === 0) {
        console.log(`\n  ℹ️  النوع ${en} غير موجود في pg_type (قد يكون TEXT بدلاً من ENUM)`);
      } else {
        console.log(`\n  النوع ${en}: [${labels.join(", ")}]`);
      }
    } catch (e) {
      console.log(`\n  ⚠️  النوع ${en}: ${e.message.substring(0, 100)}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("إضافة قيم مفقودة لـ document_status_enum");
  console.log("=".repeat(60));
  await addEnumValue("document_status_enum", "pending");
  await addEnumValue("document_status_enum", "pending_verification");
  await addEnumValue("document_status_enum", "verified");
  await addEnumValue("document_status_enum", "rejected");
  await addEnumValue("document_status_enum", "failed");
  await addEnumValue("document_status_enum", "expired");

  process.exit(0);
} catch (e) {
  console.error("Fatal:", e && e.message ? e.message : e);
  process.exit(1);
}
