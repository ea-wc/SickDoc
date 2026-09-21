"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarPlus, Sparkles, Stethoscope } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { AppointmentCard, NotificationItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge } from "@/components/shared/status-badge";

export default function PatientDashboard() {
  const appointments = useQuery({
    queryKey: ["appointments", "upcoming"],
    queryFn: () => api<{ data: AppointmentCard[] }>("/appointments?scope=upcoming&page=1&pageSize=5"),
  });

  const notifications = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ data: NotificationItem[]; meta: { unreadCount: number } }>("/notifications?unread=true&page=1&pageSize=5"),
  });

  const next = appointments.data?.data[0];

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your care at a glance.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next appointment</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : appointments.isError ? (
                <ErrorState message={(appointments.error as Error).message} onRetry={() => void appointments.refetch()} />
              ) : next ? (
                <div className="flex items-center gap-4">
                  <InitialsAvatar displayName={next.doctor.displayName} color={next.doctor.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{next.doctor.displayName}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(next.startsAt)}</p>
                    <p className="truncate text-sm">{next.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={next.status} kind="appointment" />
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/consultation/${next.id}`}>Open session</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title="No upcoming appointments"
                  description="Book a consultation to see it here."
                  action={
                    <Button asChild size="sm">
                      <Link href="/patient/doctors">Find a doctor</Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Stethoscope, title: "Find a doctor", href: "/patient/doctors" },
              { icon: Sparkles, title: "Guided match", href: "/patient/match" },
              { icon: CalendarPlus, title: "Appointments", href: "/patient/appointments" },
            ].map((action) => (
              <Link key={action.href} href={action.href} className="rounded-xl border p-4 transition-colors hover:bg-accent">
                <action.icon className="mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">{action.title}</p>
              </Link>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Notifications</CardTitle>
            {(notifications.data?.meta.unreadCount ?? 0) > 0 && <Badge variant="secondary">{notifications.data?.meta.unreadCount} unread</Badge>}
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.isLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (notifications.data?.data.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              notifications.data?.data.map((item) => (
                <div key={item.id} className="space-y-1 rounded-lg border px-3 py-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
