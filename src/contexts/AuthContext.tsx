import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  isOwner: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureProfileExists = async (currentUser: User) => {
    const schoolId = currentUser.user_metadata?.school_id as string | undefined;

    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existingProfile || !schoolId) return;

    // Verify the school still exists; if not, clear the stale metadata and bail.
    const { data: schoolRow } = await supabase
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .maybeSingle();

    if (!schoolRow) {
      await supabase.rpc("clear_stale_school_id");
      return;
    }

    const fullName =
      (currentUser.user_metadata?.full_name as string | undefined)?.trim() ||
      currentUser.email ||
      "Teacher";

    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: currentUser.id,
      full_name: fullName,
      email: currentUser.email || "",
      school_id: schoolId,
    });

    if (insertError) {
      // Foreign key violation — school disappeared between checks. Clear and continue.
      if ((insertError as { code?: string }).code === "23503") {
        await supabase.rpc("clear_stale_school_id");
        return;
      }
      throw insertError;
    }
  };

  const fetchProfile = async (currentUser: User) => {
    try {
      await ensureProfileExists(currentUser);
    } catch (e) {
      // Don't block role loading if profile bootstrap fails (e.g. stale school_id in metadata)
      console.error("ensureProfileExists failed:", e);
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    setProfile(profileData);

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", currentUser.id);
    setRoles(rolesData || []);
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async (currentUser: User | null) => {
      if (!mounted) return;
      setUser(currentUser);

      if (currentUser) {
        try {
          await fetchProfile(currentUser);
        } catch (e) {
          console.error("Failed to fetch profile:", e);
        }
      } else {
        setProfile(null);
        setRoles([]);
      }

      if (mounted) setLoading(false);
    };

    // Initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session?.user ?? null);
    });

    // Listen for changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Skip INITIAL_SESSION since getSession handles it
      if (_event === "INITIAL_SESSION") return;
      loadUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const isOwner = roles.some((r) => r.role === "owner");

  return (
    <AuthContext.Provider value={{ user, profile, roles, loading, isOwner, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
