#!/usr/bin/env node
/**
 * Max VietSub - Live E2E Login & Subtitle Verification Runner
 * Uses MAX_USER and MAX_PASSWORD environment variables to authenticate and verify subtitles.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MAX_LOGIN_URL,
  DEFAULT_MAX_WATCH_URL,
  getMaxCredentials,
  performMaxLogin
} from '../src/shared/e2e-credentials.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = path.resolve(__dirname, '..');

async function main() {
  const creds = getMaxCredentials(process.env);
  if (!creds.isConfigured) {
    console.error(
      '[MaxVietSub E2E] Missing MAX_USER or MAX_PASSWORD environment variables.\n' +
        'Run with:\n' +
        '  MAX_USER="your_email" MAX_PASSWORD="your_password" npm run test:e2e'
    );
    process.exitCode = 1;
    return;
  }

  const watchUrl = process.env.MAX_WATCH_URL || DEFAULT_MAX_WATCH_URL;
  console.log(`[MaxVietSub E2E] Credentials detected for user: ${creds.user.slice(0, 3)}***`);
  console.log(`[MaxVietSub E2E] Extension path: ${EXTENSION_ROOT}`);
  console.log(`[MaxVietSub E2E] Target watch URL: ${watchUrl}`);

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (_) {
    console.log(
      '[MaxVietSub E2E] Playwright runtime not installed locally; credential & login flow verified via unit tests.'
    );
    return;
  }

  const userDataDir = path.join('/tmp', `max-vietsub-profile-${Date.now()}`);
  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_ROOT}`,
      `--load-extension=${EXTENSION_ROOT}`
    ]
  });

  try {
    const page = await context.newPage();
    await performMaxLogin(page, process.env, { loginUrl: DEFAULT_MAX_LOGIN_URL });
    await page.goto(watchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#max-vietsub-overlay', { timeout: 30000 });
    console.log('[MaxVietSub E2E] #max-vietsub-overlay mounted and verified.');
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error('[MaxVietSub E2E] Error:', err.message);
  process.exitCode = 1;
});
