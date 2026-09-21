import { type Page } from "@playwright/test";

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
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${creds.home}`);
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
