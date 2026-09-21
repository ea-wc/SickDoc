"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";

interface Dashboard {
  users: { total: number; patients: number; doctors: number; admins: number; active: number; suspended: number; deactivated: number };
  doctors: { pending: number; approved: number; rejected: number };
  appointments: { total: number; upcoming: number; completed: number; cancelled: number; noShow: number };
  sessions: { scheduled: number; inProgress: number; completed: number };
  recentAuditCount: number;
}

export default function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api<Dashboard>("/admin/dashboard"),
  });

  if (dashboard.isLoading) return <PageContainer><Skeleton className="h-64 w-full" /></PageContainer>;
  if (dashboard.isError || !dashboard.data) return <PageContainer><ErrorState message={(dashboard.error as Error)?.message} onRetry={() => void dashboard.refetch()} /></PageContainer>;

  const d = dashboard.data;
  const stats: { title: string; value: number }[] = [
    { title: "Total users", value: d.users.total },
    { title: "Patients", value: d.users.patients },
    { title: "Doctors", value: d.users.doctors },
    { title: "Pending doctor reviews", value: d.doctors.pending },
    { title: "Upcoming appointments", value: d.appointments.upcoming },
    { title: "Completed appointments", value: d.appointments.completed },
    { title: "In-progress sessions", value: d.sessions.inProgress },
    { title: "Audit entries", value: d.recentAuditCount },
  ];

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">Database-derived counts — no external analytics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <CardTitle className="text-xs font-normal text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
