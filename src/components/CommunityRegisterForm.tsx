import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TermsAgreement } from "@/components/CommunityTerms";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ENTITY_TYPES,
  FIELDS,
  REGIONS,
  checkRegistryNumber,
  fetchMyEntity,
} from "@/lib/community";
import { logAudit, logTermsAcceptance } from "@/lib/marketplace";

const OTHER_FIELD = "أخرى";

const schema = z
  .object({
    entity_type: z.string().min(1, "اختر نوع الكيان"),
    license_number: z.string().regex(/^[0-9]{10}$/, "رقم الترخيص / السجل يجب أن يكون 10 أرقام"),
    entity_name: z.string().trim().min(3, "اسم الكيان مطلوب").max(160),
    representative_name: z.string().trim().min(3, "اسم الممثل مطلوب").max(120),
    job_title: z.string().trim().min(2, "المسمى الوظيفي مطلوب").max(120),
    official_email: z.string().trim().email("بريد إلكتروني غير صحيح").max(200),
    phone: z.string().trim().regex(/^0?5[0-9]{8}$/, "رقم جوال سعودي غير صحيح"),
    region: z.string().min(1, "اختر المنطقة"),
    field: z.string().min(1, "اختر مجال العمل"),
    field_other: z.string().optional(),
  })
  .refine(
    (data) =>
      data.field !== OTHER_FIELD ||
      (data.field_other && data.field_other.trim().length >= 2),
    {
      message: "اذكر مجال العمل",
      path: ["field_other"],
    }
  );

const selectClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 px-3 text-sm font-semibold";

const ENTITY_DOC_MAX_MB = 10;
const ENTITY_DOC_ACCEPT = ".pdf,image/*";

export function CommunityRegisterForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [license, setLicense] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldValue, setFieldValue] = useState("");
  const [otherField, setOtherField] = useState("");
  const [agree, setAgree] = useState(false);
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const licenseFileRef = useRef<HTMLInputElement>(null);

  const myEntity = useQuery({
    queryKey: ["community-entity", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchMyEntity(user!.id),
  });

  const entity = myEntity.data;

  useEffect(() => {
    if (!entity) {
      setFieldValue("");
      setOtherField("");
      return;
    }
    if (FIELDS.includes(entity.field as (typeof FIELDS)[number])) {
      setFieldValue(entity.field);
      setOtherField("");
    } else {
      setFieldValue(OTHER_FIELD);
      setOtherField(entity.field);
    }
  }, [entity]);

  const registryCheck = license ? checkRegistryNumber(license) : null;

  const submit = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!agree) {
        setErrors((previous) => ({ ...previous, terms: "يجب الموافقة على الشروط والأحكام" }));
        throw new Error("validation");
      }
      if (!licenseDoc && !entity?.license_document_path) {
        setErrors((previous) => ({
          ...previous,
          license_document: "يرجى إرفاق نسخة من السجل التجاري أو الترخيص",
        }));
        throw new Error("validation");
      }
      if (licenseDoc && licenseDoc.size > ENTITY_DOC_MAX_MB * 1024 * 1024) {
        setErrors((previous) => ({
          ...previous,
          license_document: `حجم الملف أكبر من ${ENTITY_DOC_MAX_MB} ميجابايت`,
        }));
        throw new Error("validation");
      }
      const fd = new FormData(form);
      const rawField = String(fd.get("field") ?? "");
      const parsed = schema.safeParse({
        entity_type: String(fd.get("entity_type") ?? ""),
        license_number: String(fd.get("license_number") ?? "").replace(/\s|-/g, ""),
        entity_name: String(fd.get("entity_name") ?? ""),
        representative_name: String(fd.get("representative_name") ?? ""),
        job_title: String(fd.get("job_title") ?? ""),
        official_email: String(fd.get("official_email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        region: String(fd.get("region") ?? ""),
        field: rawField,
        field_other: rawField === OTHER_FIELD ? String(fd.get("field_other") ?? "") : "",
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
        setErrors(next);
        throw new Error("validation");
      }
      setErrors({});

      let licenseDocPath: string | null = entity?.license_document_path ?? null;
      if (licenseDoc) {
        const safeName = licenseDoc.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user!.id}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("entity-documents")
          .upload(path, licenseDoc, {
            contentType: licenseDoc.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadErr) {
          toast.error("تعذر رفع ملف الترخيص، حاول مرة أخرى");
          throw uploadErr;
        }
        licenseDocPath = path;
      }

      const { field, field_other, ...rest } = parsed.data;
      const effectiveField = field === OTHER_FIELD ? (field_other ?? "").trim() : field;
      const nextStatus =
        entity?.is_verified || entity?.document_status === "verified"
          ? "verified"
          : "pending_verification";
      const { data, error } = await supabase
        .from("community_entities")
        .upsert(
          {
            ...rest,
            field: effectiveField,
            user_id: user!.id,
            license_document_path: licenseDocPath,
            document_status: nextStatus,
          },
          { onConflict: "user_id" }
        )
        .select("id")
        .single();
      if (error) throw error;
      await logTermsAcceptance({
        userId: user!.id,
        acceptanceType: "project_owner",
        relatedAction: "project_owner.registered",
        relatedId: data.id,
      });
      await logAudit({
        actorId: user!.id,
        action: "project_owner.registered",
        entityType: "community_entity",
        entityId: data.id,
        meta: { entity_name: rest.entity_name, document_status: nextStatus },
      });
    },
    onSuccess: () => {
      const justVerified =
        entity?.is_verified || entity?.document_status === "verified";
      if (justVerified) {
        toast.success("تم تحديث بيانات صاحب المشروع بنجاح");
      } else {
        toast.success(
          "تم إرسال البيانات ورفع الوثيقة — بانتظار مراجعة اعتماد الإدارة"
        );
      }
      setAgree(false);
      setLicenseDoc(null);
      if (licenseFileRef.current) licenseFileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["community-entity", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["community-directory"] });
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("تعذر حفظ البيانات، حاول مرة أخرى");
    },
  });

  if (entity?.is_verified) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-7">
        <div>
          <h3 className="text-lg font-extrabold">صاحب مشروع معتمد في فُرص Open Loop</h3>
          <p className="mt-2 text-sm font-bold">{entity.entity_name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {entity.entity_type} — {entity.region} — {entity.field}
          </p>
          <p className="mt-3 text-xs text-slate-500">{entity.verification_note}</p>
        </div>
      </div>
    );
  }

  if (entity && (entity.document_status === "pending_verification" || entity.license_document_path)) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-7">
        <h3 className="text-lg font-extrabold text-amber-800 dark:text-amber-300">
          ملف صاحب المشروع قيد المراجعة والاعتماد
        </h3>
        <p className="mt-2 text-sm font-bold">
          {entity.entity_name} — {entity.entity_type}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          تم استلام طلب التسجيل ورفع وثيقة الترخيص، والآن يتم مراجعتها يدوياً من قبل فريق
          أوبن لوب للتأكد من صحة البيانات. سيتم تفعيل ملفك في الدليل وإعلامك بعد
          الاعتماد.
        </p>
        {entity.verification_note ? (
          <p className="mt-3 rounded-xl bg-white/60 p-3 text-xs font-bold text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            ملاحظة الإدارة: {entity.verification_note}
          </p>
        ) : null}
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
      {entity && !entity.is_verified && (
        <p className="md:col-span-2 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          {entity.verification_note}
        </p>
      )}

      <Field label="نوع الكيان" error={errors["entity_type"]}>
        <select
          name="entity_type"
          defaultValue={entity?.entity_type ?? ""}
          className={selectClass}
        >
          <option value="">اختر النوع</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="رقم الترخيص / السجل التجاري"
        error={errors["license_number"]}
        hint={registryCheck?.message}
        hintOk={registryCheck?.ok}
      >
        <Input
          name="license_number"
          inputMode="numeric"
          maxLength={12}
          defaultValue={entity?.license_number ?? ""}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="1010XXXXXX"
        />
      </Field>

      <Field
        label="نسخة من الترخيص أو السجل التجاري"
        error={errors["license_document"]}
      >
        <div className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
          <input
            ref={licenseFileRef}
            type="file"
            accept={ENTITY_DOC_ACCEPT}
            className="hidden"
            onChange={(e) => setLicenseDoc(e.target.files?.[0] ?? null)}
          />
          {!licenseDoc ? (
            <button
              type="button"
              onClick={() => licenseFileRef.current?.click()}
              className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-indigo-600" />
                اضغط لرفع الملف
              </span>
              <span className="text-xs font-bold text-slate-400">
                PDF أو صورة، الحد {ENTITY_DOC_MAX_MB}MB
              </span>
            </button>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0 text-sm font-semibold text-slate-700">
                <div className="truncate">{licenseDoc.name}</div>
                <div className="text-xs font-bold text-slate-400">
                  {(licenseDoc.size / 1024 / 1024).toFixed(2)} ميجابايت
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="إزالة الملف"
                onClick={() => {
                  setLicenseDoc(null);
                  if (licenseFileRef.current) licenseFileRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {entity?.license_document_path && !licenseDoc ? (
          <p className="mt-1.5 text-xs font-bold text-primary dark:text-gold">
            تم رفع وثيقة سابقاً — يمكنك تركها كما هي أو رفع ملف جديد للتحديث.
          </p>
        ) : null}
      </Field>

      <Field label="اسم الكيان (كما في الترخيص)" error={errors["entity_name"]}>
        <Input name="entity_name" defaultValue={entity?.entity_name ?? ""} maxLength={160} />
      </Field>

      <Field label="اسم ممثل صاحب المشروع" error={errors["representative_name"]}>
        <Input
          name="representative_name"
          defaultValue={entity?.representative_name ?? ""}
          maxLength={120}
        />
      </Field>

      <Field label="المسمى الوظيفي" error={errors["job_title"]}>
        <Input name="job_title" defaultValue={entity?.job_title ?? ""} maxLength={120} />
      </Field>

      <Field label="البريد الرسمي لصاحب المشروع" error={errors["official_email"]}>
        <Input
          name="official_email"
          type="email"
          dir="ltr"
          defaultValue={entity?.official_email ?? ""}
          maxLength={200}
        />
      </Field>

      <Field label="رقم الجوال" error={errors["phone"]}>
        <Input name="phone" inputMode="tel" dir="ltr" defaultValue={entity?.phone ?? ""} maxLength={14} />
      </Field>

      <Field label="المنطقة" error={errors["region"]}>
        <select name="region" defaultValue={entity?.region ?? ""} className={selectClass}>
          <option value="">اختر المنطقة</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field label="مجال العمل" error={errors["field"]}>
        <select
          name="field"
          value={fieldValue}
          onChange={(e) => setFieldValue(e.target.value)}
          className={selectClass}
        >
          <option value="">اختر المجال</option>
          {FIELDS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>

      {fieldValue === OTHER_FIELD && (
        <Field label="اذكر مجال العمل" error={errors["field_other"]}>
          <Input
            name="field_other"
            value={otherField}
            onChange={(e) => setOtherField(e.target.value)}
            maxLength={120}
            placeholder="اكتب مجال عمل الجهة"
          />
        </Field>
      )}

      <TermsAgreement
        checked={agree}
        onChange={(value) => {
          setAgree(value);
          if (value) setErrors((previous) => ({ ...previous, terms: "" }));
        }}
        error={errors["terms"]}
      />

      <div className="md:col-span-2">
        <Button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded-full font-bold sm:w-auto"
        >
          {submit.isPending ? "جارٍ التحقق..." : "تحقق وسجّل كصاحب مشروع"}
        </Button>
        <p className="mt-3 text-xs text-slate-500">
          بعد تقديم البيانات ورفع نسخة من الترخيص أو السجل، سيتم مراجعة الطلب يدوياً من قبل
          فريق أوبن لوب خلال 24-48 ساعة، وبعد الاعتماد سيظهر ملفك في دليل المجتمع وستتمكن
          من طرح فرص عرض الأسعار (RFQ).
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  hintOk,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  hintOk?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-bold">{label}</Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-bold text-destructive">{error}</p>
      ) : hint ? (
        <p className={`mt-1.5 text-xs font-bold ${hintOk ? "text-primary dark:text-gold" : "text-destructive"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
