import { Link } from "@tanstack/react-router";
import { Instagram, Mail, Phone, MapPin, Twitter, HeartHandshake } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { serviceCategories } from "@/data/site";

function TikTok(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v2.6c-1.4.1-2.7-.3-3.9-1.1v5.9c0 3.4-2.6 5.7-5.7 5.7A5.6 5.6 0 0 1 4.8 14c0-3.2 2.8-5.8 6.3-5.4v2.7c-.4-.1-.8-.2-1.2-.2-1.6 0-2.9 1.3-2.9 2.9 0 1.6 1.3 2.9 2.9 2.9 1.6 0 2.9-1.2 2.9-3V3h3.7z" />
    </svg>
  );
}

const socials = [
  { label: "Instagram @openloopsa", href: "https://instagram.com/openloopsa", Icon: Instagram },
  { label: "X @openloopsa", href: "https://x.com/openloopsa", Icon: Twitter },
  { label: "TikTok @open.loop2023", href: "https://www.tiktok.com/@open.loop2023", Icon: TikTok },
];

export function JoinBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="surface-ink grid gap-6 rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            <HeartHandshake className="h-4 w-4" aria-hidden />
            شبكة المستقلين
          </span>
          <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">
            انضم إلى فرص أوبن لوب.. واصنع أثرًا مستدامًا
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-80 sm:text-base">
            سواء كنت باحثًا عن فرصة عمل في الجمعيات الأهلية أو مستقلًا ترغب في تقديم خدماتك
            للقطاع غير الربحي، نربطك بالجمعيات والجهات الخيرية، ونفتح لك المجال لتوظيف مهاراتك
            وخبراتك في التسويق، والتصميم، وكتابة المحتوى، والاستشارات، وغيرها من المجالات التي
            تُسهم في صناعة الأثر المجتمعي.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full bg-gold px-8 text-base font-bold text-gold-foreground hover:bg-gold/90">
          <Link to="/careers">انضم كمستقل</Link>
        </Button>
      </div>
    </section>
  );
}


export function Footer() {
  return (
    <footer className="border-t border-primary-foreground/10 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/75">
            مؤسسة تسويق واستشارات متكاملة، تمكّن الجمعيات والقطاع غير الربحي من الاستدامة المالية
            والحوكمة المؤسسية.
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-primary-foreground/20 text-primary-foreground/80 transition-colors hover:bg-gold hover:text-gold-foreground"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold">الخدمات</h3>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/75">
            {serviceCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/services/$category"
                  params={{ category: c.slug }}
                  className="transition-colors hover:text-gold"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-extrabold">روابط سريعة</h3>
          <ul className="mt-4 space-y-2 text-sm text-primary-foreground/75">
            <li>
              <Link to="/about" className="transition-colors hover:text-gold">
                عن أوبن لوب
              </Link>
            </li>
            <li>
              <Link to="/packages" className="transition-colors hover:text-gold">
                الباقات
              </Link>
            </li>
            <li>
              <Link to="/portfolio" className="transition-colors hover:text-gold">
                سابقة الأعمال
              </Link>
            </li>

            <li>
              <Link to="/careers" className="transition-colors hover:text-gold">
                انضم إلينا
              </Link>
            </li>
            <li>
              <Link to="/booking" className="transition-colors hover:text-gold">
                احجز استشارتك
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-extrabold">تواصل معنا</h3>
          <ul className="mt-4 space-y-3 text-sm text-primary-foreground/75">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gold" />
              <a href="mailto:openloop2030@gmail.com" className="hover:text-gold">
                openloop2030@gmail.com
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gold" />
              <a href="https://wa.me/966556006142" target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-gold">
                0556006142
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-gold" />
              الطائف، المملكة العربية السعودية
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-primary-foreground/60 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} أوبن لوب | Open Loop — جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
