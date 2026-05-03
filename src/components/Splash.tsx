import { Logo } from "@/components/Logo";

export function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse rounded-3xl bg-background/95 p-6 shadow-[var(--shadow-elegant)]">
          <Logo size={88} />
        </div>
        <div className="text-sm font-semibold tracking-widest text-foreground/80">GASBEE</div>
        <div className="text-xs text-foreground/60">Be Ready · Bee Delivers</div>
      </div>
    </div>
  );
}
