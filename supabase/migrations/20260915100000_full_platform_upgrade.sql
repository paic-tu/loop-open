-- ============================================================
-- خطة ترقية قاعدة بيانات Open Loop إلى المنصة الشاملة
-- تاريخ: 15-09-2026
-- ============================================================

-- -----------------------------------------------------------
-- 1. تحديث أدوار المستخدمين (إضافة دور staff)
-- -----------------------------------------------------------

DO $$ BEGIN
    -- محاولة تحديث Enum بإضافة staff
    -- (في Supabase لا يمكن تعديل Enum مباشرة ALTER TYPE داخل DO لذا نستخدم لغة SQL عادية)
    NULL;
END $$;

-- استخدام الطريقة الآمنة لإضافة قيمة إلى Enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- حقل is_blocked في profiles إذا لم يكن موجوداً
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_blocked') THEN
        ALTER TABLE public.profiles ADD COLUMN is_blocked boolean DEFAULT false;
        ALTER TABLE public.profiles ADD COLUMN blocked_at timestamptz;
        ALTER TABLE public.profiles ADD COLUMN blocked_reason text;
    END IF;
END $$;

-- -----------------------------------------------------------
-- 2. إضافة أعمدة جديدة لجداول الطلبات (requests)
-- -----------------------------------------------------------

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='requests' AND column_name='internal_notes') THEN
        ALTER TABLE public.requests ADD COLUMN internal_notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='requests' AND column_name='assigned_to') THEN
        ALTER TABLE public.requests ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='requests' AND column_name='closed_at') THEN
        ALTER TABLE public.requests ADD COLUMN closed_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='requests' AND column_name='contact_email') THEN
        ALTER TABLE public.requests ADD COLUMN contact_email text;
        ALTER TABLE public.requests ADD COLUMN contact_phone text;
        ALTER TABLE public.requests ADD COLUMN contact_name text;
    END IF;
END $$;

-- -----------------------------------------------------------
-- 3. إنشاء جدول الحجوزات والاستشارات (bookings)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    entity_name text,
    phone text NOT NULL,
    email text NOT NULL,
    service_category text,
    note text,
    status text NOT NULL DEFAULT 'new',
    internal_notes text,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    attachment_path text,
    closed_at timestamptz,
    spam_score smallint DEFAULT 0,
    is_spam boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- 4. إنشاء جدول مكتبة الملفات (library_files)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.library_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    category text DEFAULT 'general',
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint DEFAULT 0,
    mime_type text,
    download_count integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    icon_name text DEFAULT 'ShieldCheck',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- 5. إنشاء جداول إدارة المحتوى (CMS)
-- -----------------------------------------------------------

-- 5.1 فئات الخدمات
CREATE TABLE IF NOT EXISTS public.cms_service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    display_order text NOT NULL DEFAULT '00',
    title text NOT NULL,
    description text,
    icon_name text,
    is_published boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- عناصر الخدمة (داخل كل فئة)
CREATE TABLE IF NOT EXISTS public.cms_service_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.cms_service_categories(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- تفاصيل الخدمة (اختياري لكل فئة)
CREATE TABLE IF NOT EXISTS public.cms_service_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.cms_service_categories(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.2 الباقات
CREATE TABLE IF NOT EXISTS public.cms_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    subtitle text,
    features text[] NOT NULL DEFAULT '{}',
    price text,
    is_featured boolean NOT NULL DEFAULT false,
    is_published boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- شرائح الأسعار للباقات (باقات متعددة الأسعار)
CREATE TABLE IF NOT EXISTS public.cms_package_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id uuid NOT NULL REFERENCES public.cms_packages(id) ON DELETE CASCADE,
    label text NOT NULL,
    price text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.3 أرقام الأثر (Impact Stats)
CREATE TABLE IF NOT EXISTS public.cms_impact_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_value text NOT NULL,
    title text NOT NULL,
    description text,
    icon_name text DEFAULT 'Target',
    sort_order integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.4 الشركاء
CREATE TABLE IF NOT EXISTS public.cms_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    logo_url text,
    website_url text,
    sort_order integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.5 إعدادات الموقع العامة
CREATE TABLE IF NOT EXISTS public.cms_site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- 6. إضافة أعمدة المستندات لجهات المجتمع والموردين
-- -----------------------------------------------------------

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_entities' AND column_name='license_document_path') THEN
        ALTER TABLE public.community_entities ADD COLUMN license_document_path text;
        ALTER TABLE public.community_entities ADD COLUMN document_status text DEFAULT 'pending_verification';
        ALTER TABLE public.community_entities ADD COLUMN document_verification_note text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='suppliers' AND column_name='cr_document_path') THEN
        ALTER TABLE public.suppliers ADD COLUMN cr_document_path text;
        ALTER TABLE public.suppliers ADD COLUMN document_status text DEFAULT 'pending_verification';
        ALTER TABLE public.suppliers ADD COLUMN document_verification_note text;
    END IF;
END $$;

-- -----------------------------------------------------------
-- 7. تفعيل Row Level Security (RLS) على الجداول الجديدة
-- -----------------------------------------------------------

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_service_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_package_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_impact_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_site_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- 8. RLS Policies: bookings (الحجوزات)
-- -----------------------------------------------------------

-- الجميع يستطيع إنشاء حجز (بدون حساب أيضاً)
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;
CREATE POLICY "Public can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (true);

-- Admin و Staff يرون كل الحجوزات
DROP POLICY IF EXISTS "Admins and staff can view all bookings" ON public.bookings;
CREATE POLICY "Admins and staff can view all bookings"
    ON public.bookings FOR SELECT
    USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('staff'::public.app_role, auth.uid()));

-- المستخدم العادي يرى حجوزاته فقط
DROP POLICY IF EXISTS "Users view own bookings" ON public.bookings;
CREATE POLICY "Users view own bookings"
    ON public.bookings FOR SELECT
    USING (user_id = auth.uid());

-- Admin / Staff يمكنه التعديل
DROP POLICY IF EXISTS "Admins and staff update bookings" ON public.bookings;
CREATE POLICY "Admins and staff update bookings"
    ON public.bookings FOR UPDATE
    USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('staff'::public.app_role, auth.uid()));

-- Admin يمكنه حذف الحجوزات
DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;
CREATE POLICY "Admins delete bookings"
    ON public.bookings FOR DELETE
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- -----------------------------------------------------------
-- 9. RLS Policies: library_files (مكتبة الملفات)
-- -----------------------------------------------------------

-- الجميع يستطيع قراءة الملفات المنشورة
DROP POLICY IF EXISTS "Public view published library" ON public.library_files;
CREATE POLICY "Public view published library"
    ON public.library_files FOR SELECT
    USING (is_published = true);

-- Admin / Staff يرى كل شيء
DROP POLICY IF EXISTS "Admins and staff view all library" ON public.library_files;
CREATE POLICY "Admins and staff view all library"
    ON public.library_files FOR SELECT
    USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('staff'::public.app_role, auth.uid()));

-- الجميع يزيد عداد التحميل (لمنشورة فقط)
DROP POLICY IF EXISTS "Increment download count published" ON public.library_files;
CREATE POLICY "Increment download count published"
    ON public.library_files FOR UPDATE
    USING (is_published = true)
    WITH CHECK (is_published = true);

-- Admin / Staff CRUD كامل
DROP POLICY IF EXISTS "Admins manage library" ON public.library_files;
CREATE POLICY "Admins manage library"
    ON public.library_files FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "Staff basic library" ON public.library_files;
CREATE POLICY "Staff basic library"
    ON public.library_files FOR INSERT
    WITH CHECK (public.has_role('staff'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "Staff edit library" ON public.library_files;
CREATE POLICY "Staff edit library"
    ON public.library_files FOR UPDATE
    USING (public.has_role('staff'::public.app_role, auth.uid()));

-- -----------------------------------------------------------
-- 10. RLS Policies: CMS (للعامة - قراءة المحتوى المنشور فقط)
-- -----------------------------------------------------------

-- CMS: Public Read for published content
CREATE OR REPLACE FUNCTION public.cms_read_policy_published()
RETURNS boolean AS $$
BEGIN
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- CMS Service Categories
DROP POLICY IF EXISTS "Public view cms services" ON public.cms_service_categories;
CREATE POLICY "Public view cms services"
    ON public.cms_service_categories FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage cms services" ON public.cms_service_categories;
CREATE POLICY "Admins manage cms services"
    ON public.cms_service_categories FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- CMS Service Items + Details (قراءة مفتوحة دائماً لأنها تابعة للفئة)
DROP POLICY IF EXISTS "Public view service items" ON public.cms_service_items;
CREATE POLICY "Public view service items" ON public.cms_service_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public view service details" ON public.cms_service_details;
CREATE POLICY "Public view service details" ON public.cms_service_details FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage service items" ON public.cms_service_items;
CREATE POLICY "Admins manage service items" ON public.cms_service_items FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));
DROP POLICY IF EXISTS "Admins manage service details" ON public.cms_service_details;
CREATE POLICY "Admins manage service details" ON public.cms_service_details FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- CMS Packages
DROP POLICY IF EXISTS "Public view packages" ON public.cms_packages;
CREATE POLICY "Public view packages" ON public.cms_packages FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admins manage packages" ON public.cms_packages;
CREATE POLICY "Admins manage packages" ON public.cms_packages FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "Public view package tiers" ON public.cms_package_tiers;
CREATE POLICY "Public view package tiers" ON public.cms_package_tiers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage package tiers" ON public.cms_package_tiers;
CREATE POLICY "Admins manage package tiers" ON public.cms_package_tiers FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- CMS Impact Stats
DROP POLICY IF EXISTS "Public view impact stats" ON public.cms_impact_stats;
CREATE POLICY "Public view impact stats" ON public.cms_impact_stats FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admins manage impact stats" ON public.cms_impact_stats;
CREATE POLICY "Admins manage impact stats" ON public.cms_impact_stats FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- CMS Partners
DROP POLICY IF EXISTS "Public view partners" ON public.cms_partners;
CREATE POLICY "Public view partners" ON public.cms_partners FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admins manage partners" ON public.cms_partners;
CREATE POLICY "Admins manage partners" ON public.cms_partners FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- CMS Site Settings
DROP POLICY IF EXISTS "Public read site settings" ON public.cms_site_settings;
CREATE POLICY "Public read site settings" ON public.cms_site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage site settings" ON public.cms_site_settings;
CREATE POLICY "Admins manage site settings" ON public.cms_site_settings FOR ALL
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- -----------------------------------------------------------
-- 11. RLS Policies: إضافة RLS على جداول قديمة مهمة إن لم تكن موجودة
-- -----------------------------------------------------------

-- طلبات (requests): التأكد من أن المستخدم يرى طلباته فقط إلا لو كان Admin/Staff
ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own requests" ON public.requests;
CREATE POLICY "Users view own requests"
    ON public.requests FOR SELECT
    USING (user_id = auth.uid() OR public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('staff'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "Users create requests" ON public.requests;
CREATE POLICY "Users create requests"
    ON public.requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins staff update requests" ON public.requests;
CREATE POLICY "Admins staff update requests"
    ON public.requests FOR UPDATE
    USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('staff'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "Admins delete requests" ON public.requests;
CREATE POLICY "Admins delete requests"
    ON public.requests FOR DELETE
    USING (public.has_role('admin'::public.app_role, auth.uid()));

-- -----------------------------------------------------------
-- 12. Function عامة: زيادة عداد التحميل لمكتبة الملفات
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_library_download(file_id uuid)
RETURNS integer AS $$
DECLARE
    new_count integer;
BEGIN
    UPDATE public.library_files
    SET download_count = download_count + 1,
        updated_at = now()
    WHERE id = file_id AND is_published = true
    RETURNING download_count INTO new_count;

    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------
-- 13. Triggers لتحديث عمود updated_at تلقائياً
-- -----------------------------------------------------------

-- دالة عامة للـ trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق على الجداول الجديدة
DROP TRIGGER IF EXISTS handle_bookings_updated_at ON public.bookings;
CREATE TRIGGER handle_bookings_updated_at BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_library_updated_at ON public.library_files;
CREATE TRIGGER handle_library_updated_at BEFORE UPDATE ON public.library_files
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_cms_services_updated_at ON public.cms_service_categories;
CREATE TRIGGER handle_cms_services_updated_at BEFORE UPDATE ON public.cms_service_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_cms_packages_updated_at ON public.cms_packages;
CREATE TRIGGER handle_cms_packages_updated_at BEFORE UPDATE ON public.cms_packages
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_cms_impact_updated_at ON public.cms_impact_stats;
CREATE TRIGGER handle_cms_impact_updated_at BEFORE UPDATE ON public.cms_impact_stats
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_cms_partners_updated_at ON public.cms_partners;
CREATE TRIGGER handle_cms_partners_updated_at BEFORE UPDATE ON public.cms_partners
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_cms_site_updated_at ON public.cms_site_settings;
CREATE TRIGGER handle_cms_site_updated_at BEFORE UPDATE ON public.cms_site_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------
-- 14. دالة لمعرفة دور المستخدم الحالي (تُستخدم في الواجهة)
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS text[] AS $$
DECLARE
    roles text[];
BEGIN
    SELECT ARRAY_AGG(role) INTO roles
    FROM public.user_roles
    WHERE user_id = auth.uid();
    RETURN COALESCE(roles, ARRAY['user']::text[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------
-- 15. إدخال البيانات الأولية من data/site.ts إلى جداول CMS (كمثال أولي)
-- -----------------------------------------------------------

-- شركاء افتراضيون
INSERT INTO public.cms_partners (name, sort_order) VALUES
    ('جمعية أرزاق لحفظ النعمة', 1),
    ('منصة إحسان', 2),
    ('منصة اعتماد', 3),
    ('المركز الوطني لتنمية القطاع غير الربحي', 4),
    ('صندوق دعم الجمعيات', 5),
    ('رؤية السعودية 2030', 6)
ON CONFLICT DO NOTHING;

-- أرقام الأثر افتراضية
INSERT INTO public.cms_impact_stats (stat_value, title, description, icon_name, sort_order) VALUES
    ('+250', 'جمعية ومؤسسة أهلية', 'تمكين أكثر من 250 جمعية ومؤسسة أهلية من الوصول إلى الاستدامة المالية ورفع مؤشرات الحوكمة الشاملة.', 'Target', 1),
    ('+50 مليون ريال', 'تنمية واسترداد', 'تنمية واسترداد أكثر من ٥٠ مليون ريال لصالح القطاع غير الربحي عبر منصات المنح (إحسان، اعتماد) وبرامج الاسترداد الضريبي.', 'TrendingUp', 2),
    ('+300', 'حملة تسويقية', 'إدارة وتنفيذ أكثر من ٣٠٠ حملة تسويقية تستهدف تعميق الأثر المجتمعي ومضاعفة التفاعل الرقمي للكيانات الشريكة.', 'Megaphone', 3)
ON CONFLICT DO NOTHING;

-- إعدادات افتراضية للموقع
INSERT INTO public.cms_site_settings (key, value) VALUES
    ('contact', jsonb_build_object(
        'email', 'openloop2030@gmail.com',
        'phone', '0556006142',
        'whatsapp', '966556006142',
        'working_hours', 'الأحد - الخميس، 8 صباحاً حتى 2:30 ظهراً'
    )),
    ('social', jsonb_build_object(
        'twitter', '',
        'instagram', '',
        'linkedin', '',
        'youtube', ''
    )),
    ('library', jsonb_build_object(
        'max_file_size_mb', 20,
        'allowed_types', ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    )),
    ('uploads', jsonb_build_object(
        'max_file_size_mb', 10,
        'allowed_types', ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    )),
    ('commission', jsonb_build_object('percent', 1))
ON CONFLICT (key) DO NOTHING;
