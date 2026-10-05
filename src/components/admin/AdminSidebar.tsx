import {
  LayoutDashboard,
  ShoppingCart,
  CalendarDays,
  Users,
  FolderOpenDot,
  BadgeCheck,
  Banknote,
  BarChart3,
  Settings,
  BriefcaseBusiness,
  Database,
  CreditCard,
  Folder,
  LogOut,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { hasAtLeast, type AppRole } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  minRole: "user" | "staff" | "admin";
  group: "الأساسية" | "سوق الفرص" | "إدارة المحتوى" | "النظام";
  countKey?:
    | "pending_approvals"
    | "requests_new"
    | "bookings_new"
    | "users_total"
    | "commissions_pending"
    | "projects_active";
};

const NAV: NavItem[] = [
  // الأساسية
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, minRole: "staff", group: "الأساسية" },
  { to: "/admin/requests", label: "الطلبات", icon: ShoppingCart, minRole: "staff", group: "الأساسية", countKey: "requests_new" },
  { to: "/admin/bookings", label: "حجوزات الاستشارات", icon: CalendarDays, minRole: "staff", group: "الأساسية", countKey: "bookings_new" },
  { to: "/admin/users", label: "المستخدمون", icon: Users, minRole: "admin", group: "الأساسية", countKey: "users_total" },

  // سوق الفرص
  { to: "/admin/approvals", label: "الاعتمادات", icon: BadgeCheck, minRole: "staff", group: "سوق الفرص", countKey: "pending_approvals" },
  { to: "/admin/commissions", label: "العمولات", icon: Banknote, minRole: "staff", group: "سوق الفرص", countKey: "commissions_pending" },
  { to: "/admin/reports", label: "التقارير", icon: BarChart3, minRole: "staff", group: "سوق الفرص" },
  { to: "/admin/projects", label: "مشاريع المستقلين", icon: BriefcaseBusiness, minRole: "staff", group: "سوق الفرص", countKey: "projects_active" },
  { to: "/admin/platform", label: "إعدادات المنصة", icon: Settings, minRole: "admin", group: "سوق الفرص" },

  // إدارة المحتوى
  { to: "/admin/library", label: "مكتبة الملفات", icon: FolderOpenDot, minRole: "staff", group: "إدارة المحتوى" },
  { to: "/admin/cms/services", label: "الخدمات", icon: Folder, minRole: "admin", group: "إدارة المحتوى" },
  { to: "/admin/cms/packages", label: "الباقات", icon: CreditCard, minRole: "admin", group: "إدارة المحتوى" },
  { to: "/admin/cms/site", label: "إعداد الموقع", icon: Database, minRole: "admin", group: "إدارة المحتوى" },
];

const GROUPS_ORDER: NavItem["group"][] = ["الأساسية", "سوق الفرص", "إدارة المحتوى"];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const state = useRouterState();
  const { user, roles, signOut, profile, isAdmin } = useAuth();
  const pathname = state.location.pathname;

  const [counts, setCounts] = useState<Record<string, number | string>>({
    requests_new: 0,
    bookings_new: 0,
    users_total: 0,
    pending_approvals: 0,
    commissions_pending: 0,
    projects_active: 0,
  });
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    (async () => {
      const q = await Promise.all([
        supabase.from("requests").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("community_entities").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("commissions").select("amount").in("status", ["pending", "overdue"]),
        supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["draft", "published"]),
        user?.id ? supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null) : Promise.resolve({ count: 0 }),
      ]);
      const commissions_sum = (q[6].data ?? []).reduce(
        (sum: number, r: { amount?: number }) => sum + Number(r.amount ?? 0),
        0
      );
      setCounts({
        requests_new: Number(q[0].count ?? 0),
        bookings_new: Number(q[1].count ?? 0),
        users_total: Number(q[2].count ?? 0),
        pending_approvals:
          Number(q[3].count ?? 0) + Number(q[4].count ?? 0) + Number(q[5].count ?? 0),
        commissions_pending: commissions_sum > 999 ? `${(commissions_sum / 1000).toFixed(1)}ألف` : commissions_sum,
        projects_active: Number(q[7].count ?? 0),
      });
      setUnreadNotif(Number(q[8].count ?? 0));
    })();
  }, [user?.id]);

  const filtered = NAV.filter((n) => hasAtLeast(roles as AppRole[], n.minRole));
  const grouped = GROUPS_ORDER.map((g) => [g, filtered.filter((n) => n.group === g)] as const).filter(
    ([, v]) => v.length > 0
  );

  const fallback =
    (profile?.full_name ?? user?.email ?? "U")
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const displayRole = isAdmin ? "مدير عام" : roles.includes("staff") ? "موظف" : "مستخدم";
  const roleTone = isAdmin
    ? "bg-[#C34A36]/15 text-[#C34A36] border-[#C34A36]/30"
    : roles.includes("staff")
      ? "bg-[#2F5257]/15 text-[#2F5257] border-[#2F5257]/30"
      : "bg-primary/15 text-primary border-primary/30";

  return (
    <div dir="rtl" className="flex h-[calc(100vh-2rem)] w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_40px_-12px_rgba(23,55,74,0.18)] dark:bg-[#0f1820]/80">
      {/* ====== الشعار + الاسم ====== */}
      <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#17374A] via-[#2F5257] to-[#E09F48] text-white shadow-sm">
          <span className="text-[13px] font-black tracking-tight">O.L</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-black leading-tight tracking-tight">أوبن لوب</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground">
            لوحة تحكم المنصة
          </div>
        </div>
        <Badge
          variant="outline"
          className="h-6 rounded-full border border-[#E09F48]/30 bg-[#E09F48]/10 px-2 text-[10px] font-extrabold text-[#b98232] dark:text-[#E09F48]"
        >
          PRO
        </Badge>
      </div>

      {/* ====== بحث + إشعارات ====== */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="بحث سريع..."
            className="h-9 w-full rounded-xl border border-border/60 bg-muted/40 pr-9 pl-3 text-[12px] font-bold placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {unreadNotif > 0 ? (
            <span className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-black text-white">
              {unreadNotif > 9 ? "9+" : unreadNotif}
            </span>
          ) : null}
        </Button>
      </div>

      {/* ====== القائمة ====== */}
      <div className="mt-4 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 scroll-smooth">
        {grouped.map(([groupName, items]) => (
          <div key={groupName} className="mb-4">
            <div className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {groupName}
            </div>
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.to ||
                  (item.to !== "/admin" && pathname.startsWith(item.to));
                const countVal = item.countKey ? counts[item.countKey] : null;
                const hasCount =
                  countVal !== null &&
                  countVal !== undefined &&
                  countVal !== 0 &&
                  countVal !== "0";
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to as never}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-xl px-3 pr-3 text-[13px] font-bold transition-all",
                        active
                          ? "bg-[#17374A] text-white shadow-[0_4px_14px_-4px_rgba(23,55,74,0.55)] dark:bg-[#17374A]"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {active ? (
                        <span className="absolute -right-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-md bg-[#E09F48]" aria-hidden />
                      ) : null}
                      <div
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                          active
                            ? "bg-white/10 text-[#E09F48]"
                            : "bg-muted/60 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <span className="flex-1 truncate">{item.label}</span>
                      {hasCount ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-5 rounded-full px-2 text-[10px] font-black",
                            active
                              ? "bg-white/15 text-white hover:bg-white/20"
                              : "bg-[#E09F48]/15 text-[#b98232] dark:text-[#E09F48]"
                          )}
                        >
                          {typeof countVal === "number" && countVal > 99 ? "99+" : countVal}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* ====== المستخدم + الخروج ====== */}
      <div className="border-t border-border/50 bg-muted/20 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar className="h-10 w-10 rounded-xl ring-2 ring-background">
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-[#2F5257] to-[#17374A] text-[12px] font-black text-white">
              {fallback}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-black leading-tight">
              {profile?.full_name || "فريق الإدارة"}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {user?.email || "—"}
            </div>
          </div>
          <Badge variant="outline" className={cn("rounded-full border px-2 py-0 text-[10px] font-black", roleTone)}>
            {displayRole}
          </Badge>
        </div>
        <Separator className="my-3 opacity-60" />
        <Button
          variant="ghost"
          className="group h-10 w-full justify-start gap-3 rounded-xl px-3 text-[13px] font-bold text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            await signOut();
            window.location.href = "/";
          }}
        >
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-destructive/15 group-hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </div>
          <span className="flex-1 text-right">تسجيل الخروج</span>
        </Button>
      </div>
    </div>
  );
}
