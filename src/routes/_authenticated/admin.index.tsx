import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  CalendarDays,
  Users,
  Banknote,
  BadgeCheck,
  BriefcaseBusiness,
  ArrowUpRight,
  Plus,
  FileUp,
  Send,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

type Counts = {
  requests_new: number;
  bookings_new: number;
  users_total: number;
  commissions_pending_amount: number;
  pending_approvals: number;
  projects_active: number;
};

function StatCard(props: {
  title: string;
  value: string | number;
  hint?: string;
  delta?: string;
  tone: string;
  icon: LucideIcon;
  actionTo?: string;
}) {
  const Icon = props.icon;
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(23,55,74,0.25)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent to-background/40 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-[13px] font-black tracking-tight">{props.title}</CardTitle>
          {props.hint ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{props.hint}</p>
          ) : null}
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", props.tone)}>
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[28px] font-black leading-tight tracking-tight">{props.value}</div>
            {props.delta ? (
              <div className="mt-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                {props.delta}
              </div>
            ) : null}
          </div>
          {props.actionTo ? (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground">
              <Link to={props.actionTo as never}>
                عرض <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const REQ_STATUS_TONES: Record<string, string> = {
  new: "bg-[#17374A]/15 text-[#17374A] dark:bg-[#E09F48]/20 dark:text-[#E09F48]",
  in_review: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  in_progress: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/20 text-destructive",
  cancelled: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
};

type QuickAction = {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
  adminOnly?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { to: "/services", label: "طلب خدمة جديدة", desc: "إنشاء طلب تصميم / إعلام / تقرير", icon: Send, tone: "from-[#17374A] to-[#2F5257]" },
  { to: "/booking", label: "حجز استشارة", desc: "جدولة اجتماع مع فريق أوبن لوب", icon: CalendarDays, tone: "from-[#2F5257] to-[#E09F48]" },
  { to: "/packages", label: "استعراض الباقات", desc: "7 باقات احترافية للمنظمات", icon: FileUp, tone: "from-[#E09F48] to-[#C34A36]" },
  { to: "/admin/users", label: "إضافة مستخدم جديد", desc: "إدارة حسابات الموظفين والعملاء", icon: UserPlus, tone: "from-[#C34A36] to-[#17374A]", adminOnly: true },
  { to: "/admin/library", label: "رفع ملف للمكتبة", desc: "نشر مستندات وملفات قابلة للتنزيل", icon: Plus, tone: "from-indigo-600 to-[#17374A]" },
];

function AdminOverview() {
  const { profile, user, isAdmin } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    requests_new: 0,
    bookings_new: 0,
    users_total: 0,
    commissions_pending_amount: 0,
    pending_approvals: 0,
    projects_active: 0,
  });
  const [recent, setRecent] = useState<
    Array<{ id: string; title: string | null; type: string; status: string; created_at: string }>
  >([]);
  const [requestsMonthly, setRequestsMonthly] = useState<Array<{ name: string; requests: number }>>([]);
  const [commissionsData, setCommissionsData] = useState<
    Array<{ name: string; collected: number; pending: number }>
  >([]);
  const [sectorsData, setSectorsData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    (async () => {
      const countsQueries = await Promise.all([
        supabase.from("requests").select("status", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("bookings").select("status", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("commissions").select("amount").in("status", ["pending", "overdue"]),
        supabase.from("community_entities").select("status", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("rfqs").select("status", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("suppliers").select("status", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("projects").select("status", { count: "exact", head: true }).in("status", ["draft", "published"]),
      ]);
      const suppliersPending = Number(countsQueries[6].count ?? 0);
      const rfqPending = Number(countsQueries[5].count ?? 0);
      const entitiesPending = Number(countsQueries[4].count ?? 0);
      setCounts({
        requests_new: Number(countsQueries[0].count ?? 0),
        bookings_new: Number(countsQueries[1].count ?? 0),
        users_total: Number(countsQueries[2].count ?? 0),
        commissions_pending_amount: (countsQueries[3].data ?? []).reduce(
          (sum: number, r: { amount?: number }) => sum + Number(r.amount ?? 0),
          0
        ),
        pending_approvals: suppliersPending + rfqPending + entitiesPending,
        projects_active: Number(countsQueries[7].count ?? 0),
      });

      const { data: recentData } = await supabase
        .from("requests")
        .select("id, title, type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      setRecent((recentData ?? []) as never[]);

      const { data: allReq } = await supabase.from("requests").select("created_at");
      const monthly = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthly.set(key, 0);
      }
      for (const row of (allReq ?? []) as { created_at: string }[]) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + 1);
      }
      setRequestsMonthly([...monthly.entries()].map(([name, requests]) => ({ name, requests })));

      const { data: comm } = await supabase.from("commissions").select("status, amount, due_date");
      const cmap = new Map<string, { collected: number; pending: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        cmap.set(key, { collected: 0, pending: 0 });
      }
      for (const row of (comm ?? []) as { status: string; amount?: number; due_date?: string }[]) {
        const d = new Date(row.due_date ?? new Date());
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!cmap.has(key)) continue;
        const v = cmap.get(key)!;
        if (row.status === "collected") v.collected += Number(row.amount ?? 0);
        else v.pending += Number(row.amount ?? 0);
      }
      setCommissionsData([...cmap.entries()].map(([name, v]) => ({ name, ...v })));

      const { data: rfqSec } = await supabase.from("rfqs").select("sector");
      const sectors = new Map<string, number>();
      for (const row of (rfqSec ?? []) as { sector?: string }[]) {
        const s = row.sector || "غير محدد";
        sectors.set(s, (sectors.get(s) ?? 0) + 1);
      }
      setSectorsData([...sectors.entries()].map(([name, value]) => ({ name, value })));
    })();
  }, []);

  const SECTOR_COLORS = ["#17374A", "#E09F48", "#2F5257", "#C34A36", "#6366f1", "#10b981"];
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "صباح الخير" : greetingHour < 17 ? "مساء النور" : "مساء الخير";

  return (
    <div className="space-y-6">
      {/* ====== الترحيب + الإجراءات السريعة ====== */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-[#17374A] via-[#2F5257] to-[#17374A] text-white lg:col-span-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-14 -top-16 h-56 w-56 rounded-full bg-[#E09F48]/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-14 h-56 w-56 rounded-full bg-[#C34A36]/20 blur-3xl"
          />
          <CardHeader className="relative flex-row items-start justify-between space-y-0 pb-2 pl-6 pt-6">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.15em] text-[#E09F48]/90">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                لوحة القيادة
              </div>
              <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight sm:text-[30px]">
                {greeting}، {profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "مدير المنصة"} 👋
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/70">
                تابع أهم مؤشرات أداء منصة أوبن لوب اليوم.
                {counts.pending_approvals > 0
                  ? ` لديك ${counts.pending_approvals} طلبات واعتمادات تنتظر مراجعتك.`
                  : " لا توجد عناصر قيد الانتظار — يمكنك مراجعة التقارير أو إدارة المحتوى."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="relative pb-6 pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-10 rounded-xl bg-[#E09F48] px-4 text-[13px] font-black text-[#17374A] shadow-lg shadow-[#E09F48]/30 hover:bg-[#E09F48]/90">
                <Link to="/admin/approvals">
                  مراجعة الاعتمادات
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-10 rounded-xl border-white/20 bg-white/5 px-4 text-[13px] font-black text-white hover:bg-white/10 hover:text-white">
                <Link to="/admin/reports">عرض التقارير</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-10 rounded-xl border-white/20 bg-white/5 px-4 text-[13px] font-black text-white hover:bg-white/10 hover:text-white">
                <Link to="/">العودة إلى الموقع</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-1">
            <CardTitle className="text-[13px] font-black">إجراءات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-1.5 pt-1">
            {QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin).map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to as never}>
                  <div className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60">
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm", a.tone)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-black leading-tight group-hover:text-primary">
                        {a.label}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.desc}</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:translate-y-0.5 group-hover:text-primary" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ====== بطاقات KPIs (6 بطاقات شبكية) ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="طلبات جديدة"
          value={counts.requests_new}
          hint="حالة: جديد"
          delta="+ 0 هذا الأسبوع"
          tone="bg-[#17374A]/12 text-[#17374A] dark:bg-[#E09F48]/20 dark:text-[#E09F48]"
          icon={ShoppingCart}
          actionTo="/admin/requests"
        />
        <StatCard
          title="حجوزات الاستشارات"
          value={counts.bookings_new}
          hint="جديدة تنتاج التأكيد"
          tone="bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
          icon={CalendarDays}
          actionTo="/admin/bookings"
        />
        <StatCard
          title="إجمالي المستخدمين"
          value={counts.users_total}
          hint="حسابات مسجلة في المنصة"
          tone="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          icon={Users}
          actionTo="/admin/users"
        />
        <StatCard
          title="العمولات المستحقة"
          value={`${counts.commissions_pending_amount.toLocaleString("ar-EG")} ر.س`}
          hint="معلقة و متأخرة"
          tone="bg-[#E09F48]/15 text-[#b98232] dark:text-[#E09F48]"
          icon={Banknote}
          actionTo="/admin/commissions"
        />
        <StatCard
          title="تحتاج اعتماد"
          value={counts.pending_approvals}
          hint="جهات + موردين + فرص"
          tone="bg-amber-500/12 text-amber-700 dark:text-amber-300"
          icon={BadgeCheck}
          actionTo="/admin/approvals"
        />
        <StatCard
          title="مشاريع نشطة"
          value={counts.projects_active}
          hint="للمستقلين والمؤسسات"
          tone="bg-blue-500/12 text-blue-700 dark:text-blue-300"
          icon={BriefcaseBusiness}
          actionTo="/admin/projects"
        />
      </div>

      {/* ====== الرسوم البيانية (صف واحد) ====== */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 bg-card lg:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-[13px] font-black">نمو الطلبات</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">آخر 6 أشهر</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground">
              <Link to="/admin/requests">
                تفاصيل <ArrowUpRight className="mr-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestsMonthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#17374A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card lg:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-[13px] font-black">العمولات</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">محصلة مقابل مستحقة (آخر ٦ أشهر)</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground">
              <Link to="/admin/commissions">تفاصيل</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={commissionsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="محصلة" />
                  <Line type="monotone" dataKey="pending" stroke="#E09F48" strokeWidth={2.5} dot={{ r: 3 }} name="مستحقة" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[13px] font-black">الفرص حسب القطاع</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">توزيع منصة فرص أوبن لوب</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorsData.length ? sectorsData : [{ name: "لا توجد بيانات", value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {sectorsData.length
                      ? sectorsData.map((_d, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)
                      : [<Cell key="empty" fill="#cbd5e1" />]}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== جدول أحدث الطلبات ====== */}
      <Card className="overflow-hidden border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <div className="text-[14px] font-black">أحدث الطلبات</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              آخر 8 طلبات تم استلامها من العملاء
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg border border-border/50 px-3 text-[11px] font-black text-muted-foreground hover:text-foreground">
            <Link to="/admin/requests">عرض الكل</Link>
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان الطلب</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-14 text-center">
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div className="text-[13px] font-black">لا توجد طلبات بعد</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      سيظهر أول طلب يُرسل من العملاء هنا مباشرة.
                    </p>
                    <div className="mt-4">
                      <Button asChild size="sm" className="h-9 rounded-xl bg-[#17374A] text-[12px] font-black text-white hover:bg-[#17374A]/90">
                        <Link to="/services">إنشاء طلب تجريبي</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold">{r.title || "(بدون عنوان)"}</TableCell>
                    <TableCell className="text-[12px]">
                      {r.type === "package"
                        ? "باقة"
                        : r.type === "catering"
                          ? "إعاشة"
                          : r.type === "service"
                            ? "خدمة مخصصة"
                            : r.type === "freelancer"
                              ? "عمل حر"
                              : r.type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-2.5 py-0.5 text-[10px] font-black",
                          REQ_STATUS_TONES[r.status] ?? REQ_STATUS_TONES.new
                        )}
                      >
                        {r.status === "new"
                          ? "جديد"
                          : r.status === "in_review"
                            ? "قيد المراجعة"
                            : r.status === "in_progress"
                              ? "قيد التنفيذ"
                              : r.status === "completed"
                                ? "مكتمل"
                                : r.status === "rejected"
                                  ? "مرفوض"
                                  : r.status === "cancelled"
                                    ? "ملغي"
                                    : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
