import { RoleShell } from "@/components/shared/role-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="admin">{children}</RoleShell>;
}
