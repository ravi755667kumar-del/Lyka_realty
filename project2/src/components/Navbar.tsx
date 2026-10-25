import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Building2, 
  MessageSquare, 
  Kanban, 
  Database, 
  BookOpen, 
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Users,
  TrendingUp,
  LogOut,
  BookmarkCheck,
  Info,
  MoreVertical,
  Copy,
  AlertTriangle,
  Settings,
  Home,
  X,
  Heart
} from 'lucide-react';
import type { PropertyListing } from '../types/crm';

interface NavbarProps {
  activeTab: 'home' | 'chat' | 'crm' | 'properties' | 'knowledge' | 'stats' | 'customers' | 'login_stats' | 'assigned_properties' | 'sales_duplicates' | 'sales_missing_requirements';
  setActiveTab: (tab: 'home' | 'chat' | 'crm' | 'properties' | 'knowledge' | 'stats' | 'customers' | 'login_stats' | 'assigned_properties' | 'sales_duplicates' | 'sales_missing_requirements') => void;
  leadCount: number;
  customerCount?: number;
  propertyCount?: number;
  bookedPropertyCount?: number;
  duplicateCount?: number;
  missingRequirementsCount?: number;
  firestoreActive: boolean;
  vectorStatus?: { connected: boolean; count: number };
  onStartNewChat?: () => void;
  adminPanelOpen: boolean;
  onToggleAdminPanel: () => void;
  onSelectPortal?: (portal: 'admin' | 'property_manager' | 'sales_manager') => void;
  adminAuthenticated: boolean;
  propertyManagerAuthenticated: boolean;
  salesManagerAuthenticated?: boolean;
  adminTargetPortal: 'admin' | 'property_manager' | 'sales_manager';
  onAdminLogout: () => void;
  onOpenAbout: () => void;
  onOpenSettings?: () => void;
  properties?: PropertyListing[];
  selectedProperty?: PropertyListing | null;
  onSelectProperty?: (prop: PropertyListing | null) => void;
  favorites?: string[];
  onToggleFavorite?: (propertyId: string) => void;
  showFavoritesOnly?: boolean;
  onToggleFavoritesFilter?: () => void;
  selectedCity?: 'all' | 'Dubai' | 'Mumbai';
  onSelectCity?: (city: 'all' | 'Dubai' | 'Mumbai') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  leadCount,
  customerCount,
  propertyCount,
  bookedPropertyCount,
  duplicateCount,
  missingRequirementsCount,
  firestoreActive,
  vectorStatus,
  onStartNewChat,
  adminPanelOpen,
  onToggleAdminPanel,
  onSelectPortal,
  adminAuthenticated,
  propertyManagerAuthenticated,
  salesManagerAuthenticated,
  adminTargetPortal,
  onAdminLogout,
  onOpenAbout,
  onOpenSettings,
  properties,
  selectedProperty,
  onSelectProperty,
  favorites,
  onToggleFavorite,
  showFavoritesOnly,
  onToggleFavoritesFilter,
  selectedCity = 'all',
  onSelectCity,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [favoritesDropdownOpen, setFavoritesDropdownOpen] = useState(false);
  const [propertyCityFilter, setPropertyCityFilter] = useState<'all' | 'Dubai' | 'Mumbai'>(selectedCity || 'all');

  const propertyDropdownRef = useRef<HTMLDivElement>(null);
  const favoritesDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking anywhere outside or pressing Escape
  useEffect(() => {
    if (!propertyDropdownOpen && !favoritesDropdownOpen && !roleDropdownOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (propertyDropdownOpen && propertyDropdownRef.current && !propertyDropdownRef.current.contains(target)) {
        setPropertyDropdownOpen(false);
      }
      if (favoritesDropdownOpen && favoritesDropdownRef.current && !favoritesDropdownRef.current.contains(target)) {
        setFavoritesDropdownOpen(false);
      }
      if (roleDropdownOpen && roleDropdownRef.current && !roleDropdownRef.current.contains(target)) {
        setRoleDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPropertyDropdownOpen(false);
        setFavoritesDropdownOpen(false);
        setRoleDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [propertyDropdownOpen, favoritesDropdownOpen, roleDropdownOpen]);

  useEffect(() => {
    if (selectedCity) {
      setPropertyCityFilter(selectedCity);
    }
  }, [selectedCity]);

  const handleCityChange = (city: 'all' | 'Dubai' | 'Mumbai') => {
    setPropertyCityFilter(city);
    if (onSelectCity) {
      onSelectCity(city);
    }
  };

  const dubaiProperties = useMemo(() => {
    return (properties || []).filter(p => (p.city || 'Dubai') === 'Dubai');
  }, [properties]);

  const mumbaiProperties = useMemo(() => {
    return (properties || []).filter(p => (p.city || '').toLowerCase() === 'mumbai');
  }, [properties]);

  const filteredProperties = useMemo(() => {
    if (propertyCityFilter === 'Dubai') return dubaiProperties;
    if (propertyCityFilter === 'Mumbai') return mumbaiProperties;
    return properties || [];
  }, [properties, propertyCityFilter, dubaiProperties, mumbaiProperties]);
  const isAdminTab = ['crm', 'properties', 'knowledge', 'stats', 'customers', 'login_stats', 'assigned_properties', 'sales_duplicates', 'sales_missing_requirements'].includes(activeTab);

  // Triple-tap / triple-click counter to open Admin Panel
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);

  const handleTripleTap = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    tapCountRef.current += 1;
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onToggleAdminPanel();
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 1000);
    }
  };

  // Determine which portal is currently authenticated (Super Admin has access to all)
  const currentPortal = adminTargetPortal;
  const isPortalAuthed = currentPortal === 'admin' 
    ? adminAuthenticated 
    : currentPortal === 'property_manager'
    ? (propertyManagerAuthenticated || adminAuthenticated)
    : (Boolean(salesManagerAuthenticated) || adminAuthenticated);
  const isAnyAuthed = adminAuthenticated || propertyManagerAuthenticated || Boolean(salesManagerAuthenticated);

  return (
    <header className="bg-espresso-900/95 backdrop-blur-xl border-b border-amber-500/20 text-espresso-300 sticky top-0 z-50 select-none shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-4 w-full">
          {/* Logo & Brand — Left (Supports triple-tap to open Admin) */}
          <div
            className="flex items-center cursor-pointer shrink-0"
            onClick={() => {
              handleTripleTap();
              setActiveTab('home');
            }}
            title="Lyka Realty — Home (Triple-tap to open Admin)"
          >
            <img src="/logo.png" alt="Lyka Realty" className="h-8 sm:h-11 w-auto object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" />
          </div>

          {/* Center: Home + AI Chat tab — Luxury Floating Capsule Navigation */}
          <nav className="flex items-center p-1 rounded-2xl bg-espresso-800/80 backdrop-blur-md border border-espresso-700/80 shadow-lg shrink-0 gap-1 sm:gap-1.5">
            <button
              onClick={() => { setActiveTab('home'); }}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 font-bold shadow-[0_2px_12px_rgba(245,158,11,0.35)]'
                  : 'text-espresso-300 hover:text-white hover:bg-espresso-700/60'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Home</span>
            </button>
            <button
              onClick={() => { setActiveTab('chat'); }}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 font-bold shadow-[0_2px_12px_rgba(245,158,11,0.35)]'
                  : 'text-espresso-300 hover:text-white hover:bg-espresso-700/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-bold">Agentic AI Chat</span>
              <span className="inline md:hidden font-bold">AI Chat</span>
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">LIVE</span>
              </span>
            </button>
          </nav>

          {/* Right: Property Selector, Settings, About, and Admin Panel */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {/* Property Selector Dropdown — Choose a property from the inventory */}
            {properties && properties.length > 0 && (
              <div ref={propertyDropdownRef} className="relative flex-shrink-0">
                <button
                  onClick={() => setPropertyDropdownOpen(prev => !prev)}
                  className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                    selectedProperty
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400'
                      : propertyCityFilter !== 'all'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                      : 'bg-espresso-800/60 border-espresso-700/60 text-espresso-300 hover:text-white hover:bg-espresso-800 hover:border-amber-400/50'
                  }`}
                  title="Choose a property from inventory (Dubai or Mumbai)"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden md:inline max-w-[150px] lg:max-w-[185px] truncate">
                    {selectedProperty ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40">
                          {selectedProperty.city || 'Dubai'}
                        </span>
                        <span className="truncate">{selectedProperty.title}</span>
                      </span>
                    ) : propertyCityFilter === 'Mumbai' ? (
                      <span className="flex items-center gap-1">
                        <span>🌆</span> Mumbai
                      </span>
                    ) : propertyCityFilter === 'Dubai' ? (
                      <span className="flex items-center gap-1">
                        <span>🏙️</span> Dubai
                      </span>
                    ) : (
                      'Choose Property'
                    )}
                  </span>
                  {/* Compact badge on mobile/tablet */}
                  <span className="inline md:hidden text-[10px] font-bold text-amber-300 font-mono">
                    {selectedProperty
                      ? (selectedProperty.city === 'Mumbai' ? 'MUM' : 'DXB')
                      : propertyCityFilter === 'Mumbai' ? 'MUM' : propertyCityFilter === 'Dubai' ? 'DXB' : 'Units'}
                  </span>
                  <span className="hidden lg:inline text-[9px] opacity-75 font-mono">
                    {selectedProperty
                      ? `${selectedProperty.bedrooms ?? '?'} BR`
                      : propertyCityFilter !== 'all'
                      ? `${filteredProperties.length} units`
                      : 'Select'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${propertyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Property Dropdown Menu */}
                {propertyDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs sm:bg-transparent" 
                      onClick={() => setPropertyDropdownOpen(false)} 
                    />
                    <div className="fixed sm:absolute top-16 sm:top-full left-2 right-2 sm:left-auto sm:right-0 sm:w-92 max-w-sm mx-auto sm:mx-0 max-h-[82vh] sm:max-h-[30rem] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2 text-slate-100 backdrop-blur-xl">
                      {/* Dropdown Header */}
                      <div className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Choose Property</span>
                        </span>
                        <span className="text-[9px] normal-case font-medium text-slate-400">
                          {filteredProperties.length} of {properties.length} available
                        </span>
                      </div>

                      {/* City Selector: Dubai or Mumbai or All */}
                      <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1 flex items-center justify-between">
                          <span>Filter City:</span>
                          <span className="text-amber-400 font-semibold">
                            {propertyCityFilter === 'all' ? 'All Cities' : propertyCityFilter}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => handleCityChange('all')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                              propertyCityFilter === 'all'
                                ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900/60 text-slate-300 hover:text-slate-100 dark:hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            All ({properties.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCityChange('Dubai')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                              propertyCityFilter === 'Dubai'
                                ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900/60 text-slate-300 hover:text-slate-100 dark:hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <span>🏙️</span> Dubai ({dubaiProperties.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCityChange('Mumbai')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                              propertyCityFilter === 'Mumbai'
                                ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900/60 text-slate-300 hover:text-slate-100 dark:hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <span>🌆</span> Mumbai ({mumbaiProperties.length})
                          </button>
                        </div>
                      </div>

                      {/* City context banner */}
                      {propertyCityFilter === 'Mumbai' && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                          <span>Showing Mumbai residences</span>
                          <span className="font-bold text-[10px] text-amber-400">Worli · Bandra · Juhu</span>
                        </div>
                      )}
                      {propertyCityFilter === 'Dubai' && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-800 dark:text-sky-300 flex items-center justify-between">
                          <span>Showing Dubai residences</span>
                          <span className="font-bold text-[10px] text-sky-400">Marina · Downtown · Hills</span>
                        </div>
                      )}

                      {/* Clear selection option if a property is selected */}
                      {selectedProperty && (
                        <button
                          onClick={() => {
                            setPropertyDropdownOpen(false);
                            if (onSelectProperty) onSelectProperty(null);
                          }}
                          className="w-full text-left p-2 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-slate-100 dark:hover:text-white hover:border-slate-600 hover:bg-slate-800/60 transition-all flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" />
                            Clear selected property
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {selectedProperty.title}
                          </span>
                        </button>
                      )}

                      {/* Property List */}
                      <div className="max-h-64 overflow-y-auto pr-0.5 space-y-1.5">
                        {filteredProperties.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs">
                            No properties found for {propertyCityFilter}.
                          </div>
                        ) : (
                          filteredProperties.map((prop: PropertyListing) => {
                            const isActive = selectedProperty?.id === prop.id;
                            const isBooked = prop.is_booked || (prop.status || '').toLowerCase() === 'booked';
                            const isMumbai = (prop.city || '').toLowerCase() === 'mumbai';
                            const priceDisplay = isMumbai && prop.price_inr
                              ? `₹ ${(prop.price_inr / 10000000).toFixed(1)} Cr`
                              : `AED ${Number(prop.price_aed || 0).toLocaleString()}`;

                            return (
                              <button
                                key={prop.id}
                                onClick={() => {
                                  setPropertyDropdownOpen(false);
                                  if (onSelectProperty) onSelectProperty(prop);
                                }}
                                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 cursor-pointer ${
                                  isActive
                                    ? 'bg-amber-500/25 border-amber-500 text-amber-950 dark:text-white shadow-sm ring-1 ring-amber-500/40'
                                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:hover:text-white hover:border-slate-700'
                                }`}
                              >
                                <img
                                  src={prop.image_url}
                                  alt={prop.title}
                                  className="w-12 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-slate-100 dark:text-white truncate">{prop.title}</span>
                                    {isActive && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/30 text-amber-200 flex-shrink-0">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold font-mono">
                                      {priceDisplay}
                                    </p>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                      isMumbai ? 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30' : 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30'
                                    }`}>
                                      {prop.city || 'Dubai'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {prop.community || 'Prime'} • {prop.bedrooms ?? '?'} BR • {prop.property_type || 'Residence'}
                                  </p>
                                </div>
                                {isBooked && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-center flex-shrink-0">
                                    Booked
                                  </span>
                                )}
                                <Heart
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleFavorite) onToggleFavorite(prop.id);
                                  }}
                                  className={`w-4 h-4 self-center mt-0.5 cursor-pointer flex-shrink-0 ${favorites?.includes(prop.id) ? 'text-red-400 fill-red-400' : 'text-slate-500 hover:text-white'}`}
                                />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Favorites Button & Dropdown */}
            <div ref={favoritesDropdownRef} className="relative flex-shrink-0">
              <button
                onClick={() => {
                  if (onToggleFavoritesFilter) {
                    onToggleFavoritesFilter();
                  } else {
                    setFavoritesDropdownOpen(prev => !prev);
                  }
                }}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                  showFavoritesOnly
                    ? 'bg-red-500/25 border-red-500/80 text-red-400 ring-2 ring-red-500/40 shadow-md shadow-red-500/20'
                    : favorites && favorites.length > 0
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400'
                    : 'bg-espresso-800/60 border-espresso-700/60 text-espresso-300 hover:text-white hover:bg-espresso-800 hover:border-amber-400/50'
                }`}
                title={`Favorites (${favorites?.length || 0}) — Click to view your saved residences`}
                aria-label="Favorites"
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'text-red-400 fill-red-400' : favorites && favorites.length > 0 ? 'text-red-400 fill-red-400' : 'text-espresso-300'}`} />
                <span className="hidden sm:inline">Favorites</span>
                {favorites && favorites.length > 0 && (
                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-xs ${
                    showFavoritesOnly ? 'bg-red-500 text-white' : 'bg-red-500/25 text-red-400 border border-red-500/40'
                  }`}>
                    {favorites.length}
                  </span>
                )}
              </button>

              {/* Favorites Dropdown */}
              {favoritesDropdownOpen && favorites && favorites.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs sm:bg-transparent" 
                    onClick={() => setFavoritesDropdownOpen(false)} 
                  />
                  <div className="fixed sm:absolute top-16 sm:top-full left-2 right-2 sm:left-auto sm:right-0 sm:w-80 max-w-sm mx-auto sm:mx-0 max-h-[82vh] sm:max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-1.5 text-slate-100 backdrop-blur-xl">
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Favorite Properties
                    </div>
                    <div className="max-h-72 overflow-y-auto pr-0.5 space-y-1.5">
                      {properties?.filter((p: PropertyListing) => (favorites || []).includes(p.id)).map((prop: PropertyListing) => (
                        <button
                          key={prop.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavoritesDropdownOpen(false);
                            if (onToggleFavorite) onToggleFavorite(prop.id);
                          }}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:hover:text-white transition-all flex items-start space-x-2.5 cursor-pointer"
                        >
                          <img
                            src={prop.image_url}
                            alt={prop.title}
                            className="w-11 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-100 dark:text-white truncate block">{prop.title}</span>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                              AED {Number(prop.price_aed || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {prop.community || 'Dubai'} • {prop.bedrooms ?? '?'} BR
                            </p>
                          </div>
                          <Heart
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleFavorite) onToggleFavorite(prop.id);
                            }}
                            className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5 cursor-pointer"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {favoritesDropdownOpen && favorites && favorites.length === 0 && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setFavoritesDropdownOpen(false)} />
              )}
            </div>

            {/* Settings (⚙️) Button */}
            <button
              onClick={onOpenSettings}
              className="group flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-espresso-200 hover:text-amber-300 hover:bg-espresso-800/90 border border-espresso-700/70 hover:border-amber-400/50 transition-all duration-200 shadow-sm cursor-pointer"
              title="Settings & Preferences (Background, Admin, AI Engine)"
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition-transform duration-300 shrink-0" />
              <span className="hidden md:inline">Settings</span>
            </button>
            <button
              onClick={onOpenAbout}
              className="hidden sm:flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-espresso-200 hover:text-amber-300 hover:bg-espresso-800/90 border border-espresso-700/70 hover:border-amber-400/50 transition-all duration-200 shadow-sm cursor-pointer"
              title="Learn about Lyka Realty"
            >
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden md:inline">About</span>
            </button>

            {/* Triple Tab / Dot Button — Click to open Admin Panel */}
            <button
              onClick={() => onToggleAdminPanel()}
              className={`p-2 rounded-xl text-xs transition-all duration-200 border shadow-sm cursor-pointer ${
                adminPanelOpen || isAdminTab
                  ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.35)]'
                  : isAnyAuthed
                  ? 'text-violet-300 hover:text-violet-100 hover:bg-espresso-800 border-violet-500/40 bg-espresso-800/60'
                  : 'text-espresso-400 hover:text-espresso-200 hover:bg-espresso-800 border-espresso-700/60'
              }`}
              title="Admin Panel"
              aria-label="Admin Panel"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Admin & Property Manager Sub-nav — visible when Admin Panel is open */}
      {(adminPanelOpen || isAdminTab) && isPortalAuthed && (
        <div className="border-t border-violet-500/30 bg-espresso-900/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 flex items-center space-x-3 overflow-x-auto py-2">
            {/* Downside Role Dropdown Selector — Kept inside admin */}
            <div ref={roleDropdownRef} className="relative flex-shrink-0 mr-1">
              <button
                onClick={() => setRoleDropdownOpen(prev => !prev)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  adminTargetPortal === 'admin'
                    ? 'bg-violet-600/30 border-violet-500/60 text-violet-200 hover:bg-violet-600/40 hover:border-violet-400'
                    : adminTargetPortal === 'property_manager'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400'
                    : 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/40 hover:border-emerald-400'
                }`}
                title="Choose Admin, Property Admin, or Sales Manager"
              >
                {adminTargetPortal === 'admin' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                    <span>Admin</span>
                    {leadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-violet-950/60 text-violet-200">
                        {leadCount}
                      </span>
                    )}
                  </>
                ) : adminTargetPortal === 'property_manager' ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Property Admin</span>
                    {propertyCount !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-950/40 text-amber-950">
                        {propertyCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sales Manager</span>
                    {duplicateCount !== undefined && duplicateCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-900/60 text-rose-200">
                        {duplicateCount}
                      </span>
                    )}
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Downside Dropdown Menu */}
              {roleDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setRoleDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-1.5 text-slate-100 backdrop-blur-xl">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Choose Option
                    </div>

                    {/* Option 1: Admin */}
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        if (onSelectPortal) onSelectPortal('admin');
                        setActiveTab('crm');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                        adminTargetPortal === 'admin'
                          ? 'bg-violet-600/25 border-violet-500 text-violet-900 dark:text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-100 dark:text-white">Admin</span>
                          {adminTargetPortal === 'admin' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-violet-500/30 text-violet-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">CRM Pipeline, Knowledge & Analytics</p>
                      </div>
                    </button>

                    {/* Option 2: Property Admin */}
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        if (onSelectPortal) onSelectPortal('property_manager');
                        setActiveTab('properties');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                        adminTargetPortal === 'property_manager'
                          ? 'bg-amber-500/25 border-amber-500 text-amber-950 dark:text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-100 dark:text-white">Property Admin</span>
                          {adminTargetPortal === 'property_manager' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/30 text-amber-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Dubai Properties & Inventory</p>
                      </div>
                    </button>

                    {/* Option 3: Sales Manager */}
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        if (onSelectPortal) onSelectPortal('sales_manager');
                        setActiveTab('sales_duplicates');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                        adminTargetPortal === 'sales_manager'
                          ? 'bg-emerald-600/25 border-emerald-500 text-emerald-900 dark:text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:hover:text-white'
                      }`}
                    >
                      <Copy className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-100 dark:text-white">Sales Manager</span>
                          {adminTargetPortal === 'sales_manager' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/30 text-emerald-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Duplicate Control & Quality Audit</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-espresso-700/60 mx-1 flex-shrink-0" />

            {adminTargetPortal === 'admin' && (
              // Admin Portal Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('crm')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'crm'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>CRM Pipeline</span>
                  {leadCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'crm' ? 'bg-espresso-800/25 text-espresso-300' : 'bg-violet-500/30 text-violet-200'
                    }`}>
                      {leadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'knowledge'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Knowledge Base</span>
                </button>

                <button
                  onClick={() => setActiveTab('customers')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'customers'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Customer Profiles</span>
                  {customerCount !== undefined && customerCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'customers' ? 'bg-amber-900/30 text-amber-950' : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {customerCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('login_stats')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'login_stats'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Login Trends</span>
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'stats'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Property Stats</span>
                </button>

                <button
                  onClick={() => setActiveTab('properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Dubai Properties</span>
                </button>

                <button
                  onClick={() => setActiveTab('assigned_properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'assigned_properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Assign / Bookings</span>
                  {bookedPropertyCount !== undefined && bookedPropertyCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'assigned_properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {bookedPropertyCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {adminTargetPortal === 'property_manager' && (
              // Property Admin Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Dubai Properties</span>
                  {propertyCount !== undefined && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {propertyCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('assigned_properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'assigned_properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Assign / Bookings</span>
                  {bookedPropertyCount !== undefined && bookedPropertyCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'assigned_properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {bookedPropertyCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'stats'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Property Stats</span>
                </button>
              </div>
            )}

            {adminTargetPortal === 'sales_manager' && (
              // Sales Manager Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('sales_duplicates')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'sales_duplicates'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate Properties</span>
                  {duplicateCount !== undefined && duplicateCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'sales_duplicates' ? 'bg-emerald-950/40 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
                    }`}>
                      {duplicateCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('sales_missing_requirements')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'sales_missing_requirements'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing Requirements</span>
                  {missingRequirementsCount !== undefined && missingRequirementsCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'sales_missing_requirements' ? 'bg-emerald-950/40 text-emerald-200' : 'bg-amber-500/30 text-amber-200'
                    }`}>
                      {missingRequirementsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Dubai Properties</span>
                </button>
              </div>
            )}

            {/* Downside Right Actions: Logout and Back to Chat */}
            <div className="ml-auto flex items-center space-x-2 flex-shrink-0 pl-3">
              <button
                onClick={onAdminLogout}
                className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/50 text-red-300 hover:border-red-400 transition-all"
                title="Logout from Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('chat');
                  onToggleAdminPanel();
                }}
                className="text-xs text-espresso-400 hover:text-espresso-200 px-2.5 py-1.5 rounded-lg hover:bg-espresso-800 border border-espresso-700/60 transition-colors"
                title="Back to AI Chat"
              >
                Back to Chat ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile nav — only when NOT in Admin Sub-nav */}
      {!((adminPanelOpen || isAdminTab) && isPortalAuthed) && isAnyAuthed && (
        <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 bg-espresso-900 border-t border-espresso-700 text-xs">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${
            activeTab === 'chat' ? 'bg-amber-500 text-amber-950' : 'text-espresso-400'
          }`}
        >
          AI Chat
        </button>
        {/* Duplicate About button removed - already visible in top header bar */}
        {isAnyAuthed ? (
          <>
            <button
              onClick={() => {
                if (onSelectPortal) onSelectPortal('admin');
                setActiveTab('crm');
              }}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                (adminPanelOpen || isAdminTab) && adminTargetPortal === 'admin'
                  ? 'bg-violet-600 text-white border-violet-500'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => {
                if (onSelectPortal) onSelectPortal('property_manager');
                setActiveTab('properties');
              }}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                (adminPanelOpen || isAdminTab) && adminTargetPortal === 'property_manager'
                  ? 'bg-amber-500 text-amber-950 border-amber-400'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Property Admin
            </button>
            <button
              onClick={() => {
                if (onSelectPortal) onSelectPortal('sales_manager');
                setActiveTab('sales_duplicates');
              }}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                (adminPanelOpen || isAdminTab) && adminTargetPortal === 'sales_manager'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Sales Manager
            </button>
            <button
              onClick={() => setActiveTab('assigned_properties')}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                activeTab === 'assigned_properties'
                  ? 'bg-amber-500 text-amber-950 border-amber-400'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Assign
            </button>
            <button
              onClick={onAdminLogout}
              className="px-2.5 py-1.5 rounded-md whitespace-nowrap font-medium border border-red-500/40 text-red-300"
            >
              Logout
            </button>
            {/* Cut / Close button in upside mobile sub-nav */}
            <button
              onClick={() => onToggleAdminPanel()}
              className="px-2.5 py-1.5 rounded-md whitespace-nowrap font-bold border border-espresso-600 text-espresso-300 hover:text-white hover:bg-espresso-800 ml-auto flex items-center space-x-1"
              title="Close admin menu"
            >
              <span>✕</span>
              <span>Cut</span>
            </button>
          </>
        ) : null}
      </div>
      )}
    </header>
  );
};
