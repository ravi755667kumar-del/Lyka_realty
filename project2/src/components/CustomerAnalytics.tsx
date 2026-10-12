import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Mail, 
  Sparkles, 
  TrendingUp, 
  UserCheck, 
  BarChart3, 
  Filter, 
  ChevronRight, 
  X, 
  MessageSquare,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { UserProfileData, LoginEvent } from '../types/crm';
import { getAllUsersFromFirestore, getLoginEventsFromFirestore } from '../lib/firebase';

type GroupMode = 'date' | 'day' | 'month' | 'year';
type DateRange = '7d' | '14d' | '30d' | '90d' | 'all';

interface CustomerAnalyticsProps {
  onSelectCustomerChat?: (userId: string, email: string) => void;
  onNavigateToProfiles?: () => void;
}

export const CustomerAnalytics: React.FC<CustomerAnalyticsProps> = ({ 
  onSelectCustomerChat,
  onNavigateToProfiles
}) => {
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Controls
  const [groupMode, setGroupMode] = useState<GroupMode>('date');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'Google' | 'Email'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfileData | null>(null);

  // Load Firestore data
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [fetchedUsers, fetchedEvents] = await Promise.all([
        getAllUsersFromFirestore(),
        getLoginEventsFromFirestore()
      ]);
      setUsers(fetchedUsers);
      setLoginEvents(fetchedEvents);
    } catch (err) {
      console.warn('Failed to fetch customer data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Normalize all login entries (from login_events + user login_history + last_login)
  const allLoginEntries = useMemo(() => {
    const entries: { timestamp: string; userId: string; email: string; name: string; provider: string; age?: number }[] = [];
    const seenEventKeys = new Set<string>();

    // 1. From dedicated login_events
    for (const evt of loginEvents) {
      if (evt.timestamp) {
        const key = `${evt.userId}_${evt.timestamp}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          entries.push({
            timestamp: evt.timestamp,
            userId: evt.userId,
            email: evt.email,
            name: evt.fullName,
            provider: evt.authProvider,
            age: evt.age || undefined
          });
        }
      }
    }

    // 2. From user profiles (login_history array or last_login)
    for (const user of users) {
      const timestamps = new Set<string>();
      if (Array.isArray(user.login_history)) {
        user.login_history.forEach(ts => timestamps.add(ts));
      }
      if (user.last_login) timestamps.add(user.last_login);
      if (user.createdAt) timestamps.add(user.createdAt);

      for (const ts of timestamps) {
        const key = `${user.uid}_${ts}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          entries.push({
            timestamp: ts,
            userId: user.uid,
            email: user.Email_id,
            name: user.Name,
            provider: user.auth_provider,
            age: user.Age
          });
        }
      }
    }

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return entries;
  }, [users, loginEvents]);

  // Aggregate statistics based on groupMode: 'date' | 'day' | 'month' | 'year'
  const aggregatedStats = useMemo(() => {
    const now = new Date();

    // Filter entries by dateRange when in 'date' mode
    let filteredEntries = allLoginEntries;
    if (groupMode === 'date' && dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      filteredEntries = allLoginEntries.filter(e => new Date(e.timestamp) >= cutoff);
    } else if (groupMode === 'month') {
      // Filter to selectedYear
      filteredEntries = allLoginEntries.filter(e => new Date(e.timestamp).getFullYear() === selectedYear);
    }

    if (groupMode === 'date') {
      // Group by calendar date (YYYY-MM-DD)
      const dateMap = new Map<string, { label: string; count: number; users: Set<string>; rawDate: string }>();

      // Generate date skeleton if within 7, 14, 30 days
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '30d' ? 30 : 90;
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dateMap.set(key, { label, count: 0, users: new Set(), rawDate: key });
        }
      }

      for (const entry of filteredEntries) {
        try {
          const d = new Date(entry.timestamp);
          const key = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (!dateMap.has(key)) {
            dateMap.set(key, { label, count: 0, users: new Set(), rawDate: key });
          }
          const item = dateMap.get(key)!;
          item.count += 1;
          if (entry.userId) item.users.add(entry.userId);
        } catch (_) {}
      }

      // Convert to sorted array by rawDate ascending
      const sorted = Array.from(dateMap.values()).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
      return sorted.map(s => ({
        key: s.rawDate,
        label: s.label,
        subLabel: s.rawDate,
        count: s.count,
        uniqueUsers: s.users.size
      }));
    }

    if (groupMode === 'day') {
      // Group by Day of Week: Sunday to Saturday
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const counts = [0, 0, 0, 0, 0, 0, 0];
      const usersByDay = counts.map(() => new Set<string>());

      for (const entry of allLoginEntries) {
        try {
          const dayIndex = new Date(entry.timestamp).getDay();
          counts[dayIndex] += 1;
          if (entry.userId) usersByDay[dayIndex].add(entry.userId);
        } catch (_) {}
      }

      // Reorder starting Monday to Sunday
      const weekOrder = [1, 2, 3, 4, 5, 6, 0];
      return weekOrder.map(idx => ({
        key: dayNames[idx],
        label: dayShort[idx],
        subLabel: dayNames[idx],
        count: counts[idx],
        uniqueUsers: usersByDay[idx].size
      }));
    }

    if (groupMode === 'month') {
      // Group by Months: Jan to Dec for selectedYear
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fullMonthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const counts = new Array(12).fill(0);
      const usersByMonth = counts.map(() => new Set<string>());

      for (const entry of filteredEntries) {
        try {
          const d = new Date(entry.timestamp);
          if (d.getFullYear() === selectedYear) {
            const m = d.getMonth();
            counts[m] += 1;
            if (entry.userId) usersByMonth[m].add(entry.userId);
          }
        } catch (_) {}
      }

      return monthNames.map((name, idx) => ({
        key: fullMonthNames[idx],
        label: name,
        subLabel: `${fullMonthNames[idx]} ${selectedYear}`,
        count: counts[idx],
        uniqueUsers: usersByMonth[idx].size
      }));
    }

    if (groupMode === 'year') {
      // Group by Year
      const yearMap = new Map<string, { count: number; users: Set<string> }>();
      const currentYr = new Date().getFullYear();
      // Ensure at least last 3 years exist
      for (let y = currentYr - 2; y <= currentYr; y++) {
        yearMap.set(String(y), { count: 0, users: new Set() });
      }

      for (const entry of allLoginEntries) {
        try {
          const yr = String(new Date(entry.timestamp).getFullYear());
          if (!yearMap.has(yr)) {
            yearMap.set(yr, { count: 0, users: new Set() });
          }
          const item = yearMap.get(yr)!;
          item.count += 1;
          if (entry.userId) item.users.add(entry.userId);
        } catch (_) {}
      }

      return Array.from(yearMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([yr, data]) => ({
          key: yr,
          label: yr,
          subLabel: `Year ${yr}`,
          count: data.count,
          uniqueUsers: data.users.size
        }));
    }

    return [];
  }, [allLoginEntries, groupMode, dateRange, selectedYear]);

  // Max value for chart scaling
  const maxStatCount = useMemo(() => {
    const max = Math.max(...aggregatedStats.map(s => s.count), 1);
    return max;
  }, [aggregatedStats]);

  // Total logins in current aggregated view
  const totalViewLogins = useMemo(() => {
    return aggregatedStats.reduce((sum, s) => sum + s.count, 0);
  }, [aggregatedStats]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    const totalCustomers = users.length;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const loginsToday = allLoginEntries.filter(e => e.timestamp.startsWith(todayStr)).length;
    const loginsThisWeek = allLoginEntries.filter(e => new Date(e.timestamp) >= sevenDaysAgo).length;
    const loginsThisMonth = allLoginEntries.filter(e => new Date(e.timestamp) >= thirtyDaysAgo).length;

    // Age statistics
    const ages = users.map(u => u.Age).filter((a): a is number => typeof a === 'number' && a > 0);
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 'N/A';

    // Provider distribution
    const googleCount = users.filter(u => (u.auth_provider || '').toLowerCase().includes('google')).length;
    const emailCount = users.filter(u => !(u.auth_provider || '').toLowerCase().includes('google')).length;

    return {
      totalCustomers,
      loginsToday,
      loginsThisWeek,
      loginsThisMonth,
      totalAllTimeLogins: allLoginEntries.length,
      avgAge,
      googleCount,
      emailCount
    };
  }, [users, allLoginEntries]);

  // Filtered customer list for the table
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = 
        !searchTerm.trim() ||
        (u.Name && u.Name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.Email_id && u.Email_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.uid && u.uid.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchProvider = 
        providerFilter === 'all' ||
        (providerFilter === 'Google' && (u.auth_provider || '').toLowerCase().includes('google')) ||
        (providerFilter === 'Email' && !(u.auth_provider || '').toLowerCase().includes('google'));

      return matchSearch && matchProvider;
    });
  }, [users, searchTerm, providerFilter]);

  // Age group demographics
  const ageDemographics = useMemo(() => {
    const buckets: Record<string, number> = {
      '18 - 25': 0,
      '26 - 35': 0,
      '36 - 50': 0,
      '51+': 0
    };
    for (const u of users) {
      if (u.Age) {
        if (u.Age <= 25) buckets['18 - 25']++;
        else if (u.Age <= 35) buckets['26 - 35']++;
        else if (u.Age <= 50) buckets['36 - 50']++;
        else buckets['51+']++;
      }
    }
    return buckets;
  }, [users]);

  // Format time helper
  const formatDateTime = (ts?: string) => {
    if (!ts) return 'Never';
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
    if (!ts) return 'Never';
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 space-y-6">
      
      {/* ─── TOP HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                <span>Customer Login & Activity Analytics</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Track registered customers and login statistics by Date, Day, Month, and Year
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {onNavigateToProfiles && (
            <button
              onClick={onNavigateToProfiles}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all shadow-sm"
              title="View individual customer directory & activity"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Which Customer Logged In</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all shadow-sm disabled:opacity-50"
            title="Refresh login data from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* ─── KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Customers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Customers</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{kpis.totalCustomers}</span>
            <span className="text-[11px] text-emerald-400 font-medium">Registered</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified user profiles in database</p>
        </div>

        {/* Logins Today */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logins Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{kpis.loginsToday}</span>
            <span className="text-[11px] text-emerald-400 font-medium">Today</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active customer sessions today</p>
        </div>

        {/* Logins This Month */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-violet-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Logins</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{kpis.loginsThisMonth}</span>
            <span className="text-[11px] text-violet-300 font-medium">Past 30 days</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{kpis.loginsThisWeek} logins this week</p>
        </div>

        {/* Auth Provider Split */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Login Method</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-sm font-bold text-white">{kpis.googleCount}</span>
              <span className="text-[11px] text-slate-400">Google</span>
            </div>
            <div className="text-slate-600">|</div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-sm font-bold text-white">{kpis.emailCount}</span>
              <span className="text-[11px] text-slate-400">Email</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Avg customer age: {kpis.avgAge} yrs</p>
        </div>

      </div>

      {/* ─── PRIMARY STATISTICAL CHART SECTION (DATE / DAY / MONTH / YEAR) ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          
          {/* Mode Selector (Date / Day / Month / Year) */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setGroupMode('date')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupMode === 'date'
                  ? 'bg-amber-500 text-amber-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>By Date</span>
            </button>

            <button
              onClick={() => setGroupMode('day')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupMode === 'day'
                  ? 'bg-amber-500 text-amber-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>By Day of Week</span>
            </button>

            <button
              onClick={() => setGroupMode('month')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupMode === 'month'
                  ? 'bg-amber-500 text-amber-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>By Month</span>
            </button>

            <button
              onClick={() => setGroupMode('year')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                groupMode === 'year'
                  ? 'bg-amber-500 text-amber-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>By Year</span>
            </button>
          </div>

          {/* Sub-filters depending on active mode */}
          <div className="flex items-center space-x-2">
            {groupMode === 'date' && (
              <div className="flex items-center space-x-1 text-xs bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['7d', '14d', '30d', 'all'] as DateRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      dateRange === r
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {r === '7d' ? '7 Days' : r === '14d' ? '14 Days' : r === '30d' ? '30 Days' : 'All Dates'}
                  </button>
                ))}
              </div>
            )}

            {groupMode === 'month' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold px-2.5 py-1 text-slate-200 outline-none"
                >
                  {[2024, 2025, 2026, 2027].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              Total Logins: <span className="text-amber-400 font-bold">{totalViewLogins}</span>
            </div>
          </div>

        </div>

        {/* ─── VISUAL STATISTICAL BAR CHART ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>
              {groupMode === 'date' && `Daily Login Distribution (${dateRange === 'all' ? 'All recorded dates' : `Past ${dateRange.replace('d', ' days')}`})`}
              {groupMode === 'day' && 'Weekly Login Peak Pattern (Monday to Sunday)'}
              {groupMode === 'month' && `Monthly Login Activity (${selectedYear})`}
              {groupMode === 'year' && 'Year-over-Year Total Logins'}
            </span>
            <span className="text-[11px] text-slate-500">Hover bars to see exact counts</span>
          </div>

          {aggregatedStats.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No login records found for this period.
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 px-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-x-auto">
              {aggregatedStats.map((item) => {
                const heightPercent = maxStatCount > 0 ? Math.max((item.count / maxStatCount) * 100, item.count > 0 ? 8 : 2) : 2;
                const isPeak = item.count > 0 && item.count === maxStatCount;

                return (
                  <div
                    key={item.key}
                    className="flex-1 min-w-[32px] sm:min-w-[42px] flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 bg-slate-900 border border-amber-500/50 shadow-xl rounded-lg px-2.5 py-1 text-center whitespace-nowrap">
                      <p className="text-[10px] font-bold text-white">{item.subLabel}</p>
                      <p className="text-[10px] text-amber-400 font-semibold">{item.count} logins ({item.uniqueUsers} users)</p>
                    </div>

                    {/* Value label on top of bar */}
                    {item.count > 0 && (
                      <span className={`text-[10px] font-bold mb-1 transition-transform group-hover:scale-110 ${
                        isPeak ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {item.count}
                      </span>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-lg transition-all duration-300 relative group-hover:brightness-125 ${
                        item.count === 0
                          ? 'bg-slate-800/40'
                          : isPeak
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-gradient-to-t from-violet-700/80 to-violet-500'
                      }`}
                    />

                    {/* Axis Label */}
                    <span className="text-[10px] font-medium text-slate-400 mt-2 truncate w-full text-center">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown sub-panels: Auth Provider & Age Demographics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          {/* Auth Provider Distribution */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Authentication Method Breakdown</span>
              </span>
              <span className="text-[10px] text-slate-400">{users.length} total users</span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Google Sign In</span>
                  </span>
                  <span className="font-bold text-amber-400">
                    {users.length > 0 ? Math.round((kpis.googleCount / users.length) * 100) : 0}% ({kpis.googleCount})
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${users.length > 0 ? (kpis.googleCount / users.length) * 100 : 0}%` }}
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                    <span>Email & Password</span>
                  </span>
                  <span className="font-bold text-violet-400">
                    {users.length > 0 ? Math.round((kpis.emailCount / users.length) * 100) : 0}% ({kpis.emailCount})
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${users.length > 0 ? (kpis.emailCount / users.length) * 100 : 0}%` }}
                    className="bg-violet-400 h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Customer Age Demographics */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Customer Age Distribution</span>
              </span>
              <span className="text-[10px] text-slate-400">Average: {kpis.avgAge} yrs</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {Object.entries(ageDemographics).map(([bracket, count]) => (
                <div key={bracket} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">{bracket} yrs</span>
                  <span className="text-base font-extrabold text-white mt-0.5 block">{count}</span>
                  <span className="text-[9px] text-cyan-400 block">
                    {users.length > 0 ? Math.round((count / users.length) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ─── CUSTOMER REGISTRY & ACTIVITY TABLE ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        
        {/* Table Header and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Customer Registry & Login History</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {filteredUsers.length} users
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Detailed user credentials, auth methods, last logins, and engagement
            </p>
          </div>

          {/* Search & Provider Filter */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, email, uid..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50 w-44 sm:w-56"
              />
            </div>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none"
            >
              <option value="all">All Providers</option>
              <option value="Google">Google Only</option>
              <option value="Email">Email Only</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-slate-800/80 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4">Login Method</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Total Logins</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isGoogle = (u.auth_provider || '').toLowerCase().includes('google');
                  const loginCount = (u.login_history && u.login_history.length > 0) 
                    ? u.login_history.length 
                    : allLoginEntries.filter(e => e.userId === u.uid || e.email === u.Email_id).length || 1;

                  return (
                    <tr key={u.uid || u.Email_id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Initials */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-slate-950 text-[11px] shrink-0">
                            {u.Name ? u.Name.substring(0, 2).toUpperCase() : 'CU'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{u.Name || 'Customer'}</p>
                            <p className="text-[10px] text-slate-500 truncate font-mono">UID: {u.uid ? u.uid.substring(0, 8) + '...' : 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                        {u.Email_id || 'N/A'}
                      </td>

                      {/* Age */}
                      <td className="py-3 px-4 text-slate-300">
                        {u.Age ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                            {u.Age} yrs
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">N/A</span>
                        )}
                      </td>

                      {/* Auth Provider */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isGoogle
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                        }`}>
                          <span>{isGoogle ? 'Google' : 'Email/Password'}</span>
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300">{getTimeAgo(u.last_login)}</div>
                        <div className="text-[10px] text-slate-500">{formatDateTime(u.last_login)}</div>
                      </td>

                      {/* Total Logins */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-white px-2 py-0.5 rounded-md bg-slate-800 text-xs">
                          {loginCount} {loginCount === 1 ? 'time' : 'times'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedUserDetail(u)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ─── USER DETAIL MODAL ─── */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  {selectedUserDetail.Name ? selectedUserDetail.Name.substring(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedUserDetail.Name || 'Customer Profile'}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedUserDetail.Email_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Customer Age</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{selectedUserDetail.Age ? `${selectedUserDetail.Age} Years Old` : 'Not specified'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Sign-in Provider</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{selectedUserDetail.auth_provider || 'Email'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Last Login</span>
                <span className="text-xs font-semibold text-white mt-0.5 block">{formatDateTime(selectedUserDetail.last_login)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Firebase UID</span>
                <span className="text-xs font-mono text-slate-300 mt-0.5 block truncate">{selectedUserDetail.uid || 'N/A'}</span>
              </div>
            </div>

            {/* Login History List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                Recorded Login Timestamps ({selectedUserDetail.login_history?.length || 1})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedUserDetail.login_history && selectedUserDetail.login_history.length > 0 ? (
                  selectedUserDetail.login_history.map((ts, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-300">{formatDateTime(ts)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{getTimeAgo(ts)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between text-xs bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300">{formatDateTime(selectedUserDetail.last_login)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{getTimeAgo(selectedUserDetail.last_login)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
