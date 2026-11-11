/**
 * Max VietSub - E2E Authentication & Login Helper
 * Reads MAX_USER and MAX_PASSWORD strictly from runtime environment variables.
 */

export const DEFAULT_MAX_LOGIN_URL = 'https://auth.max.com/login';
export const DEFAULT_MAX_WATCH_URL = 'https://hbomax.com/video/watch/0e33e070-5a45-4c4a-b655-9d7a7a6658ba';

/**
 * Extracts MAX_USER and MAX_PASSWORD from the provided environment map (defaults to process.env).
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ user: string, password: string, isConfigured: boolean }}
 */
export function getMaxCredentials(env = typeof process !== 'undefined' && process.env ? process.env : {}) {
  const user = typeof env.MAX_USER === 'string' ? env.MAX_USER.trim() : '';
  const password = typeof env.MAX_PASSWORD === 'string' ? env.MAX_PASSWORD : '';
  return {
    user,
    password,
    isConfigured: Boolean(user && password)
  };
}

/**
 * Automates the HBO Max login flow using a browser page driver (Playwright / Puppeteer compatible).
 * @param {{
 *   goto: (url: string) => Promise<any>,
 *   fill: (selector: string, value: string) => Promise<any>,
 *   click: (selector: string) => Promise<any>,
 *   waitForNavigation?: () => Promise<any>
 * }} page
 * @param {Record<string, string | undefined>} [env]
 * @param {{ loginUrl?: string }} [opts]
 * @returns {Promise<boolean>}
 */
export async function performMaxLogin(
  page,
  env = typeof process !== 'undefined' && process.env ? process.env : {},
  { loginUrl = DEFAULT_MAX_LOGIN_URL } = {}
) {
  const creds = getMaxCredentials(env);
  if (!creds.isConfigured || !page) {
    return false;
  }

  await page.goto(loginUrl);
  await page.fill('input[type="email"], input[name="username"], input[autocomplete="username"]', creds.user);
  await page.fill(
    'input[type="password"], input[name="password"], input[autocomplete="current-password"]',
    creds.password
  );
  await page.click('button[type="submit"], [data-testid*="sign-in" i], [data-testid*="login" i]');

  if (typeof page.waitForNavigation === 'function') {
    await page.waitForNavigation();
  }

  return true;
}
