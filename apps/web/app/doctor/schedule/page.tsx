"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailabilityRule {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  isActive: boolean;
}

interface AvailabilityException {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

interface Availability {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  timezone: string;
}

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default function DoctorSchedulePage() {
  const availability = useQuery({
    queryKey: ["availability"],
    queryFn: () => api<Availability>("/doctors/me/availability"),
  });

  if (availability.isLoading) return <PageContainer><Skeleton className="h-96 w-full" /></PageContainer>;
  if (availability.isError || !availability.data) return <PageContainer><ErrorState message={(availability.error as Error)?.message} onRetry={() => void availability.refetch()} /></PageContainer>;

  return <ScheduleEditor initial={availability.data} />;
}

function ScheduleEditor({ initial }: { initial: Availability }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() =>
    WEEKDAYS.map((_, weekday) => {
      const rule = initial.rules.find((r) => r.weekday === weekday && r.isActive);
      return rule ? { enabled: true, start: toHHMM(rule.startMinute), end: toHHMM(rule.endMinute) } : { enabled: false, start: "09:00", end: "17:00" };
    }),
  );
  const [exception, setException] = useState({ startsAt: "", endsAt: "", reason: "" });

  const saveRules = useMutation({
    mutationFn: () =>
      api<{ meta: { conflicts: { id: string; startsAt: string }[] } }>("/doctors/me/availability", {
        method: "PUT",
        body: JSON.stringify({
          rules: rows
            .map((row, weekday) => ({ row, weekday }))
            .filter(({ row }) => row.enabled)
            .map(({ row, weekday }) => ({ weekday, startMinute: toMinutes(row.start), endMinute: toMinutes(row.end), slotMinutes: 30 })),
        }),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      if (data.meta.conflicts.length > 0) {
        toast.warning(`${data.meta.conflicts.length} appointment(s) fall outside your new availability`);
      } else {
        toast.success("Schedule saved");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save"),
  });

  const addException = useMutation({
    mutationFn: () => api("/doctors/me/availability/exceptions", { method: "POST", body: JSON.stringify(exception) }),
    onSuccess: async () => {
      toast.success("Exception added");
      setException({ startsAt: "", endsAt: "", reason: "" });
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to add"),
  });

  const deleteException = useMutation({
    mutationFn: (id: string) => api(`/doctors/me/availability/exceptions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Exception removed");
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to remove"),
  });

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">Set your weekly availability in {initial.timezone}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAYS.map((day, weekday) => (
            <div key={day} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Switch checked={rows[weekday].enabled} onCheckedChange={(checked) => setRows((prev) => prev.map((r, i) => (i === weekday ? { ...r, enabled: checked } : r)))} />
              <span className="w-28 text-sm font-medium">{day}</span>
              <div className="flex items-center gap-2">
                <Input type="time" value={rows[weekday].start} disabled={!rows[weekday].enabled} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === weekday ? { ...r, start: e.target.value } : r)))} />
                <span className="text-sm text-muted-foreground">–</span>
                <Input type="time" value={rows[weekday].end} disabled={!rows[weekday].enabled} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === weekday ? { ...r, end: e.target.value } : r)))} />
              </div>
            </div>
          ))}
          <Button onClick={() => saveRules.mutate()} disabled={saveRules.isPending}>
            {saveRules.isPending ? "Saving…" : "Save schedule"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blocked times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {initial.exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked times.</p>
          ) : (
            <div className="space-y-2">
              {initial.exceptions.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>
                    {formatDateTime(ex.startsAt)} – {formatDateTime(ex.endsAt)}
                    {ex.reason ? <span className="text-muted-foreground"> · {ex.reason}</span> : null}
                  </span>
                  <Button size="sm" variant="destructive" onClick={() => deleteException.mutate(ex.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="datetime-local" value={exception.startsAt} onChange={(e) => setException((x) => ({ ...x, startsAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="datetime-local" value={exception.endsAt} onChange={(e) => setException((x) => ({ ...x, endsAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Reason</Label>
              <Input value={exception.reason} onChange={(e) => setException((x) => ({ ...x, reason: e.target.value }))} placeholder="Conference, leave…" />
            </div>
          </div>
          <Button variant="outline" disabled={!exception.startsAt || !exception.endsAt || addException.isPending} onClick={() => addException.mutate()}>
            {addException.isPending ? "Adding…" : "Block time"}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
