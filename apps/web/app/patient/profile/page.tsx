"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";

interface PatientProfile {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string | null;
  weightKg: string | null;
  heightCm: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  medicalHistory: string | null;
  allergies: string[];
  conditions: string[];
}

export default function PatientProfilePage() {
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<PatientProfile>("/patients/me"),
  });

  if (profile.isLoading) return <PageContainer><Skeleton className="h-96 w-full" /></PageContainer>;
  if (profile.isError || !profile.data) return <PageContainer><ErrorState message={(profile.error as Error)?.message} onRetry={() => void profile.refetch()} /></PageContainer>;

  return <ProfileForm initial={profile.data} />;
}

function ProfileForm({ initial }: { initial: PatientProfile }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => ({
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    birthDate: initial.birthDate?.slice(0, 10) ?? "",
    sex: initial.sex ?? "",
    weightKg: initial.weightKg ?? "",
    heightCm: initial.heightCm ?? "",
    phone: initial.phone ?? "",
    addressLine: initial.addressLine ?? "",
    city: initial.city ?? "",
    country: initial.country ?? "",
    medicalHistory: initial.medicalHistory ?? "",
    allergies: (initial.allergies ?? []).join(", "),
    conditions: (initial.conditions ?? []).join(", "),
  }));

  function setField(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setPending(true);
    try {
      await api("/patients/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          birthDate: form.birthDate || null,
          sex: form.sex || null,
          weightKg: form.weightKg ? Number(form.weightKg) : undefined,
          heightCm: form.heightCm ? Number(form.heightCm) : undefined,
          phone: form.phone || null,
          addressLine: form.addressLine || null,
          city: form.city || null,
          country: form.country || null,
          medicalHistory: form.medicalHistory || null,
          allergies: (form.allergies ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          conditions: (form.conditions ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      toast.success("Profile updated");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageContainer className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Keep your details up to date.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={form.firstName} onChange={setField("firstName")} />
            <Field label="Last name" value={form.lastName} onChange={setField("lastName")} />
            <Field label="Date of birth" type="date" value={form.birthDate} onChange={setField("birthDate")} />
            <Field label="Sex" value={form.sex} onChange={setField("sex")} />
            <Field label="Weight (kg)" type="number" value={form.weightKg} onChange={setField("weightKg")} />
            <Field label="Height (cm)" type="number" value={form.heightCm} onChange={setField("heightCm")} />
            <Field label="Phone" value={form.phone} onChange={setField("phone")} />
            <Field label="City" value={form.city} onChange={setField("city")} />
            <Field label="Country" value={form.country} onChange={setField("country")} />
          </div>
          <Field label="Address" value={form.addressLine} onChange={setField("addressLine")} />
          <div className="space-y-1.5">
            <Label className="text-xs">Medical history</Label>
            <Textarea value={form.medicalHistory} onChange={setField("medicalHistory")} />
          </div>
          <Field label="Allergies (comma-separated)" value={form.allergies} onChange={setField("allergies")} />
          <Field label="Conditions (comma-separated)" value={form.conditions} onChange={setField("conditions")} />
          <Button onClick={() => void save()} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={onChange} />
    </div>
  );
}
