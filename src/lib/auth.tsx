import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
};

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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>(["user"]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setRoles(["user"]);
      setRolesLoading(false);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    supabase
      .from("user_roles")
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
    supabase
      .from("profiles")
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
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
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
  }, [session?.user?.id, session?.user?.email]);

  const updateProfile: AuthValue["updateProfile"] = async (patch) => {
    const uid = session?.user?.id;
    if (!uid) throw new Error("يجب تسجيل الدخول");
    const current = profile ?? { full_name: "", phone: "", organization: null };
    const next: ProfileData = { ...current, ...patch };
    await supabase
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
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const resetPasswordEmail: AuthValue["resetPasswordEmail"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) throw error;
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
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
