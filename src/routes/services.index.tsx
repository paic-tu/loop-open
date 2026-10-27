import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { SectionHeading } from "@/components/Sections";
import { JoinBanner } from "@/components/Footer";
import { ServiceRequestForm } from "@/components/ServiceRequestForm";
import { serviceCategories } from "@/data/site";


export const Route = createFileRoute("/services/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "الخدمات | أوبن لوب" },
      {
        name: "description",
        content:
          "خدمات أوبن لوب: تنمية الموارد، التصميم، المحتوى، والتسويق — حلول متكاملة للكيانات غير الربحية.",
      },
      { property: "og:title", content: "خدمات أوبن لوب" },
      {
        property: "og:description",
        content: "منظومات خدمية تغطي التمويل والهوية والمحتوى والتسويق والضريبة ومشاريع الإعاشة.",
      },
    ],
  }),
  component: ServicesIndex,
});

function ServicesIndex() {
  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-5xl">خدماتنا</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            منظومة خدمات متكاملة مصممة خصيصاً للجمعيات والمؤسسات الأهلية، من التأهيل للمنح إلى بناء
            الهوية والمحتوى والحملات.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="منظوماتنا الخدمية" />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {serviceCategories.map((c) => (
              <article key={c.slug} className="card-elevated flex h-full flex-col p-8">
                <span className="text-xs font-extrabold text-primary dark:text-gold">{c.order}</span>
                <h2 className="mt-1 text-2xl font-extrabold">{c.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {c.items.slice(0, 6).map((i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-gold" aria-hidden />
                      <span className="min-w-0">{i}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/services/$category"
                  params={{ category: c.slug }}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-primary dark:text-gold"
                >
                  عرض جميع الخدمات ({c.items.length})
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-16 space-y-8">
            {serviceCategories.map((c) => (
              <ServiceRequestForm
                key={c.slug}
                categoryTitle={c.title}
                items={c.items}
                idPrefix={`idx-${c.slug}`}
              />
            ))}
          </div>
        </div>
      </section>


      <JoinBanner />
    </>
  );
}
