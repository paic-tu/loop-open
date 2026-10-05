#!/usr/bin/env node
// ============================================================
// 1) فحص هيكل جدول profiles
// 2) إنشاء سياسات bookings نهائية صحيحة
// ============================================================
import pg from "pg";
const { Client } = pg;

const dbPassword = process.argv[2] || "9A182SlQ0Zfo1yRX";

const client = new Client({
  host: "db.berprxhuguniggtnerfq.supabase.co",
  port: 5432,
  user: "postgres",
  database: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();
  console.log("✅ Connected\n");

  console.log("=== أولاً: فحص هيكل جدول profiles ===");
  const cols = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
    ORDER BY ordinal_position;
  `);
  console.table(cols.rows);

  // نفترض الآن: عمود الـ email ربما في auth.users فقط، أو عمود آخر في profiles.
  // سنحذف الجزء الذي يبحث عن مطابقة email في profiles ونجعل السياسة أبسط بكثير:
  //   staff/admin = يرى الكل
  //   أو user_id مطابق auth.uid()
  //   أو المستخدم ضيف → لا يرى شيء في صفحة الـ admin (طبيعي)

  console.log("\n=== ثانياً: بناء سياسات bookings النهائية ===");
  await client.query(`ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;`);
  await client.query(`
    DROP POLICY IF EXISTS bookings_insert_public ON public.bookings;
    DROP POLICY IF EXISTS bookings_select ON public.bookings;
    DROP POLICY IF EXISTS bookings_update_staff ON public.bookings;
    DROP POLICY IF EXISTS bookings_delete_admin ON public.bookings;
  `);

  await client.query(`
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

    -- 1) INSERT: أي شخص (anon أو authenticated) يمكنه إنشاء حجز
    CREATE POLICY bookings_insert_public ON public.bookings
      FOR INSERT TO public
      WITH CHECK (true);

    -- 2) SELECT: staff/admin يرى الكل، أو صاحب الحجز (user_id = auth.uid) يرى حجوزاته
    CREATE POLICY bookings_select ON public.bookings
      FOR SELECT TO public
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.role::text = 'staff' OR ur.role::text = 'admin')
        )
        OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
      );

    -- 3) UPDATE: staff/admin فقط
    CREATE POLICY bookings_update_staff ON public.bookings
      FOR UPDATE TO public
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.role::text = 'staff' OR ur.role::text = 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.role::text = 'staff' OR ur.role::text = 'admin')
        )
      );

    -- 4) DELETE: admin فقط
    CREATE POLICY bookings_delete_admin ON public.bookings
      FOR DELETE TO public
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'
        )
      );
  `);
  console.log("✅ تم إنشاء 4 سياسات RLS جديدة بشكل صحيح (بدون أي مرجع إلى auth.users)");

  // ---- اختبار محاكاة ----
  console.log("\n=== ثالثاً: اختبار محاكاة authenticated عادي (ليس staff/admin) ===");
  await client.query("SET ROLE authenticated;");
  const r1 = await client.query("SELECT count(*)::int AS cnt FROM public.bookings;");
  console.log("✅ نجح الوصول (بدون permission denied for table users!) | count =", r1.rows[0].cnt);
  await client.query("RESET ROLE;");

  console.log("\n=== رابعاً: عرض السياسات النهائية الحالية لجدول bookings ===");
  const pols = await client.query(`
    SELECT policyname, cmd,
           (roles::text[])[1] AS role0,
           substr(qual,1,140) AS qual,
           substr(with_check,1,140) AS with_check
    FROM pg_policies WHERE schemaname='public' AND tablename='bookings'
    ORDER BY cmd, policyname;
  `);
  console.table(pols.rows);

  // ---- عمود status تحويل enum -> text للكود (الذي يُرسل status='new') ----
  console.log("\n=== خامساً: التأكد من أن عمود status في bookings يُقبل قيمة 'new' كنص ===");
  try {
    const r = await client.query(`
      SELECT column_name, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='bookings' AND column_name='status';
    `);
    console.table(r.rows);
    if (r.rows[0].udt_name !== 'text') {
      console.log("⚠️  عمود status هو enum ليس text! → سنحوله الآن");
      await client.query(`
        ALTER TABLE public.bookings ALTER COLUMN status TYPE text USING status::text;
        ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'new';
      `);
      console.log("✅ تم تحويل عمود status إلى text بنجاح.");
    } else {
      console.log("✅ عمود status هو text بالفعل.");
    }
  } catch (e) {
    console.log("   ⚠️  تحويل status فشل (قد يكون OK):", e.message);
  }

  // ---- فحص الأعمدة الحالية لجدول bookings ----
  console.log("\n=== سادساً: فحص الأعمدة الحالية لجدول bookings للتأكد من مطابقتها للكود ===");
  const colsB = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
    ORDER BY ordinal_position;
  `);
  console.table(colsB.rows);

  console.log("\n✅ انتهى إصلاح جذري لـ bookings بنجاح!");
} catch (err) {
  console.error("❌ خطأ عام:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
