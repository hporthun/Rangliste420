import { test, expect } from "@playwright/test";

// JWM/JEM-Quali compute + save (uses seeded Max Mustermann in 3 Testregatten).
// Max hat keinen birthYear, daher age=OPEN per URL-Param erzwingen, sonst
// faellt die Default-Altersklasse U19 ihn heraus.
//
// Hinweis Datei-Praefix: ranking.spec.ts test 3 sucht den Entwurf-Toggle
// strict via getByRole — eine zweite Draft-Rangliste in der Liste wuerde
// das brechen. Daher laeuft dieser Spec mit zz-Praefix nach ranking.spec.

const RANKING_NAME = "E2E-Quali Open 2025";

test("jwm-jem-quali berechnet und zeigt Mustermann mit qualiscore", async ({ page }) => {
  await page.goto("/admin/ranglisten/jwm-jem?age=OPEN&gender=OPEN&ref=2025-12-31");
  await expect(
    page.getByRole("heading", { name: /JWM\/JEM-Qualifikationsrangliste/ }),
  ).toBeVisible();

  // Genau 2 Testregatten auswaehlen, in denen Max Mustermann gemeldet ist
  // (Seed: 3 Testregatten, je 1 Starter, Max auf Platz 1).
  // Liste sortiert nach startDate desc: 0=Wannseepokal (kein Max), 1=Testregatta 3,
  // 2=Testregatta 2, 3=Testregatta 1. Index 1+2 trifft genau zwei Regatten mit Max.
  // Label-basiert geht nicht: `\b` greift zwischen "Testregatta 1" und "15.1.2025"
  // nicht (beides Ziffern, im AccText ohne Leerzeichen verkettet).
  const checkboxes = page.locator('input[type="checkbox"][name="regattas"]');
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();

  await page.getByRole("button", { name: /Rangliste berechnen/ }).click();

  // Nach GET-Submit ist der computeJwmJemAction-Block sichtbar
  // exact:true grenzt gegen den Seiten-h1 "JWM/JEM-Qualifikationsrangliste
  // berechnen" ab, der die Substring "Qualifikationsrangliste" enthaelt.
  await expect(
    page.getByRole("heading", { name: "Qualifikationsrangliste", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Max Mustermann" })).toBeVisible();

  // Beide Testregatten haben Max auf Platz 1, je 1 Starter
  // → weightedScore = 1 * (1/1) = 1.00 pro Slot, qualiScore = 2.00
  const row = page.getByRole("row", { name: /Max Mustermann/ });
  await expect(row).toContainText("2.00");
});

test("jwm-jem-quali kann gespeichert werden und erscheint in ranglisten-uebersicht", async ({ page }) => {
  await page.goto("/admin/ranglisten/jwm-jem?age=OPEN&gender=OPEN&ref=2025-12-31");

  // Gleiche Auswahl wie oben — Testregatta 3 und 2 (jeweils Max auf Platz 1).
  const checkboxes = page.locator('input[type="checkbox"][name="regattas"]');
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  await page.getByRole("button", { name: /Rangliste berechnen/ }).click();

  // exact:true grenzt gegen den Seiten-h1 "JWM/JEM-Qualifikationsrangliste
  // berechnen" ab, der die Substring "Qualifikationsrangliste" enthaelt.
  await expect(
    page.getByRole("heading", { name: "Qualifikationsrangliste", exact: true }),
  ).toBeVisible();
  // Sicherstellen, dass die Save-Section fertig hydriert ist, bevor wir
  // den Save-Button klicken (dev-mode kompiliert lazy, Race-Risiko).
  await expect(page.getByPlaceholder(/JWM\/JEM-Quali/)).toBeVisible();

  // Save — pressSequentially statt fill(), damit React-19 + Next-Dev-Mode
  // den useState-Update zuverlaessig commiten (Playwrights fill() ist
  // hier flake-anfaellig und schreibt den DOM-Wert ohne State-Sync).
  const nameInput = page.getByPlaceholder(/JWM\/JEM-Quali/);
  await nameInput.click({ clickCount: 3 }); // select all
  await nameInput.press("Backspace");
  await nameInput.pressSequentially(RANKING_NAME, { delay: 10 });
  await expect(nameInput).toHaveValue(RANKING_NAME);

  await page.getByRole("button", { name: /Rangliste speichern/ }).click();
  await page.waitForURL(/\/admin\/ranglisten(\?.*)?$/, { timeout: 30_000 });
  await expect(page.getByText(RANKING_NAME)).toBeVisible({ timeout: 15_000 });
});
