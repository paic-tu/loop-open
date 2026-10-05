import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Download,
  ShieldCheck,
  BookOpen,
  BadgeCheck,
  FileText,
  BarChart3,
  ClipboardCheck,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/Sections";
import { JoinBanner } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPublishedLibraryFiles,
  getLibraryFileSignedUrl,
  incrementDownloadCount,
  type LibraryFile,
} from "@/lib/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "مكتبة أوبن لوب | أدلة ونماذج مجانية للقطاع غير الربحي" },
      {
        name: "description",
        content:
          "مكتبة أوبن لوب: نماذج ولوائح وأدلة وأطر عمل مجانية قابلة للتحميل تساعد الجمعيات على الحوكمة والاستدامة المالية وبناء الأثر.",
      },
      { property: "og:title", content: "مكتبة أوبن لوب — موارد مجانية للجمعيات" },
      {
        property: "og:description",
        content: "حمّل نماذج ولوائح وأدلة وأطر عمل جاهزة مجاناً لتطوير عمل جمعيتك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const ICONS: Record<string, typeof ShieldCheck> = {
  ShieldCheck,
  BookOpen,
  BadgeCheck,
  FileText,
  BarChart3,
  ClipboardCheck,
  Download,
};

function pickIcon(name: string | null) {
  if (!name) return BookOpen;
  return ICONS[name] ?? BookOpen;
}

function LibraryPage() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getPublishedLibraryFiles();
        setFiles(data);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = Array.from(new Set(files.map((f) => f.category)));
  const filtered = files.filter((f) => {
    const matchQ =
      !query ||
      (f.title + " " + (f.description ?? "")).toLowerCase().includes(query.toLowerCase());
    const matchC = category === "all" || f.category === category;
    return matchQ && matchC;
  });

  const handleDownload = async (f: LibraryFile) => {
    try {
      const signed = await getLibraryFileSignedUrl(f.file_path);
      if (!signed) {
        // Fallback: attempt direct public URL
        const { data } = await import("@/integrations/supabase/client").then(
          (m) => m.supabase.storage.from("library").getPublicUrl(f.file_path).data
        );
        if (!data) throw new Error("لا يمكن تحميل الملف حالياً");
        window.open(data.publicUrl, "_blank", "noopener noreferrer");
      } else {
        window.open(signed, "_blank", "noopener noreferrer");
      }
      await incrementDownloadCount(f.id);
      setFiles((prev) =>
        prev.map((p) => (p.id === f.id ? { ...p, download_count: p.download_count + 1 } : p))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ أثناء التحميل";
      toast.error("تعذر تحميل الملف", { description: msg });
    }
  };

  return (
    <>
      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-bold">
            <BookOpen className="h-4 w-4" aria-hidden />
            موارد مجانية
          </span>
          <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-[1.35] sm:text-4xl">
            مكتبة أوبن لوب
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80 sm:text-base">
            نماذج ولوائح وأدلة وأطر عمل جاهزة للتحميل مجاناً، صُممت لمساعدة الجمعيات
            والمؤسسات الأهلية على رفع جاهزيتها المؤسسية وتسريع أثرها.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="تحميل مباشر"
            title="أحدث الملفات والنماذج"
            description="اختر الملف المناسب لجمعيتك وحمّله مباشرة دون تسجيل."
          />

          <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في عنوان أو وصف الملف..."
                className="pr-10"
              />
            </div>
            <div className="sm:min-w-[220px]">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع التصنيفات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التصنيفات</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {loading && (
              <div className="md:col-span-2 py-16 text-center text-sm text-muted-foreground">
                جارٍ تحميل المكتبة...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="md:col-span-2 rounded-2xl border border-dashed border-border bg-background/40 py-16 text-center text-sm text-muted-foreground">
                لا توجد ملفات مطابقة لعرضها حالياً.
              </div>
            )}
            {!loading &&
              filtered.map((r) => {
                const Icon = pickIcon(r.icon_name);
                return (
                  <article
                    key={r.id}
                    className="card-elevated flex flex-col p-7"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="mt-5 flex items-start justify-between gap-3">
                      <h2 className="text-base font-extrabold leading-snug">
                        {r.title}
                      </h2>
                      {r.category && r.category !== "general" ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary dark:text-gold"
                          )}
                        >
                          {r.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {r.description || "نموذج / دليل جاهز للتحميل مجاناً."}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        className="rounded-full font-bold"
                        onClick={() => handleDownload(r)}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        تحميل الملف
                      </Button>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-gold-foreground">
                        <BadgeCheck className="h-4 w-4" aria-hidden />
                        تحميل مجاني
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Download className="h-3.5 w-3.5" />
                        {r.download_count}
                      </span>
                    </div>
                  </article>
                );
              })}
          </div>
        </div>
      </section>

      <JoinBanner />
    </>
  );
}
