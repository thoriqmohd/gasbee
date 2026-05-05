import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playBeep } from "@/lib/sound";
import { toast } from "sonner";

export function RiderJobAlert() {
  const { user } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`rider-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n: any = p.new;
        if (seen.current.has(n.id)) return;
        seen.current.add(n.id);
        if (n.type === "order") {
          playBeep(4);
          toast.success(`🛵 ${n.title}`, { description: n.body, duration: 8000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return null;
}
