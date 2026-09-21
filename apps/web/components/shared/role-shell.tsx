"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarClock, ClipboardList, FileText, LayoutDashboard, Sparkles, Stethoscope, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell, type NavItem } from "@/components/shared/app-shell";

const NAV: Record<"patient" | "doctor" | "admin", { badge: string; items: NavItem[] }> = {
  patient: {
    badge: "Patient",
    items: [
      { title: "Dashboard", href: "/patient", icon: LayoutDashboard },
      { title: "Find a doctor", href: "/patient/doctors", icon: Stethoscope },
      { title: "Guided match", href: "/patient/match", icon: Sparkles },
      { title: "Appointments", href: "/patient/appointments", icon: CalendarClock },
      { title: "Records", href: "/patient/records", icon: FileText },
    ],
  },
  doctor: {
    badge: "Doctor",
    items: [
      { title: "Schedule", href: "/doctor", icon: CalendarCheck },
      { title: "Appointments", href: "/doctor/appointments", icon: CalendarClock },
      { title: "Patients", href: "/doctor/patients", icon: Users },
      { title: "Profile", href: "/doctor/profile", icon: FileText },
    ],
  },
  admin: {
    badge: "Admin",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Users", href: "/admin/users", icon: Users },
      { title: "Doctor reviews", href: "/admin/doctors", icon: Stethoscope },
      { title: "Appointments", href: "/admin/appointments", icon: CalendarClock },
      { title: "Audit log", href: "/admin/audit", icon: ClipboardList },
    ],
  },
};

/** Authenticated role shell: waits for session restore, then renders the sidebar app. */
export function RoleShell({ role, children }: { role: "patient" | "doctor" | "admin"; children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const config = NAV[role];

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/sign-in");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full">
        <div className="hidden w-64 flex-col gap-4 border-r p-6 lg:flex">
          <Skeleton className="h-8 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      nav={config.items}
      badge={config.badge}
      user={{ displayName: user.displayName, avatarColor: user.avatarColor }}
      onSignOut={() => {
        void signOut().then(() => router.replace("/"));
      }}
    >
      {children}
    </AppShell>
  );
}
