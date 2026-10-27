import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { submitRequest } from "@/lib/requests";

const schema = z.object({
  name: z.string().trim().min(2, "الرجاء إدخال الاسم").max(100, "الاسم طويل جداً"),
  org: z.string().trim().min(2, "الرجاء إدخال اسم الجهة").max(120, "الاسم طويل جداً"),
  phone: z
    .string()
    .trim()
    .min(8, "رقم جوال غير صحيح")
    .max(20, "رقم جوال غير صحيح")
    .regex(/^[0-9+\s-]+$/, "رقم الجوال يجب أن يحتوي أرقاماً فقط"),
});

export function ServiceRequestForm({
  categoryTitle,
  items,
  idPrefix,
}: {
  categoryTitle: string;
  items: string[];
  idPrefix: string;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: "", org: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = (item: string) =>
    setSelected((s) => (s.includes(item) ? s.filter((i) => i !== item) : [...s, item]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
    }
    if (selected.length === 0) next["services"] = "اختر خدمة واحدة على الأقل";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    if (!user) return;
    setBusy(true);
    try {
      const d = parsed.data!;
      await submitRequest({
        userId: user.id,
        type: "service",
        title: `اطلب خدمة — ${categoryTitle}`,
        details: {
          "الخدمات المطلوبة": selected,
          "الاسم": d.name,
          "الجهة": d.org,
          "الجوال": d.phone,
        },
      });
      toast.success("تم إرسال طلبك بنجاح", { description: "يمكنك متابعته من لوحة حسابك." });
      setSelected([]);
      setValues({ name: "", org: "", phone: "" });
    } catch {
      toast.error("تعذر إرسال الطلب، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof values, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        type={type}
        value={values[key]}
        maxLength={key === "phone" ? 20 : 120}
        dir={key === "phone" ? "ltr" : undefined}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
      {errors[key] && <p className="text-xs font-semibold text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="card-elevated p-7 sm:p-8">
      <h3 className="text-xl font-extrabold">اطلب خدمة</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        اختر الخدمات التي تحتاجها ضمن {categoryTitle}، وسيصلك فريقنا بعد مراجعة الطلب.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const id = `${idPrefix}-${item}`;
          return (
            <label
              key={item}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
            >
              <Checkbox
                id={id}
                checked={selected.includes(item)}
                onCheckedChange={() => toggle(item)}
                className="mt-0.5"
              />
              <span className="min-w-0 text-sm font-semibold leading-relaxed">{item}</span>
            </label>
          );
        })}
      </div>
      {errors["services"] && (
        <p className="mt-3 text-xs font-semibold text-destructive">{errors["services"]}</p>
      )}

      <div className="mt-6">
        <AuthGate>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("name", "الاسم")}
            {field("org", "اسم الجهة")}
            {field("phone", "رقم الجوال", "tel")}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="mt-6 rounded-full px-7 font-bold"
          >
            إرسال الطلب
          </Button>
        </AuthGate>
      </div>
    </form>
  );
}
