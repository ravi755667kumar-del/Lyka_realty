import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Search, 
  RefreshCw, 
  UserCheck, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Award, 
  Activity, 
  Filter, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  BarChart3, 
  CalendarDays, 
  ArrowUpDown, 
  Grid, 
  List, 
  Download,
  AlertCircle,
  Phone,
  PhoneCall,
  MessageCircle,
  MessageSquare
} from 'lucide-react';
import { UserProfileData, LoginEvent } from '../types/crm';
import { getAllUsersFromFirestore, getLoginEventsFromFirestore } from '../lib/firebase';

interface CustomerProfilesProps {
  onNavigateToTrends?: () => void;
  onSelectUserChat?: (user: UserProfileData) => void;
}

type ActivityFilter = 'all' | 'today' | 'week' | 'month' | 'agent_requested' | 'inactive';
type ViewMode = 'cards' | 'table';
type SortOption = 'recent' | 'logins' | 'name' | 'age';

interface CustomerStatItem {
  user: UserProfileData;
  totalLogins: number;
  loginPercentage: number;
  lastLoginDate?: string;
  firstLoginDate?: string;
  loginsToday: number;
  loginsThisWeek: number;
  loginsThisMonth: number;
  activityStatus: 'today' | 'week' | 'month' | 'inactive';
  daysSinceLastLogin: number;
  timestamps: string[];
  dayOfWeekCounts: number[]; // Mon(0) to Sun(6)
}

export const CustomerProfiles: React.FC<CustomerProfilesProps> = ({ onNavigateToTrends, onSelectUserChat }) => {
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & State
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [specificDateFilter, setSpecificDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [providerFilter, setProviderFilter] = useState<'all' | 'Google' | 'Email'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStatItem | null>(null);

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
      console.warn('Failed to fetch customer data in CustomerProfiles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute full statistical profiles for every customer
  const customerStats = useMemo<CustomerStatItem[]>(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Group login events by user identifier (uid or email)
    const userTimestampsMap = new Map<string, Set<string>>();

    // 1. From dedicated login_events
    for (const evt of loginEvents) {
      if (evt.timestamp) {
        const idKey = evt.userId || evt.email?.toLowerCase();
        if (idKey) {
          if (!userTimestampsMap.has(idKey)) userTimestampsMap.set(idKey, new Set());
          userTimestampsMap.get(idKey)!.add(evt.timestamp);
        }
      }
    }

    // 2. From user profiles (login_history array or last_login or createdAt)
    for (const u of users) {
      const idKey = u.uid || u.Email_id?.toLowerCase();
      if (idKey) {
        if (!userTimestampsMap.has(idKey)) userTimestampsMap.set(idKey, new Set());
        const set = userTimestampsMap.get(idKey)!;
        if (Array.isArray(u.login_history)) {
          u.login_history.forEach(ts => set.add(ts));
        }
        if (u.last_login) set.add(u.last_login);
        if (u.createdAt) set.add(u.createdAt);
      }
    }

    // Calculate total logins across all customers for percentage computation
    let totalAllLoginsAcrossApp = 0;
    const rawItems: { user: UserProfileData; timestamps: string[] }[] = [];

    for (const user of users) {
      const idKey = user.uid || user.Email_id?.toLowerCase();
      const set = (idKey && userTimestampsMap.get(idKey)) || new Set<string>();
      if (set.size === 0 && user.last_login) set.add(user.last_login);
      if (set.size === 0 && user.createdAt) set.add(user.createdAt);

      const timestamps = Array.from(set).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      totalAllLoginsAcrossApp += Math.max(timestamps.length, 1);
      rawItems.push({ user, timestamps });
    }

    return rawItems.map(({ user, timestamps }) => {
      const totalLogins = Math.max(timestamps.length, 1);
      const loginPercentage = totalAllLoginsAcrossApp > 0 
        ? Math.round((totalLogins / totalAllLoginsAcrossApp) * 1000) / 10 
        : 0;

      const lastLoginDate = timestamps[0] || user.last_login || user.createdAt;
      const firstLoginDate = timestamps[timestamps.length - 1] || user.createdAt || user.last_login;

      // Status & recency calculation
      let activityStatus: 'today' | 'week' | 'month' | 'inactive' = 'inactive';
      let daysSinceLastLogin = 999;

      if (lastLoginDate) {
        try {
          const lastD = new Date(lastLoginDate);
          const diffMs = now.getTime() - lastD.getTime();
          daysSinceLastLogin = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          if (lastLoginDate.startsWith(todayStr) || diffMs < 24 * 60 * 60 * 1000) {
            activityStatus = 'today';
          } else if (lastD >= sevenDaysAgo) {
            activityStatus = 'week';
          } else if (lastD >= thirtyDaysAgo) {
            activityStatus = 'month';
          } else {
            activityStatus = 'inactive';
          }
        } catch (_) {}
      }

      // Counts by timeframe
      const loginsToday = timestamps.filter(ts => ts.startsWith(todayStr)).length;
      const loginsThisWeek = timestamps.filter(ts => new Date(ts) >= sevenDaysAgo).length;
      const loginsThisMonth = timestamps.filter(ts => new Date(ts) >= thirtyDaysAgo).length;

      // Day of week distribution (Mon: 0, Tue: 1, ... Sun: 6)
      const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
      for (const ts of timestamps) {
        try {
          const d = new Date(ts);
          const rawDay = d.getDay(); // 0 is Sun, 1 is Mon...
          const monIndex = rawDay === 0 ? 6 : rawDay - 1;
          dayOfWeekCounts[monIndex]++;
        } catch (_) {}
      }

      return {
        user,
        totalLogins,
        loginPercentage,
        lastLoginDate,
        firstLoginDate,
        loginsToday,
        loginsThisWeek,
        loginsThisMonth,
        activityStatus,
        daysSinceLastLogin,
        timestamps,
        dayOfWeekCounts
      };
    });
  }, [users, loginEvents]);

  // Global KPIs for this Customer Intelligence section
  const summaryKpis = useMemo(() => {
    const totalCustomers = customerStats.length;
    const activeToday = customerStats.filter(c => c.activityStatus === 'today').length;
    const activeThisWeek = customerStats.filter(c => c.activityStatus === 'today' || c.activityStatus === 'week').length;
    const activeThisMonth = customerStats.filter(c => c.activityStatus !== 'inactive').length;
    const googleUsers = customerStats.filter(c => (c.user.auth_provider || '').toLowerCase().includes('google')).length;
    const emailUsers = totalCustomers - googleUsers;

    const totalLoginsCount = customerStats.reduce((s, c) => s + c.totalLogins, 0);
    const avgLoginsPerCustomer = totalCustomers > 0 ? (totalLoginsCount / totalCustomers).toFixed(1) : '0';
    const agentRequestsCount = customerStats.filter(c => c.user.talk_to_agent_requested).length;

    // Top active customer
    const sortedByLogins = [...customerStats].sort((a, b) => b.totalLogins - a.totalLogins);
    const topCustomer = sortedByLogins[0] || null;

    return {
      totalCustomers,
      activeToday,
      activeThisWeek,
      activeThisMonth,
      googleUsers,
      emailUsers,
      totalLoginsCount,
      avgLoginsPerCustomer,
      topCustomer,
      agentRequestsCount
    };
  }, [customerStats]);

  // Top active leaderboard (top 4 customers)
  const leaderboard = useMemo(() => {
    return [...customerStats]
      .sort((a, b) => b.totalLogins - a.totalLogins)
      .slice(0, 4);
  }, [customerStats]);

  // Recent logins stream (latest 5 login occurrences across all users)
  const recentLoginsFeed = useMemo(() => {
    const feed: { customer: CustomerStatItem; timestamp: string }[] = [];
    for (const c of customerStats) {
      for (const ts of c.timestamps) {
        feed.push({ customer: c, timestamp: ts });
      }
    }
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return feed.slice(0, 5);
  }, [customerStats]);

  // Filtered & Sorted Customer List
  const filteredCustomers = useMemo(() => {
    let result = customerStats.filter(c => {
      // 1. Search term match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nameMatch = (c.user.Name || '').toLowerCase().includes(q);
        const emailMatch = (c.user.Email_id || '').toLowerCase().includes(q);
        const uidMatch = (c.user.uid || '').toLowerCase().includes(q);
        const phoneMatch = ((c.user.talk_to_agent_phone || c.user.phone || '')).toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !uidMatch && !phoneMatch) return false;
      }

      // 2. Auth provider filter
      if (providerFilter !== 'all') {
        const isGoogle = (c.user.auth_provider || '').toLowerCase().includes('google');
        if (providerFilter === 'Google' && !isGoogle) return false;
        if (providerFilter === 'Email' && isGoogle) return false;
      }

      // 3. Activity status filter
      if (activityFilter === 'agent_requested' && !c.user.talk_to_agent_requested) return false;
      if (activityFilter === 'today' && c.activityStatus !== 'today') return false;
      if (activityFilter === 'week' && c.activityStatus !== 'today' && c.activityStatus !== 'week') return false;
      if (activityFilter === 'month' && c.activityStatus === 'inactive') return false;
      if (activityFilter === 'inactive' && c.activityStatus !== 'inactive') return false;

      // 4. Specific date filter ("Which customers logged in on this specific date?")
      if (specificDateFilter) {
        const hasLoginOnDate = c.timestamps.some(ts => ts.startsWith(specificDateFilter));
        if (!hasLoginOnDate) return false;
      }

      return true;
    });

    // Sort results
    result.sort((a, b) => {
      if (sortOption === 'recent') {
        const timeA = a.lastLoginDate ? new Date(a.lastLoginDate).getTime() : 0;
        const timeB = b.lastLoginDate ? new Date(b.lastLoginDate).getTime() : 0;
        return timeB - timeA;
      }
      if (sortOption === 'logins') {
        return b.totalLogins - a.totalLogins;
      }
      if (sortOption === 'name') {
        return (a.user.Name || '').localeCompare(b.user.Name || '');
      }
      if (sortOption === 'age') {
        return (b.user.Age || 0) - (a.user.Age || 0);
      }
      return 0;
    });

    return result;
  }, [customerStats, searchTerm, providerFilter, activityFilter, specificDateFilter, sortOption]);

  // Date and Time Format Helpers
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

  // Export JSON Report
  const handleExportData = () => {
    const exportData = filteredCustomers.map(c => ({
      name: c.user.Name || 'Anonymous Customer',
      email: c.user.Email_id,
      age: c.user.Age || 'N/A',
      authProvider: c.user.auth_provider || 'Email',
      uid: c.user.uid,
      totalLogins: c.totalLogins,
      loginPercentage: `${c.loginPercentage}%`,
      lastLogin: c.lastLoginDate,
      activityStatus: c.activityStatus,
      recordedTimestampsCount: c.timestamps.length,
      allTimestamps: c.timestamps
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyka-customer-login-statistics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-300 font-sans p-4 sm:p-6 space-y-6">
      
      {/* ─── TOP HEADER ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <Users className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-300">
                  Customer Directory & Login Activity
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span>Individual Statistics</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Identify which customers logged in, their login frequencies, active dates, and complete statistical history
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Switch to General Trends */}
          {onNavigateToTrends && (
            <button
              onClick={onNavigateToTrends}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-all shadow-sm"
              title="Switch to aggregate Date, Day, Month, Year charts"
            >
              <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
              <span>View Date/Month Trends</span>
            </button>
          )}

          {/* Export JSON */}
          <button
            onClick={handleExportData}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
            title="Export filtered customer list"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export</span>
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-amber-950 transition-all shadow-sm font-bold disabled:opacity-50"
            title="Refresh Firestore data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ─── SUMMARY KPI METRICS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Total Customers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Customers</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-300">{summaryKpis.totalCustomers}</span>
            <span className="text-[10px] text-amber-700 font-medium">Profiles</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{summaryKpis.googleUsers} Google • {summaryKpis.emailUsers} Email</p>
        </div>

        {/* Logged In Today */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Today</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-emerald-400">{summaryKpis.activeToday}</span>
            <span className="text-[10px] text-emerald-300 font-medium">Customers</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Logged in within 24 hours</p>
        </div>

        {/* Active This Week */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active This Week</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-300">{summaryKpis.activeThisWeek}</span>
            <span className="text-[10px] text-blue-300 font-medium">Customers</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Last 7 days active rate</p>
        </div>

        {/* Agent Requests */}
        <div className={`bg-slate-900/90 border rounded-2xl p-4 relative overflow-hidden group transition-all ${
          summaryKpis.agentRequestsCount > 0 ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/5' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Agent Calls</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <PhoneCall className={`w-3.5 h-3.5 ${summaryKpis.agentRequestsCount > 0 ? 'animate-bounce' : ''}`} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-amber-600">{summaryKpis.agentRequestsCount}</span>
            <span className="text-[10px] text-amber-700 font-medium">Requested</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Submitted mobile numbers</p>
        </div>

        {/* Total App Logins Recorded */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-violet-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Logins</span>
            <div className="w-7 h-7 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-300">{summaryKpis.totalLoginsCount}</span>
            <span className="text-[10px] text-violet-300 font-medium">Logins</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Avg {summaryKpis.avgLoginsPerCustomer} per customer</p>
        </div>

        {/* Most Active Customer */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top Customer</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline space-x-2">
            <span className="text-base font-bold text-slate-300 truncate max-w-[120px]">
              {summaryKpis.topCustomer?.user.Name || 'N/A'}
            </span>
            <span className="text-[10px] font-bold text-amber-700">
              {summaryKpis.topCustomer ? `${summaryKpis.topCustomer.totalLogins} logins` : ''}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {summaryKpis.topCustomer?.user.Email_id || 'No logins yet'}
          </p>
        </div>

      </div>

      {/* ─── QUICK INSIGHTS: TOP ACTIVE LEADERBOARD & RECENT LOGIN ACTIVITY STREAM ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Most Active Customers Leaderboard */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">Most Active Customers Leaderboard</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Ranked by total logins</span>
          </div>

          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No customer logins registered yet.</p>
            ) : (
              leaderboard.map((c, idx) => {
                const rankColors = [
                  'bg-amber-500/20 text-amber-700 border-amber-500/40',
                  'bg-slate-400/20 text-slate-200 border-slate-400/40',
                  'bg-amber-800/20 text-amber-500 border-amber-800/40',
                  'bg-slate-800 text-slate-400 border-slate-700'
                ];
                return (
                  <div
                    key={c.user.uid || c.user.Email_id}
                    onClick={() => setSelectedCustomer(c)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800/70 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 ${rankColors[idx] || rankColors[3]}`}>
                        #{idx + 1}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                        {c.user.Name ? c.user.Name.substring(0, 2).toUpperCase() : 'CU'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-amber-700 transition-colors">
                          {c.user.Name || 'Customer'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{c.user.Email_id}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-amber-700 block">{c.totalLogins} logins</span>
                        <span className="text-[10px] text-slate-500 block">{c.loginPercentage}% share</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Recent Login Stream */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-300">Recent Customer Login Activity</h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Live timestamp feed</span>
          </div>

          <div className="space-y-2">
            {recentLoginsFeed.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No recent login events recorded.</p>
            ) : (
              recentLoginsFeed.map((item, idx) => {
                const isGoogle = (item.customer.user.auth_provider || '').toLowerCase().includes('google');
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedCustomer(item.customer)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800/70 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-emerald-300 transition-colors">
                            {item.customer.user.Name || 'Customer'}
                          </p>
                          <span className={`text-[9px] px-1.5 rounded-full font-semibold border ${
                            isGoogle ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                          }`}>
                            {isGoogle ? 'Google' : 'Email'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{item.customer.user.Email_id}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-semibold text-emerald-400 block">{getTimeAgo(item.timestamp)}</span>
                      <span className="text-[9px] text-slate-500 block">{formatDateTime(item.timestamp).split(',')[0]}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ─── CUSTOMER DIRECTORY CONTROLS & FILTER TOOLBAR ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          
          {/* Activity State Filters */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActivityFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activityFilter === 'all' ? 'bg-amber-500 text-amber-950 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              All Customers ({customerStats.length})
            </button>
            <button
              onClick={() => setActivityFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                activityFilter === 'today' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Logged In Today ({summaryKpis.activeToday})</span>
            </button>
            <button
              onClick={() => setActivityFilter('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                activityFilter === 'week' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span>This Week ({summaryKpis.activeThisWeek})</span>
            </button>
            <button
              onClick={() => setActivityFilter('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activityFilter === 'month' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              This Month ({summaryKpis.activeThisMonth})
            </button>
            <button
              onClick={() => setActivityFilter('agent_requested')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activityFilter === 'agent_requested'
                  ? 'bg-amber-500 text-amber-950 font-bold shadow-sm'
                  : 'text-amber-600 hover:text-white hover:bg-slate-800'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>Talk to Agent ({summaryKpis.agentRequestsCount})</span>
            </button>
            <button
              onClick={() => setActivityFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activityFilter === 'inactive' ? 'bg-slate-700 text-slate-300 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards' ? 'bg-amber-500 text-amber-950 shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Cards Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-amber-500 text-amber-950 shadow-sm' : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Detailed Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search, Specific Date Filter, and Sort Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, UID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Specific Date Filter ("Who Logged In on [Date]") */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            <CalendarDays className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-500 block leading-none">Who logged in on date:</span>
              <input
                type="date"
                value={specificDateFilter}
                onChange={(e) => setSpecificDateFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none w-full cursor-pointer"
              />
            </div>
            {specificDateFilter && (
              <button
                onClick={() => setSpecificDateFilter('')}
                className="text-slate-500 hover:text-rose-400 p-0.5"
                title="Clear date filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500/50"
          >
            <option value="all">All Auth Providers</option>
            <option value="Google">Google Sign-in Only</option>
            <option value="Email">Email / Password Only</option>
          </select>

          {/* Sort Option */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs outline-none w-full"
            >
              <option value="recent">Sort: Most Recent Login</option>
              <option value="logins">Sort: Highest Login Count</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="age">Sort: Customer Age</option>
            </select>
          </div>

        </div>

        {/* Filter Summary Banner (if active) */}
        {(specificDateFilter || searchTerm || activityFilter !== 'all' || providerFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-amber-700">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5" />
              <span>
                Showing <strong>{filteredCustomers.length}</strong> of {customerStats.length} customers
                {specificDateFilter && ` who logged in on ${specificDateFilter}`}
              </span>
            </div>
            <button
              onClick={() => {
                setActivityFilter('all');
                setSpecificDateFilter('');
                setProviderFilter('all');
                setSearchTerm('');
              }}
              className="text-[11px] underline hover:text-white"
            >
              Reset all filters
            </button>
          </div>
        )}

      </div>

      {/* ─── CUSTOMER LIST (CARD VIEW OR TABLE VIEW) ─── */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No customer profiles match your current search, date filter, or activity criteria. Try clearing filters.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        // ── CARD GRID VIEW ──
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((item) => {
            const isGoogle = (item.user.auth_provider || '').toLowerCase().includes('google');
            
            // Status badge styling
            const statusConfig = {
              today: { label: 'Active Today', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' },
              week: { label: 'Active This Week', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
              month: { label: 'Active This Month', bg: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
              inactive: { label: 'Inactive (30d+)', bg: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-500' }
            }[item.activityStatus];

            return (
              <div
                key={item.user.uid || item.user.Email_id}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 shadow-lg space-y-4 transition-all hover:shadow-amber-500/5 flex flex-col justify-between"
              >
                {/* Header: Avatar, Name, Email, Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-extrabold text-sm flex items-center justify-center shrink-0 shadow-md">
                        {item.user.Name ? item.user.Name.substring(0, 2).toUpperCase() : 'CU'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{item.user.Name || 'Anonymous Customer'}</h4>
                        <p className="text-xs text-slate-400 font-mono truncate">{item.user.Email_id || 'No email'}</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusConfig.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>

                  {/* Agent Call Request Banner if user requested talk to agent */}
                  {item.user.talk_to_agent_requested && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                          <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide block">Agent Call Requested</span>
                          <span className="text-xs font-mono font-semibold text-white truncate block">
                            {item.user.talk_to_agent_phone || item.user.phone || 'Phone pending'}
                          </span>
                        </div>
                      </div>
                      {(item.user.talk_to_agent_phone || item.user.phone) && (
                        <a
                          href={`tel:${item.user.talk_to_agent_phone || item.user.phone}`}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 transition-colors flex items-center space-x-1 shrink-0 shadow-sm"
                          title="Call customer directly"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Demographic & Auth Tags */}
                  <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
                    {item.user.Age ? (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                        Age: {item.user.Age} yrs
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500">
                        Age: N/A
                      </span>
                    )}

                    {(item.user.talk_to_agent_phone || item.user.phone) && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{item.user.talk_to_agent_phone || item.user.phone}</span>
                      </span>
                    )}

                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border font-semibold ${
                      isGoogle
                        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                        : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                    }`}>
                      <span>{isGoogle ? 'Google OAuth' : 'Email/Password'}</span>
                    </span>

                    {item.user.uid && (
                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                        ID: {item.user.uid.substring(0, 6)}...
                      </span>
                    )}
                  </div>
                </div>

                {/* Statistical Snapshot */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Logins Recorded:</span>
                    <span className="font-extrabold text-amber-600 text-sm">{item.totalLogins} logins</span>
                  </div>

                  {/* Visual Progress / Share of App Logins */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Traffic Share</span>
                      <span className="font-semibold text-slate-300">{item.loginPercentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                        style={{ width: `${Math.min(item.loginPercentage * 4, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/50 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Last Login:</span>
                      <span className="text-slate-200 font-medium block truncate">{getTimeAgo(item.lastLoginDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Member Since:</span>
                      <span className="text-slate-200 font-medium block truncate">
                        {item.firstLoginDate ? new Date(item.firstLoginDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedCustomer(item)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Stats & Timeline</span>
                  </button>
                  {onSelectUserChat && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUserChat(item.user);
                      }}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition-all flex items-center justify-center space-x-1"
                      title="View sequential chat history"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chats</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ── TABLE VIEW ──
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/90 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Contact (Email & Phone)</th>
                  <th className="py-3.5 px-4">Age</th>
                  <th className="py-3.5 px-4">Provider</th>
                  <th className="py-3.5 px-4">Agent Call</th>
                  <th className="py-3.5 px-4">Total Logins</th>
                  <th className="py-3.5 px-4">Traffic Share</th>
                  <th className="py-3.5 px-4">Last Login</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((item) => {
                  const isGoogle = (item.user.auth_provider || '').toLowerCase().includes('google');
                  const statusColors = {
                    today: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                    week: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
                    month: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
                    inactive: 'text-slate-400 bg-slate-800 border-slate-700'
                  }[item.activityStatus];

                  return (
                    <tr key={item.user.uid || item.user.Email_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                            {item.user.Name ? item.user.Name.substring(0, 2).toUpperCase() : 'CU'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{item.user.Name || 'Anonymous'}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">UID: {item.user.uid ? item.user.uid.substring(0, 8) + '...' : 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 text-[11px] truncate max-w-[180px]">{item.user.Email_id || 'N/A'}</div>
                        {(item.user.talk_to_agent_phone || item.user.phone) && (
                          <div className="flex items-center space-x-1 text-emerald-400 font-mono text-[10px] mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{item.user.talk_to_agent_phone || item.user.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        {item.user.Age ? `${item.user.Age} yrs` : 'N/A'}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isGoogle ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                        }`}>
                          {isGoogle ? 'Google' : 'Email'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {item.user.talk_to_agent_requested ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-500/40">
                              <PhoneCall className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                              <span>Requested</span>
                            </span>
                            {(item.user.talk_to_agent_phone || item.user.phone) && (
                              <a
                                href={`tel:${item.user.talk_to_agent_phone || item.user.phone}`}
                                className="p-1 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-700 hover:text-slate-950 transition-colors"
                                title="Direct call"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-amber-600 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-xs">
                          {item.totalLogins}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                        {item.loginPercentage}%
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-200 block">{getTimeAgo(item.lastLoginDate)}</span>
                        <span className="text-[10px] text-slate-500 block">{formatDateTime(item.lastLoginDate).split(',')[0]}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors}`}>
                          {item.activityStatus === 'today' ? 'Active Today' : item.activityStatus === 'week' ? 'This Week' : item.activityStatus === 'month' ? 'This Month' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCustomer(item)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        >
                          View Stats
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CUSTOMER STATISTICAL DETAIL MODAL ─── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-extrabold text-base flex items-center justify-center shadow-lg">
                  {selectedCustomer.user.Name ? selectedCustomer.user.Name.substring(0, 2).toUpperCase() : 'CU'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>{selectedCustomer.user.Name || 'Anonymous Customer'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30">
                      {selectedCustomer.totalLogins} Logins
                    </span>
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5">
                    <span>{selectedCustomer.user.Email_id}</span>
                    {(selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone) && (
                      <span className="text-emerald-400 font-semibold">
                        · {selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {onSelectUserChat && (
                  <button
                    onClick={() => {
                      const u = selectedCustomer.user;
                      setSelectedCustomer(null);
                      onSelectUserChat(u);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>View Chat History</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-500 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Agent Escalation Alert Banner */}
            {selectedCustomer.user.talk_to_agent_requested && (
              <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-700 flex items-center justify-center">
                      <PhoneCall className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-700">Talk to Human Agent Requested</h4>
                      <p className="text-[11px] text-amber-200/70">Customer asked for direct agent phone callback</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                    Urgent Call
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/30 space-y-2">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Customer Phone Number</span>
                    <span className="text-sm font-bold text-white font-mono block">
                      {selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone || 'Phone number not provided'}
                    </span>
                    {(selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone) && (
                      <div className="flex items-center space-x-2 pt-1">
                        <a
                          href={`tel:${selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call Direct</span>
                        </a>
                        <a
                          href={`https://wa.me/${(selectedCustomer.user.talk_to_agent_phone || selectedCustomer.user.phone || '').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/30 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Handoff Reason & Time</span>
                    <span className="text-xs font-semibold text-slate-200 block">
                      {selectedCustomer.user.talk_to_agent_time ? formatDateTime(selectedCustomer.user.talk_to_agent_time) : 'Recent activity'}
                    </span>
                    <p className="text-xs text-amber-700/90 italic pt-1">
                      "{selectedCustomer.user.talk_to_agent_reason || 'Customer selected Talk to Agent from the assistant.'}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Customer Age</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {selectedCustomer.user.Age ? `${selectedCustomer.user.Age} yrs` : 'Not recorded'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Sign-in Method</span>
                <span className="text-sm font-bold text-white mt-0.5 block truncate">
                  {selectedCustomer.user.auth_provider || 'Email'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Logins Today</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {selectedCustomer.loginsToday}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">This Month</span>
                <span className="text-sm font-bold text-violet-300 mt-0.5 block">
                  {selectedCustomer.loginsThisMonth}
                </span>
              </div>
            </div>

            {/* Day of Week Distribution for THIS Customer */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                Login Frequency by Day of Week (Mon - Sun)
              </span>
              <div className="grid grid-cols-7 gap-1 pt-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                  const cnt = selectedCustomer.dayOfWeekCounts[dIdx] || 0;
                  const maxCnt = Math.max(...selectedCustomer.dayOfWeekCounts, 1);
                  const heightPct = Math.max((cnt / maxCnt) * 100, 8);
                  return (
                    <div key={day} className="flex flex-col items-center space-y-1">
                      <span className="text-[10px] text-amber-700 font-bold">{cnt > 0 ? cnt : ''}</span>
                      <div className="w-full bg-slate-900 rounded-lg h-16 flex items-end p-0.5">
                        <div
                          className={`w-full rounded-md transition-all ${
                            cnt > 0 ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-400">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Complete Chronological Timestamps List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Recorded Login Timestamps ({selectedCustomer.timestamps.length})
                </span>
                <span className="text-[10px] text-slate-500">Ordered newest to oldest</span>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800/80 rounded-xl p-2 bg-slate-950">
                {selectedCustomer.timestamps.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No timestamps recorded.</p>
                ) : (
                  selectedCustomer.timestamps.map((ts, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800/60">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-medium">{formatDateTime(ts)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{getTimeAgo(ts)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-500 font-mono text-[10px]">
                UID: {selectedCustomer.user.uid || 'N/A'}
              </span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
