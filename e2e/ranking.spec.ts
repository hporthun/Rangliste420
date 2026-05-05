import { test, expect } from "@playwright/test";

const PREVIEW_URL =
  "/admin/ranglisten/vorschau?type=JAHRESRANGLISTE&year=2025&age=OPEN&gender=OPEN&ref=2025-11-30";

test("ranking preview zeigt Max Mustermann mit R=100.00", async ({ page }) => {
  await page.goto(PREVIEW_URL);

  // Row for Max Mustermann should appear
  await expect(page.getByRole("cell", { name: "Max Mustermann" })).toBeVisible();

  // R value should be 100.00
  const row = page.getByRole("row", { name: /Max Mustermann/ });
  await expect(row.getByText("100.00")).toBeVisible();
});

test("steuermann-detail zeigt genau 9 einfließende Wertungen", async ({ page }) => {
  await page.goto(PREVIEW_URL);

  // Click detail link for Max Mustermann
  const row = page.getByRole("row", { name: /Max Mustermann/ });
  await row.getByRole("link", { name: /Detail/ }).click();

  // Should be on steuermann detail page
  await expect(page.getByRole("heading", { name: /Max Mustermann/ })).toBeVisible();
  await expect(page.getByText("Einfließende 9 Wertungen")).toBeVisible();

  // Table should have exactly 9 data rows (not counting header + footer)
  const tbody = page.locator("table").first().locator("tbody tr");
  await expect(tbody).toHaveCount(9);

  // All R_A values are 100.00
  const raCells = tbody.locator("td:nth-child(6)");
  for (let i = 0; i < 9; i++) {
    await expect(raCells.nth(i)).toHaveText("100.00");
  }

  // R = average in tfoot
  await expect(page.locator("tfoot")).toContainText("100.00");
});

test("jahresrangliste speichern und veröffentlichen", async ({ page }) => {
  // Go to save page
  await page.goto(
    "/admin/ranglisten/neu?type=JAHRESRANGLISTE&year=2025&age=OPEN&gender=OPEN&ref=2025-11-30"
  );

  await expect(page.getByRole("heading", { name: "Jahresrangliste speichern" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Max Mustermann" })).toBeVisible();

  // Save
  const nameInput = page.getByPlaceholder(/z\.B\. Jahresrangliste/);
  await nameInput.fill("E2E-Testrangliste 2025");
  await page.getByRole("button", { name: "Jahresrangliste speichern" }).click();

  // Redirect to admin/ranglisten
  await page.waitForURL("/admin/ranglisten");
  await expect(page.getByText("E2E-Testrangliste 2025")).toBeVisible();

  // Publish via toggle button. exact:true grenzt gegen den
  // "Duplizieren — als neuer Entwurf"-Button ab, dessen accessible
  // name ebenfalls "Entwurf" enthaelt (seit feat: Duplizieren-Button).
  const toggle = page.getByRole("button", { name: "Entwurf", exact: true });
  await toggle.click();
  await expect(page.getByRole("button", { name: "Veröffentlicht", exact: true })).toBeVisible();
});

test("öffentliche rangliste zeigt steuermann-detail mit R_A-Werten", async ({ page }) => {
  // Find the published ranking link on the public page
  await page.goto("/rangliste");
  await expect(page.getByText("E2E-Testrangliste 2025")).toBeVisible();
  await page.getByText("E2E-Testrangliste 2025").click();

  // Ranking overview table
  await expect(page.getByRole("cell", { name: "Max Mustermann", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Detail/ }).first().click();

  // Public steuermann detail
  await expect(page.getByText("Einfließende 9 Wertungen")).toBeVisible();
  const tbody = page.locator("table").first().locator("tbody tr");
  await expect(tbody).toHaveCount(9);
  await expect(page.locator("tfoot")).toContainText("100.00");
});
