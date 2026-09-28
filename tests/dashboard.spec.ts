import { expect, type Page, test } from "@playwright/test";
import { resolve } from "node:path";

const codexFixture = {
  source: "codex",
  fetchedAt: "2026-09-28T04:00:00.000Z",
  account: {
    planType: "plus",
  },
  summary: {
    lifetimeTokens: 1_440_000_000,
    peakDailyTokens: 100_000_000,
    longestRunningTurnSec: 41_640,
    currentStreakDays: 4,
    longestStreakDays: 10,
  },
  daily: [
    { date: "2026-09-24", tokens: 12_000_000 },
    { date: "2026-09-25", tokens: 24_000_000 },
    { date: "2026-09-26", tokens: 8_000_000 },
    { date: "2026-09-27", tokens: 31_000_000 },
  ],
  quota: {
    ordinaryUsageAllowed: true,
    primary: {
      usedPercent: 18,
      windowDurationMins: 300,
      resetsAt: 1_790_582_400,
    },
    secondary: {
      usedPercent: 42,
      windowDurationMins: 10_080,
      resetsAt: 1_791_100_800,
    },
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/codex/usage", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(codexFixture),
    }),
  );
});

async function waitForAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState === "finished"),
  );
}

test("switches chart modes and imports a workspace CSV", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  await expect(page.getByText("14.4亿", { exact: true })).toBeVisible();
  await waitForAnimations(page);

  for (const label of ["每周", "累计", "每日"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  await page.getByRole("button", { name: "字节导入" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(resolve("public/examples/bytedance-token-sample.csv"));

  await expect(page.getByText("已导入", { exact: true })).toBeVisible();
  await expect(page.getByText("45.1万", { exact: true })).toBeVisible();
  await expect(page.getByText("¥11.85", { exact: true })).toBeVisible();
  await expect(page.getByText("4 条记录", { exact: true })).toBeVisible();
  await waitForAnimations(page);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({
    path: testInfo.outputPath("agent-meter-desktop.png"),
    fullPage: true,
  });

  for (const viewport of [
    { width: 390, height: 844, name: "mobile" },
    { width: 320, height: 800, name: "narrow" },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByText("已同步", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "字节导入" }).click();
    await expect(page.getByText("4 条记录", { exact: true })).toBeVisible();
    await waitForAnimations(page);
    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(mobileOverflow).toBe(0);
    await expect(page.getByText("45.1万", { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`agent-meter-${viewport.name}.png`),
      fullPage: true,
    });
  }
});
