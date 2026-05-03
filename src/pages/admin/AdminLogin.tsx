import { ADMIN_ROLES } from "@/hooks/useAuth";
import { LoginCard } from "@/components/auth/LoginCard";
export default function AdminLogin() {
  return <LoginCard title="Gasbee HQ" subtitle="Admin Backend" expectedRoles={ADMIN_ROLES} />;
}
