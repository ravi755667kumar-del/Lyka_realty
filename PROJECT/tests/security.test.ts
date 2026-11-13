import assert from 'node:assert/strict';
import {
  isOriginAllowed,
  isEmailAuthorizedAdmin,
  timingSafeSecretEquals,
  checkRateLimit,
  resetRateLimitStoreForTests,
  maskSensitiveValue,
  redactErrorMessage,
  requireAuthenticatedApi,
} from '../src/lib/serverAuth';

export async function testSecurity(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  async function run(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  await run('isOriginAllowed: permits same-host, Capacitor mobile, localhost dev & ALLOWED_ORIGINS, rejects arbitrary origins', () => {
    assert.equal(isOriginAllowed(null, 'app.lykarealty.com'), true);
    assert.equal(isOriginAllowed('https://localhost', 'app.lykarealty.com'), true);
    assert.equal(isOriginAllowed('capacitor://localhost', 'app.lykarealty.com'), true);
    assert.equal(isOriginAllowed('http://localhost:3000', 'app.lykarealty.com'), true);
    assert.equal(isOriginAllowed('https://app.lykarealty.com', 'app.lykarealty.com'), true);
    assert.equal(
      isOriginAllowed('https://crm.lykarealty.com', 'app.lykarealty.com', 'https://crm.lykarealty.com'),
      true
    );

    assert.equal(isOriginAllowed('https://evil-attacker.com', 'app.lykarealty.com', ''), false);
    assert.equal(isOriginAllowed('null', 'app.lykarealty.com', ''), false);
  });

  await run('isEmailAuthorizedAdmin: enforces explicit allowlist when configured and rejects missing emails', () => {
    assert.equal(isEmailAuthorizedAdmin(null, ''), false);
    assert.equal(isEmailAuthorizedAdmin('', ''), false);
    assert.equal(isEmailAuthorizedAdmin('admin@lykarealty.com', ''), true);

    const allowlist = 'Owner@LykaRealty.com, security@lykarealty.com';
    assert.equal(isEmailAuthorizedAdmin('owner@lykarealty.com', allowlist), true);
    assert.equal(isEmailAuthorizedAdmin('SECURITY@lykarealty.com', allowlist), true);
    assert.equal(isEmailAuthorizedAdmin('random-user@gmail.com', allowlist), false);
  });

  await run('timingSafeSecretEquals: compares secrets safely without leaking prefix matches', () => {
    assert.equal(timingSafeSecretEquals('super-secret-123', 'super-secret-123'), true);
    assert.equal(timingSafeSecretEquals('super-secret-124', 'super-secret-123'), false);
    assert.equal(timingSafeSecretEquals('short', 'super-secret-123'), false);
    assert.equal(timingSafeSecretEquals('', ''), false);
    assert.equal(timingSafeSecretEquals(null, 'super-secret-123'), false);
  });

  await run('checkRateLimit: throttles abusive bursts and resets after window expiration', () => {
    resetRateLimitStoreForTests();
    const t0 = 1_700_000_000_000;
    assert.equal(checkRateLimit('ip1', 2, 60_000, t0).allowed, true);
    assert.equal(checkRateLimit('ip1', 2, 60_000, t0 + 1000).allowed, true);
    const blocked = checkRateLimit('ip1', 2, 60_000, t0 + 2000);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);

    const afterWindow = checkRateLimit('ip1', 2, 60_000, t0 + 61_000);
    assert.equal(afterWindow.allowed, true);
  });

  await run('maskSensitiveValue & redactErrorMessage: hides credentials and internal DB/path errors', () => {
    assert.equal(maskSensitiveValue('AC1234567890abcdef9999', 6, 4), 'AC1234••••••••9999');
    assert.equal(maskSensitiveValue('+919840123456', 3, 4), '+91••••••••3456');
    assert.equal(maskSensitiveValue('short', 4, 4), '••••••••');
    assert.equal(maskSensitiveValue(''), '');

    assert.equal(
      redactErrorMessage(new Error('postgres://user:pass@ep-123.neon.tech/db failed'), 'DB failed'),
      'DB failed'
    );
    assert.equal(
      redactErrorMessage(new Error('ECONNREFUSED C:\\Users\\secret\\file.json'), 'Request error'),
      'Request error'
    );
    assert.equal(
      redactErrorMessage(new Error('Invalid request parameter'), 'Request error'),
      'Invalid request parameter'
    );
  });

  await run('requireAuthenticatedApi: fails closed with 401 when unauthenticated & honors webhook secret when enabled', async () => {
    resetRateLimitStoreForTests();
    const unauthReq = new Request('http://localhost:3000/api/properties', { method: 'GET' });
    const unauthResult = await requireAuthenticatedApi(unauthReq);
    assert.equal(unauthResult.ok, false);
    if (!unauthResult.ok) {
      assert.equal(unauthResult.response.status, 401);
    }

    const prevSecret = process.env.CRM_WEBHOOK_SECRET;
    process.env.CRM_WEBHOOK_SECRET = 'test-webhook-secret-xyz';
    try {
      const badWebhookReq = new Request('http://localhost:3000/api/crm/webhook', {
        method: 'POST',
        headers: { 'x-crm-webhook-secret': 'wrong-secret' },
      });
      const badRes = await requireAuthenticatedApi(badWebhookReq, { allowWebhookSecret: true });
      assert.equal(badRes.ok, false);
      if (!badRes.ok) {
        assert.equal(badRes.response.status, 401);
      }

      const goodWebhookReq = new Request('http://localhost:3000/api/crm/webhook', {
        method: 'POST',
        headers: { 'x-crm-webhook-secret': 'test-webhook-secret-xyz' },
      });
      const goodRes = await requireAuthenticatedApi(goodWebhookReq, { allowWebhookSecret: true });
      assert.equal(goodRes.ok, true);
      if (goodRes.ok) {
        assert.equal(goodRes.mode, 'webhook');
      }
    } finally {
      if (prevSecret === undefined) {
        delete process.env.CRM_WEBHOOK_SECRET;
      } else {
        process.env.CRM_WEBHOOK_SECRET = prevSecret;
      }
    }
  });

  return results;
}
