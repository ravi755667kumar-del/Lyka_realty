import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PropertyListing } from '../types/crm';
import { TermsAndPolicyModal } from './TermsAndPolicyModal';
import {
  Sparkles,
  Send,
  BedDouble,
  Maximize2,
  TrendingUp,
  MapPin,
  CalendarCheck,
  MessageSquare,
  Search,
  Building2,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  PhoneCall,
  Star,
  Plus,
  Heart,
  X
} from 'lucide-react';

export interface HomeLandingProps {
  customBgColor?: string;
  properties: PropertyListing[];
  onAskAI: (question: string) => void;
  onBookViewing: (property: PropertyListing) => void;
  onOpenChat: () => void;
  favorites?: string[];
  onToggleFavorite?: (propertyId: string) => void;
  showFavoritesOnly?: boolean;
  onClearFavoritesFilter?: () => void;
  cityFilter?: 'all' | 'Dubai' | 'Mumbai';
  onSelectCity?: (city: 'all' | 'Dubai' | 'Mumbai') => void;
}

/* ── Known-good imagery (same Unsplash library the verified listings use) ── */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80';
const DUBAI_CARD_IMAGE =
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80';
const MUMBAI_CARD_IMAGE =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

const SUGGESTION_CHIPS = [
  '2BR apartment in Dubai Marina under AED 2M',
  'Best investment communities with 7%+ ROI',
  '4BR family villa in Dubai Hills Estate',
  'Luxury sea-view residence in Worli, Mumbai',
];

const HOW_IT_WORKS = [
  {
    icon: MessageSquare,
    step: '01',
    title: 'Ask Lyka AI',
    text: 'Describe your budget, lifestyle or investment goal in plain words — no forms, no filters to learn.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'Get matched instantly',
    text: 'The AI qualifies your requirement and curates the closest residences from our verified portfolio.',
  },
  {
    icon: KeyRound,
    step: '03',
    title: 'Book & meet your advisor',
    text: 'Schedule an in-person or virtual viewing — a senior Lyka advisor coordinates everything for you.',
  },
];

/* ── Price formatting: AED for Dubai, ₹ Cr for Mumbai ── */
const formatPrice = (p: PropertyListing): string => {
  if ((p.city || 'Dubai') === 'Mumbai' && p.price_inr) {
    const cr = p.price_inr / 10000000;
    return `₹ ${cr.toFixed(1).replace(/\.0$/, '')} Cr`;
  }
  const m = p.price_aed / 1000000;
  return `AED ${m.toFixed(2).replace(/\.?0+$/, '')}M`;
};

/* ── Scroll-reveal wrapper (adds a soft fade/slide when entering viewport) ── */
const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out will-change-transform ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

/* ── Image with graceful fallback when a listing's URL is broken ── */
const SafeImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}> = ({ src, alt, className = '', loading }) => {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = '1';
        img.src = DUBAI_CARD_IMAGE;
      }}
      className={className}
    />
  );
};

type CityFilter = 'all' | 'Dubai' | 'Mumbai';

interface AreaInfo {
  key: string;
  name: string;
  city: string;
  count: number;
  image: string;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  customBgColor,
  properties,
  onAskAI,
  onBookViewing,
  onOpenChat,
  favorites = [],
  onToggleFavorite,
  showFavoritesOnly = false,
  onClearFavoritesFilter,
  cityFilter: propCityFilter,
  onSelectCity: propOnSelectCity,
}) => {
  const [askText, setAskText] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState<'terms' | 'privacy'>('terms');
  const [internalCityFilter, setInternalCityFilter] = useState<CityFilter>('all');
  const cityFilter = propCityFilter !== undefined ? propCityFilter : internalCityFilter;
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const propertiesSectionRef = useRef<HTMLElement>(null);

  // Local fallback state if favorites prop is omitted
  const [localFavorites, setLocalFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('lyka_favorite_properties') || localStorage.getItem('lyka_saved_properties');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const activeFavorites = favorites && favorites.length > 0 ? favorites : localFavorites;

  const toggleLike = (id: string) => {
    if (onToggleFavorite) {
      onToggleFavorite(id);
    } else {
      setLocalFavorites((prev) => {
        const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        try {
          localStorage.setItem('lyka_favorite_properties', JSON.stringify(updated));
          localStorage.setItem('lyka_saved_properties', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    }
  };

  /* Only showcase available (not-yet-booked) residences */
  const available = useMemo(
    () =>
      (properties.length > 0 ? properties : []).filter(
        (p) => p && p.id && !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
      ),
    [properties]
  );

  const communitiesCount = useMemo(
    () => new Set(available.map((p) => p.community)).size,
    [available]
  );
  const portfolioAED = useMemo(
    () => available.reduce((sum, p) => sum + (p.price_aed || 0), 0),
    [available]
  );

  /* ── Areas (communities) aggregated for the Browse-by-Area rail ── */
  const areaList = useMemo<AreaInfo[]>(() => {
    const map = new Map<string, AreaInfo>();
    for (const p of available) {
      const city = p.city || 'Dubai';
      const key = `${city}::${p.community}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, name: p.community, city, count: 1, image: p.image_url });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [available]);

  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(available.map((p) => p.property_type))).filter(Boolean);
    return ['All', ...types];
  }, [available]);

  const filtered = useMemo(() => {
    let list = available;
    if (showFavoritesOnly) {
      list = list.filter((p) => activeFavorites.includes(p.id));
    }
    if (cityFilter !== 'all') {
      list = list.filter((p) => (p.city || 'Dubai') === cityFilter);
    }
    if (typeFilter !== 'All') {
      list = list.filter((p) => p.property_type === typeFilter);
    }
    if (areaFilter) {
      list = list.filter(
        (p) => p.community.toLowerCase() === areaFilter.toLowerCase()
      );
    }
    return list;
  }, [available, cityFilter, typeFilter, areaFilter, showFavoritesOnly, activeFavorites]);

  const shown = filtered.slice(0, visibleCount);

  /* Hero spotlight card — the flagship residence (must have a working image) */
  const spotlight = useMemo(
    () =>
      available.find(
        (p) =>
          (p.city || 'Dubai') === 'Dubai' &&
          typeof p.image_url === 'string' &&
          p.image_url.startsWith('http')
      ) || available.find((p) => typeof p.image_url === 'string' && p.image_url.startsWith('http')),
    [available]
  );

  const selectCity = (city: CityFilter) => {
    if (propOnSelectCity) {
      propOnSelectCity(city);
    } else {
      setInternalCityFilter(city);
    }
    setAreaFilter(null);
    if (onClearFavoritesFilter && showFavoritesOnly) {
      onClearFavoritesFilter();
    }
    setVisibleCount(6);
    propertiesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectArea = (area: AreaInfo) => {
    setAreaFilter(area.name);
    if (propOnSelectCity) {
      propOnSelectCity('all');
    } else {
      setInternalCityFilter('all');
    }
    setTypeFilter('All');
    if (onClearFavoritesFilter && showFavoritesOnly) {
      onClearFavoritesFilter();
    }
    setVisibleCount(6);
    propertiesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectType = (type: string) => {
    setTypeFilter(type);
    setVisibleCount(6);
  };

  const submitAsk = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = askText.trim();
    if (!q) return;
    setAskText('');
    onAskAI(q);
  };

  const askAboutProperty = (p: PropertyListing) => {
    const cityLabel = (p.city || 'Dubai') === 'Mumbai' ? 'Mumbai' : 'Dubai';
    onAskAI(
      `I'm interested in "${p.title}" in ${p.community}, ${cityLabel} (${formatPrice(p)}). Tell me more about it.`
    );
  };

  const dubaiCount = available.filter((p) => (p.city || 'Dubai') === 'Dubai').length;
  const mumbaiCount = available.filter((p) => p.city === 'Mumbai').length;

  const likeButton = (p: PropertyListing, size: 'sm' | 'md' = 'md') => {
    const liked = activeFavorites.includes(p.id);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(p.id);
        }}
        aria-label={liked ? 'Remove from favorites' : 'Save to favorites'}
        title={liked ? 'Remove from favorites' : 'Save to favorites'}
        className={`flex items-center justify-center rounded-full backdrop-blur-sm border transition-all active:scale-90 cursor-pointer ${
          size === 'md' ? 'w-9 h-9' : 'w-8 h-8'
        } ${
          liked
            ? 'bg-red-500 border-red-400 text-white shadow-md shadow-red-500/40'
            : 'bg-espresso-900/70 border-white/25 text-espresso-300 hover:text-red-400 hover:border-red-400/60'
        }`}
      >
        <Heart className={`${size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${liked ? 'fill-current' : ''}`} />
      </button>
    );
  };

  return (
    <div className="h-full w-full overflow-y-auto landing-scroll bg-slate-950" style={{ backgroundColor: customBgColor || undefined }}>
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] lg:min-h-[92vh] flex flex-col justify-between overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Modern luxury residence exterior"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Warm espresso veils keep the brand palette across all three themes */}
        <div className="absolute inset-0 bg-gradient-to-r from-espresso-900/95 via-espresso-900/78 to-espresso-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso-900 via-espresso-900/20 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-8 lg:pb-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-14 items-center flex-1">
          {/* Left: headline + AI ask bar */}
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-espresso-900/60 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-amber-400">
                AI-Powered Real Estate Advisory
              </span>
            </div>

            <h1 className="font-display mt-6 text-espresso-300 text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.08] font-semibold">
              Find the address
              <br />
              that <em className="text-amber-400 not-italic font-display italic">defines you.</em>
            </h1>

            <p className="mt-5 text-espresso-400 text-base sm:text-lg leading-relaxed max-w-xl">
              Hand-curated apartments, villas and penthouses across Dubai and Mumbai — matched to
              your budget, lifestyle and investment goals by Lyka's agentic AI, in seconds.
            </p>

            {/* ── AI Ask Bar — routes straight into the existing Lyka chatbot ── */}
            <form
              onSubmit={submitAsk}
              className="mt-8 flex flex-col sm:flex-row gap-2.5 max-w-2xl rounded-2xl sm:rounded-full bg-white/95 backdrop-blur-md p-2.5 shadow-2xl shadow-black/40 border border-white/60"
            >
              <div className="flex items-center flex-1 gap-2.5 px-3">
                <Search className="w-4.5 h-4.5 text-[#8c765c] flex-shrink-0" />
                <input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  placeholder="e.g. 2BR in Dubai Marina under AED 2M with sea view"
                  className="flex-1 bg-transparent text-[15px] text-[#1c1611] dark:text-white placeholder-[#8c765c] dark:placeholder-slate-400 outline-none py-2.5 min-w-0"
                  style={{ backgroundColor: 'transparent' }}
                  aria-label="Ask Lyka AI about properties"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-bold transition-colors shadow-md whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                Ask Lyka AI
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onAskAI(chip)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium text-espresso-400 bg-espresso-900/50 border border-espresso-700/70 backdrop-blur-sm hover:text-amber-400 hover:border-amber-500/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Right: floating spotlight residence card (desktop) */}
          {spotlight && (
            <div className="hidden lg:block relative">
              <div className="absolute -inset-8 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
              <div className="relative max-w-sm ml-auto bg-white/95 backdrop-blur-md rounded-[1.75rem] p-4 shadow-2xl shadow-black/50 border border-white/60">
                <div className="relative h-52 rounded-2xl overflow-hidden bg-[#f7f2e6]">
                  <SafeImage
                    src={spotlight.image_url}
                    alt={spotlight.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div className="absolute top-3 right-3">{likeButton(spotlight)}</div>
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-espresso-900/80 backdrop-blur-sm border border-white/10">
                    <span className="font-display text-base font-semibold text-amber-400">
                      {formatPrice(spotlight)}
                    </span>
                  </div>
                </div>
                <div className="px-2 pt-3.5 pb-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
                    Spotlight · {spotlight.community}
                  </div>
                  <h3 className="text-[#1c1611] dark:text-white text-sm font-bold leading-snug mt-1.5 line-clamp-2">
                    {spotlight.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-[#5a4835] dark:text-slate-300 mt-2">
                    <span className="flex items-center gap-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                      {spotlight.bedrooms} BR
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                      {spotlight.size_sqft.toLocaleString()} sqft
                    </span>
                  </div>
                  <button
                    onClick={() => askAboutProperty(spotlight)}
                    className="w-full mt-3.5 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Ask AI about this residence
                  </button>
                </div>
              </div>

              {/* Small floating stat chip */}
              <div className="absolute -bottom-6 -left-10 bg-espresso-900/90 border border-amber-500/40 rounded-2xl px-5 py-3.5 backdrop-blur-md shadow-xl">
                <div className="font-display text-xl font-semibold text-amber-400">
                  {available.length}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-espresso-400">
                  Verified listings
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Hero stats strip ── */}
        <div className="relative lg:absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-espresso-900/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-white/10 gap-3 sm:gap-4">
            {[
              { value: `${available.length}`, label: 'Curated Residences' },
              { value: `${communitiesCount}`, label: 'Prime Communities' },
              { value: `AED ${Math.round(portfolioAED / 1000000)}M+`, label: 'Portfolio Value' },
              { value: 'Up to 8%', label: 'Net Rental ROI' },
            ].map((stat) => (
              <div key={stat.label} className="text-center sm:text-left sm:px-6 first:sm:pl-0">
                <div className="font-display text-xl sm:text-2xl font-semibold text-amber-400">
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-espresso-400 mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ EXPLORE BY CITY ═══════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-2">
        <Reveal>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                Two Cities · One Standard
              </div>
              <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-100 mt-2">
                Explore by city
              </h2>
            </div>
            <button
              onClick={() => selectCity('all')}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-500 transition-colors cursor-pointer"
            >
              View all residences
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
            {[
              {
                city: 'Dubai' as CityFilter,
                image: DUBAI_CARD_IMAGE,
                title: 'Dubai',
                subtitle: 'Marina · Downtown · Palm Jumeirah · Hills · JVC',
                count: dubaiCount,
                tagline: 'Skyline living with tax-free yields',
              },
              {
                city: 'Mumbai' as CityFilter,
                image: MUMBAI_CARD_IMAGE,
                title: 'Mumbai',
                subtitle: 'Worli · Bandra · Juhu · BKC · Powai',
                count: mumbaiCount,
                tagline: 'South-Mumbai prestige & capital growth',
              },
            ].map((card) => (
              <button
                key={card.city}
                onClick={() => selectCity(card.city)}
                className="group relative h-64 sm:h-72 rounded-3xl overflow-hidden text-left border border-slate-800 hover:border-amber-500/50 transition-colors shadow-lg cursor-pointer"
              >
                <SafeImage
                  src={card.image}
                  alt={`${card.title} residences`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/95 via-espresso-900/35 to-transparent" />
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-espresso-900/70 backdrop-blur-sm border border-white/15 text-espresso-300 text-[11px] font-bold">
                  {card.count} residences
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between gap-4">
                  <div>
                    <div className="font-display text-2xl sm:text-3xl font-semibold text-espresso-300">
                      {card.title}
                    </div>
                    <div className="text-amber-400 text-xs font-semibold mt-1.5">{card.tagline}</div>
                    <div className="text-espresso-400 text-[11px] mt-1">{card.subtitle}</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center flex-shrink-0 group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-4.5 h-4.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════════════ BROWSE BY AREA ═══════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Reveal>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                Find it by neighbourhood
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
                Browse by area
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Jump straight into the community you have in mind — every listing grouped by its area.
              </p>
            </div>
            {areaFilter && (
              <button
                onClick={() => setAreaFilter(null)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-slate-900 border border-amber-500/50 text-amber-500 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear area: {areaFilter}
              </button>
            )}
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 mt-6 sm:mt-7 snap-x snap-mandatory landing-scroll -mx-4 px-4 sm:mx-0 sm:px-0 touch-pan-x select-none">
            {areaList.map((area) => (
              <button
                key={area.key}
                onClick={() => selectArea(area)}
                className={`group relative w-56 h-44 flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left border transition-all hover:-translate-y-1 cursor-pointer ${
                  areaFilter === area.name
                    ? 'border-amber-500 shadow-lg shadow-amber-500/20'
                    : 'border-slate-800 hover:border-amber-500/50'
                }`}
              >
                <SafeImage
                  src={area.image}
                  alt={`${area.name}, ${area.city}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-espresso-900/75 backdrop-blur-sm border border-white/15 text-espresso-300 text-[10px] font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  {area.city}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="font-display text-lg font-semibold text-white leading-tight">
                    {area.name}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-espresso-400">
                      {area.count} {area.count === 1 ? 'listing' : 'listings'}
                    </span>
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════════════ FEATURED PROPERTIES ═══════════════ */}
      <section ref={propertiesSectionRef} id="portfolio-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 scroll-mt-16 sm:scroll-mt-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              {showFavoritesOnly ? 'Favorite Shortlist' : 'Curated Portfolio'}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 mt-2 flex items-center justify-center gap-2">
              {showFavoritesOnly ? (
                <>
                  <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                  <span>Your Favorite Residences</span>
                  <span className="text-sm px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-mono">
                    {filtered.length}
                  </span>
                </>
              ) : (
                'Featured residences'
              )}
            </h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              {showFavoritesOnly
                ? 'Your favorited properties from across the portfolio. Click on any card to ask AI or book a viewing.'
                : 'Every listing is verified by our property team. Tap the heart to save a residence — ask the AI for full details, or book a viewing right away.'}
            </p>
            {showFavoritesOnly && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onClearFavoritesFilter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors shadow-sm cursor-pointer"
                >
                  Show Full Portfolio
                </button>
              </div>
            )}
          </div>
        </Reveal>

        {/* Filters (Notice: Saved button removed from between cities and types!) */}
        <Reveal delay={100}>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {(['all', 'Dubai', 'Mumbai'] as CityFilter[]).map((city) => (
              <button
                key={city}
                onClick={() => selectCity(city)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  cityFilter === city && !showFavoritesOnly
                    ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-amber-600'
                }`}
              >
                {city === 'all' ? 'All Cities' : city}
              </button>
            ))}
            <div className="hidden sm:block h-5 w-px bg-slate-700 mx-1" />
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  typeFilter === type && !showFavoritesOnly
                    ? 'bg-slate-100 text-slate-900 border-slate-100 shadow-md'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-amber-600'
                }`}
              >
                {type === 'All' ? 'All Types' : `${type}s`}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Property grid */}
        {shown.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-8 sm:mt-10">
            {shown.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 90}>
                <article className="group h-full flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-amber-500/40 hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1 transition-all duration-300">
                  <div className="relative h-56 overflow-hidden flex-shrink-0">
                    <SafeImage
                      src={p.image_url}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                    {/* Status badge */}
                    <div
                      className={`absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border ${
                        (p.status || '').toLowerCase() === 'off-plan'
                          ? 'bg-amber-500/90 text-amber-950 border-amber-400'
                          : 'bg-emerald-500/90 text-emerald-950 border-emerald-400'
                      }`}
                    >
                      {p.status || 'Ready'}
                    </div>

                    {/* Save (like) button */}
                    <div className="absolute top-3.5 right-3.5">{likeButton(p)}</div>

                    {/* Price badge */}
                    <div className="absolute bottom-3.5 left-3.5 px-3 py-1.5 rounded-xl bg-espresso-900/80 backdrop-blur-sm border border-white/10">
                      <span className="font-display text-base font-semibold text-amber-400">
                        {formatPrice(p)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 p-5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
                      <MapPin className="w-3 h-3" />
                      {p.city || 'Dubai'} · {p.community}
                    </div>
                    <h3 className="text-slate-100 text-[15px] font-semibold leading-snug mt-1.5 line-clamp-2">
                      {p.title}
                    </h3>

                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400 mt-3">
                      <span className="flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                        {p.bedrooms} BR
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                        {p.size_sqft.toLocaleString()} sqft
                      </span>
                      {p.expected_roi && (
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                          {p.expected_roi.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {p.developer && (
                      <div className="text-[11px] text-slate-500 mt-2.5">
                        by {p.developer}
                      </div>
                    )}

                    <div className="flex gap-2.5 mt-auto pt-5">
                      <button
                        onClick={() => askAboutProperty(p)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Ask AI
                      </button>
                      <button
                        onClick={() => onBookViewing(p)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors border border-slate-700 cursor-pointer"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                        Book Viewing
                      </button>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="text-center bg-slate-900 border border-slate-800 rounded-3xl py-16 px-6 mt-10">
              {showFavoritesOnly ? (
                <>
                  <Heart className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-slate-200 font-semibold text-lg mt-4">No favorite residences yet</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                    Tap the heart icon on any residence to save it to your favorites shortlist, accessible anytime from the header.
                  </p>
                  <button
                    type="button"
                    onClick={onClearFavoritesFilter}
                    className="mt-5 px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Browse Full Portfolio
                  </button>
                </>
              ) : (
                <>
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
                  <h3 className="text-slate-300 font-semibold mt-4">
                    No residences match this filter
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Ask Lyka AI — it can source options beyond the current showcase.
                  </p>
                  <button
                    onClick={onOpenChat}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Ask Lyka AI
                  </button>
                </>
              )}
            </div>
          </Reveal>
        )}

        {visibleCount < filtered.length && (
          <div className="text-center mt-9">
            <button
              onClick={() => setVisibleCount((c) => c + 6)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold hover:border-amber-500/50 hover:text-amber-600 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Reveal more residences ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                Effortless by design
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 mt-2">
                How Lyka works
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mt-8 sm:mt-10">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.step} delay={i * 120}>
                <div className="relative h-full bg-slate-900 border border-slate-800 rounded-3xl p-7 hover:border-amber-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <step.icon className="w-5.5 h-5.5 text-amber-500" />
                    </div>
                    <span className="font-display text-3xl font-semibold text-slate-800">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-slate-100 font-semibold text-base mt-5">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mt-2">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Trust markers */}
          <Reveal delay={200}>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mt-12 text-slate-400">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                RERA-verified listings
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Star className="w-4 h-4 text-amber-600" />
                Senior property advisors
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <PhoneCall className="w-4 h-4 text-amber-600" />
                Direct advisor handoff
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <CalendarCheck className="w-4 h-4 text-amber-600" />
                In-person & 3D virtual viewings
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ CTA BAND ═══════════════ */}
      <section className="relative overflow-hidden bg-espresso-900">
        {/* soft gold glow accents */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(700px 340px at 20% 0%, rgba(196,164,104,0.16), transparent 60%), radial-gradient(600px 300px at 85% 100%, rgba(196,164,104,0.10), transparent 60%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 py-14 sm:py-20 text-center">
          <Reveal>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">
              Begin the conversation
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-espresso-300 mt-3 sm:mt-4 leading-tight">
              Your next address is one
              <br />
              conversation away.
            </h2>
            <p className="text-espresso-400 text-xs sm:text-sm lg:text-base mt-4 sm:mt-5 max-w-xl mx-auto leading-relaxed">
              Tell Lyka AI what you're looking for — it qualifies your requirement, curates the
              best matches, and connects you with a senior advisor to close the deal.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 sm:mt-8 w-full sm:w-auto">
              <button
                onClick={onOpenChat}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-bold transition-colors shadow-xl shadow-black/30 cursor-pointer"
              >
                <MessageSquare className="w-4.5 h-4.5" />
                Chat with Lyka AI
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => selectCity('all')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-sm font-bold transition-colors cursor-pointer"
              >
                <Building2 className="w-4.5 h-4.5" />
                Browse all residences
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-slate-800 bg-slate-950" style={{ backgroundColor: customBgColor || undefined }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Lyka Realty" className="h-10 w-auto object-contain rounded-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" />
            <div>
              <div className="text-slate-100 font-bold text-sm">Lyka Realty</div>
              <div className="text-slate-500 text-[11px] mt-0.5">Dubai · Mumbai</div>
            </div>
          </div>
          <div className="text-slate-500 text-[11px] text-center sm:text-right leading-relaxed">
            AI-powered property advisory & CRM platform.
            <br />
            All listings verified by the Lyka property team.
          </div>
        </div>
      </footer>
    </div>
  );
};
