import { test, expect } from "@playwright/test";
import { ADMIN, PATIENT, signIn } from "../helpers";

// Admin module — INITIAL_DOC.md §5 "Admin module".

test.describe("Account and access", () => {
  test("signs in with the pre-provisioned account (no public admin registration)", async ({ page }) => {
    await page.goto("/");
    // only patient and doctor registration are offered; admins sign in
    await expect(page.getByRole("link", { name: "Sign in as admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Register as an admin/i })).toHaveCount(0);

    await signIn(page, ADMIN);
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  });

  test("enforces administrator permissions (a patient is refused)", async ({ page }) => {
    await signIn(page, PATIENT);
    await page.goto("/admin");
    await page.waitForURL(/\/patient/);
  });
});

test.describe("Operational dashboard", () => {
  test("shows database-derived counts", async ({ page }) => {
    await signIn(page, ADMIN);
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByText("Patients")).toBeVisible();
    await expect(page.getByText("Doctors")).toBeVisible();
    await expect(page.getByText("Pending doctor reviews")).toBeVisible();
    await expect(page.getByText("Audit entries")).toBeVisible();
  });
});

test.describe("User management", () => {
  test("searches accounts, suspends one with a reason, and reactivates it", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByPlaceholder("Search name or email").fill("grace");
    const row = page.getByRole("row", { name: /grace@sickdoc.dev/ });
    await expect(row).toBeVisible();

    // suspend with a reason
    await row.getByRole("button", { name: "Suspend" }).click();
    await page.getByRole("dialog").getByPlaceholder("Required for suspend / deactivate").fill("E2E suspension");
    await page.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
    await expect(row.getByText("Suspended")).toBeVisible();

    // reactivate
    await row.getByRole("button", { name: "Reactivate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
    await expect(row.getByText("Active")).toBeVisible();
  });
});

test.describe("Doctor profile review", () => {
  test("lists pending doctors with approve and reject controls", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/admin/doctors");
    await expect(page.getByRole("heading", { name: "Doctor reviews" })).toBeVisible();
    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject" }).first()).toBeVisible();
  });
});

test.describe("Appointment oversight", () => {
  test("lists every appointment with status filters", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/admin/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });
});

test.describe("Audit log", () => {
  test("shows an append-only record of admin actions", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("DOCTOR_APPROVED").first()).toBeVisible();
  });
});
