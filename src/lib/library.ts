import { supabase } from "@/integrations/supabase/client";

export type LibraryFile = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  download_count: number;
  is_published: boolean;
  sort_order: number;
  icon_name: string;
  created_at: string;
};

export async function getPublishedLibraryFiles(): Promise<LibraryFile[]> {
  const { data, error } = await supabase
    .from("library_files")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LibraryFile[];
}

export async function getAllLibraryFilesAdmin(): Promise<LibraryFile[]> {
  const { data, error } = await supabase
    .from("library_files")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LibraryFile[];
}

export async function incrementDownloadCount(fileId: string) {
  try {
    await supabase.rpc("increment_library_download", { file_id: fileId });
  } catch {
    // Fallback: direct increment in case the RPC is missing
    const { data: current } = await supabase
      .from("library_files")
      .select("download_count")
      .eq("id", fileId)
      .maybeSingle();
    const next = Number((current as { download_count?: number } | null)?.download_count ?? 0) + 1;
    await supabase
      .from("library_files")
      .update({ download_count: next } as never)
      .eq("id", fileId);
  }
}

export async function getLibraryFileSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("library")
    .createSignedUrl(filePath, 60 * 10);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function createOrUpdateLibraryFile(input: {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  iconName?: string;
  sortOrder?: number;
  isPublished?: boolean;
  file?: File | null;
  existingPath?: string;
}) {
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) throw new Error("يجب تسجيل الدخول");

  let filePath = input.existingPath ?? "";
  let fileName = "";
  let fileSize = 0;
  let mimeType: string | null = null;

  if (input.file) {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    fileName = input.file.name;
    fileSize = input.file.size;
    mimeType = input.file.type || null;
    const path = `files/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("library")
      .upload(path, input.file, { upsert: false, contentType: input.file.type });
    if (error) throw error;
    filePath = path;
  }

  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || "general",
    icon_name: input.iconName?.trim() || "BookOpen",
    sort_order: input.sortOrder ?? 0,
    is_published: input.isPublished ?? true,
  };

  if (input.id) {
    if (filePath) payload["file_path"] = filePath;
    if (fileName) {
      payload["file_name"] = fileName;
      payload["file_size"] = fileSize;
      payload["mime_type"] = mimeType;
    }
    const { error } = await supabase
      .from("library_files")
      .update(payload as never)
      .eq("id", input.id);
    if (error) throw error;
    return input.id;
  } else {
    if (!filePath) throw new Error("الملف مطلوب عند الإضافة الأولى.");
    payload["file_path"] = filePath;
    payload["file_name"] = fileName || "file";
    payload["file_size"] = fileSize;
    payload["mime_type"] = mimeType;
    payload["created_by"] = me.user.id;
    const { data, error } = await supabase
      .from("library_files")
      .insert(payload as never)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return (data as { id: string } | null)?.id;
  }
}

export async function deleteLibraryFile(id: string) {
  const { error } = await supabase.from("library_files").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderLibrary(orderedIds: string[]) {
  const updates = orderedIds.map((id, idx) =>
    supabase.from("library_files").update({ sort_order: idx } as never).eq("id", id)
  );
  await Promise.all(updates);
}
