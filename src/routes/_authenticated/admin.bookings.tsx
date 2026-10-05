import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  FileText,
  Eye,
  Paperclip,
  Calendar,
  Clock,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  StickyNote,
  CheckCircle2,
  AlertCircle,
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
import {
  BOOKING_STATUSES,
  updateBookingStatus,
  updateBookingInternal,
  type BookingRow,
} from "@/lib/bookings";
import {
  CustomerInfoGrid,
  SectionHeader,
  InfoTile,
  DetailsRenderer,
  AttachmentButton,
  DrawerSaveFooter,
  copyId,
  openWhatsApp,
  openMail,
} from "@/components/unified/DetailPrimitives";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: AdminBookingsPage,
});

const BOOKING_STATUS_ICON: Record<string, unknown> = {
  new: AlertCircle,
  in_review: Clock,
  contacted: MessageSquare,
  scheduled: Calendar,
  completed: CheckCircle2,
  rejected: AlertCircle,
};

function statusIcon(s: string) {
  const I = (BOOKING_STATUS_ICON[s] ?? AlertCircle) as React.ComponentType<{ className?: string }>;
  return <I className="h-3.5 w-3.5" />;
}

function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as BookingRow[]).filter((r) => !r.is_spam));
    setLoading(false);
  };
  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q) {
        const blob =
          `${r.full_name} ${r.entity_name ?? ""} ${r.email} ${r.phone} ${r.service_category ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, query]);

  const savePatch = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateBookingStatus(selected.id, selected.status);
      await updateBookingInternal(selected.id, {
        internal_notes: selected.internal_notes,
        assigned_to: selected.assigned_to,
      } as Partial<BookingRow>);
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, status: selected.status, internal_notes: selected.internal_notes }
            : r
        )
      );
      toast.success("تم حفظ التحديثات");
      setDirty((d) => ({ ...d, [selected.id]: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      filtered.map((r) => ({
        id: r.id,
        name: r.full_name,
        entity: r.entity_name ?? "",
        email: r.email,
        phone: r.phone,
        category: r.service_category ?? "",
        status: BOOKING_STATUSES[r.status]?.label ?? r.status,
        note: r.note ?? "",
        created_at: r.created_at,
      })),
      [
        { key: "id", label: "المعرف" },
        { key: "name", label: "الاسم الكامل" },
        { key: "entity", label: "الجهة" },
        { key: "email", label: "البريد" },
        { key: "phone", label: "الجوال" },
        { key: "category", label: "مجال الاستشارة" },
        { key: "status", label: "الحالة" },
        { key: "note", label: "ملاحظة العميل" },
        { key: "created_at", label: "تاريخ الإنشاء" },
      ],
      `openloop-bookings-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast.success("تم تصدير الملف");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">حجوزات الاستشارات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة حجوزات الاستشارات الواردة من نموذج احجز استشارتك.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 font-bold">
            <FileText className="ml-1.5 h-3.5 w-3.5" />
            إجمالي الحجوزات: {rows.length}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو البريد أو الجوال أو الجهة..."
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 lg:col-span-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(BOOKING_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className="inline-flex items-center gap-2">
                    {statusIcon(k)} {v.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>مجال الاستشارة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">التاريخ</TableHead>
                <TableHead className="w-[90px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    جارٍ التحميل...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    لا توجد حجوزات مطابقة.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="group transition-colors hover:bg-muted/40">
                    <TableCell>
                      <div className="font-bold">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.email} • {r.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.entity_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.service_category || "استشارة عامة"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                          BOOKING_STATUSES[r.status]?.tone ??
                            "bg-primary/15 text-primary dark:text-gold"
                        )}
                      >
                        {statusIcon(r.status)}
                        {BOOKING_STATUSES[r.status]?.label ?? r.status}
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

      {/* Drawer الموحد بنفس نمط عرض الطلبات */}
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
                        className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold"
                      >
                        حجز استشارة
                      </Badge>
                      <Badge
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-bold",
                          BOOKING_STATUSES[selected.status]?.tone ??
                            "bg-primary/15 text-primary dark:text-gold"
                        )}
                      >
                        {statusIcon(selected.status)}
                        {BOOKING_STATUSES[selected.status]?.label ?? selected.status}
                      </Badge>
                      {selected.attachment_path && (
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
                      {selected.service_category
                        ? `استشارة: ${selected.service_category}`
                        : `حجز استشارة عامة`}
                    </DrawerTitle>
                    <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        وصل في {new Date(selected.created_at).toLocaleString("ar-SA")}
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                      onClick={() => openWhatsApp(selected.phone, selected.full_name, `السلام عليكم و رحمة الله و بركاته، نتواصل معكم من فريق أوبن لوب بخصوص حجز الاستشارة الخاص بكم (#${selected.id.slice(0,6)}).`)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>واتساب</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5 border-blue-500/30 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300"
                      onClick={() =>
                        openMail(
                          selected.email,
                          `مرجواً من فريق أوبن لوب — حجز استشارة #${selected.id.slice(0, 6)}`
                        )
                      }
                    >
                      <Mail className="h-4 w-4" />
                      <span>بريد</span>
                    </Button>
                  </div>
                </div>
              </DrawerHeader>

              <div className="mx-auto grid w-full max-w-4xl gap-6 overflow-auto px-4 py-6 pb-40">
                {/* بطاقة بيانات العميل */}
                <CustomerInfoGrid
                  name={selected.full_name}
                  org={selected.entity_name || undefined}
                  phone={{
                    value: <span dir="ltr">{selected.phone}</span>,
                    onClick: () =>
                      openWhatsApp(selected.phone, selected.full_name, `السلام عليكم و رحمة الله و بركاته، نتواصل معكم من فريق أوبن لوب بخصوص حجز الاستشارة الخاص بكم (#${selected.id.slice(0,6)}).`),
                  }}
                  email={{
                    value: <span dir="ltr">{selected.email}</span>,
                    onClick: () =>
                      openMail(
                        selected.email,
                        `مرجواً من فريق أوبن لوب — حجز استشارة #${selected.id.slice(0, 6)}`
                      ),
                  }}
                  uid={selected.user_id}
                />

                {/* بطاقة إدارة حالة الحجز */}
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                  <SectionHeader
                    icon={Share2}
                    title="إدارة حالة الحجز"
                    tone="bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  />
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
                          {Object.entries(BOOKING_STATUSES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              <span className="inline-flex items-center gap-2">
                                {statusIcon(k)} {v.label}
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
                          {new Date(selected.created_at).toLocaleString("ar-SA")}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        المستند المرفق
                      </Label>
                      <AttachmentButton
                        documentPath={selected.attachment_path}
                        bucket="documents"
                        emptyLabel="لا يوجد ملف مرفق بهذا الحجز"
                      />
                    </div>
                  </div>
                </section>

                {/* بطاقة تفاصيل الحجز */}
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
                  <SectionHeader
                    icon={FileText}
                    title="تفاصيل محتوى الحجز"
                    tone="bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  />
                  <DetailsRenderer
                    data={{
                      "مجال الاستشارة": selected.service_category || "استشارة عامة",
                      "تفاصيل الاحتياج": selected.note || "—",
                    }}
                  />
                </section>

                <Separator className="my-1" />

                {/* الملاحظات الداخلية */}
                <section className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-card/50 to-primary/5 p-5 shadow-[0_0_0_1px_rgba(99,102,241,0.08)_inset] sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-lg font-black text-indigo-800 dark:text-indigo-200">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                        <StickyNote className="h-4 w-4" />
                      </div>
                      الملاحظات الداخلية
                      <Badge
                        variant="outline"
                        className="border-dashed border-indigo-500/40 bg-indigo-500/5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300/80"
                      >
                        مرئية فقط للفريق الداخلي
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor="b_internal_notes"
                      className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
                    >
                      ملاحظات الفريق حول هذا الحجز
                    </Label>
                    <Textarea
                      id="b_internal_notes"
                      rows={6}
                      value={selected.internal_notes ?? ""}
                      onChange={(e) => {
                        setSelected({ ...selected, internal_notes: e.target.value });
                        setDirty((d) => ({ ...d, [selected.id]: true }));
                      }}
                      placeholder="مثال: تم الاتصال بالعميل وتحديد موعد الاستشارة يوم الأحد القادم الساعة 4 عصراً عبر Zoom. سيقوم بإرسال المواد المطلوبة قبل الموعد بيوم."
                      className="mt-2 min-h-[140px] resize-y border-indigo-500/30 bg-background text-[14px] leading-relaxed shadow-inner focus-visible:ring-indigo-500/60"
                    />
                    <p className="mt-2.5 text-[11px] text-muted-foreground">
                      💡 اذكر دائماً اسم الموظف المسؤول وتاريخ الموعد وطريقة الاتصال حتى يستطيع زميلك متابعة الحجز بسلاسة. هذه الملاحظات لا تظهر للعميل أبداً.
                    </p>
                  </div>
                </section>
              </div>

              <DrawerSaveFooter
                dirty={dirty[selected.id]}
                saving={saving}
                onSave={savePatch}
                dirtyText="يوجد تعديلات لم يتم حفظها بعد — اضغط زر حفظ التحديثات الكاملة."
                saveText="حفظ التحديثات الكاملة"
                savingText="جارٍ الحفظ..."
              />
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
