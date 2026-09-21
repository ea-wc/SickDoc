import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Privacy — SickDoc",
  description: "Privacy policy for the SickDoc fictional prototype.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">1. Overview</h2>
            <p>
              SickDoc is a fictional prototype. Any data entered into it is demonstration data stored in a
              local PostgreSQL database. No data is sold, shared with third parties, or used for any real
              clinical purpose.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">2. What is stored</h2>
            <p>
              The application stores account details, profiles, availability, appointments, consultation
              notes, prescriptions, and notifications. Passwords are hashed and never stored in plain text.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">3. Local-first, no third parties</h2>
            <p>
              Authentication, matching, notifications, messaging, scheduling, and records are all implemented
              in the application itself. No external SaaS, BaaS, analytics, or tracking service is used.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">4. Your responsibility</h2>
            <p>
              Because this is a prototype, do not enter real personal health information. Treat every
              credential and record you create here as disposable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">5. Contact</h2>
            <p>
              This prototype has no support channel. Refer to the project repository and documentation for
              details about the implementation.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
