import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const STORAGE_KEY_API_URL = 'lyka_mobile_api_url';

/**
 * Pure URL helper to resolve relative `/api/...` paths against a backend base URL.
 * Returns the original input unchanged if baseUrl is empty or URL is already absolute.
 */
export function resolveApiUrlWithBase(inputUrl: string, baseUrl: string): string {
  if (!inputUrl || !inputUrl.startsWith('/api')) {
    return inputUrl;
  }
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanBase) {
    return inputUrl;
  }
  return `${cleanBase}${inputUrl}`;
}

export function isNativeMobile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getMobilePlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web';
  try {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
    return 'web';
  } catch {
    return 'web';
  }
}

export function getDefaultMobileApiBaseUrl(): string {
  const envUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) || '';
  if (envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  const platform = getMobilePlatform();
  if (platform === 'android') {
    // Standard Android Emulator host loopback to laptop localhost:3001
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY_API_URL);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultMobileApiBaseUrl();
}

export function setApiBaseUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.localStorage) {
    if (normalized) {
      window.localStorage.setItem(STORAGE_KEY_API_URL, normalized);
    } else {
      window.localStorage.removeItem(STORAGE_KEY_API_URL);
    }
  }
  return getApiBaseUrl();
}

let interceptorInstalled = false;

/**
 * Installs a transparent fetch interceptor when running inside Capacitor Native APK/IPA
 * (where `window.location.origin` is https://localhost or capacitor://localhost)
 * so all relative `fetch('/api/...')` calls route to the configured Next.js backend URL.
 */
export function installMobileApiFetchInterceptor(): void {
  if (typeof window === 'undefined' || interceptorInstalled) return;
  if (!isNativeMobile()) return;

  // If Capacitor is running directly against a hosted `server.url`, relative `/api/...`
  // already points to that server, so only rewrite when origin is local Capacitor WebView.
  const origin = window.location.origin || '';
  const isCapacitorLocalOrigin =
    origin.startsWith('capacitor://') ||
    origin === 'https://localhost' ||
    origin === 'http://localhost' ||
    origin.startsWith('file://');

  if (!isCapacitorLocalOrigin) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  interceptorInstalled = true;

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const baseUrl = getApiBaseUrl();

    if (typeof input === 'string') {
      const targetUrl = resolveApiUrlWithBase(input, baseUrl);
      return originalFetch(targetUrl, init);
    }

    if (input instanceof URL) {
      const pathname = input.pathname + input.search;
      if (pathname.startsWith('/api') && input.origin === window.location.origin) {
        return originalFetch(resolveApiUrlWithBase(pathname, baseUrl), init);
      }
      return originalFetch(input, init);
    }

    if (input instanceof Request && input.url.startsWith(`${origin}/api`)) {
      const relative = input.url.slice(origin.length);
      const rewritten = new Request(resolveApiUrlWithBase(relative, baseUrl), input);
      return originalFetch(rewritten, init);
    }

    return originalFetch(input, init);
  };
}

/**
 * Initializes Capacitor native UI features: StatusBar styling, SplashScreen hide,
 * and Android hardware back-button modal navigation.
 * Returns a cleanup function for React effects.
 */
export function initCapacitorNativeFeatures(options?: {
  onBackPressed?: () => boolean;
}): () => void {
  if (!isNativeMobile()) {
    return () => {};
  }

  // Style dark native status bar matching Tailwind bg-slate-950 (#020617)
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (getMobilePlatform() === 'android') {
    void StatusBar.setBackgroundColor({ color: '#020617' }).catch(() => {});
  }

  // Smoothly dismiss splash screen once React UI has mounted
  void SplashScreen.hide().catch(() => {});

  // Handle Android hardware Back button
  let backListenerHandle: { remove: () => Promise<void> } | null = null;
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    const handledByModal = options?.onBackPressed?.();
    if (handledByModal) {
      return;
    }
    if (canGoBack) {
      window.history.back();
    } else {
      void CapApp.minimizeApp().catch(() => {
        void CapApp.exitApp().catch(() => {});
      });
    }
  })
    .then((handle) => {
      backListenerHandle = handle;
    })
    .catch(() => {});

  return () => {
    if (backListenerHandle) {
      void backListenerHandle.remove().catch(() => {});
    }
  };
}

/**
 * Triggers native haptic vibration feedback on Android & iOS devices when calling/saving.
 */
export async function triggerHapticFeedback(
  level: 'light' | 'medium' | 'heavy' = 'light'
): Promise<void> {
  if (!isNativeMobile()) return;
  const styleMap: Record<'light' | 'medium' | 'heavy', ImpactStyle> = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  try {
    await Haptics.impact({ style: styleMap[level] });
  } catch {
    // Ignore on unsupported devices
  }
}
