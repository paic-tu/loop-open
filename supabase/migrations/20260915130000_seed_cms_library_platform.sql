-- =====================================================================
-- ملء البيانات الأولية (Seed Data) لمنصة Open Loop
-- ✅ النسخة المبسطة: كل عبارة INSERT مستقلة (بدون CTEs / بدون UNION)
--    يعمل في أي بيئة (Supabase SQL Editor / psql / Node.js / المحرر الجرافيكي)
-- =====================================================================

-- =====================================================================
-- ١. مكتبة الملفات (library_files) - بيانات نموذجية
-- =====================================================================
INSERT INTO public.library_files
(title, description, category, file_path, file_name, file_size, mime_type, download_count, is_published, sort_order, icon_name)
VALUES
('دليل تأسيس الجمعية الخيرية',            'دليل استرشادي يتضمن جميع خطوات تأسيس الجمعية الخيرية وفقاً لنظام الجمعيات والمؤسسات المهنية، مع نماذج نظام أساسي جاهزة للاستخدام.', 'templates', 'templates/saudi-association-establishment-guide.pdf', 'دليل تأسيس الجمعية الخيرية.pdf', 2450000, 'application/pdf', 42, true, 1, 'FileText'),
('نموذج النظام الأساسي للجمعية الخيرية',  'نموذج جاهز لنظام أساسي للجمعية الخيرية، متوافق مع نظام الجمعيات رقم ٦١ لسنة ٢٠٢٤، مع توجيهات لتعبئة المواد الأساسية (الأهداف، الهيكل التنفيذي، الجمعية العمومية).', 'templates', 'templates/model-association-statute.docx', 'نموذج النظام الأساسي للجمعية الخيرية.docx', 180000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 128, true, 2, 'FileSpreadsheet'),
('قالب خطة تشغيلية سنوية للجمعية',         'قالب Excel متكامل لبناء الخطة التشغيلية السنوية مع جداول الميزانية التقديرية، الأهداف، ومؤشرات قياس الأداء KPI لكل قسم.', 'templates', 'templates/annual-operational-plan-template.xlsx', 'قالب خطة تشغيلية سنوية للجمعية.xlsx', 650000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 96, true, 3, 'FileSpreadsheet'),
('دراسة استراتيجية تنمية الموارد ٢٠٢٥',    'دراسة استراتيجية مختصرة توضح خريطة الطريق لتنمية موارد الجمعية عبر ثلاث قنوات رئيسية: المنح الحكومية، المتطوعون، والتمويل المجتمعي من الشركات.', 'reports',   'reports/resource-development-strategy-2025.pdf', 'دراسة استراتيجية تنمية الموارد ٢٠٢٥.pdf', 4200000, 'application/pdf', 15, true, 4, 'BookOpen'),
('تقرير الأثر السنوي للقطاع غير الربحي',   'نسخة تجريبية من تقرير الأثر السنوي الموحد، يمكن للجمعيات تعديل أرقامها والإحصائيات والصور فيه للحصول على نسخة احترافية جاهزة للمانحين.', 'reports',   'reports/annual-impact-report-example.pdf', 'تقرير الأثر السنوي للقطاع غير الربحي.pdf', 8750000, 'application/pdf', 23, true, 5, 'BarChart3'),
('دليل الاسترداد الضريبي للجمعيات',        'شرح مبسط وشامل لخدمات الاسترداد الضريبي للشخص المؤهل، وكيفية حساب المبلغ المسترد، وجدول المقارنة بين الخدمات المقدمة من فريق Open Loop.', 'tax',       'tax/vat-refund-guide-for-npo.pdf', 'دليل الاسترداد الضريبي للجمعيات.pdf', 1250000, 'application/pdf', 304, true, 6, 'Receipt'),
('قالب إقرار ضريبة القيمة المضافة',        'قالب Excel جاهز لحساب الإقرار الشهري/الربعوي لضريبة القيمة المضافة، مع ورقة عمل مفصولة للمبيعات والمشتريات وحساب فرق الضريبة.', 'tax',       'tax/vat-declaration-template.xlsx', 'قالب إقرار ضريبة القيمة المضافة.xlsx', 340000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 87, true, 7, 'Calculator'),
('دليل التسويق المجتمعي للجمعيات',         'دليل ميداني عملي لتخطيط حملات تسويق مجتمعي مؤثرة، مع مثال عن كيفية بناء حملة رمضانية متكاملة من الصفر حتى انتهاء الحملة وقياس مؤشرات الأداء.', 'marketing', 'marketing/community-marketing-playbook.pdf', 'دليل التسويق المجتمعي للجمعيات.pdf', 6800000, 'application/pdf', 112, true, 8, 'Megaphone'),
('قالب سوشيال ميديا شهر كامل',             '30 فكرة محتوى جاهزة لمحرري منصات التواصل الاجتماعي للجمعيات، مع أمثلة نصية جاهزة للنسخ، وتصنيف حسب اليوم والوقت والهدف.', 'marketing', 'marketing/social-media-30-day-calendar.docx', 'قالب سوشيال ميديا شهر كامل.docx', 240000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 210, true, 9, 'Share2')
ON CONFLICT (title) DO NOTHING;

-- =====================================================================
-- ٢. فئات الخدمات (cms_service_categories) — 5 صفوف
-- =====================================================================
INSERT INTO public.cms_service_categories (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES ('resources', '01', 'خدمات تنمية الموارد', 'تأهيل الكيانات غير الربحية للوصول إلى المنح والفرص التمويلية عبر منصات الدعم الحكومي والأهلي.', 'resources', true, 1)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_service_categories (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES ('design', '02', 'خدمات التصميم', 'هوية بصرية ومواد إبداعية تعكس رسالة الكيان وتعمّق أثره لدى الجمهور والمانحين.', 'design', true, 2)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_service_categories (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES ('content', '03', 'خدمات المحتوى', 'محتوى احترافي مكتوب بلغة الأثر، يخاطب المستفيد والمانح والشريك الاستراتيجي.', 'content', true, 3)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_service_categories (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES ('marketing', '04', 'خدمات التسويق', 'إدارة تسويقية متكاملة ترفع الحضور الرقمي وتحوّل التفاعل إلى دعم مستدام.', 'marketing', true, 4)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_service_categories (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES ('tax', '05', 'خدمات الضريبة والاسترداد الضريبي للجمعيات', 'خدمات ضريبية متخصصة للكيانات غير الربحية: التأهيل للاسترداد الضريبي، والتسجيل في ضريبة القيمة المضافة، وإلغاء التسجيل، وإعداد الإقرارات، بشكل معتمد ومتوافق مع أنظمة هيئة الزكاة والضريبة والجمارك.', 'tax', true, 5)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

-- =====================================================================
-- ٣. عناصر كل فئة خدمة (cms_service_items) — باستخدام subquery لكل فئة
-- =====================================================================
INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, t.description, t.sort_order
FROM public.cms_service_categories c,
(VALUES
  ('تسجيل منصة اعتماد',          NULL, 1),
  ('كتابة منافسة عامة',          NULL, 2),
  ('كتابة منافسة شراء مباشر',    NULL, 3),
  ('كتابة المشاريع للمؤسسات المانحة', NULL, 4),
  ('رفع الفرصة لإحسان / سنوي',   NULL, 5),
  ('صندوق دعم الجمعيات - المنح العادية',  NULL, 6),
  ('صندوق دعم الجمعيات - المنح الموجهة',  NULL, 7)
) AS t(title, description, sort_order)
WHERE c.slug = 'resources';

INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, t.description, t.sort_order
FROM public.cms_service_categories c,
(VALUES
  ('شعار - نموذج واحد',          NULL, 1),
  ('مطبوعات الهوية 2D',          NULL, 2),
  ('مطبوعات الهوية 3D',          NULL, 3),
  ('تصميم بوست / الواحد',        NULL, 4),
  ('تصميم إعلان',                NULL, 5),
  ('تصميم لوحة 50×50',           NULL, 6),
  ('تصميم واجهة متجر',           NULL, 7),
  ('فيديو إعلاني سينمائي بالذكاء الاصطناعي', NULL, 8),
  ('فيديو مونتاج - دقيقة - بالذكاء الاصطناعي', NULL, 9),
  ('تصميم إنفوجرافيك',           NULL, 10),
  ('تصميم بوستر',                NULL, 11),
  ('تصميم قالب سوشال',           NULL, 12),
  ('تصميم هايلايت إنستغرام',     NULL, 13),
  ('تصميم دليل هوية',            NULL, 14),
  ('عرض تقديمي / صفحة',          NULL, 15),
  ('خطة تسويقية',                NULL, 16)
) AS t(title, description, sort_order)
WHERE c.slug = 'design';

INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, t.description, t.sort_order
FROM public.cms_service_categories c,
(VALUES
  ('بوست إعلاني',                  NULL, 1),
  ('بوست سوشال',                   NULL, 2),
  ('بوست كاروسيل',                 NULL, 3),
  ('محتوى بروفايل / صفحة',         NULL, 4),
  ('محتوى موقع تعريفي / صفحة',     NULL, 5),
  ('محتوى متجر / صفحة',            NULL, 6),
  ('إيميل تسويقي',                 NULL, 7),
  ('محتوى عرض تقديمي',             NULL, 8),
  ('سكريبت فيديو ذكاء اصطناعي',    NULL, 9),
  ('سكريبت فيديو مونتاج',          NULL, 10),
  ('إعادة صياغة محتوى',            NULL, 11),
  ('تلخيص محتوى',                  NULL, 12),
  ('خطة محتوى شهرية',              NULL, 13),
  ('محتوى قصة',                    NULL, 14),
  ('سيناريو إعلاني',               NULL, 15)
) AS t(title, description, sort_order)
WHERE c.slug = 'content';

INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, t.description, t.sort_order
FROM public.cms_service_categories c,
(VALUES
  ('إدارة حملات ممولة',                             NULL, 1),
  ('إدارة محتوى مواقع التواصل الاجتماعي',           NULL, 2),
  ('إدارة المتاجر الإلكترونية',                     NULL, 3)
) AS t(title, description, sort_order)
WHERE c.slug = 'marketing';

INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, t.description, t.sort_order
FROM public.cms_service_categories c,
(VALUES
  ('التسجيل كشخص مؤهل للاسترداد الضريبي (تقديم المستندات المطلوبة حسب الحالة فقط)', NULL, 1),
  ('التسجيل في ضريبة القيمة المضافة (VAT Registration)',                           NULL, 2),
  ('إلغاء التسجيل في ضريبة القيمة المضافة — ملاحظة: إلغاء التسجيل فقط بدون خدمة تصفية الإقرارات', NULL, 3),
  ('إعداد ورفع الإقرارات الضريبية (إضافة اختيارية / مستقلة)',                       NULL, 4),
  ('خدمة الاسترداد الضريبي للشخص المؤهل للاسترداد (طلب الاسترداد الضريبي الفعلي)',  NULL, 5)
) AS t(title, description, sort_order)
WHERE c.slug = 'tax';

-- =====================================================================
-- ٤. الباقات (cms_packages)
-- =====================================================================
INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('social-1',
  'باقة إدارة حسابات مواقع التواصل الاجتماعي',
  'لمدة شهر — الباقة الأولى',
  ARRAY['12 منشور (بوست - كاروسيل)', 'خطة تسويق شهرياً', '16 استوري انستقرام', '10 مقاطع تيك توك (AI + موشن + مونتاج)', 'ريلز انستقرام', 'جلسة استشارية تسويقية مجاناً'],
  '4,927 ريال شامل الضريبة', true, true, 1)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('social-2',
  'باقة إدارة حسابات مواقع التواصل الاجتماعي',
  'لمدة شهر — الباقة الثانية',
  ARRAY['منشورات بصيغة (بوست - كاروسيل)', 'خطة تسويق شهرياً', '12 استوري انستقرام', 'مقاطع تيك توك (AI + موشن + مونتاج)', 'ريلز انستقرام', 'جلسة استشارية تسويقية مجاناً'],
  '3,754 ريال شامل الضريبة', false, true, 2)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('social-3',
  'باقة إدارة حسابات مواقع التواصل الاجتماعي',
  'لمدة شهر — الباقة الثالثة',
  ARRAY['منشورات بصيغة (بوست - كاروسيل)', 'خطة تسويق شهرياً', 'استوري انستقرام', 'مقاطع تيك توك (AI + موشن + مونتاج)', 'ريلز انستقرام', 'جلسة استشارية تسويقية مجاناً'],
  '2,933 ريال شامل الضريبة', false, true, 3)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('ads',
  'باقة الحملات الإعلانية الممولة',
  'لمدة 6 أشهر',
  ARRAY['إدارة الحملات الإعلانية الممولة', 'تصميم المواد الإعلانية للحملة', 'جلسة استشارية تسويقية شهرية مجاناً'],
  '3,617 ريال شامل الضريبة', false, true, 4)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('vat',
  'باقة الاسترداد الضريبي',
  'لمدة سنة',
  ARRAY['إعداد ملف استرداد ضريبة القيمة المضافة', 'استشارات طيلة فترة الخدمة', 'متابعة حالة طلب الاسترداد مع الهيئة'],
  NULL, false, true, 5)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('resources',
  'باقة تنمية الموارد المالية',
  'لمدة سنة',
  ARRAY['كتابة (منافسة الشراء المباشر أو المنافسات العامة)', 'تسجيل منصة «اعتماد»', 'كتابة المشاريع للمؤسسات المانحة', 'صندوق دعم الجمعيات (المنح العادية - المنح الموجهة)', 'رفع الفرص في إحسان'],
  '26,496 ريال شامل الضريبة', true, true, 6)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

INSERT INTO public.cms_packages (slug, title, subtitle, features, price, is_featured, is_published, sort_order)
VALUES ('governance',
  'باقة الإمتثال والحوكمة',
  'خدمة متكاملة',
  ARRAY['رفع التقييم الذاتي', 'متابعة التنفيذ', 'مراجعة السياسات واللوائح والإجراءات', 'إدارة الموقع الإلكتروني', 'استشارات مجانية طيلة فترة التنفيذ', 'إعداد الخطة ومتابعة المؤشرات'],
  '15,180 ريال شامل الضريبة', false, true, 7)
ON CONFLICT (slug) DO UPDATE SET updated_at = NOW();

-- =====================================================================
-- ٥. شرائح أسعار باقة الاسترداد الضريبي (cms_package_tiers)
-- =====================================================================
INSERT INTO public.cms_package_tiers (package_id, label, price, sort_order)
SELECT id, 'الجمعيات الكبيرة – المتوسطة',
       '13,685 ريال شامل الضريبة + 5% من قيمة الاسترداد لكل ربع', 1
FROM public.cms_packages WHERE slug = 'vat';

INSERT INTO public.cms_package_tiers (package_id, label, price, sort_order)
SELECT id, 'الجمعيات الصغيرة - متناهية الصغر',
       '3,422 ريال شامل الضريبة + 10% من قيمة الاسترداد لكل ربع', 2
FROM public.cms_packages WHERE slug = 'vat';

-- =====================================================================
-- ٦. أرقام الأثر (cms_impact_stats)
-- =====================================================================
INSERT INTO public.cms_impact_stats (stat_value, title, description, icon_name, sort_order, is_published)
VALUES
  ('+250',          'جمعية ومؤسسة أهلية',
   'تمكين أكثر من 250 جمعية ومؤسسة أهلية من الوصول إلى الاستدامة المالية ورفع مؤشرات الحوكمة الشاملة.',
   'Target',     1, true),
  ('+50 مليون ريال','تنمية واسترداد',
   'تنمية واسترداد أكثر من ٥٠ مليون ريال لصالح القطاع غير الربحي عبر منصات المنح (إحسان، اعتماد) وبرامج الاسترداد الضريبي.',
   'TrendingUp', 2, true),
  ('+300',          'حملة تسويقية',
   'إدارة وتنفيذ أكثر من ٣٠٠ حملة تسويقية تستهدف تعميق الأثر المجتمعي ومضاعفة التفاعل الرقمي للكيانات الشريكة.',
   'Megaphone',  3, true)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- ٧. الشركاء (cms_partners)
-- =====================================================================
INSERT INTO public.cms_partners (name, logo_url, website_url, sort_order, is_published)
VALUES
  ('جمعية أرزاق لحفظ النعمة',              NULL, 'https://www.arzak.sa',         1, true),
  ('منصة إحسان',                             NULL, 'https://ehsan.sa',             2, true),
  ('منصة اعتماد',                            NULL, 'https://etimad.sa',            3, true),
  ('المركز الوطني لتنمية القطاع غير الربحي', NULL, 'https://www.npo.gov.sa',       4, true),
  ('صندوق دعم الجمعيات',                     NULL, 'https://www.saudisf.sa',       5, true),
  ('رؤية السعودية 2030',                     NULL, 'https://vision2030.gov.sa',    6, true)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- ٨. إعدادات الموقع العامة (cms_site_settings)
-- =====================================================================
INSERT INTO public.cms_site_settings (key, value)
VALUES
  ('contact',
   '{
      "email":       "openloop2030@gmail.com",
      "phone":       "0556006142",
      "whatsapp":    "966556006142",
      "address":     "الرياض، المملكة العربية السعودية",
      "working_hours": "الأحد - الخميس، 8 صباحاً حتى 2:30 ظهراً"
    }'::jsonb),
  ('social',
   '{
      "twitter":   "",
      "instagram": "https://instagram.com/openloop",
      "linkedin":  "https://linkedin.com/company/open-loop-solutions",
      "youtube":   "",
      "tiktok":    "",
      "x":         ""
    }'::jsonb),
  ('brand',
   '{
      "site_name_ar":  "أوبن لوب - Open Loop",
      "site_name_en":  "Open Loop",
      "tagline_ar":    "حلول تكاملية للقطاع غير الربحي",
      "tagline_en":    "Integrated solutions for the non-profit sector",
      "logo_url":      null,
      "favicon_url":   null
    }'::jsonb),
  ('scripts',
   '{
      "google_analytics_id": "",
      "google_tag_manager_id": "",
      "head_extra_html": "",
      "body_extra_html": ""
    }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- =====================================================================
-- ٩. إعدادات المنصة العامة (platform_settings) — إنشاء + Seed
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key text NOT NULL UNIQUE,
    setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
    description text,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('rfq_defaults',
   '{
      "rfq_expiry_days_default": 14,
      "default_currency": "SAR",
      "default_vat_rate": 0.15,
      "auto_archive_completed_days": 90
    }'::jsonb,
   'إعدادات افتراضية لطلبات العروض RFQ'),
  ('commissions',
   '{
      "platform_commission_rate": 0.03,
      "supplier_commission_rate": 0.02,
      "community_commission_rate": 0.01,
      "minimum_commission_sar": 250,
      "maximum_commission_sar": 50000
    }'::jsonb,
   'عمولات المنصة على التعاقدات والصفقات المغلقة'),
  ('notifications',
   '{
      "admin_email_alerts": ["admin@open-loopsa.com"],
      "send_sms_on_new_booking": false,
      "send_email_on_status_change": true,
      "sms_provider": "none"
    }'::jsonb,
   'تفعيل قنوات الإشعارات للمستخدمين والإدارة')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

-- =====================================================================
-- ١٠. تحديث updated_at للجداول التي تحتوي هذا العمود
-- =====================================================================
UPDATE public.cms_service_categories SET updated_at = NOW() WHERE TRUE;
UPDATE public.cms_packages          SET updated_at = NOW() WHERE TRUE;
UPDATE public.cms_impact_stats      SET updated_at = NOW() WHERE TRUE;
UPDATE public.cms_partners          SET updated_at = NOW() WHERE TRUE;
