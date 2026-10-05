import { supabase } from "@/integrations/supabase/client";
import {
  packages as fallbackPackages,
  serviceCategories as fallbackServices,
  partners as fallbackPartners,
} from "@/data/site";

export type CmsServiceCat = {
  id: string;
  slug: string;
  display_order: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  is_published: boolean;
  sort_order: number;
  items: string[];
  details?: { title: string; description: string }[];
};

export type CmsPackage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  features: string[];
  price: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  tiers?: { label: string; price: string }[];
};

export type CmsImpactStat = {
  id: string;
  stat_value: string;
  title: string;
  description: string | null;
  icon_name: string;
  sort_order: number;
  is_published: boolean;
};

export type CmsPartner = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_published: boolean;
};

export async function getServiceCategories(): Promise<CmsServiceCat[]> {
  const { data, error } = await supabase
    .from("cms_service_categories")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (error) return [];
  const cats = (data ?? []) as Array<
    CmsServiceCat & { id: string }
  >;
  const result: CmsServiceCat[] = [];
  for (const c of cats) {
    const [itemsRes, detailsRes] = await Promise.all([
      supabase
        .from("cms_service_items")
        .select("title")
        .eq("category_id", c.id)
        .order("sort_order"),
      supabase
        .from("cms_service_details")
        .select("title, description")
        .eq("category_id", c.id)
        .order("sort_order"),
    ]);
    result.push({
      ...c,
      items: (itemsRes.data ?? []).map((i) => i.title) as string[],
      details: (detailsRes.data ?? []) as { title: string; description: string }[],
    });
  }

  if (result.length === 0) {
    return fallbackServices.map((s) => ({
      id: s.slug,
      slug: s.slug,
      display_order: s.order,
      title: s.title,
      description: s.description,
      icon_name: s.iconName ?? null,
      is_published: true,
      sort_order: parseInt(s.order, 10) || 0,
      items: s.items,
      details: s.details ?? [],
    }));
  }

  return result;
}

export async function getPackages(): Promise<CmsPackage[]> {
  const { data, error } = await supabase
    .from("cms_packages")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (error) return [];
  const rows = (data ?? []) as Array<CmsPackage & { id: string }>;
  const result: CmsPackage[] = [];
  for (const p of rows) {
    const tiersRes = await supabase
      .from("cms_package_tiers")
      .select("label, price")
      .eq("package_id", p.id)
      .order("sort_order");
    result.push({
      ...p,
      tiers: (tiersRes.data ?? []) as { label: string; price: string }[],
    });
  }

  if (result.length === 0) {
    return fallbackPackages.map((p, idx) => ({
      id: p.id,
      slug: p.id,
      title: p.title,
      subtitle: p.subtitle,
      features: p.features,
      price: p.price ?? null,
      is_featured: !!p.featured,
      is_published: true,
      sort_order: idx,
      tiers: p.tiers ?? [],
    }));
  }

  return result;
}

export async function getImpactStats(): Promise<CmsImpactStat[]> {
  const { data, error } = await supabase
    .from("cms_impact_stats")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (error) return [];
  if ((data ?? []).length === 0) {
    return [
      {
        id: "1",
        stat_value: "+250",
        title: "جمعية ومؤسسة أهلية",
        description:
          "تمكين أكثر من 250 جمعية ومؤسسة أهلية من الوصول إلى الاستدامة المالية ورفع مؤشرات الحوكمة الشاملة.",
        icon_name: "Target",
        sort_order: 1,
        is_published: true,
      },
      {
        id: "2",
        stat_value: "+50 مليون ريال",
        title: "تنمية واسترداد",
        description:
          "تنمية واسترداد أكثر من ٥٠ مليون ريال لصالح القطاع غير الربحي عبر منصات المنح (إحسان، اعتماد) وبرامج الاسترداد الضريبي.",
        icon_name: "TrendingUp",
        sort_order: 2,
        is_published: true,
      },
      {
        id: "3",
        stat_value: "+300",
        title: "حملة تسويقية",
        description:
          "إدارة وتنفيذ أكثر من ٣٠٠ حملة تسويقية تستهدف تعميق الأثر المجتمعي ومضاعفة التفاعل الرقمي للكيانات الشريكة.",
        icon_name: "Megaphone",
        sort_order: 3,
        is_published: true,
      },
    ];
  }
  return (data ?? []) as CmsImpactStat[];
}

export async function getPartners(): Promise<CmsPartner[]> {
  const { data, error } = await supabase
    .from("cms_partners")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (error) return [];
  if ((data ?? []).length === 0) {
    return fallbackPartners.map((n, i) => ({
      id: String(i),
      name: n,
      logo_url: null,
      website_url: null,
      sort_order: i,
      is_published: true,
    }));
  }
  return (data ?? []) as CmsPartner[];
}

export async function getSiteSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("cms_site_settings").select("key, value");
  const map: Record<string, unknown> = {
    contact: {
      email: "openloop2030@gmail.com",
      phone: "0556006142",
      whatsapp: "966556006142",
      working_hours: "الأحد - الخميس، 8 صباحاً حتى 2:30 ظهراً",
    },
    social: { twitter: "", instagram: "", linkedin: "", youtube: "" },
  };
  if (!error) {
    for (const row of data ?? []) {
      map[row.key] = row.value ?? {};
    }
  }
  return map;
}
