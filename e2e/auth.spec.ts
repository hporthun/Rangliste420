import { test, expect } from "@playwright/test";

// Runs in chromium-noauth project (no storageState) — tests unauthenticated behavior
test("login with wrong password shows error", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill("#identifier", "hajo@porthun.de");
  await page.fill("#password", "wrongpassword");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Ungültiger Benutzername oder Passwort")).toBeVisible();
});

// The authenticated admin check lives in ranking.spec.ts which uses storageState
