"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { PaginationMeta } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { ScrollText } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
  actor: { id: string; email: string };
}

export default function AdminAuditPage() {
  const logs = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => api<{ data: AuditLog[]; meta: PaginationMeta }>("/admin/audit-logs?page=1&pageSize=50"),
  });

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Append-only, read-only record of admin actions.</p>
      </div>

      {logs.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : logs.isError ? (
        <ErrorState message={(logs.error as Error).message} onRetry={() => void logs.refetch()} />
      ) : logs.data?.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Admin actions will appear here." />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data?.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-normal">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>{log.actor.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.entityType}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.reason ?? "—"}</TableCell>
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
