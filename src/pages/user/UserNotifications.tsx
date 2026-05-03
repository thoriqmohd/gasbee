import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function UserNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
      // mark all as read
      supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then(() => {});
    });
  }, [user]);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Notifications</h1>
      {items.map((n) => (
        <Card key={n.id} className="flex items-start gap-3 p-3">
          <Bell className="mt-1 h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-sm font-semibold">{n.title}</div>
            {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
            <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
          </div>
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
    </div>
  );
}
