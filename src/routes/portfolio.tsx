import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionHeading } from "@/components/Sections";
import { JoinBanner } from "@/components/Footer";
import { portfolioCategories, portfolioItems, type PortfolioItem } from "@/data/portfolio";


export const Route = createFileRoute("/portfolio")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "سابقة الأعمال | بوستات وفيديوهات AI وتقارير سنوية" },
      {
        name: "description",
        content:
          "معرض أعمال أوبن لوب: تصميم البوستات، وفيديوهات الذكاء الاصطناعي، وتصميم التقارير السنوية للجمعيات مع معاينة تفاعلية.",
      },
      { property: "og:title", content: "سابقة الأعمال | بوستات وفيديوهات AI وتقارير سنوية" },
      {
        property: "og:description",
        content: "تصفّح تصاميم البوستات وفيديوهات الذكاء الاصطناعي والتقارير السنوية عبر معرض تفاعلي.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portfolio,
});


const filters = [{ slug: "all", label: "الكل" }, ...portfolioCategories];

function Portfolio() {
  const [active, setActive] = useState<PortfolioItem | null>(null);
  const [filter, setFilter] = useState("all");

  const items = useMemo(
    () => (filter === "all" ? portfolioItems : portfolioItems.filter((i) => i.category === filter)),
    [filter],
  );

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            <Briefcase className="h-4 w-4" aria-hidden />
            سابقة الأعمال
          </span>
          <h1 className="mt-5 text-3xl font-extrabold sm:text-5xl">معرض أعمالنا</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            نماذج مختارة من تصميم البوستات، وفيديوهات الذكاء الاصطناعي، والتقارير السنوية — اضغط
            على أي عمل لمعاينته أو تشغيله داخل الصفحة.

          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="تصفّح حسب التصنيف"
            description="اختر التصنيف لعرض الأعمال المرتبطة به."
          />

          <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="تصنيفات الأعمال">
            {filters.map((f) => {
              const isActive = filter === f.slug;
              return (
                <button
                  key={f.slug}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(f.slug)}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setActive(w)}
                className="card-elevated group flex flex-col overflow-hidden p-0 text-start transition-transform hover:-translate-y-1"
              >
                <span className="relative block aspect-[3/2] overflow-hidden bg-secondary">
                  <img
                    src={w.cover}
                    alt={w.title}
                    loading="lazy"
                    width={1280}
                    height={854}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {w.media.kind === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-lg">
                        <Play className="h-6 w-6" aria-hidden />
                      </span>
                    </span>
                  )}
                </span>
                <span className="block p-4 text-center text-base font-extrabold leading-snug">
                  {w.title}
                </span>
              </button>
            ))}
          </div>

        </div>
      </section>

      <Dialog open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader className="text-start">
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription className="sr-only">معاينة العمل</DialogDescription>
          </DialogHeader>
          {active && (
            <div className="overflow-hidden rounded-2xl bg-secondary">
              {active.media.kind === "image" && (
                <img
                  src={active.media.src}
                  alt={active.title}
                  width={1280}
                  height={854}
                  className="h-auto w-full object-contain"
                />
              )}
              {active.media.kind === "video" && (
                <video
                  src={active.media.src}
                  poster={active.media.poster}
                  controls
                  autoPlay
                  className="h-auto w-full"
                />
              )}
              {active.media.kind === "pdf" && (
                <iframe src={active.media.src} title={active.title} className="h-[75vh] w-full" />
              )}
            </div>
          )}

        </DialogContent>
      </Dialog>

      <JoinBanner />
    </>
  );
}
