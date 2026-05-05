import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill("#identifier", "hajo@porthun.de");
  await page.fill("#password", "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/admin");

  // Nach Login zeigt das Admin-Layout ggf. das ChangelogPopup mit den seit
  // letztem Besuch erschienenen Eintraegen. Es haengt mit role="dialog"
  // aria-modal="true" ueber dem Viewport und schluckt jeden Klick auf
  // /admin/* — fuer Folge-Tests muss es weg. "Als gelesen markieren"
  // persistiert das in der DB (markChangelogReadAction), sodass es auch
  // nach Re-Use des storageState nicht wieder auftaucht.
  const dismissBtn = page.getByRole("button", { name: /Als gelesen markieren/ });
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click();
    await dismissBtn.waitFor({ state: "hidden" });
  }

  // Tour-Overlay (TourProvider in components/tour/tour-context.tsx)
  // oeffnet sich beim ersten Admin-Besuch nach 800ms — blockiert wie
  // das Changelog-Popup alle Klicks. Wir markieren es per localStorage-
  // Key vorab als gesehen, sodass es in keiner Test-Session auftaucht.
  await page.evaluate(() => localStorage.setItem("420-tour-seen", "1"));

  await page.context().storageState({ path: authFile });
});
