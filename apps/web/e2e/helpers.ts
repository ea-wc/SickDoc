import { type Locator, type Page } from "@playwright/test";

/** True when running the slow UI demo (`pnpm test:e2e:demo`). */
export const DEMO_UI = process.env.DEMO_UI === "true";

export interface Credentials {
  email: string;
  password: string;
  home: string;
}

export const PATIENT: Credentials = { email: "ada@sickdoc.dev", password: "Password123", home: "/patient" };
export const DOCTOR: Credentials = { email: "dr.chen@sickdoc.dev", password: "Password123", home: "/doctor" };
export const ADMIN: Credentials = { email: "admin@sickdoc.dev", password: "Admin12345", home: "/admin" };

/** Signs in through the real login form and waits for the role home route. */
export async function signIn(page: Page, creds: Credentials): Promise<void> {
  await beat(page);
  await page.goto("/sign-in");
  await typeInto(page, page.getByLabel("Email"), creds.email);
  await typeInto(page, page.getByLabel("Password"), creds.password);
  await beat(page);
  await click(page, page.getByRole("button", { name: "Sign in" }));
  await page.waitForURL(`**${creds.home}`);
  await beat(page);
}

/** Pauses so a human can follow the UI demo; no-op unless DEMO_UI=true. */
export async function beat(page: Page, ms = 1600): Promise<void> {
  if (DEMO_UI) await page.waitForTimeout(ms);
}

/**
 * Scrolls the element into view. In demo mode it smooth-scrolls so the motion
 * is visible on screen; otherwise it jumps straight to the element (default).
 */
export async function visible(page: Page, locator: Locator): Promise<void> {
  if (!DEMO_UI) {
    await locator.scrollIntoViewIfNeeded();
    return;
  }
  await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(800);
}

/**
 * Types into an input. In demo mode it first moves the mouse indicator to the
 * field, then types one character at a time; otherwise it fills instantly
 * (default).
 */
export async function typeInto(page: Page, locator: Locator, text: string): Promise<void> {
  if (!DEMO_UI) {
    await locator.fill(text);
    return;
  }

  await locator.hover(); // move the mouse indicator to the input
  await page.waitForTimeout(200);
  await locator.click();
  await locator.fill(""); // clear any existing value first
  await locator.pressSequentially(text, { delay: 30 }); // type slowly
}

/**
 * Clicks an element. In demo mode it first moves the mouse indicator to the
 * element so the pointer motion is visible; otherwise it clicks directly
 * (default).
 */
export async function click(page: Page, locator: Locator): Promise<void> {
  if (!DEMO_UI) {
    await locator.click();
    return;
  }

  await locator.hover(); // move the mouse indicator to the element
  await page.waitForTimeout(200);
  await locator.click();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** English ordinal suffix, e.g. 1 → "1st", 22 → "22nd". */
export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
