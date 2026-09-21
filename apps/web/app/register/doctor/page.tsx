import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterDoctorForm } from "@/components/auth/register-doctor-form";

export const metadata: Metadata = { title: "Register as a doctor — SickDoc" };

export default function RegisterDoctorPage() {
  return (
    <AuthCard title="Register as a doctor" subtitle="Your profile will be reviewed before you appear in search">
      <RegisterDoctorForm />
    </AuthCard>
  );
}
