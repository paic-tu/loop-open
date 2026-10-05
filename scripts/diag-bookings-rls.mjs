#!/usr/bin/env node
// ============================================================
// تشخيص سياسات RLS لجدول bookings والجداول ذات الصلة
// ============================================================
import pg from "pg";
const { Client } = pg;

const dbPassword = process.argv[2] || "9A182SlQ0Zfo1yRX";
const SQL = (strings, ...values) => {
  let q = strings[0];
  for (let i = 0; i < values.length; i++) q += "$" + (i + 1) + strings[i + 1];
  return { text: q, values };
};

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
  console.log("✅ Connected to Supabase Postgres SSL\n");

  // 1) هل يوجد جدول users في schema public؟
  console.log("=== [1] الجداول في schema public التي تشمل كلمة 'user' ===");
  const r1 = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%user%'
    ORDER BY table_name;
  `);
  console.table(r1.rows);

  // 2) هل جدول bookings موجود؟ أعمدةه
  console.log("\n=== [2] هيكل جدول bookings ===");
  const r2 = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings'
    ORDER BY ordinal_position;
  `);
  if (r2.rows.length === 0) console.log("جدول bookings غير موجود!");
  else console.table(r2.rows);

  // 3) السياسات الحالية على جدول bookings
  console.log("\n=== [3] سياسات RLS الحالية على جدول bookings ===");
  const r3 = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
    ORDER BY policyname;
  `);
  if (r3.rows.length === 0) console.log("⚠️  لا توجد أي سياسات RLS على bookings على الإطلاق! (جدول محمي كاملاً → permission denied للجميع)");
  else {
    console.table(r3.rows.map(r => ({
      policyname: r.policyname, cmd: r.cmd,
      roles: Array.isArray(r.roles) ? r.roles.join(",") : String(r.roles),
      qual: (r.qual||"").slice(0,150), with_check: (r.with_check||"").slice(0,150),
    })));
    // هل أي سياسة تشير إلى auth.users؟
    for (const r of r3.rows) {
      const blob = (r.qual||"") + " " + (r.with_check||"");
      if (blob.toLowerCase().includes("auth.users") || blob.toLowerCase().includes("from users")) {
        console.log("⛔ المرجع الخطير في السياسة " + r.policyname + ": " + blob.slice(0,250));
      }
    }
  }

  // 4) هل هناك سياسات في أي جدول آخر تشير إلى auth.users مباشرة؟
  console.log("\n=== [4] البحث عن أي سياسة RLS تشير إلى auth.users (الخطأ الأكيد!) ===");
  const r4 = await client.query(`
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (lower(qual) LIKE '%auth.users%' OR lower(with_check) LIKE '%auth.users%'
           OR lower(qual) LIKE '%from users%' OR lower(with_check) LIKE '%from users%')
    ORDER BY tablename, policyname;
  `);
  if (r4.rows.length === 0) console.log("✅ لا توجد سياسات تشير مباشرة إلى auth.users");
  else console.table(r4.rows);

  // 5) هل RLS مُفعل على bookings؟
  console.log("\n=== [5] حالة تفعيل RLS على الجداول الأساسية ===");
  const r5 = await client.query(`
    SELECT relname AS table_name,
           relrowsecurity AS rls_enabled,
           relforcerowsecurity AS force_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public'
      AND relname IN ('bookings','notifications','user_roles','profiles','requests','rfqs','rfq_quotes')
    ORDER BY relname;
  `);
  console.table(r5.rows);

  // 6) محاكاة استعلام authenticated SELECT * FROM bookings (باستخدام SET ROLE)
  console.log("\n=== [6] محاكاة: السماح authenticated بالوصول إلى bookings (اختبار مباشر) ===");
  try {
    await client.query("SET ROLE authenticated;");
    const r6 = await client.query("SELECT count(*)::int AS cnt FROM public.bookings;");
    console.log("✅ نجح الوصول كـ authenticated! عدد الحجوزات =", r6.rows[0].cnt);
  } catch (err) {
    console.log("⛔ فشل الوصول كـ authenticated:", err.message);
  } finally {
    await client.query("RESET ROLE;");
  }

  // 7) نفس الاختبار لجدول notifications
  console.log("\n=== [7] محاكاة: authenticated جدول notifications ===");
  try {
    await client.query("SET ROLE authenticated;");
    const r7 = await client.query("SELECT count(*)::int AS cnt FROM public.notifications;");
    console.log("✅ نجح الوصول كـ authenticated! notifications =", r7.rows[0].cnt);
  } catch (err) {
    console.log("⛔ فشل الوصول notifications كـ authenticated:", err.message);
  } finally {
    await client.query("RESET ROLE;");
  }

  console.log("\n✅ الانتهاء من التشخيص.");
} catch (err) {
  console.error("❌ خطأ عام:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
