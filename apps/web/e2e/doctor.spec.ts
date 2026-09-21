import { test, expect } from "@playwright/test";
import { DOCTOR, signIn } from "./helpers";

// Doctor module — INITIAL_DOC.md §5 "Doctor module".

test.describe("Account and profile", () => {
  test("signs in and views the professional profile and specializations", async ({ page }) => {
    await signIn(page, DOCTOR);
    await page.goto("/doctor/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByText("Specializations")).toBeVisible();
    await expect(page.getByText("Cardiology").first()).toBeVisible();
  });
});

test.describe("Schedule management", () => {
  test("manages weekly availability rules and blocked times", async ({ page }) => {
    await signIn(page, DOCTOR);
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByText("Weekly hours")).toBeVisible();
    await expect(page.getByText("Blocked times")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save schedule" })).toBeVisible();
  });
});

test.describe("Patient records (role-scoped)", () => {
  test("views records for patients with their own appointments", async ({ page }) => {
    await signIn(page, DOCTOR);
    await page.goto("/doctor/patients");
    await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
    await expect(page.getByText("Ada Lovelace")).toBeVisible();
  });
});
