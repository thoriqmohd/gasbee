import { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Users, Store, FileCheck2, Bike,
  Package, Tags, Boxes, CreditCard, Undo2, Wallet, Percent,
  Image as ImageIcon, Megaphone, BarChart3, Bell, LifeBuoy, Settings, ScrollText, LogOut, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/merchants", label: "Merchants", icon: Store },
  { to: "/merchant-applications", label: "Applications", icon: FileCheck2 },
  { to: "/company-verifications", label: "Company Verify", icon: FileCheck2 },
  { to: "/riders", label: "Riders", icon: Bike },
  { to: "/products", label: "Products", icon: Package },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/inventory-overview", label: "Inventory", icon: Boxes },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/refunds", label: "Refunds", icon: Undo2 },
  { to: "/settlements", label: "Settlements", icon: Wallet },
  { to: "/commissions", label: "Commissions", icon: Percent },
  { to: "/banners", label: "Banners", icon: ImageIcon },
  { to: "/promotions", label: "Promotions", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support-tickets", label: "Support", icon: LifeBuoy },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/admins", label: "Admin Users", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
          <Logo size={36} />
          <div>
            <div className="text-sm font-bold">Gasbee HQ</div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Admin</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                           : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <it.icon className="h-4 w-4" />{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs opacity-70">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => { await signOut(); nav("/login"); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
          <div className="mt-2 text-center text-[10px] opacity-50">Version 2.0.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-8">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
