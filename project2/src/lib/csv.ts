/** Escape quotes and neutralize spreadsheet formula injection in CRM exports. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

/** Check if current browser is running on mobile or touchscreen device (Realme C11, Android, iOS). */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isTouch = ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
  const isSmallScreen = window.innerWidth <= 1024;
  return isMobileUA || (isTouch && isSmallScreen);
}

/**
 * Trigger real HTTP attachment download via `/api/export-csv`.
 * Why this works on Android / Realme C11:
 * - A real HTTP response with `Content-Disposition: attachment` is caught by Android OS DownloadManager
 *   (`com.android.providers.downloads`) and saved directly into `/storage/emulated/0/Download/`.
 * - It displays the native system "Download complete" notification with progress bar.
 */
function triggerServerDownload(filename: string, content: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    let iframe = document.getElementById('lyka_csv_download_frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'lyka_csv_download_frame';
      iframe.name = 'lyka_csv_download_frame';
      iframe.style.display = 'none';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/export-csv';
    form.target = 'lyka_csv_download_frame';
    form.style.display = 'none';

    const filenameInput = document.createElement('input');
    filenameInput.type = 'hidden';
    filenameInput.name = 'filename';
    filenameInput.value = filename;
    form.appendChild(filenameInput);

    const contentInput = document.createElement('input');
    contentInput.type = 'hidden';
    contentInput.name = 'content';
    contentInput.value = content;
    form.appendChild(contentInput);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      try {
        if (form.parentNode) form.parentNode.removeChild(form);
      } catch (_) {}
    }, 3000);

    return true;
  } catch (err) {
    console.warn('[CSV] Server download fallback triggered:', err);
    return false;
  }
}

/**
 * Render a persistent, high-contrast Floating Download Hub at the bottom of the screen.
 * This guarantees 100% download accessibility on mobile devices where background clicks
 * or blob downloads are suppressed by aggressive mobile power-savers or security filters.
 */
function showFloatingDownloadHub(
  filename: string,
  bomCsv: string,
  blob: Blob,
  rowCount: number
) {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('lyka-download-hub');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const blobUrl = URL.createObjectURL(blob);
  const sizeKb = (blob.size / 1024).toFixed(1);

  const hub = document.createElement('div');
  hub.id = 'lyka-download-hub';
  hub.style.position = 'fixed';
  hub.style.bottom = '20px';
  hub.style.left = '50%';
  hub.style.transform = 'translateX(-50%)';
  hub.style.zIndex = '999999';
  hub.style.width = 'calc(100% - 24px)';
  hub.style.maxWidth = '460px';
  hub.style.background = 'rgba(15, 23, 42, 0.96)';
  hub.style.backdropFilter = 'blur(16px)';
  hub.style.border = '1px solid rgba(245, 158, 11, 0.5)';
  hub.style.borderRadius = '18px';
  hub.style.padding = '14px 16px';
  hub.style.boxShadow = '0 20px 35px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(245, 158, 11, 0.15)';
  hub.style.color = '#ffffff';
  hub.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  hub.style.animation = 'lykaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

  // Style animation keyframes if missing
  if (!document.getElementById('lyka-download-style')) {
    const style = document.createElement('style');
    style.id = 'lyka-download-style';
    style.textContent = `
      @keyframes lykaSlideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .lyka-hub-btn {
        transition: all 0.15s ease;
      }
      .lyka-hub-btn:active {
        transform: scale(0.96);
      }
    `;
    document.head.appendChild(style);
  }

  // Header row
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '8px';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'center';
  titleWrap.style.gap = '8px';

  const badge = document.createElement('span');
  badge.textContent = '✓';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.width = '20px';
  badge.style.height = '20px';
  badge.style.borderRadius = '50%';
  badge.style.background = '#10b981';
  badge.style.color = '#ffffff';
  badge.style.fontSize = '12px';
  badge.style.fontWeight = 'bold';

  const titleText = document.createElement('span');
  titleText.textContent = 'CSV File Download Ready';
  titleText.style.fontSize = '13px';
  titleText.style.fontWeight = '700';
  titleText.style.color = '#fef08a';

  titleWrap.appendChild(badge);
  titleWrap.appendChild(titleText);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Dismiss';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#94a3b8';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '0 4px';
  closeBtn.onclick = () => {
    try {
      if (hub.parentNode) hub.parentNode.removeChild(hub);
      URL.revokeObjectURL(blobUrl);
    } catch (_) {}
  };

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  hub.appendChild(header);

  // File Details row
  const info = document.createElement('div');
  info.style.fontSize = '11px';
  info.style.color = '#cbd5e1';
  info.style.marginBottom = '12px';
  info.style.display = 'flex';
  info.style.alignItems = 'center';
  info.style.justifyContent = 'space-between';
  info.style.background = 'rgba(2, 6, 23, 0.6)';
  info.style.padding = '6px 10px';
  info.style.borderRadius = '10px';
  info.style.border = '1px solid rgba(255, 255, 255, 0.08)';

  const fileLabel = document.createElement('span');
  fileLabel.textContent = `📄 ${filename}`;
  fileLabel.style.fontWeight = '600';
  fileLabel.style.color = '#f8fafc';
  fileLabel.style.maxWidth = '260px';
  fileLabel.style.overflow = 'hidden';
  fileLabel.style.textOverflow = 'ellipsis';
  fileLabel.style.whiteSpace = 'nowrap';

  const metaLabel = document.createElement('span');
  metaLabel.textContent = `${rowCount} rows • ${sizeKb} KB`;
  metaLabel.style.color = '#f59e0b';
  metaLabel.style.fontWeight = '600';

  info.appendChild(fileLabel);
  info.appendChild(metaLabel);
  hub.appendChild(info);

  // Actions Container
  const actions = document.createElement('div');
  actions.style.display = 'grid';
  actions.style.gridTemplateColumns = 'repeat(auto-fit, minmax(110px, 1fr))';
  actions.style.gap = '8px';

  // Action 1: Direct Visible Download Button (Guaranteed user gesture for mobile)
  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  downloadLink.download = filename;
  downloadLink.className = 'lyka-hub-btn';
  downloadLink.textContent = '📥 Save File';
  downloadLink.style.display = 'inline-flex';
  downloadLink.style.alignItems = 'center';
  downloadLink.style.justifyContent = 'center';
  downloadLink.style.padding = '8px 10px';
  downloadLink.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  downloadLink.style.color = '#000000';
  downloadLink.style.fontWeight = '700';
  downloadLink.style.fontSize = '12px';
  downloadLink.style.borderRadius = '10px';
  downloadLink.style.textDecoration = 'none';
  downloadLink.style.cursor = 'pointer';
  downloadLink.onclick = () => {
    downloadLink.textContent = '✓ Saved!';
    setTimeout(() => {
      downloadLink.textContent = '📥 Save File';
    }, 2000);
  };
  actions.appendChild(downloadLink);

  // Action 2: Native Android / Mobile Share & Open in Google Sheets / Excel
  const shareBtn = document.createElement('button');
  shareBtn.className = 'lyka-hub-btn';
  shareBtn.textContent = '📱 Open / Share';
  shareBtn.style.display = 'inline-flex';
  shareBtn.style.alignItems = 'center';
  shareBtn.style.justifyContent = 'center';
  shareBtn.style.padding = '8px 10px';
  shareBtn.style.background = 'rgba(245, 158, 11, 0.15)';
  shareBtn.style.border = '1px solid rgba(245, 158, 11, 0.4)';
  shareBtn.style.color = '#fbbf24';
  shareBtn.style.fontWeight = '600';
  shareBtn.style.fontSize = '12px';
  shareBtn.style.borderRadius = '10px';
  shareBtn.style.cursor = 'pointer';
  shareBtn.onclick = async () => {
    try {
      const file = new File([bomCsv], filename, { type: 'text/csv;charset=utf-8' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `Lyka Realty CRM Export - ${filename}`
        });
      } else {
        // Fallback: trigger download link
        downloadLink.click();
      }
    } catch (shareErr: any) {
      if (shareErr.name !== 'AbortError') {
        downloadLink.click();
      }
    }
  };
  actions.appendChild(shareBtn);

  // Action 3: Copy CSV to Clipboard
  const copyBtn = document.createElement('button');
  copyBtn.className = 'lyka-hub-btn';
  copyBtn.textContent = '📋 Copy CSV';
  copyBtn.style.display = 'inline-flex';
  copyBtn.style.alignItems = 'center';
  copyBtn.style.justifyContent = 'center';
  copyBtn.style.padding = '8px 10px';
  copyBtn.style.background = 'rgba(255, 255, 255, 0.08)';
  copyBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  copyBtn.style.color = '#e2e8f0';
  copyBtn.style.fontWeight = '600';
  copyBtn.style.fontSize = '12px';
  copyBtn.style.borderRadius = '10px';
  copyBtn.style.cursor = 'pointer';
  copyBtn.onclick = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bomCsv);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = bomCsv;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      copyBtn.textContent = '✓ Copied!';
      copyBtn.style.color = '#34d399';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy CSV';
        copyBtn.style.color = '#e2e8f0';
      }, 2000);
    } catch (_) {
      copyBtn.textContent = 'Error';
    }
  };
  actions.appendChild(copyBtn);

  hub.appendChild(actions);
  document.body.appendChild(hub);

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    try {
      if (hub.parentNode) {
        hub.parentNode.removeChild(hub);
      }
      URL.revokeObjectURL(blobUrl);
    } catch (_) {}
  }, 15000);
}

/**
 * Universal CSV file download helper that reliably works across Desktop & Mobile browsers
 * (Chrome on Android, Realme C11, Mobile Desktop Site mode, Safari, Firefox, Edge, Capacitor WebView).
 * 
 * Multi-layer delivery strategy:
 * 1. Server HTTP Stream: Submits to `/api/export-csv` with `Content-Disposition: attachment`.
 *    This engages Android OS `DownloadManager` so the file appears in the phone's Downloads folder
 *    and system notification tray ("like normal person downloading from the internet").
 * 2. Client Blob URL Trigger: Dispatches standard browser download link.
 * 3. Mobile System Share & Action Hub: Renders a floating luxury Download Card with direct 
 *    user-tap "Save File", "Open in Sheets / Share" (Web Share API), and "Copy CSV" options.
 */
export function downloadCSV(filename: string, csvContent: string): boolean {
  try {
    const cleanFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
    const bomCsv = '\uFEFF' + csvContent;
    const blob = new Blob([bomCsv], { type: 'text/csv;charset=utf-8;' });
    const rowCount = Math.max(1, csvContent.split('\n').filter(r => r.trim().length > 0).length - 1);

    // Layer 1: Trigger native OS download via server attachment endpoint
    triggerServerDownload(cleanFilename, csvContent);

    // Layer 2: Client-side anchor click (standard desktop & mobile browser download)
    if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', cleanFilename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          if (link.parentNode) link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (_) {}
      }, 3000);
    }

    // Layer 3: Render Interactive Floating Download Hub (for mobile touch access & instant verification)
    showFloatingDownloadHub(cleanFilename, bomCsv, blob, rowCount);

    return true;
  } catch (err) {
    console.error('[CSV Download] Error:', err);
    try {
      const encoded = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csvContent);
      window.open(encoded, '_blank');
      return true;
    } catch (_) {
      return false;
    }
  }
}
