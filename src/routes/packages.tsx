import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SectionHeading } from "@/components/Sections";
import { PackagesCarousel } from "@/components/PackagesCarousel";
import { JoinBanner } from "@/components/Footer";
import { getPackages, type CmsPackage } from "@/lib/cms";
import { packages as fallbackPackages, type Pkg } from "@/data/site";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/packages")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "الباقات | أوبن لوب" },
      {
        name: "description",
        content:
          "باقات أوبن لوب: إدارة السوشال ميديا، الحملات الممولة، الاسترداد الضريبي، تنمية الموارد المالية، والامتثال والحوكمة.",
      },
      { property: "og:title", content: "باقات أوبن لوب للقطاع غير الربحي" },
      {
        property: "og:description",
        content: "قارن بين باقات التسويق والاستشارات المتكاملة.",
      },
    ],
  }),
  component: Packages,
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

function Packages() {
  const q = useQuery({
    queryKey: ["cms-packages"],
    queryFn: () => getPackages(),
    staleTime: 60_000,
  });

  const items: Pkg[] = (q.data ?? []).map(toPkg);
  const fallbackUsed = items.length === 0 && !q.isLoading;

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-5xl">مصفوفة الباقات</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            باقات متكاملة تغطي التسويق الرقمي، تنمية الموارد، الاسترداد الضريبي، والحوكمة
            المؤسسية.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="مقارنة"
            title="اختر الباقة المناسبة لمرحلة نمو كيانك"
            description="كل باقة تشمل جلسات استشارية ومتابعة تنفيذية من فريق أوبن لوب."
          />
          {q.isLoading ? (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[380px] w-full rounded-3xl" />
              ))}
            </div>
          ) : (
            <PackagesCarousel items={fallbackUsed ? fallbackPackages : items} />
          )}
        </div>
      </section>

      <JoinBanner />
    </>
  );
}
