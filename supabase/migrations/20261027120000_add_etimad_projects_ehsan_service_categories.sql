-- =====================================================================
-- إضافة تصنيفات الخدمات الثلاثة إلى فئات الخدمات (CMS):
--   ٠٧ خدمات منصة اعتماد — ٠٨ خدمات المشاريع — ٠٩ خدمات منصة إحسان
-- تنفيذ آمن ومتكرر (Idempotent) — لا يُنشئ تكراراً عند إعادة التشغيل.
-- =====================================================================

-- ١. الفئات
INSERT INTO public.cms_service_categories
  (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES (
  'etimad',
  '07',
  'خدمات منصة اعتماد',
  'إدارة كاملة لدورة المنافسات الحكومية عبر منصة اعتماد: التسجيل في المنصة، وكتابة المنافسات العامة وشراء مباشر باحترافية ترفع فرص القبول.',
  'etimad',
  true,
  7
)
ON CONFLICT (slug) DO UPDATE
  SET display_order = EXCLUDED.display_order,
      title         = EXCLUDED.title,
      description   = EXCLUDED.description,
      icon_name     = EXCLUDED.icon_name,
      is_published  = EXCLUDED.is_published,
      sort_order    = EXCLUDED.sort_order,
      updated_at    = NOW();

INSERT INTO public.cms_service_categories
  (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES (
  'projects',
  '08',
  'خدمات المشاريع',
  'إعداد ورفع المشاريع للجهات المانحة وصندوق دعم الجمعيات، من كتابة المشروع وتصميمه إلى الرفع والمتابعة حتى الاعتماد.',
  'projects',
  true,
  8
)
ON CONFLICT (slug) DO UPDATE
  SET display_order = EXCLUDED.display_order,
      title         = EXCLUDED.title,
      description   = EXCLUDED.description,
      icon_name     = EXCLUDED.icon_name,
      is_published  = EXCLUDED.is_published,
      sort_order    = EXCLUDED.sort_order,
      updated_at    = NOW();

INSERT INTO public.cms_service_categories
  (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES (
  'ehsan',
  '09',
  'خدمات منصة إحسان',
  'إدارة حضور كيانك على منصة إحسان: الاشتراك السنوي، ورفع الفرص، وإغلاقها في الوقت المناسب.',
  'ehsan',
  true,
  9
)
ON CONFLICT (slug) DO UPDATE
  SET display_order = EXCLUDED.display_order,
      title         = EXCLUDED.title,
      description   = EXCLUDED.description,
      icon_name     = EXCLUDED.icon_name,
      is_published  = EXCLUDED.is_published,
      sort_order    = EXCLUDED.sort_order,
      updated_at    = NOW();

-- ٢. عناصر كل فئة — مع منع التكرار

-- خدمات منصة اعتماد
INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, NULL, t.sort_order
FROM public.cms_service_categories c
CROSS JOIN (VALUES
  ('التسجيل في منصة اعتماد',     1),
  ('كتابة منافسة عامة',          2),
  ('كتابة منافسة شراء مباشر',    3)
) AS t(title, sort_order)
WHERE c.slug = 'etimad'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_service_items i
    WHERE i.category_id = c.id AND i.title = t.title
  );

-- خدمات المشاريع
INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, NULL, t.sort_order
FROM public.cms_service_categories c
CROSS JOIN (VALUES
  ('الجهات المانحة',                          1),
  ('صندوق دعم الجمعيات',                      2),
  ('رفع مشروع لصندوق دعم الجمعيات',           3),
  ('كتابة وتصميم مشروع للجهات المانحة',       4),
  ('رفع المشاريع للجهات المانحة',             5)
) AS t(title, sort_order)
WHERE c.slug = 'projects'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_service_items i
    WHERE i.category_id = c.id AND i.title = t.title
  );

-- خدمات منصة إحسان
INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, NULL, t.sort_order
FROM public.cms_service_categories c
CROSS JOIN (VALUES
  ('اشتراك سنوي', 1),
  ('رفع فرصة',    2),
  ('إغلاق فرصة',  3)
) AS t(title, sort_order)
WHERE c.slug = 'ehsan'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_service_items i
    WHERE i.category_id = c.id AND i.title = t.title
  );
