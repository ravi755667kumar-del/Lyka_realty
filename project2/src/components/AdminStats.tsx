import React, { useState } from 'react';
import { PropertyListing } from '../types/crm';
import {
  BarChart3,
  Building2,
  TrendingUp,
  TrendingDown,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  Home,
  DollarSign,
  User,
  Phone,
  BookmarkCheck,
  CheckCircle2
} from 'lucide-react';

interface AdminStatsProps {
  properties: PropertyListing[];
}

interface CommunityStats {
  community: string;
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  bookedCount: number;
  properties: PropertyListing[];
  types: Record<string, number>;
}

// 10 distinct colours for pie slices
const SLICE_COLORS = [
  '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6',
  '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#a78bfa',
];

// SVG Pie chart — pure React, zero dependencies
function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const [hovered, setHovered] = useState<number | null>(null);

  let cumAngle = -Math.PI / 2; // start at 12 o'clock
  const paths: { d: string; color: string; label: string; pct: number; midAngle: number }[] = [];

  for (let i = 0; i < slices.length; i++) {
    const sl = slices[i];
    const angle = (sl.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    const midAngle = startAngle + angle / 2;

    const R = 90; // outer radius
    const x1 = 100 + R * Math.cos(startAngle);
    const y1 = 100 + R * Math.sin(startAngle);
    const x2 = 100 + R * Math.cos(endAngle);
    const y2 = 100 + R * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = `M 100 100 L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const pct = Math.round((sl.value / total) * 100);

    paths.push({ d, color: sl.color, label: sl.label, pct, midAngle });
    cumAngle = endAngle;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG pie */}
      <svg viewBox="0 0 200 200" className="w-48 h-48 flex-shrink-0 drop-shadow-xl">
        {paths.map((p, i) => {
          const isHov = hovered === i;
          const scale = isHov ? 1.07 : 1;
          return (
            <path
              key={i}
              d={p.d}
              fill={p.color}
              stroke="#0f172a"
              strokeWidth="2"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: '100px 100px',
                transition: 'transform 0.2s ease',
                cursor: 'pointer',
                filter: isHov ? `drop-shadow(0 0 6px ${p.color})` : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {/* Centre hole */}
        <circle cx="100" cy="100" r="38" fill="#0f172a" />
        {/* Centre label */}
        {hovered !== null ? (
          <>
            <text x="100" y="96" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
              {paths[hovered].pct}%
            </text>
            <text x="100" y="110" textAnchor="middle" fill="#94a3b8" fontSize="7">
              {paths[hovered].label.length > 14
                ? paths[hovered].label.slice(0, 13) + '…'
                : paths[hovered].label}
            </text>
          </>
        ) : (
          <>
            <text x="100" y="96" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
              {slices.reduce((s, sl) => s + sl.value, 0)}
            </text>
            <text x="100" y="111" textAnchor="middle" fill="#94a3b8" fontSize="8">
              Properties
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-1.5 w-full">
        {paths.map((p, i) => (
          <div
            key={i}
            className={`flex items-center space-x-2 px-2 py-1 rounded-lg transition-colors cursor-default ${
              hovered === i ? 'bg-slate-800' : ''
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-[11px] text-slate-300 flex-1 truncate">{p.label}</span>
            <span className="text-[11px] font-bold text-[#1c1611] flex-shrink-0">{slices[i].value}</span>
            <span className="text-[10px] text-slate-400 flex-shrink-0 w-8 text-right">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AdminStats: React.FC<AdminStatsProps> = ({ properties }) => {
  const [expandedCommunity, setExpandedCommunity] = useState<string | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'count' | 'minPrice' | 'maxPrice' | 'avgPrice'>('count');
  const [timePeriod, setTimePeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');

  // ── Time period filtering ──────────────────────────────────────────────────────
  const now = new Date();
  const filteredProperties = (properties || []).filter(prop => {
    if (timePeriod === 'all') return true;
    const propDate = new Date(prop.updatedAt || prop.createdAt || now.toISOString());
    const diffMs = now.getTime() - propDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (timePeriod === 'week') return diffDays <= 7;
    if (timePeriod === 'month') return diffDays <= 30;
    if (timePeriod === 'year') return diffDays <= 365;
    return true;
  });

  // ── Community stats ──────────────────────────────────────────────────────────
  const statsMap: Record<string, CommunityStats> = {};
  for (const prop of filteredProperties) {
    const key = prop.community || 'Unknown';
    if (!statsMap[key]) {
      statsMap[key] = { community: key, count: 0, minPrice: Infinity, maxPrice: -Infinity, avgPrice: 0, bookedCount: 0, properties: [], types: {} };
    }
    const s = statsMap[key];
    const price = Number(prop.price_aed) || 0;
    s.count++;
    s.properties.push(prop);
    if (prop.is_booked || (prop.status || '').toLowerCase() === 'booked') {
      s.bookedCount++;
    }
    if (price > 0 && price < s.minPrice) s.minPrice = price;
    if (price > s.maxPrice) s.maxPrice = price;
    s.avgPrice += price;
    const pType = prop.property_type || 'Residential';
    s.types[pType] = (s.types[pType] || 0) + 1;
  }
  for (const key of Object.keys(statsMap)) {
    if (statsMap[key].minPrice === Infinity) statsMap[key].minPrice = 0;
    if (statsMap[key].maxPrice === -Infinity) statsMap[key].maxPrice = 0;
    statsMap[key].avgPrice = statsMap[key].count > 0 ? Math.round(statsMap[key].avgPrice / statsMap[key].count) : 0;
  }

  const statsList = Object.values(statsMap).sort((a, b) => {
    if (sortBy === 'count') return b.count - a.count;
    if (sortBy === 'minPrice') return a.minPrice - b.minPrice;
    if (sortBy === 'maxPrice') return b.maxPrice - a.maxPrice;
    return b.avgPrice - a.avgPrice;
  });

  // ── Contact / customer stats ──────────────────────────────────────────────────
  const contactMap: Record<string, { name: string; mobile: string; properties: PropertyListing[] }> = {};
  for (const prop of filteredProperties) {
    const name = (prop as any).contact_name || 'Unassigned';
    const mobile = (prop as any).contact_mobile || '—';
    if (!contactMap[name]) contactMap[name] = { name, mobile, properties: [] };
    contactMap[name].properties.push(prop);
  }
  const contactList = Object.values(contactMap).sort((a, b) => b.properties.length - a.properties.length);

  // ── Pie slices ────────────────────────────────────────────────────────────────
  const communitySlices = statsList.map((s, i) => ({
    label: s.community,
    value: s.count,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));

  const contactSlices = contactList.map((c, i) => ({
    label: c.name,
    value: c.properties.length,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : `AED ${n.toLocaleString()}`;

  const filteredTotal = filteredProperties.length;
  const validPrices = filteredProperties.map(p => Number(p.price_aed) || 0).filter(p => p > 0);
  const overallMin = validPrices.length ? Math.min(...validPrices) : 0;
  const overallMax = validPrices.length ? Math.max(...validPrices) : 0;
  const overallAvg = validPrices.length ? Math.round(validPrices.reduce((s, p) => s + p, 0) / validPrices.length) : 0;
  const maxCount = Math.max(...statsList.map(s => s.count), 1);

  // Booking metrics
  const bookedList = filteredProperties.filter(p => p.is_booked || (p.status || '').toLowerCase() === 'booked');
  const bookedCount = bookedList.length;
  const availableCount = filteredTotal - bookedCount;
  const bookedValue = bookedList.reduce((sum, p) => sum + (Number(p.price_aed) || 0), 0);

  // Time period label
  const periodLabel = timePeriod === 'all' ? 'All Time' : timePeriod === 'week' ? 'Last 7 Days' : timePeriod === 'month' ? 'Last 30 Days' : 'Last 365 Days';

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 overflow-y-auto p-4 sm:p-6 space-y-6">

      {/* Header with Time Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1c1611]">Property Statistics Dashboard</h2>
            <p className="text-xs text-slate-400">Live breakdown of inventory, pricing, community distribution & bookings</p>
          </div>
        </div>
        {/* Time Period Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 hidden sm:block">Period:</span>
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            {(['all', 'week', 'month', 'year'] as const).map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  timePeriod === period
                    ? 'bg-amber-500 text-amber-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {period === 'all' ? 'All' : period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline">({periodLabel})</span>
        </div>
      </div>

      {/* KPI Cards — 6 Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Listings</p>
          <p className="text-xl font-bold text-slate-300">{filteredTotal}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Available</p>
          <p className="text-xl font-bold text-emerald-300">{availableCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
            <BookmarkCheck className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Booked / Assigned</p>
          <p className="text-xl font-bold text-amber-300">{bookedCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
            <MapPin className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Communities</p>
          <p className="text-xl font-bold text-slate-300">{statsList.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-500/10 border border-teal-500/20">
            <TrendingDown className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Min Price</p>
          <p className="text-sm font-bold text-teal-300">{fmt(overallMin)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-500/10 border border-rose-500/20">
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Max Price</p>
          <p className="text-sm font-bold text-rose-300">{fmt(overallMax)}</p>
        </div>
      </div>

      {/* Avg price & Booked value banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Average Listing Price</p>
            <p className="text-xl font-extrabold text-amber-400">{fmt(overallAvg)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across {filteredTotal} listings in Dubai & Mumbai</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <BookmarkCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Total Booked Inventory Value</p>
            <p className="text-xl font-extrabold text-emerald-400">{fmt(bookedValue)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{bookedCount} of {filteredTotal} listings secured ({filteredTotal > 0 ? Math.round((bookedCount / filteredTotal) * 100) : 0}% converted)</p>
          </div>
        </div>
      </div>

      {/* ── PIE CHARTS SECTION ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie 1 — By Community */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-300">Properties by Community</h3>
          </div>
          {communitySlices.length > 0
            ? <PieChart slices={communitySlices} />
            : <p className="text-xs text-slate-500 text-center py-8">No property data available</p>
          }
        </div>

        {/* Pie 2 — By Contact / Broker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-slate-300">Properties by Assigned Contact</h3>
          </div>
          {contactSlices.length > 0
            ? <PieChart slices={contactSlices} />
            : <p className="text-xs text-slate-500 text-center py-8">No contact assignments recorded yet</p>
          }
        </div>
      </div>

      {/* ── COMMUNITY BAR TABLE ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Community Breakdown & Inventory Status</span>
          </h3>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Sort by:</span>
            {(['count', 'minPrice', 'maxPrice', 'avgPrice'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                  sortBy === opt
                    ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {opt === 'count' ? 'Count' : opt === 'minPrice' ? 'Min Price ↑' : opt === 'maxPrice' ? 'Max Price ↓' : 'Avg Price'}
              </button>
            ))}
          </div>
        </div>

        {statsList.map((stat, idx) => {
          const isExpanded = expandedCommunity === stat.community;
          const barPct = Math.round((stat.count / maxCount) * 100);
          const color = SLICE_COLORS[idx % SLICE_COLORS.length];

          return (
            <div key={stat.community} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-750 transition-colors">
              <button
                className="w-full text-left p-4 hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpandedCommunity(isExpanded ? null : stat.community)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-300">{stat.community}</h4>
                      <p className="text-[10px] text-slate-400">
                        {stat.count} listing{stat.count !== 1 ? 's' : ''} 
                        {stat.bookedCount > 0 && (
                          <span className="ml-1.5 text-amber-400 font-semibold">({stat.bookedCount} booked)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="hidden sm:flex items-center space-x-2 text-[11px]">
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md font-semibold">Min: {fmt(stat.minPrice)}</span>
                      <span className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md font-semibold">Max: {fmt(stat.maxPrice)}</span>
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md font-semibold">Avg: {fmt(stat.avgPrice)}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Bar */}
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${barPct}%`, background: color }} />
                  </div>
                  <span className="text-[10px] text-slate-400 w-10 text-right font-medium">{barPct}%</span>
                </div>

                {/* Type badges */}
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {Object.entries(stat.types).map(([type, cnt]) => (
                    <span key={type} className="text-[9px] bg-slate-800/80 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                      {type} ({cnt})
                    </span>
                  ))}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800 divide-y divide-slate-800/60 bg-slate-950/60">
                  {/* Mobile price pills */}
                  <div className="sm:hidden px-4 py-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md font-semibold">Min: {fmt(stat.minPrice)}</span>
                    <span className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md font-semibold">Max: {fmt(stat.maxPrice)}</span>
                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md font-semibold">Avg: {fmt(stat.avgPrice)}</span>
                  </div>

                  <div className="px-4 py-2 grid grid-cols-12 text-[9px] uppercase tracking-wider text-slate-400 bg-slate-900/60 font-semibold">
                    <span className="col-span-5">Property Title & ID</span>
                    <span className="col-span-2 text-center">Type</span>
                    <span className="col-span-2 text-center">Status</span>
                    <span className="col-span-3 text-right">Price</span>
                  </div>

                  {stat.properties.map((prop) => {
                    const isBooked = prop.is_booked || (prop.status || '').toLowerCase() === 'booked';
                    return (
                      <div key={prop.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-800/40 transition-colors">
                        <div className="col-span-5 flex items-center space-x-2 min-w-0">
                          <Home className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-300 truncate">{prop.title}</p>
                            <p className="text-[10px] text-slate-500">{prop.id} · {prop.bedrooms} Bed</p>
                          </div>
                        </div>
                        <span className="col-span-2 text-[10px] text-slate-300 text-center">{prop.property_type}</span>
                        <div className="col-span-2 text-center">
                          {isBooked ? (
                            <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Booked
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Available
                            </span>
                          )}
                        </div>
                        <div className="col-span-3 text-right">
                          <p className="text-xs font-bold text-amber-400">{fmt(Number(prop.price_aed) || 0)}</p>
                          {prop.assigned_to && (
                            <p className="text-[9px] text-slate-400 truncate">Assigned: {prop.assigned_to}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BY CONTACT SECTION ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
          <User className="w-4 h-4 text-violet-400" />
          <span>Properties by Assigned Contact</span>
        </h3>

        {contactList.map((contact, idx) => {
          const isExpanded = expandedContact === contact.name;
          const color = SLICE_COLORS[idx % SLICE_COLORS.length];

          return (
            <div key={contact.name} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-750 transition-colors">
              <button
                className="w-full text-left p-4 hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpandedContact(isExpanded ? null : contact.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 font-extrabold text-xs flex-shrink-0" style={{ background: color }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-300">{contact.name}</p>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{contact.mobile}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl border" style={{ color, borderColor: color + '40', background: color + '15' }}>
                      {contact.properties.length} {contact.properties.length === 1 ? 'property' : 'properties'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800 divide-y divide-slate-800/60 bg-slate-950/60">
                  <div className="px-4 py-2 grid grid-cols-12 text-[9px] uppercase tracking-wider text-slate-400 bg-slate-900/60 font-semibold">
                    <span className="col-span-5">Property</span>
                    <span className="col-span-3 text-center">Community</span>
                    <span className="col-span-4 text-right">Price</span>
                  </div>
                  {contact.properties.map((prop) => (
                    <div key={prop.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-800/40 transition-colors">
                      <div className="col-span-5 min-w-0 flex items-center space-x-2">
                        <Home className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-300 truncate">{prop.title}</p>
                      </div>
                      <span className="col-span-3 text-[10px] text-slate-300 text-center">{prop.community}</span>
                      <div className="col-span-4 text-right">
                        <p className="text-xs font-bold text-amber-400">{fmt(Number(prop.price_aed) || 0)}</p>
                        <p className="text-[9px] text-slate-400">{prop.bedrooms} Bed · {prop.property_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {properties.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No properties found. Add listings in the Dubai Properties tab.</p>
        </div>
      )}
    </div>
  );
};
