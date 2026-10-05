// ============================================================
// تشخيص جدول requests: السياسات RLS + هيكل الجدول + محاكاة authenticated
// ============================================================
import pg from "pg";
const { Client } = pg;

const PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ متصل بقاعدة البيانات\n");

// 1) جميع السياسات على جدول requests
console.log("========================================");
console.log("1️⃣  السياسات RLS الحالية على جدول requests:");
console.log("========================================");
const policies = await client.query(
  `SELECT policyname, cmd, roles, qual, with_check
   FROM pg_policies
   WHERE schemaname='public' AND tablename='requests'
   ORDER BY policyname`
);
for (const p of policies.rows) {
  console.log(`
📌 السياسة: ${p.policyname}
   CMD: ${p.cmd}
   الأدوار: ${Array.isArray(p.roles) ? p.roles.join(", ") : String(p.roles)}
   USING (qual): ${p.qual}
   WITH CHECK: ${p.with_check}
  `);
}
if (policies.rows.length === 0) console.log("⚠️  لا توجد سياسات RLS على جدول requests!\n");

// 2) هيكل جدول requests
console.log("\n========================================");
console.log("2️⃣  هيكل جدول public.requests (الأعمدة + الأنواع):");
console.log("========================================");
const cols = await client.query(
  `SELECT column_name, data_type, udt_name, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='requests'
   ORDER BY ordinal_position`
);
for (const c of cols.rows) {
  const type = c.data_type === "USER-DEFINED" ? `ENUM(${c.udt_name})` : c.data_type;
  console.log(
    `  • ${c.column_name.padEnd(22)} ${type.padEnd(28)} NULL=${c.is_nullable.padEnd(5)} DEFAULT=${c.column_default || "(بدون)"}`
  );
}

// 3) فحص الأعمدة المطلوبة من الكود:
//    user_id, type, title, details, document_path, status, created_at, updated_at
console.log("\n========================================");
console.log("3️⃣  فحص الأعمدة المطلوبة من الكود في requests:");
console.log("========================================");
const requiredCols = [
  "id", "user_id", "type", "title", "details", "document_path",
  "status", "created_at", "updated_at",
  "assigned_to", "closed_at", "spam_score", "is_spam"
];
const colNames = cols.rows.map((c) => c.column_name);
for (const col of requiredCols) {
  const has = colNames.includes(col);
  console.log(`  ${has ? "✅" : "❌"} ${col}`);
}

// 4) فحص نوع الأعمدة Enum: type و status
console.log("\n========================================");
console.log("4️⃣  التحقق من أنواع الأعمدة Enum (إذا وجدت):");
console.log("========================================");
for (const c of cols.rows) {
  if (c.data_type === "USER-DEFINED") {
    console.log(`\n  ⚠️  العمود '${c.column_name}' هو نوع مستمعي ${c.udt_name}! تحقق من القيم:`);
    try {
      const vals = await client.query(
        `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='${c.udt_name}') ORDER BY enumsortorder`
      );
      console.log(`     القيم الممكنة: [${vals.rows.map((r) => r.enumlabel).join(", ")}]`);
      console.log(`     ⚠️  إذا أرسل الكود قيمة مختلفة (مثل type='service' أو status='new') → سيفشل INSERT!`);
    } catch (e) {
      console.log(`     ❌ خطأ عند جلب قيم الـ enum: ${e.message}`);
    }
  }
}

// 5) فحص نوع عمود details: هل هو jsonb؟ أم text؟
const detailsCol = cols.rows.find((c) => c.column_name === "details");
console.log(
  `\n  ℹ️  نوع عمود details: ${detailsCol ? detailsCol.data_type : "غير موجود"}` +
    (detailsCol && detailsCol.data_type !== "jsonb" ? " (يجب أن يكون jsonb!)" : "")
);

// 6) محاكاة اختبار SELECT + INSERT كـ authenticated
console.log("\n========================================");
console.log("5️⃣  محاكاة اختبار كـ role authenticated (مثل المتصفح الحقيقي):");
console.log("========================================");
try {
  await client.query("SET ROLE authenticated;");
  console.log("  ✅ تم تغيير الدور إلى authenticated");

  // اختبار SELECT count
  const count = await client.query("SELECT count(*) FROM public.requests;");
  console.log(`  ✅ SELECT count(*) FROM public.requests → النجاح! count=${count.rows[0].count}`);
} catch (e) {
  console.log(`  ❌ فشل اختبار SELECT كـ authenticated: ${e.message}`);
}

// إعادة الدور إلى postgres قبل اختبار INSERT
await client.query("RESET ROLE;");

// 7) فحص السياسات على جداول أخرى ذات صلة (مستخدمين قد يواجهون مشاكل)
console.log("\n========================================");
console.log("6️⃣  فحص السياسات على جداول ذات صلة (rfqs, community_entities, suppliers):");
console.log("========================================");
for (const tbl of ["rfqs", "community_entities", "suppliers", "profiles", "user_roles"]) {
  try {
    const p = await client.query(
      `SELECT count(*) as c FROM pg_policies WHERE schemaname='public' AND tablename='${tbl}'`
    );
    await client.query("SET ROLE authenticated;");
    const r = await client.query(`SELECT count(*) FROM public.${tbl};`);
    console.log(`  ✅ ${tbl}: ${p.rows[0].c} سياسات, authenticated يقرأ ${r.rows[0].count} صف`);
    await client.query("RESET ROLE;");
  } catch (e) {
    console.log(`  ❌ ${tbl}: فشل كـ authenticated → ${e.message}`);
    await client.query("RESET ROLE;");
  }
}

// 8) فحص وجود Storage Buckets في المخطط (نحاول فقط قراءة معلوماتها من storage.buckets)
console.log("\n========================================");
console.log("7️⃣  فحص Storage Buckets الموجودة حالياً في Supabase Storage:");
console.log("========================================");
try {
  const buckets = await client.query(
    `SELECT id, name, public FROM storage.buckets ORDER BY name;`
  );
  if (buckets.rows.length === 0) {
    console.log("  ❌ لا توجد أي Buckets في storage.buckets! يلزم إنشاء: library, documents, booking-attachments, entity-documents, supplier-documents");
  } else {
    const existing = buckets.rows.map((b) => b.name);
    const required = ["library", "documents", "booking-attachments", "entity-documents", "supplier-documents"];
    console.log("  الموجودة حالياً:");
    for (const b of buckets.rows) {
      console.log(`    ${b.public ? "🌐 عام" : "🔒 خاص"}  ${b.name}`);
    }
    console.log("\n  المطلوبة من الكود:");
    for (const r of required) {
      console.log(`    ${existing.includes(r) ? "✅" : "❌"} ${r}`);
    }
  }
} catch (e) {
  console.log(`  ⚠️  تعذر فحص storage.buckets: ${e.message}`);
}

await client.end();
console.log("\n========================================\n🏁  اكتمل التشخيص.");
