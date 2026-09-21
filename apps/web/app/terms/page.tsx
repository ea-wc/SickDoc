import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Terms — SickDoc",
  description: "Terms of use for the SickDoc fictional prototype.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">1. Fictional prototype</h2>
            <p>
              SickDoc is a fictional prototype for demonstration purposes. It does not provide medical
              advice, diagnosis, or treatment, and no real consultations take place here. Nothing in this
              application should be used to make decisions about your health.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">2. Accounts</h2>
            <p>
              Accounts are created with fictional, demonstration data. Credentials used to sign in to the
              prototype are placeholders and must never be reused anywhere else.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">3. Acceptable use</h2>
            <p>
              Do not enter real personal health information, and do not rely on any output produced by the
              prototype for any real-world purpose. The application is intended for evaluation only.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">4. No warranty</h2>
            <p>
              The prototype is provided &ldquo;as is&rdquo; without warranty of any kind. Its authors accept no
              liability for any use made of the application or its content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">5. Changes</h2>
            <p>
              These terms may change as the prototype evolves. Continued use of the prototype means you
              accept the current version of these terms.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
