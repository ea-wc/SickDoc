import { RoleShell } from "@/components/shared/role-shell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="doctor">{children}</RoleShell>;
}
