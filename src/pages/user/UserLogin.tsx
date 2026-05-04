import { CUSTOMER_ROLES } from "@/hooks/useAuth";
import { LoginCard } from "@/components/auth/LoginCard";
export default function UserLogin() {
  return <LoginCard title="Gasbee" subtitle="Pesan Gas LPG anda hari ini, sampai depan pintu!" expectedRoles={CUSTOMER_ROLES} showSignup signupLink="/user/register" />;
}
