import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/Sections";
import { FreelancerJoinDialog } from "@/components/FreelancerJoinDialog";
import { ProjectsBoard } from "@/components/ProjectsBoard";

export const Route = createFileRoute("/careers")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "انضم إلينا | التقديمات المتاحة — أوبن لوب" },
      {
        name: "description",
        content:
          "لوحة المشاريع المفتوحة: تقدّم على مشاريع القطاع غير الربحي أو تصفّح المستقلين الموثقين في التسويق والمحتوى والتصميم والحوكمة.",
      },
      { property: "og:title", content: "الانضمام إلينا | أوبن لوب" },
      {
        property: "og:description",
        content: "مشاريع وفرص مفتوحة للتقديم في القطاع غير الربحي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Careers,
});

function Careers() {
  return (
    <>
      <section className="surface-ink relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_20%,rgb(195_74_54/25%),transparent_70%),radial-gradient(50%_50%_at_85%_80%,rgb(224_159_72/18%),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="inline-flex items-center rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            فرص للعمل الحر والشراكة مع أوبن لوب
          </span>
          <h1 className="mt-6 text-3xl font-extrabold sm:text-5xl">انضم إلينا</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            شبكة أوبن لوب للمستقلين تجمع الكفاءات المهنية التي تعمل بنموذج العمل الحر مع مشاريع
            القطاع غير الربحي. سجّل في الشبكة، ثم تقدّم على المشاريع المفتوحة مباشرة من حسابك.
          </p>
          <div className="mt-8">
            <FreelancerJoinDialog
              trigger={
                <Button
                  size="lg"
                  className="rounded-full bg-gold px-7 font-bold text-gold-foreground hover:bg-gold/90"
                >
                  انضم كمستقل إلى شبكتنا
                </Button>
              }
            />
          </div>
        </div>
      </section>

      <section id="projects" className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-border/60 bg-card/70 p-6 shadow-[inset_0_1px_1px_rgb(255_255_255/10%)] backdrop-blur-xl sm:p-10">
          <SectionHeading
            title="التقديمات المتاحة"
            description="ندعو الكفاءات والمستشارين والمستقلين للتسجيل في شبكة أوبن لوب وإكمال ملفاتهم المهنية، والتقديم على المشاريع المفتوحة فور إتاحتها."
          />
          <ProjectsBoard />
          </div>
        </div>
      </section>

    </>
  );
}
