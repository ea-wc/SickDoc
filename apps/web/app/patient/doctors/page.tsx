"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope as StethoscopeIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import type { DoctorCard, PaginationMeta, Specialization } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

export default function FindDoctorPage() {
  const [q, setQ] = useState("");
  const [specializationId, setSpecializationId] = useState<string>("all");
  const [language, setLanguage] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [sort, setSort] = useState("relevance");

  const specializations = useQuery({
    queryKey: ["specializations"],
    queryFn: () => api<{ data: Specialization[] }>("/specializations"),
  });

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (specializationId !== "all") params.set("specializationId", specializationId);
  if (language) params.set("language", language);
  if (minExperience) params.set("minExperience", minExperience);
  params.set("sort", sort);
  params.set("pageSize", "50");

  const doctors = useQuery({
    queryKey: ["doctors", params.toString()],
    queryFn: () => api<{ data: DoctorCard[]; meta: PaginationMeta }>(`/doctors?${params.toString()}`),
  });

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Find a doctor</h1>
        <p className="text-sm text-muted-foreground">Search the approved directory and book a slot.</p>
      </div>

      <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <Label htmlFor="q" className="text-xs">
            Search
          </Label>
          <Input id="q" placeholder="Name or specialty" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Specialization</Label>
          <Select value={specializationId} onValueChange={setSpecializationId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(specializations.data?.data ?? []).map((spec) => (
                <SelectItem key={spec.id} value={spec.id}>
                  {spec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="language" className="text-xs">
            Language
          </Label>
          <Input id="language" placeholder="e.g. English" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:col-span-1">
          <div>
            <Label htmlFor="experience" className="text-xs">
              Min years
            </Label>
            <Input id="experience" type="number" min={0} value={minExperience} onChange={(e) => setMinExperience(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sort</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="experience">Experience</SelectItem>
                <SelectItem value="earliestSlot">Earliest slot</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {doctors.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : doctors.isError ? (
        <ErrorState message={(doctors.error as Error).message} onRetry={() => void doctors.refetch()} />
      ) : (doctors.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={StethoscopeIcon} title="No doctors match your filters" description="Try broadening the search." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {doctors.data?.data.map((doctor) => (
            <Link key={doctor.id} href={`/patient/doctors/${doctor.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardContent className="flex gap-4 pt-6">
                  <InitialsAvatar displayName={doctor.displayName} color={doctor.avatarColor} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">{doctor.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doctor.yearsOfExperience} years · {doctor.languages.join(", ")}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{doctor.bio}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {doctor.specializations.map((spec) => (
                        <Badge key={spec.id} variant={spec.isPrimary ? "secondary" : "outline"}>
                          {spec.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="pt-1 text-xs">
                      Next available:{" "}
                      <span className="font-medium">{doctor.nextAvailableAt ? new Date(doctor.nextAvailableAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Ask"}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
