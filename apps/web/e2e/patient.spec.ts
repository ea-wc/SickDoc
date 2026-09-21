import { test, expect, type Page } from "@playwright/test";
import { MONTHS, PATIENT, WEEKDAYS, ordinal, signIn } from "./helpers";

// Patient module — INITIAL_DOC.md §5 "Patient module".

/** Dr. Chen works weekdays; iterate future weekdays until a bookable slot appears. */
async function pickFirstBookableSlot(page: Page): Promise<void> {
  const today = new Date();
  for (let offset = 1; offset <= 21; offset++) {
    const candidate = new Date(today);
    candidate.setDate(candidate.getDate() + offset);
    const weekday = candidate.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const shownMonth = await page.locator('[role="grid"]').getAttribute("aria-label");
    if (shownMonth && !shownMonth.startsWith(MONTHS[candidate.getMonth()])) {
      await page.getByRole("button", { name: "Go to the Next Month" }).click();
      await page.waitForTimeout(300);
    }

    const label = `${WEEKDAYS[weekday]}, ${MONTHS[candidate.getMonth()]} ${ordinal(candidate.getDate())}, ${candidate.getFullYear()}`;
    const day = page.getByRole("button", { name: new RegExp(label) });
    if ((await day.count()) === 0) continue;
    await day.click();
    await page.waitForTimeout(1000);

    const slots = page.locator("main button:not([disabled])").filter({ hasText: /AM|PM/ });
    if ((await slots.count()) > 0) {
      await slots.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      return;
    }
  }
  throw new Error("Could not find a bookable slot within three weeks");
}

test.describe("Account and profile", () => {
  test("registers with email and password and completes a basic profile", async ({ page }) => {
    const email = `e2e.patient.${Date.now()}@sickdoc.dev`;
    await page.goto("/register/patient");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Password123");
    await page.getByLabel("Date of birth").fill("1995-06-15");
    await page.getByLabel("Phone").fill("+63 900 111 2222");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/patient/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // weight, height, and medical history are captured on the profile screen
    await page.goto("/patient/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByText("Weight (kg)")).toBeVisible();
    await expect(page.getByText("Height (cm)")).toBeVisible();
    await expect(page.getByText("Medical history")).toBeVisible();
  });

  test("unauthenticated visit is redirected to sign-in", async ({ page }) => {
    await page.goto("/patient");
    await page.waitForURL(/\/sign-in/);
    await expect(page).toHaveURL(/next=%2Fpatient/);
  });
});

test.describe("Doctor discovery", () => {
  test("browses and searches the approved doctor directory", async ({ page }) => {
    await signIn(page, PATIENT);
    await page.goto("/patient/doctors");
    await expect(page.getByRole("heading", { name: "Find a doctor" })).toBeVisible();
    await page.getByPlaceholder("Name or specialty").fill("chen");
    await expect(page.getByRole("link", { name: /Mei Chen/ })).toBeVisible();
  });
});

test.describe("Guided doctor matching", () => {
  test("maps free-text symptoms to ranked suggestions with a rationale", async ({ page }) => {
    await signIn(page, PATIENT);
    await page.goto("/patient/match");
    await expect(page.getByRole("heading", { name: "Guided match" })).toBeVisible();
    await page.getByPlaceholder(/type in plain words/i).fill("tight chest and shortness of breath");
    await page.getByRole("button", { name: "Get suggestions" }).click();
    await expect(page.getByText(/Matched specialties:/).first()).toBeVisible();
    await expect(page.getByText(/Experience bonus:/).first()).toBeVisible();
  });
});

test.describe("Appointment booking and notifications", () => {
  test("books a consultation and sees the appointment plus a notification", async ({ page }) => {
    await signIn(page, PATIENT);

    await page.goto("/patient/doctors");
    await page.getByPlaceholder("Name or specialty").fill("chen");
    await page.getByRole("link", { name: /Mei Chen/ }).click();
    await page.waitForURL(/\/patient\/doctors\/[0-9a-f-]{36}/);
    await expect(page.getByText("Available times")).toBeVisible();

    await pickFirstBookableSlot(page);
    await page.getByRole("dialog").getByPlaceholder("Briefly describe your concern").fill("E2E booking");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm booking" }).click();

    await page.waitForURL(/\/patient\/appointments/);
    await expect(page.getByText("E2E booking").first()).toBeVisible();

    // in-app notification for the booking appears on the dashboard
    await page.goto("/patient");
    await expect(page.getByText("Notifications")).toBeVisible();
    await expect(page.getByText("Appointment booked").first()).toBeVisible();
  });
});

test.describe("Medical records", () => {
  test("views consultation history, notes, and prescriptions", async ({ page }) => {
    await signIn(page, PATIENT);
    await page.goto("/patient/records");
    await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
    await expect(page.getByText("Consultation note").first()).toBeVisible();
    await expect(page.getByText("Aspirin").first()).toBeVisible();
  });
});
