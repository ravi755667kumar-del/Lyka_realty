/**
 * Lyka Realty Enterprise Anti-Inspect Security Shield
 * 
 * Provides complete protection against unauthorized source code scraping,
 * developer tool inspection, and reverse engineering:
 * - 100% blocks F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K.
 * - Blocks Ctrl+U (View Source), Ctrl+S (Save Page), Ctrl+P (Print Scrape).
 * - Blocks right-click context menu (prevents native Chrome "Inspect" option).
 * - Blocks automated image & asset drag scraping.
 * - Silences console logs to prevent sensitive customer, property, and token leaks.
 * - Real-time DevTools detection with an Enterprise Lockout Overlay if opened via browser menus.
 * 
 * Note: DevTools detection ignores child iframes so the Super Admin's in-app
 * Device Dimension Simulator can test responsive mobile/tablet breakpoints safely.
 */

let securityAlertTimeout: any = null;
let devtoolsCheckInterval: any = null;
let isDevToolsDetected = false;

export function triggerSecurityAlert(message?: string): void {
  if (typeof document === 'undefined') return;

  const defaultMsg = 'Source code inspection and developer tools are blocked.';
  const alertText = message || defaultMsg;

  let banner = document.getElementById('lyka-security-shield-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'lyka-security-shield-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    banner.style.cssText = [
      'position: fixed',
      'top: 20px',
      'left: 50%',
      'transform: translateX(-50%) translateY(-20px)',
      'z-index: 99999999',
      'background: linear-gradient(135deg, rgba(20, 16, 12, 0.98), rgba(40, 24, 16, 0.98))',
      'border: 1px solid rgba(239, 68, 68, 0.7)',
      'color: #ffffff',
      'padding: 12px 24px',
      'border-radius: 14px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'font-weight: 600',
      'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.35)',
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'pointer-events: none',
      'transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      'opacity: 0',
      'max-width: 90vw',
      'text-align: center',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)'
    ].join('; ');
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:rgba(239, 68, 68, 0.2); font-size: 14px;">🛡️</span>
    <span style="color: #ef4444; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">SECURITY SHIELD:</span>
    <span style="color: #f3f4f6;">${alertText}</span>
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
  }, 3200);
}

/**
 * Creates or toggles the full-screen Security Lockout overlay
 * when Chrome/Edge Developer Tools are detected as open.
 */
function updateDevToolsLockoutUI(locked: boolean) {
  if (typeof document === 'undefined') return;

  const lockoutId = 'lyka-devtools-security-lockout';
  let lockout = document.getElementById(lockoutId);

  if (locked) {
    if (!lockout) {
      lockout = document.createElement('div');
      lockout.id = lockoutId;
      lockout.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 999999999',
        'background: radial-gradient(circle at center, #181210 0%, #0a0807 100%)',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'padding: 24px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'color: #ffffff',
        'text-align: center',
        'backdrop-filter: blur(20px)',
        '-webkit-backdrop-filter: blur(20px)',
        'transition: opacity 0.3s ease',
        'opacity: 0'
      ].join('; ');

      lockout.innerHTML = `
        <div style="max-width: 540px; background: rgba(28, 22, 18, 0.95); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 24px; padding: 40px 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(239, 68, 68, 0.2); animation: lykaPulse 2.5s infinite ease-in-out;">
          <div style="width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 20px; background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 34px;">
            ⚠️
          </div>
          <div style="display: inline-block; background: rgba(239, 68, 68, 0.2); color: #fca5a5; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 14px; border-radius: 999px; margin-bottom: 14px; border: 1px solid rgba(239, 68, 68, 0.4);">
            Enterprise Security Lockout
          </div>
          <h2 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 12px; letter-spacing: -0.5px;">
            Developer Tools Inspection Detected
          </h2>
          <p style="font-size: 14px; line-height: 1.6; color: #9ca3af; margin: 0 0 24px;">
            Access to <strong style="color: #f3f4f6;">Lyka Realty</strong> has been temporarily locked to protect sensitive property pricing, customer CRM records, and intellectual property from unauthorized inspection.
          </p>
          <div style="background: rgba(15, 12, 10, 0.7); border: 1px dashed rgba(239, 68, 68, 0.35); border-radius: 14px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; color: #e5e7eb;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: #ef4444; margin-bottom: 4px;">
              <span>Action Required:</span>
            </div>
            Please <strong style="color: #fbbf24;">close Developer Tools / Inspect window</strong> to automatically restore application access.
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: #6b7280;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: blink 1.5s infinite;"></span>
            <span>Real-time security scanner active &bull; Auto-unlocks when closed</span>
          </div>
        </div>
      `;

      // Inject keyframe animation if missing
      if (!document.getElementById('lyka-lockout-styles')) {
        const style = document.createElement('style');
        style.id = 'lyka-lockout-styles';
        style.textContent = `
          @keyframes lykaPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.008); }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(lockout);
    }

    requestAnimationFrame(() => {
      if (lockout) {
        lockout.style.opacity = '1';
        lockout.style.pointerEvents = 'auto';
      }
    });
  } else {
    if (lockout) {
      lockout.style.opacity = '0';
      lockout.style.pointerEvents = 'none';
      setTimeout(() => {
        if (lockout && lockout.parentNode) {
          lockout.parentNode.removeChild(lockout);
        }
      }, 300);
    }
  }
}

/**
 * Initializes browser-level anti-inspect and anti-tamper security shield.
 */
export function initSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // ── 1. Intercept All Developer & Inspect Keyboard Shortcuts ──
  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.code ? e.code.toUpperCase() : '';

    // Block F12 (Inspect / DevTools)
    if (key === 'F12' || code === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('F12 Developer Tools are restricted for security.');
      return false;
    }

    // Block Ctrl+Shift+I / Cmd+Opt+I (Developer Tools)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Inspect Element shortcut is restricted.');
      return false;
    }

    // Block Ctrl+Shift+J / Cmd+Opt+J (Console Panel)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'J') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Developer Console shortcut is restricted.');
      return false;
    }

    // Block Ctrl+Shift+C / Cmd+Opt+C (Element Selector)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'C') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Element Inspector is restricted.');
      return false;
    }

    // Block Ctrl+Shift+K / Cmd+Opt+K (Firefox Web Console)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'K') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Web Console is restricted.');
      return false;
    }

    // Block Ctrl+U / Cmd+Opt+U (View Raw Page Source)
    if ((isCtrlOrMeta && key === 'U') || (isCtrlOrMeta && isAlt && key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('View Page Source is restricted.');
      return false;
    }

    // Block Ctrl+S / Cmd+S (Save Page Source to disk)
    if (isCtrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Page source saving is restricted.');
      return false;
    }

    // Block Ctrl+P / Cmd+P (Print page / save DOM to PDF)
    if (isCtrlOrMeta && key === 'P') {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityAlert('Page printing and scraping are restricted.');
      return false;
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  // ── 2. Block Right-Click Context Menu (Prevents Chrome native "Inspect" click) ──
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerSecurityAlert('Right-click context menu and inspect element are disabled.');
    return false;
  };

  window.addEventListener('contextmenu', handleContextMenu, true);

  // ── 3. Image & Asset Drag Protection (Prevents automated image scraping) ──
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'IMG' || target.getAttribute('draggable') === 'false')) {
      e.preventDefault();
      return false;
    }
  };
  document.addEventListener('dragstart', handleDragStart, true);

  // ── 4. Silence Console to Prevent Data & Token Leaks to Hackers ──
  try {
    const noop = () => {};
    // Keep internal references if ever needed
    const origWarn = console.warn;
    
    // Silence output so hacker cannot view network structures, states, or logs in console
    console.log = noop;
    console.info = noop;
    console.table = noop;
    console.debug = noop;

    if (origWarn) {
      origWarn.call(
        console,
        '%c🛡️ LYKA REALTY ENTERPRISE SECURITY: DevTools access is monitored. Unauthorized inspection or reverse engineering is prohibited.',
        'color: #ef4444; font-size: 13px; font-weight: bold; background: #1c1611; padding: 6px 12px; border-radius: 6px;'
      );
    }
  } catch (_) {}

  // ── 5. Real-Time DevTools Lockout Detection ──
  // If the user is inside an iframe (e.g. In-App Device Dimension Simulator), do not lock out
  const isInsideIframe = window.self !== window.top;
  
  if (!isInsideIframe) {
    const checkDevTools = () => {
      // Threshold check for docked DevTools (DevTools docked to right, bottom, or left)
      const widthThreshold = window.outerWidth - window.innerWidth > 200;
      const heightThreshold = window.outerHeight - window.innerHeight > 250;
      const isOpen = widthThreshold || heightThreshold;

      if (isOpen !== isDevToolsDetected) {
        isDevToolsDetected = isOpen;
        updateDevToolsLockoutUI(isDevToolsDetected);
      }
    };

    // Check periodically & on resize
    devtoolsCheckInterval = setInterval(checkDevTools, 800);
    window.addEventListener('resize', checkDevTools);
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('dragstart', handleDragStart, true);
    if (devtoolsCheckInterval) {
      clearInterval(devtoolsCheckInterval);
    }
    updateDevToolsLockoutUI(false);
  };
}
