import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMerchantContext() {
  const { user, roles } = useAuth();
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data: rolesRows } = await supabase.from("user_roles").select("merchant_id").eq("user_id", user.id).not("merchant_id", "is", null).limit(1);
    const mid = rolesRows?.[0]?.merchant_id;
    if (mid) {
      const { data } = await supabase.from("merchants").select("*").eq("id", mid).maybeSingle();
      setMerchant(data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);
  return { merchant, loading, roles, refresh: load };
}
