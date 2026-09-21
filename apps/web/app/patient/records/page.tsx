"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";

interface RecordItem {
  appointmentId: string;
  startsAt: string;
  reason: string;
  doctor: { id: string; displayName: string; avatarColor: string };
  note: { summary: string; assessment: string; plan: string } | null;
  prescriptions: { id: string; notes: string | null; items: { drugName: string; dosage: string; frequency: string }[] }[];
}

export default function RecordsPage() {
  const [type, setType] = useState<"appointments" | "notes" | "prescriptions">("appointments");

  const records = useQuery({
    queryKey: ["records", type],
    queryFn: () => api<{ data: RecordItem[] }>(`/records/me?type=${type}&page=1&pageSize=50`),
  });

  return (
    <PageContainer className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Records</h1>
          <p className="text-sm text-muted-foreground">Your consultation history, notes, and prescriptions.</p>
        </div>
        <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
          <TabsList>
            <TabsTrigger value="appointments">All</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {records.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : records.isError ? (
        <ErrorState message={(records.error as Error).message} onRetry={() => void records.refetch()} />
      ) : (records.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={FileText} title="No records yet" description="Completed consultations will appear here." />
      ) : (
        <div className="space-y-4">
          {records.data?.data.map((record) => (
            <Card key={record.appointmentId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{record.doctor.displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{formatDate(record.startsAt)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{record.reason}</p>
                {record.note && (
                  <div className="space-y-1 rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Consultation note</p>
                    <p className="text-sm">{record.note.summary}</p>
                    <p className="text-sm text-muted-foreground">{record.note.assessment}</p>
                    <p className="text-sm text-muted-foreground">{record.note.plan}</p>
                  </div>
                )}
                {record.prescriptions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Prescriptions</p>
                    {record.prescriptions.map((prescription) => (
                      <div key={prescription.id} className="space-y-1 rounded-lg border p-3">
                        {prescription.items.map((item) => (
                          <div key={item.drugName} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.drugName}</span>
                            <Badge variant="outline">{item.dosage}</Badge>
                          </div>
                        ))}
                        {prescription.notes && <p className="text-xs text-muted-foreground">{prescription.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
