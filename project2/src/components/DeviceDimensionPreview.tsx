import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  RotateCw, 
  RefreshCw, 
  X, 
  Maximize2, 
  ZoomIn, 
  Sliders, 
  ShieldCheck,
  Check,
  ChevronDown
} from 'lucide-react';

export interface DevicePreset {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  width: number;
  height: number;
  dpr: number;
  icon: 'phone' | 'tablet' | 'desktop';
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iphone-16-pro', name: 'iPhone 16 Pro', type: 'mobile', width: 393, height: 852, dpr: 3, icon: 'phone' },
  { id: 'iphone-15-promax', name: 'iPhone 15 Pro Max', type: 'mobile', width: 430, height: 932, dpr: 3, icon: 'phone' },
  { id: 'iphone-se', name: 'iPhone SE (Compact)', type: 'mobile', width: 375, height: 667, dpr: 2, icon: 'phone' },
  { id: 'galaxy-s24', name: 'Samsung Galaxy S24', type: 'mobile', width: 412, height: 915, dpr: 3, icon: 'phone' },
  { id: 'pixel-8', name: 'Google Pixel 8', type: 'mobile', width: 412, height: 892, dpr: 2.6, icon: 'phone' },
  { id: 'ipad-air', name: 'iPad Air (11")', type: 'tablet', width: 820, height: 1180, dpr: 2, icon: 'tablet' },
  { id: 'ipad-mini', name: 'iPad Mini (8.3")', type: 'tablet', width: 744, height: 1133, dpr: 2, icon: 'tablet' },
  { id: 'laptop-hd', name: 'Laptop HD', type: 'desktop', width: 1366, height: 768, dpr: 1, icon: 'desktop' },
  { id: 'desktop-fhd', name: 'Desktop Full HD', type: 'desktop', width: 1920, height: 1080, dpr: 1, icon: 'desktop' },
];

interface DeviceDimensionPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  initialPath?: string;
}

export const DeviceDimensionPreview: React.FC<DeviceDimensionPreviewProps> = ({
  isOpen,
  onClose,
  initialPath = '/'
}) => {
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset>(DEVICE_PRESETS[0]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [customWidth, setCustomWidth] = useState<number>(393);
  const [customHeight, setCustomHeight] = useState<number>(852);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '75' | '50'>('fit');
  const [calculatedScale, setCalculatedScale] = useState<number>(1);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Active Dimensions considering orientation
  const rawWidth = isCustomMode ? customWidth : selectedPreset.width;
  const rawHeight = isCustomMode ? customHeight : selectedPreset.height;

  const activeWidth = isLandscape ? rawHeight : rawWidth;
  const activeHeight = isLandscape ? rawWidth : rawHeight;

  // Auto-calculate scale when 'fit' is chosen or on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (zoomLevel !== 'fit' || !containerRef.current) {
        if (zoomLevel === '100') setCalculatedScale(1);
        if (zoomLevel === '75') setCalculatedScale(0.75);
        if (zoomLevel === '50') setCalculatedScale(0.5);
        return;
      }

      const availableWidth = containerRef.current.clientWidth - 80;
      const availableHeight = containerRef.current.clientHeight - 80;

      const scaleX = availableWidth / (activeWidth + (showFrame ? 48 : 0));
      const scaleY = availableHeight / (activeHeight + (showFrame ? 64 : 0));
      const fitScale = Math.min(scaleX, scaleY, 1);

      setCalculatedScale(Math.max(fitScale, 0.25));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, activeWidth, activeHeight, showFrame, zoomLevel]);

  // Handle ESC key to exit
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: DevicePreset) => {
    setSelectedPreset(preset);
    setIsCustomMode(false);
    setCustomWidth(preset.width);
    setCustomHeight(preset.height);
    setIsPresetDropdownOpen(false);
  };

  const handleRotate = () => {
    setIsLandscape(prev => !prev);
  };

  const handleReload = () => {
    setIframeKey(Date.now());
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'desktop':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Smartphone className="w-4 h-4" />;
    }
  };

  // Preview URL with flag to avoid recursion and optimize layout inside frame
  const previewUrl = `${initialPath}${initialPath.includes('?') ? '&' : '?'}device_preview=true`;

  return (
    <div className="fixed inset-0 z-[9999999] bg-slate-950/95 backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 select-none animate-fadeIn">
      {/* ── Top Simulator Toolbar ── */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-lg">
        {/* Left: Branding & Device Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-amber-400 tracking-wider uppercase">Lyka Realty</div>
              <div className="text-[11px] font-medium text-slate-400">Device Simulator</div>
            </div>
          </div>

          {/* Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPresetDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition-all"
            >
              {getDeviceIcon(isCustomMode ? 'custom' : selectedPreset.type)}
              <span className="font-semibold text-slate-200">
                {isCustomMode ? `Custom (${activeWidth}×${activeHeight})` : selectedPreset.name}
              </span>
              <span className="text-[11px] text-amber-400/90 hidden md:inline">
                {activeWidth} × {activeHeight}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isPresetDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsPresetDropdownOpen(false)} 
                />
                <div className="absolute left-0 top-full mt-2 w-72 max-h-96 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 p-1.5 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    Mobile Devices
                  </div>
                  {DEVICE_PRESETS.filter(p => p.type === 'mobile').map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        !isCustomMode && selectedPreset.id === preset.id
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                        <span>{preset.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {preset.width} × {preset.height}
                      </span>
                    </button>
                  ))}

                  <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 pt-2 border-t border-slate-800">
                    Tablets
                  </div>
                  {DEVICE_PRESETS.filter(p => p.type === 'tablet').map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        !isCustomMode && selectedPreset.id === preset.id
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Tablet className="w-3.5 h-3.5 text-blue-400" />
                        <span>{preset.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {preset.width} × {preset.height}
                      </span>
                    </button>
                  ))}

                  <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 pt-2 border-t border-slate-800">
                    Desktop / Laptops
                  </div>
                  {DEVICE_PRESETS.filter(p => p.type === 'desktop').map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        !isCustomMode && selectedPreset.id === preset.id
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{preset.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {preset.width} × {preset.height}
                      </span>
                    </button>
                  ))}

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsCustomMode(true);
                        setIsPresetDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isCustomMode
                          ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-purple-400" />
                        <span>Custom Dimensions</span>
                      </div>
                      <span className="text-[11px] text-purple-400">Manual</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Controls (Rotate, Zoom, Dimension Inputs) */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Custom Dimension Editors if in custom mode */}
          {isCustomMode ? (
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 font-semibold">W:</span>
              <input
                type="number"
                value={customWidth}
                onChange={e => setCustomWidth(Math.max(300, parseInt(e.target.value) || 300))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              />
              <span className="text-slate-500">×</span>
              <span className="text-slate-400 font-semibold">H:</span>
              <input
                type="number"
                value={customHeight}
                onChange={e => setCustomHeight(Math.max(400, parseInt(e.target.value) || 400))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              />
              <span className="text-slate-500 text-[10px]">px</span>
            </div>
          ) : null}

          {/* Rotate Orientation */}
          <button
            onClick={handleRotate}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isLandscape
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Rotate Device Orientation (Portrait / Landscape)"
          >
            <RotateCw className={`w-3.5 h-3.5 transition-transform duration-300 ${isLandscape ? 'rotate-90 text-amber-400' : ''}`} />
            <span>{isLandscape ? 'Landscape' : 'Portrait'}</span>
          </button>

          {/* Toggle Device Hardware Frame */}
          <button
            onClick={() => setShowFrame(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showFrame
                ? 'bg-slate-800 text-emerald-400 border-slate-700'
                : 'bg-slate-800/50 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Realistic Device Hardware Frame"
          >
            <div className={`w-2 h-2 rounded-full ${showFrame ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
            <span>Hardware Bezel</span>
          </button>

          {/* Zoom / Scale Controller */}
          <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setZoomLevel('fit')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                zoomLevel === 'fit' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fit ({Math.round(calculatedScale * 100)}%)
            </button>
            <button
              onClick={() => setZoomLevel('100')}
              className={`px-2 py-1 rounded font-semibold transition-all ${
                zoomLevel === '100' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              100%
            </button>
            <button
              onClick={() => setZoomLevel('75')}
              className={`px-2 py-1 rounded font-semibold transition-all ${
                zoomLevel === '75' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              75%
            </button>
            <button
              onClick={() => setZoomLevel('50')}
              className={`px-2 py-1 rounded font-semibold transition-all ${
                zoomLevel === '50' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              50%
            </button>
          </div>
        </div>

        {/* Right: Refresh, Shield Status, Exit */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReload}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 transition-colors"
            title="Reload Frame"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anti-Inspect Active</span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
            title="Exit Simulator (ESC)"
          >
            <X className="w-4 h-4" />
            <span>Exit Preview</span>
          </button>
        </div>
      </header>

      {/* ── Main Simulator Canvas (Interactive Viewport) ── */}
      <main
        ref={containerRef}
        className="flex-1 relative overflow-auto p-6 flex items-center justify-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] bg-slate-950"
      >
        <div
          className="transition-transform duration-200 ease-out flex flex-col items-center justify-center"
          style={{
            transform: `scale(${calculatedScale})`,
            transformOrigin: 'center center'
          }}
        >
          {/* Device Dimension Header Label */}
          <div className="mb-3 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{isCustomMode ? 'Custom Viewport' : selectedPreset.name}</span>
            <span className="text-amber-400 font-bold">{activeWidth} × {activeHeight} px</span>
            <span className="text-slate-500 text-[10px]">| DPR: {selectedPreset.dpr}x</span>
          </div>

          {/* Outer Chassis Frame (Phone / Tablet hardware skin) */}
          <div
            className={`relative transition-all duration-300 ${
              showFrame
                ? selectedPreset.type === 'desktop'
                  ? 'p-3 bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-700'
                  : 'p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-[48px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1),inset_0_0_0_2px_rgba(0,0,0,0.8)] border-[3px] border-slate-600/80'
                : 'border border-slate-700 shadow-2xl rounded-lg'
            }`}
            style={{
              width: showFrame ? activeWidth + (selectedPreset.type === 'desktop' ? 24 : 28) : activeWidth,
              height: showFrame ? activeHeight + (selectedPreset.type === 'desktop' ? 24 : 28) : activeHeight,
            }}
          >
            {/* Dynamic Island / Speaker Notch for Mobile with frame */}
            {showFrame && selectedPreset.type === 'mobile' && !isLandscape && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-end pr-2.5 gap-1.5 shadow-md">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              </div>
            )}

            {/* Embedded Responsive Application Iframe */}
            <div
              className={`overflow-hidden bg-white relative ${
                showFrame && selectedPreset.type === 'mobile'
                  ? 'rounded-[38px]'
                  : showFrame && selectedPreset.type === 'tablet'
                  ? 'rounded-[24px]'
                  : 'rounded-md'
              }`}
              style={{
                width: activeWidth,
                height: activeHeight,
              }}
            >
              <iframe
                key={iframeKey}
                src={previewUrl}
                title="Lyka Realty Device Simulator Preview"
                className="w-full h-full border-0 select-text"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>

            {/* Bottom Home Indicator Pill for Mobile */}
            {showFrame && selectedPreset.type === 'mobile' && !isLandscape && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 rounded-full z-30" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
