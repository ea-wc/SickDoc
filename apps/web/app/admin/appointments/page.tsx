"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { PaginationMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { StatusBadge } from "@/components/shared/status-badge";

interface AdminAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reason: string;
  patient: { id: string; firstName: string; lastName: string };
  doctor: { id: string; firstName: string; lastName: string };
  session: { id: string; status: string } | null;
}

export default function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [invalidOnly, setInvalidOnly] = useState(false);

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (invalidOnly) params.set("invalidOnly", "true");
  params.set("pageSize", "50");

  const appointments = useQuery({
    queryKey: ["admin", "appointments", params.toString()],
    queryFn: () => api<{ data: AdminAppointment[]; meta: PaginationMeta }>(`/admin/appointments?${params.toString()}`),
  });

  async function act(appointment: AdminAppointment, action: "cancel" | "MARK_NO_SHOW" | "FORCE_COMPLETE") {
    try {
      if (action === "cancel") {
        await api(`/admin/appointments/${appointment.id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason: "Administrative action" }) });
      } else {
        await api(`/admin/appointments/${appointment.id}/resolve`, { method: "PATCH", body: JSON.stringify({ action }) });
      }
      toast.success("Updated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <PageContainer className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">Oversight across every appointment.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="NO_SHOW">No-show</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={invalidOnly} onCheckedChange={setInvalidOnly} />
            Dangling only
          </label>
        </div>
      </div>

      {appointments.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : appointments.isError ? (
        <ErrorState message={(appointments.error as Error).message} onRetry={() => void appointments.refetch()} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.data?.data.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="whitespace-normal">{formatDateTime(appointment.startsAt)}</TableCell>
                    <TableCell>{`${appointment.patient.firstName} ${appointment.patient.lastName}`}</TableCell>
                    <TableCell>{`${appointment.doctor.firstName} ${appointment.doctor.lastName}`}</TableCell>
                    <TableCell>
                      <StatusBadge status={appointment.status} kind="appointment" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => void act(appointment, "cancel")}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void act(appointment, "MARK_NO_SHOW")}>
                          No-show
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void act(appointment, "FORCE_COMPLETE")}>
                          Complete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
