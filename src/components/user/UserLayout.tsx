import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, MapPin, User, Bell, Flame, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const tabs = [
  { to: "/user/home", label: "Home", icon: Home },
  { to: "/user/orders", label: "Orders", icon: ShoppingBag },
  { to: "/user/addresses", label: "Address", icon: MapPin },
  { to: "/user/notifications", label: "Alerts", icon: Bell },
  { to: "/user/profile", label: "Profile", icon: User },
];

export default function UserLayout() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)]"><Flame className="h-4 w-4 text-primary-foreground" /></div>
          <span className="font-bold">Gasbee</span>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/user/login"); }}><LogOut className="h-4 w-4" /></Button>
      </header>
      <main className="flex-1 p-4"><Outlet /></main>
      <nav className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t bg-background">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-xs ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>
            <t.icon className="h-5 w-5" />{t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
