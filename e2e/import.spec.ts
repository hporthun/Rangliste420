import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const FIXTURE = path.join(
  __dirname,
  "../lib/import/__fixtures__/wapo2026-paste.txt"
);

test("paste-import durch den wizard bis commit", async ({ page }) => {
  const pasteText = fs.readFileSync(FIXTURE, "utf-8");

  // ── Schritt 1: Quelle ────────────────────────────────────────────────────
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Ergebnisse importieren", level: 1 })).toBeVisible();

  // Paste mode is default — textarea is immediately visible
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  await textarea.fill(pasteText);

  // Submit source step ("Weiter →")
  await page.getByRole("button", { name: /Weiter/i }).click();

  // ── Schritt 2: Metadaten ─────────────────────────────────────────────────
  const regattaSelect = page.getByRole("combobox");
  await expect(regattaSelect).toBeVisible({ timeout: 15_000 });
  // Pick the Wannseepokal option by its value attribute (label includes locale date)
  const wapoOption = page.locator("select option", { hasText: "Wannseepokal 2026" });
  const wapoValue = await wapoOption.getAttribute("value");
  await regattaSelect.selectOption(wapoValue!);
  await page.getByRole("button", { name: /Weiter/i }).click();

  // ── Schritt 3: Startgebiet ───────────────────────────────────────────────
  await expect(page.getByText("Startgebiet-Review")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Weiter/i }).click();

  // ── Schritt 4: Matching ──────────────────────────────────────────────────
  // Loading indicator first, then matching table
  await expect(page.getByRole("button", { name: /Weiter → Vorschau/i })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: /Weiter → Vorschau/i }).click();

  // ── Schritt 5: Vorschau ──────────────────────────────────────────────────
  await expect(page.getByText("Vorschau & Import bestätigen")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Wannseepokal 2026/)).toBeVisible();

  // Commit
  await page.getByRole("button", { name: /Import bestätigen/i }).click();

  // ── Abschluss ────────────────────────────────────────────────────────────
  await expect(page.getByText("Import erfolgreich!")).toBeVisible({ timeout: 15_000 });
});

test("nach import: regatta erscheint in öffentlicher regatten-liste", async ({ page }) => {
  await page.goto("/regatten");
  await expect(page.getByText("Wannseepokal 2026")).toBeVisible();
});
