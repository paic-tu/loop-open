import type { ReactNode, ComponentType } from "react";
import { useCallback, useState } from "react";
import {
  ExternalLink,
  Paperclip,
  Clock,
  User,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  Send,
  Trash2,
  RefreshCw,
  UserRound,
  Copy,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const AVATAR_TONES = [
  "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
  "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300",
  "bg-primary/15 text-primary border-primary/30 dark:text-gold",
];

export function avatarToneFor(seed: string | null | undefined) {
  if (!seed) return AVATAR_TONES[0];
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return sec <= 10 ? "الآن" : `منذ ${sec} ثانية`;
  if (min < 60)
    return `منذ ${min} ${min === 1 ? "دقيقة" : min === 2 ? "دقيقتين" : min < 11 ? "دقائق" : "دقيقة"}`;
  if (hr < 24)
    return `منذ ${hr} ${hr === 1 ? "ساعة" : hr === 2 ? "ساعتين" : hr < 11 ? "ساعات" : "ساعة"}`;
  if (day < 7)
    return `منذ ${day} ${day === 1 ? "يوم" : day === 2 ? "يومين" : day < 11 ? "أيام" : "يوم"}`;
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function initialsOf(name: string | null | undefined): string {
  const fallback = "؟";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (trimmed.length === 0) return fallback;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function DetailsRenderer({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-xs text-muted-foreground">
        لا توجد تفاصيل إضافية مسجلة.
      </div>
    );
  }
  const entries = Object.entries(data);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => {
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
                    {typeof v === "string" || typeof v === "number"
                      ? String(v)
                      : JSON.stringify(v)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{String(value)}</p>
            ) : (
              <div className="text-sm font-bold">{String(value ?? "—")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type NoteItem = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

export function NotesTimelineFeed({
  notes,
  loading,
  canDeleteNote,
  onDelete,
  onRefresh,
  emptyTitle = "لا توجد ملاحظات بعد",
  emptyHint = "اكتب أول ملاحظة للفريق لتسجيل المتابعة.",
}: {
  notes: NoteItem[];
  loading?: boolean;
  canDeleteNote?: (n: NoteItem) => boolean;
  onDelete?: (id: string) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-4">
      {loading ? (
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
            {emptyTitle}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">{emptyHint}</div>
        </div>
      ) : (
        <ol className="relative divide-y divide-dashed divide-border/60 border-r-2 border-indigo-500/20 pr-4 [&>li]:pt-4">
          {notes.map((n, idx) => {
            const tone = avatarToneFor(n.author_name ?? n.author_id ?? "");
            const canDel = !canDeleteNote ? false : canDeleteNote(n);
            return (
              <li
                key={n.id}
                className="relative [&:not(:last-child)]:pb-4 first:pt-0"
              >
                <span
                  className={cn(
                    "absolute right-[-29px] top-[22px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-md ring-0",
                    tone.split(" ").find((t) => t.startsWith("bg-")) ?? "bg-primary"
                  )}
                />
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black",
                      tone
                    )}
                  >
                    {initialsOf(n.author_name)}
                  </div>
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
                        {onRefresh && idx === 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void onRefresh()}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10"
                            title="تحديث"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDel && onDelete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void onDelete(n.id)}
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
  );
}

export function AddNoteBox({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  maxLength = 5000,
  hint = "💡 اذكر دائماً اسم الموظف المسؤول وتاريخ المتابعة. Ctrl + Enter للإرسال السريع.",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void | Promise<void>;
  sending?: boolean;
  disabled?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <Label
          htmlFor="unified_note_draft"
          className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
        >
          إضافة ملاحظة جديدة إلى السجل
        </Label>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {value.length} / {maxLength} حرف
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Textarea
          id="unified_note_draft"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder="اكتب ملاحظتك هنا..."
          className="min-h-[100px] resize-y border-indigo-500/30 bg-background text-[14px] leading-relaxed shadow-inner focus-visible:ring-indigo-500/60"
          disabled={disabled}
        />
        <Button
          type="button"
          size="lg"
          onClick={() => void onSend()}
          disabled={sending || value.trim().length === 0 || disabled}
          className="shrink-0 gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Send className={cn("h-4 w-4", sending && "animate-pulse")} />
          <span className="font-extrabold">{sending ? "جارِ الإرسال..." : "إرسال الملاحظة"}</span>
        </Button>
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function copyId(id: string) {
  navigator.clipboard?.writeText(id).then(
    () => toast.success("تم نسخ المعرف"),
    () => toast.error("تعذر النسخ")
  );
}

export function openWhatsApp(phone: string, name?: string | null, customMessage?: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const withCode = cleaned.startsWith("+") ? cleaned : `+966${cleaned.replace(/^0+/, "")}`;
  const msg = encodeURIComponent(
    customMessage ??
      `السلام عليكم و رحمة الله و بركاته، نتواصل معكم من فريق أوبن لوب بخصوص ${name ? `طلب ${name}` : "طلبكم"}.`
  );
  window.open(`https://wa.me/${withCode.replace("+", "")}?text=${msg}`, "_blank", "noopener");
}

export function openMail(email: string, subject?: string) {
  window.open(
    `mailto:${email}?subject=${encodeURIComponent(subject ?? "مرجواً من فريق أوبن لوب")}`,
    "_blank",
    "noopener"
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  tone = "bg-primary/10 text-primary dark:text-gold",
  extra,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  tone?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="inline-flex items-center gap-2 text-lg font-black">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {title}
      </h3>
      {extra}
    </div>
  );
}

export function InfoTile({
  icon: Icon,
  label,
  value,
  valueDir,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  valueDir?: "ltr" | "rtl";
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {action ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className={cn(
              "text-lg font-extrabold break-all",
              valueDir === "ltr" && "dir-ltr text-left"
            )}
          >
            {value}
          </div>
          {action}
        </div>
      ) : (
        <div
          className={cn(
            "text-lg font-extrabold break-all",
            valueDir === "ltr" && "dir-ltr text-left"
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}

export function CustomerInfoGrid({
  name,
  org,
  phone,
  email,
  uid,
  onWhatsApp,
  onMail,
}: {
  name: ReactNode;
  org?: ReactNode;
  phone?: { value: ReactNode; onClick?: () => void };
  email?: { value: ReactNode; onClick?: () => void };
  uid?: string | null;
  onWhatsApp?: () => void;
  onMail?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <SectionHeader
        icon={User}
        title="بيانات العميل والجهة"
        extra={
          uid ? (
            <Badge variant="outline" className="font-mono text-[11px]">
              UID: {uid.slice(0, 10)}…
            </Badge>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile icon={User} label="الاسم الكامل" value={name} />
        <InfoTile icon={Building2} label="الجهة / الجمعية" value={org ?? <span className="italic text-muted-foreground">—</span>} />
        {phone && (
          <InfoTile
            icon={Phone}
            label="رقم الجوال"
            value={phone.value}
            valueDir="ltr"
            action={
              phone.onClick ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                  onClick={phone.onClick}
                >
                  <MessageSquare className="h-4 w-4" />
                  واتساب
                </Button>
              ) : onWhatsApp ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300"
                  onClick={onWhatsApp}
                >
                  <MessageSquare className="h-4 w-4" />
                  واتساب
                </Button>
              ) : undefined
            }
          />
        )}
        {email && (
          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-border/70 bg-background p-4">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Mail className="h-3 w-3" />
              البريد الإلكتروني
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-lg font-extrabold break-all">{email.value}</div>
              {email.onClick || onMail ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-blue-700 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300"
                  onClick={email.onClick ?? onMail}
                >
                  <Mail className="h-4 w-4" />
                  إرسال بريد
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function AttachmentButton({
  documentPath,
  bucket = "documents",
  emptyLabel = "لا يوجد ملف مرفق بهذا الطلب",
}: {
  documentPath: string | null;
  bucket?: string;
  emptyLabel?: string;
}) {
  if (!documentPath)
    return (
      <div className="mt-1.5 flex h-11 items-center rounded-md border border-dashed border-border/70 bg-muted/30 px-3 text-xs italic text-muted-foreground">
        {emptyLabel}
      </div>
    );
  return (
    <Button
      variant="outline"
      className="mt-1.5 h-11 w-full justify-start gap-2"
      onClick={() => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(documentPath!);
        if (data?.publicUrl) window.open(data.publicUrl, "_blank", "noopener");
        else toast.error("تعذر إنشاء رابط الملف");
      }}
    >
      <Paperclip className="h-4 w-4" />
      <span className="truncate font-bold">فتح الملف المرفق</span>
      <ExternalLink className="ml-auto h-4 w-4 opacity-70" />
    </Button>
  );
}

export function DrawerSaveFooter({
  dirty,
  saving,
  onSave,
  dirtyText = "يوجد تعديلات لم يتم حفظها بعد — اضغط زر حفظ التحديثات الكاملة.",
  savedText = "كل التحديثات محفوظة",
  saveText = "حفظ التحديثات الكاملة",
  savingText = "جارٍ الحفظ...",
}: {
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void | Promise<void>;
  dirtyText?: string;
  savedText?: string;
  saveText?: string;
  savingText?: string;
}) {
  return (
    <DrawerFooter className="border-t border-border/60 bg-muted/40 px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold">
              <AlertCircle className="h-3.5 w-3.5" />
              {dirtyText}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {savedText}
            </span>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DrawerClose asChild>
            <Button variant="outline" size="lg">
              إغلاق
            </Button>
          </DrawerClose>
          {onSave && (
            <Button
              size="lg"
              className="gap-2 rounded-xl px-6"
              onClick={() => void onSave()}
              disabled={saving}
            >
              <Save className="h-4.5 w-4.5" />
              <span className="font-extrabold">{saving ? savingText : saveText}</span>
            </Button>
          )}
        </div>
      </div>
    </DrawerFooter>
  );
}

export function UnifiedDrawerShell({
  open,
  onClose,
  children,
  maxH = "h-[92vh]",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxH?: string;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        className={cn(
          "max-w-none border-border/60 bg-background",
          maxH === "h-[92vh]" ? "h-[92vh]" : maxH
        )}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}
