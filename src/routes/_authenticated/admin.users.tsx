import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Shield, UserX, UserCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { downloadCsv } from "@/lib/utils";
import { setUserRole, toggleBlockUser, type AppRole } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  created_at: string;
  email?: string | null;
  role?: string;
};

function AdminUsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("all");

  const reload = async () => {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string>();
    for (const r of rRes.data ?? []) roleMap.set(r.user_id, r.role);
    const rowsWithRoles = (pRes.data ?? []).map((p) => ({
      ...p,
      role: roleMap.get(p.id) || "user",
    }));
    // Try to enrich emails via auth admin — if not possible, leave null
    setRows(rowsWithRoles as UserRow[]);
    setLoading(false);
  };
  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "all" && (r.role || "user") !== role) return false;
      if (q) {
        const blob = `${r.full_name ?? ""} ${r.organization ?? ""} ${r.phone ?? ""} ${r.email ?? ""} ${r.id}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, role, query]);

  const applyRole = async (userId: string, next: AppRole) => {
    if (userId === me?.id) {
      toast.error("لا يمكنك تغيير صلاحيات حسابك الخاص");
      return;
    }
    try {
      await setUserRole(userId, next);
      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role: next } : r)));
      toast.success(`تم تعيين الدور: ${next === "admin" ? "مشرف" : next === "staff" ? "موظف" : "مستخدم"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر التحديث";
      toast.error(msg);
    }
  };

  const toggleBlock = async (r: UserRow) => {
    if (r.id === me?.id) {
      toast.error("لا يمكنك حظر حسابك الخاص");
      return;
    }
    const next = !r.is_blocked;
    try {
      await toggleBlockUser(r.id, next, next ? "حظر من لوحة الإدارة" : undefined);
      setRows((prev) =>
        prev.map((p) =>
          p.id === r.id
            ? { ...p, is_blocked: next, blocked_reason: next ? p.blocked_reason ?? "حظر يدوي" : null }
            : p
        )
      );
      toast.success(next ? "تم حظر المستخدم" : "تم إلغاء حظر المستخدم");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر الحفظ";
      toast.error(msg);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      filtered.map((r) => ({
        id: r.id,
        full_name: r.full_name ?? "",
        organization: r.organization ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        role: r.role ?? "user",
        is_blocked: r.is_blocked ? "نعم" : "لا",
        created_at: r.created_at,
      })),
      `openloop-users-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast.success("تم تصدير الملف");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة المستخدمين</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تعيين الأدوار (مشرف، موظف، مستخدم)، حظر المستخدمين وتصدير بياناتهم.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم/الجهة/الجوال..."
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="كل الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              <SelectItem value="admin">مشرفون</SelectItem>
              <SelectItem value="staff">موظفون</SelectItem>
              <SelectItem value="user">مستخدمون عاديون</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">الانضمام</TableHead>
                <TableHead className="w-[180px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    جارٍ التحميل...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    لا يوجد مستخدمون مطابقون.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-bold">{r.full_name || "(بدون اسم)"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {r.phone || "بدون جوال"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.organization || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={r.role || "user"}
                        onValueChange={(v) => applyRole(r.id, v as AppRole)}
                        disabled={r.id === me?.id}
                      >
                        <SelectTrigger className="h-8 w-28 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">مستخدم</SelectItem>
                          <SelectItem value="staff">موظف</SelectItem>
                          <SelectItem value="admin">مشرف</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {r.is_blocked ? (
                        <Badge className="bg-destructive/20 text-destructive">محظور</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          نشط
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={r.is_blocked ? "default" : "destructive"}
                          onClick={() => toggleBlock(r)}
                          disabled={r.id === me?.id}
                        >
                          {r.is_blocked ? (
                            <>
                              <UserCheck className="h-4 w-4" />
                              <span className="mr-1 hidden sm:inline">إلغاء الحظر</span>
                            </>
                          ) : (
                            <>
                              <UserX className="h-4 w-4" />
                              <span className="mr-1 hidden sm:inline">حظر</span>
                            </>
                          )}
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
    </div>
  );
}
