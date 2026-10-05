import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "user";

export async function getCurrentRoles(): Promise<AppRole[]> {
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData?.user?.id) return ["user"];

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", sessionData.user.id);

  const roles = new Set<AppRole>(["user"]);
  for (const r of data ?? []) {
    if (r.role === "admin" || r.role === "staff") roles.add(r.role as AppRole);
  }
  return [...roles];
}

export function hasAtLeast(
  userRoles: AppRole[],
  required: "admin" | "staff" | "user"
): boolean {
  if (required === "user") return true;
  if (required === "staff") return userRoles.includes("staff") || userRoles.includes("admin");
  if (required === "admin") return userRoles.includes("admin");
  return false;
}

export async function setUserRole(userId: string, role: "admin" | "staff" | "user") {
  await supabase.from("user_roles").delete().eq("user_id", userId);
  if (role !== "user") {
    await supabase.from("user_roles").insert({ user_id: userId, role });
  }
}

export async function toggleBlockUser(userId: string, block: boolean, reason?: string) {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_blocked: block,
      blocked_at: block ? new Date().toISOString() : null,
      blocked_reason: block ? reason ?? "" : null,
    })
    .eq("id", userId);
  if (error) throw error;
}
