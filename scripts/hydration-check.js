/* Hydration check in Asia/Karachi TZ across all views + dialogs */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: "Asia/Karachi" });
  const page = await ctx.newPage();

  const issues = [];
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /hydrat|mismatch|did not match/i.test(t)) {
      issues.push(`[console.${m.type()}] ${t.slice(0, 400)}`);
    }
  });
  page.on("pageerror", (e) => issues.push(`[pageerror] ${String(e).slice(0, 400)}`));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const views = ["Trip Logs", "Profit Calculator", "Manager Ledger", "Dashboard"];
  for (const v of views) {
    await page.getByText(v, { exact: true }).first().click();
    await page.waitForTimeout(1200);
    console.log(`view: ${v} — issues so far: ${issues.length}`);
  }

  // Open/close the Reset AlertDialog (Radix trigger from header)
  await page.getByRole("button", { name: /reset/i }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /cancel/i }).first().click();
  await page.waitForTimeout(600);

  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log("timezone:", tz);
  console.log(issues.length ? "ISSUES FOUND:\n" + issues.join("\n---\n") : "CLEAN — no hydration errors");
  await browser.close();
})();
