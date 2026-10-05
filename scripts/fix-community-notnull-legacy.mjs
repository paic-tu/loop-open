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

console.log("🔍 فحص الأعمدة التي ما زالت NOT NULL في الجداول الرئيسية للمجتمع...");
const nnCols = await client.query(`
  SELECT table_name, column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('community_entities','suppliers','rfqs')
    AND is_nullable='NO'
    AND column_name NOT IN ('id','created_at','updated_at')
  ORDER BY table_name, ordinal_position
`);
console.table(nnCols.rows);

console.log("\n🚀 جعل جميع الأعمدة القديمة غير الإلزامية (DROP NOT NULL) مثلما تم في bookings...");

// community_entities: أعمدة قديمة لا يستخدمها الكود الحالي
const ceLegacy = [
  "name", "email", "location", "fields_of_work",
  "representative_phone", "website", "logo_path",
  "document_path", "verification_status"
];
for (const col of ceLegacy) {
  try {
    await client.query(`ALTER TABLE public.community_entities ALTER COLUMN ${col} DROP NOT NULL`);
    console.log(`  ✅ community_entities.${col} — DROP NOT NULL`);
  } catch (e) { console.log(`  ℹ️  community_entities.${col} — ${(e.message||"").substring(0,60)}`); }
}

// rfqs: أعمدة قديمة / اختيارية
const rfqLegacy = [
  "budget_min", "budget_max", "views", "status"
];
for (const col of rfqLegacy) {
  try {
    await client.query(`ALTER TABLE public.rfqs ALTER COLUMN ${col} DROP NOT NULL`);
    console.log(`  ✅ rfqs.${col} — DROP NOT NULL`);
  } catch (e) { console.log(`  ℹ️  rfqs.${col} — ${(e.message||"").substring(0,60)}`); }
}

// suppliers: أعمدة قديمة لا يستخدمها الكود الحالي
const supLegacy = [
  "categories", "city", "user_id", "company_name",
  "contact_email", "phone", "address", "logo_path",
  "registration_number", "document_path", "status"
];
for (const col of supLegacy) {
  try {
    await client.query(`ALTER TABLE public.suppliers ALTER COLUMN ${col} DROP NOT NULL`);
    console.log(`  ✅ suppliers.${col} — DROP NOT NULL`);
  } catch (e) { console.log(`  ℹ️  suppliers.${col} — ${(e.message||"").substring(0,60)}`); }
}

console.log("\n🔍 إعادة الفحص بعد التعديل:");
const after = await client.query(`
  SELECT table_name, count(*) AS not_null_count
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('community_entities','suppliers','rfqs')
    AND is_nullable='NO'
    AND column_name NOT IN ('id','created_at','updated_at')
  GROUP BY table_name
`);
console.table(after.rows.length ? after.rows : [{msg: "لا توجد أعمدة NOT NULL إضافية (باستثناء PK + timestamps)"}]);

await client.end();
console.log("\n✅✅✅ تمت إزالة جميع قيود NOT NULL غير الضرورية عن الجداول الثلاثة");
