import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  FileText,
  Eye,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Save,
  StickyNote,
  Paperclip,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Share2,
  Copy,
  ExternalLink,
  MessageSquare,
  Send,
  UserRound,
  Trash2,
  RefreshCw,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { cn, downloadCsv } from "@/lib/utils";
import { notifyUser } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: AdminRequestsPage,
});

type RequestRow = {
  id: string;
  type: string;
  title: string | null;
  details: Record<string, unknown> | null;
  status: string;
  internal_notes: string | null;
  assigned_to: string | null;
  user_id: string | null;
  document_path: string | null;
  closed_at: string | null;
  spam_score: number;
  is_spam: boolean;
  created_at: string;
  updated_at: string;
  // حقول مستخلصة من details لعرضها في الجدول بسهولة
  _name: string | null;
  _org: string | null;
  _phone: string | null;
  _email: string | null;
};

type RequestNote = {
  id: string;
  request_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

const STATUSES = ["new", "in_review", "in_progress", "completed", "rejected", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  in_review: "قيد المراجعة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  rejected: "مرفوض",
  cancelled: "ملغي",
};
const STATUS_ICON: Record<string, unknown> = {
  new: AlertCircle,
  in_review: Clock,
  in_progress: MessageSquare,
  completed: CheckCircle2,
  rejected: XCircle,
  cancelled: Ban,
};
const STATUS_TONE: Record<string, string> = {
  new: "bg-primary/15 text-primary dark:text-gold border-primary/30",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};
const TYPE_LABEL: Record<string, string> = {
  package: "باقة",
  service: "خدمة مخصصة",
  catering: "إعاشة",
  freelancer: "عمل حر",
  booking: "حجز استشارة",
};
const TYPE_TONE: Record<string, string> = {
  package: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  service: "bg-primary/15 text-primary dark:text-gold border-primary/30",
  catering: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  freelancer: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  booking: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

// قائمة بمفاتيح شائعة في details لنستخرج منها بيانات العميل
const NAME_KEYS = ["الاسم", "الاسم الكامل", "اسم العميل", "name", "fullName", "full_name"];
const ORG_KEYS = ["الجهة", "اسم الجهة", "الجمعية", "الشركة", "org", "company", "organization"];
const PHONE_KEYS = ["الجوال", "رقم الجوال", "الهاتف", "رقم الهاتف", "phone", "mobile", "tel"];
const EMAIL_KEYS = ["البريد", "البريد الإلكتروني", "الإيميل", "email", "e-mail", "mail"];

function pickStr(details: Record<string, unknown> | null, keys: string[]): string | null {
  if (!details) return null;
  for (const k of keys) {
    const v = (details as Record<string, unknown>)[k];
    // Also try case-insensitive match for Latin keys
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  // fallback case-insensitive search
  const lowerMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(details)) {
    lowerMap[k.toLowerCase()] = typeof v === "string" ? v.trim() : "";
  }
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase()];
    if (v && v.length > 0) return v;
  }
  return null;
}

function transformRow(raw: Record<string, unknown>): RequestRow {
  const details = (raw.details ?? raw.payload ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    type: String(raw.type ?? raw.request_type ?? "service"),
    title: raw.title ? String(raw.title) : null,
    details,
    status: String(raw.status ?? "new"),
    internal_notes: raw.internal_notes ? String(raw.internal_notes) : null,
    assigned_to: raw.assigned_to ? String(raw.assigned_to) : null,
    user_id: raw.user_id ? String(raw.user_id) : null,
    document_path: raw.document_path ? String(raw.document_path) : null,
    closed_at: raw.closed_at ? String(raw.closed_at) : null,
    spam_score: typeof raw.spam_score === "number" ? raw.spam_score : 0,
    is_spam: Boolean(raw.is_spam ?? false),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? String(raw.created_at ?? new Date().toISOString())),
    _name: pickStr(details, NAME_KEYS),
    _org: pickStr(details, ORG_KEYS),
    _phone: pickStr(details, PHONE_KEYS),
    _email: pickStr(details, EMAIL_KEYS),
  };
}

// دوال مساعدة لـ Timeline الملاحظات
function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return sec <= 10 ? "الآن" : `منذ ${sec} ثانية`;
  if (min < 60) return `منذ ${min} ${min === 1 ? "دقيقة" : min === 2 ? "دقيقتين" : min < 11 ? "دقائق" : "دقيقة"}`;
  if (hr < 24) return `منذ ${hr} ${hr === 1 ? "ساعة" : hr === 2 ? "ساعتين" : hr < 11 ? "ساعات" : "ساعة"}`;
  if (day < 7) return `منذ ${day} ${day === 1 ? "يوم" : day === 2 ? "يومين" : day < 11 ? "أيام" : "يوم"}`;
  return new Date(dateStr).toLocaleDateString("ar-SA", { day: "2-digit", month: "short", year: "2-digit" });
}

function initialsOf(name: string | null | undefined): string {
  const fallback = "؟";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (trimmed.length === 0) return fallback;
  // للأسماء العربية: أول حرفين من أول كلمةتين
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

const AVATAR_TONES = [
  "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
  "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300",
  "bg-primary/15 text-primary border-primary/30 dark:text-gold",
];
function avatarToneFor(seed: string | null | undefined) {
  if (!seed) return AVATAR_TONES[0];
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

// تجويد واجهة عرض محتوى details كـ Key/Value بدلاً من JSON خام
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function DetailsRenderer({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-xs text-muted-foreground">
        لا توجد تفاصيل إضافية مسجلة لهذا الطلب.
      </div>
    );
  }

  const entries = Object.entries(data);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => {
        // لو كانت قيمة Array (مثل الخدمات المطلوبة) — اعرضها شبهات Badges
        if (Array.isArray(value)) {
          return (
            <div key={key} className="sm:col-span-2 rounded-xl border border-border/60 bg-card/50 p-4">
              <div className="mb-2 text-xs font-bold text-muted-foreground">{key}</div>
              <div className="flex flex-wrap gap-2">
                {value.length === 0 && (
                  <span className="text-xs italic text-muted-foreground">—</span>
                )}
                {value.map((v, idx) => (
                  <Badge
                    key={`${key}-${idx}`}
                    variant="outline"
                    className="bg-background font-semibold"
                  >
                    {typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }

        // لو كانت كائن nested
        if (isPlainObject(value)) {
          return (
            <div key={key} className="sm:col-span-2 rounded-xl border border-border/60 bg-card/50 p-4">
              <div className="mb-2 text-xs font-bold text-muted-foreground">{key}</div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          );
        }

        // نص عادي
        const isUrl =
          typeof value === "string" &&
          (value.startsWith("http://") || value.startsWith("https://"));
        const isLong = typeof value === "string" && value.length > 80;

        return (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background/70 p-4 transition-colors hover:bg-card/70"
          >
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {key}
            </div>
            {isUrl ? (
              <a
                href={value as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 break-all text-sm font-semibold text-primary hover:underline dark:text-gold"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>فتح الرابط</span>
              </a>
            ) : isLong ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {String(value)}
              </p>
            ) : (
              <div className="text-sm font-bold">{String(value ?? "—")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // المرحلة 3: حالات الـ Timeline للملاحظات المتراكمة
  const [notes, setNotes] = useState<RequestNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as Record<string, unknown>[]).map((r) => transformRow(r)));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // تحديد المستخدم الحالي + دوره عند أول تحميل للصفحة
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        setUserUID(uid);
        if (uid) {
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid)
            .maybeSingle();
          setIsAdmin((roleRow?.role as string)?.toUpperCase() === "ADMIN");
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // 🔁 تحميل ملاحظات الطلب المختار من جدول request_notes
  const reloadNotes = useCallback(async (requestId: string) => {
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from("request_notes")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      setNotes(((data ?? []) as RequestNote[]));
    } catch (e) {
      toast.error("تعذر تحميل الملاحظات: " + (e instanceof Error ? e.message : ""));
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  // 🟢 useEffect: عند تغيير الطلب المختار → حمل ملاحظاته
  useEffect(() => {
    if (!selected) {
      setNotes([]);
      setNoteDraft("");
      return;
    }
    void reloadNotes(selected.id);
  }, [selected?.id, reloadNotes]);

  // ➕ إضافة ملاحظة جديدة في قاعدة البيانات
  const addNote = useCallback(async () => {
    const content = noteDraft.trim();
    if (!content) return;
    if (!selected) return;

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("يجب تسجيل الدخول أولاً");

      // جلب الاسم الكامل للكاتب من profiles أو user metadata
      let authorName = auth.user?.user_metadata?.full_name as string | undefined;
      if (!authorName || authorName.trim().length === 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, display_name, name")
          .eq("id", uid)
          .maybeSingle();
        authorName =
          (profile?.full_name as string) ||
          (profile?.display_name as string) ||
          (profile?.name as string) ||
          auth.user?.email ||
          "مستخدم الإدارة";
      }

      const { error } = await supabase.from("request_notes").insert({
        request_id: selected.id,
        author_id: uid,
        author_name: authorName,
        content,
      });
      if (error) throw new Error(error.message);

      setNoteDraft("");
      toast.success("تمت إضافة الملاحظة إلى سجل الطلب");
      void reloadNotes(selected.id);
    } catch (e) {
      toast.error("تعذر إضافة الملاحظة: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  }, [noteDraft, selected, reloadNotes]);

  // 🗑️ حذف ملاحظة (للكاتب أو لـ Admin فقط)
  const deleteNote = useCallback(async (noteId: string) => {
    if (!selected) return;
    const ok = window.confirm("هل أنت متأكد من حذف هذه الملاحظة؟ لا يمكن التراجع عن الحذف.");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("request_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw new Error(error.message);
      toast.success("تم حذف الملاحظة");
      void reloadNotes(selected.id);
    } catch (e) {
      toast.error("تعذر الحذف: " + (e instanceof Error ? e.message : ""));
    }
  }, [selected, reloadNotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.is_spam) return false;
      if (type !== "all" && r.type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q) {
        const blobParts = [
          r.title ?? "",
          r._name ?? "",
          r._org ?? "",
          r._email ?? "",
          r._phone ?? "",
          r.id,
          r.internal_notes ?? "",
        ];
        const blob = blobParts.join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, type, status, query]);

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id).then(
      () => toast.success("تم نسخ المعرف"),
      () => toast.error("تعذر النسخ")
    );
  };

  const openWhatsApp = (phone: string, name?: string | null) => {
    const cleaned = phone.replace(/[^\d+]/g, "");
    const withCode = cleaned.startsWith("+") ? cleaned : `+966${cleaned.replace(/^0+/, "")}`;
    const msg = encodeURIComponent(
      `السلام عليكم و رحمة الله و بركاته، نتواصل معكم من فريق أوبن لوب بخصوص طلب${name ? ` ${name}` : ""}.`
    );
    window.open(`https://wa.me/${withCode.replace("+", "")}?text=${msg}`, "_blank", "noopener");
  };

  const openMail = (email: string, subject?: string) => {
    window.open(
      `mailto:${email}?subject=${encodeURIComponent(subject ?? "مرجواً من فريق أوبن لوب")}`,
      "_blank",
      "noopener"
    );
  };

  const savePatch = async () => {
    if (!selected) return;
    const s = selected;
    setSaving(true);
    try {
      const patch: Partial<RequestRow> & Record<string, unknown> = {
        status: s.status,
        internal_notes: s.internal_notes,
      };
      const shouldClose =
        (s.status === "completed" || s.status === "rejected" || s.status === "cancelled") && !s.closed_at;
      if (shouldClose) {
        patch.closed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("requests")
        .update(patch)
        .eq("id", s.id);
      if (error) throw new Error(error.message);

      // تحديث الصفوف محلياً
      const mergedClosed = shouldClose ? patch.closed_at : s.closed_at;
      setRows((prev) =>
        prev.map((r) =>
          r.id === s.id
            ? {
                ...r,
                status: s.status,
                internal_notes: s.internal_notes,
                closed_at: mergedClosed as string | null,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );

      // إشعار العميل
      if (s.user_id && (dirty[s.id] || shouldClose)) {
        await notifyUser(
          s.user_id,
          `تحديث حالة الطلب #${s.id.slice(0, 6)}`,
          `تغيرت حالة طلب "${s.title || TYPE_LABEL[s.type] || "طلب"}" إلى: ${STATUS_LABEL[s.status]}${
            s.internal_notes ? `\n\nملاحظات الفريق: ${s.internal_notes.slice(0, 180)}` : ""
          }`,
          "/dashboard"
        );
        toast.success("تم حفظ التحديثات وإرسال إشعار للعميل");
      } else {
        toast.success("تم حفظ التحديثات");
      }

      setDirty((d) => ({ ...d, [s.id]: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error("تعذر الحفظ: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const saveJustNotes = async () => {
    if (!selected) return;
    const s = selected;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ internal_notes: s.internal_notes })
        .eq("id", s.id);
      if (error) throw new Error(error.message);
      setRows((prev) =>
        prev.map((r) =>
          r.id === s.id
            ? {
                ...r,
                internal_notes: s.internal_notes,
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );
      setDirty((d) => ({ ...d, [s.id]: false }));
      toast.success("تم حفظ الملاحظات الداخلية");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error("تعذر حفظ الملاحظات: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      filtered.map((r) => ({
        id: r.id,
        type: TYPE_LABEL[r.type] ?? r.type,
        title: r.title ?? "",
        status: STATUS_LABEL[r.status] ?? r.status,
        name: r._name ?? "",
        org: r._org ?? "",
        phone: r._phone ?? "",
        email: r._email ?? "",
        created_at: r.created_at,
        closed_at: r.closed_at ?? "",
        internal_notes: r.internal_notes ?? "",
      })),
      `openloop-requests-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast.success("تم تصدير الملف");
  };

  const statusIcon = (s: string) => {
    const I = (STATUS_ICON[s] ?? AlertCircle) as React.ComponentType<{ className?: string }>;
    return <I className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة الطلبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة جميع أنواع الطلبات (باقات، خدمات، إعاشة، عمل حر) مع إمكانية تغيير الحالة
            وكتابة ملاحظات داخلية واتصال مباشر بالعميل.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 font-bold">
            <FileText className="ml-1.5 h-3.5 w-3.5" />
            إجمالي الطلبات: {rows.length}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-700 dark:text-emerald-300"
          >
            {filtered.length} نتيجة في الفلتر الحالي
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="relative lg:col-span-5">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث في العنوان / اسم العميل / الجهة / البريد / الجوال / المعرّف..."
            className="pr-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="lg:col-span-3">
            <SelectValue placeholder="كل الأنواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="package">باقات</SelectItem>
            <SelectItem value="service">خدمات مخصصة</SelectItem>
            <SelectItem value="catering">إعاشة</SelectItem>
            <SelectItem value="freelancer">عمل حر</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 lg:col-span-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="inline-flex items-center gap-1.5">
                    {statusIcon(s)} {STATUS_LABEL[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} title="تصدير نتائج البحث إلى CSV">
            <Download className="h-4 w-4" />
            <span className="mr-1.5 hidden sm:inline">تصدير</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>العنوان / الملخص</TableHead>
                <TableHead>العميل والجهة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">التاريخ</TableHead>
                <TableHead className="w-[260px]">ملاحظات داخلية</TableHead>
                <TableHead className="w-[90px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    جارٍ التحميل...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm text-muted-foreground"
                  >
                    لا توجد طلبات مطابقة.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="group transition-colors hover:bg-muted/40">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border font-bold",
                          TYPE_TONE[r.type] ?? TYPE_TONE.service
                        )}
                      >
                        {TYPE_LABEL[r.type] ?? r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">
                      <div className="min-w-0 max-w-md truncate">
                        {r.title || `طلب ${TYPE_LABEL[r.type] ?? r.type}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-bold">{r._name || r.user_id?.slice(0, 8) || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r._org || "بدون جهة مسجلة"}
                      </div>
                      {(r._phone || r._email) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {r._phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {r._phone}
                            </span>
                          )}
                          {r._email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[160px]">{r._email}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                          STATUS_TONE[r.status] ?? STATUS_TONE.new
                        )}
                      >
                        {statusIcon(r.status)}
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">
                      <div>{new Date(r.created_at).toLocaleDateString("ar-SA")}</div>
                      <div className="opacity-70">
                        {new Date(r.created_at).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[260px]">
                        {r.internal_notes ? (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
                              <StickyNote className="h-3 w-3" />
                              ملاحظات فريق الإدارة
                            </div>
                            <p className="line-clamp-2 whitespace-pre-wrap leading-relaxed">
                              {r.internal_notes}
                            </p>
                          </div>
                        ) : (
                          <div className="text-[11px] italic text-muted-foreground opacity-70">
                            لا توجد ملاحظات
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(r)}
                        className="group-hover:bg-primary/10 group-hover:text-primary dark:group-hover:text-gold"
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
      </div>

      {/* Drawer التفاصيل المحسنة */}
      <Drawer open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="h-[92vh] max-w-none border-border/60 bg-background">
          {selected ? (
            <>
              <DrawerHeader className="border-b border-border/60 bg-muted/30">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border font-bold",
                          TYPE_TONE[selected.type] ?? TYPE_TONE.service
                        )}
                      >
                        {TYPE_LABEL[selected.type] ?? selected.type}
                      </Badge>
                      <Badge
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                          STATUS_TONE[selected.status] ?? STATUS_TONE.new
                        )}
                      >
                        {statusIcon(selected.status)}
                        {STATUS_LABEL[selected.status] ?? selected.status}
                      </Badge>
                      {selected.document_path && (
                        <Badge
                          variant="outline"
                          className="inline-flex items-center gap-1.5 border-primary/30 bg-primary/10 text-primary dark:text-gold"
                        >
                          <Paperclip className="h-3 w-3" />
                          يوجد ملف مرفق
                        </Badge>
                      )}
                      {selected.internal_notes && (
                        <Badge
                          variant="outline"
                          className="inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        >
                          <StickyNote className="h-3 w-3" />
                          يوجد ملاحظات داخلية
                        </Badge>
                      )}
                    </div>
                    <DrawerTitle className="!mt-2 text-2xl font-black sm:text-[28px]">
                      {selected.title ||
                        `طلب ${TYPE_LABEL[selected.type] ?? "غير مصنف"}`}
                    </DrawerTitle>
                    <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        أنشئ في {new Date(selected.created_at).toLocaleString("ar-SA")}
                      </span>
                      {selected.closed_at && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          أغلق في {new Date(selected.closed_at).toLocaleString("ar-SA")}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="inline-flex items-center gap-1.5 h-auto !py-1 text-xs"
                        onClick={() => copyId(selected.id)}
                      >
                        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          #{selected.id.slice(0, 10)}
                        </code>
                        <Copy className="h-3 w-3" />
                        نسخ المعرف
                      </Button>
                    </DrawerDescription>
                  </div>

                  {/* إجراءات سريعة للتواصل مع العميل */}
                  {(selected._phone || selected._email) && (
                    <div className="flex flex-wrap gap-2">
                      {selected._phone && (
                        <Button
                          variant="outline"
                          className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                          onClick={() => openWhatsApp(selected._phone!, selected._name)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>واتساب</span>
                        </Button>
                      )}
                      {selected._email && (
                        <Button
                          variant="outline"
                          className="gap-1.5 border-blue-500/30 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300"
                          onClick={() =>
                            openMail(
                              selected._email!,
                              `مرجواً من فريق أوبن لوب — طلب ${selected.id.slice(0, 6)}`
                            )
                          }
                        >
                          <Mail className="h-4 w-4" />
                          <span>بريد</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </DrawerHeader>

              <div className="mx-auto grid w-full max-w-4xl gap-6 overflow-auto px-4 py-6 pb-40">
                {/* البطاقة 1: بيانات العميل */}
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="inline-flex items-center gap-2 text-lg font-black">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-gold">
                        <User className="h-4 w-4" />
                      </div>
                      بيانات العميل والجهة
                    </h3>
                    {selected.user_id && (
                      <Badge variant="outline" className="font-mono text-[11px]">
                        UID: {selected.user_id.slice(0, 10)}…
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-background p-4">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <User className="h-3 w-3" />
                        الاسم الكامل
                      </div>
                      <div className="text-lg font-extrabold">
                        {selected._name || <span className="italic text-muted-foreground">—</span>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background p-4">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        الجهة / الجمعية
                      </div>
                      <div className="text-lg font-extrabold">
                        {selected._org || <span className="italic text-muted-foreground">—</span>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background p-4 sm:col-span-2 lg:col-span-1">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        رقم الجوال
                      </div>
                      {selected._phone ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-extrabold" dir="ltr">
                            {selected._phone}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                            onClick={() => openWhatsApp(selected._phone!, selected._name)}
                          >
                            <MessageSquare className="h-4 w-4" />
                            واتساب
                          </Button>
                        </div>
                      ) : (
                        <div className="italic text-muted-foreground">—</div>
                      )}
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-border/70 bg-background p-4">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        البريد الإلكتروني
                      </div>
                      {selected._email ? (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-lg font-extrabold break-all">
                            {selected._email}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300"
                            onClick={() =>
                              openMail(
                                selected._email!,
                                `مرجواً من فريق أوبن لوب — طلب ${selected.id.slice(0, 6)}`
                              )
                            }
                          >
                            <Mail className="h-4 w-4" />
                            إرسال بريد
                          </Button>
                        </div>
                      ) : (
                        <div className="italic text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                </section>

                {/* البطاقة 2: إدارة حالة الطلب */}
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      <Share2 className="h-4 w-4" />
                    </div>
                    إدارة حالة الطلب
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        الحالة الحالية
                      </Label>
                      <Select
                        value={selected.status}
                        onValueChange={(v) => {
                          setSelected({ ...selected, status: v });
                          setDirty((d) => ({ ...d, [selected.id]: true }));
                        }}
                      >
                        <SelectTrigger className="mt-1.5 h-11 font-bold text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className="inline-flex items-center gap-2">
                                {statusIcon(s)} {STATUS_LABEL[s]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        آخر تحديث
                      </Label>
                      <div className="mt-1.5 flex h-11 items-center rounded-md border border-border/70 bg-background px-3 text-sm">
                        <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {new Date(selected.updated_at || selected.created_at).toLocaleString(
                            "ar-SA"
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        المستند المرفق
                      </Label>
                      {selected.document_path ? (
                        <Button
                          variant="outline"
                          className="mt-1.5 h-11 w-full justify-start gap-2"
                          onClick={() => {
                            // بناء URL عام / خاص للملف
                            const { data } = supabase.storage
                              .from("documents")
                              .getPublicUrl(selected.document_path!);
                            if (data?.publicUrl) {
                              window.open(data.publicUrl, "_blank", "noopener");
                            } else {
                              toast.error("تعذر إنشاء رابط الملف");
                            }
                          }}
                        >
                          <Paperclip className="h-4 w-4" />
                          <span className="truncate font-bold">فتح الملف المرفق</span>
                          <ExternalLink className="ml-auto h-4 w-4 opacity-70" />
                        </Button>
                      ) : (
                        <div className="mt-1.5 flex h-11 items-center rounded-md border border-dashed border-border/70 bg-muted/30 px-3 text-xs italic text-muted-foreground">
                          لا يوجد ملف مرفق بهذا الطلب
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* البطاقة 3: تفاصيل محتوى الطلب (Rendered بدلاً من JSON) */}
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2 text-lg font-black">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300">
                      <FileText className="h-4 w-4" />
                    </div>
                    تفاصيل محتوى الطلب
                  </div>

                  <DetailsRenderer data={selected.details} />
                </section>

                <Separator className="my-1" />

                {/* المرحلة 3: الملاحظات الداخلية المتراكمة — Timeline Feed 🟢 */}
                <section className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-card/50 to-primary/5 p-5 shadow-[0_0_0_1px_rgba(99,102,241,0.08)_inset] sm:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-lg font-black text-indigo-800 dark:text-indigo-200">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      الملاحظات الداخلية المتراكمة
                      <Badge
                        variant="outline"
                        className="mr-2 border-indigo-500/40 bg-indigo-500/10 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
                      >
                        {notes.length} ملاحظة
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-dashed border-indigo-500/40 bg-indigo-500/5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300/80"
                      >
                        مرئية فقط للفريق الداخلي
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-indigo-500/30 bg-indigo-500/5 text-indigo-700 hover:bg-indigo-500/10 hover:text-indigo-800 dark:text-indigo-300"
                        onClick={() => selected && void reloadNotes(selected.id)}
                        disabled={notesLoading || !selected}
                        title="تحديث قائمة الملاحظات من قاعدة البيانات"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", notesLoading && "animate-spin")} />
                        <span className="text-[12px] font-bold">تحديث</span>
                      </Button>
                    </div>
                  </div>

                  {/* Timeline Feed: الملاحظات فوق بعض */}
                  <div className="space-y-4">
                    {notesLoading ? (
                      <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-6">
                        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-16 animate-pulse rounded-xl bg-muted" />
                        <div className="h-16 animate-pulse rounded-xl bg-muted" />
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div className="text-base font-extrabold text-indigo-800 dark:text-indigo-200">
                          لا توجد ملاحظات بعد على هذا الطلب
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          اكتب أول ملاحظة للفريق في الأسفل لتسجيل متابعة الطلب.
                        </div>
                      </div>
                    ) : (
                      <ol className="relative divide-y divide-dashed divide-border/60 border-r-2 border-indigo-500/20 pr-4 [&>li]:pt-4">
                        {notes.map((n, idx) => {
                          const tone = avatarToneFor(n.author_name ?? n.author_id ?? "");
                          const canDelete = isAdmin || (n.author_id && n.author_id === userUID);
                          return (
                            <li
                              key={n.id}
                              className="relative [&:not(:last-child)]:pb-4 first:pt-0"
                            >
                              {/* الدائرة على الخط */}
                              <span
                                className={cn(
                                  "absolute right-[-29px] top-[22px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-md ring-0",
                                  tone.split(" ").find((t) => t.startsWith("bg-")) ??
                                    "bg-primary"
                                )}
                              />

                              <div className="flex gap-3">
                                {/* الأفاتار */}
                                <div
                                  className={cn(
                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black",
                                    tone
                                  )}
                                >
                                  {initialsOf(n.author_name)}
                                </div>

                                {/* المحتوى */}
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                      <span className="font-extrabold text-foreground">
                                        {n.author_name || "مستخدم غير معروف"}
                                      </span>
                                      {idx === 0 && (
                                        <Badge
                                          variant="outline"
                                          className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                                        >
                                          الأحدث
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-semibold text-muted-foreground">
                                        {relativeTime(n.created_at)}
                                      </span>
                                      {canDelete && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => void deleteNote(n.id)}
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                          title="حذف الملاحظة"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                                    <p className="whitespace-pre-wrap text-[14px] leading-7 font-medium text-foreground/90">
                                      {n.content}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>

                  {/* ✉️ صندوق إضافة ملاحظة جديدة أسفل Timeline */}
                  <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Label
                        htmlFor="note_draft"
                        className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
                      >
                        إضافة ملاحظة جديدة إلى سجل الطلب
                      </Label>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {noteDraft.length} / 5000 حرف
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <Textarea
                        id="note_draft"
                        rows={4}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value.slice(0, 5000))}
                        onKeyDown={(e) => {
                          // Ctrl/Cmd + Enter → إرسال فوري
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            void addNote();
                          }
                        }}
                        placeholder="مثال: تم الاتصال بالعميل وتأكيد التفاصيل، سيتم إرسال عرض السعر غداً. تابع مع أحمد من قسم التصميم."
                        className="min-h-[100px] resize-y border-indigo-500/30 bg-background text-[14px] leading-relaxed shadow-inner focus-visible:ring-indigo-500/60"
                      />
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => void addNote()}
                        disabled={saving || noteDraft.trim().length === 0 || !selected}
                        className="shrink-0 gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                      >
                        <Send className={cn("h-4 w-4", saving && "animate-pulse")} />
                        <span className="font-extrabold">
                          {saving ? "جارِ الإرسال..." : "إرسال الملاحظة"}
                        </span>
                      </Button>
                    </div>
                    <p className="mt-2.5 text-[11px] text-muted-foreground">
                      💡 نصيحة: اذكر دائماً اسم الموظف المسؤول وتاريخ المتابعة والتحديث القادم حتى يستطيع زميلك متابعة الطلب بسلاسة. هذه الملاحظات لا تظهر للعميل أبداً — اختصار
                      <kbd className="mx-1 rounded-md border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                        Ctrl + Enter
                      </kbd>
                      للإرسال السريع.
                    </p>
                  </div>

                  {/* رسالة توضيحية للملاحظة القديمة (لو كانت موجودة فقط) */}
                  {selected?.internal_notes && notes.length > 0 && (
                    <div className="mt-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-800 dark:text-amber-200">
                      <span className="font-bold">ملاحظة نظام:</span> تم ترحيل الملاحظة القديمة الواحدة التي كانت موجودة على الطلب كأول سجل في قائمة الملاحظات أعلاه. تستطيع إضافة ملاحظات جديدة في الأسفل وسيتم حفظها فوق بعضها.
                    </div>
                  )}
                </section>
              </div>

              {/* Footer ضخم مع حفظ نهائي */}
              <DrawerFooter className="border-t border-border/60 bg-muted/40 px-4 py-4 sm:px-6 sm:py-5">
                <div className="mx-auto flex w-full max-w-4xl flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="text-xs text-muted-foreground">
                    {dirty[selected.id] ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        يوجد تعديلات لم يتم حفظها بعد — اضغط زر حفظ التحديثات الكاملة.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        كل التحديثات محفوظة
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <DrawerClose asChild>
                      <Button variant="outline" size="lg">
                        إغلاق
                      </Button>
                    </DrawerClose>
                    <Button
                      size="lg"
                      className="gap-2 rounded-xl px-6"
                      onClick={savePatch}
                      disabled={saving}
                    >
                      <Save className="h-4.5 w-4.5" />
                      <span className="font-extrabold">
                        {saving ? "جارٍ الحفظ..." : "حفظ التحديثات الكاملة"}
                      </span>
                    </Button>
                  </div>
                </div>
              </DrawerFooter>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
