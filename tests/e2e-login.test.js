import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMaxCredentials,
  performMaxLogin
} from '../src/shared/e2e-credentials.js';

test('getMaxCredentials - reads MAX_USER and MAX_PASSWORD from environment object', () => {
  const creds = getMaxCredentials({
    MAX_USER: 'test@example.com',
    MAX_PASSWORD: 'test-password-123'
  });
  assert.equal(creds.user, 'test@example.com');
  assert.equal(creds.password, 'test-password-123');
  assert.equal(creds.isConfigured, true);
});

test('getMaxCredentials - returns isConfigured=false when MAX_USER or MAX_PASSWORD is missing', () => {
  const emptyCreds = getMaxCredentials({});
  assert.equal(emptyCreds.isConfigured, false);

  const partialCreds = getMaxCredentials({ MAX_USER: 'only-user@example.com' });
  assert.equal(partialCreds.isConfigured, false);
});

test('performMaxLogin - fills email and password fields and submits login form via page driver', async () => {
  const actions = [];
  const mockPage = {
    goto: async (url) => actions.push(['goto', url]),
    fill: async (selector, val) => actions.push(['fill', selector, val]),
    click: async (selector) => actions.push(['click', selector]),
    waitForNavigation: async () => actions.push(['waitForNavigation'])
  };

  const ok = await performMaxLogin(mockPage, {
    MAX_USER: 'user@example.com',
    MAX_PASSWORD: 'pw-value'
  });

  assert.equal(ok, true);
  assert.equal(actions[0][0], 'goto');
  assert.equal(
    actions.some((a) => a[0] === 'fill' && a[2] === 'user@example.com'),
    true
  );
  assert.equal(
    actions.some((a) => a[0] === 'fill' && a[2] === 'pw-value'),
    true
  );
});
