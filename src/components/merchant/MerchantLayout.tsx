import { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Package, Boxes, Bike, Users, Wallet, BarChart3, Settings, Bell, LifeBuoy, User, LogOut, ArrowLeftRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MerchantOrderAlert } from "@/components/merchant/MerchantOrderAlert";

const items = [
  { to: "/merchant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/merchant/orders", label: "Orders", icon: ShoppingBag },
  { to: "/merchant/products", label: "Products", icon: Package },
  { to: "/merchant/inventory", label: "Inventory", icon: Boxes },
  { to: "/merchant/inventory-movements", label: "Movements", icon: ArrowLeftRight },
  { to: "/merchant/riders", label: "Riders", icon: Bike },
  { to: "/merchant/staff", label: "Staff", icon: Users },
  { to: "/merchant/settlements", label: "Settlements", icon: Wallet },
  { to: "/merchant/reports", label: "Reports", icon: BarChart3 },
  { to: "/merchant/notifications", label: "Notifications", icon: Bell },
  { to: "/merchant/support", label: "Support", icon: LifeBuoy },
  { to: "/merchant/profile", label: "Profile", icon: User },
  { to: "/merchant/settings", label: "Settings", icon: Settings },
];

export default function MerchantLayout({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <Logo size={36} />
          <div><div className="text-sm font-bold">Gasbee Merchant</div></div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <it.icon className="h-4 w-4" />{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs opacity-70">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={async () => { await signOut(); nav("/merchant/login"); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
          <div className="mt-2 text-center text-[10px] opacity-50">Version 2.0.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto"><div className="mx-auto max-w-6xl p-6 md:p-8">{children ?? <Outlet />}</div></main>
      <MerchantOrderAlert />
    </div>
  );
}
