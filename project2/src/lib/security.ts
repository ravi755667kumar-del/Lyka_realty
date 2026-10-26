/**
 * Lyka Realty Enterprise Security Shield
 * 
 * Provides robust protection against unauthorized element inspection,
 * developer tool sniffing, source code extraction, and sensitive data leakage.
 * 
 * Features:
 * 1. Blocks Right-Click / Context Menu (prevents "Inspect", "Inspect Element").
 * 2. Blocks all Developer Tool keyboard shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K, Ctrl+U, Ctrl+S).
 * 3. Sanitizes and silences the console in the browser to prevent data leakage.
 * 4. Displays real-time security warning notifications on tamper attempts.
 * 5. Active DevTools detection & anti-debugging routines.
 * 6. Image & asset drag-protection against automated scrapers.
 */

let securityAlertTimeout: any = null;

export function triggerSecurityAlert(message?: string): void {
  if (typeof document === 'undefined') return;

  const defaultMsg = '🛡️ Security Shield Active: Element inspection and developer tools are blocked to protect sensitive data.';
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
 * Initializes all browser-level anti-inspect and anti-tamper security locks.
 */
export function initSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // ── 1. Disable Right-Click Context Menu (Prevents "Inspect", "Inspect Element", "View Source") ──
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerSecurityAlert('Right-click & Developer Inspection are restricted.');
    return false;
  };
  document.addEventListener('contextmenu', handleContextMenu, true);

  // ── 2. Intercept DevTools Keyboard Shortcuts ──
  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.code || '';
    const keyCode = e.keyCode || e.which;

    // F12 key
    if (key === 'F12' || code === 'F12' || keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('F12 Developer Tools are blocked by security policy.');
      return false;
    }

    // Ctrl+Shift+I / Cmd+Opt+I (DevTools Inspect)
    if ((isCtrlOrMeta && isShift && key === 'I') || (isCtrlOrMeta && isAlt && key === 'I')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Inspect Element shortcut is blocked.');
      return false;
    }

    // Ctrl+Shift+J / Cmd+Opt+J (DevTools Console)
    if ((isCtrlOrMeta && isShift && key === 'J') || (isCtrlOrMeta && isAlt && key === 'J')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Console shortcut is blocked.');
      return false;
    }

    // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element Picker)
    if ((isCtrlOrMeta && isShift && key === 'C') || (isCtrlOrMeta && isAlt && key === 'C')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Element inspection is blocked.');
      return false;
    }

    // Ctrl+Shift+K / Cmd+Opt+K (Firefox Web Console)
    if (isCtrlOrMeta && isShift && key === 'K') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Web Console is blocked.');
      return false;
    }

    // Ctrl+U / Cmd+Opt+U (View Page Source)
    if ((isCtrlOrMeta && key === 'U') || (isCtrlOrMeta && isAlt && key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('View Page Source is blocked.');
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page Source)
    if (isCtrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Page source extraction is blocked.');
      return false;
    }
  };
  window.addEventListener('keydown', handleKeyDown, true);

  // ── 3. Image & Element Drag Protection (Prevents dragging assets for scraping) ──
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'IMG' || target.getAttribute('draggable') === 'false')) {
      e.preventDefault();
      return false;
    }
  };
  document.addEventListener('dragstart', handleDragStart, true);

  // ── 4. Console Protection: Silence Sensitive Leaks ──
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalTable = console.table;

  // Suppress sensitive logs so hackers cannot see internal state or network responses
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  if (console.table) {
    console.table = noop;
  }

  // Display High-Security Console Warning Banner
  try {
    console.clear();
    originalLog(
      '%c⚠️ STOP! ACCESS RESTRICTED',
      'color: #ef4444; font-size: 24px; font-weight: 900; background: #1c1611; padding: 6px 14px; border-radius: 6px; border: 1px solid #ef4444;'
    );
    originalLog(
      '%cLyka Realty Enterprise Security Shield is active. Developer inspection, memory dump extraction, and unauthorized reverse-engineering are monitored and blocked.',
      'color: #fbbf24; font-size: 13px; font-weight: 700; line-height: 1.5;'
    );
  } catch (_) {}

  // ── 5. Active DevTools Detection & Anti-Debugging ──
  let devToolsCheckerInterval: any = null;
  const checkDevTools = () => {
    try {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        console.clear();
        triggerSecurityAlert('Developer tools detected. All output is sanitized.');
      }
    } catch (_) {}
  };
  devToolsCheckerInterval = setInterval(checkDevTools, 2000);

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('dragstart', handleDragStart, true);
    if (devToolsCheckerInterval) {
      clearInterval(devToolsCheckerInterval);
    }
    // Restore console on unmount if needed
    console.log = originalLog;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.debug = originalDebug;
    if (originalTable) console.table = originalTable;
  };
}
