import { cn } from "@/lib/utils";

/** Standard page container (DESIGN_GUIDELINES §5). */
export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-6 py-8", className)}>{children}</div>;
}
