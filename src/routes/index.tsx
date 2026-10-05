import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroSlider } from "@/components/HeroSlider";
import { SectionHeading } from "@/components/Sections";
import { PackagesCarousel } from "@/components/PackagesCarousel";
import { PartnersMarquee } from "@/components/PartnersMarquee";
import { CateringSection } from "@/components/CateringSection";
import { ServicesShowcase } from "@/components/ServicesShowcase";
import { JoinBanner } from "@/components/Footer";
import { packages as fallbackPackages, type Pkg, partners as fallbackPartnerNames } from "@/data/site";
import {
  getPackages,
  getImpactStats,
  getPartners,
  getServiceCategories,
  type CmsImpactStat,
  type CmsPackage,
} from "@/lib/cms";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "أوبن لوب | Open Loop — تسويق واستشارات القطاع غير الربحي" },
      {
        name: "description",
        content:
          "أوبن لوب: مؤسسة تسويق واستشارات متكاملة تمكّن الجمعيات والقطاع غير الربحي من الاستدامة المالية والحوكمة المؤسسية وتعميق الأثر.",
      },
      { property: "og:title", content: "أوبن لوب | Open Loop" },
      {
        property: "og:description",
        content: "شريكك الاستراتيجي للاستدامة المالية والحوكمة المؤسسية في القطاع غير الربحي.",
      },
    ],
  }),
  component: Index,
});

function toPkg(cp: CmsPackage): Pkg {
  return {
    id: cp.slug || cp.id,
    title: cp.title,
    subtitle: cp.subtitle ?? "",
    features: cp.features ?? [],
    price: cp.price ?? undefined,
    tiers: cp.tiers ?? [],
    featured: !!cp.is_featured,
  };
}

const iconByName: Record<string, LucideIcon> = {
  Target,
  TrendingUp,
  Megaphone,
};

const segments = [
  {
    title: "كيانات غير ربحية تبحث عن التمويل والمنح",
    text: "صياغة مشاريع احترافية وتصميم ملفات متكاملة للمؤسسات المانحة وصندوق دعم الجمعيات.",
  },
  {
    title: "كيانات غير ربحية تسعى لرفع الإيرادات",
    text: "استفادة من منصات الدعم الحكومي والأهلي عبر التأهيل الفني والمالي والتنفيذي.",
  },
  {
    title: "كيانات غير ربحية ترغب في نمو حضورها وتأثيرها",
    text: "حلول تسويقية وإعلانية ممولة لجذب المانحين بثقة.",
  },
];

function ImpactRow({ stat }: { stat: CmsImpactStat }) {
  const Icon = iconByName[stat.icon_name] ?? Target;
  return (
    <div className="surface-ink rounded-[2rem] p-8">
      <Icon className="h-8 w-8 opacity-90" aria-hidden />
      <p className="mt-5 text-3xl font-extrabold">{stat.stat_value}</p>
      <p className="mt-1 text-sm font-bold opacity-90">{stat.title}</p>
      <p className="mt-4 text-sm leading-relaxed opacity-75">
        {stat.description}
      </p>
    </div>
  );
}

function Index() {
  const packagesQ = useQuery({
    queryKey: ["cms-packages"],
    queryFn: () => getPackages(),
    staleTime: 60_000,
  });
  const impactQ = useQuery({
    queryKey: ["cms-impact"],
    queryFn: () => getImpactStats(),
    staleTime: 60_000,
  });
  const partnersQ = useQuery({
    queryKey: ["cms-partners"],
    queryFn: () => getPartners(),
    staleTime: 60_000,
  });
  const servicesQ = useQuery({
    queryKey: ["cms-services"],
    queryFn: () => getServiceCategories(),
    staleTime: 60_000,
  });

  const pkgs: Pkg[] = (packagesQ.data ?? []).map(toPkg);
  const useFallbackPkgs = pkgs.length === 0 && !packagesQ.isLoading;

  const impactRows = impactQ.data ?? [];
  const partnersRows = partnersQ.data ?? [];
  const servicesRows = servicesQ.data ?? [];

  return (
    <>
      <HeroSlider />

      {/* ABOUT BRIEF */}
      <section className="section-pad">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="من نحن"
            title="عن أوبن لوب (Open Loop)"
            description="منذ انطلاقتنا، جمعت أوبن لوب نخبة من خبراء التسويق الرقمي، والاستشاريين، وصنّاع الأثر في القطاع الثالث؛ لسد الفجوة بين الأهداف المجتمعية النبيلة والنمو المؤسسي المستدام."
          />
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground hover:bg-primary/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90"
          >
            <Link to="/about">
              اقرأ قصتنا
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      {/* SERVICES SHOWCASE */}
      <ServicesShowcase categories={servicesRows.length ? servicesRows : undefined} />

      {/* PACKAGES */}
      <section id="packages" className="section-pad bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="مصفوفة الباقات"
            title="باقات مصممة لاحتياجات الكيانات غير الربحية"
            description="قارن بين الباقات واختر ما يناسب مرحلة نمو جمعيتك."
          />
          {packagesQ.isLoading ? (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[380px] w-full rounded-3xl" />
              ))}
            </div>
          ) : (
            <PackagesCarousel items={useFallbackPkgs ? fallbackPackages : pkgs} />
          )}
        </div>
      </section>

      {/* CATERING */}
      <CateringSection />

      {/* IMPACT */}
      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="المستهدف والأثر"
            title="أثرنا المستهدف حتى 2030"
            description="أرقام نعمل عليها مع شركائنا في القطاع الثالث لتحويل الفرص إلى استدامة حقيقية."
          />
          {impactQ.isLoading ? (
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[260px] w-full rounded-[2rem]" />
              ))}
            </div>
          ) : (
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {impactRows.map((i) => (
                <ImpactRow key={i.id} stat={i} />
              ))}
            </div>
          )}

          <div className="mt-16">
            <SectionHeading title="حلولنا موجهة إلى الكيانات غير الربحية" />
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {segments.map((s, idx) => (
                <div key={s.title} className="card-elevated p-7">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-base font-extrabold text-accent-foreground">
                    {idx + 1}
                  </span>
                  <h3 className="mt-4 text-base font-extrabold leading-snug">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section className="section-pad bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="ثقة متبادلة" title="شركاء النجاح" />
        </div>
        <div className="mt-10">
          <PartnersMarquee
            partners={partnersRows.length ? partnersRows : undefined}
            namesOnlyFallback={!partnersRows.length ? fallbackPartnerNames : undefined}
          />
        </div>
      </section>

      <div className="pt-16">
        <JoinBanner />
      </div>
    </>
  );
}
