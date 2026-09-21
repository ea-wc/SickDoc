import { RoleShell } from "@/components/shared/role-shell";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="patient">{children}</RoleShell>;
}
