import { csvCell, downloadCSV } from '../lib/csv';
import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Search, 
  RefreshCw, 
  Building2, 
  Calendar, 
  ExternalLink, 
  Trash2, 
  Download, 
  User, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Coins, 
  TrendingUp, 
  CheckCircle2, 
  Filter, 
  Grid, 
  List,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { FavoritePropertyRecord, PropertyListing } from '../types/crm';

interface AdminFavoritesViewProps {
  favorites: FavoritePropertyRecord[];
  properties: PropertyListing[];
  onRefresh: () => Promise<void> | void;
  onSelectProperty?: (property: PropertyListing) => void;
  onRemoveFavorite?: (favoriteId: string) => Promise<void> | void;
}

type UserTypeFilter = 'all' | 'registered' | 'guest';
type CityFilter = 'all' | 'Dubai' | 'Mumbai';
type SortOption = 'recent' | 'price_high' | 'price_low' | 'title';
type ViewMode = 'table' | 'grid';

export const AdminFavoritesView: React.FC<AdminFavoritesViewProps> = ({
  favorites,
  properties,
  onRefresh,
  onSelectProperty,
  onRemoveFavorite
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [userFilter, setUserFilter] = useState<UserTypeFilter>('all');
  const [cityFilter, setCityFilter] = useState<CityFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Helper to format date & relative time
  const formatDateTime = (ts?: string) => {
    if (!ts) return 'Unknown';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  const getTimeAgo = (ts?: string) => {
    if (!ts) return '';
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return `${Math.floor(diffDays / 30)}mo ago`;
    } catch {
      return '';
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = favorites.length;
    const uniqueProps = new Set(favorites.map(f => f.property_id)).size;
    const guestCount = favorites.filter(f => f.is_guest).length;
    const registeredCount = total - guestCount;
    const totalPipelineValue = favorites.reduce((sum, f) => sum + (Number(f.property_price_aed) || 0), 0);

    // Calculate most saved property
    const propCountMap: Record<string, { title: string; count: number }> = {};
    favorites.forEach(f => {
      if (!propCountMap[f.property_id]) {
        propCountMap[f.property_id] = { title: f.property_title, count: 0 };
      }
      propCountMap[f.property_id].count += 1;
    });

    let topProp = { title: 'None yet', count: 0 };
    Object.values(propCountMap).forEach(item => {
      if (item.count > topProp.count) {
        topProp = item;
      }
    });

    return {
      total,
      uniqueProps,
      guestCount,
      registeredCount,
      totalPipelineValue,
      topProp
    };
  }, [favorites]);

  // Filtered & Sorted List
  const filteredFavorites = useMemo(() => {
    return favorites
      .filter(item => {
        // User type filter
        if (userFilter === 'registered' && item.is_guest) return false;
        if (userFilter === 'guest' && !item.is_guest) return false;

        // City filter
        if (cityFilter !== 'all') {
          const itemCity = (item.property_city || 'Dubai').toLowerCase();
          if (itemCity !== cityFilter.toLowerCase()) return false;
        }

        // Search filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchTitle = (item.property_title || '').toLowerCase().includes(q);
          const matchCommunity = (item.property_community || '').toLowerCase().includes(q);
          const matchName = (item.user_name || '').toLowerCase().includes(q);
          const matchEmail = (item.user_email || '').toLowerCase().includes(q);
          const matchId = (item.property_id || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCommunity && !matchName && !matchEmail && !matchId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'recent') {
          return new Date(b.saved_at || 0).getTime() - new Date(a.saved_at || 0).getTime();
        }
        if (sortOption === 'price_high') {
          return (Number(b.property_price_aed) || 0) - (Number(a.property_price_aed) || 0);
        }
        if (sortOption === 'price_low') {
          return (Number(a.property_price_aed) || 0) - (Number(b.property_price_aed) || 0);
        }
        if (sortOption === 'title') {
          return (a.property_title || '').localeCompare(b.property_title || '');
        }
        return 0;
      });
  }, [favorites, userFilter, cityFilter, searchTerm, sortOption]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredFavorites.length === 0) {
      alert("No favorites records found to export.");
      return;
    }
    const headers = ['Record ID', 'Property ID', 'Property Title', 'Community', 'City', 'Price (AED)', 'Customer Name', 'Customer Email', 'Customer Type', 'Saved At'];
    const rows = filteredFavorites.map(f => [
      f.id,
      f.property_id,
      f.property_title,
      f.property_community,
      f.property_city || 'Dubai',
      f.property_price_aed,
      f.user_name,
      f.user_email,
      f.is_guest ? 'Guest' : 'Registered Client',
      f.saved_at
    ].map(csvCell));

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const ok = downloadCSV("customer_favorites_export_" + dateStr + ".csv", csvContent);
    if (ok) {
      setIsExporting(true);
      setTimeout(() => setIsExporting(false), 2500);
    }
  };

  const handleInspect = (propertyId: string) => {
    const found = properties.find(p => p.id === propertyId);
    if (found && onSelectProperty) {
      onSelectProperty(found);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 space-y-6">
      
      {/* ─── 1. TOP HEADER ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Customer Favorites & Wishlists
                </h1>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Firestore DB Live Sync</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Real-time stream of properties saved by clients and guest visitors. Identify high-interest residences and convert intent into bookings.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredFavorites.length === 0}
            className={`flex items-center space-x-1.5 font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isExporting
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500 hover:bg-amber-400 text-amber-950'
            }`}
            title="Export filtered records to CSV"
          >
            {isExporting ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── 2. KPI METRICS CARDS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Favorites */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Saved</span>
            <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Heart className="w-3.5 h-3.5 fill-current" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-white">{metrics.total}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Active wishlist records</p>
          </div>
        </div>

        {/* Unique Properties */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Unique Homes</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-400">{metrics.uniqueProps}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Distinct properties favored</p>
          </div>
        </div>

        {/* Registered vs Guests */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">User Mix</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-slate-200">
              <span className="text-emerald-400">{metrics.registeredCount}</span> Clients · <span className="text-amber-400">{metrics.guestCount}</span> Guests
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Registered vs guest devices</p>
          </div>
        </div>

        {/* Pipeline Wishlist Value */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pipeline Value</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-black text-emerald-400 truncate">
              AED {(metrics.totalPipelineValue / 1_000_000).toFixed(1)}M
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Total favorited inventory</p>
          </div>
        </div>

        {/* Top Residence */}
        <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Most Wanted</span>
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xs font-bold text-slate-200 truncate" title={metrics.topProp.title}>
              {metrics.topProp.title}
            </div>
            <p className="text-[10px] text-violet-400 font-semibold mt-0.5">
              {metrics.topProp.count > 0 ? `${metrics.topProp.count} bookmarks` : 'No bookmarks yet'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. FILTERS & SEARCH BAR ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by property, community, user name, or email..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* User Type */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setUserFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                userFilter === 'all' ? 'bg-amber-500 text-amber-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({favorites.length})
            </button>
            <button
              type="button"
              onClick={() => setUserFilter('registered')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                userFilter === 'registered' ? 'bg-amber-500 text-amber-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Clients ({metrics.registeredCount})
            </button>
            <button
              type="button"
              onClick={() => setUserFilter('guest')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                userFilter === 'guest' ? 'bg-amber-500 text-amber-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Guests ({metrics.guestCount})
            </button>
          </div>

          {/* City */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value as CityFilter)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Cities</option>
            <option value="Dubai">Dubai</option>
            <option value="Mumbai">Mumbai</option>
          </select>

          {/* Sort */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="price_high">Price: High to Low</option>
            <option value="price_low">Price: Low to High</option>
            <option value="title">Property Title A-Z</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Grid card view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4. LIST / TABLE CONTENT ─── */}
      {filteredFavorites.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">No Favorite Records Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || userFilter !== 'all' || cityFilter !== 'all'
              ? 'No records match your active search and filter criteria. Try adjusting your filters above.'
              : 'When visitors or clients save residences using the heart icon, they are stored directly in Firebase Firestore and will automatically show here in real-time.'}
          </p>
          {(searchTerm || userFilter !== 'all' || cityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setUserFilter('all');
                setCityFilter('all');
              }}
              className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer mt-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Property</th>
                  <th className="py-3 px-4">Location & Specs</th>
                  <th className="py-3 px-4">Asking Price</th>
                  <th className="py-3 px-4">Saved By Customer</th>
                  <th className="py-3 px-4">Saved Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFavorites.map((fav) => (
                  <tr key={fav.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Property Thumbnail & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={fav.property_image_url || '/logo.png'}
                          alt={fav.property_title}
                          className="w-12 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <span className="font-bold text-slate-100 truncate block text-xs">
                            {fav.property_title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {fav.property_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Location & Specs */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            (fav.property_city || 'Dubai').toLowerCase() === 'mumbai'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}>
                            {fav.property_city || 'Dubai'}
                          </span>
                          <span className="font-semibold text-slate-300 truncate max-w-[140px]">
                            {fav.property_community}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {fav.property_bedrooms ? `${fav.property_bedrooms} BR` : 'Residence'} · {fav.property_type || 'Luxury'}
                        </p>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-amber-400">
                          AED {Number(fav.property_price_aed || 0).toLocaleString()}
                        </div>
                        {fav.property_price_inr && (
                          <div className="text-[10px] text-slate-400">
                            ₹ {(fav.property_price_inr / 10_000_000).toFixed(2)} Cr
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5 max-w-[200px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-200 truncate">
                            {fav.user_name || 'Guest User'}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                            fav.is_guest
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {fav.is_guest ? 'Guest' : 'Verified'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate" title={fav.user_email}>
                          {fav.user_email}
                        </p>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="text-slate-200 font-medium text-[11px]">
                          {formatDateTime(fav.saved_at)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {getTimeAgo(fav.saved_at)}
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleInspect(fav.property_id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                          title="Inspect residence specifications & schedule viewing"
                        >
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                          <span>View</span>
                        </button>

                        {deleteConfirmId === fav.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (onRemoveFavorite) await onRemoveFavorite(fav.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(fav.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Remove favorite record from database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFavorites.map((fav) => (
            <div
              key={fav.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col shadow-sm group"
            >
              {/* Image banner */}
              <div className="relative h-40 overflow-hidden">
                <img
                  src={fav.property_image_url || '/logo.png'}
                  alt={fav.property_title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                />
                <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm ${
                    (fav.property_city || 'Dubai').toLowerCase() === 'mumbai'
                      ? 'bg-orange-500 text-white'
                      : 'bg-sky-600 text-white'
                  }`}>
                    {fav.property_city || 'Dubai'}
                  </span>
                  <span className="bg-slate-900/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-semibold text-amber-400 border border-slate-700">
                    {fav.property_community}
                  </span>
                </div>

                <div className="absolute top-2.5 right-2.5 bg-red-500 text-white p-1 rounded-full shadow-md">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-amber-400">
                      AED {Number(fav.property_price_aed || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">{fav.property_bedrooms} BR</span>
                  </div>
                  <h4 className="font-bold text-slate-100 text-sm line-clamp-1 mt-1">{fav.property_title}</h4>
                </div>

                {/* Customer footer */}
                <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Saved by:</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[130px]">{fav.user_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[10px]">{getTimeAgo(fav.saved_at)}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      fav.is_guest
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {fav.is_guest ? 'Guest Visitor' : 'Registered Client'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleInspect(fav.property_id)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Property</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onRemoveFavorite && confirm('Remove this favorite record from the database?')) {
                        await onRemoveFavorite(fav.id);
                      }
                    }}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition-colors cursor-pointer"
                    title="Delete record from database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
