-- =====================================================================
-- إنشاء 3 مستخدمين تجريبيين لمنصة Open Loop ( لكل دور واحد )
-- طريقة الاستخدام:
--   1. افتح Supabase Dashboard
--   2. انتقل إلى SQL Editor
--   3. اضغط New query (Empty query)
--   4. انسخ ولصق كل محتوى هذا الملف ثم اضغط Run
-- =====================================================================
-- ⚠️ الخطوة السابقة الإجبارية: قبل هذا الملف، شغّل أولاً:
--        20260915100000_full_platform_upgrade.sql
--    (لإنشاء جداول profiles, user_roles, enum app_role, ...)
-- =====================================================================

-- ===========================================================
-- بيانات الدخول النهائية (صالحة مباشرة بعد تشغيل السكربت):
--
-- ① المدير العام
--    البريد        admin@open-loopsa.com
--    كلمة المرور   Admin@OpenLoop2026
--    الصلاحية      كل صفحات لوحة الإدارة + التقارير + الصلاحيات
--
-- ② موظف الدعم
--    البريد        staff@open-loopsa.com
--    كلمة المرور   Staff@OpenLoop2026
--    الصلاحية      طلبات / حجوزات / مكتبة / موافقات / CMS
--                   (بدون إعدادات المنصة / صلاحيات المستخدمين)
--
-- ③ العميل العادي
--    البريد        user@open-loopsa.com
--    كلمة المرور   User@OpenLoop2026
--    الصلاحية      لوحة المستخدم فقط (بياناتي + طلباتي + حجوزاتي)
--                   بدون وصول لأي صفحة في /admin/*
-- ===========================================================

-- =====================================================================
-- ١. تفعيل إضافة التشفير + إيقاف RLS مؤقتاً
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ٢. إدراج المستخدمين في auth.users مع تجزئة كلمة مرور حقيقية bcrypt
--    نستخدم crypt(password, gen_salt('bf')) من pgcrypto → نفس آلية Supabase
-- =====================================================================

-- ① المدير العام
INSERT INTO auth.users (
  id, instance_id, aud, "role", email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'admin@open-loopsa.com',
  crypt('Admin@OpenLoop2026', gen_salt('bf', 10)),
  NOW(), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"مدير المنصة العام","job_title":"Administrator"}'::jsonb,
  FALSE, '', '', ''
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('Admin@OpenLoop2026', gen_salt('bf', 10)),
  email_confirmed_at = NOW(),
  updated_at         = NOW();

-- ② موظف الدعم
INSERT INTO auth.users (
  id, instance_id, aud, "role", email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'staff@open-loopsa.com',
  crypt('Staff@OpenLoop2026', gen_salt('bf', 10)),
  NOW(), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"موظف الدعم الفني","job_title":"Support Agent"}'::jsonb,
  FALSE, '', '', ''
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('Staff@OpenLoop2026', gen_salt('bf', 10)),
  email_confirmed_at = NOW(),
  updated_at         = NOW();

-- ③ المستخدم العادي
INSERT INTO auth.users (
  id, instance_id, aud, "role", email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new
) VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'user@open-loopsa.com',
  crypt('User@OpenLoop2026', gen_salt('bf', 10)),
  NOW(), NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"عميل تجريبي","job_title":"Customer"}'::jsonb,
  FALSE, '', '', ''
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('User@OpenLoop2026', gen_salt('bf', 10)),
  email_confirmed_at = NOW(),
  updated_at         = NOW();

-- =====================================================================
-- ٣. إنشاء ملفات شخصية مقابلة في public.profiles
-- =====================================================================
INSERT INTO public.profiles (id, full_name, phone, company, city, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'مدير المنصة العام', '+966500000001', 'Open Loop HQ',       'الرياض', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'موظف الدعم الفني',   '+966500000002', 'Open Loop Support',  'جدة',     NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'عميل تجريبي',         '+966500000003', 'شركة العميل التجريبية', 'الدمام',  NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  phone      = EXCLUDED.phone,
  company    = EXCLUDED.company,
  city       = EXCLUDED.city,
  updated_at = NOW();

-- =====================================================================
-- ٤. تعيين الأدوار الثلاثة في جدول public.user_roles (enum app_role)
-- =====================================================================
INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin' :: public.app_role, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'staff' :: public.app_role, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'user'  :: public.app_role, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE SET
  role       = EXCLUDED.role,
  updated_at = NOW();

-- =====================================================================
-- ٥. إعادة تشغيل حماية RLS بعد الإدخال
-- =====================================================================
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ٦. استعلام التأكيد — يعرض المستخدمين بعد الإنشاء
-- =====================================================================
SELECT
  CASE ur.role
    WHEN 'admin' THEN '① مدير عام'
    WHEN 'staff' THEN '② موظف دعم'
    WHEN 'user'  THEN '③ عميل عادي'
  END                              AS "الدور",
  p.full_name                      AS "الاسم الكامل",
  u.email                          AS "البريد الإلكتروني",
  CASE WHEN u.email_confirmed_at IS NOT NULL THEN '✅ مؤكد' ELSE '❌ غير مؤكد' END AS "البريد",
  p.phone                          AS "رقم الجوال",
  p.city                           AS "المدينة"
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN auth.users u       ON u.id = ur.user_id
ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END;
