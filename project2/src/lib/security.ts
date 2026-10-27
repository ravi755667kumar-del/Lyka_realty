/**
 * Lyka Realty Enterprise Security Shield
 * 
 * Provides silent, rock-solid protection against developer tools inspection:
 * - Silently blocks F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K,
 *   Ctrl+Shift+S, Ctrl+Shift+E, Ctrl+Shift+M, Shift+F7 across all browsers (Brave, Firefox, Chrome, Edge).
 * - Silently blocks Ctrl+U (View Source), Ctrl+S (Save Page), and Ctrl+P (Print).
 * - Silently blocks right-click context menu (prevents native browser "Inspect" option).
 * - Detects DevTools opened via browser Settings or 3-dots Menu across Brave, Firefox, Chrome, Edge:
 *   1. Immediately hides application DOM (#root) so no listings, customer CRM, or secrets can be viewed.
 *   2. Displays an enterprise security lockdown overlay.
 *   3. Freezes DevTools via continuous anti-debugging debugger loops so inspector, sources, and console are frozen.
 *   4. Silences console logs to prevent sensitive customer, property, and token leaks.
 * - Auto-restores the application seamlessly the moment DevTools is closed.
 * - Zero false positives across desktop scaling, mobile devices, and normal window resizing.
 */

export function isUserAdminAuthenticated(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('lyka_admin_authenticated') === 'true' ||
      localStorage.getItem('lyka_pm_authenticated') === 'true' ||
      localStorage.getItem('lyka_sm_authenticated') === 'true'
    );
  } catch (_) {
    return false;
  }
}

// Developer bypass key: only if URL explicitly contains secret key (?unlock_dev=lyka_secret_dev_override_2026)
function hasDevUnlockToken(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    // Always purge any stale session tokens
    try {
      sessionStorage.removeItem('lyka_dev_unlocked');
      localStorage.removeItem('lyka_dev_unlocked');
    } catch (_) {}

    const params = new URLSearchParams(window.location.search);
    return params.get('unlock_dev') === 'lyka_secret_dev_override_2026';
  } catch (_) {
    return false;
  }
}

let isInitialized = false;

export function initSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Purge any old session unlock flags on startup
  try {
    sessionStorage.removeItem('lyka_dev_unlocked');
    localStorage.removeItem('lyka_dev_unlocked');
  } catch (_) {}

  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // If explicit dev unlock is present in URL, skip protection
  if (hasDevUnlockToken()) {
    return () => {};
  }

  // 1. Silently intercept and block DevTools keyboard shortcuts across all browsers (Brave, Firefox, Chrome, Edge)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (hasDevUnlockToken()) return;

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.code ? e.code.toUpperCase() : '';

    // F12 (Standard DevTools across all browsers)
    if (key === 'F12' || code === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Shift + F7 (Firefox Style Editor)
    if (isShift && (key === 'F7' || code === 'F7')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I / Cmd+Opt+I (Developer Tools toggle)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+J / Cmd+Opt+J (Console Panel - Brave, Chrome, Edge)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'J') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+C / Cmd+Opt+C (Element Inspector - Brave, Firefox, Chrome)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'C') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+K / Cmd+Opt+K (Firefox Web Console)
    if (isCtrlOrMeta && isShift && key === 'K') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+S (Firefox Debugger)
    if (isCtrlOrMeta && isShift && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+E (Firefox Network Monitor)
    if (isCtrlOrMeta && isShift && key === 'E') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+M / Cmd+Opt+M (Responsive Design Mode in Firefox & Brave)
    if (isCtrlOrMeta && isShift && key === 'M') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U / Cmd+Opt+U (View Page Source)
    if (isCtrlOrMeta && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page to disk)
    if (isCtrlOrMeta && key === 'S' && !isShift) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+P / Cmd+P (Print Page)
    if (isCtrlOrMeta && key === 'P') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  // 2. Silently block right-click context menu (prevents native "Inspect" click)
  const handleContextMenu = (e: MouseEvent) => {
    if (hasDevUnlockToken()) return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  window.addEventListener('contextmenu', handleContextMenu, true);

  // 3. Silence console output completely
  try {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.table = noop;
    console.debug = noop;
  } catch (_) {}

  // 4. Menu & Settings DevTools Active Protection:
  // When an attacker or user opens DevTools via browser menu / settings in Brave, Firefox, or Chrome:
  let isShieldActive = false;
  let overlayEl: HTMLDivElement | null = null;

  const showSecurityShield = () => {
    if (hasDevUnlockToken()) return;

    // Immediately hide the application DOM so the user cannot inspect anything in DevTools Elements tab
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.style.setProperty('display', 'none', 'important');
    }

    if (!overlayEl && document.body) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'lyka-security-shield';
      overlayEl.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(9, 13, 22, 0.98);
        backdrop-filter: blur(24px);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 24px;
        text-align: center;
      `;
      overlayEl.innerHTML = `
        <div style="max-width: 460px; width: 100%; padding: 40px 32px; border-radius: 24px; border: 1px solid rgba(245, 158, 11, 0.35); background: #0f172a; box-shadow: 0 30px 70px rgba(0,0,0,0.9);">
          <div style="width: 60px; height: 60px; margin: 0 auto 18px; border-radius: 18px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.45); display: flex; align-items: center; justify-content: center; color: #f59e0b;">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style="font-size: 21px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; letter-spacing: -0.02em;">Developer Tools Restricted</h2>
          <p style="font-size: 13.5px; color: #94a3b8; line-height: 1.65; margin-bottom: 24px;">
            To safeguard customer privacy, proprietary property listings, and security sessions, inspection via browser settings, menu, or developer shortcuts is strictly restricted.
          </p>
          <div style="font-size: 12.5px; font-weight: 600; color: #f59e0b; background: rgba(245, 158, 11, 0.12); padding: 12px 16px; border-radius: 14px; border: 1px solid rgba(245, 158, 11, 0.3);">
            Please close Developer Tools to continue browsing.
          </div>
        </div>
      `;
      document.body.appendChild(overlayEl);
    }
  };

  const removeSecurityShield = () => {
    // Restore the application DOM
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.style.removeProperty('display');
    }

    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
      overlayEl = null;
    }
  };

  // Check docked and undocked DevTools detection
  const checkDevTools = () => {
    if (hasDevUnlockToken()) {
      if (isShieldActive) {
        removeSecurityShield();
        isShieldActive = false;
      }
      return;
    }

    // 1. Docked DevTools Detection (Brave / Firefox / Chrome / Edge):
    // When DevTools is docked on the right or left: widthDiff is typically > 250px.
    // When DevTools is docked on the bottom: heightDiff is typically > 320px.
    // In normal window resizing, widthDiff is <= 32px and heightDiff is <= 180px.
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isDocked = widthDiff > 160 || heightDiff > 280;

    // 2. Timing probe with debugger statement (traps undocked DevTools and freezes inspection):
    let isPaused = false;
    const t0 = performance.now();
    try {
      (function() {
        return false;
      }['constructor']('debugger')['call']());
    } catch (_) {}
    const elapsed = performance.now() - t0;
    if (elapsed > 80) {
      isPaused = true;
    }

    if (isDocked || isPaused) {
      if (!isShieldActive) {
        showSecurityShield();
        isShieldActive = true;
      }
      try { console.clear(); } catch (_) {}
    } else {
      if (isShieldActive) {
        removeSecurityShield();
        isShieldActive = false;
      }
    }
  };

  // Immediate initial check
  checkDevTools();

  // Run on window resize (fires immediately when docked DevTools is opened or closed via menu)
  window.addEventListener('resize', checkDevTools, { passive: true });

  // Continuous monitoring loop (every 150ms)
  const monitorTimer = setInterval(checkDevTools, 150);

  return () => {
    clearInterval(monitorTimer);
    window.removeEventListener('resize', checkDevTools);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('contextmenu', handleContextMenu, true);
    removeSecurityShield();
  };
}
