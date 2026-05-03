import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppRole, homeForRoles, useAuth } from "@/hooks/useAuth";

interface Props { children: ReactNode; allow: AppRole[]; loginPath: string; }

export const ProtectedRoute = ({ children, allow, loginPath }: Props) => {
  const { user, roles, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to={loginPath} state={{ from: loc }} replace />;
  const ok = roles.some((r) => allow.includes(r));
  if (!ok) return <Navigate to={homeForRoles(roles)} replace />;
  return <>{children}</>;
};
