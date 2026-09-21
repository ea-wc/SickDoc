import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
} as const;

export function initialsOf(displayName: string): string {
  const parts = displayName
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

/**
 * Generated initials avatar — the only avatar component. Colour comes from the
 * profile's `avatarColor`; no image host is ever called.
 */
export function InitialsAvatar({
  displayName,
  color,
  size = "md",
  className,
}: {
  displayName: string;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none", SIZES[size], className)}
      style={{ backgroundColor: color }}
    >
      {initialsOf(displayName)}
    </span>
  );
}
