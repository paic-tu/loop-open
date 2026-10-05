import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, getSupabaseEnvStatus } from "@/integrations/supabase/client";
import type { AppRole } from "./permissions";

type ProfileData = {
  full_name: string;
  phone: string;
  organization: string | null;
  email?: string | null;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  isAdmin: boolean;
  roles: AppRole[];
  profile: ProfileData | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<ProfileData>) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Non-null only when Supabase environment variables are fully configured. */
  supabaseAvailable: boolean;
  /** Missing env var names, useful to render setup banners client-side. */
  missingEnvVars: string[];
};

const ENV_STATUS =
  typeof window === "undefined"
    ? { status: "missing-both" as const, missing: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as string[] }
    : (() => {
        try {
          const s = getSupabaseEnvStatus();
          return { status: s.status, missing: s.missing };
        } catch {
          return { status: "missing-both" as const, missing: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as string[] };
        }
      })();

function hasSupabase(): boolean {
  return ENV_STATUS.status === "ok" && typeof (supabase as unknown as { auth?: unknown })?.auth !== "undefined";
}

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  loading: true,
  rolesLoading: true,
  isAdmin: false,
  roles: ["user"],
  profile: null,
  refreshProfile: async () => {},
  updateProfile: async () => {},
  changePassword: async () => {},
  resetPasswordEmail: async () => {},
  signOut: async () => {},
  supabaseAvailable: false,
  missingEnvVars: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(!hasSupabase() ? false : true);
  const [roles, setRoles] = useState<AppRole[]>(["user"]);
  const [rolesLoading, setRolesLoading] = useState<boolean>(!hasSupabase() ? false : true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!hasSupabase()) return;
    let mounted = true;
    const sb = supabase as NonNullable<typeof supabase>;
    try {
      const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
        if (!mounted) return;
        setSession(next);
        setLoading(false);
      });
      sb.auth
        .getSession()
        .then(({ data }) => {
          if (!mounted) return;
          setSession(data.session);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setLoading(false);
        });
      return () => {
        mounted = false;
        try {
          sub.subscription.unsubscribe();
        } catch {
          /* ignore */
        }
      };
    } catch {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, []);

  useEffect(() => {
    if (!hasSupabase()) {
      setRolesLoading(false);
      setRoles(["user"]);
      setProfile(null);
      return;
    }
    const uid = session?.user?.id;
    if (!uid) {
      setRoles(["user"]);
      setRolesLoading(false);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    const sb = supabase as NonNullable<typeof supabase>;
    sb.from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .then(({ data }) => {
        if (cancelled) return;
        const list: AppRole[] = ["user"];
        for (const r of data ?? []) {
          if (r.role === "admin" || r.role === "staff") list.push(r.role as AppRole);
        }
        setRoles(list);
        setRolesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRolesLoading(false);
      });
    sb.from("profiles")
      .select("full_name, phone, organization")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setProfile({
            full_name: String(data.full_name ?? session?.user?.email ?? ""),
            phone: String(data.phone ?? ""),
            organization: data.organization ? String(data.organization) : null,
            email: session?.user?.email ?? null,
          });
        } else {
          setProfile({
            full_name: "",
            phone: "",
            organization: null,
            email: session?.user?.email ?? null,
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email]);

  const refreshProfile = useCallback(async () => {
    if (!hasSupabase()) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const sb = supabase as NonNullable<typeof supabase>;
    try {
      const { data } = await sb
        .from("profiles")
        .select("full_name, phone, organization")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setProfile({
          full_name: String(data.full_name ?? ""),
          phone: String(data.phone ?? ""),
          organization: data.organization ? String(data.organization) : null,
          email: session?.user?.email ?? null,
        });
      }
    } catch {
      /* ignore */
    }
  }, [session?.user?.id, session?.user?.email]);

  const updateProfile: AuthValue["updateProfile"] = async (patch) => {
    if (!hasSupabase()) throw new Error("Supabase غير متاح حالياً — أعد محاولة الإعداد");
    const uid = session?.user?.id;
    if (!uid) throw new Error("يجب تسجيل الدخول");
    const current = profile ?? { full_name: "", phone: "", organization: null };
    const next: ProfileData = { ...current, ...patch };
    const sb = supabase as NonNullable<typeof supabase>;
    await sb
      .from("profiles")
      .upsert(
        {
          id: uid,
          full_name: next.full_name,
          phone: next.phone,
          organization: next.organization ?? null,
        } as never,
        { onConflict: "id" }
      );
    setProfile(next);
  };

  const changePassword: AuthValue["changePassword"] = async (newPassword) => {
    if (!hasSupabase()) throw new Error("Supabase غير متاح حالياً");
    const sb = supabase as NonNullable<typeof supabase>;
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const resetPasswordEmail: AuthValue["resetPasswordEmail"] = async (email) => {
    if (!hasSupabase()) throw new Error("Supabase غير متاح حالياً");
    const sb = supabase as NonNullable<typeof supabase>;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: origin ? `${origin}/auth/reset` : "/auth/reset",
    });
    if (error) throw error;
  };

  const signOut: AuthValue["signOut"] = async () => {
    if (!hasSupabase()) return;
    const sb = supabase as NonNullable<typeof supabase>;
    try {
      await sb.auth.signOut();
    } catch {
      /* ignore */
    }
  };

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    loading,
    rolesLoading,
    isAdmin: roles.includes("admin"),
    roles,
    profile,
    refreshProfile,
    updateProfile,
    changePassword,
    resetPasswordEmail,
    signOut,
    supabaseAvailable: hasSupabase(),
    missingEnvVars: ENV_STATUS.missing,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

