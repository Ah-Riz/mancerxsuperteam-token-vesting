import { expect, type Page } from "@playwright/test";

export const creatorWallet = "28FQ5wVeihjGnZw93RctyAtUdtBdd6vGXWUkke49mEAw";
export const recipientWallet = "3coyVxLQYHdQ6MNQRRdm2KuCABJopxPfo9XuQeosUmf3";
export const secondWallet = "11111111111111111111111111111111";
export const nativeSolMint = "11111111111111111111111111111111";

export async function enableE2eWallet(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("velthoryn:e2e-wallet", "1");
  });
}

export async function selectSolToken(page: Page) {
  await page.getByRole("button", { name: /select token/i }).click();
  await page.getByRole("button", { name: /SOL.*Native/i }).first().click();
  await expect(page.getByRole("button", { name: /SOL.*Native/i })).toBeVisible();
}

export async function openCsvMode(page: Page, label = /use csv|csv campaign/i) {
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByRole("button", { name: /parse & validate/i })).toBeVisible();
}

export async function parseCsv(page: Page, csv: string) {
  await page.locator("textarea").fill(csv);
  await page.getByRole("button", { name: /parse & validate/i }).click();
}

export function csv(rows: string[]) {
  return [
    "beneficiary,amount,releaseType,startTime,cliffTime,endTime,milestoneIdx",
    ...rows,
  ].join("\n");
}
