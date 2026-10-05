import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Mail, Phone, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { serviceCategories } from "@/data/site";
import { createBooking } from "@/lib/bookings";

export const Route = createFileRoute("/booking")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "احجز استشارتك | أوبن لوب" },
      {
        name: "description",
        content:
          "احجز جلسة استشارية مع فريق أوبن لوب لمناقشة الاستدامة المالية والحوكمة والتسويق لكيانك غير الربحي.",
      },
      { property: "og:title", content: "احجز استشارتك مع أوبن لوب" },
      {
        property: "og:description",
        content: "جلسة استشارية تحدد أولويات النمو والتمويل والحضور الرقمي لجمعيتك.",
      },
    ],
  }),
  component: Booking,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب").max(100),
  entityName: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(8, "رقم جوال غير صحيح").max(25),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  service: z.string().trim().min(1, "يرجى اختيار مجال الاستشارة").max(100),
  note: z.string().trim().max(3000, "التفاصيل طويلة جداً").optional(),
});

function Booking() {
  const [busy, setBusy] = useState(false);
  const [service, setService] = useState<string>("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setDone(false), 5000);
      return () => clearTimeout(t);
    }
  }, [done]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      fullName: form.get("fullName"),
      entityName: form.get("entityName"),
      phone: form.get("phone"),
      email: form.get("email"),
      service,
      note: form.get("note"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }
    setBusy(true);
    const res = await createBooking({
      fullName: parsed.data.fullName,
      entityName: parsed.data.entityName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      serviceCategory: parsed.data.service,
      note: parsed.data.note,
      honeypot: String(form.get("website_company_field") ?? ""),
      attachment,
    });
    setBusy(false);
    if (res.error) {
      toast.error("تعذر إرسال الطلب", { description: res.error });
      return;
    }
    toast.success("تم استقبال طلبك بنجاح");
    (e.target as HTMLFormElement).reset();
    setAttachment(null);
    setService("");
    setDone(true);
  };

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-5xl">احجز استشارتك</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            أخبرنا عن كيانك واحتياجك، وسيتواصل معك فريقنا خلال يومي عمل لتحديد موعد الجلسة.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <div className="card-elevated p-8">
            {done && (
              <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-700 dark:text-emerald-300">
                شكراً لتواصلكم! تم استقبال طلبكم بنجاح وسيقوم أحد مستشارينا بالتواصل معكم
                خلال يومي عمل.
              </div>
            )}
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
              <div aria-hidden="true" className="hidden">
                <Label htmlFor="website_company_field">
                  لا تملأ هذا الحقل (إذا كنت بشرياً)
                </Label>
                <Input
                  id="website_company_field"
                  name="website_company_field"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="b-name">الاسم الكامل</Label>
                <Input id="b-name" name="fullName" placeholder="اكتب اسمك" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-entity">اسم الجمعية / الكيان</Label>
                <Input id="b-entity" name="entityName" placeholder="اسم الكيان غير الربحي" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-phone">رقم الجوال</Label>
                <Input
                  id="b-phone"
                  name="phone"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-email">البريد الإلكتروني</Label>
                <Input
                  id="b-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  placeholder="name@email.com"
                  required
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="b-service">مجال الاستشارة</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger id="b-service" className="w-full">
                    <SelectValue placeholder="اختر المجال" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.title}
                      </SelectItem>
                    ))}
                    <SelectItem value="packages">الباقات والأسعار</SelectItem>
                    <SelectItem value="other">غير محدد / استشارة عامة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="b-note">تفاصيل الاحتياج</Label>
                <Textarea
                  id="b-note"
                  name="note"
                  rows={5}
                  placeholder="اشرح لنا وضعكم الحالي وأهدافكم..."
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>مرفق يوضح الحالة (اختياري - PDF/صورة بحد أقصى 10MB)</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-4 py-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    {attachment ? (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm">{attachment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 rounded-full p-0 text-destructive"
                          onClick={() => setAttachment(null)}
                          aria-label="إزالة الملف"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer text-sm text-muted-foreground hover:text-primary dark:hover:text-gold">
                        اضغط هنا لاختيار ملف
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="rounded-full font-bold sm:col-span-2"
                disabled={busy}
              >
                {busy ? "جارٍ الإرسال..." : "إرسال طلب الحجز"}
              </Button>
            </form>
          </div>

          <aside className="card-elevated h-fit p-8">
            <CalendarClock className="h-8 w-8 text-primary dark:text-gold" aria-hidden />
            <h2 className="mt-4 text-lg font-extrabold">تواصل مباشر</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              الأحد – الخميس، 8 صباحاً حتى 2:30 ظهراً.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary dark:text-gold" />
                <a
                  href="mailto:openloop2030@gmail.com"
                  className="hover:text-primary dark:hover:text-gold"
                >
                  openloop2030@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary dark:text-gold" />
                <a
                  href="https://wa.me/966556006142"
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="hover:text-primary dark:hover:text-gold"
                >
                  0556006142
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </>
  );
}
