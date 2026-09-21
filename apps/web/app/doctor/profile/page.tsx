"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/error-state";
import { PageContainer } from "@/components/shared/page-container";

interface DoctorProfile {
  firstName: string;
  lastName: string;
  title: string | null;
  bio: string | null;
  yearsOfExperience: number;
  consultationFee: string | null;
  languages: string[];
  timezone: string;
  status: string;
  specializations: { specializationId: string; specialization: { id: string; name: string }; isPrimary: boolean }[];
}

interface Specialization {
  id: string;
  name: string;
}

export default function DoctorProfilePage() {
  const profile = useQuery({
    queryKey: ["doctorProfile"],
    queryFn: () => api<DoctorProfile>("/doctors/me"),
  });

  const specializations = useQuery({
    queryKey: ["specializations"],
    queryFn: () => api<{ data: Specialization[] }>("/specializations"),
  });

  if (profile.isLoading) return <PageContainer><Skeleton className="h-96 w-full" /></PageContainer>;
  if (profile.isError || !profile.data) return <PageContainer><ErrorState message={(profile.error as Error)?.message} onRetry={() => void profile.refetch()} /></PageContainer>;

  return <ProfileForm initial={profile.data} specializations={specializations.data?.data ?? []} />;
}

function ProfileForm({ initial, specializations }: { initial: DoctorProfile; specializations: Specialization[] }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => ({
    firstName: initial.firstName,
    lastName: initial.lastName,
    title: initial.title ?? "",
    bio: initial.bio ?? "",
    yearsOfExperience: String(initial.yearsOfExperience ?? ""),
    consultationFee: initial.consultationFee ?? "",
    languages: initial.languages.join(", "),
    timezone: initial.timezone,
  }));
  const [selected, setSelected] = useState<string[]>(() => initial.specializations.map((s) => s.specializationId));
  const [primary, setPrimary] = useState<string>(() => initial.specializations.find((s) => s.isPrimary)?.specializationId ?? "");

  function setField(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setPending(true);
    try {
      await api("/doctors/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          title: form.title || null,
          bio: form.bio || null,
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
          consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
          languages: (form.languages ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          timezone: form.timezone,
          specializationIds: selected,
          primarySpecializationId: primary,
        }),
      });
      toast.success("Profile updated");
      await queryClient.invalidateQueries({ queryKey: ["doctorProfile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageContainer className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">Your public profile and credentials.</p>
        </div>
        <Badge variant={initial.status === "APPROVED" ? "success" : initial.status === "REJECTED" ? "destructive" : "warning"}>
          {initial.status === "APPROVED" ? "Approved" : initial.status === "REJECTED" ? "Rejected" : "Pending review"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={form.firstName} onChange={setField("firstName")} />
            <Field label="Last name" value={form.lastName} onChange={setField("lastName")} />
            <Field label="Title" value={form.title} onChange={setField("title")} />
            <Field label="Timezone" value={form.timezone} onChange={setField("timezone")} />
            <Field label="Years of experience" type="number" value={form.yearsOfExperience} onChange={setField("yearsOfExperience")} />
            <Field label="Consultation fee (₱)" type="number" value={form.consultationFee} onChange={setField("consultationFee")} />
          </div>
          <Field label="Languages (comma-separated)" value={form.languages} onChange={setField("languages")} />
          <div className="space-y-1.5">
            <Label className="text-xs">Bio</Label>
            <Textarea value={form.bio} onChange={setField("bio")} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Specializations</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {specializations.map((spec) => (
                <label key={spec.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={selected.includes(spec.id)} onCheckedChange={(value) => setSelected((prev) => (value ? [...prev, spec.id] : prev.filter((id) => id !== spec.id)))} />
                  {spec.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Primary specialization</Label>
            <RadioGroup value={primary} onValueChange={setPrimary} className="grid gap-2 sm:grid-cols-2">
              {specializations
                .filter((spec) => selected.includes(spec.id))
                .map((spec) => (
                  <div key={spec.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <RadioGroupItem value={spec.id} id={`primary-${spec.id}`} />
                    <Label htmlFor={`primary-${spec.id}`} className="font-normal">{spec.name}</Label>
                  </div>
                ))}
            </RadioGroup>
          </div>

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
