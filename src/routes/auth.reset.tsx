import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/reset")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "تعيين كلمة المرور الجديدة | أوبن لوب" },
      { name: "description", content: "تعيين كلمة مرور جديدة لحساب أوبن لوب." },
    ],
  }),
  component: AuthResetPage,
});

function AuthResetPage() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const hash = window.location.hash;
      const qs = new URLSearchParams(hash.replace(/^#/, ""));
      const token = qs.get("access_token") ?? qs.get("token");
      const type = qs.get("type");
      if (token && type === "recovery" && !session) {
        const { error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: qs.get("refresh_token") ?? "",
        });
        if (error) {
          toast.error("الرابط غير صالح أو منتهي الصلاحية");
        }
      }
    })();
  }, [session]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("يجب أن تكون كلمة المرور 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح");
      setTimeout(() => (window.location.href = "/dashboard"), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر التحديث";
      toast.error("تعذر تغيير كلمة المرور", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-4xl">تعيين كلمة مرور جديدة</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed opacity-80">
            أدخل كلمة مرور جديدة لحسابك وتأكد من قوتها واحتوائها على 6 أحرف على الأقل.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="card-elevated p-7">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np-pass">كلمة المرور الجديدة</Label>
                <Input
                  id="np-pass"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="np-confirm"
                  type="password"
                  dir="ltr"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full rounded-full font-bold">
                حفظ كلمة المرور
              </Button>
              <div className="text-center text-sm">
                <Link
                  to="/auth"
                  className="text-primary hover:underline dark:text-gold"
                >
                  العودة إلى صفحة تسجيل الدخول
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
