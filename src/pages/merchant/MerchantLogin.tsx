import { MERCHANT_MANAGER_ROLES, RIDER_ROLES } from "@/hooks/useAuth";
import { LoginCard } from "@/components/auth/LoginCard";
export default function MerchantLogin() {
  return <LoginCard title="Gasbee Merchant" subtitle="Manager & Rider" expectedRoles={[...MERCHANT_MANAGER_ROLES, ...RIDER_ROLES]} />;
}
