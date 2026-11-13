'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Globe,
  MessageSquare,
  FileText,
  PhoneCall,
  Eye,
  Repeat,
} from 'lucide-react';
import { CallRecord, Lead } from '../types';
import { fetchAllCallHistory, fetchUserLanguagesSummary } from '../services/leadService';
import {
  UserLanguageUsageSummary,
  getLanguageBadgeClasses,
  splitLanguagesLabel,
  normalizePhoneForDedupe,
} from '../lib/languageUsage';
import { TalkHistorySection } from './TalkHistorySection';

export function formatDateGroup(isoString?: string): string {
  if (!isoString) return 'Unknown Date';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown Date';

  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (isToday) return `Today — ${formatted}`;
  if (isYesterday) return `Yesterday — ${formatted}`;
  return formatted;
}

export function formatTime(isoString?: string): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function getOutcomeBadge(outcome?: string) {
  const norm = (outcome || 'PENDING').toUpperCase();
  switch (norm) {
    case 'HOT':
      return { bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30', label: 'HOT 🔥' };
    case 'WARM':
      return { bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30', label: 'WARM ☀️' };
    case 'COLD':
      return { bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30', label: 'COLD ❄️' };
    case 'OPT_OUT':
    case 'OPT-OUT':
      return { bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: 'OPT-OUT ⛔' };
    case 'AGENT_CALLBACK':
      return { bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30', label: 'CALLBACK 📞' };
    default:
      return { bg: 'bg-slate-700/30 text-slate-300 border-slate-600', label: norm };
  }
}

function findMatchingLead(leads: Lead[], phone?: string, name?: string): Lead | undefined {
  const cleanDigits = (phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (cleanDigits.length >= 7) {
    const byPhone = leads.find(
      (l) => (l.phone || '').replace(/[^0-9]/g, '').slice(-10) === cleanDigits
    );
    if (byPhone) return byPhone;
  }
  const cleanName = (name || '').trim().toLowerCase();
  if (cleanName) {
    return leads.find((l) => (l.name || '').trim().toLowerCase() === cleanName);
  }
  return undefined;
}

interface UserHistoryPanelProps {
  calls?: CallRecord[];
  userLanguageSummaries?: UserLanguageUsageSummary[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshKey?: number;
  leads?: Lead[];
  onViewLead?: (lead: Lead) => void;
  onCallLead?: (lead: Lead) => void;
  variant?: 'page' | 'modal';
}

export const UserHistoryPanel: React.FC<UserHistoryPanelProps> = ({
  calls: externalCalls,
  userLanguageSummaries: externalSummaries,
  loading: externalLoading,
  onRefresh,
  refreshKey = 0,
  leads = [],
  onViewLead,
  onCallLead,
  variant = 'page',
}) => {
  const isControlled = externalCalls !== undefined;
  const [internalCalls, setInternalCalls] = useState<CallRecord[]>([]);
  const [internalSummaries, setInternalSummaries] = useState<UserLanguageUsageSummary[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('ALL');
  const [historyOutcomeFilter, setHistoryOutcomeFilter] = useState('ALL');
  const [historyLanguageFilter, setHistoryLanguageFilter] = useState('ALL');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [expandedUserKeys, setExpandedUserKeys] = useState<Set<string>>(new Set());
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setInternalLoading(true);
    try {
      const records = await fetchAllCallHistory();
      setInternalCalls(records);
      if (records.length > 0 && records[0].id) {
        setExpandedCallIds(new Set([records[0].id]));
      }
      const summaries = await fetchUserLanguagesSummary(records);
      setInternalSummaries(summaries);
    } catch (err) {
      console.error('Failed to load user history:', err);
    } finally {
      setInternalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isControlled) {
      loadData();
    }
  }, [isControlled, loadData, refreshKey]);

  const callHistory = isControlled ? externalCalls || [] : internalCalls;
  const userLanguageSummaries =
    externalSummaries !== undefined ? externalSummaries : internalSummaries;
  const historyLoading = externalLoading !== undefined ? externalLoading : internalLoading;

  useEffect(() => {
    if (callHistory.length > 0 && callHistory[0].id && expandedCallIds.size === 0) {
      setExpandedCallIds(new Set([callHistory[0].id]));
    }
  }, [callHistory, expandedCallIds.size]);

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      loadData();
    }
  };

  const toggleCallExpand = (id?: string) => {
    if (!id) return;
    setExpandedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUserExpand = (phoneKey: string) => {
    setExpandedUserKeys((prev) => {
      const next = new Set(prev);
      if (next.has(phoneKey)) next.delete(phoneKey);
      else next.add(phoneKey);
      return next;
    });
  };

  const phoneCallFrequency = useMemo(() => {
    const map = new Map<string, number>();
    callHistory.forEach((c) => {
      const key = normalizePhoneForDedupe(c.phone);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [callHistory]);

  const duplicateUserCount = useMemo(() => {
    return userLanguageSummaries.filter((u) => u.isDuplicate || u.totalCalls > 1).length;
  }, [userLanguageSummaries]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    callHistory.forEach((c) => {
      const group = formatDateGroup(c.startedAt);
      if (group && group !== 'Unknown Date') dates.add(group);
    });
    return Array.from(dates);
  }, [callHistory]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    userLanguageSummaries.forEach((row) => row.languages.forEach((l) => langs.add(l)));
    callHistory.forEach((c) => splitLanguagesLabel(c.language).forEach((l) => langs.add(l)));
    return Array.from(langs);
  }, [userLanguageSummaries, callHistory]);

  const filteredUserLanguages = useMemo(() => {
    return userLanguageSummaries.filter((entry) => {
      if (onlyDuplicates && !(entry.isDuplicate || entry.totalCalls > 1)) {
        return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchName = entry.name.toLowerCase().includes(q);
        const matchPhone = entry.phone.toLowerCase().includes(q);
        const matchLang = entry.languages.some((l) => l.toLowerCase().includes(q));
        const matchSummary = entry.summary?.toLowerCase().includes(q);
        const matchHistory = entry.historyText?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchLang && !matchSummary && !matchHistory) {
          return false;
        }
      }

      if (historyLanguageFilter !== 'ALL' && !entry.languages.includes(historyLanguageFilter)) {
        return false;
      }

      if (historyOutcomeFilter !== 'ALL' && entry.latestOutcome) {
        if (entry.latestOutcome.toUpperCase() !== historyOutcomeFilter) {
          return false;
        }
      }

      if (historyDateFilter !== 'ALL' && entry.lastUsedAt) {
        if (formatDateGroup(entry.lastUsedAt) !== historyDateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    userLanguageSummaries,
    onlyDuplicates,
    historySearch,
    historyLanguageFilter,
    historyOutcomeFilter,
    historyDateFilter,
  ]);

  const filteredCalls = useMemo(() => {
    return callHistory.filter((call) => {
      if (onlyDuplicates) {
        const key = normalizePhoneForDedupe(call.phone);
        if (!key || (phoneCallFrequency.get(key) || 0) <= 1) {
          return false;
        }
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchName = call.name?.toLowerCase().includes(q);
        const matchPhone = call.phone?.toLowerCase().includes(q);
        const matchLanguage = call.language?.toLowerCase().includes(q);
        const matchTranscript = call.transcript?.toLowerCase().includes(q);
        const matchSummary = call.summary?.toLowerCase().includes(q);
        const matchLocation = call.qualification?.location?.toLowerCase().includes(q);
        const matchQa = call.qaHistory?.some(
          (item) =>
            item.question?.toLowerCase().includes(q) ||
            item.answer?.toLowerCase().includes(q) ||
            item.stepTitle?.toLowerCase().includes(q)
        );
        if (
          !matchName &&
          !matchPhone &&
          !matchLanguage &&
          !matchTranscript &&
          !matchSummary &&
          !matchLocation &&
          !matchQa
        ) {
          return false;
        }
      }

      if (historyOutcomeFilter !== 'ALL' && (call.outcome || '').toUpperCase() !== historyOutcomeFilter) {
        return false;
      }

      if (historyLanguageFilter !== 'ALL' && !splitLanguagesLabel(call.language).includes(historyLanguageFilter)) {
        return false;
      }

      if (historyDateFilter !== 'ALL' && formatDateGroup(call.startedAt) !== historyDateFilter) {
        return false;
      }

      return true;
    });
  }, [
    callHistory,
    onlyDuplicates,
    phoneCallFrequency,
    historySearch,
    historyOutcomeFilter,
    historyLanguageFilter,
    historyDateFilter,
  ]);

  const groupedCalls = useMemo(() => {
    const groups: { dateGroup: string; isoDate: string; calls: CallRecord[] }[] = [];
    const map = new Map<string, { dateGroup: string; isoDate: string; calls: CallRecord[] }>();

    for (const call of filteredCalls) {
      const dateGroup = formatDateGroup(call.startedAt);
      if (!map.has(dateGroup)) {
        const entry = { dateGroup, isoDate: call.startedAt, calls: [] as CallRecord[] };
        map.set(dateGroup, entry);
        groups.push(entry);
      }
      map.get(dateGroup)!.calls.push(call);
    }

    return groups;
  }, [filteredCalls]);

  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    userLanguageSummaries.forEach((u) => {
      u.languages.forEach((lang) => {
        counts.set(lang, (counts.get(lang) || 0) + 1);
      });
    });
    return Array.from(counts.entries());
  }, [userLanguageSummaries]);

  return (
    <div className="space-y-4 sm:space-y-6 text-xs">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-amber-400" />
            <h4 className={`${variant === 'page' ? 'text-base sm:text-lg' : 'text-sm'} font-bold text-white`}>
              User History, Mobile Numbers & Languages Used
            </h4>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              {filteredUserLanguages.length} users • {filteredCalls.length} calls
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Complete record of customer mobile numbers, languages spoken/switched, Q&amp;A insights, call summaries, and transcripts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={historyLoading}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin text-amber-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Page Variant Top Summary Cards */}
      {variant === 'page' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Tracked Mobile Numbers</span>
              <div className="text-2xl font-black text-white mt-0.5 font-mono">
                {userLanguageSummaries.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <Phone className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Recorded Call Sessions</span>
              <div className="text-2xl font-black text-white mt-0.5 font-mono">
                {callHistory.length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Duplicate Numbers</span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {duplicateUserCount}
                </span>
                <button
                  type="button"
                  onClick={() => setOnlyDuplicates((prev) => !prev)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    onlyDuplicates
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                  title="Toggle duplicates filter"
                >
                  {onlyDuplicates ? 'Active' : 'Filter'}
                </button>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Languages Spoken</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {languageCounts.length > 0 ? (
                languageCounts.map(([lang, count]) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() =>
                      setHistoryLanguageFilter((prev) => (prev === lang ? 'ALL' : lang))
                    }
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-opacity hover:opacity-90 ${getLanguageBadgeClasses(
                      lang
                    )} ${historyLanguageFilter === lang ? 'ring-1 ring-white/50' : ''}`}
                    title="Click to filter by language"
                  >
                    {lang} ({count})
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-slate-500">No languages recorded yet</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search name, phone, language, Q&A..."
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="relative">
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={historyLanguageFilter}
              onChange={(e) => setHistoryLanguageFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Dates</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={historyOutcomeFilter}
              onChange={(e) => setHistoryOutcomeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Outcomes</option>
              <option value="HOT">HOT 🔥</option>
              <option value="WARM">WARM ☀️</option>
              <option value="COLD">COLD ❄️</option>
              <option value="OPT-OUT">OPT-OUT ⛔</option>
              <option value="AGENT_CALLBACK">CALLBACK 📞</option>
            </select>
          </div>
        </div>

        {/* Duplicate Filter Quick Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyDuplicates((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              onlyDuplicates
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Repeat className={`w-3.5 h-3.5 ${onlyDuplicates ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Duplicate Numbers Only ({duplicateUserCount})</span>
          </button>
          {onlyDuplicates && (
            <button
              type="button"
              onClick={() => setOnlyDuplicates(false)}
              className="text-[11px] text-amber-400 hover:underline"
            >
              Clear Duplicates Filter
            </button>
          )}
        </div>
      </div>

      {/* User Directory: Mobile Number + Languages Used + Accumulated History */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <h5 className="text-xs font-bold text-white">User History Directory (Mobile Number &amp; Language Used)</h5>
            <span className="text-[10px] font-mono bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
              {filteredUserLanguages.length} of {userLanguageSummaries.length} users
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Click a row to inspect full user log &amp; details
          </span>
        </div>

        {filteredUserLanguages.length === 0 ? (
          <div className="px-4 py-6 text-[11px] text-slate-500 text-center">
            No matching mobile number &amp; language records found.
          </div>
        ) : (
          <div className={`${variant === 'page' ? 'max-h-[420px]' : 'max-h-64'} overflow-y-auto divide-y divide-slate-800/70`}>
            {filteredUserLanguages.map((entry) => {
              const isUserExpanded = expandedUserKeys.has(entry.phoneKey);
              const matchedLead = leads.length > 0 ? findMatchingLead(leads, entry.phone, entry.name) : undefined;
              const outcomeBadge = entry.latestOutcome ? getOutcomeBadge(entry.latestOutcome) : null;
              const isDuplicateUser = Boolean(entry.isDuplicate || entry.totalCalls > 1);
              const hasExtraDetails = Boolean(
                entry.summary ||
                  entry.qualificationText ||
                  entry.qaPairsText ||
                  entry.historyText ||
                  matchedLead ||
                  (entry.callSessions && entry.callSessions.length > 0)
              );

              return (
                <div key={entry.phoneKey} className="bg-slate-950/30">
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => hasExtraDetails && toggleUserExpand(entry.phoneKey)}
                      className="flex items-center space-x-3 min-w-0 text-left flex-1"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white">
                            {entry.phone}
                          </span>
                          <span className="text-[11px] text-slate-300 font-medium truncate">
                            {entry.name}
                          </span>
                          {isDuplicateUser && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                              <Repeat className="w-3 h-3" />
                              <span>Duplicate ({entry.duplicateCount || entry.totalCalls} entries)</span>
                            </span>
                          )}
                          {outcomeBadge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${outcomeBadge.bg}`}>
                              {outcomeBadge.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="font-semibold text-amber-300">
                            Calling Times: {entry.totalCalls}x ({entry.totalCalls === 1 ? '1 call' : `${entry.totalCalls} calls`})
                          </span>
                          {entry.lastUsedAt && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1 text-slate-300">
                                <Clock className="w-3 h-3 text-slate-500 inline" />
                                <span>Last Called: {formatDateGroup(entry.lastUsedAt)} at {formatTime(entry.lastUsedAt)}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0">
                      {entry.languages.map((lang) => (
                        <span
                          key={lang}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getLanguageBadgeClasses(lang)}`}
                        >
                          {lang}
                        </span>
                      ))}
                      {matchedLead && onViewLead && (
                        <button
                          type="button"
                          onClick={() => onViewLead(matchedLead)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          title="View Lead Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {matchedLead && onCallLead && !matchedLead.blocked && matchedLead.consent && (
                        <button
                          type="button"
                          onClick={() => onCallLead(matchedLead)}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                          title="Call User Again"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasExtraDetails && (
                        <button
                          type="button"
                          onClick={() => toggleUserExpand(entry.phoneKey)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white"
                          title={isUserExpanded ? 'Hide User Log' : 'Show User Log'}
                        >
                          {isUserExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUserExpanded && hasExtraDetails && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 bg-slate-900/50 space-y-3">
                      {/* Calling Times & Session History Timeline */}
                      {entry.callSessions && entry.callSessions.length > 0 && (
                        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Calling Times &amp; Session History ({entry.callSessions.length} total)</span>
                            </span>
                            {entry.callSessions.length > 1 && (
                              <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                🔁 Repeated Number
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {entry.callSessions.map((session, sIdx) => {
                              const sBadge = session.outcome ? getOutcomeBadge(session.outcome) : null;
                              return (
                                <div
                                  key={session.id || sIdx}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-slate-900/60 border border-slate-800/60 text-xs"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                      Call #{entry.callSessions!.length - sIdx}
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                      {formatDateGroup(session.startedAt)}
                                    </span>
                                    <span className="text-slate-400 font-mono text-[11px]">
                                      at {formatTime(session.startedAt)}
                                    </span>
                                    {session.duration !== undefined && session.duration > 0 && (
                                      <span className="text-[10px] text-slate-500">
                                        ({formatDuration(session.duration)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1.5">
                                    {session.language && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getLanguageBadgeClasses(session.language)}`}>
                                        {session.language}
                                      </span>
                                    )}
                                    {sBadge && (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sBadge.bg}`}>
                                        {sBadge.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {entry.qualificationText && (
                        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                            Qualification Criteria
                          </span>
                          <p className="text-xs text-slate-200">{entry.qualificationText}</p>
                        </div>
                      )}

                      {entry.summary && (
                        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Latest Call Summary
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed">{entry.summary}</p>
                        </div>
                      )}

                      {entry.qaPairsText && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                            Accumulated Q&amp;A Log
                          </span>
                          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-44 overflow-y-auto leading-relaxed">
                            {entry.qaPairsText}
                          </pre>
                        </div>
                      )}

                      {entry.historyText && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1 mb-1">
                            <FileText className="w-3 h-3" />
                            <span>Full Stored Session History</span>
                          </span>
                          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-56 overflow-y-auto leading-relaxed">
                            {entry.historyText}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Call List Grouped by Date */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            All Call Sessions &amp; Transcripts ({filteredCalls.length})
          </h5>
        </div>

        {historyLoading ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
            <p>Loading conversation records...</p>
          </div>
        ) : groupedCalls.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No Call History Found</p>
            <p className="text-xs text-slate-500">
              {historySearch ||
              historyOutcomeFilter !== 'ALL' ||
              historyDateFilter !== 'ALL' ||
              historyLanguageFilter !== 'ALL'
                ? 'Try clearing the search or filters.'
                : 'Completed browser calls and customer turns will be recorded here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedCalls.map((group) => (
              <div key={group.dateGroup} className="space-y-3">
                <div className="flex items-center space-x-2 sticky top-0 bg-slate-950/90 backdrop-blur-sm py-1.5 z-10 border-b border-slate-800/60">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                    {group.dateGroup}
                  </span>
                  <span className="text-[10px] text-slate-500">({group.calls.length} calls)</span>
                </div>

                <div className="space-y-2.5">
                  {group.calls.map((call, idx) => {
                    const callKey = call.id || `${group.dateGroup}_${idx}`;
                    const isExpanded = expandedCallIds.has(callKey);
                    const badge = getOutcomeBadge(call.outcome);
                    const qual = call.qualification;
                    const qualParts = [
                      qual?.location ? `Location: ${qual.location}` : '',
                      qual?.budget ? `Budget: ${qual.budget}` : '',
                      qual?.timeline ? `Timeline: ${qual.timeline}` : '',
                      qual?.buyerOrInvestor && qual.buyerOrInvestor !== 'unspecified'
                        ? `Profile: ${qual.buyerOrInvestor}`
                        : '',
                    ].filter(Boolean);

                    return (
                      <div
                        key={callKey}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-colors overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCallExpand(callKey)}
                          className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                              <User className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white text-xs truncate">
                                  {call.name || 'Anonymous Customer'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {call.phone || 'No Phone'}
                                </span>
                                {call.phone && (phoneCallFrequency.get(normalizePhoneForDedupe(call.phone) || '') || 0) > 1 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 flex items-center space-x-1">
                                    <Repeat className="w-2.5 h-2.5" />
                                    <span>Repeat Number ({phoneCallFrequency.get(normalizePhoneForDedupe(call.phone) || '')} calls)</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-0.5">
                                <span className="flex items-center space-x-1 text-amber-300/90 font-medium">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Calling Time: {formatTime(call.startedAt)}</span>
                                </span>
                                <span>•</span>
                                <span>Duration: {formatDuration(call.duration)}</span>
                                {call.language && (
                                  <div className="flex flex-wrap items-center gap-1 ml-1">
                                    {splitLanguagesLabel(call.language).map((lang) => (
                                      <span
                                        key={lang}
                                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getLanguageBadgeClasses(
                                          lang
                                        )}`}
                                      >
                                        {lang}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 bg-slate-950/80 space-y-3.5">
                            {qualParts.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {qualParts.map((item) => (
                                  <span
                                    key={item}
                                    className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-md"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}

                            {call.summary && (
                              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                  Call Summary
                                </span>
                                <p className="text-xs text-slate-200 leading-relaxed">{call.summary}</p>
                              </div>
                            )}

                            {call.qaHistory && call.qaHistory.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-2">
                                  Questions &amp; Answers Log ({call.qaHistory.length})
                                </span>
                                <TalkHistorySection qaHistory={call.qaHistory} />
                              </div>
                            )}

                            {call.transcript && (
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                  Full Dialogue Transcript
                                </span>
                                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                                  {call.transcript}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
