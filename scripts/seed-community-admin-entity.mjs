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

// الحصول على user_id لـ admin
const adminId = (await client.query(`SELECT id FROM auth.users WHERE email='admin@open-loopsa.com'`)).rows[0].id;
console.log("👤 admin user_id:", adminId);

// 1) إدراج جهة مجتمعية معتمدة لـ admin (لأتمتة اختبار RFQ لاحقاً)
console.log("\n🚀 إدراج جهة مجتمعية معتمدة لـ admin (إعداد للاختبار)...");
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
  ON CONFLICT (user_id) DO UPDATE SET
    is_verified = EXCLUDED.is_verified,
    document_status = EXCLUDED.document_status,
    entity_name = EXCLUDED.entity_name,
    verification_note = EXCLUDED.verification_note
`, [adminId]);

const ce = await client.query(`SELECT id, entity_name, is_verified, document_status, user_id
  FROM public.community_entities WHERE user_id=$1`, [adminId]);
console.log("✅ تم إدراج/تحديث الجهة المجتمعية:");
console.table(ce.rows);

// 2) للتأكد: اقرأ rfqs count (الصفري حاليًا)
const rfq0 = await client.query(`SELECT COUNT(*) FROM public.rfqs`);
console.log("\n📊 عدد فرص RFQ قبل الاختبار:", rfq0.rows[0].count);

// 3) أيضاً: تأكد أن supplier تسجيل (للمستخدم staff الذي اختباره لاحقاً) ليس مطلوباً الآن
//    لكننا نضمن أن الجداول تعمل.

await client.end();
console.log("\n✅ إعداد الاختبار انتهى — يمكن الآن نشر فرصة RFQ جديدة في الواجهة");
