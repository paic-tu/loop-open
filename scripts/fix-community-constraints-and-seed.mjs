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

// ================================================
// إضافة قيود UNIQUE و Foreign Key المفقودة — كل قيد بمفرده لضمان التنفيذ
// ================================================
console.log("🚀 إضافة القيود المفقودة (UNIQUE user_id + FKs)...\n");

async function addConstraint(label, sql) {
  try {
    await client.query(sql);
    console.log(`  ✅ ${label}`);
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes("already exists") || msg.includes("يوجد بالفعل")) {
      console.log(`  ℹ️  ${label} — موجود بالفعل`);
    } else {
      console.log(`  ⚠️  ${label} — ${msg.substring(0, 100)}`);
    }
  }
}

// 1) community_entities
await addConstraint(
  "community_entities: UNIQUE(user_id)",
  `ALTER TABLE public.community_entities ADD CONSTRAINT community_entities_user_id_key UNIQUE (user_id)`
);
await addConstraint(
  "community_entities: FK user_id -> auth.users",
  `ALTER TABLE public.community_entities ADD CONSTRAINT community_entities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
);

// 2) suppliers
await addConstraint(
  "suppliers: UNIQUE(user_id)",
  `ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_user_id_key UNIQUE (user_id)`
);
await addConstraint(
  "suppliers: FK user_id -> auth.users",
  `ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`
);

// 3) rfqs owner_id FK
await addConstraint(
  "rfqs: FK owner_id -> auth.users",
  `ALTER TABLE public.rfqs ADD CONSTRAINT rfqs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL`
);

// 4) user_terms_acceptances FK
await addConstraint(
  "user_terms_acceptances: FK user_id -> auth.users",
  `ALTER TABLE public.user_terms_acceptances ADD CONSTRAINT uta_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
);

// ================================================
// التحقق من وجود UNIQUE الآن قبل الإدراج
// ================================================
console.log("\n🔍 التحقق من القيود UNIQUE على user_id...");
const ceUnique = await client.query(`
  SELECT conname, contype, conrelid::regclass AS tbl
  FROM pg_constraint
  WHERE conname IN ('community_entities_user_id_key', 'suppliers_user_id_key')
`);
console.table(ceUnique.rows);

// ================================================
// إدراج سجل الجهة المجتمعية المعتمدة لـ admin
// ================================================
console.log("\n🚀 إدراج جهة مجتمعية معتمدة لـ admin...");
const adminRow = (await client.query(`SELECT id FROM auth.users WHERE email='admin@open-loopsa.com'`)).rows[0];
if (!adminRow) {
  console.error("❌ لم يتم العثور على مستخدم admin");
  process.exit(1);
}
const adminId = adminRow.id;

// جرب INSERT مباشر أولاً إذا لم يكن موجوداً
const existing = await client.query(`SELECT id, entity_name, is_verified, document_status FROM public.community_entities WHERE user_id=$1`, [adminId]);
if (existing.rows.length > 0) {
  console.log(`ℹ️  الجهة موجودة مسبقاً (id=${existing.rows[0].id}) — يتم تحديثها إلى معتمدة`);
  await client.query(`
    UPDATE public.community_entities SET
      is_verified = true,
      document_status = 'verified',
      entity_name = COALESCE(NULLIF(entity_name, ''), 'جمعية الوفاء الخيرية التابعة لـ Open Loop'),
      verification_note = 'تمت اعتمادها يدوياً للاختبار',
      updated_at = now()
    WHERE user_id = $1
  `, [adminId]);
} else {
  console.log("ℹ️  الجهة غير موجودة — يتم إدراجها جديدة الآن (بدون ON CONFLICT)");
  await client.query(`
    INSERT INTO public.community_entities (
      user_id, entity_type, license_number, entity_name, representative_name,
      job_title, official_email, phone, region, field,
      is_verified, verification_note, license_document_path, document_status,
      created_at, updated_at
    ) VALUES (
      $1, 'جمعية أهلية', '1234567890',
      'جمعية الوفاء الخيرية التابعة لـ Open Loop',
      'مدير المنصة العام', 'مدير عام',
      'admin@open-loopsa.com', '0501234567',
      'الرياض', 'الأوقاف وتنمية الموارد',
      true, 'تمت اعتمادها يدوياً للاختبار',
      NULL, 'verified',
      now(), now()
    )
  `, [adminId]);
}

const ce = await client.query(`SELECT id, entity_name, is_verified, document_status, user_id, region, field
  FROM public.community_entities WHERE user_id=$1`, [adminId]);
console.log("\n✅ الجهة المجتمعية للمدير:");
console.table(ce.rows);

await client.end();
console.log("\n✅✅✅ تم إضافة جميع القيود + إعداد الجهة المعتمدة للمدير");
