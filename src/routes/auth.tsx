import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

type NetStatus = "checking" | "online" | "offline";

function explainNetworkError(e: unknown): { title: string; desc: string; isNetwork: boolean } {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const isNetwork =
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("ERR_NAME_NOT_RESOLVED") ||
    msg.includes("DNS") ||
    msg.includes("net::") ||
    msg.toLowerCase().includes("timed out") ||
    msg.toLowerCase().includes("abort");

  if (!isNetwork) return { title: "تعذر تسجيل الدخول", desc: msg, isNetwork: false };

  return {
    title: "تعذر الاتصال بخوادم أوبن لوب",
    desc:
      "يبدو أن جهازك لا يستطيع الوصول إلى خوادم Supabase بسبب مشكلة DNS أو اتصال الإنترنت. " +
      "حول إعدادات DNS إلى Google (8.8.8.8) أو Cloudflare (1.1.1.1) ثم أعد تشغيل المتصفح.",
    isNetwork: true,
  };
}

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | أوبن لوب" },
      {
        name: "description",
        content: "سجّل الدخول أو أنشئ حساباً في أوبن لوب لمتابعة طلباتك وخدماتك.",
      },
      { property: "og:title", content: "تسجيل الدخول | أوبن لوب" },
      { property: "og:description", content: "حساب أوبن لوب لإدارة طلباتك ومتابعة حالتها." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "الرجاء إدخال الاسم الكامل").max(100),
  email: z.string().trim().email("بريد إلكتروني غير صحيح").max(255),
  phone: z.string().trim().min(8, "رقم جوال غير صحيح").max(20),
  organization: z.string().trim().max(120).optional(),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, roles, rolesLoading, resetPasswordEmail } = useAuth();
  const search = useSearch({ from: "/auth" });
  const [busy, setBusy] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [redirected, setRedirected] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">("signin");
  const [netStatus, setNetStatus] = useState<NetStatus>("checking");

  const explicitRedirect = search.redirect && search.redirect.startsWith("/") ? search.redirect : undefined;

  useEffect(() => {
    let cancelled = false;
    const SUPABASE_URL =
      (import.meta.env?.["VITE_SUPABASE_URL"] as string | undefined) ||
      (process.env?.["SUPABASE_URL"] as string | undefined) ||
      "https://berprxhuguniggtnerfq.supabase.co";
    const probe = `${SUPABASE_URL}/auth/v1/health`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(probe, { method: "GET", signal: ctrl.signal, mode: "no-cors" })
      .then(() => {
        if (cancelled) return;
        setNetStatus("online");
      })
      .catch(() => {
        if (cancelled) return;
        setNetStatus("offline");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (redirected) return;
    if (rolesLoading) return;
    const isStaff = roles.includes("staff") || roles.includes("admin");
    const defaultDest = isStaff ? "/admin" : "/dashboard";
    const to = explicitRedirect ?? defaultDest;
    setRedirected(true);
    void navigate({ to, replace: true });
  }, [user, roles, rolesLoading, explicitRedirect, navigate, redirected]);

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setBusy(false);
    if (error) {
      const explained = explainNetworkError(error);
      toast.error(explained.title, {
        description: explained.desc,
        duration: explained.isNetwork ? 12000 : 6000,
      });
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
  };

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      phone: form.get("phone"),
      organization: form.get("organization") ?? "",
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          organization: parsed.data.organization ?? "",
        },
      },
    });
    setBusy(false);
    if (error) {
      const explained = explainNetworkError(error);
      toast.error(
        explained.isNetwork ? explained.title : "تعذر إنشاء الحساب",
        { description: explained.desc, duration: explained.isNetwork ? 12000 : 6000 },
      );
      return;
    }
    if (!data.session) {
      toast.success("تم إنشاء الحساب", {
        description: "تفقّد بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.",
      });
      return;
    }
    toast.success("تم إنشاء الحساب بنجاح");
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      const explained = explainNetworkError(result.error);
      toast.error(explained.title, { description: explained.desc });
      return;
    }
    if (result.redirected) return;
    toast.success("تم تسجيل الدخول بنجاح");
  };

  const sendForgot = async () => {
    if (!forgotEmail || !z.string().email().safeParse(forgotEmail).success) {
      toast.error("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordEmail(forgotEmail);
      toast.success("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني", {
        description: "افتح الرابط خلال مدة صلاحيته لتعيين كلمة مرور جديدة.",
      });
    } catch (e: unknown) {
      const explained = explainNetworkError(e);
      toast.error(
        explained.isNetwork ? explained.title : "تعذر إرسال الرابط",
        { description: explained.desc, duration: explained.isNetwork ? 12000 : 6000 },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-4xl">حساب أوبن لوب</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed opacity-80">
            أنشئ حسابك لإرسال الطلبات ومتابعة حالتها ومستنداتك من لوحة تحكم واحدة.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          {netStatus !== "online" && (
            <div
              className={cn(
                "mb-5 flex items-start gap-3 rounded-2xl border p-4",
                netStatus === "checking"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  : "border-destructive/60 bg-destructive/10 text-destructive",
              )}
            >
              {netStatus === "checking" ? (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">
                    {netStatus === "checking"
                      ? "جارٍ فحص الاتصال بخوادم أوبن لوب…"
                      : "لا يوجد اتصال بخوادم أوبن لوب"}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border-0 px-2 py-0.5 text-[10px] font-extrabold",
                      netStatus === "checking"
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-200"
                        : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {netStatus === "checking" ? "Checking…" : "Offline"}
                  </Badge>
                </div>
                {netStatus === "offline" && (
                  <ul className="list-disc space-y-1 pr-5 text-xs leading-relaxed opacity-90">
                    <li>تأكد من تشغيل الإنترنت على جهازك.</li>
                    <li>
                      غيّر إعدادات DNS إلى{" "}
                      <span className="font-extrabold">8.8.8.8</span> (Google) أو{" "}
                      <span className="font-extrabold">1.1.1.1</span> (Cloudflare) من إعدادات الشبكة.
                    </li>
                    <li>أوقِف بروكسي أو VPN أو برنامج الحماية المؤقت ثم أعد التحديث F5.</li>
                    <li>
                      إن استمرت المشكلة، تواصل معنا عبر الواتساب:{" "}
                      <a
                        href="https://wa.me/966556006142"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 font-bold"
                      >
                        0556006142
                      </a>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}

          {netStatus === "online" && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:text-emerald-300">
              <Wifi className="h-4 w-4 shrink-0" />
              <p className="text-xs font-bold">الإنترنت متاح — جاهز لتسجيل الدخول</p>
            </div>
          )}

          <div className="card-elevated p-7">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3 rounded-full">
                <TabsTrigger value="signin" className="rounded-full font-bold">
                  تسجيل الدخول
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full font-bold">
                  إنشاء حساب
                </TabsTrigger>
                <TabsTrigger value="forgot" className="rounded-full font-bold">
                  نسيت كلمة المرور
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">البريد الإلكتروني</Label>
                    <Input id="si-email" name="email" type="email" dir="ltr" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pass">كلمة المرور</Label>
                    <Input id="si-pass" name="password" type="password" dir="ltr" required />
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <label className="flex cursor-pointer items-center gap-2 select-none">
                      <input
                        type="checkbox"
                        name="remember"
                        id="si-remember"
                        className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">تذكرني</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab("forgot")}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors relative group"
                    >
                      <span className="border-b border-indigo-300/60 pb-[1px] group-hover:border-indigo-600 transition-colors">
                        نسيت كلمة المرور؟
                      </span>
                    </button>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-full font-bold">
                    دخول
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">الاسم الكامل</Label>
                    <Input id="su-name" name="fullName" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-org">اسم الجهة / الجمعية (اختياري)</Label>
                    <Input id="su-org" name="organization" maxLength={120} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-phone">رقم الجوال</Label>
                    <Input id="su-phone" name="phone" type="tel" dir="ltr" required maxLength={20} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">البريد الإلكتروني</Label>
                    <Input id="su-email" name="email" type="email" dir="ltr" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">كلمة المرور</Label>
                    <Input id="su-pass" name="password" type="password" dir="ltr" required />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-full font-bold">
                    إنشاء الحساب
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="forgot">
                <div className="mt-6 space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    أدخل بريدك الإلكتروني المسجل وستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة
                    المرور خلال دقائق. إذا لم تصلك الرسالة، تأكد من مجلد البريد غير الهام
                    (Spam/Junk) أو تواصل معنا عبر الواتساب.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="fg-email">البريد الإلكتروني</Label>
                    <Input
                      id="fg-email"
                      type="email"
                      dir="ltr"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@email.com"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={sendForgot}
                    disabled={busy}
                    className="w-full rounded-full font-bold"
                  >
                    إرسال رابط إعادة التعيين
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={google}
              className="w-full rounded-full font-bold"
            >
              المتابعة عبر Google
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
