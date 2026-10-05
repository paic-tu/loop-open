import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { TermsAgreement } from "@/components/CommunityTerms";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { REGIONS } from "@/lib/community";
import {
  ENTITY_KINDS,
  RFQ_CATEGORIES,
  fetchMySupplier,
  fetchRfqs,
  formatDeadline,
  isExpired,
  logAudit,
  logTermsAcceptance,
  useFormDraft,
  type Rfq,
} from "@/lib/marketplace";

const selectClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 px-3 text-sm font-semibold";

const quoteSchema = z.object({
  supplier_name: z.string().trim().min(3, "اسم المنشأة مطلوب").max(160),
  amount: z.string().trim().min(1, "قيمة العرض مطلوبة").max(60),
  duration: z.string().trim().max(80).optional(),
  contact: z.string().trim().min(5, "وسيلة تواصل مطلوبة").max(160),
  note: z.string().trim().max(1000).optional(),
});

export function RfqBoard() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [kind, setKind] = useState("");
  const [active, setActive] = useState<Rfq | null>(null);

  const rfqs = useQuery({ queryKey: ["rfqs"], queryFn: fetchRfqs });
  const supplier = useQuery({
    queryKey: ["supplier", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchMySupplier(user!.id),
  });
  const canQuote = supplier.data?.status === "approved";

  const list = useMemo(() => {
    const term = q.trim();
    return (rfqs.data ?? []).filter(
      (r) =>
        (!category || r.category === category) &&
        (!region || r.region === region) &&
        (!kind || r.entity_kind === kind) &&
        (!term || r.title.includes(term) || r.entity_name.includes(term))
    );
  }, [rfqs.data, q, category, region, kind]);

  return (
    <div>
      {user && !supplier.isLoading && !canQuote && (
        <p className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-bold leading-relaxed text-amber-700 dark:text-amber-300">
          {supplier.data
            ? "ملف مقدم الخدمة / المورد الخاص بك قيد المراجعة من إدارة المنصة — سيتاح تقديم العروض فور الاعتماد."
            : "سجّل منشأتك كمقدم خدمة / مورد معتمد أولاً ليتاح لك تقديم عروض الأسعار."}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white grid gap-4 p-5 md:grid-cols-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بعنوان الفرصة أو الجهة"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">كل التصنيفات</option>
          {RFQ_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass}>
          <option value="">كل المناطق</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
          <option value="">كل أنواع أصحاب المشاريع</option>
          {ENTITY_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {rfqs.isLoading ? (
        <p className="mt-8 text-sm text-slate-500">جارٍ تحميل الفرص...</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white mt-8 p-10 text-center">
          <p className="text-sm font-bold">لا توجد فرص مطابقة حالياً</p>
          <p className="mt-2 text-xs text-slate-500">
            تابع اللوحة باستمرار، أو اطرح طلب عرض سعر جديد إن كانت جهتك معتمدة.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((rfq) => {
            const expired = isExpired(rfq.deadline);
            return (
              <article
                key={rfq.id}
                className="rounded-2xl border border-slate-200 bg-white flex flex-col p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-extrabold text-slate-600">
                    {rfq.category}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${
                      expired
                        ? "bg-destructive/20 text-destructive"
                        : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {expired ? "منتهية" : "مفتوحة للعروض"}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-extrabold leading-relaxed">{rfq.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">
                  {rfq.description}
                </p>
                <dl className="mt-4 space-y-2 text-xs font-bold text-slate-500">
                  <div>
                    <span>{rfq.entity_name} — {rfq.entity_kind}</span>
                  </div>
                  {rfq.region && (
                    <div>
                      <span>{rfq.region}{rfq.city ? ` — ${rfq.city}` : ""}</span>
                    </div>
                  )}
                  <div>
                    <span>ينتهي التقديم: {formatDeadline(rfq.deadline)}</span>
                  </div>
                </dl>
                <Button
                  className="mt-6 w-full rounded-full font-bold"
                  onClick={() => setActive(rfq)}
                  disabled={!user || expired || !canQuote}
                >
                  {expired ? "انتهت مدة التقديم" : "تقديم عرض سعر"}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <QuoteDialog rfq={active} onClose={() => setActive(null)} />
    </div>
  );
}

function QuoteDialog({ rfq, onClose }: { rfq: Rfq | null; onClose: () => void }) {
  const { user } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const { draft, save, clear } = useFormDraft("quote");

  const submit = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      save(form);
      if (!agree) {
        setErrors((prev) => ({ ...prev, terms: "يجب الموافقة على الشروط والأحكام" }));
        throw new Error("validation");
      }
      const fd = new FormData(form);
      const parsed = quoteSchema.safeParse({
        supplier_name: String(fd.get("supplier_name") ?? ""),
        amount: String(fd.get("amount") ?? ""),
        duration: String(fd.get("duration") ?? ""),
        contact: String(fd.get("contact") ?? ""),
        note: String(fd.get("note") ?? ""),
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
        setErrors(next);
        throw new Error("validation");
      }
      setErrors({});
      const { data, error } = await supabase
        .from("rfq_quotes")
        .insert({
          rfq_id: rfq!.id,
          supplier_id: user!.id,
          user_id: user!.id,
          supplier_name: parsed.data.supplier_name,
          amount: parsed.data.amount,
          duration: parsed.data.duration ?? "",
          contact: parsed.data.contact,
          note: parsed.data.note ?? "",
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      try {
        await logTermsAcceptance({
          userId: user!.id,
          acceptanceType: "quote",
          relatedAction: "quote.submitted",
          relatedId: data?.id ?? null,
        });
      } catch (_e) { /* ثانوي — لا يمنع النجاح */ }
      try {
        await logAudit({
          actorId: user!.id,
          action: "quote.submitted",
          entityType: "quote",
          entityId: data?.id ?? null,
          meta: { rfq_id: rfq!.id },
        });
      } catch (_e) { /* ثانوي — لا يمنع النجاح */ }
    },
    onSuccess: () => {
      toast.success("تم إرسال عرض السعر إلى صاحب المشروع");
      clear();
      setAgree(false);
      onClose();
    },
    onError: (e: Error) => {
      if (e.message !== "validation") {
        toast.error("تعذر إرسال العرض — تم حفظ بياناتك مؤقتاً، حاول مرة أخرى");
      }
    },
  });

  return (
    <Dialog open={Boolean(rfq)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تقديم عرض سعر</DialogTitle>
          <DialogDescription>{rfq?.title}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(e.currentTarget);
          }}
        >
          <FormField label="اسم مقدم الخدمة / المورد" error={errors["supplier_name"]}>
            <Input name="supplier_name" defaultValue={draft["supplier_name"] ?? ""} maxLength={160} />
          </FormField>
          <FormField label="قيمة العرض (ريال)" error={errors["amount"]}>
            <Input name="amount" inputMode="numeric" defaultValue={draft["amount"] ?? ""} maxLength={60} />
          </FormField>
          <FormField label="مدة التنفيذ" error={errors["duration"]}>
            <Input name="duration" defaultValue={draft["duration"] ?? ""} maxLength={80} placeholder="مثال: 21 يوم عمل" />
          </FormField>
          <FormField label="وسيلة التواصل (تظهر لصاحب المشروع فقط)" error={errors["contact"]}>
            <Input name="contact" dir="ltr" defaultValue={draft["contact"] ?? ""} maxLength={160} />
          </FormField>
          <FormField label="تفاصيل العرض" error={errors["note"]}>
            <Textarea name="note" rows={4} defaultValue={draft["note"] ?? ""} maxLength={1000} />
          </FormField>
          <TermsAgreement
            checked={agree}
            onChange={(v) => {
              setAgree(v);
              if (v) setErrors((prev) => ({ ...prev, terms: "" }));
            }}
            error={errors["terms"]}
          />
          <Button type="submit" disabled={submit.isPending} className="rounded-full font-bold">
            {submit.isPending ? "جارٍ الإرسال..." : "إرسال العرض"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-bold">{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}
