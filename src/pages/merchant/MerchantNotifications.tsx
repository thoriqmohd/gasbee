import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function MerchantNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50).then(({ data }) => {
      setItems(data ?? []);
      supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then(() => {});
    });
  }, [user?.id]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className="flex items-start gap-3 p-3"><Bell className="mt-1 h-4 w-4 text-primary" />
            <div className="flex-1"><div className="font-semibold">{n.title}</div>{n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}<div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div></div>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
      </div>
    </div>
  );
}
