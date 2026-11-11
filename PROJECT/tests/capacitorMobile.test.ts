import assert from 'node:assert/strict';
import {
  resolveApiUrlWithBase,
  isNativeMobile,
  getMobilePlatform,
  getDefaultMobileApiBaseUrl,
  getApiBaseUrl,
  setApiBaseUrl,
} from '../src/lib/capacitor';

export async function testCapacitorMobile(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  run('resolveApiUrlWithBase: rewrites relative /api paths using base URL without duplicate slashes', () => {
    assert.equal(
      resolveApiUrlWithBase('/api/gemini/chat', 'http://10.0.2.2:3001/'),
      'http://10.0.2.2:3001/api/gemini/chat'
    );
    assert.equal(
      resolveApiUrlWithBase('/api/properties?id=prop_1', 'https://api.lykarealty.com'),
      'https://api.lykarealty.com/api/properties?id=prop_1'
    );
  });

  run('resolveApiUrlWithBase: keeps external or non-API URLs untouched', () => {
    assert.equal(
      resolveApiUrlWithBase('https://cdn.example.com/audio.mp3', 'http://10.0.2.2:3001'),
      'https://cdn.example.com/audio.mp3'
    );
    assert.equal(
      resolveApiUrlWithBase('/assets/logo.png', 'http://10.0.2.2:3001'),
      '/assets/logo.png'
    );
    assert.equal(resolveApiUrlWithBase('/api/health', ''), '/api/health');
  });

  run('isNativeMobile & getMobilePlatform: safely report non-native web fallback in SSR/Node', () => {
    assert.equal(isNativeMobile(), false);
    assert.equal(getMobilePlatform(), 'web');
  });

  run('getDefaultMobileApiBaseUrl: resolves valid default loopback endpoint', () => {
    const url = getDefaultMobileApiBaseUrl();
    assert.ok(url.startsWith('http://') || url.startsWith('https://'));
  });

  run('getApiBaseUrl & setApiBaseUrl: safely return default fallback and handle empty window.localStorage', () => {
    const initial = getApiBaseUrl();
    assert.ok(initial.startsWith('http://') || initial.startsWith('https://'));
    const updated = setApiBaseUrl('https://mobile.lykarealty.com/');
    assert.equal(typeof updated, 'string');
  });

  return results;
}
