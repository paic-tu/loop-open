-- =====================================================================
-- إضافة تصنيف «مشاريع الإعاشة» إلى فئات الخدمات (CMS)
-- تنفيذ آمن ومتكرر (Idempotent) — لا يُنشئ تكراراً عند إعادة التشغيل.
-- =====================================================================

-- ١. الفئة
INSERT INTO public.cms_service_categories
  (slug, display_order, title, description, icon_name, is_published, sort_order)
VALUES (
  'catering',
  '06',
  'مشاريع الإعاشة',
  'تنفيذ وتأمين مشاريع الإعاشة والمبادرات الميدانية وفق أعلى معايير الجودة والسلامة، لتصل مبادراتكم إلى مستحقيها بكفاءة عالية.',
  'catering',
  true,
  6
)
ON CONFLICT (slug) DO UPDATE
  SET display_order = EXCLUDED.display_order,
      title         = EXCLUDED.title,
      description   = EXCLUDED.description,
      icon_name     = EXCLUDED.icon_name,
      is_published  = EXCLUDED.is_published,
      sort_order    = EXCLUDED.sort_order,
      updated_at    = NOW();

-- ٢. عناصر الفئة (أنواع المشاريع) — مع منع التكرار
INSERT INTO public.cms_service_items (category_id, title, description, sort_order)
SELECT c.id, t.title, NULL, t.sort_order
FROM public.cms_service_categories c
CROSS JOIN (VALUES
  ('سقيا ماء',           1),
  ('وجبات جاهزة ساخنة', 2),
  ('وجبات جافة',        3)
) AS t(title, sort_order)
WHERE c.slug = 'catering'
  AND NOT EXISTS (
    SELECT 1 FROM public.cms_service_items i
    WHERE i.category_id = c.id AND i.title = t.title
  );
