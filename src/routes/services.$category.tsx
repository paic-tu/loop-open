import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, FilePlus2, FileX2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinBanner } from "@/components/Footer";
import { ServiceRequestForm } from "@/components/ServiceRequestForm";
import { ServiceRequestDialog } from "@/components/ServiceRequestDialog";
import { serviceCategories as fallbackServices } from "@/data/site";
import { getServiceCategories, type CmsServiceCat } from "@/lib/cms";

export const Route = createFileRoute("/services/$category")({
  staticData: { sitemap: true },
  loader: ({ params }) => ({ slug: params.category }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `خدمات ${loaderData.slug} | أوبن لوب` },
          {
            name: "description",
            content: "خدمات أوبن لوب المتكاملة للقطاع غير الربحي.",
          },
        ]
      : [{ title: "الخدمة غير متاحة | أوبن لوب" }],
  }),
  component: CategoryPage,
});

type LocalCat = {
  slug: string;
  order: string;
  title: string;
  description: string;
  items: string[];
  details?: { title: string; description: string }[];
};

function toLocalCat(c: CmsServiceCat): LocalCat {
  return {
    slug: c.slug,
    order: String(c.display_order || c.sort_order + 1 || "1"),
    title: c.title,
    description: c.description ?? "",
    items: c.items ?? [],
    details: c.details ?? [],
  };
}

function CategoryPage() {
  const { slug } = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["cms-services"],
    queryFn: () => getServiceCategories(),
    staleTime: 60_000,
  });

  let category: LocalCat | undefined;
  if (q.data && q.data.length) {
    category = q.data.map(toLocalCat).find((c) => c.slug === slug);
  }
  if (!category) {
    category = fallbackServices.find((c) => c.slug === slug);
  }

  if (q.isLoading && !category) {
    return (
      <>
        <section className="surface-ink">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="mt-5 h-12 w-3/4 rounded-2xl" />
            <Skeleton className="mt-4 h-6 w-2/3 rounded-xl" />
          </div>
        </section>
        <section className="section-pad">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[260px] w-full rounded-3xl" />
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  if (!category) {
    return (
      <section className="section-pad">
        <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="card-elevated p-8">
            <h1 className="text-xl font-extrabold">الخدمة غير متاحة حالياً</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              قد تكون الخدمة قيد التحديث أو تمت إزالتها. يمكنك تصفّح باقي الخدمات.
            </p>
            <Button asChild size="lg" className="mt-6 rounded-full font-bold">
              <Link to="/services">كل الخدمات</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const cat = category;

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            {cat.order}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold sm:text-5xl">{cat.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            {cat.description}
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {cat.details && cat.details.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {cat.details.map((d, i) => {
                const Icon = [ReceiptText, FilePlus2, FileX2][i % 3] ?? ReceiptText;
                return (
                  <article
                    key={d.title}
                    className="card-elevated flex h-full flex-col p-7"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h2 className="mt-4 text-lg font-extrabold leading-snug">{d.title}</h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {d.description}
                    </p>
                    <ServiceRequestDialog
                      serviceName={d.title}
                      categoryTitle={cat.title}
                      idPrefix={`${cat.slug}-${i}`}
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((item: string) => (
                <div
                  key={item}
                  className="card-elevated flex items-start gap-3 p-6"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="min-w-0 text-sm font-bold leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12">
            <ServiceRequestForm
              categoryTitle={cat.title}
              items={cat.items}
              idPrefix={cat.slug}
            />
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 font-bold">
              <Link to="/booking">احجز استشارتك</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full px-7 font-bold"
            >
              <Link to="/services">كل الخدمات</Link>
            </Button>
          </div>
        </div>
      </section>

      <JoinBanner />
    </>
  );
}
