"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { AppointmentCard } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

interface PatientRecord {
  patient: {
    id: string;
    displayName: string;
    avatarColor: string;
    birthDate: string | null;
    sex: string | null;
    medicalHistory: string | null;
    allergies: string[];
    conditions: string[];
  };
  records: {
    appointmentId: string;
    startsAt: string;
    reason: string;
    note: { summary: string } | null;
    prescriptions: { items: { drugName: string; dosage: string }[] }[];
  }[];
}

export default function DoctorPatientsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const appointments = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => api<{ data: AppointmentCard[] }>("/appointments?scope=all&page=1&pageSize=100"),
  });

  const records = useQuery({
    queryKey: ["records", "patient", selected],
    enabled: Boolean(selected),
    queryFn: () => api<PatientRecord>(`/records/patients/${selected}`),
  });

  const patientMap = new Map<string, AppointmentCard["patient"]>();
  for (const appointment of appointments.data?.data ?? []) {
    if (!patientMap.has(appointment.patient.id)) patientMap.set(appointment.patient.id, appointment.patient);
  }
  const patients = Array.from(patientMap.values());

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
        <p className="text-sm text-muted-foreground">Patients you have a clinical relationship with.</p>
      </div>

      {appointments.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : appointments.isError ? (
        <ErrorState message={(appointments.error as Error).message} onRetry={() => void appointments.refetch()} />
      ) : patients.length === 0 ? (
        <EmptyState icon={Users} title="No patients yet" description="Patients appear here after they book with you." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelected(patient.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected === patient.id ? "bg-accent" : "hover:bg-muted/50"}`}
              >
                <InitialsAvatar displayName={patient.displayName} color={patient.avatarColor} size="sm" />
                <span className="text-sm font-medium">{patient.displayName}</span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!selected ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Select a patient to view their records.</p>
            ) : records.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : records.isError ? (
              <ErrorState message={(records.error as Error).message} onRetry={() => void records.refetch()} />
            ) : records.data ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{records.data.patient.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {records.data.patient.medicalHistory && <p>{records.data.patient.medicalHistory}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {records.data.patient.allergies.map((allergy) => (
                        <Badge key={allergy} variant="warning">{allergy}</Badge>
                      ))}
                      {records.data.patient.conditions.map((condition) => (
                        <Badge key={condition} variant="outline">{condition}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {records.data.records.map((record) => (
                  <Card key={record.appointmentId}>
                    <CardContent className="space-y-2 pt-6">
                      <p className="text-xs text-muted-foreground">{formatDate(record.startsAt)} · {record.reason}</p>
                      {record.note && <p className="text-sm">{record.note.summary}</p>}
                      {record.prescriptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {record.prescriptions.flatMap((p) => p.items).map((item) => (
                            <Badge key={item.drugName} variant="outline">{item.drugName} {item.dosage}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
