import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin" | "admin" | "operation_admin" | "finance_admin" | "support_admin"
  | "merchant_owner" | "merchant_manager" | "merchant_staff"
  | "merchant_rider" | "rider"
  | "customer" | "buyer";

export const ADMIN_ROLES: AppRole[] = ["super_admin","admin","operation_admin","finance_admin","support_admin"];
export const MERCHANT_MANAGER_ROLES: AppRole[] = ["merchant_owner","merchant_manager","merchant_staff"];
export const RIDER_ROLES: AppRole[] = ["merchant_rider","rider"];
export const CUSTOMER_ROLES: AppRole[] = ["customer","buyer"];

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isMerchantManager: boolean;
  isRider: boolean;
  isCustomer: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRoles(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const has = (list: AppRole[]) => roles.some((r) => list.includes(r));

  return (
    <Ctx.Provider value={{
      user, session, roles, loading,
      isAdmin: has(ADMIN_ROLES),
      isMerchantManager: has(MERCHANT_MANAGER_ROLES),
      isRider: has(RIDER_ROLES),
      isCustomer: has(CUSTOMER_ROLES),
      signOut: async () => { await supabase.auth.signOut(); },
      refreshRoles: async () => { if (user) await loadRoles(user.id); },
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
};

export const homeForRoles = (roles: AppRole[]): string => {
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return "/dashboard";
  if (roles.some((r) => RIDER_ROLES.includes(r))) return "/merchant/rider-dashboard";
  if (roles.some((r) => MERCHANT_MANAGER_ROLES.includes(r))) return "/merchant/dashboard";
  return "/user/home";
};
