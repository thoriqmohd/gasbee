import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useCompanyVerification() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"none" | "pending" | "approved" | "rejected" | "loading">("loading");
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    if (!user) { setStatus("none"); return; }
    supabase.from("company_verifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        setRecord(data);
        setStatus((data?.status as any) ?? "none");
      });
  }, [user?.id]);

  return { status, record, isApproved: status === "approved" };
}
