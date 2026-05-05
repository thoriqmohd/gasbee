import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { Link } from "react-router-dom";

export default function RiderNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    setItems(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`rnotif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        setItems((prev) => [p.new as any, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };
  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications {unread > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread}</span>}</h1>
        {unread > 0 && <Button size="sm" variant="outline" onClick={markAllRead}><Check className="mr-1 h-4 w-4" />Mark all read</Button>}
      </div>
      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className={`flex items-start gap-3 p-3 ${!n.is_read ? "border-primary bg-accent/30" : ""}`}>
            <Bell className="mt-1 h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{new Date(n.created_at).toLocaleString()}</span>
                {n.link && <Link to={n.link} onClick={() => markRead(n.id)} className="text-primary">Open</Link>}
                {!n.is_read && <button onClick={() => markRead(n.id)} className="text-primary">Mark read</button>}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
      </div>
    </div>
  );
}
