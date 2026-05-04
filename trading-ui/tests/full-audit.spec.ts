import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/aetherdesk/audit',
  '/intelligence/gex',
  '/risk',
  '/strategy-lab'
];

test('Full System Audit', async ({ page }) => {
  test.setTimeout(120000);
  const targetUrl = process.env.TARGET_URL || 'http://trading-ui:80';
  const email = 'audit@aetherdesk.prime';
  const password = 'AuditPassword123!';

  console.log(`Using targetUrl: ${targetUrl}`);

  // Intercept all requests to the Tailscale IP and redirect to trading-ui (internal docker name)
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('100.66.171.30')) {
        const newUrl = url.replace(/100\.66\.171\.30(:8000)?\/supabase/, 'trading-ui/supabase')
                          .replace('100.66.171.30', 'trading-ui');
        console.log(`INTERCEPTED: ${url} -> ${newUrl}`);
        route.continue({ url: newUrl });
    } else {
        route.continue();
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning' || msg.type() === 'log') {
        console.log(`BROWSER_LOG [${msg.type()}]: ${msg.text()}`);
    }
  });

  console.log(`Navigating to ${targetUrl}/auth...`);
  await page.goto(`${targetUrl}/auth`, { waitUntil: 'load' });

  // Login
  console.log('Attempting login...');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button#auth-submit');

  // Wait for navigation to dashboard
  try {
    await page.waitForURL(url => url.pathname === '/', { timeout: 30000 });
    console.log('Login successful.');
  } catch (e) {
    console.log(`Login navigation failed: ${e.message}`);
    console.log(`Current URL: ${page.url()}`);
    await page.screenshot({ path: 'screenshots/login-failure.png' });
  }

  const results = [];

  for (const route of ROUTES) {
    console.log(`Auditing ${route}...`);
    try {
      await page.goto(`${targetUrl}${route}`, { waitUntil: 'load', timeout: 30000 });

      const title = await page.title();
      const url = page.url();
      const status = url.includes(route) ? 'SUCCESS' : (url.includes('/auth') ? 'AUTH_REQUIRED' : 'REDIRECTED');

      const screenshotPath = `audit-${route.replace(/\//g, '_') || 'root'}.png`;
      await page.screenshot({ path: `screenshots/${screenshotPath}` });

      results.push({ route, title, status, url });
      console.log(`  [${status}] ${title}`);
    } catch (e) {
      console.error(`  [FAILED] ${route}: ${e.message}`);
    }
  }

  console.log('\n--- AUDIT SUMMARY ---');
  console.table(results);
});
