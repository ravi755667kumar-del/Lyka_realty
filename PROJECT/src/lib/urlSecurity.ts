/**
 * Security utilities for URL validation, SSRF protection, private IP blocking,
 * and safe media link sanitization.
 */

// Cloud metadata and private hostnames
const RESTRICTED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  'metadata',
]);

/**
 * Checks whether an IPv4 address belongs to a private, loopback, or link-local range.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Broadcast/Current network)
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (RFC 1918)
  if (a === 10) return true;
  // 172.16.0.0/12 (RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (RFC 1918)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

/**
 * Validates whether a target URL is safe for outbound server-side requests (SSRF defense).
 * Blocks private IP ranges, cloud metadata services, and unsupported protocols.
 */
export function isSafePublicUrl(urlStr: string): { valid: boolean; reason?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, reason: 'Empty or invalid URL parameter' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  // Enforce safe protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Disallowed protocol: "${parsed.protocol}"` };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Check known restricted hostnames
  if (RESTRICTED_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { valid: false, reason: `Access to restricted internal host "${hostname}" is blocked.` };
  }

  // Detect hex, octal, or integer representation of IP addresses (SSRF evasion bypasses)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    return { valid: false, reason: 'Integer-encoded IP addresses are blocked.' };
  }

  // Check standard IPv4 format
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return { valid: false, reason: `Access to private network address "${hostname}" is prohibited.` };
    }
  }

  // Check IPv6 loopback or unique local
  if (hostname.includes(':')) {
    if (
      hostname === '::1' ||
      hostname.startsWith('fe80:') ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:')
    ) {
      return { valid: false, reason: 'Access to private IPv6 destinations is prohibited.' };
    }
  }

  return { valid: true };
}

/**
 * Sanitizes URLs before rendering them as client-side <a href> or <audio src>.
 * Strictly allows safe protocols (https, http, blob, or relative paths).
 * Disallows javascript:, data:text/html, vbscript:, or other malicious schemes.
 */
export function sanitizeSafeUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Strip dangerous control chars
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return '';
  }

  // Allow safe relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Allow blob: URLs (used by browser audio recording buffers)
  if (trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Enforce HTTP / HTTPS scheme
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    // Malformed URL
    return '';
  }

  return '';
}
