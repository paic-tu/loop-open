import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import type { CmsImpactStat, CmsPartner } from "@/lib/cms";

export const Route = createFileRoute("/_authenticated/admin/cms/site")({
  component: AdminCmsSite,
});

type SiteKeyContact = {
  email?: string;
  phone?: string;
  whatsapp?: string;
  working_hours?: string;
};
type SiteKeySocial = {
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
};

function AdminCmsSite() {
  const [busy, setBusy] = useState(false);

  const [contact, setContact] = useState<SiteKeyContact>({});
  const [social, setSocial] = useState<SiteKeySocial>({});
  const [stats, setStats] = useState<CmsImpactStat[]>([]);
  const [partners, setPartners] = useState<CmsPartner[]>([]);

  const load = async () => {
    const [{ data: s1 }, { data: s2 }, { data: st }, { data: p }] = await Promise.all([
      supabase.from("cms_site_settings").select("value").eq("key", "contact").maybeSingle(),
      supabase.from("cms_site_settings").select("value").eq("key", "social").maybeSingle(),
      supabase.from("cms_impact_stats").select("*").order("sort_order"),
      supabase.from("cms_partners").select("*").order("sort_order"),
    ]);
    setContact((s1?.value as SiteKeyContact) ?? {});
    setSocial((s2?.value as SiteKeySocial) ?? {});
    setStats((st as CmsImpactStat[]) ?? []);
    setPartners((p as CmsPartner[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await supabase
        .from("cms_site_settings")
        .upsert(
          [
            { key: "contact", value: contact },
            { key: "social", value: social },
          ] as never,
          { onConflict: "key" }
        );
      // Impact stats
      if (stats.length) {
        for (const s of stats) {
          await supabase
            .from("cms_impact_stats")
            .upsert(
              {
                id: s.id,
                stat_value: s.stat_value,
                title: s.title,
                description: s.description,
                icon_name: s.icon_name,
                sort_order: s.sort_order,
                is_published: s.is_published,
              } as never,
              { onConflict: "id" }
            );
        }
      }
      if (partners.length) {
        for (const p of partners) {
          await supabase
            .from("cms_partners")
            .upsert(
              {
                id: p.id,
                name: p.name,
                logo_url: p.logo_url,
                website_url: p.website_url,
                sort_order: p.sort_order,
                is_published: p.is_published,
              } as never,
              { onConflict: "id" }
            );
        }
      }
      toast.success("تم حفظ إعدادات الموقع");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const newStat = () =>
    setStats((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        stat_value: "0",
        title: "عنوان جديد",
        description: "",
        icon_name: "Target",
        sort_order: (prev[prev.length - 1]?.sort_order ?? -1) + 1,
        is_published: true,
      },
    ]);

  const newPartner = () =>
    setPartners((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "شريك جديد",
        logo_url: null,
        website_url: null,
        sort_order: (prev[prev.length - 1]?.sort_order ?? -1) + 1,
        is_published: true,
      },
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إعداد الموقع</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أرقام الأثر، بيانات التواصل، وسائل التواصل، والشركاء.
          </p>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4" />
          <span className="mr-2">حفظ الكل</span>
        </Button>
      </div>

      <Tabs defaultValue="contact" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="contact">بيانات التواصل</TabsTrigger>
          <TabsTrigger value="social">التواصل الاجتماعي</TabsTrigger>
          <TabsTrigger value="stats">أرقام الأثر</TabsTrigger>
          <TabsTrigger value="partners">الشركاء</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="space-y-4 rounded-2xl border border-border/60 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                className="mt-1"
                dir="ltr"
                value={contact.email ?? ""}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
            </div>
            <div>
              <Label>رقم الجوال</Label>
              <Input
                className="mt-1"
                dir="ltr"
                value={contact.phone ?? ""}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>واتساب (بصيغة دولية بدون +)</Label>
              <Input
                className="mt-1"
                dir="ltr"
                value={contact.whatsapp ?? ""}
                onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
              />
            </div>
            <div>
              <Label>ساعات العمل</Label>
              <Input
                className="mt-1"
                value={contact.working_hours ?? ""}
                onChange={(e) => setContact({ ...contact, working_hours: e.target.value })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4 rounded-2xl border border-border/60 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["twitter", "instagram", "linkedin", "youtube"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k}</Label>
                <Input
                  dir="ltr"
                  className="mt-1"
                  value={social[k] ?? ""}
                  onChange={(e) => setSocial({ ...social, [k]: e.target.value })}
                  placeholder={`https://${k}.com/...`}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={newStat}>
              <Plus className="h-4 w-4" />
              <span className="mr-2">إضافة رقم جديد</span>
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القيمة</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الأيقونة</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Input
                          value={s.stat_value}
                          onChange={(e) => {
                            const next = [...stats];
                            next[i].stat_value = e.target.value;
                            setStats(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.title}
                          onChange={(e) => {
                            const next = [...stats];
                            next[i].title = e.target.value;
                            setStats(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          rows={2}
                          value={s.description ?? ""}
                          onChange={(e) => {
                            const next = [...stats];
                            next[i].description = e.target.value;
                            setStats(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.icon_name}
                          onChange={(e) => {
                            const next = [...stats];
                            next[i].icon_name = e.target.value;
                            setStats(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={String(s.sort_order)}
                          onChange={(e) => {
                            const next = [...stats];
                            next[i].sort_order = Number(e.target.value || 0);
                            setStats(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          onClick={() => {
                            const next = [...stats];
                            next[i].is_published = !next[i].is_published;
                            setStats(next);
                          }}
                          className={
                            s.is_published
                              ? "cursor-pointer bg-emerald-500/15 text-emerald-700"
                              : "cursor-pointer"
                          }
                        >
                          {s.is_published ? "منشور" : "مسودة"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setStats((prev) => prev.filter((x) => x.id !== s.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        لا توجد أرقام أثر بعد. اضغط إضافة رقم جديد.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={newPartner}>
              <Plus className="h-4 w-4" />
              <span className="mr-2">إضافة شريك</span>
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الشريك</TableHead>
                    <TableHead>رابط اللوغو</TableHead>
                    <TableHead>الموقع الإلكتروني</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Input
                          value={p.name}
                          onChange={(e) => {
                            const next = [...partners];
                            next[i].name = e.target.value;
                            setPartners(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          dir="ltr"
                          value={p.logo_url ?? ""}
                          onChange={(e) => {
                            const next = [...partners];
                            next[i].logo_url = e.target.value;
                            setPartners(next);
                          }}
                          placeholder="https://..."
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          dir="ltr"
                          value={p.website_url ?? ""}
                          onChange={(e) => {
                            const next = [...partners];
                            next[i].website_url = e.target.value;
                            setPartners(next);
                          }}
                          placeholder="https://..."
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={String(p.sort_order)}
                          onChange={(e) => {
                            const next = [...partners];
                            next[i].sort_order = Number(e.target.value || 0);
                            setPartners(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          onClick={() => {
                            const next = [...partners];
                            next[i].is_published = !next[i].is_published;
                            setPartners(next);
                          }}
                          className={
                            p.is_published
                              ? "cursor-pointer bg-emerald-500/15 text-emerald-700"
                              : "cursor-pointer"
                          }
                        >
                          {p.is_published ? "منشور" : "مسودة"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setPartners((prev) => prev.filter((x) => x.id !== p.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {partners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        لا توجد شركاء بعد.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
