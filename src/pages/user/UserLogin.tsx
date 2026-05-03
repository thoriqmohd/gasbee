import { CUSTOMER_ROLES } from "@/hooks/useAuth";
import { LoginCard } from "@/components/auth/LoginCard";
export default function UserLogin() {
  return <LoginCard title="Gasbee" subtitle="Order LPG, fast" expectedRoles={CUSTOMER_ROLES} showSignup signupLink="/user/register" />;
}
