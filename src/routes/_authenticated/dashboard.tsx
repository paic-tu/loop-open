import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FileText,
  LogOut,
  Bell,
  User as UserIcon,
  Edit3,
  X,
  Save,
  KeyRound,
  Eye,
  ShoppingCart,
  CalendarDays,
  BriefcaseBusiness,
  ArrowUpRight,
  Send,
  Sparkles,
  Handshake,
  FolderClock,
  Copy,
  Calendar,
  Clock,
  CheckCircle2,
  Paperclip,
  StickyNote,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  CustomerInfoGrid,
  SectionHeader,
  DetailsRenderer,
  AttachmentButton,
  DrawerSaveFooter,
  copyId,
} from "@/components/unified/DetailPrimitives";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { REQUEST_TYPES, STATUS_LABELS, type RequestType } from "@/lib/requests";
import { BOOKING_STATUSES, type BookingRow } from "@/lib/bookings";
import { MyOpportunities } from "@/components/MyOpportunities";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "لوحة حسابي | أوبن لوب" },
      { name: "description", content: "تابع طلباتك ومستنداتك وحالتها لدى أوبن لوب." },
      { property: "og:title", content: "لوحة حسابي | أوبن لوب" },
      { property: "og:description", content: "إدارة الطلبات والمستندات والبيانات الشخصية." },
    ],
  }),
  component: Dashboard,
});

type NotifRow = { id: string; title: string; body: string | null; read_at: string | null };

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
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent to-background/40 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
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
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 gap-1 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground"
            >
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
};

const QUICK_ACTIONS: QuickAction[] = [
  { to: "/services", label: "طلب خدمة جديدة", desc: "تصميم / إعلام / تقارير / استشارات", icon: Send, tone: "from-[#17374A] to-[#2F5257]" },
  { to: "/booking", label: "حجز استشارة", desc: "اجتماع مع فريق أوبن لوب", icon: CalendarDays, tone: "from-[#2F5257] to-[#E09F48]" },
  { to: "/packages", label: "الباقات الاحترافية", desc: "7 باقات للمنظمات والجمعيات", icon: FolderClock, tone: "from-[#E09F48] to-[#C34A36]" },
  { to: "/community", label: "سوق فرص أوبن لوب", desc: "تصفح الفرص والعروض", icon: Handshake, tone: "from-indigo-600 to-[#17374A]" },
];

function Dashboard() {
  const { user, isAdmin, roles, rolesLoading, signOut, profile, updateProfile, changePassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const redirected = useRef(false);

  // ===== جميع Hooks يجب أن تكون قبل أي return مبكر =====
  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formOrg, setFormOrg] = useState("");

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);

  // ===== إعادة توجيه admin/staff إلى /admin (بمجرد تحميل الأدوار) =====
  useEffect(() => {
    if (rolesLoading) return;
    if (redirected.current) return;
    const isStaff = roles.includes("staff") || roles.includes("admin");
    if (!isStaff) return;
    redirected.current = true;
    void navigate({ to: "/admin", replace: true });
  }, [roles, rolesLoading, navigate]);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const projectApplications = useQuery({
    queryKey: ["my-project-applications", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_applications")
        .select("id,status,note,created_at,projects(title,field)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const myBookings = useQuery({
    queryKey: ["my-bookings", user?.id, user?.email],
    enabled: Boolean(user?.id || user?.email),
    queryFn: async () => {
      let query = supabase.from("bookings").select("*");
      if (user?.id) query = query.or(`user_id.eq.${user.id},email.ilike.${user.email ?? ""}`);
      else if (user?.email) query = query.ilike("email", user.email);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookingRow[];
    },
  });

  // ===== الكميات والرسوم البيانية =====
  const [kpis, setKpis] = useState({
    totalRequests: 0,
    inProgress: 0,
    bookings: 0,
    opportunities: 0,
    completed: 0,
    pending: 0,
  });
  const [monthlyData, setMonthlyData] = useState<Array<{ name: string; طلبات: number }>>([]);

  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [selectedProjectApp, setSelectedProjectApp] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!requests.data) return;
    const all = requests.data as Array<{ status: string; created_at: string }>;
    const reqsInProgress = all.filter(
      (r) => r.status === "in_progress" || r.status === "in_review"
    ).length;
    const completed = all.filter((r) => r.status === "completed").length;
    const pending = all.filter((r) => r.status === "new" || r.status === "pending").length;

    setKpis((k) => ({
      ...k,
      totalRequests: all.length,
      inProgress: reqsInProgress,
      completed,
      pending,
      bookings: myBookings.data?.length ?? 0,
      opportunities: 0,
    }));

    // رسم بياني شهري
    const monthly = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, 0);
    }
    for (const row of all) {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + 1);
    }
    setMonthlyData([...monthly.entries()].map(([name, طلبات]) => ({ name, طلبات })));
  }, [requests.data, myBookings.data]);

  useEffect(() => {
    if (profile) {
      setFormName(profile.full_name ?? "");
      setFormPhone(profile.phone ?? "");
      setFormOrg(profile.organization ?? "");
    } else if (profileQuery.data) {
      setFormName(profileQuery.data.full_name ?? "");
      setFormPhone(profileQuery.data.phone ?? "");
      setFormOrg(profileQuery.data.organization ?? "");
    }
  }, [profile, profileQuery.data]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data ?? []) as NotifRow[];
      setNotifications(rows);
      setUnread(rows.filter((r) => !r.read_at).length);
    })();
    const channel = supabase
      .channel("public:notifications:user")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          setUnread((n) => n + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ===== Early return ONLY بعد جميع Hooks =====
  if (rolesLoading) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-10 w-10 animate-spin place-items-center rounded-2xl border-2 border-border border-t-primary text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <div className="text-[12px] font-black text-muted-foreground">جارٍ تجهيز لوحة الحساب...</div>
        </div>
      </section>
    );
  }

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setNotifications((prev) => prev.map((p) => ({ ...p, read_at: "read" as never })));
    setUnread(0);
    toast.success("تم تعليم جميع الإشعارات كمقروءة");
  };

  const all = requests.data ?? [];
  const applications = all.filter((r) => r.type === "freelancer");
  const orders = all.filter((r) => r.type !== "freelancer");

  const startEdit = () => {
    setFormName(profile?.full_name ?? profileQuery.data?.full_name ?? "");
    setFormPhone(profile?.phone ?? profileQuery.data?.phone ?? "");
    setFormOrg(profile?.organization ?? profileQuery.data?.organization ?? "");
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      await updateProfile({
        full_name: formName.trim(),
        phone: formPhone.trim(),
        organization: formOrg.trim() || null,
      });
      await refreshProfile();
      await profileQuery.refetch();
      setEditMode(false);
      toast.success("تم حفظ بياناتك بنجاح");
    } catch (e) {
      console.error(e);
      toast.error("تعذر حفظ البيانات، جرب مجدداً");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    try {
      setSavingPw(true);
      await changePassword(newPw);
      setNewPw("");
      setConfirmPw("");
      toast.success("تم تغيير كلمة المرور بنجاح");
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as { message?: string })?.message ?? "تعذر تغيير كلمة المرور";
      toast.error(msg);
    } finally {
      setSavingPw(false);
    }
  };

  const openDocument = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("تعذر فتح المستند");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const openBookingAttachment = async (path: string) => openDocument("documents", path);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  };

  const displayName = profile?.full_name || profileQuery.data?.full_name || user?.email;
  const displayEmail = profile?.email || profileQuery.data?.email || user?.email;
  const displayPhone = profile?.phone ?? profileQuery.data?.phone;
  const displayOrg = profile?.organization ?? profileQuery.data?.organization;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "صباح الخير" : greetingHour < 17 ? "مساء النور" : "مساء الخير";

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-14 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold sm:text-4xl">لوحة حسابي</h1>
            <p className="mt-3 text-base opacity-80">مرحباً {displayName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="relative" aria-label="الإشعارات">
                  <Bell className="h-4 w-4" />
                  <span className="mr-2 hidden sm:inline">الإشعارات</span>
                  {unread > 0 ? (
                    <Badge className="pointer-events-none absolute -right-2 -top-2 h-5 min-w-5 rounded-full bg-destructive px-1 text-white">
                      {unread}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>الإشعارات</span>
                  <Button variant="ghost" size="sm" onClick={markAllRead}>
                    <Check className="ml-1 h-4 w-4" />
                    قراءة الكل
                  </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    لا توجد إشعارات حتى الآن.
                  </div>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-auto p-2 text-sm">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`rounded-xl border border-border/60 p-3 ${
                          n.read_at ? "bg-transparent" : "bg-primary/8"
                        }`}
                      >
                        <div className="font-bold">{n.title}</div>
                        {n.body ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {isAdmin && (
              <Button asChild variant="secondary" className="rounded-full font-bold">
                <Link to="/admin">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  لوحة الإدارة
                </Link>
              </Button>
            )}
            <Button onClick={handleSignOut} variant="outline" className="rounded-full font-bold">
              <LogOut className="h-4 w-4" aria-hidden />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          {/* ====== بطاقة الترحيب + الإجراءات السريعة ====== */}
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
                    لوحة الحساب الشخصي
                  </div>
                  <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight sm:text-[30px]">
                    {greeting}، {displayName?.split(" ")[0] || user?.email?.split("@")[0] || "عزيزي العميل"}
                  </h1>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/70">
                    تابع طلباتك وحجوزاتك وفرصك من لوحة واحدة.
                    {kpis.inProgress > 0
                      ? ` لديك ${kpis.inProgress} طلب${kpis.inProgress === 1 ? "" : "ات"} قيد التنفيذ حالياً.`
                      : kpis.pending > 0
                        ? ` لديك ${kpis.pending} طلب${kpis.pending === 1 ? "" : "ات"} جديدة تنتظر المراجعة.`
                        : " يمكنك مراجعة طلباتك السابقة أو تقديم طلب جديد الآن."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="relative pb-6 pl-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="h-10 rounded-xl bg-[#E09F48] px-4 text-[13px] font-black text-[#17374A] shadow-lg shadow-[#E09F48]/30 hover:bg-[#E09F48]/90"
                  >
                    <Link to="/services">
                      طلب خدمة جديدة
                      <ArrowUpRight className="mr-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-xl border-white/20 bg-white/5 px-4 text-[13px] font-black text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/community">تصفح فرص المجتمع</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-xl border-white/20 bg-white/5 px-4 text-[13px] font-black text-white hover:bg-white/10 hover:text-white"
                  >
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
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link key={a.to} to={a.to as never}>
                      <div className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60">
                        <div
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                            a.tone
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-black leading-tight group-hover:text-primary">
                            {a.label}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {a.desc}
                          </div>
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
              title="إجمالي الطلبات"
              value={kpis.totalRequests}
              hint="جميع الطلبات المرسلة"
              tone="bg-[#17374A]/12 text-[#17374A] dark:bg-[#E09F48]/20 dark:text-[#E09F48]"
              icon={ShoppingCart}
            />
            <StatCard
              title="قيد التنفيذ"
              value={kpis.inProgress}
              hint="طلبات قيد المراجعة/الإنجاز"
              tone="bg-amber-500/12 text-amber-700 dark:text-amber-300"
              icon={BriefcaseBusiness}
            />
            <StatCard
              title="مكتملة"
              value={kpis.completed}
              hint="طلبات تم إنهاؤها بنجاح"
              tone="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              icon={Check}
            />
            <StatCard
              title="حجوزات الاستشارات"
              value={kpis.bookings}
              hint="حجوزاتك المجدولة"
              tone="bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
              icon={CalendarDays}
            />
            <StatCard
              title="جديدة / في الانتظار"
              value={kpis.pending}
              hint="لم تبدأ المراجعة بعد"
              tone="bg-[#E09F48]/15 text-[#b98232] dark:text-[#E09F48]"
              icon={FolderClock}
            />
            <StatCard
              title="طلبات الانضمام"
              value={applications.length}
              hint="للمشاريع والمناصب"
              tone="bg-blue-500/12 text-blue-700 dark:text-blue-300"
              icon={Handshake}
            />
          </div>

          {/* ====== محتوى متقدم: رسوم + بياناتي + كلمة المرور ====== */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* ===== رسم بياني للطلبات الشهرية ===== */}
            <Card className="border-border/60 bg-card lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-[13px] font-black">نمو طلباتي</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">آخر ٦ أشهر</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="طلبات" fill="#2F5257" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* ===== بياناتي الشخصية ===== */}
            <Card className="border-border/60 bg-card">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary dark:text-gold">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-extrabold">بياناتي</CardTitle>
                    <p className="text-xs text-muted-foreground">حسابك الشخصي</p>
                  </div>
                </div>
                {!editMode ? (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={startEdit}>
                    <Edit3 className="h-4 w-4" />
                    <span className="mr-1.5 hidden sm:inline">تعديل</span>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={savingProfile}>
                    <X className="h-4 w-4" />
                    إلغاء
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!editMode ? (
                  <dl className="space-y-3 text-sm">
                    {[
                      ["الاسم", displayName],
                      ["البريد الإلكتروني", displayEmail],
                      ["رقم الجوال", displayPhone],
                      ["الجهة / الجمعية", displayOrg],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 font-semibold break-all">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">الاسم الكامل</Label>
                      <Input
                        id="full_name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">رقم الجوال</Label>
                      <Input
                        id="phone"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        dir="ltr"
                        placeholder="+966..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="org">الجهة / الجمعية</Label>
                      <Input
                        id="org"
                        value={formOrg}
                        onChange={(e) => setFormOrg(e.target.value)}
                        dir="rtl"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={saveProfile}
                        disabled={savingProfile}
                        className="rounded-full font-bold"
                      >
                        <Save className="h-4 w-4" />
                        <span className="mr-1.5">حفظ</span>
                      </Button>
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                <div>
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold">كلمة المرور</h3>
                      <p className="text-[11px] text-muted-foreground">غيّر كلمة مرور حسابك</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="npw">كلمة المرور الجديدة</Label>
                      <Input
                        id="npw"
                        type="password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cpw">تأكيد كلمة المرور</Label>
                      <Input
                        id="cpw"
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={savingPw}
                      className="w-full rounded-full font-bold"
                      variant="secondary"
                    >
                      {savingPw ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ====== جدول أحدث الطلبات (8 أعمدة) ====== */}
          <Card className="overflow-hidden border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <div>
                <div className="text-[14px] font-black">أحدث طلباتي</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  آخر الطلبات التي أرسلتها إلى فريق أوبن لوب
                </div>
              </div>
              <Button
                asChild
                size="sm"
                className="h-9 rounded-xl bg-[#17374A] text-[12px] font-black text-white hover:bg-[#17374A]/90"
              >
                <Link to="/services">طلب جديد</Link>
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
                    <TableHead>المستند</TableHead>
                    <TableHead className="w-[90px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="text-[13px] font-black">لا توجد طلبات بعد</div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          سيظهر أول طلب ترسله هنا مباشرة.
                        </p>
                        <div className="mt-4">
                          <Button
                            asChild
                            size="sm"
                            className="h-9 rounded-xl bg-[#17374A] text-[12px] font-black text-white hover:bg-[#17374A]/90"
                          >
                            <Link to="/services">إرسال طلب تجريبي</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.slice(0, 8).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold min-w-[200px]">{r.title || "(بدون عنوان)"}</TableCell>
                        <TableCell className="text-[12px]">
                          {REQUEST_TYPES[r.type as RequestType] ?? r.type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full border-0 px-2.5 py-0.5 text-[10px] font-black",
                              REQ_STATUS_TONES[r.status] ?? REQ_STATUS_TONES.new
                            )}
                          >
                            {STATUS_LABELS[r.status] ?? r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("ar-SA")}
                        </TableCell>
                        <TableCell>
                          {r.document_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-2 text-[11px] font-bold"
                              onClick={() => openDocument("documents", r.document_path!)}
                            >
                              <Eye className="h-3.5 w-3.5 ml-1" />
                              عرض
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRequest(r as Record<string, unknown>)}
                            className="hover:bg-primary/10 hover:text-primary dark:hover:text-gold"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="mr-1 hidden sm:inline">عرض</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* ====== حجوزات الاستشارات + فرصي + طلبات انضمام ====== */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* ===== حجوزات الاستشارات ===== */}
            <Card className="border-border/60 bg-card">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-[13px] font-black">حجوزات الاستشارات</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {myBookings.data?.length ?? 0} حجز
                  </p>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground"
                >
                  <Link to="/booking">
                    جديد <ArrowUpRight className="h-3 w-3 mr-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-auto">
                {myBookings.isLoading && (
                  <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
                )}
                {!myBookings.isLoading && (myBookings.data?.length ?? 0) === 0 && (
                  <div className="card-elevated p-5 text-center text-xs text-muted-foreground">
                    لا توجد حجوزات حتى الآن.
                  </div>
                )}
                {(myBookings.data ?? []).slice(0, 5).map((b) => {
                  const meta = BOOKING_STATUSES[b.status] ?? {
                    label: b.status,
                    tone: "bg-secondary text-muted-foreground",
                  };
                  return (
                    <div key={b.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                            {b.service_category || "استشارة عامة"}
                          </p>
                          <p className="mt-0.5 text-sm font-extrabold truncate">{b.full_name}</p>
                        </div>
                        <Badge className={`rounded-full text-[10px] font-black ${meta.tone}`}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(b.created_at).toLocaleString("ar-SA")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {b.attachment_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-2 text-[10px] font-bold"
                            onClick={() => openBookingAttachment(b.attachment_path!)}
                          >
                            <Eye className="h-3 w-3 ml-1" />
                            المرفق
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-2 text-[10px] font-bold border-primary/30 bg-primary/5 text-primary dark:text-gold"
                          onClick={() => setSelectedBooking(b)}
                        >
                          <Eye className="h-3 w-3 ml-1" />
                          عرض التفاصيل
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ===== فرصي وعروض الأسعار ===== */}
            <Card className="border-border/60 bg-card lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-[13px] font-black">فرصي وعروض الأسعار</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    تابع عروضك المقدمة على فرص سوق أوبن لوب
                  </p>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg border border-border/50 px-2 text-[11px] font-black text-muted-foreground hover:text-foreground"
                >
                  <Link to="/community">
                    تصفح الفرص <ArrowUpRight className="h-3 w-3 mr-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-auto">
                <MyOpportunities />
              </CardContent>
            </Card>
          </div>

          {/* ====== طلبات الانضمام للمشاريع ====== */}
          <Card className="overflow-hidden border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <div>
                <div className="text-[14px] font-black">طلبات الانضمام للمشاريع</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  متابعة حالة طلباتك للمشاريع والمناصب
                </div>
              </div>
              <Button
                asChild
                size="sm"
                className="h-9 rounded-xl border border-border/60 bg-card text-[12px] font-black hover:bg-muted"
                variant="outline"
              >
                <Link to="/careers">استعراض المشاريع</Link>
              </Button>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المجال</TableHead>
                    <TableHead>عنوان المشروع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead className="text-left">التاريخ</TableHead>
                    <TableHead className="w-[90px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectApplications.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        جارٍ التحميل...
                      </TableCell>
                    </TableRow>
                  )}
                  {!projectApplications.isLoading && projectApplications.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>
                        <div className="text-[13px] font-black">لم تتقدّم على أي مشروع بعد</div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          تصفّح لوحة المشاريع من صفحة «انضم إلينا».
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {projectApplications.data?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-[12px] font-bold text-primary dark:text-gold">
                        {a.projects?.field || "مشروع"}
                      </TableCell>
                      <TableCell className="font-extrabold">
                        {a.projects?.title ?? "مشروع"}
                      </TableCell>
                      <TableCell>
                        <Badge className="rounded-full">
                          {STATUS_LABELS[a.status] ?? a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground max-w-[250px] truncate">
                        {a.note || "—"}
                      </TableCell>
                      <TableCell className="text-left text-[11px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("ar-SA")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProjectApp(a as Record<string, unknown>)}
                          className="hover:bg-primary/10 hover:text-primary dark:hover:text-gold"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="mr-1 hidden sm:inline">عرض</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </section>

      {/* ====== Drawers الموحدة لعرض التفاصيل ====== */}
      {selectedRequest && (
        <Drawer open={Boolean(selectedRequest)} onOpenChange={(o) => !o && setSelectedRequest(null)}>
          <DrawerContent className="h-[92vh] max-w-none border-border/60 bg-background">
            {(() => {
              const r = selectedRequest as Record<string, unknown>;
              const rid = String(r.id ?? "");
              const type = String(r.type ?? "service");
              const status = String(r.status ?? "new");
              const title = r.title ? String(r.title) : null;
              const details = (r.details ?? {}) as Record<string, unknown>;
              const document_path = r.document_path ? String(r.document_path) : null;
              const internal_notes = r.internal_notes ? String(r.internal_notes) : null;
              const closed_at = r.closed_at ? String(r.closed_at) : null;
              const created_at = String(r.created_at ?? new Date().toISOString());
              return (
                <>
                  <DrawerHeader className="border-b border-border/60 bg-muted/30">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border font-bold",
                              type === "package"
                                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                                : type === "catering"
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                : "border-primary/30 bg-primary/10 text-primary dark:text-gold"
                            )}
                          >
                            {REQUEST_TYPES[type as RequestType] ?? type}
                          </Badge>
                          <Badge
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                              REQ_STATUS_TONES[status] ?? REQ_STATUS_TONES.new
                            )}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {STATUS_LABELS[status] ?? status}
                          </Badge>
                          {document_path && (
                            <Badge
                              variant="outline"
                              className="inline-flex items-center gap-1.5 border-primary/30 bg-primary/10 text-primary dark:text-gold"
                            >
                              <Paperclip className="h-3 w-3" />
                              يوجد ملف مرفق
                            </Badge>
                          )}
                        </div>
                        <DrawerTitle className="!mt-2 text-2xl font-black sm:text-[28px]">
                          {title || `طلب ${REQUEST_TYPES[type as RequestType] ?? "غير مصنف"}`}
                        </DrawerTitle>
                        <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            أنشئ في {new Date(created_at).toLocaleString("ar-SA")}
                          </span>
                          {closed_at && (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              أغلق في {new Date(closed_at).toLocaleString("ar-SA")}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="inline-flex items-center gap-1.5 h-auto !py-1 text-xs"
                            onClick={() => copyId(rid)}
                          >
                            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              #{rid.slice(0, 10)}
                            </code>
                            <Copy className="h-3 w-3" />
                            نسخ المعرف
                          </Button>
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>

                  <div className="mx-auto grid w-full max-w-4xl gap-6 overflow-auto px-4 py-6 pb-40">
                    <CustomerInfoGrid
                      name={displayName || "—"}
                      org={displayOrg || undefined}
                      phone={
                        displayPhone
                          ? {
                              value: <span dir="ltr">{displayPhone}</span>,
                            }
                          : undefined
                      }
                      email={
                        displayEmail
                          ? {
                              value: <span dir="ltr">{displayEmail}</span>,
                            }
                          : undefined
                      }
                    />

                    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                      <SectionHeader
                        icon={Clock}
                        title="متابعة الطلب"
                        tone="bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      />
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            الحالة الحالية
                          </Label>
                          <div
                            className={cn(
                              "mt-1.5 flex h-11 items-center justify-center rounded-md border border-border/70 bg-background px-3 font-bold text-base",
                              REQ_STATUS_TONES[status] ?? REQ_STATUS_TONES.new
                            )}
                          >
                            {STATUS_LABELS[status] ?? status}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            تاريخ الإنشاء
                          </Label>
                          <div className="mt-1.5 flex h-11 items-center rounded-md border border-border/70 bg-background px-3 text-sm">
                            <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">
                              {new Date(created_at).toLocaleString("ar-SA")}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            المستند المرفق
                          </Label>
                          {document_path ? (
                            <Button
                              variant="outline"
                              className="mt-1.5 h-11 w-full justify-start gap-2"
                              onClick={() => openDocument("documents", document_path)}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="truncate font-bold">فتح الملف المرفق</span>
                            </Button>
                          ) : (
                            <div className="mt-1.5 flex h-11 items-center rounded-md border border-dashed border-border/70 bg-muted/30 px-3 text-xs italic text-muted-foreground">
                              لا يوجد ملف مرفق بهذا الطلب
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                      <SectionHeader
                        icon={FileText}
                        title="تفاصيل محتوى الطلب"
                        tone="bg-purple-500/10 text-purple-700 dark:text-purple-300"
                      />
                      <DetailsRenderer data={{ ...(details ?? {}), ...(title ? { "عنوان الطلب": title } : {}) }} />
                    </section>

                    {internal_notes && (
                      <>
                        <Separator className="my-1" />
                        <section className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-card/50 to-primary/5 p-5 shadow-[0_0_0_1px_rgba(99,102,241,0.08)_inset] sm:p-6">
                          <div className="mb-4 flex flex-wrap items-center gap-2 text-lg font-black text-indigo-800 dark:text-indigo-200">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                              <StickyNote className="h-4 w-4" />
                            </div>
                            ملاحظات الفريق حول طلبك
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                            <p className="whitespace-pre-wrap text-[14px] leading-7 font-medium text-foreground/90">
                              {internal_notes}
                            </p>
                          </div>
                        </section>
                      </>
                    )}
                  </div>

                  <DrawerSaveFooter />
                </>
              );
            })()}
          </DrawerContent>
        </Drawer>
      )}

      {selectedBooking && (
        <Drawer open={Boolean(selectedBooking)} onOpenChange={(o) => !o && setSelectedBooking(null)}>
          <DrawerContent className="h-[92vh] max-w-none border-border/60 bg-background">
            {(() => {
              const b = selectedBooking;
              const meta = BOOKING_STATUSES[b.status] ?? {
                label: b.status,
                tone: "bg-secondary text-muted-foreground",
              };
              return (
                <>
                  <DrawerHeader className="border-b border-border/60 bg-muted/30">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold"
                          >
                            حجز استشارة
                          </Badge>
                          <Badge
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                              meta.tone
                            )}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          {b.attachment_path && (
                            <Badge
                              variant="outline"
                              className="inline-flex items-center gap-1.5 border-primary/30 bg-primary/10 text-primary dark:text-gold"
                            >
                              <Paperclip className="h-3 w-3" />
                              يوجد مرفق
                            </Badge>
                          )}
                        </div>
                        <DrawerTitle className="!mt-2 text-2xl font-black sm:text-[28px]">
                          {b.service_category
                            ? `استشارة: ${b.service_category}`
                            : "حجز استشارة عامة"}
                        </DrawerTitle>
                        <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            وصل في {new Date(b.created_at).toLocaleString("ar-SA")}
                          </span>
                          {b.closed_at && (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              أغلق في {new Date(b.closed_at).toLocaleString("ar-SA")}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="inline-flex items-center gap-1.5 h-auto !py-1 text-xs"
                            onClick={() => copyId(b.id)}
                          >
                            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              #{b.id.slice(0, 10)}
                            </code>
                            <Copy className="h-3 w-3" />
                            نسخ المعرف
                          </Button>
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>

                  <div className="mx-auto grid w-full max-w-4xl gap-6 overflow-auto px-4 py-6 pb-40">
                    <CustomerInfoGrid
                      name={b.full_name}
                      org={b.entity_name || undefined}
                      phone={{
                        value: <span dir="ltr">{b.phone}</span>,
                      }}
                      email={{
                        value: <span dir="ltr">{b.email}</span>,
                      }}
                    />

                    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                      <SectionHeader
                        icon={Clock}
                        title="متابعة الحجز"
                        tone="bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      />
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            الحالة الحالية
                          </Label>
                          <div
                            className={cn(
                              "mt-1.5 flex h-11 items-center justify-center rounded-md border border-border/70 bg-background px-3 font-bold text-base",
                              meta.tone
                            )}
                          >
                            {meta.label}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            تاريخ الإنشاء
                          </Label>
                          <div className="mt-1.5 flex h-11 items-center rounded-md border border-border/70 bg-background px-3 text-sm">
                            <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">
                              {new Date(b.created_at).toLocaleString("ar-SA")}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            المستند المرفق
                          </Label>
                          {b.attachment_path ? (
                            <Button
                              variant="outline"
                              className="mt-1.5 h-11 w-full justify-start gap-2"
                              onClick={() => openBookingAttachment(b.attachment_path!)}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="truncate font-bold">فتح المرفق</span>
                            </Button>
                          ) : (
                            <div className="mt-1.5 flex h-11 items-center rounded-md border border-dashed border-border/70 bg-muted/30 px-3 text-xs italic text-muted-foreground">
                              لا يوجد مرفق
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                      <SectionHeader
                        icon={FileText}
                        title="تفاصيل الحجز"
                        tone="bg-purple-500/10 text-purple-700 dark:text-purple-300"
                      />
                      <DetailsRenderer
                        data={{
                          "مجال الاستشارة": b.service_category || "استشارة عامة",
                          "تفاصيل الاحتياج": b.note || "—",
                        }}
                      />
                    </section>
                  </div>

                  <DrawerSaveFooter />
                </>
              );
            })()}
          </DrawerContent>
        </Drawer>
      )}

      {selectedProjectApp && (
        <Drawer open={Boolean(selectedProjectApp)} onOpenChange={(o) => !o && setSelectedProjectApp(null)}>
          <DrawerContent className="h-[92vh] max-w-none border-border/60 bg-background">
            {(() => {
              const a = selectedProjectApp as Record<string, unknown>;
              const projects = (a.projects ?? {}) as Record<string, unknown> | null;
              const field = projects?.field as string | undefined;
              const projectTitle = projects?.title as string | undefined;
              const appStatus = String(a.status ?? "new");
              const aid = String(a.id ?? "");
              const appNote = a.note ? String(a.note) : null;
              const appCreated = String(a.created_at ?? new Date().toISOString());
              return (
                <>
                  <DrawerHeader className="border-b border-border/60 bg-muted/30">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold"
                          >
                            طلب انضمام للمشاريع
                          </Badge>
                          <Badge
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                              REQ_STATUS_TONES[appStatus] ?? REQ_STATUS_TONES.new
                            )}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {STATUS_LABELS[appStatus] ?? appStatus}
                          </Badge>
                        </div>
                        <DrawerTitle className="!mt-2 text-2xl font-black sm:text-[28px]">
                          {projectTitle || "تقديم على منصب / مشروع"}
                        </DrawerTitle>
                        <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            أنشئ في {new Date(appCreated).toLocaleString("ar-SA")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="inline-flex items-center gap-1.5 h-auto !py-1 text-xs"
                            onClick={() => copyId(aid)}
                          >
                            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              #{aid.slice(0, 10)}
                            </code>
                            <Copy className="h-3 w-3" />
                            نسخ المعرف
                          </Button>
                        </DrawerDescription>
                      </div>
                    </div>
                  </DrawerHeader>

                  <div className="mx-auto grid w-full max-w-4xl gap-6 overflow-auto px-4 py-6 pb-40">
                    <CustomerInfoGrid
                      name={displayName || "—"}
                      org={displayOrg || undefined}
                      phone={
                        displayPhone
                          ? {
                              value: <span dir="ltr">{displayPhone}</span>,
                            }
                          : undefined
                      }
                      email={
                        displayEmail
                          ? {
                              value: <span dir="ltr">{displayEmail}</span>,
                            }
                          : undefined
                      }
                    />

                    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                      <SectionHeader
                        icon={BriefcaseBusiness}
                        title="معلومات المشروع / المنصب"
                        tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      />
                      <DetailsRenderer
                        data={{
                          "مجال المشروع": field || "مجال عام",
                          "عنوان المشروع": projectTitle || "—",
                          "حالة الطلب": STATUS_LABELS[appStatus] ?? appStatus,
                        }}
                      />
                    </section>

                    {appNote && (
                      <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                        <SectionHeader
                          icon={FileText}
                          title="تفاصيل الطلب"
                          tone="bg-purple-500/10 text-purple-700 dark:text-purple-300"
                        />
                        <div className="rounded-xl border border-border/70 bg-background p-4">
                          <p className="whitespace-pre-wrap text-[14px] leading-7 font-medium text-foreground/90">
                            {appNote}
                          </p>
                        </div>
                      </section>
                    )}
                  </div>

                  <DrawerSaveFooter />
                </>
              );
            })()}
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
