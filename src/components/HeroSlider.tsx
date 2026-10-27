import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero.jpg";
import heroMarketing from "@/assets/hero-marketing.jpg";
import heroRelief from "@/assets/hero-relief.jpg";

type Slide = {
  image: string;
  alt: string;
  text: string;
  actions: React.ReactNode;
};

const slides: Slide[] = [
  {
    image: heroImage,
    alt: "فريق أوبن لوب أثناء جلسة عمل استشارية",
    text: "أوبن لوب: مؤسسة تسويق واستشارات تمكّن القطاع غير الربحي من الاستدامة وبناء الأثر، وفق رؤية 2030.",
    actions: (
      <>
        <Button asChild size="lg" className="rounded-full px-7 text-base font-bold">
          <a href="/open-loop-profile.pdf" target="_blank" rel="noopener noreferrer">
            <Download className="h-5 w-5" aria-hidden />
            حمل الملف التعريفي
          </a>
        </Button>
        <Button asChild size="lg" variant="secondary" className="rounded-full px-7 text-base font-bold">
          <Link to="/booking">احجز استشارتك</Link>
        </Button>
      </>
    ),
  },
  {
    image: heroMarketing,
    alt: "جلسة تخطيط استراتيجي وتسويق رقمي",
    text: "حلول تسويقية واستشارية متكاملة لرفع إيرادات وحوكمة الجمعيات والكيانات الأهلية.",
    actions: (
      <Button asChild size="lg" className="rounded-full px-7 text-base font-bold">
        <Link to="/services">
          استكشف خدماتنا
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </Button>
    ),
  },
  {
    image: heroRelief,
    alt: "توزيع ميداني لمشاريع الإعاشة والسلال الغذائية",
    text: "مشاريع الإعاشة والحلول الميدانية (إفطار صائم، سقيا ماء، وسلال غذائية) بأعلى معايير السلامة.",
    actions: (
      <Button asChild size="lg" className="rounded-full px-7 text-base font-bold">
        <Link to="/services/$category" params={{ category: "catering" }}>
          اطلب الخدمة الآن
        </Link>
      </Button>
    ),
  },
];

export function HeroSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative isolate overflow-hidden">
      {slides.map((s, i) => (
        <img
          key={s.image}
          src={s.image}
          alt={s.alt}
          width={1920}
          height={1088}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-1000 ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== active}
        />
      ))}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-l from-ink/95 via-ink/85 to-ink/60"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 py-24 text-ink-foreground sm:px-6 lg:px-8 lg:py-36">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold backdrop-blur">
          <Sparkles className="h-4 w-4" aria-hidden />
          شريك القطاع غير الربحي نحو رؤية السعودية 2030
        </span>

        <div key={active} className="animate-fade-in">
          <h1 className="mt-6 max-w-3xl text-right text-[clamp(1.35rem,4vw,2.75rem)] font-extrabold leading-[1.35] lg:leading-[1.3]">
            {slides[active]?.text}
          </h1>
          <div className="mt-9 flex flex-wrap gap-3">{slides[active]?.actions}</div>
        </div>

        <div className="mt-12 flex items-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.image}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`الشريحة ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-10 bg-gold" : "w-4 bg-primary-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
