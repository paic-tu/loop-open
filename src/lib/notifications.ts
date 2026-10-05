import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function insertNotification(input: {
  user_id: string;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    await supabase.from("notifications").insert({
      user_id: input.user_id,
      title: input.title,
      body: input.body,
      link: input.link ?? "",
    });
  } catch (e) {
    console.error("Notification insert failed:", e);
  }
}

export async function notifyAdmins(input: {
  eventType:
    | "new_request"
    | "new_booking"
    | "new_rfq"
    | "new_quote"
    | "new_community_entity"
    | "new_supplier"
    | "new_project_application"
    | "new_opportunity_question";
  title: string;
  body: string;
  link?: string;
}) {
  try {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "staff"]);

    const users = [...new Set((admins ?? []).map((r) => r.user_id).filter(Boolean))];
    const inserts = users.map((u) => ({
      user_id: u,
      title: input.title,
      body: input.body,
      link: input.link ?? "",
    }));

    if (inserts.length > 0) {
      await supabase.from("notifications").insert(inserts as never);
    }

    console.log(`[notifyAdmins] ${input.eventType}: notified ${users.length} users.`);
  } catch (e) {
    console.error("notifyAdmins failed:", e);
  }
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  link?: string
) {
  return insertNotification({ user_id: userId, title, body, link });
}

export function useMarkAllRead() {
  return async () => {
    const { data: me } = await supabase.auth.getUser();
    if (!me?.user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", me.user.id)
      .is("read_at", null);
    toast.success("تم تعليم الإشعارات كمقروءة");
  };
}
