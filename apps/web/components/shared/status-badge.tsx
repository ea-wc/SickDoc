import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline";

interface StatusMapping {
  variant: BadgeVariant;
  label: string;
  className?: string;
  pulse?: boolean;
}

const APPOINTMENT: Record<string, StatusMapping> = {
  CONFIRMED: { variant: "default", label: "Confirmed" },
  PENDING: { variant: "outline", label: "Pending", className: "text-warning" },
  RESCHEDULED: { variant: "outline", label: "Rescheduled", className: "text-warning" },
  COMPLETED: { variant: "secondary", label: "Completed", className: "text-success" },
  CANCELLED: { variant: "outline", label: "Cancelled", className: "text-muted-foreground" },
  NO_SHOW: { variant: "destructive", label: "No-show" },
};

const SESSION: Record<string, StatusMapping> = {
  SCHEDULED: { variant: "outline", label: "Scheduled" },
  JOINED: { variant: "info", label: "Joined" },
  IN_PROGRESS: { variant: "default", label: "In progress", pulse: true },
  COMPLETED: { variant: "secondary", label: "Completed", className: "text-success" },
  CANCELLED: { variant: "outline", label: "Cancelled", className: "text-muted-foreground" },
  NO_SHOW: { variant: "destructive", label: "No-show" },
};

const DOCTOR: Record<string, StatusMapping> = {
  APPROVED: { variant: "success", label: "Approved" },
  PENDING: { variant: "warning", label: "Pending review" },
  REJECTED: { variant: "destructive", label: "Rejected" },
};

const USER: Record<string, StatusMapping> = {
  ACTIVE: { variant: "success", label: "Active" },
  SUSPENDED: { variant: "warning", label: "Suspended" },
  DEACTIVATED: { variant: "outline", label: "Deactivated", className: "text-muted-foreground" },
};

const TABLES: Record<string, Record<string, StatusMapping>> = {
  appointment: APPOINTMENT,
  session: SESSION,
  doctor: DOCTOR,
  user: USER,
};

/** Single place where the domain status → badge mapping lives (DESIGN_GUIDELINES §3). */
export function StatusBadge({
  status,
  kind = "appointment",
  className,
}: {
  status: string;
  kind?: "appointment" | "session" | "doctor" | "user";
  className?: string;
}) {
  const mapping: StatusMapping = TABLES[kind]?.[status] ?? { variant: "outline", label: status };
  return (
    <Badge variant={mapping.variant} className={cn(mapping.className, className)}>
      {mapping.pulse && <span aria-hidden className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
      {mapping.label}
    </Badge>
  );
}
