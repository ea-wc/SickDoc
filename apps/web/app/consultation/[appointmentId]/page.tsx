"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge } from "@/components/shared/status-badge";

interface Workspace {
  appointment: { id: string; startsAt: string; endsAt: string; status: string; reason: string };
  session: {
    id: string;
    status: string;
    patientJoinedAt: string | null;
    doctorJoinedAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    joinableAt: string;
    joinWindowEndsAt: string;
  };
  patient: { id: string; displayName: string; initials: string; avatarColor: string };
  doctor: { id: string; displayName: string; initials: string; avatarColor: string; primarySpecialization: string | null };
  patientHistory?: { medicalHistory: string | null; allergies: string[]; conditions: string[] };
}

interface Detail {
  note: { summary: string; assessment: string; plan: string } | null;
  prescriptions: { id: string; notes: string | null; items: { drugName: string; dosage: string; frequency: string }[] }[];
}

export default function ConsultationPage() {
  const params = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState({ subjective: "", objective: "", assessment: "", plan: "", summary: "" });
  const [rx, setRx] = useState({ drugName: "", dosage: "", frequency: "", notes: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["consultation", params.appointmentId],
    queryFn: () => api<Workspace>(`/consultations/${params.appointmentId}`),
    refetchInterval: 5000,
  });

  const detail = useQuery({
    queryKey: ["appointment", params.appointmentId],
    queryFn: () => api<Detail>(`/appointments/${params.appointmentId}`),
    enabled: workspace.data?.session.status === "COMPLETED" || user?.role === "DOCTOR",
  });

  async function act(action: string) {
    setBusy(action);
    try {
      await api(`/consultations/${params.appointmentId}/${action}`, { method: "POST" });
      toast.success("Updated");
      await queryClient.invalidateQueries({ queryKey: ["consultation", params.appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ["appointment", params.appointmentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    setBusy("note");
    try {
      await api(`/appointments/${params.appointmentId}/note`, { method: "POST", body: JSON.stringify(note) });
      toast.success("Note saved");
      setNote({ subjective: "", objective: "", assessment: "", plan: "", summary: "" });
      await queryClient.invalidateQueries({ queryKey: ["appointment", params.appointmentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setBusy(null);
    }
  }

  async function savePrescription() {
    setBusy("rx");
    try {
      await api(`/appointments/${params.appointmentId}/prescriptions`, {
        method: "POST",
        body: JSON.stringify({ notes: rx.notes || undefined, items: [{ drugName: rx.drugName, dosage: rx.dosage, frequency: rx.frequency }] }),
      });
      toast.success("Prescription issued");
      setRx({ drugName: "", dosage: "", frequency: "", notes: "" });
      await queryClient.invalidateQueries({ queryKey: ["appointment", params.appointmentId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to issue prescription");
    } finally {
      setBusy(null);
    }
  }

  if (workspace.isLoading) return <PageContainer><Skeleton className="h-96 w-full" /></PageContainer>;
  if (workspace.isError || !workspace.data) return <PageContainer><ErrorState message={(workspace.error as Error)?.message ?? "Consultation not found"} /></PageContainer>;

  const { appointment, session, patient, doctor, patientHistory } = workspace.data;
  const isDoctor = user?.role === "DOCTOR";
  const completed = session.status === "COMPLETED";

  return (
    <PageContainer className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Consultation</h1>
          <p className="text-sm text-muted-foreground">{appointment.reason}</p>
        </div>
        <StatusBadge status={session.status} kind="session" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <InitialsAvatar displayName={doctor.displayName} color={doctor.avatarColor} />
              <div>
                <p className="font-medium">{doctor.displayName}</p>
                <p className="text-xs text-muted-foreground">{doctor.primarySpecialization}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <InitialsAvatar displayName={patient.displayName} color={patient.avatarColor} />
              <div>
                <p className="font-medium">{patient.displayName}</p>
                <p className="text-xs text-muted-foreground">Patient</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{formatDateTime(appointment.startsAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Started: {session.startedAt ? formatDateTime(session.startedAt) : "—"}</p>
            <p>Patient joined: {session.patientJoinedAt ? formatDateTime(session.patientJoinedAt) : "—"}</p>
            <p>Doctor joined: {session.doctorJoinedAt ? formatDateTime(session.doctorJoinedAt) : "—"}</p>
            {session.durationSeconds != null && <p>Duration: {Math.floor(session.durationSeconds / 60)} min</p>}

            <div className="flex flex-wrap gap-2 pt-2">
              {(session.status === "SCHEDULED" || session.status === "JOINED") && (
                <Button onClick={() => act("join")} disabled={busy === "join"}>
                  {session.status === "JOINED" ? "Join (re-open)" : "Join"}
                </Button>
              )}
              {isDoctor && session.status === "JOINED" && (
                <Button onClick={() => act("start")} disabled={busy === "start"}>
                  {busy === "start" ? "Starting…" : "Start consultation"}
                </Button>
              )}
              {isDoctor && session.status === "IN_PROGRESS" && (
                <Button onClick={() => act("complete")} disabled={busy === "complete"}>
                  {busy === "complete" ? "Completing…" : "Complete consultation"}
                </Button>
              )}
              {isDoctor && (session.status === "SCHEDULED" || session.status === "JOINED") && (
                <Button variant="outline" onClick={() => act("no-show")} disabled={busy === "no-show"}>
                  Mark no-show
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isDoctor && patientHistory && (session.status === "JOINED" || session.status === "IN_PROGRESS") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patientHistory.medicalHistory && <p>{patientHistory.medicalHistory}</p>}
            <div className="flex flex-wrap gap-1.5">
              {patientHistory.allergies.map((a) => <Badge key={a} variant="warning">{a}</Badge>)}
              {patientHistory.conditions.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      {isDoctor && (session.status === "IN_PROGRESS" || completed) && !detail.data?.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Write consultation note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Subjective" value={note.subjective} onChange={(e) => setNote({ ...note, subjective: e.target.value })} />
            <Textarea placeholder="Objective" value={note.objective} onChange={(e) => setNote({ ...note, objective: e.target.value })} />
            <Textarea placeholder="Assessment" value={note.assessment} onChange={(e) => setNote({ ...note, assessment: e.target.value })} />
            <Textarea placeholder="Plan" value={note.plan} onChange={(e) => setNote({ ...note, plan: e.target.value })} />
            <Textarea placeholder="Summary" value={note.summary} onChange={(e) => setNote({ ...note, summary: e.target.value })} />
            <Button onClick={() => void saveNote()} disabled={busy === "note" || !note.assessment || !note.plan || !note.summary}>
              {busy === "note" ? "Saving…" : "Save note"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isDoctor && (session.status === "IN_PROGRESS" || completed) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue prescription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Drug</Label>
                <Input value={rx.drugName} onChange={(e) => setRx({ ...rx, drugName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dosage</Label>
                <Input value={rx.dosage} onChange={(e) => setRx({ ...rx, dosage: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency</Label>
                <Input value={rx.frequency} onChange={(e) => setRx({ ...rx, frequency: e.target.value })} />
              </div>
            </div>
            <Input placeholder="Notes (optional)" value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} />
            <Button onClick={() => void savePrescription()} disabled={busy === "rx" || !rx.drugName || !rx.dosage || !rx.frequency}>
              {busy === "rx" ? "Issuing…" : "Issue prescription"}
            </Button>
          </CardContent>
        </Card>
      )}

      {completed && detail.data?.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{detail.data.note.summary}</p>
            <p className="text-muted-foreground">{detail.data.note.assessment}</p>
            <p className="text-muted-foreground">{detail.data.note.plan}</p>
          </CardContent>
        </Card>
      )}

      {(detail.data?.prescriptions.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prescriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.data?.prescriptions.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 text-sm">
                {p.items.map((item) => (
                  <p key={item.drugName} className="font-medium">{item.drugName} · {item.dosage} · {item.frequency}</p>
                ))}
                {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
