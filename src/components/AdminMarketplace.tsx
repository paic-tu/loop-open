import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Download, Loader2, Settings2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/MarketplaceDisclaimer";
import { FormField } from "@/components/RfqBoard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ACCOUNT_STATUS,
  COMMISSION_STATUS,
  OPPORTUNITY_STATUS,
  downloadCsv,
  fetchSettings,
  formatMoney,
  logAudit,
} from "@/lib/marketplace";

/** Admin control centre for the marketplace: approvals, commissions, settings and reports. */
export function AdminMarketplace({ defaultTab = "approvals" }: { defaultTab?: string }) {
  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <ShieldCheck className="h-5 w-5 text-primary dark:text-gold" aria-hidden />
        إدارة سوق فُرص Open Loop
      </h2>
      <Tabs defaultValue={defaultTab} className="mt-2">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="approvals">الاعتمادات</TabsTrigger>
          <TabsTrigger value="commissions">العمولات</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>
        <TabsContent value="approvals" className="mt-6">
          <ApprovalsPanel />
        </TabsContent>
        <TabsContent value="commissions" className="mt-6">
          <CommissionsPanel />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <ReportsPanel />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useApprovalAction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      table,
      id,
      status,
      extra,
    }: {
      table: "community_entities" | "suppliers" | "rfqs";
      id: string;
      status: string;
      extra?: Record<string, unknown>;
    }) => {
      const patch: Record<string, unknown> = { status, ...extra };
      if (table === "community_entities") patch["is_verified"] = status === "approved";
      // 1) التحديث الرئيسي للحالة — الإجراء الأساسي الذي يجب أن ينجح دائماً
      const { error } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;

      // 2) إدراج سجل الاعتماد (عملية ثانوية مهمة لكن لا يجب أن تمنع النجاح لو فشلت)
      try {
        await supabase.from("approvals").insert({
          entity_type: table,
          entity_id: id,
          status,
          reviewer_id: user!.id,
          reviewed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("approvals insert skipped:", e instanceof Error ? e.message : e);
      }

      // 3) سجل التدقيق (ثانوي أيضاً)
      try {
        await logAudit({
          actorId: user!.id,
          action: `${table}.${status}`,
          entityType: table,
          entityId: id,
          meta: extra ?? {},
        });
      } catch (e) {
        console.warn("audit insert skipped:", e instanceof Error ? e.message : e);
      }
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      queryClient.invalidateQueries();
    },
    onError: (e) => {
      console.error("Approval update failed:", e instanceof Error ? e.message : e);
      toast.error("تعذر تحديث الحالة");
    },
  });
}

function ApprovalsPanel() {
  const action = useApprovalAction();

  const orgs = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_entities")
        .select("id, entity_name, entity_type, license_number, status, region")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const providers = useQuery({
    queryKey: ["admin-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, company_name, cr_number, category, region, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const opportunities = useQuery({
    queryKey: ["admin-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("id, title, entity_name, category, city, region, sector, status, deadline, requires_openloop_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <Group title="حسابات أصحاب المشاريع">
        {orgs.data?.map((o) => (
          <Row
            key={o.id}
            title={o.entity_name}
            subtitle={`${o.entity_type} — ترخيص ${o.license_number} — ${o.region}`}
            status={o.status}
            map={ACCOUNT_STATUS}
            onApprove={() =>
              action.mutate({
                table: "community_entities",
                id: o.id,
                status: "approved",
                extra: {
                  verified_at: new Date().toISOString(),
                  document_status: "verified",
                  document_status_updated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              })
            }
            onReject={() =>
              action.mutate({
                table: "community_entities",
                id: o.id,
                status: "rejected",
                extra: {
                  is_verified: false,
                  document_status: "rejected",
                  document_status_updated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              })
            }
            pending={action.isPending}
          />
        ))}
      </Group>

      <Group title="حسابات مقدمي الخدمة">
        {providers.data?.map((p) => (
          <Row
            key={p.id}
            title={p.company_name}
            subtitle={`${p.category} — سجل ${p.cr_number} — ${p.region}`}
            status={p.status}
            map={ACCOUNT_STATUS}
            onApprove={() =>
              action.mutate({
                table: "suppliers",
                id: p.id,
                status: "approved",
                extra: {
                  verified_at: new Date().toISOString(),
                  document_status: "verified",
                  document_status_updated_at: new Date().toISOString(),
                  is_verified: true,
                  updated_at: new Date().toISOString(),
                },
              })
            }
            onReject={() =>
              action.mutate({
                table: "suppliers",
                id: p.id,
                status: "rejected",
                extra: {
                  is_verified: false,
                  document_status: "rejected",
                  document_status_updated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              })
            }
            pending={action.isPending}
          />
        ))}
      </Group>

      <Group title="الفرص المطروحة">
        {opportunities.data?.map((r) => (
          <Row
            key={r.id}
            title={r.title}
            subtitle={`${r.entity_name} — ${r.category} — ${r.city || r.region}`}
            status={r.status}
            map={OPPORTUNITY_STATUS}
            flag={r.requires_openloop_review ? "مطلوب دراسة وترشيح أفضل 3 عروض" : undefined}
            onApprove={() =>
              action.mutate({
                table: "rfqs",
                id: r.id,
                status: "published",
                extra: {
                  approved_at: new Date().toISOString(),
                  published_at: new Date().toISOString(),
                  is_open: true,
                  updated_at: new Date().toISOString(),
                },
              })
            }
            onReject={() =>
              action.mutate({
                table: "rfqs",
                id: r.id,
                status: "rejected",
                extra: {
                  rejected_at: new Date().toISOString(),
                  is_open: false,
                  rejection_reason: "لم تستوفِ الفرصة شروط النشر",
                  updated_at: new Date().toISOString(),
                },
              })
            }
            pending={action.isPending}
          />
        ))}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-extrabold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({
  title,
  subtitle,
  status,
  map,
  onApprove,
  onReject,
  pending,
  flag,
}: {
  title: string;
  subtitle: string;
  status: string;
  map: Record<string, { label: string; tone: string }>;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
  flag?: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{title}</p>
        <p className="mt-1 text-xs font-bold text-muted-foreground">{subtitle}</p>
        {flag && (
          <p className="mt-2 w-fit rounded-full bg-gold/20 px-3 py-1 text-[11px] font-extrabold text-primary">
            {flag}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={status} map={map} />
        <Button size="sm" className="rounded-full font-bold" disabled={pending} onClick={onApprove}>
          <Check className="h-4 w-4" aria-hidden />
          اعتماد
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full font-bold"
          disabled={pending}
          onClick={onReject}
        >
          <X className="h-4 w-4" aria-hidden />
          رفض
        </Button>
      </div>
    </div>
  );
}

function CommissionsPanel() {
  const queryClient = useQueryClient();
  const commissions = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, percent, amount, status, due_date, created_at, contracts(title, amount)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("commissions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة العمولة");
      queryClient.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
    onError: () => toast.error("تعذر التحديث"),
  });

  const rows = commissions.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const collected = rows
    .filter((r) => r.status === "collected")
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="إجمالي العمولات" value={`${formatMoney(total)} ريال`} />
        <Stat label="المحصّل" value={`${formatMoney(collected)} ريال`} />
        <Stat label="غير المحصّل" value={`${formatMoney(total - collected)} ريال`} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-full font-bold"
        onClick={() =>
          downloadCsv(
            "commissions.csv",
            rows.map((r) => ({
              العقد: r.contracts?.title ?? "",
              "قيمة العقد": Number(r.contracts?.amount ?? 0),
              النسبة: Number(r.percent),
              العمولة: Number(r.amount),
              الحالة: COMMISSION_STATUS[r.status]?.label ?? r.status,
              الاستحقاق: r.due_date,
            }))
          )
        }
      >
        <Download className="h-4 w-4" aria-hidden />
        تصدير CSV
      </Button>

      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{r.contracts?.title || "عقد"}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                قيمة العقد {formatMoney(Number(r.contracts?.amount ?? 0))} ريال — العمولة{" "}
                {formatMoney(Number(r.amount))} ريال ({Number(r.percent)}%) — الاستحقاق {r.due_date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} map={COMMISSION_STATUS} />
              <Button
                size="sm"
                className="rounded-full font-bold"
                disabled={update.isPending || r.status === "collected"}
                onClick={() => update.mutate({ id: r.id, status: "collected" })}
              >
                تحصيل
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full font-bold"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: r.id, status: "overdue" })}
              >
                متأخرة
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد عمولات مسجلة بعد.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
    </div>
  );
}

function ReportsPanel() {
  const opportunities = useQuery({
    queryKey: ["report-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("id, title, sector, city, region, category, status, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const quotes = useQuery({
    queryKey: ["report-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfq_quotes").select("id, rfq_id, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contracts = useQuery({
    queryKey: ["report-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, title, amount, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const bySector = useMemo(() => groupCount(opportunities.data ?? [], "sector"), [opportunities.data]);
  const byCity = useMemo(() => groupCount(opportunities.data ?? [], "city"), [opportunities.data]);
  const contractsTotal = (contracts.data ?? []).reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="عدد الفرص" value={String(opportunities.data?.length ?? 0)} />
        <Stat label="عروض مقدمي الخدمة" value={String(quotes.data?.length ?? 0)} />
        <Stat label="إجمالي قيم العقود" value={`${formatMoney(contractsTotal)} ريال`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Breakdown title="الفرص حسب القطاع" data={bySector} />
        <Breakdown title="الفرص حسب المدينة" data={byCity} />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="rounded-full font-bold"
        onClick={() =>
          downloadCsv(
            "opportunities.csv",
            (opportunities.data ?? []).map((o) => ({
              العنوان: o.title,
              القطاع: o.sector,
              المدينة: o.city,
              المنطقة: o.region,
              التصنيف: o.category,
              الحالة: OPPORTUNITY_STATUS[o.status]?.label ?? o.status,
              التاريخ: new Date(o.created_at).toLocaleDateString("ar-SA"),
            }))
          )
        }
      >
        <Download className="h-4 w-4" aria-hidden />
        تصدير تقرير الفرص
      </Button>
    </div>
  );
}

function groupCount(rows: Record<string, unknown>[], key: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] ?? "").trim() || "غير محدد";
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function Breakdown({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="rounded-2xl bg-secondary/50 p-5">
      <h4 className="flex items-center gap-2 text-sm font-extrabold">
        <BarChart3 className="h-4 w-4 text-primary dark:text-gold" aria-hidden />
        {title}
      </h4>
      <ul className="mt-4 space-y-3">
        {data.map(([label, count]) => (
          <li key={label}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span>{label}</span>
              <span>{count}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-background">
              <div
                className="h-2 rounded-full bg-gold"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-muted-foreground">لا توجد بيانات.</li>}
      </ul>
    </div>
  );
}

function SettingsPanel() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: fetchSettings });
  const [newCategory, setNewCategory] = useState("");

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_categories")
        .select("id, name, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key, value: value as never }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: () => toast.error("تعذر حفظ الإعدادات"),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = newCategory.trim();
      if (name.length < 2) throw new Error("اسم غير صالح");
      const { error } = await supabase.from("opportunity_categories").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewCategory("");
      toast.success("تمت إضافة التصنيف");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: () => toast.error("تعذر إضافة التصنيف"),
  });

  const commission = settings.data?.["commission"] ?? {};
  const uploads = settings.data?.["uploads"] ?? {};
  const texts = settings.data?.["texts"] ?? {};

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        className="rounded-2xl bg-secondary/50 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          saveSetting.mutate({
            key: "commission",
            value: { percent: Number(fd.get("percent")) || 1 },
          });
        }}
      >
        <h4 className="flex items-center gap-2 text-sm font-extrabold">
          <Settings2 className="h-4 w-4 text-primary dark:text-gold" aria-hidden />
          نسبة الوساطة
        </h4>
        <div className="mt-4">
          <FormField label="النسبة المئوية %">
            <Input
              name="percent"
              type="number"
              step="0.1"
              dir="ltr"
              defaultValue={String(commission["percent"] ?? 1)}
            />
          </FormField>
        </div>
        <Button size="sm" className="mt-4 rounded-full font-bold" disabled={saveSetting.isPending}>
          حفظ
        </Button>
      </form>

      <form
        className="rounded-2xl bg-secondary/50 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          saveSetting.mutate({
            key: "uploads",
            value: {
              allowed: String(fd.get("allowed") ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              max_mb: Number(fd.get("max_mb")) || 10,
            },
          });
        }}
      >
        <h4 className="text-sm font-extrabold">الملفات المسموحة</h4>
        <div className="mt-4 grid gap-4">
          <FormField label="الصيغ (مفصولة بفاصلة)">
            <Input
              name="allowed"
              dir="ltr"
              defaultValue={((uploads["allowed"] as string[]) ?? []).join(", ")}
            />
          </FormField>
          <FormField label="الحد الأقصى (ميجابايت)">
            <Input name="max_mb" type="number" dir="ltr" defaultValue={String(uploads["max_mb"] ?? 10)} />
          </FormField>
        </div>
        <Button size="sm" className="mt-4 rounded-full font-bold" disabled={saveSetting.isPending}>
          حفظ
        </Button>
      </form>

      <form
        className="rounded-2xl bg-secondary/50 p-5 md:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          saveSetting.mutate({ key: "texts", value: { disclaimer: String(fd.get("disclaimer") ?? "") } });
        }}
      >
        <h4 className="text-sm font-extrabold">نص إخلاء المسؤولية</h4>
        <div className="mt-4">
          <Textarea name="disclaimer" rows={3} defaultValue={String(texts["disclaimer"] ?? "")} />
        </div>
        <Button size="sm" className="mt-4 rounded-full font-bold" disabled={saveSetting.isPending}>
          {saveSetting.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          حفظ
        </Button>
      </form>

      <div className="rounded-2xl bg-secondary/50 p-5 md:col-span-2">
        <h4 className="text-sm font-extrabold">تصنيفات الفرص</h4>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.data?.map((c) => (
            <li
              key={c.id}
              className="rounded-full bg-background px-3 py-1.5 text-xs font-extrabold"
            >
              {c.name}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="تصنيف جديد"
            className="max-w-xs"
          />
          <Button
            size="sm"
            className="rounded-full font-bold"
            disabled={addCategory.isPending}
            onClick={() => addCategory.mutate()}
          >
            إضافة
          </Button>
        </div>
      </div>
    </div>
  );
}
