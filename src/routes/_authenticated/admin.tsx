import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Menu, Home, ChevronsLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/lib/auth";
import { hasAtLeast, type AppRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {},
  component: AdminLayout,
});

const BREADCRUMB_OVERRIDES: Record<string, { parent?: string; label: string }> = {
  "/admin": { label: "نظرة عامة" },
  "/admin/requests": { parent: "الأساسية", label: "الطلبات" },
  "/admin/bookings": { parent: "الأساسية", label: "حجوزات الاستشارات" },
  "/admin/users": { parent: "الأساسية", label: "المستخدمون" },
  "/admin/approvals": { parent: "سوق الفرص", label: "الاعتمادات" },
  "/admin/commissions": { parent: "سوق الفرص", label: "العمولات" },
  "/admin/reports": { parent: "سوق الفرص", label: "التقارير" },
  "/admin/projects": { parent: "سوق الفرص", label: "مشاريع المستقلين" },
  "/admin/platform": { parent: "سوق الفرص", label: "إعدادات المنصة" },
  "/admin/library": { parent: "إدارة المحتوى", label: "مكتبة الملفات" },
  "/admin/cms/services": { parent: "إدارة المحتوى", label: "الخدمات" },
  "/admin/cms/packages": { parent: "إدارة المحتوى", label: "الباقات" },
  "/admin/cms/site": { parent: "إدارة المحتوى", label: "إعداد الموقع" },
};

function AdminLayout() {
  const { user, roles, profile, isAdmin, rolesLoading } = useAuth();
  const state = useRouterState();
  const pathname = state.location.pathname;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const nav = useNavigate();
  const userRedirectRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!hasAtLeast(roles as AppRole[], "staff")) return;
      const q = await Promise.all([
        supabase.from("requests").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("community_entities").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const sum = q.reduce((s, r) => s + Number(r.count ?? 0), 0);
      setPendingCount(sum);
    })();
  }, [roles, pathname]);

  if (rolesLoading) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-12 w-12 animate-spin place-items-center rounded-2xl border-2 border-border border-t-primary text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <div className="text-[13px] font-black text-muted-foreground">
            جارٍ تحميل صلاحيات لوحة الإدارة...
          </div>
        </div>
      </section>
    );
  }

  if (!hasAtLeast(roles as AppRole[], "staff")) {
    if (!userRedirectRef.current) {
      userRedirectRef.current = true;
      queueMicrotask(() => nav({ to: "/dashboard", replace: true }));
    }
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-10 w-10 animate-spin place-items-center rounded-2xl border-2 border-border border-t-primary text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <div className="text-[12px] font-black text-muted-foreground">جارٍ توجيهك إلى لوحة حسابك...</div>
        </div>
      </section>
    );
  }

  const crumb = BREADCRUMB_OVERRIDES[pathname] ?? { label: "لوحة التحكم" };
  const displayRole = isAdmin ? "مدير عام" : roles.includes("staff") ? "موظف" : "مستخدم";
  const today = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div dir="rtl" className="min-h-screen w-full bg-background">
      <div className="mx-auto flex max-w-[1500px] flex-row-reverse gap-6 px-4 py-4 sm:px-6 lg:px-8">
        {/* ============ SIDEBAR - RIGHT (RTL) ============ */}
        <aside className="sticky top-4 z-30 hidden shrink-0 lg:block">
          <AdminSidebar />
        </aside>

        {/* ============ Sheet Mobile Sidebar + Trigger داخل المغلف ============ */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl lg:hidden" aria-label="القائمة">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px] max-w-[92vw] border-border/60 p-0 pr-0">
            <AdminSidebar onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* ============ MAIN CONTENT (LEFT side in RTL) ============ */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Slim Toolbar (NOT a top-bar) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Link to="/" className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold hover:bg-muted hover:text-foreground">
                  <Home className="h-3.5 w-3.5" />
                  الموقع
                </Link>
                <ChevronsLeft className="h-3.5 w-3.5 opacity-50" />
                <Link to="/admin" className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold hover:bg-muted hover:text-foreground">
                  لوحة الإدارة
                </Link>
                {crumb.parent ? (
                  <>
                    <ChevronsLeft className="h-3.5 w-3.5 opacity-50" />
                    <span className="rounded-lg px-2 py-1 font-bold text-foreground/60">
                      {crumb.parent}
                    </span>
                  </>
                ) : null}
                <ChevronsLeft className="h-3.5 w-3.5 opacity-50" />
                <span className="rounded-lg bg-primary/10 px-2 py-1 font-black text-primary">
                  {crumb.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-[11px] font-bold text-muted-foreground">{today}</span>
              </div>
              {pendingCount > 0 ? (
                <Link to="/admin/approvals">
                  <Badge
                    variant="secondary"
                    className="h-8 gap-1.5 rounded-full border border-[#E09F48]/30 bg-[#E09F48]/10 px-3 text-[11px] font-black text-[#b98232] hover:bg-[#E09F48]/15 dark:text-[#E09F48]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {pendingCount} عنصر جديد يحتاج مراجعة
                  </Badge>
                </Link>
              ) : null}
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 rounded-xl border-border/60",
                  profile?.full_name ? "" : "font-black"
                )}
              >
                <Link to="/dashboard">
                  <span className="flex items-center gap-2">
                    <span className="hidden truncate sm:inline">
                      {profile?.full_name ? profile.full_name : user?.email}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 rounded-full border px-2 py-0 text-[10px] font-black",
                        isAdmin
                          ? "bg-[#C34A36]/15 text-[#C34A36] border-[#C34A36]/30"
                          : roles.includes("staff")
                            ? "bg-[#2F5257]/15 text-[#2F5257] border-[#2F5257]/30"
                            : "bg-primary/15 text-primary border-primary/30"
                      )}
                    >
                      {displayRole}
                    </Badge>
                  </span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Page Content — NOT wrapped in a giant card! Pages use their own cards. */}
          <div className="min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
