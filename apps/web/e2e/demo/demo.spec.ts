import { type Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { ADMIN, MONTHS, WEEKDAYS, beat, click, navigate, ordinal, typeInto, visible } from "../helpers";

/**
 * Full end-to-end demo — one continuous, narrated journey through the SickDoc
 * prototype (see demo/DEMO_FLOW.md). Run with `pnpm test:e2e:demo` (headed,
 * slow, mouse indicator). This is a slow demo, so the timeout is generous.
 */
test.setTimeout(600_000);

/** Short unique suffix so every run registers fresh demo users (DEMO_FLOW.md). */
const SHA = Date.now().toString(36).slice(-6);

const DOCTOR_FIRST = `Doc ${SHA}`;
const DOCTOR_LAST = "Doctor";
const DOCTOR_EMAIL = `demo.doctor.${SHA}@gmail.com`;
const DOCTOR_DISPLAY = `${DOCTOR_FIRST} ${DOCTOR_LAST}`;

const PATIENT_FIRST = `Pat ${SHA}`;
const PATIENT_LAST = "Patient";
const PATIENT_EMAIL = `demo.patient.${SHA}@gmail.com`;
const PATIENT_DISPLAY = `${PATIENT_FIRST} ${PATIENT_LAST}`;

const LICENSE_NUMBER = `PH-${Date.now().toString().slice(-6)}`;

/** Signs in from the product page by clicking the header "Sign in" link. */
async function signInFromLanding(page: Page, email: string, password: string, home: string): Promise<void> {
  await navigate(page, page.locator("header").getByRole("link", { name: "Sign in" }));
  await page.waitForURL((url) => url.pathname === "/sign-in");
  await typeInto(page, page.getByLabel("Email"), email);
  await typeInto(page, page.getByLabel("Password"), password);
  await beat(page);
  await click(page, page.getByRole("button", { name: "Sign in" }));
  await page.waitForURL((url) => url.pathname === home);
  await beat(page);
}

/** Signs the current user out via the avatar menu and returns to the product page. */
async function signOut(page: Page, displayName: string): Promise<void> {
  await beat(page);
  await click(page, page.getByRole("button", { name: displayName }));
  await click(page, page.getByRole("menuitem", { name: "Sign out" }));
  await page.waitForURL((url) => url.pathname === "/");
  await beat(page);
}

/** Iterate future weekdays until a bookable slot appears. */
async function pickFirstBookableSlot(page: Page): Promise<void> {
  const today = new Date();
  for (let offset = 1; offset <= 21; offset++) {
    const candidate = new Date(today);
    candidate.setDate(candidate.getDate() + offset);
    const weekday = candidate.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const shownMonth = await page.locator('[role="grid"]').getAttribute("aria-label");
    if (shownMonth && !shownMonth.startsWith(MONTHS[candidate.getMonth()])) {
      await click(page, page.getByRole("button", { name: "Go to the Next Month" }));
      await page.waitForTimeout(300);
    }

    const label = `${WEEKDAYS[weekday]}, ${MONTHS[candidate.getMonth()]} ${ordinal(candidate.getDate())}, ${candidate.getFullYear()}`;
    const day = page.getByRole("button", { name: new RegExp(label) });
    if ((await day.count()) === 0) continue;
    await click(page, day);
    await page.waitForTimeout(1000);

    const slots = page.locator("main button:not([disabled])").filter({ hasText: /AM|PM/ });
    if ((await slots.count()) > 0) {
      await click(page, slots.first());
      await expect(page.getByRole("dialog")).toBeVisible();
      return;
    }
  }
  throw new Error("Could not find a bookable slot within three weeks");
}

test("full journey: doctor registers, admin approves, patient books, everyone follows up", async ({ page }) => {
  // ── 1. Doctor registration ──────────────────────────────────────────────
  await test.step("Doctor registers", async () => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SickDoc/);
    await navigate(page, page.getByRole("link", { name: "I'm a doctor" }));
    await page.waitForURL((url) => url.pathname === "/register/doctor");
    await expect(page.getByRole("heading", { name: "Register as a doctor" })).toBeVisible();

    await typeInto(page, page.getByLabel("First name"), DOCTOR_FIRST);
    await typeInto(page, page.getByLabel("Last name"), DOCTOR_LAST);
    await typeInto(page, page.getByLabel("Title"), "MD");
    await typeInto(page, page.getByLabel("License number"), LICENSE_NUMBER);
    await typeInto(page, page.getByLabel("Email"), DOCTOR_EMAIL);
    await typeInto(page, page.getByLabel("Password"), "Password123");
    await typeInto(page, page.getByLabel("Years of experience"), "8");
    await typeInto(page, page.getByLabel("Bio"), "Board-certified cardiologist focused on preventive care.");
    await visible(page, page.getByText("Specializations", { exact: true }));
    await click(page, page.getByRole("checkbox", { name: "Cardiology" }));
    await click(page, page.getByRole("radio", { name: "Cardiology" }));
    await visible(page, page.getByRole("button", { name: "Create doctor account" }));
    await click(page, page.getByRole("button", { name: "Create doctor account" }));
    await page.waitForURL((url) => url.pathname === "/doctor");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // The profile is still pending admin review.
    await navigate(page, page.locator("aside").getByRole("link", { name: "Profile" }));
    await page.waitForURL((url) => url.pathname === "/doctor/profile");
    await expect(page.getByText("Pending review")).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Dashboard" }));
    await page.waitForURL((url) => url.pathname === "/doctor");
  });

  // ── 2. Doctor schedule setup (Monday–Friday) ────────────────────────────
  await test.step("Doctor sets a Monday–Friday schedule", async () => {
    await navigate(page, page.locator("aside").getByRole("link", { name: "Schedule" }));
    await page.waitForURL((url) => url.pathname === "/doctor/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByText("Weekly hours", { exact: true })).toBeVisible();
    await expect(page.getByText("Blocked times", { exact: true })).toBeVisible();

    // Enable Monday (index 1) through Friday (index 5).
    const switches = page.getByRole("switch");
    for (let weekday = 1; weekday <= 5; weekday++) {
      await click(page, switches.nth(weekday));
    }

    await click(page, page.getByRole("button", { name: "Save schedule" }));
    await expect(page.getByText("Schedule saved")).toBeVisible();

    await signOut(page, DOCTOR_DISPLAY);
  });

  // ── 3. Admin approval ────────────────────────────────────────────────────
  await test.step("Admin approves the doctor", async () => {
    await signInFromLanding(page, ADMIN.email, ADMIN.password, ADMIN.home);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Doctor reviews" }));
    await page.waitForURL((url) => url.pathname === "/admin/doctors");
    await expect(page.getByRole("heading", { name: "Doctor reviews" })).toBeVisible();

    // Locate the newly registered doctor's card by its unique email (the list
    // order is not guaranteed), then approve it.
    const card = page
      .locator("div")
      .filter({ has: page.getByText(DOCTOR_EMAIL) })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .last();
    await click(page, card.getByRole("button", { name: "Approve" }));
    await expect(page.getByRole("dialog")).toContainText(DOCTOR_DISPLAY);
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Confirm" }));
    await expect(page.getByText(DOCTOR_EMAIL)).toHaveCount(0);

    // Switch to the approved list and search for the newly approved doctor.
    await click(page, page.getByRole("combobox"));
    await click(page, page.getByRole("option", { name: "Approved" }));
    await typeInto(page, page.getByPlaceholder("Search name or email"), DOCTOR_FIRST);
    await expect(page.getByText(DOCTOR_EMAIL)).toBeVisible();

    await signOut(page, "Administrator");
  });

  // ── 4. Patient browses the product website ──────────────────────────────
  await test.step("Patient browses the product site", async () => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("See the right doctor");
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    // Fictional-prototype trust messaging.
    await expect(page.getByText("Fictional prototype").first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByText(/does not provide medical advice/i)).toBeVisible();

    await navigate(page, page.getByRole("contentinfo").getByRole("link", { name: "Terms" }));
    await page.waitForURL((url) => url.pathname === "/terms");
    await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();

    await navigate(page, page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }));
    await page.waitForURL((url) => url.pathname === "/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();

    await navigate(page, page.getByRole("link", { name: "SickDoc" }));
    await page.waitForURL((url) => url.pathname === "/");
  });

  // ── 5. Patient registration ─────────────────────────────────────────────
  await test.step("Patient registers", async () => {
    await navigate(page, page.getByRole("link", { name: "Get started" }));
    await page.waitForURL((url) => url.pathname === "/register/patient");
    await expect(page.getByRole("heading", { name: "Register as a patient" })).toBeVisible();

    await typeInto(page, page.getByLabel("First name"), PATIENT_FIRST);
    await typeInto(page, page.getByLabel("Last name"), PATIENT_LAST);
    await typeInto(page, page.getByLabel("Email"), PATIENT_EMAIL);
    await typeInto(page, page.getByLabel("Password"), "Password123");
    await page.getByLabel("Date of birth").fill("1995-06-15");
    await typeInto(page, page.getByLabel("Phone"), "+63 900 111 2222");
    await click(page, page.getByRole("button", { name: "Create account" }));
    await page.waitForURL((url) => url.pathname === "/patient");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Complete the basic profile.
    await beat(page);
    await page.goto("/patient/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await typeInto(page, page.locator('input[type="number"]').nth(0), "62");
    await typeInto(page, page.locator('input[type="number"]').nth(1), "168");
    await typeInto(page, page.locator("textarea"), "Mild asthma; otherwise healthy.");
    await click(page, page.getByRole("button", { name: "Save changes" }));
    await expect(page.getByText("Profile updated")).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Dashboard" }));
    await page.waitForURL((url) => url.pathname === "/patient");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  // ── 6. Patient discovers a doctor ───────────────────────────────────────
  await test.step("Patient finds a doctor", async () => {
    await navigate(page, page.locator("aside").getByRole("link", { name: "Find a doctor" }));
    await page.waitForURL((url) => url.pathname === "/patient/doctors");
    await expect(page.getByRole("heading", { name: "Find a doctor" })).toBeVisible();

    await typeInto(page, page.getByPlaceholder("Name or specialty"), DOCTOR_FIRST);
    const doctorLink = page.getByRole("link", { name: new RegExp(DOCTOR_FIRST) });
    await expect(doctorLink).toBeVisible();
    await navigate(page, doctorLink);
    await page.waitForURL(/\/patient\/doctors\/[0-9a-f-]{36}/);
    await expect(page.getByText("Available times")).toBeVisible();
  });

  // ── 7. Guided matching ──────────────────────────────────────────────────
  await test.step("Patient matches symptoms", async () => {
    await navigate(page, page.locator("aside").getByRole("link", { name: "Guided match" }));
    await page.waitForURL((url) => url.pathname === "/patient/match");
    await expect(page.getByRole("heading", { name: "Guided match" })).toBeVisible();

    await typeInto(page, page.getByPlaceholder(/type in plain words/i), "tight chest and shortness of breath");
    await beat(page);
    await click(page, page.getByRole("button", { name: "Get suggestions" }));
    await expect(page.getByText(/Matched specialties:/).first()).toBeVisible();
    await expect(page.getByText(/Experience bonus:/).first()).toBeVisible();
  });

  // ── 8. Book & join a consultation ────────────────────────────────────────
  await test.step("Patient books and joins a consultation", async () => {
    await navigate(page, page.locator("aside").getByRole("link", { name: "Find a doctor" }));
    await page.waitForURL((url) => url.pathname === "/patient/doctors");
    await typeInto(page, page.getByPlaceholder("Name or specialty"), DOCTOR_FIRST);
    await navigate(page, page.getByRole("link", { name: new RegExp(DOCTOR_FIRST) }));
    await page.waitForURL(/\/patient\/doctors\/[0-9a-f-]{36}/);
    await expect(page.getByText("Available times")).toBeVisible();

    await pickFirstBookableSlot(page);
    await typeInto(page, page.getByRole("dialog").getByPlaceholder("Briefly describe your concern"), "Chest tightness follow-up");
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Confirm booking" }));

    await page.waitForURL(/\/patient\/appointments/);
    await expect(page.getByText("Chest tightness follow-up").first()).toBeVisible();

    // Open the consultation workspace and join — the session moves
    // SCHEDULED → JOINED.
    await navigate(page, page.getByRole("link", { name: "Join" }));
    await page.waitForURL(/\/consultation\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Consultation" })).toBeVisible();
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
    await click(page, page.getByRole("button", { name: "Join" }));
    await expect(page.getByText("Joined", { exact: true })).toBeVisible();

    // The "Appointment confirmed" notification is written asynchronously after
    // the booking response, and the dashboard's unread-notifications query is
    // cached (staleTime 30s), so do a full load to force a fresh fetch.
    await page.waitForTimeout(1500);
    await page.goto("/patient");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Notifications")).toBeVisible();
    // Live bookings notify the patient with "Appointment confirmed".
    await expect(page.getByText("Appointment confirmed").first()).toBeVisible();

    await signOut(page, PATIENT_DISPLAY);
  });

  // ── 9. Doctor runs the consultation & reviews their practice ────────────
  await test.step("Doctor runs the consultation and reviews their practice", async () => {
    await signInFromLanding(page, DOCTOR_EMAIL, "Password123", "/doctor");
    await page.goto("/doctor");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    // The doctor's own unread notifications include the patient's booking.
    await expect(page.getByText("New appointment booked").first()).toBeVisible();

    // Open the session and walk the state machine: JOINED → IN_PROGRESS → COMPLETED.
    await navigate(page, page.getByRole("link", { name: "Open session" }));
    await page.waitForURL(/\/consultation\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Consultation" })).toBeVisible();
    await expect(page.getByText("Joined", { exact: true })).toBeVisible();

    await click(page, page.getByRole("button", { name: "Join (re-open)" }));
    await click(page, page.getByRole("button", { name: "Start consultation" }));
    await expect(page.getByText("In progress", { exact: true })).toBeVisible();

    // Record the consultation note.
    await typeInto(page, page.getByPlaceholder("Assessment"), "Stable angina, suspected.");
    await typeInto(page, page.getByPlaceholder("Plan"), "ECG and low-dose aspirin; review in two weeks.");
    await typeInto(page, page.getByPlaceholder("Summary"), "Demo consultation summary: stable angina workup.");
    await click(page, page.getByRole("button", { name: "Save note" }));
    await expect(page.getByText("Note saved")).toBeVisible();

    // Issue a prescription.
    const prescriptionCard = page.locator("[data-slot='card']").filter({ hasText: "Issue prescription" });
    const rxInputs = prescriptionCard.locator("input");
    await typeInto(page, rxInputs.nth(0), "Nitroglycerin");
    await typeInto(page, rxInputs.nth(1), "0.4 mg");
    await typeInto(page, rxInputs.nth(2), "as needed");
    await click(page, prescriptionCard.getByRole("button", { name: "Issue prescription" }));
    await expect(page.getByText("Prescription issued")).toBeVisible();

    // Complete the session.
    await click(page, page.getByRole("button", { name: "Complete consultation" }));
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByText("Consultation note").first()).toBeVisible();
    await expect(page.getByText("Nitroglycerin").first()).toBeVisible();

    // The consultation workspace has no sidebar, so navigate back explicitly.
    await page.goto("/doctor/schedule");
    await expect(page.getByText("Weekly hours", { exact: true })).toBeVisible();
    await expect(page.getByText("Blocked times", { exact: true })).toBeVisible();
    await click(page, page.getByRole("button", { name: "Save schedule" }));
    await expect(page.getByText("Schedule saved")).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Profile" }));
    await page.waitForURL((url) => url.pathname === "/doctor/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByText("Specializations")).toBeVisible();
    await expect(page.getByText("Cardiology").first()).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Patients" }));
    await page.waitForURL((url) => url.pathname === "/doctor/patients");
    await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
    await expect(page.getByText(PATIENT_DISPLAY)).toBeVisible();

    await signOut(page, DOCTOR_DISPLAY);
  });

  // ── 10. Patient reviews the medical record ──────────────────────────────
  await test.step("Patient reviews the medical record", async () => {
    await signInFromLanding(page, PATIENT_EMAIL, "Password123", "/patient");
    await page.goto("/patient/records");
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await expect(page.getByText("Demo consultation summary: stable angina workup.").first()).toBeVisible();
    await expect(page.getByText("Nitroglycerin").first()).toBeVisible();

    await signOut(page, PATIENT_DISPLAY);
  });

  // ── 11. Patient books & cancels a follow-up ─────────────────────────────
  await test.step("Patient books and cancels a follow-up", async () => {
    await signInFromLanding(page, PATIENT_EMAIL, "Password123", "/patient");

    // Book a second consultation to demonstrate the cancel flow.
    await navigate(page, page.locator("aside").getByRole("link", { name: "Find a doctor" }));
    await page.waitForURL((url) => url.pathname === "/patient/doctors");
    await typeInto(page, page.getByPlaceholder("Name or specialty"), DOCTOR_FIRST);
    await navigate(page, page.getByRole("link", { name: new RegExp(DOCTOR_FIRST) }));
    await page.waitForURL(/\/patient\/doctors\/[0-9a-f-]{36}/);
    await expect(page.getByText("Available times")).toBeVisible();

    await pickFirstBookableSlot(page);
    await typeInto(page, page.getByRole("dialog").getByPlaceholder("Briefly describe your concern"), "Follow-up blood pressure check");
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Confirm booking" }));
    await page.waitForURL(/\/patient\/appointments/);
    await expect(page.getByText("Follow-up blood pressure check").first()).toBeVisible();

    // Cancel the follow-up.
    const followUp = page
      .locator("div")
      .filter({ has: page.getByText("Follow-up blood pressure check") })
      .filter({ has: page.getByRole("button", { name: "Cancel" }) })
      .last();
    await click(page, followUp.getByRole("button", { name: "Cancel" }));
    await expect(page.getByText("Cancel this appointment?")).toBeVisible();
    await click(page, page.getByRole("button", { name: "Cancel appointment" }));
    await expect(page.getByText("Appointment cancelled")).toBeVisible();
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();

    await signOut(page, PATIENT_DISPLAY);
  });

  // ── 12. Admin oversight ─────────────────────────────────────────────────
  await test.step("Admin oversees the operation", async () => {
    await signInFromLanding(page, ADMIN.email, ADMIN.password, ADMIN.home);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByText("Audit entries")).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Appointments" }));
    await page.waitForURL((url) => url.pathname === "/admin/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    await navigate(page, page.locator("aside").getByRole("link", { name: "Audit log" }));
    await page.waitForURL((url) => url.pathname === "/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("DOCTOR_APPROVED").first()).toBeVisible();

    // User management: find the demo patient, suspend, then reactivate.
    await navigate(page, page.locator("aside").getByRole("link", { name: "Users" }));
    await page.waitForURL((url) => url.pathname === "/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await typeInto(page, page.getByPlaceholder("Search name or email"), PATIENT_EMAIL);
    const userRow = page.getByRole("row", { name: PATIENT_EMAIL });
    await expect(userRow).toBeVisible();
    await click(page, userRow.getByRole("button", { name: "Suspend" }));
    const statusDialog = page.getByRole("dialog");
    await expect(statusDialog).toBeVisible();
    await typeInto(page, statusDialog.getByPlaceholder("Required for suspend / deactivate"), "Demo suspension");
    await click(page, statusDialog.getByRole("button", { name: "Apply" }));
    await expect(userRow.getByText("Suspended")).toBeVisible();
    await click(page, userRow.getByRole("button", { name: "Reactivate" }));
    await click(page, page.getByRole("dialog").getByRole("button", { name: "Apply" }));
    await expect(userRow.getByText("Active")).toBeVisible();

    await signOut(page, "Administrator");
  });
});
