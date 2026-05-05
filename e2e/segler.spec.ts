import { test, expect } from "@playwright/test";

// Authenticated tests (chromium project loads storageState)

// Achtung: createSailor laesst die Eingaben durch toTitleCase laufen
// (lib/import/normalize.ts) — Namen mit Großbuchstaben mitten im Wort
// (z.B. "Lisa-E2E") werden zu "Lisa-E2e". Wir benutzen daher reine
// Title-Case-Namen, damit der Round-Trip im Edit-Test stabil ist.
const TEST_FIRST_NAME = "Lisa";
const TEST_LAST_NAME = "Testfrau";
const TEST_CLUB = "TestSV E2E";
const TEST_CLUB_UPDATED = "TestSV Aktualisiert";

test("neuer segler kann ueber das formular angelegt werden", async ({ page }) => {
  await page.goto("/admin/segler");
  await expect(page.getByRole("heading", { name: /^Segler/ })).toBeVisible();

  await page.getByRole("link", { name: /Neuer Segler/ }).click();
  await page.waitForURL(/\/admin\/segler\/neu/);

  await page.locator('input[name="firstName"]').fill(TEST_FIRST_NAME);
  await page.locator('input[name="lastName"]').fill(TEST_LAST_NAME);
  await page.locator('input[name="birthYear"]').fill("2008");
  await page.locator('select[name="gender"]').selectOption("F");
  await page.locator('input[name="club"]').fill(TEST_CLUB);

  await page.getByRole("button", { name: /^Speichern$/ }).click();

  await page.waitForURL(/\/admin\/segler(\?.*)?$/);
  await expect(
    page.getByRole("link", { name: `${TEST_LAST_NAME}, ${TEST_FIRST_NAME}` }),
  ).toBeVisible();
});

test("segler kann bearbeitet werden und aenderungen werden gespeichert", async ({ page }) => {
  await page.goto("/admin/segler");

  await page.getByRole("link", { name: `${TEST_LAST_NAME}, ${TEST_FIRST_NAME}` }).click();
  await page.waitForURL(/\/admin\/segler\/[^/]+$/);

  // Verify form is pre-filled
  await expect(page.locator('input[name="firstName"]')).toHaveValue(TEST_FIRST_NAME);
  await expect(page.locator('input[name="club"]')).toHaveValue(TEST_CLUB);

  // Update club
  await page.locator('input[name="club"]').fill(TEST_CLUB_UPDATED);
  await page.getByRole("button", { name: /^Speichern$/ }).click();

  await page.waitForURL(/\/admin\/segler(\?.*)?$/);

  // Re-open to verify
  await page.getByRole("link", { name: `${TEST_LAST_NAME}, ${TEST_FIRST_NAME}` }).click();
  await expect(page.locator('input[name="club"]')).toHaveValue(TEST_CLUB_UPDATED);
});

test("suchfeld filtert die seglerliste", async ({ page }) => {
  await page.goto("/admin/segler");

  const searchInput = page.getByPlaceholder(/Name suchen/);
  await searchInput.fill(TEST_LAST_NAME);

  // The search submits via URL param; wait for URL to reflect the filter
  await page.waitForURL(new RegExp(`q=${encodeURIComponent(TEST_LAST_NAME)}`));

  await expect(
    page.getByRole("link", { name: `${TEST_LAST_NAME}, ${TEST_FIRST_NAME}` }),
  ).toBeVisible();
  // Max Mustermann (seeded) should be filtered out
  await expect(page.getByRole("link", { name: /Mustermann, Max/ })).toHaveCount(0);
});
