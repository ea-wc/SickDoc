# Design Guidelines

The UI is built on **shadcn/ui** (Radix primitives + Tailwind CSS). Components are
copied into `apps/web/components/ui` and owned by this repo — there is no component
library dependency to fight, and no external design service at runtime. Fonts and
icons are bundled and self-hosted.

The product is a healthcare prototype. The design job is to look **calm, legible, and
trustworthy**, and to never let a fictional prototype be mistaken for real clinical
advice.

## 1. Principles

1. **Clarity over cleverness.** A patient booking a consultation should never wonder
   what a control does. Plain labels, visible state, no mystery-meat icons.
2. **Trust is visual.** Generous whitespace, restrained colour, consistent alignment,
   no dark patterns. Destructive actions always confirm and always say what happens.
3. **State is always shown.** Every async surface has loading, empty, error, and
   success states designed — not just the happy path.
4. **Desktop-first, responsive.** Optimised for ≥1280px; usable at 768px and 375px.
5. **Fictional, and it says so.** A prototype disclaimer is present on the landing
   page and in the footer of every authenticated layout.

## 2. Setup

```bash
pnpm dlx shadcn@latest init      # style: new-york, base color: slate, CSS variables: yes
pnpm dlx shadcn@latest add button card input label select textarea form badge avatar \
  dialog alert-dialog dropdown-menu sheet tabs table calendar popover command \
  toast skeleton separator scroll-area tooltip alert switch checkbox radio-group \
  breadcrumb pagination progress sonner
```

`new-york` style, `slate` base, CSS variables on — the variable mode is what makes the
theme tokens below swappable without touching component code.

## 3. Colour

Tokens live as HSL triples on `:root` and `.dark` in `apps/web/app/globals.css`.
Never hardcode a hex in a component; always go through a token or a Tailwind class
bound to one.

### Brand

A calm medical teal as primary, slate as the neutral. Teal reads as clinical and
reassuring without the alarm-adjacent energy of pure blue-red palettes.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;

  --primary: 176 62% 32%;            /* teal-700 — CTAs, active nav, links */
  --primary-foreground: 0 0% 100%;

  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 176 40% 94%;             /* tinted surfaces, selected slots */
  --accent-foreground: 176 62% 22%;

  --destructive: 0 72% 45%;
  --destructive-foreground: 0 0% 100%;
  --success: 152 60% 32%;
  --success-foreground: 0 0% 100%;
  --warning: 32 90% 44%;
  --warning-foreground: 0 0% 100%;
  --info: 213 84% 44%;
  --info-foreground: 0 0% 100%;

  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 176 62% 32%;
  --radius: 0.625rem;
}

.dark {
  --background: 222 47% 8%;
  --foreground: 210 40% 96%;
  --card: 222 44% 11%;
  --card-foreground: 210 40% 96%;
  --popover: 222 44% 11%;
  --popover-foreground: 210 40% 96%;

  --primary: 176 55% 48%;
  --primary-foreground: 222 47% 8%;

  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 96%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: 176 40% 18%;
  --accent-foreground: 176 55% 78%;

  --destructive: 0 63% 52%;
  --destructive-foreground: 0 0% 100%;
  --success: 152 48% 46%;
  --warning: 32 80% 56%;
  --info: 213 70% 60%;

  --border: 217 33% 20%;
  --input: 217 33% 20%;
  --ring: 176 55% 48%;
}
```

Dark mode ships via `next-themes` with `attribute="class"` and a system default.
Every screen must be checked in both themes before it is called done.

### Semantic use

| Meaning | Token | Where |
|---|---|---|
| Primary action | `primary` | Book, Save, Sign in — one per view |
| Neutral action | `secondary` / `outline` | Cancel, Back, filters |
| Positive state | `success` | Completed, Approved, Active |
| Caution | `warning` | Pending review, Rescheduled, expiring soon |
| Negative | `destructive` | Cancel appointment, Suspend, Reject |
| Informational | `info` | In progress, notification dots |

Colour never carries meaning alone — every status pairs a colour with a label, and
often an icon. That is both an accessibility requirement and a clinical-safety habit.

### Status badge mapping

| Domain value | Badge variant | Label |
|---|---|---|
| `CONFIRMED` | `default` (primary) | Confirmed |
| `PENDING` | `outline` + warning text | Pending |
| `RESCHEDULED` | `outline` + warning text | Rescheduled |
| `COMPLETED` | `secondary` + success text | Completed |
| `CANCELLED` | `outline` + muted text | Cancelled |
| `NO_SHOW` | `destructive` | No-show |
| Session `IN_PROGRESS` | `default` + pulsing info dot | In progress |
| Doctor `APPROVED` / `PENDING` / `REJECTED` | success / warning / destructive | Approved / Pending review / Rejected |
| User `ACTIVE` / `SUSPENDED` / `DEACTIVATED` | success / warning / muted | Active / Suspended / Deactivated |

Implement this as a single `<StatusBadge status={…} kind="appointment" />` component so
the mapping exists in exactly one place.

## 4. Typography

Self-hosted via `next/font/local` or `next/font/google` with `display: swap` — the
font is bundled at build time, so no runtime request leaves the container.

- **Sans:** Inter (UI, body). **Mono:** JetBrains Mono (ids, codes, dosages).

| Role | Class | Use |
|---|---|---|
| Display | `text-4xl font-semibold tracking-tight` | Landing hero |
| H1 | `text-3xl font-semibold tracking-tight` | Page title |
| H2 | `text-xl font-semibold` | Section heading |
| H3 | `text-base font-semibold` | Card title |
| Body | `text-sm` | Default UI text |
| Body large | `text-base` | Landing copy, consultation notes |
| Caption | `text-xs text-muted-foreground` | Timestamps, helper text |
| Numeric | `tabular-nums` | Times, counts, dosages, durations |

Line length caps at `max-w-prose` for any paragraph — consultation notes especially.

## 5. Spacing, layout, radius

4px base scale; use Tailwind's `1/2/3/4/6/8/12/16`. Do not invent arbitrary values.

- Page container: `mx-auto w-full max-w-7xl px-6 py-8`.
- Card padding: `p-6`; compact list rows `px-4 py-3`.
- Vertical rhythm between sections: `space-y-8`; within a section `space-y-4`.
- Form field gap: `space-y-2` inside a field, `space-y-6` between fields.
- Radius: `--radius: 0.625rem` — cards `rounded-xl`, inputs/buttons `rounded-lg`,
  badges `rounded-full`.
- Elevation: borders do the work. `shadow-sm` on cards, `shadow-md` only for popovers,
  dialogs, and dropdowns. No heavy drop shadows.

### App shells

| Area | Shell |
|---|---|
| Product website | Sticky transparent-to-solid header, centred content, footer with disclaimer and legal links |
| Patient | Left sidebar (Dashboard, Find a doctor, Guided match, Appointments, Records), top bar with notification bell and avatar menu |
| Doctor | Left sidebar (Dashboard, Schedule, Appointments, Patients), same top bar |
| Admin | Left sidebar (Dashboard, Users, Doctor reviews, Appointments, Audit log), top bar with a distinct `Admin` badge so the console is never mistaken for a clinical view |

Sidebar collapses to a `Sheet` below `lg`. Breadcrumbs on any page nested two levels deep.

## 6. Component conventions

- **Buttons.** One primary per view. Destructive actions use `variant="destructive"`
  and always route through `AlertDialog`. Buttons show a spinner and disable while
  pending; the label changes to the present participle ("Booking…").
- **Forms.** React Hook Form + zod resolver, shadcn `Form` primitives. Labels are
  always visible — never placeholder-as-label. Errors sit below the field in
  `text-destructive text-xs`, and the field gets `aria-invalid`. Server-side field
  errors from the API's `details` array map back onto the matching field.
- **Tables.** Used for admin lists and doctor patient lists. Sticky header, zebra-free,
  `text-sm`, row hover `bg-muted/50`, right-aligned numerics, a per-row actions
  `DropdownMenu`. Below `md`, tables become stacked cards.
- **Cards** are the default container for a doctor, an appointment, or a record.
- **Dialogs** for focused creation and confirmation; **Sheet** for filters and
  side detail on mobile.
- **Toasts** (`sonner`) for the outcome of every mutation — success is short and
  concrete ("Appointment booked for Tue, 22 Sep, 9:00 AM"), errors use the API's
  `message` verbatim and stay until dismissed.
- **Avatars** are generated initials on `avatarColor` from the profile — no image host.
  `<InitialsAvatar name displayName color size />` is the only avatar component.
- **Calendar and slot picker.** shadcn `Calendar` for date choice; slots render as a
  responsive grid of toggle buttons. Unavailable slots are rendered disabled and
  visible, not hidden — seeing a full morning is information.

## 7. State patterns

| State | Pattern |
|---|---|
| Loading | `Skeleton` matching the final layout's shape. Never a bare spinner on a full page. |
| Empty | Icon + one-line explanation + the primary action ("No appointments yet — Find a doctor"). |
| Error | `Alert variant="destructive"` with the API `message` and a Retry button. |
| Partial/stale | Keep previous data visible, dim to `opacity-60` while refetching. |
| Optimistic | Only for `mark as read`; everything clinical waits for the server. |

## 8. Accessibility

Target WCAG 2.1 AA.

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI boundaries. Verify both
  themes — the teal on white and the lighter teal on the dark background are both
  chosen to clear this.
- Every interactive element is keyboard reachable with a visible `focus-visible` ring
  (`ring-2 ring-ring ring-offset-2`). Never remove outlines.
- Radix handles focus trapping and `aria-*` in dialogs, menus, and popovers — do not
  hand-roll replacements.
- Icon-only buttons carry `aria-label` (and a `Tooltip` for sighted users).
- Form fields are associated with labels; error text is linked by `aria-describedby`.
- Live regions: notification count and session state changes announce politely.
- Respect `prefers-reduced-motion` — disable the pulse and slide transitions.
- Minimum 44×44px hit target for primary touch controls.

## 9. Motion

Restrained. `transition-colors duration-150` for hover and focus; `duration-200`
ease-out for dialog and sheet entrances (Radix defaults are fine). One pulsing
indicator only — the live consultation dot. No decorative page transitions.

## 10. Content and tone

- Plain, warm, direct. "Find a doctor", not "Initiate provider discovery".
- Dates: `Tue, 22 Sep 2026`. Times: `9:00 AM` with an explicit timezone abbreviation
  whenever patient and doctor zones may differ. Relative time only for the recent past
  ("2 hours ago") alongside the absolute value in a tooltip.
- Errors state what happened and what to do next. Never expose a stack trace or a raw
  error code to a patient.
- Never phrase fictional content as medical advice. The disclaimer reads:
  *"This is a fictional prototype for demonstration purposes. It does not provide
  medical advice, diagnosis, or treatment, and no real consultations take place here."*
  It appears on the landing page hero area and in every authenticated footer.

## 11. Definition of done for a screen

- [ ] Loading, empty, error, and success states implemented
- [ ] Light and dark themes checked
- [ ] Keyboard-only pass: reachable, visible focus, escape closes overlays
- [ ] 1280px, 768px, and 375px widths checked
- [ ] All colour tokens, no hardcoded hex values
- [ ] Every mutation gives a toast; destructive ones confirm first
- [ ] Copy reviewed against the tone rules above
