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
              hovered === i ? 'bg-slate-100' : ''
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-[11px] text-slate-300 flex-1 truncate">{p.label}</span>
            <span className="text-[11px] font-bold text-slate-300 flex-shrink-0">{slices[i].value}</span>
            <span className="text-[10px] text-slate-500 flex-shrink-0 w-8 text-right">{p.pct}%</span>
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

  // ── Community stats ──────────────────────────────────────────────────────────
  const statsMap: Record<string, CommunityStats> = {};
  for (const prop of properties) {
    const key = prop.community || 'Unknown';
    if (!statsMap[key]) {
      statsMap[key] = { community: key, count: 0, minPrice: Infinity, maxPrice: -Infinity, avgPrice: 0, properties: [], types: {} };
    }
    const s = statsMap[key];
    s.count++;
    s.properties.push(prop);
    if (prop.price_aed < s.minPrice) s.minPrice = prop.price_aed;
    if (prop.price_aed > s.maxPrice) s.maxPrice = prop.price_aed;
    s.avgPrice += prop.price_aed;
    s.types[prop.property_type] = (s.types[prop.property_type] || 0) + 1;
  }
  for (const key of Object.keys(statsMap)) {
    statsMap[key].avgPrice = Math.round(statsMap[key].avgPrice / statsMap[key].count);
  }

  const statsList = Object.values(statsMap).sort((a, b) => {
    if (sortBy === 'count') return b.count - a.count;
    if (sortBy === 'minPrice') return a.minPrice - b.minPrice;
    if (sortBy === 'maxPrice') return b.maxPrice - a.maxPrice;
    return b.avgPrice - a.avgPrice;
  });

  // ── Contact / customer stats ──────────────────────────────────────────────────
  const contactMap: Record<string, { name: string; mobile: string; properties: PropertyListing[] }> = {};
  for (const prop of properties) {
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

  const totalProperties = properties.length;
  const overallMin = totalProperties ? Math.min(...properties.map(p => p.price_aed)) : 0;
  const overallMax = totalProperties ? Math.max(...properties.map(p => p.price_aed)) : 0;
  const overallAvg = totalProperties ? Math.round(properties.reduce((s, p) => s + p.price_aed, 0) / totalProperties) : 0;
  const maxCount = Math.max(...statsList.map(s => s.count), 1);

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 overflow-y-auto p-4 sm:p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-300">Property Statistics Dashboard</h2>
          <p className="text-xs text-slate-500">Live breakdown of all listings by community, price, and contact</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Properties', value: totalProperties.toString(), Icon: Building2, c: 'amber' },
          { label: 'Communities',      value: statsList.length.toString(), Icon: MapPin,     c: 'violet' },
          { label: 'Lowest Price',     value: fmt(overallMin),              Icon: TrendingDown, c: 'emerald' },
          { label: 'Highest Price',    value: fmt(overallMax),              Icon: TrendingUp,   c: 'rose' },
        ].map(({ label, value, Icon, c }) => (
          <div key={label} className="bg-white border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${c}-500/10 border border-${c}-500/20`}>
              <Icon className={`w-4 h-4 text-${c}-600`} />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-bold text-slate-300 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Avg price banner */}
      <div className="bg-white border border-slate-700 rounded-2xl p-4 flex items-center space-x-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <DollarSign className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Overall Average Listing Price</p>
          <p className="text-xl font-extrabold text-amber-600">{fmt(overallAvg)}</p>
        </div>
        <div className="ml-auto text-right hidden sm:block">
          <p className="text-[10px] text-slate-500">Price Range</p>
          <p className="text-xs font-semibold text-slate-300">{fmt(overallMin)} — {fmt(overallMax)}</p>
        </div>
      </div>

      {/* ── PIE CHARTS SECTION ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie 1 — By Community */}
        <div className="bg-white border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-300">Properties by Community</h3>
          </div>
          {communitySlices.length > 0
            ? <PieChart slices={communitySlices} />
            : <p className="text-xs text-slate-500 text-center py-8">No data yet</p>
          }
        </div>

        {/* Pie 2 — By Contact / Customer */}
        <div className="bg-white border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-300">Properties by Contact Person</h3>
          </div>
          {contactSlices.length > 0
            ? <PieChart slices={contactSlices} />
            : <p className="text-xs text-slate-500 text-center py-8">No contact data yet — add contact names when listing properties</p>
          }
        </div>
      </div>

      {/* ── COMMUNITY BAR TABLE ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Breakdown by Community</span>
          </h3>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Sort:</span>
            {(['count', 'minPrice', 'maxPrice', 'avgPrice'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                  sortBy === opt
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {opt === 'count' ? 'Most' : opt === 'minPrice' ? 'Min ↑' : opt === 'maxPrice' ? 'Max ↓' : 'Avg'}
              </button>
            ))}
          </div>
        </div>

        {statsList.map((stat, idx) => {
          const isExpanded = expandedCommunity === stat.community;
          const barPct = Math.round((stat.count / maxCount) * 100);
          const color = SLICE_COLORS[idx % SLICE_COLORS.length];

          return (
            <div key={stat.community} className="bg-white border border-slate-700 rounded-2xl overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedCommunity(isExpanded ? null : stat.community)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-300">{stat.community}</h4>
                      <p className="text-[10px] text-slate-500">{stat.count} listing{stat.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="hidden sm:flex items-center space-x-2 text-[11px]">
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded-md font-semibold">Min: {fmt(stat.minPrice)}</span>
                      <span className="bg-rose-500/10    border border-rose-500/20    text-rose-700    px-2 py-0.5 rounded-md font-semibold">Max: {fmt(stat.maxPrice)}</span>
                      <span className="bg-amber-500/10   border border-amber-500/20   text-amber-700   px-2 py-0.5 rounded-md font-semibold">Avg: {fmt(stat.avgPrice)}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Bar */}
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-10 text-right">{barPct}%</span>
                </div>

                {/* Type badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(stat.types).map(([type, cnt]) => (
                    <span key={type} className="text-[9px] bg-slate-100 border border-slate-300 text-slate-300 px-2 py-0.5 rounded-full">
                      {type} ({cnt})
                    </span>
                  ))}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 divide-y divide-slate-700">
                  {/* Mobile price pills */}
                  <div className="sm:hidden px-4 py-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded-md font-semibold">Min: {fmt(stat.minPrice)}</span>
                    <span className="bg-rose-500/10    border border-rose-500/20    text-rose-700    px-2 py-0.5 rounded-md font-semibold">Max: {fmt(stat.maxPrice)}</span>
                    <span className="bg-amber-500/10   border border-amber-500/20   text-amber-700   px-2 py-0.5 rounded-md font-semibold">Avg: {fmt(stat.avgPrice)}</span>
                  </div>

                  <div className="px-4 py-2 grid grid-cols-12 text-[9px] uppercase tracking-wider text-slate-500 bg-slate-100">
                    <span className="col-span-5">Property Name</span>
                    <span className="col-span-2 text-center">Type</span>
                    <span className="col-span-2 text-center">Beds</span>
                    <span className="col-span-3 text-right">Price</span>
                  </div>

                  {stat.properties.map((prop) => (
                    <div key={prop.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-50 transition-colors">
                      <div className="col-span-5 flex items-center space-x-2 min-w-0">
                        <Home className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-300 truncate">{prop.title}</p>
                          <p className="text-[10px] text-slate-500">{prop.id}</p>
                        </div>
                      </div>
                      <span className="col-span-2 text-[10px] text-slate-400 text-center">{prop.property_type}</span>
                      <span className="col-span-2 text-[10px] text-slate-400 text-center">{prop.bedrooms}</span>
                      <div className="col-span-3 text-right">
                        <p className="text-xs font-bold text-amber-600">{fmt(prop.price_aed)}</p>
                        <p className="text-[9px] text-slate-500">{prop.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BY CONTACT SECTION ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
          <User className="w-4 h-4 text-violet-600" />
          <span>Properties by Contact Person</span>
        </h3>

        {contactList.map((contact, idx) => {
          const isExpanded = expandedContact === contact.name;
          const color = SLICE_COLORS[idx % SLICE_COLORS.length];

          return (
            <div key={contact.name} className="bg-white border border-slate-700 rounded-2xl overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedContact(isExpanded ? null : contact.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-900 font-extrabold text-xs flex-shrink-0" style={{ background: color }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-300">{contact.name}</p>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500">
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
                <div className="border-t border-slate-700 divide-y divide-slate-700">
                  <div className="px-4 py-2 grid grid-cols-12 text-[9px] uppercase tracking-wider text-slate-500 bg-slate-100">
                    <span className="col-span-5">Property</span>
                    <span className="col-span-3 text-center">Community</span>
                    <span className="col-span-4 text-right">Price</span>
                  </div>
                  {contact.properties.map((prop) => (
                    <div key={prop.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-50 transition-colors">
                      <div className="col-span-5 min-w-0 flex items-center space-x-2">
                        <Home className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-300 truncate">{prop.title}</p>
                      </div>
                      <span className="col-span-3 text-[10px] text-slate-400 text-center">{prop.community}</span>
                      <div className="col-span-4 text-right">
                        <p className="text-xs font-bold text-amber-600">{fmt(prop.price_aed)}</p>
                        <p className="text-[9px] text-slate-500">{prop.bedrooms} Bed · {prop.property_type}</p>
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
