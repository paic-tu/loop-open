// ============================================================
// تشخيص: سبب عدم عمل إشعارات الجرس عند حجز جديد
// ============================================================
import pg from "pg";
const { Pool } = pg;

const DB_PASSWORD = process.argv[2] || "9A182SlQ0Zfo1yRX";

const pool = new Pool({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("✅ متصل بقاعدة البيانات\n");

    for (const table of ["user_roles", "notifications"]) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 الجدول: public.${table}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // 1) هل RLS مفعّل؟
      const rlsQ = await client.query(`
        SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname=$1;
      `, [table]);
      console.log(`   🔐 RLS مفعّل: ${rlsQ.rows[0].relrowsecurity}`);

      // 2) الأعمدة + الأنواع
      const colsQ = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position;
      `, [table]);
      console.log(`   🗂  الأعمدة: ${colsQ.rows.map(r => r.column_name).join(", ")}`);

      // 3) السياسات
      const polQ = await client.query(`
        SELECT p.polname,
               CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'w' THEN 'UPDATE'
                            WHEN 'a' THEN 'INSERT' WHEN 'd' THEN 'DELETE' ELSE '*' END AS cmd,
               pg_get_expr(p.polqual, p.polrelid)    AS using_qual,
               pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
        FROM pg_policy p
          JOIN pg_class c ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname=$1
        ORDER BY p.polname;
      `, [table]);
      console.log(`   📜 السياسات (${polQ.rows.length}):`);
      if (polQ.rows.length === 0) console.log(`      ⚠️  لا توجد أي سياسات! (سيُمنع الوصول الكامل إذا مفعّل RLS)`);
      for (const r of polQ.rows) {
        console.log(`\n      🏷  ${r.polname} [${r.cmd}]`);
        if (r.using_qual)  console.log(`         USING     : ${r.using_qual.slice(0, 130)}`);
        if (r.with_check) console.log(`         WITH CHECK: ${r.with_check.slice(0, 130)}`);
      }

      // 4) عدد الصفوف الحالية
      const cntQ = await client.query(`SELECT COUNT(*)::int AS c FROM public.${table};`);
      console.log(`\n   🧮 عدد الصفوف حالياً: ${cntQ.rows[0].c}`);
    }

    // 5) سؤال حاسم: هل user_roles تسمح بقراءة جميع الأدوار (admin/staff) لأي مستخدم؟
    //    إذا كانت السياسة = auth.uid() = user_id فالمستخدم العادي لن يستطيع رؤية admin/staff
    //    ولهذا ستفشل دالة notifyAdmins (التي تعمل من المتصفح كـ المستخدم المُرسل للحجز)
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 الاختبار الحاسم: محاكاة كـ مستخدم عادي (أو ضيف):`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    // نجرب: user عادي = user@open-loopsa.com = uuid آخر (ليس admin ولا staff)
    const userQ = await client.query(`
      SELECT id FROM auth.users WHERE email='user@open-loopsa.com' LIMIT 1;
    `);
    if (userQ.rows.length === 0) {
      console.log("   ⚠️  لا يوجد مستخدم user@open-loopsa.com");
    } else {
      const regularUserId = userQ.rows[0].id;
      console.log(`   👤 المستخدم العادي (user@open-loopsa.com): ${regularUserId.slice(0, 10)}...\n`);

      // محاكاة: ما الذي ستراه هذه المستخدمة عند استعلام user_roles (لإيجاد admin و staff)؟
      await client.query(`SET ROLE authenticated;`);
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [regularUserId]);
      // في Supabase يحوي request.jwt.claim.sub على auth.uid()
      // لكن أحياناً يجب استخدام auth.jwt() -> لذلك نحاول الطريقتين:
      try { await client.query(`SET app.current_user_id = $1`, [regularUserId]); } catch {}
      const r1 = await client.query(`
        SELECT ur.role, ur.user_id
        FROM public.user_roles ur
        WHERE ur.role IN ('admin','staff');
      `);
      console.log(`   🕵  كـ مستخدم عادي — استعلام user_roles عن admin/staff:`);
      console.log(`      عدد النتائج: ${r1.rows.length}`);
      if (r1.rows.length === 0) {
        console.log(`      ❌ صفر! هذا هو السبب: notifyAdmins لن تجد أي مستخدم لإرسال الإشعار إليه!`);
      } else {
        for (const r of r1.rows) console.log(`      • ${r.role}: ${String(r.user_id).slice(0,8)}...`);
      }

      // محاكاة INSERT into notifications
      try {
        await client.query(`
          INSERT INTO public.notifications (user_id, title, body, link)
          VALUES ($1, 'اختبار', 'هل يمكن الإدخال؟', '/admin');
        `, [regularUserId]);
        console.log(`\n   ✅ يمكن للمستخدم العادي إدراج إشعار في جدول notifications.`);
      } catch (e) {
        console.log(`\n   ❌ فشل الإدخال في notifications: ${e.message.slice(0, 140)}`);
      }
      await client.query(`RESET ROLE;`);
    }

    process.exit(0);
  } catch (e) {
    console.error("❌ DB ERROR:", e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
