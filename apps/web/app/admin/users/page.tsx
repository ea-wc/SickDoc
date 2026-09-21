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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { StatusBadge } from "@/components/shared/status-badge";
import { Users } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  statusReason: string | null;
  displayName: string;
  doctorStatus: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<"SUSPENDED" | "DEACTIVATED" | "ACTIVE">("SUSPENDED");
  const [reason, setReason] = useState("");

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role !== "all") params.set("role", role);
  if (status !== "all") params.set("status", status);
  params.set("pageSize", "50");

  const users = useQuery({
    queryKey: ["admin", "users", params.toString()],
    queryFn: () => api<{ data: AdminUser[]; meta: PaginationMeta }>(`/admin/users?${params.toString()}`),
  });

  async function apply() {
    if (!target) return;
    try {
      await api(`/admin/users/${target.id}/status`, { method: "PATCH", body: JSON.stringify({ status: action, reason: reason || undefined }) });
      toast.success("Status updated");
      setTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update");
    }
  }

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and manage account status.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="PATIENT">Patient</SelectItem>
            <SelectItem value="DOCTOR">Doctor</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {users.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.isError ? (
        <ErrorState message={(users.error as Error).message} onRetry={() => void users.refetch()} />
      ) : users.data?.data.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search or filter." />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data?.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.displayName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} kind="user" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTarget(user);
                          setAction(user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED");
                        }}
                      >
                        {user.status === "SUSPENDED" ? "Reactivate" : user.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change account status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              {target?.displayName} ({target?.email})
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">New status</Label>
              <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for suspend / deactivate" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={() => void apply()}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
