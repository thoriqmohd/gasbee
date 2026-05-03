import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlaceholderPage({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Card className="p-10 text-center">
        <Construction className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">This screen is part of Phase 2. The route, role guard, and layout are wired — UI implementation comes next.</p>
        {children}
      </Card>
    </div>
  );
}
