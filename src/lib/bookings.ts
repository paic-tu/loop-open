import { supabase } from "@/integrations/supabase/client";
import { notifyAdmins } from "./notifications";
import { fetchSettings } from "./marketplace";

export const BOOKING_STATUSES: Record<string, { label: string; tone: string }> = {
  new: { label: "جديد", tone: "bg-primary/15 text-primary dark:text-gold" },
  in_review: { label: "قيد المراجعة", tone: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  contacted: { label: "تم التواصل", tone: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  scheduled: { label: "مجدول", tone: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" },
  completed: { label: "مكتمل", tone: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "مُلغى", tone: "bg-destructive/20 text-destructive" },
};

export type BookingRow = {
  id: string;
  full_name: string;
  entity_name: string | null;
  phone: string;
  email: string;
  service_category: string | null;
  note: string | null;
  status: string;
  internal_notes: string | null;
  assigned_to: string | null;
  user_id: string | null;
  attachment_path: string | null;
  closed_at: string | null;
  spam_score: number;
  is_spam: boolean;
  created_at: string;
};

const MAX_BOOKINGS_PER_10_MINUTES = 3;

/**
 * Spam protection: client-side + server-side-ish (time-based) using local counts.
 * Honeypot field MUST be empty. Rate limit uses sessionStorage.
 */
export function checkClientSideSpam(honeypotValue: string): {
  ok: boolean;
  reason?: string;
} {
  if (honeypotValue && String(honeypotValue).trim().length > 0) {
    return { ok: false, reason: "هذا الطلب يُعتبر بريداً غير مرغوب." };
  }

  try {
    const key = "openloop:booking-rate";
    const now = Date.now();
    const raw = window.sessionStorage.getItem(key);
    const timestamps: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const filtered = timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (filtered.length >= MAX_BOOKINGS_PER_10_MINUTES) {
      return {
        ok: false,
        reason:
          "تم تجاوز الحد الأقصى للطلبات خلال الفترة القصيرة. جرب مجدداً بعد بضع دقائق.",
      };
    }
    filtered.push(now);
    window.sessionStorage.setItem(key, JSON.stringify(filtered));
  } catch {
    /* sessionStorage may be unavailable */
  }

  return { ok: true };
}

export async function createBooking(input: {
  fullName: string;
  entityName?: string;
  phone: string;
  email: string;
  serviceCategory?: string;
  note?: string;
  honeypot: string;
  attachment?: File | null;
}): Promise<{ id?: string; error?: string }> {
  const spam = checkClientSideSpam(input.honeypot);
  if (!spam.ok) {
    console.warn("Spam filter blocked booking:", spam.reason);
    return { error: spam.reason };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  let attachmentPath: string | null = null;
  if (input.attachment) {
    const settings = await fetchSettings();
    const uploads = (settings["uploads"] ?? {}) as Record<string, unknown>;
    const maxMb = Number(uploads["max_mb"] ?? 10);
    if (input.attachment.size > maxMb * 1024 * 1024) {
      return { error: `حجم الملف أكبر من الحد المسموح (${maxMb} ميجابايت).` };
    }
    const safeName = input.attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uid = userId ?? "anonymous";
    const path = `${uid}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, input.attachment, {
        contentType: input.attachment.type || "application/octet-stream",
        upsert: false,
      });
    if (error) return { error: error.message };
    attachmentPath = path;
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      full_name: input.fullName.trim(),
      entity_name: input.entityName?.trim() || null,
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      service_category: input.serviceCategory || null,
      note: input.note?.trim() || null,
      status: "new",
      user_id: userId,
      attachment_path: attachmentPath,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  const id = (data as { id: string } | null)?.id;

  if (id) {
    await notifyAdmins({
      eventType: "new_booking",
      title: "طلب استشارة جديد",
      body: `من: ${input.fullName} (${input.email}) – ${input.serviceCategory ?? "غير محدد المجال"}`,
      link: "/admin/bookings",
    });
  }

  return { id };
}

export async function updateBookingStatus(id: string, status: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "completed" || status === "rejected") patch["closed_at"] = new Date().toISOString();
  const { error } = await supabase.from("bookings").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function updateBookingInternal(id: string, patch: Partial<BookingRow>) {
  const { error } = await supabase.from("bookings").update(patch as never).eq("id", id);
  if (error) throw error;
}
