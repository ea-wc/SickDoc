"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { PaginationMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { StatusBadge } from "@/components/shared/status-badge";

interface AdminDoctor {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  licenseNumber: string;
  yearsOfExperience: number;
  status: string;
  bio: string | null;
  reviewNote: string | null;
  user: { email: string };
  specializations: { specialization: { name: string } }[];
}

export default function AdminDoctorsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [target, setTarget] = useState<AdminDoctor | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reason, setReason] = useState("");

  const doctors = useQuery({
    queryKey: ["admin", "doctors", status],
    queryFn: () => api<{ data: AdminDoctor[]; meta: PaginationMeta }>(`/admin/doctors?status=${status}&page=1&pageSize=50`),
  });

  async function review() {
    if (!target) return;
    try {
      await api(`/admin/doctors/${target.id}/review`, { method: "PATCH", body: JSON.stringify({ decision, reason: reason || undefined }) });
      toast.success("Review submitted");
      setTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review");
    }
  }

  return (
    <PageContainer className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Doctor reviews</h1>
          <p className="text-sm text-muted-foreground">Approve or reject submitted profiles.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {doctors.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : doctors.isError ? (
        <ErrorState message={(doctors.error as Error).message} onRetry={() => void doctors.refetch()} />
      ) : (
        <div className="space-y-4">
          {doctors.data?.data.map((doctor) => (
            <Card key={doctor.id}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{[doctor.title, doctor.firstName, doctor.lastName].filter(Boolean).join(" ")}</p>
                    <StatusBadge status={doctor.status} kind="doctor" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {doctor.user.email} · License {doctor.licenseNumber} · {doctor.yearsOfExperience} years
                  </p>
                  <p className="text-sm">{doctor.specializations.map((s) => s.specialization.name).join(", ")}</p>
                  {doctor.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{doctor.bio}</p>}
                </div>
                {doctor.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setTarget(doctor); setDecision("APPROVED"); }}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setTarget(doctor); setDecision("REJECTED"); }}>Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === "APPROVED" ? "Approve" : "Reject"} this profile?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">{target ? [target.title, target.firstName, target.lastName].filter(Boolean).join(" ") : ""}</p>
            {decision === "REJECTED" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={() => void review()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
