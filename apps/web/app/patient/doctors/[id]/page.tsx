"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { DoctorCard, SlotDay } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { toDateOnly } from "@/lib/format";

export default function DoctorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const doctor = useQuery({
    queryKey: ["doctor", params.id],
    queryFn: () => api<DoctorCard>(`/doctors/${params.id}`),
  });

  const dateOnly = toDateOnly(date);
  const slots = useQuery({
    queryKey: ["slots", params.id, dateOnly],
    queryFn: () => api<{ data: SlotDay[]; meta: { timezone: string } }>(`/doctors/${params.id}/slots?from=${dateOnly}&to=${dateOnly}`),
  });

  async function book() {
    if (!selectedSlot) return;
    setPending(true);
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({ doctorId: params.id, startsAt: selectedSlot.startsAt, reason: reason.trim() || "General consultation" }),
      });
      toast.success("Appointment booked");
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      router.push("/patient/appointments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to book");
    } finally {
      setPending(false);
    }
  }

  const daySlots = slots.data?.data[0]?.slots ?? [];

  return (
    <PageContainer className="space-y-8">
      {doctor.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : doctor.isError || !doctor.data ? (
        <ErrorState message={(doctor.error as Error)?.message ?? "Doctor not found"} onRetry={() => void doctor.refetch()} />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start">
              <InitialsAvatar displayName={doctor.data.displayName} color={doctor.data.avatarColor} size="lg" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">{doctor.data.displayName}</h1>
                <p className="text-sm text-muted-foreground">
                  {doctor.data.yearsOfExperience} years of experience · {doctor.data.languages.join(", ")}
                </p>
                <p className="max-w-prose text-sm">{doctor.data.bio}</p>
                <div className="flex flex-wrap gap-1.5">
                  {doctor.data.specializations.map((spec) => (
                    <Badge key={spec.id} variant={spec.isPrimary ? "secondary" : "outline"}>
                      {spec.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Timezone {doctor.data.timezone} · Fee {doctor.data.consultationFee ? `₱${doctor.data.consultationFee}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pick a date</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={{ before: new Date() }}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available times</CardTitle>
              </CardHeader>
              <CardContent>
                {slots.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : slots.isError ? (
                  <p className="py-8 text-center text-sm text-destructive">Could not load times. Try another date.</p>
                ) : daySlots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No times on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot) => (
                      <Button
                        key={slot.startsAt}
                        type="button"
                        variant={selectedSlot?.startsAt === slot.startsAt ? "default" : "outline"}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot({ startsAt: slot.startsAt, endsAt: slot.endsAt })}
                        className="w-full"
                      >
                        {new Date(slot.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </Button>
                    ))}
                  </div>
                )}
                {selectedSlot && (
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    You selected {new Date(selectedSlot.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — confirm below.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={selectedSlot !== null} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm booking</DialogTitle>
            <DialogDescription>
              {doctor.data?.displayName} · {selectedSlot ? new Date(selectedSlot.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for visit</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly describe your concern" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSlot(null)}>
              Cancel
            </Button>
            <Button onClick={() => void book()} disabled={pending}>
              {pending ? "Booking…" : "Confirm booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
