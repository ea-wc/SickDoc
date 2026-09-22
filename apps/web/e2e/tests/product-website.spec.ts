import { test, expect } from "@playwright/test";

// Product Website module — INITIAL_DOC.md §5 "Product Website module".

test.describe("Landing page", () => {
  test("communicates the value proposition, capabilities, and how it works", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SickDoc/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("See the right doctor");
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(page.getByText("For patients").first()).toBeVisible();
    await expect(page.getByText("For doctors").first()).toBeVisible();
    await expect(page.getByText("For administrators").first()).toBeVisible();
  });

  test("routes visitors to patient/doctor registration and sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register/patient");
    await expect(page.getByRole("link", { name: "I'm a doctor" })).toHaveAttribute("href", "/register/doctor");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", "/sign-in");
  });

  test("shows the fictional-prototype disclaimer and trust messaging", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Fictional prototype").first()).toBeVisible();
    await expect(page.getByText(/fictional prototype for demonstration/i).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByText(/does not provide medical advice/i)).toBeVisible();
  });

  test("serves application-managed terms and privacy pages", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  });

  test("loads every asset from the application — no third-party requests", async ({ page }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => hosts.add(new URL(request.url()).host));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const unexpected = [...hosts].filter((host) => host !== "localhost:3000" && host !== "localhost:3001");
    expect(unexpected).toEqual([]);
  });
});
