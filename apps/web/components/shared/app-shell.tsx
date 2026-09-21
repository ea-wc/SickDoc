"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Left-sidebar shell for the role applications (DESIGN_GUIDELINES §5). Collapses
 * to a Sheet below `lg`, carries the prototype disclaimer, and shows an avatar
 * menu for sign-out.
 */
export function AppShell({
  nav,
  user,
  badge,
  onSignOut,
  children,
}: {
  nav: NavItem[];
  user: { displayName: string; avatarColor: string };
  badge?: string;
  onSignOut?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden flex-col border-r px-4 py-6 lg:flex lg:w-64 lg:shrink-0">
        <div className="mb-8 px-2 text-lg font-semibold tracking-tight">SickDoc</div>
        {navLinks}
        <p className="mt-auto px-2 pt-4 text-xs text-muted-foreground">Fictional prototype. Not medical advice.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mb-6 px-2 text-lg font-semibold tracking-tight">SickDoc</div>
                {navLinks}
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium">{badge ?? "Portal"}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <InitialsAvatar displayName={user.displayName} color={user.avatarColor} size="sm" />
                <span className="hidden text-sm sm:block">{user.displayName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user.displayName}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onSignOut?.()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
