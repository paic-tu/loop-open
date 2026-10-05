import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Palette,
  PenTool,
  Megaphone,
  Calculator,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { serviceCategories as fallbackServices } from "@/data/site";
import { SectionHeading } from "@/components/Sections";
import type { CmsServiceCat } from "@/lib/cms";

type LocalCat = {
  slug: string;
  order: string;
  title: string;
  description: string;
  iconName?: string;
  items: string[];
  details?: { title: string; description: string }[];
};

const iconMap: Record<string, LucideIcon> = {
  resources: BarChart3,
  design: Palette,
  content: PenTool,
  marketing: Megaphone,
  tax: Calculator,
  BarChart3,
  Palette,
  PenTool,
  Megaphone,
  Calculator,
};

function usePerPage() {
  const [perPage, setPerPage] = useState(3);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setPerPage(mq.matches ? 3 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return perPage;
}

type Props = {
  categories?: CmsServiceCat[];
};

export function ServicesShowcase({ categories }: Props) {
  const perPage = usePerPage();
  const [page, setPage] = useState(0);

  const items: LocalCat[] = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map((c) => ({
        slug: c.slug,
        order: String(c.display_order || c.sort_order + 1 || "1"),
        title: c.title,
        description: c.description ?? "",
        iconName: c.icon_name ?? undefined,
        items: c.items ?? [],
        details: c.details ?? [],
      }));
    }
    return fallbackServices;
  }, [categories]);

  const pages = useMemo(() => {
    const out: LocalCat[][] = [];
    for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage));
    return out;
  }, [items, perPage]);

  const total = pages.length;
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(total - 1, 0)));
  }, [total]);

  const go = (dir: number) => setPage((p) => Math.min(Math.max(p + dir, 0), total - 1));

  return (
    <section className="section-pad bg-surface overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="منظومة الخدمات"
          title="خدماتنا المتميزة"
          description="خمس منظومات خدمية متكاملة مصممة خصيصاً للجمعيات والمؤسسات الأهلية، من التأهيل للمنح إلى بناء الهوية والمحتوى والحملات."
        />

        <div className="mt-12">
          <div className="overflow-hidden">
            <div
              className="flex"
              style={{
                transform: `translateX(${page * 100}%)`,
                transition: "transform 0.4s ease-in-out",
              }}
            >
              {pages.map((group, gi) => (
                <div
                  key={gi}
                  className="w-full shrink-0 grid gap-6 md:grid-cols-3"
                  style={{
                    opacity: gi === page ? 1 : 0.4,
                    transition: "opacity 0.4s ease-in-out",
                  }}
                >
                  {group.map((c) => {
                    const Icon =
                      (c.iconName ? iconMap[c.iconName] : undefined) ??
                      BarChart3;
                    return (
                      <Link
                        key={c.slug}
                        to="/services/$category"
                        params={{ category: c.slug }}
                        className="group relative flex min-h-[280px] max-w-[360px] flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground dark:bg-gold/10 dark:text-gold dark:group-hover:bg-gold dark:group-hover:text-gold-foreground">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-sm font-extrabold text-gold">
                            {c.order}
                          </span>
                        </div>

                        <div className="flex-1 py-4">
                          <h3 className="text-lg font-extrabold leading-snug">{c.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            {c.description}
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-primary dark:text-gold">
                          عرض الخدمات
                          <ArrowLeft
                            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
                            aria-hidden
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {total > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="السابق"
                onClick={() => go(-1)}
                disabled={page === 0}
                className="rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
              <div className="flex items-center gap-2">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`الصفحة ${i + 1}`}
                    onClick={() => setPage(i)}
                    className={`h-2.5 rounded-full transition-all ${
                      i === page
                        ? "w-7 bg-primary dark:bg-gold"
                        : "w-2.5 bg-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="التالي"
                onClick={() => go(1)}
                disabled={page === total - 1}
                className="rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
