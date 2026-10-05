import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (redirected.current) return;
    redirected.current = true;
    const target = loc.href && loc.href !== "/" ? loc.href : undefined;
    void nav({ to: "/auth", search: target ? { redirect: target } : {}, replace: true });
  }, [user, loading, nav, loc.href]);

  if (loading || !user) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-12 w-12 animate-spin place-items-center rounded-2xl border-2 border-border border-t-primary text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <div className="text-[13px] font-black text-muted-foreground">
            جارٍ التحقق من الحساب وتحميل لوحة التحكم...
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
