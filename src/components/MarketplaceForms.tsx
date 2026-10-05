import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/RfqBoard";
import { TermsAgreement } from "@/components/CommunityTerms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { REGIONS, fetchMyEntity } from "@/lib/community";
import {
  ENTITY_KINDS,
  RFQ_CATEGORIES,
  SECTORS,
  fetchMySupplier,
  logAudit,
  logTermsAcceptance,
  useFormDraft,
} from "@/lib/marketplace";

const selectClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 px-3 text-sm font-semibold";

const SUPPLIER_DOC_MAX_MB = 10;
const SUPPLIER_DOC_ACCEPT = ".pdf,image/*";

const supplierSchema = z.object({
  company_name: z.string().trim().min(3, "اسم المنشأة مطلوب").max(160),
  cr_number: z.string().regex(/^[0-9]{10}$/, "السجل التجاري يجب أن يكون 10 أرقام"),
  category: z.string().min(1, "اختر التصنيف"),
  region: z.string().min(1, "اختر المنطقة"),
  contact_name: z.string().trim().min(3, "اسم المسؤول مطلوب").max(120),
  email: z.string().trim().email("بريد إلكتروني غير صحيح").max(200),
  phone: z.string().trim().regex(/^0?5[0-9]{8}$/, "رقم جوال سعودي غير صحيح"),
  about: z.string().trim().max(1000).optional(),
});

const rfqSchema = z.object({
  title: z.string().trim().min(5, "عنوان الفرصة مطلوب").max(160),
  category: z.string().min(1, "اختر تصنيف المشتريات"),
  entity_name: z.string().trim().min(3, "اسم صاحب المشروع مطلوب").max(160),
  entity_kind: z.string().min(1, "اختر نوع الجهة"),
  region: z.string().min(1, "اختر المنطقة"),
  city: z.string().trim().min(2, "أدخل المدينة").max(80),
  sector: z.string().min(1, "اختر القطاع"),
  deadline: z.string().min(1, "حدد تاريخ انتهاء التقديم"),
  budget: z.string().trim().max(80).optional(),
  description: z.string().trim().min(20, "أضف وصفاً لا يقل عن 20 حرفاً").max(2000),
});


export type MarketplaceTab = "rfq" | "supplier";

export function MarketplaceForms({
  tab,
  onTabChange,
}: {
  tab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
}) {
  return (
    <div>
      <div className="mx-auto flex w-fit gap-2 rounded-full bg-secondary/70 p-1.5">
        <TabButton active={tab === "rfq"} onClick={() => onTabChange("rfq")}>
          طرح طلب عرض سعر
        </TabButton>
        <TabButton active={tab === "supplier"} onClick={() => onTabChange("supplier")}>
          التسجيل كمقدم خدمة / مورد
        </TabButton>
      </div>
      <div className="mt-8">{tab === "rfq" ? <RfqForm /> : <SupplierForm />}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition ${
        active ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RfqForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const { draft, save, clear } = useFormDraft("rfq");
  const [requiresReview, setRequiresReview] = useState(false);

  useEffect(() => {
    setRequiresReview(draft["requires_openloop_review"] === "true");
  }, [draft]);

  const entity = useQuery({
    queryKey: ["community-entity", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchMyEntity(user!.id),
  });
  const approved = Boolean(entity.data?.is_verified);

  const submit = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      save(form);
      if (!agree) {
        setErrors((prev) => ({ ...prev, terms: "يجب الموافقة على الشروط والأحكام" }));
        throw new Error("validation");
      }
      const fd = new FormData(form);
      const parsed = rfqSchema.safeParse({
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? ""),
        entity_name: String(fd.get("entity_name") ?? ""),
        entity_kind: String(fd.get("entity_kind") ?? ""),
        region: String(fd.get("region") ?? ""),
        city: String(fd.get("city") ?? ""),
        sector: String(fd.get("sector") ?? ""),
        deadline: String(fd.get("deadline") ?? ""),
        budget: String(fd.get("budget") ?? ""),
        description: String(fd.get("description") ?? ""),
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
        setErrors(next);
        throw new Error("validation");
      }
      setErrors({});
      const { data, error } = await supabase
        .from("rfqs")
        .insert({
          ...parsed.data,
          budget: parsed.data.budget || null,
          description: parsed.data.description,
          owner_id: user!.id,
          requires_openloop_review: fd.get("requires_openloop_review") === "true",
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      await logTermsAcceptance({
        userId: user!.id,
        acceptanceType: "rfq",
        relatedAction: "rfq.created",
        relatedId: data?.id ?? null,
      });
      await logAudit({
        actorId: user!.id,
        action: "rfq.created",
        entityType: "rfq",
        entityId: data?.id ?? null,
        meta: { title: parsed.data.title, requires_openloop_review: requiresReview },
      });
      form.reset();
    },
    onSuccess: () => {
      toast.success("تم إرسال الفرصة لاعتماد الإدارة قبل نشرها في اللوحة");
      clear();
      setAgree(false);
      setRequiresReview(false);
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["my-rfqs", user?.id] });
    },
    onError: (e: Error) => {
      if (e.message !== "validation") {
        toast.error("تعذر النشر — تم حفظ بياناتك مؤقتاً، تأكد من اعتماد جهتك ثم أعد المحاولة");
      }
    },
  });

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white grid gap-5 p-7 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate(e.currentTarget);
      }}
      onBlur={(e) => save(e.currentTarget)}
    >
      {!entity.isLoading && !approved && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-bold leading-relaxed text-amber-700 md:col-span-2 dark:text-amber-300">
          {entity.data
            ? "ملف جهتك قيد المراجعة — سيُفعّل زر النشر بعد اعتماد الجهة."
            : "وثّق جهتك أولاً من قسم «توثيق الجهة» ليتاح لك طرح طلبات عروض الأسعار."}
        </p>
      )}
      <div className="md:col-span-2">
        <FormField label="عنوان المشروع / التوريد" error={errors["title"]}>
          <Input name="title" defaultValue={draft["title"] ?? ""} maxLength={160} placeholder="مثال: توريد سلال غذائية لموسم الشتاء" />
        </FormField>
      </div>
      <FormField label="تصنيف المشتريات" error={errors["category"]}>
        <select name="category" defaultValue={draft["category"] ?? ""} className={selectClass}>
          <option value="">اختر التصنيف</option>
          {RFQ_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FormField>
      <FormField label="القطاع" error={errors["sector"]}>
        <select name="sector" defaultValue={draft["sector"] ?? ""} className={selectClass}>
          <option value="">اختر القطاع</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </FormField>
      <FormField label="نوع صاحب المشروع" error={errors["entity_kind"]}>
        <select name="entity_kind" defaultValue={draft["entity_kind"] ?? ""} className={selectClass}>
          <option value="">اختر النوع</option>
          {ENTITY_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </FormField>
      <FormField label="اسم صاحب المشروع" error={errors["entity_name"]}>
        <Input name="entity_name" defaultValue={draft["entity_name"] ?? ""} maxLength={160} />
      </FormField>
      <FormField label="المنطقة المستهدفة" error={errors["region"]}>
        <select name="region" defaultValue={draft["region"] ?? ""} className={selectClass}>
          <option value="">اختر المنطقة</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </FormField>
      <FormField label="المدينة" error={errors["city"]}>
        <Input name="city" defaultValue={draft["city"] ?? ""} maxLength={80} placeholder="مثال: الطائف" />
      </FormField>
      <FormField label="تاريخ انتهاء التقديم" error={errors["deadline"]}>
        <Input name="deadline" type="date" dir="ltr" defaultValue={draft["deadline"] ?? ""} />
      </FormField>
      <FormField label="الميزانية التقديرية (اختياري)" error={errors["budget"]}>
        <Input name="budget" defaultValue={draft["budget"] ?? ""} maxLength={80} placeholder="مثال: 50,000 - 80,000 ريال" />
      </FormField>
      <div className="md:col-span-2">
        <FormField label="وصف الطلب والمتطلبات" error={errors["description"]}>
          <Textarea name="description" rows={5} defaultValue={draft["description"] ?? ""} maxLength={2000} />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-700">
          <Checkbox
            checked={requiresReview}
            onCheckedChange={(value) => setRequiresReview(value === true)}
            className="mt-0.5"
          />
          <input
            type="hidden"
            name="requires_openloop_review"
            value={requiresReview ? "true" : "false"}
          />
          <span>
            أرغب بطلب خدمة فُرص Open Loop لدراسة وتحليل العروض المتقدمة وترشيح أفضل 3 عروض.
          </span>
        </label>
      </div>

      <TermsAgreement
        checked={agree}
        onChange={(v) => {
          setAgree(v);
          if (v) setErrors((prev) => ({ ...prev, terms: "" }));
        }}
        error={errors["terms"]}
      />
      <div className="md:col-span-2">
        <Button
          type="submit"
          disabled={submit.isPending || !approved}
          className="rounded-full font-bold"
        >
          {submit.isPending ? "جارٍ النشر..." : "نشر الفرصة"}
        </Button>

        <p className="mt-3 text-xs text-slate-500">
          النشر متاح للجهات المعتمدة في المجتمع فقط بعد التحقق من الترخيص.
        </p>
      </div>
    </form>
  );
}

function SupplierForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [crDoc, setCrDoc] = useState<File | null>(null);
  const crFileRef = useRef<HTMLInputElement>(null);

  const mine = useQuery({
    queryKey: ["supplier", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchMySupplier(user!.id),
  });
  const supplier = mine.data;

  const submit = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!agree) {
        setErrors((prev) => ({ ...prev, terms: "يجب الموافقة على الشروط والأحكام" }));
        throw new Error("validation");
      }
      if (crDoc && crDoc.size > SUPPLIER_DOC_MAX_MB * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          cr_document: `حجم الملف أكبر من ${SUPPLIER_DOC_MAX_MB} ميجابايت`,
        }));
        throw new Error("validation");
      }
      const fd = new FormData(form);
      const parsed = supplierSchema.safeParse({
        company_name: String(fd.get("company_name") ?? ""),
        cr_number: String(fd.get("cr_number") ?? "").replace(/\s|-/g, ""),
        category: String(fd.get("category") ?? ""),
        region: String(fd.get("region") ?? ""),
        contact_name: String(fd.get("contact_name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        about: String(fd.get("about") ?? ""),
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
        setErrors(next);
        throw new Error("validation");
      }
      if (!crDoc && !supplier?.cr_document_path) {
        setErrors((prev) => ({
          ...prev,
          cr_document: "يرجى إرفاق نسخة من السجل التجاري للمنشأة",
        }));
        throw new Error("validation");
      }
      setErrors({});

      let crDocPath: string | null = supplier?.cr_document_path ?? null;
      if (crDoc) {
        const safeName = crDoc.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user!.id}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("supplier-documents")
          .upload(path, crDoc, {
            contentType: crDoc.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadErr) {
          toast.error("تعذر رفع ملف السجل التجاري");
          throw uploadErr;
        }
        crDocPath = path;
      }

      const nextStatus =
        supplier?.is_approved || supplier?.document_status === "verified"
          ? "verified"
          : "pending_verification";
      const { error } = await supabase
        .from("suppliers")
        .upsert(
          {
            ...parsed.data,
            about: parsed.data.about ?? "",
            user_id: user!.id,
            cr_document_path: crDocPath,
            document_status: nextStatus,
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      await logTermsAcceptance({
        userId: user!.id,
        acceptanceType: "provider",
        relatedAction: "provider.registered",
      });
      await logAudit({
        actorId: user!.id,
        action: "provider.registered",
        entityType: "supplier",
        meta: { company_name: parsed.data.company_name, document_status: nextStatus },
      });
    },
    onSuccess: () => {
      const justVerified =
        supplier?.is_approved || supplier?.document_status === "verified";
      if (justVerified) {
        toast.success("تم تحديث بيانات المنشأة المورد بنجاح");
      } else {
        toast.success(
          "تم حفظ ملف المنشأة ورفع السجل التجاري — بانتظار اعتماد الإدارة"
        );
      }
      setAgree(false);
      setCrDoc(null);
      if (crFileRef.current) crFileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["supplier", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-directory"] });
    },

    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("تعذر حفظ البيانات، حاول مرة أخرى");
    },
  });

  if (supplier?.is_approved || supplier?.document_status === "verified") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-7">
        <h3 className="text-lg font-extrabold">
          منشأة معتمدة في دليل الموردين — فُرص Open Loop
        </h3>
        <p className="mt-2 text-sm font-bold">
          {supplier.company_name} — {supplier.category}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          المسؤول: {supplier.contact_name} — {supplier.region}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          يمكنك الآن الدخول إلى لوحة "فرص عرض الأسعار (RFQ)" المتاحة وتقديم
          عروض فنية ومالية على الفرص المعلنة.
        </p>
      </div>
    );
  }

  if (supplier && (supplier.document_status === "pending_verification" || supplier.cr_document_path)) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-7">
        <h3 className="text-lg font-extrabold text-amber-800 dark:text-amber-300">
          ملف المنشأة المورد قيد المراجعة والاعتماد
        </h3>
        <p className="mt-2 text-sm font-bold">
          {supplier.company_name} — {supplier.category}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          تم استلام طلب التسجيل ورفع نسخة السجل التجاري، والآن يتم مراجعة
          الطلب يدوياً من قبل فريق أوبن لوب خلال 24-48 ساعة عمل. بعد الاعتماد
          سيتم تفعيل ملفك في دليل الموردين وإعلامك عبر البريد.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white grid gap-5 p-7 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate(e.currentTarget);
      }}
    >
      <FormField label="اسم المنشأة" error={errors["company_name"]}>
        <Input name="company_name" defaultValue={supplier?.company_name ?? ""} maxLength={160} />
      </FormField>
      <FormField label="رقم السجل التجاري" error={errors["cr_number"]}>
        <Input
          name="cr_number"
          inputMode="numeric"
          dir="ltr"
          defaultValue={supplier?.cr_number ?? ""}
          maxLength={12}
        />
      </FormField>
      <div className="md:col-span-2">
        <FormField label="نسخة من السجل التجاري CR" error={errors["cr_document"]}>
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
            <input
              ref={crFileRef}
              type="file"
              accept={SUPPLIER_DOC_ACCEPT}
              className="hidden"
              onChange={(e) => setCrDoc(e.target.files?.[0] ?? null)}
            />
            {!crDoc ? (
              <button
                type="button"
                onClick={() => crFileRef.current?.click()}
                className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-indigo-600" />
                  اضغط لرفع ملف السجل التجاري
                </span>
                <span className="text-xs font-bold text-slate-400">
                  PDF أو صورة، الحد {SUPPLIER_DOC_MAX_MB}MB
                </span>
              </button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0 text-sm font-semibold text-slate-700">
                  <div className="truncate">{crDoc.name}</div>
                  <div className="text-xs font-bold text-slate-400">
                    {(crDoc.size / 1024 / 1024).toFixed(2)} ميجابايت
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="إزالة الملف"
                  onClick={() => {
                    setCrDoc(null);
                    if (crFileRef.current) crFileRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {supplier?.cr_document_path && !crDoc ? (
            <p className="mt-1.5 text-xs font-bold text-primary dark:text-gold">
              تم رفع سجل تجاري سابقاً — يمكنك تركه كما هو أو رفع ملف جديد للتحديث.
            </p>
          ) : null}
        </FormField>
      </div>
      <FormField label="تصنيف التوريد" error={errors["category"]}>
        <select name="category" defaultValue={supplier?.category ?? ""} className={selectClass}>
          <option value="">اختر التصنيف</option>
          {RFQ_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FormField>
      <FormField label="المنطقة" error={errors["region"]}>
        <select name="region" defaultValue={supplier?.region ?? ""} className={selectClass}>
          <option value="">اختر المنطقة</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </FormField>
      <FormField label="اسم المسؤول" error={errors["contact_name"]}>
        <Input name="contact_name" defaultValue={supplier?.contact_name ?? ""} maxLength={120} />
      </FormField>
      <FormField label="البريد الإلكتروني" error={errors["email"]}>
        <Input name="email" type="email" dir="ltr" defaultValue={supplier?.email ?? ""} maxLength={200} />
      </FormField>
      <FormField label="رقم الجوال" error={errors["phone"]}>
        <Input name="phone" inputMode="tel" dir="ltr" defaultValue={supplier?.phone ?? ""} maxLength={14} />
      </FormField>
      <div className="md:col-span-2">
        <FormField label="نبذة عن خدمات المنشأة" error={errors["about"]}>
          <Textarea name="about" rows={4} defaultValue={supplier?.about ?? ""} maxLength={1000} />
        </FormField>
      </div>
      <TermsAgreement
        checked={agree}
        onChange={(v) => {
          setAgree(v);
          if (v) setErrors((prev) => ({ ...prev, terms: "" }));
        }}
        error={errors["terms"]}
      />
      <div className="md:col-span-2">
        <Button type="submit" disabled={submit.isPending} className="rounded-full font-bold">
          {submit.isPending
            ? "جارٍ الحفظ..."
            : supplier
              ? "تحديث ملف مقدم الخدمة / المورد"
              : "التسجيل كمقدم خدمة / مورد"}
        </Button>
      </div>
    </form>
  );
}
