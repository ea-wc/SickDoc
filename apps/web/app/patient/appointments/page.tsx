"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatDateTime, toDateOnly } from "@/lib/format";
import type { AppointmentCard, SlotDay } from "@/lib/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { CalendarClock } from "lucide-react";

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rescheduling, setRescheduling] = useState<AppointmentCard | null>(null);

  const appointments = useQuery({
    queryKey: ["appointments", scope],
    queryFn: () => api<{ data: AppointmentCard[] }>(`/appointments?scope=${scope}&page=1&pageSize=50`),
  });

  async function cancel(appointment: AppointmentCard) {
    try {
      await api(`/appointments/${appointment.id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason: "Cancelled by patient" }) });
      toast.success("Appointment cancelled");
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel");
    }
  }

  return (
    <PageContainer className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">Your upcoming and past consultations.</p>
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
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : appointments.isError ? (
        <ErrorState message={(appointments.error as Error).message} onRetry={() => void appointments.refetch()} />
      ) : (appointments.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={CalendarClock} title={scope === "upcoming" ? "No upcoming appointments" : "No past appointments"} description={scope === "upcoming" ? "Find a doctor and book a consultation." : undefined} action={scope === "upcoming" ? <Button asChild size="sm"><Link href="/patient/doctors">Find a doctor</Link></Button> : undefined} />
      ) : (
        <div className="space-y-4">
          {appointments.data?.data.map((appointment) => (
            <Card key={appointment.id}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                <InitialsAvatar displayName={appointment.doctor.displayName} color={appointment.doctor.avatarColor} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{appointment.doctor.displayName}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(appointment.startsAt)}</p>
                  <p className="truncate text-sm">{appointment.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={appointment.status} kind="appointment" />
                  {scope === "upcoming" && (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/consultation/${appointment.id}`}>Join</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRescheduling(appointment)}>
                        Reschedule
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The slot will be released and your doctor will be notified. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void cancel(appointment)}>Cancel appointment</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rescheduling && <RescheduleDialog appointment={rescheduling} onClose={() => setRescheduling(null)} />}
    </PageContainer>
  );
}

function RescheduleDialog({ appointment, onClose }: { appointment: AppointmentCard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>(new Date(appointment.startsAt));
  const [slot, setSlot] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dateOnly = toDateOnly(date);
  const slots = useQuery({
    queryKey: ["slots", appointment.doctor.id, dateOnly],
    queryFn: () => api<{ data: SlotDay[] }>(`/doctors/${appointment.doctor.id}/slots?from=${dateOnly}&to=${dateOnly}`),
  });

  async function reschedule() {
    if (!slot) return;
    setPending(true);
    try {
      await api(`/appointments/${appointment.id}/reschedule`, { method: "PATCH", body: JSON.stringify({ startsAt: slot, reason: "Rescheduled by patient" }) });
      toast.success("Appointment rescheduled");
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reschedule");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule with {appointment.doctor.displayName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} disabled={{ before: new Date() }} className="rounded-md border" />
          <div className="grid max-h-64 grid-cols-3 content-start gap-2 overflow-y-auto">
            {(slots.data?.data[0]?.slots ?? []).map((s) => (
              <Button
                key={s.startsAt}
                type="button"
                variant={slot === s.startsAt ? "default" : "outline"}
                disabled={!s.available}
                onClick={() => setSlot(s.startsAt)}
              >
                {new Date(s.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void reschedule()} disabled={!slot || pending}>
            {pending ? "Rescheduling…" : "Confirm new time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
