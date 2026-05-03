import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function HudPanel({
  children,
  className,
  brackets = true,
}: {
  children: ReactNode;
  className?: string;
  brackets?: boolean;
}) {
  return (
    <div className={cn("relative border border-hairline bg-surface-1 p-6", className)}>
      {brackets && <Brackets />}
      {children}
    </div>
  );
}

export function Brackets() {
  const c = "absolute h-4 w-4 border-primary pointer-events-none";
  return (
    <>
      <span className={cn(c, "top-0 left-0 border-t border-l")} />
      <span className={cn(c, "top-0 right-0 border-t border-r")} />
      <span className={cn(c, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(c, "bottom-0 right-0 border-b border-r")} />
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mono-label text-muted-foreground">
      <span className="inline-block size-2 bg-primary" />
      <span>{children}</span>
    </div>
  );
}
