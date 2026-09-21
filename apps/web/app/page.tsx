import type { Metadata } from "next";
import Link from "next/link";
import {
  Baby,
  Bone,
  Brain,
  CalendarClock,
  ClipboardList,
  Heart,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "SickDoc — See the right doctor, faster",
  description:
    "A fictional telehealth prototype: describe your symptoms, get matched to the right specialist, and book a guided consultation.",
};

const DISCLAIMER =
  "This is a fictional prototype for demonstration purposes. It does not provide medical advice, diagnosis, or treatment, and no real consultations take place here.";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Describe what's wrong",
    body: "Pick symptoms or type them in plain words. A deterministic rules engine maps them to the right specialties — no AI, and you can see exactly why.",
  },
  {
    icon: Stethoscope,
    title: "Match with the right doctor",
    body: "Get ranked suggestions with an explainable rationale, or browse the directory and filter by specialization, language, and availability.",
  },
  {
    icon: CalendarClock,
    title: "Book and consult",
    body: "Choose a slot, join a guided session when it starts, and leave with consultation notes and prescriptions in your records.",
  },
];

const ROLES = [
  {
    icon: Heart,
    title: "For patients",
    body: "Guided matching, a browsable doctor directory, instant booking, and your own record timeline.",
    cta: { label: "Register as a patient", href: "/register/patient" },
  },
  {
    icon: Stethoscope,
    title: "For doctors",
    body: "Set weekly availability, see your day's appointments, and run consultations with notes and prescriptions.",
    cta: { label: "Register as a doctor", href: "/register/doctor" },
  },
  {
    icon: ShieldCheck,
    title: "For administrators",
    body: "Approve doctors, manage accounts, oversee appointments, and keep an append-only audit log.",
    cta: { label: "Sign in as admin", href: "/sign-in" },
  },
];

const SPECIALIZATIONS = [
  { icon: HeartPulse, name: "Cardiology", blurb: "Heart and blood-vessel conditions." },
  { icon: Sparkles, name: "Dermatology", blurb: "Skin, hair, and nail conditions." },
  { icon: Baby, name: "Pediatrics", blurb: "Care for infants, children, and adolescents." },
  { icon: Stethoscope, name: "Internal Medicine", blurb: "Adult primary and preventive care." },
  { icon: Brain, name: "Psychiatry", blurb: "Mental and behavioural health." },
  { icon: Bone, name: "Orthopedics", blurb: "Bones, joints, muscles, and spine." },
];

const FAQ = [
  {
    question: "Is this a real medical service?",
    answer:
      "No. SickDoc is a fictional prototype built to demonstrate a telehealth product. It does not provide medical advice, diagnosis, or treatment, and no real consultations take place here.",
  },
  {
    question: "How does matching work without AI?",
    answer:
      "Symptoms map to specialties through weighted tables. A doctor's score is the sum of those weights plus an availability bonus and an experience bonus — deterministic and explainable, so every suggestion can show its reasons.",
  },
  {
    question: "Where does my data live?",
    answer:
      "Everything runs locally: the Next.js app, the NestJS API, and a PostgreSQL database. No third-party service touches your auth, matching, notifications, or records.",
  },
  {
    question: "Can I use this on my phone?",
    answer:
      "The prototype is responsive down to mobile widths, though it is optimised for a desktop screen of 1280px and above.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="space-y-6">
            <Badge variant="outline" className="w-fit gap-1.5">
              <span className="size-1.5 rounded-full bg-warning" />
              Fictional prototype
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              See the right doctor,
              <br className="hidden sm:block" /> without the waiting room.
            </h1>
            <p className="max-w-prose text-base text-muted-foreground">
              SickDoc matches your symptoms to the right specialist, books you in seconds, and walks you
              through a guided consultation — with notes and prescriptions waiting in your records.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register/patient">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register/doctor">I&apos;m a doctor</Link>
              </Button>
            </div>
            <p className="max-w-prose text-xs text-muted-foreground">{DISCLAIMER}</p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-3">
              {[
                ["Chest tightness on exertion", "Cardiology"],
                ["Persistent cough and fever", "Internal Medicine"],
                ["Skin rash that won't fade", "Dermatology"],
              ].map(([reason, specialty]) => (
                <div key={reason} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                  <span>{reason}</span>
                  <Badge variant="secondary">{specialty}</Badge>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Deterministic matching, with the rationale shown for every suggestion.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b">
        <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-20">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">How it works</h2>
            <p className="max-w-prose text-sm text-muted-foreground">Three steps from symptom to consultation.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="gap-3">
                <CardHeader className="gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <step.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {step.title}
                  </CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-b">
        <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-20">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Built for everyone in the room</h2>
            <p className="max-w-prose text-sm text-muted-foreground">One product, three experiences.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {ROLES.map((role) => (
              <Card key={role.title} className="gap-4">
                <CardHeader className="gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <role.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{role.title}</CardTitle>
                  <CardDescription>{role.body}</CardDescription>
                </CardHeader>
                <div className="px-6 pb-6">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={role.cta.href}>{role.cta.label}</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Specializations */}
      <section id="specializations" className="border-b">
        <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-20">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Specializations</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              A focused set of practices, each with doctors who publish weekly availability.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SPECIALIZATIONS.map((spec) => (
              <div key={spec.name} className="flex items-start gap-4 rounded-xl border p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <spec.icon className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{spec.name}</p>
                  <p className="text-xs text-muted-foreground">{spec.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-20">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Frequently asked questions</h2>
            <p className="max-w-prose text-sm text-muted-foreground">The honest answers, including the limitations.</p>
          </div>
          <div className="mx-auto max-w-3xl space-y-2">
            {FAQ.map((item) => (
              <details key={item.question} className="group rounded-lg border px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  {item.question}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-prose text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
