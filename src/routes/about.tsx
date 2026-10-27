import { createFileRoute } from "@tanstack/react-router";
import { Eye, Compass, Target, TrendingUp, Megaphone } from "lucide-react";
import { SectionHeading } from "@/components/Sections";
import { JoinBanner } from "@/components/Footer";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "عن أوبن لوب | Open Loop" },
      {
        name: "description",
        content:
          "قصة أوبن لوب ورؤيتها ورسالتها والأثر المستهدف حتى 2029 في تمكين الجمعيات والمؤسسات الأهلية.",
      },
      { property: "og:title", content: "عن أوبن لوب | Open Loop" },
      {
        property: "og:description",
        content: "من ذراع استثماري وتنموي إلى شريك استراتيجي للقطاع غير الربحي في المملكة.",
      },
    ],
  }),
  component: About,
});

const impact = [
  {
    icon: Target,
    value: "+250",
    title: "جمعية ومؤسسة أهلية",
    text: "تمكين أكثر من 250 جمعية ومؤسسة أهلية من الوصول إلى الاستدامة المالية ورفع مؤشرات الحوكمة الشاملة.",
  },
  {
    icon: TrendingUp,
    value: "20 مليون ريال دعم محصل",
    title: "تنمية واسترداد",
    text: "تحصيل دعم أكثر من عشرين مليون ريال لصالح القطاع غير الربحي",
  },
  {
    icon: Megaphone,
    value: "+200",
    title: "حملة تسويقية",
    text: "إدارة وتنفيذ أكثر من 200 حملة تسويقية تستهدف تعميق الأثر المجتمعي وصناعة التفاعل الرقمي",
  },
];


function About() {
  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            عن المؤسسة
          </span>
          <h1 className="mt-5 text-3xl font-extrabold sm:text-5xl">عن أوبن لوب | Open Loop</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            شريك استراتيجي للقطاع غير الربحي في المملكة، يحوّل المبادرات إلى مشاريع مؤهلة للمنح
            وحضور رقمي مستدام.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading align="start" title="كيف بدأت أوبن لوب" />
          <p className="mt-6 max-w-4xl text-base leading-[2] text-muted-foreground">
            بدأت مؤسسة أوبن لوب.. كـ «ذراع استثماري وتنموي» لـ جمعية أرزاق لحفظ النعمة مع نخبة من
            خبراء التسويق الرقمي والاستشاريين وصنّاع الأثر. جاءت «أوبن لوب» لسد الفجوة بين الأهداف
            المجتمعية النبيلة والنمو المؤسسي المستدام؛ عبر تحويل المبادرات إلى مشاريع مؤهلة للمنح،
            وبناء حضور رقمي قوي يُحقق الاستدامة المالية للقطاع غير الربحي.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="card-elevated p-8">
            <Eye className="h-8 w-8 text-primary dark:text-gold" aria-hidden />
            <h2 className="mt-5 text-2xl font-extrabold">رؤيتنا</h2>
            <p className="mt-3 text-base leading-[2] text-muted-foreground">
              أن نكون الشريك الاستراتيجي الأول للقطاع غير الربحي في المملكة للوصول إلى كيانات
              مستدامة مالياً ومتميزة مؤسسياً.
            </p>
          </div>
          <div className="card-elevated p-8">
            <Compass className="h-8 w-8 text-primary dark:text-gold" aria-hidden />
            <h2 className="mt-5 text-2xl font-extrabold">رسالتنا</h2>
            <p className="mt-3 text-base leading-[2] text-muted-foreground">
              تمكين الجمعيات والمؤسسات الأهلية من خلال صياغة مشاريع احترافية، ورفع كفاءة الحوكمة،
              وإدارة الحملات التسويقية ذات الأثر الملموس، لتحويل الفرص والدعم إلى استدامة نمو
              حقيقية.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="أثرنا المستهدف حتى 2030"
            description="أرقام نعمل عليها مع شركائنا في القطاع الثالث لتحويل الفرص إلى استدامة حقيقية."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {impact.map((i) => (
              <div key={i.title} className="surface-ink rounded-[2rem] p-8">
                <i.icon className="h-8 w-8 opacity-90" aria-hidden />
                <p className="mt-5 text-3xl font-extrabold">{i.value}</p>
                <p className="mt-1 text-sm font-bold opacity-90">{i.title}</p>
                <p className="mt-4 text-sm leading-relaxed opacity-75">{i.text}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      <JoinBanner />
    </>
  );
}
