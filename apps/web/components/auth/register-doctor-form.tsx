"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerDoctorSchema, type RegisterDoctorInput } from "@sickdoc/shared";
import { toast } from "sonner";
import { ApiError, api, registerDoctor } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface Specialization {
  id: string;
  slug: string;
  name: string;
  doctorCount: number;
}

export function RegisterDoctorForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const specializations = useQuery({
    queryKey: ["specializations"],
    queryFn: () => api<{ data: Specialization[] }>("/specializations"),
  });

  const form = useForm<RegisterDoctorInput>({
    resolver: zodResolver(registerDoctorSchema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "", title: "", licenseNumber: "", timezone: "Asia/Manila", bio: "", specializationIds: [] },
  });

  async function onSubmit(values: RegisterDoctorInput) {
    setPending(true);
    try {
      await registerDoctor(values);
      router.replace("/doctor");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to register");
    } finally {
      setPending(false);
    }
  }

  const selectedIds = useWatch({ control: form.control, name: "specializationIds" }) ?? [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="MD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License number</FormLabel>
                <FormControl>
                  <Input placeholder="PH-000000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="yearsOfExperience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Years of experience</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={70}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Input placeholder="A short professional summary" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || undefined)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="specializationIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specializations</FormLabel>
              {specializations.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(specializations.data?.data ?? []).map((spec) => {
                    const checked = (field.value ?? []).includes(spec.id);
                    return (
                      <label key={spec.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const current = field.value ?? [];
                            field.onChange(value ? [...current, spec.id] : current.filter((id) => id !== spec.id));
                          }}
                        />
                        {spec.name}
                      </label>
                    );
                  })}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="primarySpecializationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary specialization</FormLabel>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(specializations.data?.data ?? [])
                  .filter((spec) => selectedIds.includes(spec.id))
                  .map((spec) => (
                    <div key={spec.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <RadioGroupItem value={spec.id} id={`primary-${spec.id}`} />
                      <Label htmlFor={`primary-${spec.id}`} className="font-normal">
                        {spec.name}
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create doctor account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
