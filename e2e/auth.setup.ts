import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "user.json");

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill("#identifier", "hajo@porthun.de");
  await page.fill("#password", "testpassword123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/admin");
  await page.context().storageState({ path: authFile });
});
