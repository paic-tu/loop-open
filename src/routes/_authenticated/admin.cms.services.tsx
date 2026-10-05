import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { CmsServiceCat } from "@/lib/cms";

export const Route = createFileRoute("/_authenticated/admin/cms/services")({
  component: AdminCmsServices,
});

type EditForm = {
  id?: string;
  slug: string;
  display_order: string;
  title: string;
  description: string;
  iconName: string;
  sort_order: number;
  is_published: boolean;
  itemsStr: string;
};

function AdminCmsServices() {
  const [rows, setRows] = useState<CmsServiceCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<EditForm>({
    slug: "",
    display_order: "10",
    title: "",
    description: "",
    iconName: "",
    sort_order: 0,
    is_published: true,
    itemsStr: "",
  });

  const reload = async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("cms_service_categories")
      .select("*")
      .order("sort_order");
    const list = (cats ?? []) as CmsServiceCat[];
    for (const c of list) {
      const [{ data: it }, { data: dt }] = await Promise.all([
        supabase.from("cms_service_items").select("title").eq("category_id", c.id).order("sort_order"),
        supabase
          .from("cms_service_details")
          .select("title, description")
          .eq("category_id", c.id)
          .order("sort_order"),
      ]);
      c.items = (it ?? []).map((x) => x.title);
      c.details = (dt ?? []) as { title: string; description: string }[];
    }
    setRows(list.length ? list : fallback());
    setLoading(false);
  };

  const fallback = (): CmsServiceCat[] =>
    [
      {
        slug: "financial-sustainability",
        display_order: "01",
        title: "الاستدامة المالية",
        description: "نموذج تمويلي متين يجمع بين الإيرادات المكتسبة والمنح والشراكات الاستراتيجية",
        icon_name: "Landmark",
        is_published: true,
        sort_order: 1,
        items: [
          "بناء وإدارة صناديق الاستدامة الوقفية",
          "إعداد استراتيجيات تمويل متعددة المصادر",
          "دراسات الجدوى الاقتصادية للمشاريع المدرة للدخل",
          "إعداد التقارير المالية وحوكمة الصناديق",
          "تصميم برامج الاسترداد الضريبي",
        ],
      },
      {
        slug: "governance",
        display_order: "02",
        title: "الحوكمة والامتثال",
        description: "بناء أنظمة حوكمة شفافة ومتوافقة مع متطلبات الجهات الرقابية",
        icon_name: "Scale",
        is_published: true,
        sort_order: 2,
        items: [
          "تقييم النضج المؤسسي (Maturity Assessment)",
          "إعداد وإعادة هيكلة مجلس الإدارة واللجان",
          "صياغة اللوائح والسياسات الداخلية",
          "الامتثال للمتطلبات التنظيمية (الوزارات، هيئة الزكاة)",
          "برامج الجودة والمعايير المهنية",
        ],
      },
    ].map((x, i) => ({ ...x, id: `seed-${i}` }));

  useEffect(() => {
    void reload();
  }, []);

  const openNew = () => {
    setForm({
      slug: "",
      display_order: String(rows.length + 1).padStart(2, "0"),
      title: "",
      description: "",
      iconName: "",
      sort_order: (rows[rows.length - 1]?.sort_order ?? 0) + 1,
      is_published: true,
      itemsStr: "",
    });
    setOpen(true);
  };
  const openEdit = (c: CmsServiceCat) => {
    setForm({
      id: c.id,
      slug: c.slug,
      display_order: c.display_order,
      title: c.title,
      description: c.description ?? "",
      iconName: c.icon_name ?? "",
      sort_order: c.sort_order,
      is_published: c.is_published,
      itemsStr: c.items.join("\n"),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.slug) return toast.error("العنوان والـ slug مطلوبان");
    setBusy(true);
    try {
      const payload = {
        slug: form.slug,
        display_order: form.display_order,
        title: form.title,
        description: form.description || null,
        icon_name: form.iconName || null,
        sort_order: Number(form.sort_order || 0),
        is_published: form.is_published,
      };
      let catId = form.id;
      if (form.id && !form.id.startsWith("seed-")) {
        await supabase
          .from("cms_service_categories")
          .update(payload as never)
          .eq("id", form.id);
      } else if (form.id && form.id.startsWith("seed-")) {
        const { data } = await supabase
          .from("cms_service_categories")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        catId = (data as { id: string } | null)?.id;
      } else {
        const { data } = await supabase
          .from("cms_service_categories")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        catId = (data as { id: string } | null)?.id;
      }
      if (catId && !catId.startsWith("seed-")) {
        await supabase.from("cms_service_items").delete().eq("category_id", catId);
        const items = form.itemsStr
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (items.length) {
          await supabase
            .from("cms_service_items")
            .insert(
              items.map((t, i) => ({ category_id: catId, title: t, sort_order: i })) as never
            );
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

  const remove = async (c: CmsServiceCat) => {
    if (!confirm(`تأكيد حذف الخدمة: ${c.title}؟`)) return;
    if (c.id.startsWith("seed-")) {
      setRows((prev) => prev.filter((x) => x.id !== c.id));
      return;
    }
    try {
      await supabase.from("cms_service_categories").delete().eq("id", c.id);
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
          <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة الخدمات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            فئات الخدمات وعناصر كل فئة.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          <span className="mr-2">إضافة خدمة</span>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/60 py-12 text-center text-sm text-muted-foreground">
          جارٍ التحميل...
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {rows.map((c, i) => (
            <AccordionItem
              value={c.id}
              key={c.id}
              className="overflow-hidden rounded-2xl border border-border/60 px-4"
            >
              <div className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {c.display_order}
                    </Badge>
                    <span className="font-extrabold">{c.title}</span>
                    {c.is_published ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700">منشورة</Badge>
                    ) : (
                      <Badge variant="outline">مسودة</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.slug} • {c.items.length} عنصر
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <AccordionTrigger className="ml-2 w-auto border-0 p-0 hover:no-underline">
                    <span className="sr-only">تفاصيل</span>
                    <ChevronDown className="h-4 w-4 accordion-chevron" />
                  </AccordionTrigger>
                </div>
              </div>
              <AccordionContent className="pb-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <ul className="mt-3 list-disc space-y-1 pr-6 text-sm">
                  {c.items.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل خدمة" : "إضافة خدمة"}</DialogTitle>
            <DialogDescription>بيانات فئة الخدمة وعناصرها.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>العنوان</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Slug (فريد)</Label>
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="financial-sustainability"
              />
            </div>
            <div className="space-y-1">
              <Label>Display Order</Label>
              <Input
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>الوصف</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>اسم الأيقونة (Lucide)</Label>
              <Input
                value={form.iconName}
                onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                placeholder="Landmark"
              />
            </div>
            <div className="space-y-1">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={String(form.sort_order)}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value || 0) })}
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
              <Switch
                checked={form.is_published}
                onCheckedChange={(c) => setForm({ ...form, is_published: c })}
              />
              <Label className="cursor-pointer">منشورة</Label>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>عناصر الخدمة (سطر = عنصر واحد)</Label>
              <Textarea
                rows={8}
                value={form.itemsStr}
                onChange={(e) => setForm({ ...form, itemsStr: e.target.value })}
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
