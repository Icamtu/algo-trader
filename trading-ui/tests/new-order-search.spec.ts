import { test, expect } from '@playwright/test';

// Institutional Trading Platform - E2E Search Test
// GAP-29: Symbol Search Autocomplete

test('symbol search autocomplete shows master contract results', async ({ page }) => {
  // 1. Navigate to the platform (using Tailscale IP as per rules)
  const targetUrl = process.env.TARGET_URL || 'http://100.66.171.30/';
  await page.goto(targetUrl);

  // 2. Bypass or Handle Auth if present
  // (Assuming session is persisted or dev bypass is active)

  // 3. Open Transaction Gate (New Order Modal)
  // We can trigger it via the 'B' key (Buy) which is a shortcut in the dashboard
  await page.keyboard.press('b');

  // 4. Verify Modal is Open
  const modalHeader = page.locator('h2:has-text("Transaction_Gate")');
  await expect(modalHeader).toBeVisible();

  // 5. Interact with Symbol Input
  const symbolInput = page.locator('input[placeholder="TICKER_KEY"]');
  await symbolInput.fill('NIFTY');

  // 6. Wait for Neural suggestions to appear
  const suggestionsBox = page.locator('text=Master_Contract_Results');
  await expect(suggestionsBox).toBeVisible({ timeout: 5000 });

  // 7. Verify specific institutional results exist
  const niftyResult = page.locator('button:has-text("NIFTY")').first();
  await expect(niftyResult).toBeVisible();

  // 8. Select the result and verify input update
  await niftyResult.click();
  await expect(symbolInput).toHaveValue('NIFTY');

  // 9. Close Modal
  await page.keyboard.press('Escape');
  await expect(modalHeader).not.toBeVisible();
});
