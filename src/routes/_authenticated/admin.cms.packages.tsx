import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CmsPackage } from "@/lib/cms";
import { cn } from "@/lib/utils";
import { packages as fallbackPkgs } from "@/data/site";

export const Route = createFileRoute("/_authenticated/admin/cms/packages")({
  component: AdminCmsPackages,
});

type PkgForm = {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  featuresStr: string;
  price: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  tiersStr: string;
};

function AdminCmsPackages() {
  const [rows, setRows] = useState<CmsPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PkgForm>({
    slug: "",
    title: "",
    subtitle: "",
    featuresStr: "",
    price: "",
    is_featured: false,
    is_published: true,
    sort_order: 0,
    tiersStr: "",
  });

  const reload = async () => {
    setLoading(true);
    const { data: pkgs } = await supabase
      .from("cms_packages")
      .select("*")
      .order("sort_order");
    const list = (pkgs ?? []) as CmsPackage[];
    for (const p of list) {
      const { data: tiers } = await supabase
        .from("cms_package_tiers")
        .select("label, price")
        .eq("package_id", p.id)
        .order("sort_order");
      p.tiers = (tiers ?? []) as { label: string; price: string }[];
    }
    if (list.length === 0) {
      const seeds: CmsPackage[] = fallbackPkgs.map((p, i) => ({
        id: `seed-${p.id}`,
        slug: p.id,
        title: p.title,
        subtitle: p.subtitle ?? null,
        features: p.features,
        price: p.price ?? null,
        is_featured: !!p.featured,
        is_published: true,
        sort_order: i,
        tiers: p.tiers ?? [],
      }));
      setRows(seeds);
    } else {
      setRows(list);
    }
    setLoading(false);
  };
  useEffect(() => {
    void reload();
  }, []);

  const openNew = () =>
    setForm({
      slug: "",
      title: "",
      subtitle: "",
      featuresStr: "",
      price: "",
      is_featured: false,
      is_published: true,
      sort_order: (rows[rows.length - 1]?.sort_order ?? -1) + 1,
      tiersStr: "",
    });
  const openEdit = (p: CmsPackage) =>
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle ?? "",
      featuresStr: p.features.join("\n"),
      price: p.price ?? "",
      is_featured: p.is_featured,
      is_published: p.is_published,
      sort_order: p.sort_order,
      tiersStr: (p.tiers ?? []).map((t) => `${t.label} - ${t.price}`).join("\n"),
    });

  const save = async () => {
    if (!form.title || !form.slug) return toast.error("العنوان والـ slug مطلوبان");
    setBusy(true);
    try {
      const payload = {
        slug: form.slug,
        title: form.title,
        subtitle: form.subtitle || null,
        features: form.featuresStr.split("\n").map((s) => s.trim()).filter(Boolean),
        price: form.price || null,
        is_featured: form.is_featured,
        is_published: form.is_published,
        sort_order: Number(form.sort_order || 0),
      };
      let id = form.id;
      if (id && id.startsWith("seed-")) {
        const { data } = await supabase
          .from("cms_packages")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        id = (data as { id: string } | null)?.id;
      } else if (id) {
        await supabase.from("cms_packages").update(payload as never).eq("id", id);
      } else {
        const { data } = await supabase
          .from("cms_packages")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        id = (data as { id: string } | null)?.id;
      }
      if (id && !id.startsWith("seed-")) {
        await supabase.from("cms_package_tiers").delete().eq("package_id", id);
        const lines = form.tiersStr.split("\n").map((s) => s.trim()).filter(Boolean);
        const inserts = lines
          .map((line, i) => {
            const sep = line.lastIndexOf("-");
            const label = sep === -1 ? line : line.slice(0, sep).trim();
            const price = sep === -1 ? "—" : line.slice(sep + 1).trim();
            return { package_id: id, label, price, sort_order: i };
          });
        if (inserts.length) {
          await supabase.from("cms_package_tiers").insert(inserts as never);
        }
      }
      toast.success("تم الحفظ");
      setOpen(false);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: CmsPackage) => {
    if (!confirm(`تأكيد حذف الباقة: ${p.title}؟`)) return;
    if (p.id.startsWith("seed-")) {
      setRows((prev) => prev.filter((x) => x.id !== p.id));
      return;
    }
    try {
      await supabase.from("cms_packages").delete().eq("id", p.id);
      toast.success("تم الحذف");
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحذف";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة الباقات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            باقات الخدمات الشهرية والسنوية وأسعارها ومميزات كل باقة.
          </p>
        </div>
        <Button onClick={() => { openNew(); setOpen(true); }}>
          <Plus className="h-4 w-4" />
          <span className="mr-2">إضافة باقة</span>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/60 py-12 text-center text-sm text-muted-foreground">
          جارٍ التحميل...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "flex flex-col border-2",
                p.is_featured ? "border-primary shadow-lg" : "border-border/60"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-extrabold">{p.title}</CardTitle>
                    <CardDescription className="mt-1">{p.subtitle}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.is_featured ? (
                      <Badge className="bg-gold text-gold-foreground">
                        <Star className="h-3 w-3" />
                        مميزة
                      </Badge>
                    ) : p.is_published ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700">منشورة</Badge>
                    ) : (
                      <Badge variant="outline">مسودة</Badge>
                    )}
                  </div>
                </div>
                {p.price ? (
                  <div className="mt-3 text-3xl font-extrabold">{p.price}</div>
                ) : p.tiers && p.tiers.length ? (
                  <div className="mt-3 space-y-1 text-sm">
                    {p.tiers.map((t, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5">
                        <span className="font-bold">{t.label}</span>
                        <span className="text-primary dark:text-gold">{t.price}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary dark:text-gold">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { openEdit(p); setOpen(true); }}>
                  <Edit3 className="h-4 w-4" />
                  <span className="mr-1">تعديل</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل باقة" : "إضافة باقة"}</DialogTitle>
            <DialogDescription>بيانات الباقة ومميزاتها والشرائح.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Slug (فريد)</Label>
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>السعر (نص) أو اتركه فارغاً واستخدم شرائح أسعار</Label>
              <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>الوصف المختصر</Label>
              <Textarea
                rows={2}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>المميزات (سطر لكل ميزة)</Label>
              <Textarea
                rows={8}
                value={form.featuresStr}
                onChange={(e) => setForm({ ...form, featuresStr: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>
                شرائح الأسعار (سطر لكل شرحة بصيغة: اسم الشرحة - السعر)
              </Label>
              <Textarea
                rows={4}
                value={form.tiersStr}
                onChange={(e) => setForm({ ...form, tiersStr: e.target.value })}
                placeholder={"أساسية - 2500 ر.س\\nمتقدمة - 5000 ر.س"}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_featured}
                onCheckedChange={(c) => setForm({ ...form, is_featured: c })}
              />
              <Label className="cursor-pointer">باقة مميزة</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_published}
                onCheckedChange={(c) => setForm({ ...form, is_published: c })}
              />
              <Label className="cursor-pointer">منشورة</Label>
            </div>
            <div className="space-y-1">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={String(form.sort_order)}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value || 0) })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={save} disabled={busy}>
              <Save className="h-4 w-4" />
              <span className="mr-2">حفظ</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
