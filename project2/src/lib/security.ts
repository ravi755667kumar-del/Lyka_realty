/**
 * Lyka Realty Enterprise Security Shield
 * 
 * Provides complete silent protection against developer tools inspection:
 * - Silently blocks F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K.
 * - Silently blocks Ctrl+U (View Source) and Ctrl+S (Save Page).
 * - Silently blocks right-click context menu (prevents native browser "Inspect" option).
 * - No popup or alert messages are shown when F12 or Inspect is triggered.
 * - Silences console logs to prevent sensitive customer, property, and token leaks.
 * - Authenticated admins retain full developer bypass privileges.
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

export function initSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // 1. Silently intercept and block DevTools keyboard shortcuts (No message banner)
  const handleKeyDown = (e: KeyboardEvent) => {
    // Authenticated Admins have full bypass
    if (isUserAdminAuthenticated()) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const key = e.key ? e.key.toUpperCase() : '';
    const code = e.code ? e.code.toUpperCase() : '';

    // Silently block F12
    if (key === 'F12' || code === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+Shift+I / Cmd+Opt+I (Developer Tools)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+Shift+J / Cmd+Opt+J (Console Panel)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'J') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+Shift+C / Cmd+Opt+C (Element Inspector)
    if (isCtrlOrMeta && (isShift || isAlt) && key === 'C') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+Shift+K (Firefox Web Console)
    if (isCtrlOrMeta && isShift && key === 'K') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+U / Cmd+Opt+U (View Page Source)
    if (isCtrlOrMeta && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Silently block Ctrl+S / Cmd+S (Save Page to disk)
    if (isCtrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  // 2. Silently block right-click context menu (prevents native Chrome "Inspect" click without any message)
  const handleContextMenu = (e: MouseEvent) => {
    // Authenticated Admins have native right-click
    if (isUserAdminAuthenticated()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  window.addEventListener('contextmenu', handleContextMenu, true);

  // 3. Silence console output for non-admins to prevent token, network, or OTP leaks
  try {
    const origLog = console.log;
    const origInfo = console.info;
    const origWarn = console.warn;
    const origTable = console.table;
    const origDebug = console.debug;

    const adminSafe = (origFn: any) => (...args: any[]) => {
      if (isUserAdminAuthenticated()) {
        origFn.apply(console, args);
      }
    };

    console.log = adminSafe(origLog);
    console.info = adminSafe(origInfo);
    console.warn = adminSafe(origWarn);
    console.table = adminSafe(origTable);
    console.debug = adminSafe(origDebug);
  } catch (_) {}

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('contextmenu', handleContextMenu, true);
  };
}
