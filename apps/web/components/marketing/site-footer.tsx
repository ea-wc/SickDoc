import Link from "next/link";
import { Stethoscope } from "lucide-react";

const DISCLAIMER =
  "This is a fictional prototype for demonstration purposes. It does not provide medical advice, diagnosis, or treatment, and no real consultations take place here.";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Stethoscope className="size-4" />
              </span>
              SickDoc
            </div>
            <p className="max-w-md text-sm text-muted-foreground">{DISCLAIMER}</p>
          </div>

          <div className="flex gap-12 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Product</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/register/patient" className="transition-colors hover:text-foreground">
                    For patients
                  </Link>
                </li>
                <li>
                  <Link href="/register/doctor" className="transition-colors hover:text-foreground">
                    For doctors
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="transition-colors hover:text-foreground">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Legal</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/terms" className="transition-colors hover:text-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="transition-colors hover:text-foreground">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          © {year} SickDoc — a fictional telehealth prototype.
        </p>
      </div>
    </footer>
  );
}
