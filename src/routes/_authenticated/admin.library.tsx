import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import {
  getAllLibraryFilesAdmin,
  createOrUpdateLibraryFile,
  deleteLibraryFile,
  type LibraryFile,
} from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/library")({
  component: AdminLibraryPage,
});

type FormState = {
  id?: string;
  title: string;
  description: string;
  category: string;
  iconName: string;
  sortOrder: number;
  isPublished: boolean;
  file: File | null;
  existingPath?: string;
};

const CATS = ["عام", "حوكمة", "تمويل واستدامة", "تسويق وحضور رقمي", "مشاريع وإغاثة", "نماذج مستندات"];
const ICONS = ["BookOpen", "ShieldCheck", "BadgeCheck", "FileText", "BarChart3", "ClipboardCheck", "Download"];

function AdminLibraryPage() {
  const [rows, setRows] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    category: "عام",
    iconName: "BookOpen",
    sortOrder: 0,
    isPublished: true,
    file: null,
  });
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setRows(await getAllLibraryFilesAdmin());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  const openNew = () => {
    setForm({
      title: "",
      description: "",
      category: "عام",
      iconName: "BookOpen",
      sortOrder: 0,
      isPublished: true,
      file: null,
    });
    setOpen(true);
  };

  const openEdit = (r: LibraryFile) => {
    setForm({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      category: r.category,
      iconName: r.icon_name,
      sortOrder: r.sort_order,
      isPublished: r.is_published,
      file: null,
      existingPath: r.file_path,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("عنوان الملف مطلوب");
    if (!form.id && !form.file) return toast.error("يرجى اختيار الملف للرفع");
    setBusy(true);
    try {
      await createOrUpdateLibraryFile({
        id: form.id,
        title: form.title,
        description: form.description,
        category: form.category,
        iconName: form.iconName,
        sortOrder: Number(form.sortOrder || 0),
        isPublished: form.isPublished,
        file: form.file,
        existingPath: form.existingPath,
      });
      toast.success(form.id ? "تم تحديث الملف" : "تمت إضافة الملف");
      setOpen(false);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: LibraryFile) => {
    if (!confirm(`تأكيد حذف الملف: ${r.title}؟`)) return;
    try {
      await deleteLibraryFile(r.id);
      toast.success("تم الحذف");
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحذف";
      toast.error(msg);
    }
  };

  const swap = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    await Promise.all([
      supabase.from("library_files").update({ sort_order: b.sort_order } as never).eq("id", a.id),
      supabase.from("library_files").update({ sort_order: a.sort_order } as never).eq("id", b.id),
    ]);
    await reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة مكتبة الملفات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إضافة وتعديل وحذف وترتيب ملفات مكتبة Open Loop مع تتبع عدد مرات التحميل.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          <span className="mr-2">إضافة ملف جديد</span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">الترتيب</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>التحميلات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[220px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    جارٍ التحميل...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    لا توجد ملفات. اضغط إضافة ملف جديد للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => swap(i, -1)}>
                          ↑
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === rows.length - 1} onClick={() => swap(i, 1)}>
                          ↓
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.description || "بدون وصف"}</div>
                    </TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-bold">
                        <Download className="ml-1 h-3 w-3" />
                        {r.download_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.is_published ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">منشور</Badge>
                      ) : (
                        <Badge variant="outline">مسودة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل ملف مكتبة" : "إضافة ملف مكتبة جديد"}</DialogTitle>
            <DialogDescription>املأ الحقول التالية ثم اضغط حفظ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label>العنوان</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: فهرس اللوائح والسياسات"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>الوصف</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الأيقونة</Label>
                <Select value={form.iconName} onValueChange={(v) => setForm({ ...form, iconName: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>رقم الترتيب (أصغر يظهر أولاً)</Label>
                <Input
                  type="number"
                  value={String(form.sortOrder)}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || 0) })}
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(c) => setForm({ ...form, isPublished: c })}
                />
                <Label className="cursor-pointer">منشور للجمهور</Label>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label>الملف (PDF/صورة - حتى 20MB)</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-4 py-3">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    {form.file ? (
                      <div className="text-sm">
                        {form.file.name} (
                        {(form.file.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    ) : form.existingPath ? (
                      <div className="text-sm text-muted-foreground">
                        ملف حالي محفوظ: {form.existingPath}
                        <br />
                        <span className="text-xs">اختر ملفاً جديداً لاستبداله أو اتركه كما هو.</span>
                      </div>
                    ) : (
                      <label className="block cursor-pointer text-sm text-muted-foreground hover:text-primary dark:hover:text-gold">
                        اضغط لاختيار الملف
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*,.doc,.docx"
                          onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={save} disabled={busy}>
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
