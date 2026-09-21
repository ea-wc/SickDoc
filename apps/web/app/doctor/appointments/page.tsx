"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate, formatTime } from "@/lib/format";
import type { AppointmentCard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge } from "@/components/shared/status-badge";

export default function DoctorAppointmentsPage() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");

  const appointments = useQuery({
    queryKey: ["appointments", scope],
    queryFn: () => api<{ data: AppointmentCard[] }>(`/appointments?scope=${scope}&page=1&pageSize=100`),
  });

  const groups = new Map<string, AppointmentCard[]>();
  for (const appointment of appointments.data?.data ?? []) {
    const key = appointment.startsAt.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  }

  return (
    <PageContainer className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">Your day, at a glance.</p>
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {appointments.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : appointments.isError ? (
        <ErrorState message={(appointments.error as Error).message} onRetry={() => void appointments.refetch()} />
      ) : (appointments.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={CalendarClock} title={scope === "upcoming" ? "No upcoming appointments" : "No past appointments"} />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([date, items]) => (
            <div key={date} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{formatDate(date + "T00:00:00.000Z")}</h2>
              <div className="space-y-2">
                {items.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <span className="w-20 font-mono text-sm tabular-nums">{formatTime(appointment.startsAt)}</span>
                      <InitialsAvatar displayName={appointment.patient.displayName} color={appointment.patient.avatarColor} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{appointment.patient.displayName}</p>
                        <p className="truncate text-sm text-muted-foreground">{appointment.reason}</p>
                      </div>
                      <StatusBadge status={appointment.status} kind="appointment" />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/consultation/${appointment.id}`}>Open</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
