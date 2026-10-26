/**
 * Lyka Realty Enterprise Security Shield
 * 
 * Provides protection against unauthorized source code scraping and asset tampering,
 * while allowing authorized development and testing across various devices and services via F12.
 * 
 * Configured per user specification:
 * - F12 Developer Tools allowed (enables testing responsive device modes & services).
 * - View source (Ctrl+U) and save page (Ctrl+S) blocked.
 * - Asset / image drag-scraping blocked.
 * - Non-intrusive security banner in console.
 */

let securityAlertTimeout: any = null;

export function triggerSecurityAlert(message?: string): void {
  if (typeof document === 'undefined') return;

  const defaultMsg = '🛡️ Security Shield Active: Source code extraction is restricted.';
  const alertText = message || defaultMsg;

  let banner = document.getElementById('lyka-security-shield-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'lyka-security-shield-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    banner.style.cssText = [
      'position: fixed',
      'top: 18px',
      'left: 50%',
      'transform: translateX(-50%) translateY(-20px)',
      'z-index: 9999999',
      'background: linear-gradient(135deg, rgba(28, 22, 17, 0.98), rgba(45, 36, 29, 0.98))',
      'border: 1px solid rgba(245, 158, 11, 0.6)',
      'color: #ffffff',
      'padding: 10px 20px',
      'border-radius: 14px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'font-weight: 600',
      'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.25)',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'pointer-events: none',
      'transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      'opacity: 0',
      'max-width: 90vw',
      'text-align: center',
      'backdrop-filter: blur(8px)',
      '-webkit-backdrop-filter: blur(8px)'
    ].join('; ');
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <span style="display:inline-block; font-size: 16px; line-height: 1;">🛡️</span>
    <span style="color: #fbbf24; font-weight: 700; letter-spacing: 0.3px;">LYKA SECURITY:</span>
    <span style="color: #f3f4f6;">${alertText.replace(/^[^\w]*/, '')}</span>
  `;

  // Animate in
  requestAnimationFrame(() => {
    if (!banner) return;
    banner.style.opacity = '1';
    banner.style.transform = 'translateX(-50%) translateY(0)';
  });

  if (securityAlertTimeout) {
    clearTimeout(securityAlertTimeout);
  }

  securityAlertTimeout = setTimeout(() => {
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) translateY(-20px)';
    }
  }, 2800);
}

/**
 * Initializes browser-level anti-scrape and security shield.
 * F12 and DevTools device simulation remain enabled for testing across devices.
 */
export function initSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // ── 1. Intercept Source-Scraping Shortcuts (F12 is deliberately ALLOWED) ──
  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const key = e.key ? e.key.toUpperCase() : '';

    // NOTE: F12 and Ctrl+Shift+I / Cmd+Opt+I are explicitly NOT blocked
    // so developers can test responsive device modes across services.

    // Ctrl+U / Cmd+Opt+U (View Raw Page Source)
    if ((isCtrlOrMeta && key === 'U') || (isCtrlOrMeta && isAlt && key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('View Page Source is restricted.');
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page Source to disk)
    if (isCtrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Page source saving is restricted.');
      return false;
    }
  };
  window.addEventListener('keydown', handleKeyDown, true);

  // ── 2. Image & Asset Drag Protection (Prevents automated image scraping) ──
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'IMG' || target.getAttribute('draggable') === 'false')) {
      e.preventDefault();
      return false;
    }
  };
  document.addEventListener('dragstart', handleDragStart, true);

  // ── 3. Security Notice in Console (Informative, non-destructive) ──
  try {
    console.log(
      '%c🛡️ LYKA REALTY SECURITY SHIELD',
      'color: #fbbf24; font-size: 16px; font-weight: 800; background: #1c1611; padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.4);'
    );
    console.log(
      '%cDeveloper inspection mode active. Responsive testing enabled.',
      'color: #10b981; font-size: 12px; font-weight: 600;'
    );
  } catch (_) {}

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('dragstart', handleDragStart, true);
  };
}
