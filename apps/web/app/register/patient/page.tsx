import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterPatientForm } from "@/components/auth/register-patient-form";

export const metadata: Metadata = { title: "Register as a patient — SickDoc" };

export default function RegisterPatientPage() {
  return (
    <AuthCard title="Register as a patient" subtitle="Create your account in under a minute">
      <RegisterPatientForm />
    </AuthCard>
  );
}
