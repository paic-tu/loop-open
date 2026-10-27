import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, LogIn, Menu, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { serviceCategories } from "@/data/site";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const beforeServices = [
  { to: "/", label: "الرئيسية" },
  { to: "/about", label: "عن أوبن لوب" },
] as const;

const afterServices = [
  { to: "/packages", label: "الباقات" },
  { to: "/portfolio", label: "سابقة الأعمال" },
  { to: "/library", label: "مكتبة أوبن لوب" },
  { to: "/community", label: "فُرص Open Loop" },

  
  { to: "/careers", label: "انضم إلى" },
  { to: "/booking", label: "احجز استشارتك" },
] as const;

const linkClass =
  "rounded-full px-3 py-2 text-sm font-semibold text-primary-foreground/80 transition-colors hover:bg-primary-foreground/12 hover:text-primary-foreground";

export function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  const displayName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    "";

  return (
    <header className="sticky top-0 z-50 border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="order-2 min-w-0">
          <Logo light />
        </div>

        <nav className="order-1 hidden items-center gap-1 lg:flex">
          {beforeServices.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={linkClass}
              activeProps={{ className: "bg-primary-foreground/15 text-primary-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <Link to="/services" className={`${linkClass} inline-flex items-center gap-1`}>
              الخدمات
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Link>
            {servicesOpen && (
              <div className="absolute end-0 top-full w-80 pt-2">
                <div className="max-h-[70vh] overflow-y-auto rounded-3xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
                  {serviceCategories.map((c) => (
                    <Link
                      key={c.slug}
                      to="/services/$category"
                      params={{ category: c.slug }}
                      className="block rounded-2xl px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      <span className="block text-sm font-bold">
                        {c.order}: {c.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {c.items.length} خدمة متاحة
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {afterServices.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={linkClass}
              activeProps={{ className: "bg-primary-foreground/15 text-primary-foreground" }}
            >
              {l.label}
            </Link>
          ))}

          <ThemeToggle className="ms-2" />

          <Button
            asChild
            size="sm"
            className="ms-2 rounded-full bg-gold px-5 font-bold text-gold-foreground hover:bg-gold/90"
          >
            <Link {...(user ? { to: "/dashboard" as const } : { to: "/auth" as const, search: { redirect: undefined } })}>
              {user ? (
                <>
                  <UserRound className="h-4 w-4" aria-hidden />
                  أهلاً، {displayName}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden />
                  تسجيل الدخول
                </>
              )}
            </Link>
          </Button>
        </nav>

        <div className="order-1 flex items-center gap-2 lg:hidden">
          <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="القائمة"
          className="order-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary-foreground/25 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-primary-foreground/15 bg-primary lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {beforeServices.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link to="/services" className={linkClass} onClick={() => setOpen(false)}>
              الخدمات
            </Link>
            <div className="mb-1 flex flex-col ps-4">
              {serviceCategories.map((c) => (
                <Link
                  key={c.slug}
                  to="/services/$category"
                  params={{ category: c.slug }}
                  className="rounded-full px-3 py-1.5 text-sm text-primary-foreground/70"
                  onClick={() => setOpen(false)}
                >
                  — {c.title}
                </Link>
              ))}
            </div>
            {afterServices.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Button
              asChild
              className="mt-2 rounded-full bg-gold font-bold text-gold-foreground hover:bg-gold/90"
            >
              <Link
                {...(user ? { to: "/dashboard" as const } : { to: "/auth" as const, search: { redirect: undefined } })}
                onClick={() => setOpen(false)}
              >
                {user ? (
                  <>
                    <UserRound className="h-4 w-4" aria-hidden />
                    أهلاً، {displayName}
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden />
                    تسجيل الدخول
                  </>
                )}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
