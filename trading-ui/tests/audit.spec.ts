import { test, expect } from '@playwright/test';

test('audit landing page', async ({ page }) => {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:8080';

  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl);

  console.log(`Current URL: ${page.url()}`);
  await page.screenshot({ path: 'audit-landing.png' });

  console.log(`Page title: ${await page.title()}`);

  // Find all links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText,
      href: a.href
    }));
  });
  console.log(`Found ${links.length} links.`);
  console.log(JSON.stringify(links, null, 2));
});
