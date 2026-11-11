import React, { useState } from 'react';
import { Lead, LeadOutcome } from '../types';
import {
  Users,
  PhoneCall,
  Clock,
  Flame,
  Sun,
  Snowflake,
  UserX,
  PhoneMissed,
  PhoneForwarded,
  CheckCircle2,
  Radio,
  Calendar,
  ChevronDown,
  ChevronUp,
  Timer,
  Play,
  Eye,
  TrendingUp,
  Sparkles,
  Phone,
  Filter,
} from 'lucide-react';

interface MetricsCardsProps {
  leads: Lead[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  onViewLead?: (lead: Lead) => void;
  onCallLead?: (lead: Lead) => void;
  onPhysicalCallLead?: (lead: Lead) => void;
}

export function isDateToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function formatDurationDetailed(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  leads,
  activeFilter,
  onSelectFilter,
  onViewLead,
  onCallLead,
  onPhysicalCallLead,
}) => {
  // ─── Today's Calls & Talk Time Calculations ───
  const isTodayCall = (l: Lead) => {
    if (isDateToday(l.callTime)) return true;
    if (
      isDateToday(l.updatedAt) &&
      (l.status === 'Completed' ||
        l.status === 'COMPLETED' ||
        l.status === 'Calling' ||
        (l.callCount && l.callCount > 0))
    ) {
      return true;
    }
    return false;
  };

  const todayLeads = leads
    .filter(isTodayCall)
    .sort((a, b) => {
      const timeA = new Date(a.callTime || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.callTime || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA; // Most recent first
    });

  const todayCallsCount = todayLeads.reduce(
    (acc, l) => acc + (l.callCount && l.callCount > 0 ? l.callCount : 1),
    0
  );

  const todayTotalSeconds = todayLeads.reduce((acc, l) => acc + (l.duration || 0), 0);
  const todayTotalMinutes = Math.floor(todayTotalSeconds / 60);
  const todayRemainingSeconds = todayTotalSeconds % 60;
  const todayMinutesFormatted =
    todayTotalMinutes > 0
      ? `${todayTotalMinutes}m ${todayRemainingSeconds}s`
      : `${todayRemainingSeconds}s`;
  const todayMinutesDecimal = (todayTotalSeconds / 60).toFixed(1);

  const todayAvgSeconds =
    todayCallsCount > 0 ? Math.round(todayTotalSeconds / todayCallsCount) : 0;
  const todayAvgFormatted = formatDurationDetailed(todayAvgSeconds);

  // Today's Outcomes Breakdown
  const todayHotCount = todayLeads.filter((l) => l.outcome === 'HOT').length;
  const todayWarmCount = todayLeads.filter((l) => l.outcome === 'WARM').length;
  const todayColdCount = todayLeads.filter((l) => l.outcome === 'COLD').length;
  const todayOptOutCount = todayLeads.filter(
    (l) => l.outcome === 'OPT-OUT' || l.blocked
  ).length;
  const todayCallbackCount = todayLeads.filter(
    (l) => l.outcome === 'AGENT_CALLBACK'
  ).length;
  const todayNoAnswerCount = todayLeads.filter(
    (l) => l.status === 'No Answer' || l.outcome === 'NO_ANSWER'
  ).length;

  // ─── All-Time / Lifetime Calculations ───
  const totalLeads = leads.length;
  const pendingCount = leads.filter(
    (l) => l.status === 'Pending' || l.status === 'PENDING'
  ).length;
  const callingCount = leads.filter(
    (l) => l.status === 'Calling' || l.status === 'CALLING'
  ).length;
  const completedCount = leads.filter(
    (l) => l.status === 'Completed' || l.status === 'COMPLETED'
  ).length;

  const hotCount = leads.filter((l) => l.outcome === 'HOT').length;
  const warmCount = leads.filter((l) => l.outcome === 'WARM').length;
  const coldCount = leads.filter((l) => l.outcome === 'COLD').length;
  const optOutCount = leads.filter(
    (l) => l.outcome === 'OPT-OUT' || l.blocked
  ).length;
  const agentCallbackCount = leads.filter(
    (l) => l.outcome === 'AGENT_CALLBACK'
  ).length;
  const noAnswerCount = leads.filter(
    (l) => l.status === 'No Answer' || l.outcome === 'NO_ANSWER'
  ).length;

  // Local UI State for expanding today's list
  const [showTodayList, setShowTodayList] = useState<boolean>(true);

  const todayDateFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          1. TODAY'S PERFORMANCE HIGHLIGHT BANNER & STATS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-5">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Today&apos;s Calling Performance
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  {todayDateFormatted}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live telecalling activity, total minutes spoken, and conversion outcomes for today
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSelectFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border ${
                activeFilter === 'TODAY'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{activeFilter === 'TODAY' ? 'Showing Today in Table' : 'Filter Table to Today'}</span>
            </button>

            {todayLeads.length > 0 && (
              <button
                onClick={() => setShowTodayList((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center space-x-1"
              >
                <span>{showTodayList ? 'Hide List' : `View List (${todayLeads.length})`}</span>
                {showTodayList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* 3 Main KPI Metrics for Today */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Calls Called Today */}
          <div
            onClick={() => onSelectFilter('TODAY')}
            className={`cursor-pointer rounded-xl p-4 border transition-all ${
              activeFilter === 'TODAY'
                ? 'bg-slate-800/90 border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Calls Called Today</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                Today
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl sm:text-4xl font-black text-white">{todayCallsCount}</span>
              <span className="text-xs text-slate-400 font-medium">
                {todayCallsCount === 1 ? 'call dialed' : 'calls dialed'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {todayLeads.length} unique customer contacts reached
            </p>
          </div>

          {/* 2. Total Minutes Talked */}
          <div className="rounded-xl p-4 border bg-slate-950/70 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Total Talk Time</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                {todayMinutesDecimal} mins
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400">
                {todayMinutesFormatted}
              </span>
              <span className="text-xs text-slate-400 font-medium">({todayTotalSeconds}s)</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Total duration spent talking to customers today
            </p>
          </div>

          {/* 3. Average Talk Time */}
          <div className="rounded-xl p-4 border bg-slate-950/70 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Timer className="w-3.5 h-3.5" />
                <span>Avg Call Duration</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">
                Avg
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl sm:text-4xl font-black text-cyan-300">
                {todayAvgFormatted}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ call</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Average length of conversation today
            </p>
          </div>
        </div>

        {/* Today's Outcome Breakdown (Hot, Warm, Cold...) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-0.5">
            <span>Today&apos;s Qualification Outcomes:</span>
            <span className="text-[11px] text-slate-500">Click any outcome to filter</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* HOT */}
            <button
              type="button"
              onClick={() => onSelectFilter('HOT')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'HOT'
                  ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                <span className="flex items-center space-x-1">
                  <span>🔥</span>
                  <span>HOT</span>
                </span>
                <Flame className="w-3 h-3 text-rose-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayHotCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Ready for visit</p>
            </button>

            {/* WARM */}
            <button
              type="button"
              onClick={() => onSelectFilter('WARM')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'WARM'
                  ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center space-x-1">
                  <span>🟡</span>
                  <span>WARM</span>
                </span>
                <Sun className="w-3 h-3 text-amber-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayWarmCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Interested</p>
            </button>

            {/* COLD */}
            <button
              type="button"
              onClick={() => onSelectFilter('COLD')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'COLD'
                  ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                <span className="flex items-center space-x-1">
                  <span>🔵</span>
                  <span>COLD</span>
                </span>
                <Snowflake className="w-3 h-3 text-blue-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayColdCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Not interested</p>
            </button>

            {/* CALLBACK */}
            <button
              type="button"
              onClick={() => onSelectFilter('AGENT_CALLBACK')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'AGENT_CALLBACK'
                  ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-purple-400/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span className="flex items-center space-x-1">
                  <span>👤</span>
                  <span>CALLBACK</span>
                </span>
                <PhoneForwarded className="w-3 h-3 text-purple-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayCallbackCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Human requested</p>
            </button>

            {/* OPT-OUT */}
            <button
              type="button"
              onClick={() => onSelectFilter('OPT-OUT')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'OPT-OUT'
                  ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-red-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-red-400">
                <span className="flex items-center space-x-1">
                  <span>⛔</span>
                  <span>OPT-OUT</span>
                </span>
                <UserX className="w-3 h-3 text-red-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayOptOutCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">DNC / Unsubscribe</p>
            </button>

            {/* NO ANSWER */}
            <button
              type="button"
              onClick={() => onSelectFilter('NO_ANSWER')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeFilter === 'NO_ANSWER'
                  ? 'bg-zinc-800 border-zinc-400 ring-2 ring-zinc-400/30'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-zinc-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                <span className="flex items-center space-x-1">
                  <span>☎</span>
                  <span>NO ANSWER</span>
                </span>
                <PhoneMissed className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-white">{todayNoAnswerCount}</div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">Ringing / Unanswered</p>
            </button>
          </div>
        </div>

        {/* ─── TODAY'S CALL LIST WITH TOTAL TALK TIME PER LEAD ─── */}
        {showTodayList && (
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  📋 Today&apos;s Completed Calls &amp; Talk Durations
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  {todayLeads.length} {todayLeads.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Combined duration:{' '}
                <strong className="text-emerald-400 font-bold">{todayMinutesFormatted}</strong>
              </span>
            </div>

            {todayLeads.length === 0 ? (
              <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-xl text-center space-y-2">
                <PhoneCall className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No calls dialed yet today</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click the &quot;Call&quot; button on any lead in the table below or launch the outbound campaign to start calling today.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {todayLeads.map((lead, idx) => {
                  const callDate = new Date(lead.callTime || lead.updatedAt || lead.createdAt || Date.now());
                  const timeStr = callDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const leadDuration = lead.duration || 0;
                  const durationStr = formatDurationDetailed(leadDuration);
                  const durationMinsDecimal = (leadDuration / 60).toFixed(1);

                  return (
                    <div
                      key={lead.id}
                      className="p-3.5 bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      {/* Left: Contact Info & Time */}
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">{lead.name}</span>
                            <span className="text-xs font-mono text-slate-400">{lead.phone}</span>
                            {lead.language && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700">
                                {lead.language}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-400">
                            <span>Called at {timeStr}</span>
                            {lead.location && <span>• {lead.location}</span>}
                            {lead.budget && <span>• {lead.budget}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Duration Pill, Outcome, Actions */}
                      <div className="flex items-center space-x-2 sm:space-x-3 self-end sm:self-auto">
                        {/* Talk Duration Pill */}
                        <div
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center space-x-1"
                          title={`Spoke for ${leadDuration} seconds (${durationMinsDecimal} minutes)`}
                        >
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>{durationStr}</span>
                          <span className="text-[10px] text-emerald-400/80 font-normal">
                            ({durationMinsDecimal}m)
                          </span>
                        </div>

                        {/* Outcome Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            lead.outcome === 'HOT'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : lead.outcome === 'WARM'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : lead.outcome === 'COLD'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : lead.outcome === 'AGENT_CALLBACK'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : lead.outcome === 'OPT-OUT' || lead.blocked
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : 'bg-zinc-700 text-zinc-300 border-zinc-600'
                          }`}
                        >
                          {lead.outcome === 'HOT' && '🔥 HOT'}
                          {lead.outcome === 'WARM' && '🟡 WARM'}
                          {lead.outcome === 'COLD' && '🔵 COLD'}
                          {lead.outcome === 'AGENT_CALLBACK' && '👤 CALLBACK'}
                          {(lead.outcome === 'OPT-OUT' || lead.blocked) && '⛔ OPT-OUT'}
                          {lead.outcome === 'NO_ANSWER' && '☎ NO ANSWER'}
                          {!lead.outcome && 'PENDING'}
                        </span>

                        {/* Action: View Lead Details */}
                        {onViewLead && (
                          <button
                            onClick={() => onViewLead(lead)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center space-x-1"
                            title="View Call Record & Transcript"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Details</span>
                          </button>
                        )}

                        {/* Action: Re-dial / Web Call */}
                        {onCallLead && !lead.blocked && (
                          <button
                            onClick={() => onCallLead(lead)}
                            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors text-xs flex items-center space-x-1"
                            title="Web Browser AI Call"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden md:inline">Web Call</span>
                          </button>
                        )}

                        {/* Action: Twilio Real Call */}
                        {onPhysicalCallLead && !lead.blocked && (
                          <button
                            onClick={() => onPhysicalCallLead(lead)}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors text-xs flex items-center space-x-1 shadow-sm"
                            title="Make real physical phone call via Twilio"
                          >
                            <Radio className="w-3.5 h-3.5 text-blue-400" />
                            <span className="hidden md:inline">Twilio Real Call</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. ALL-TIME / LIFETIME PIPELINE OVERVIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>All-Time Pipeline Overview</span>
          </span>
          <span className="text-xs text-slate-500">Cumulative Database Totals</span>
        </div>

        {/* Primary Pipeline Lifecycle Cards (4 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Leads */}
          <div
            onClick={() => onSelectFilter('ALL')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Leads
              </span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totalLeads}</div>
            <p className="mt-1 text-xs text-slate-400">All customer contacts</p>
          </div>

          {/* Pending */}
          <div
            onClick={() => onSelectFilter('PENDING')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all ${
              activeFilter === 'PENDING'
                ? 'bg-slate-800 border-blue-400 ring-2 ring-blue-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Pending
              </span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-blue-400">{pendingCount}</div>
            <p className="mt-1 text-xs text-slate-400">Awaiting voice call</p>
          </div>

          {/* Calling */}
          <div
            onClick={() => onSelectFilter('CALLING')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all ${
              activeFilter === 'CALLING'
                ? 'bg-slate-800 border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Calling
              </span>
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="mt-2 text-3xl font-black text-amber-400">{callingCount}</div>
            <p className="mt-1 text-xs text-slate-400">Active browser voice calls</p>
          </div>

          {/* Completed */}
          <div
            onClick={() => onSelectFilter('COMPLETED')}
            className={`cursor-pointer rounded-2xl p-4 border transition-all ${
              activeFilter === 'COMPLETED' || activeFilter === 'CALLED'
                ? 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Completed
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-400">{completedCount}</div>
            <p className="mt-1 text-xs text-slate-400">Voice calls completed</p>
          </div>
        </div>

        {/* All-Time Outcome Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* HOT */}
          <button
            type="button"
            onClick={() => onSelectFilter('HOT')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'HOT'
                ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center space-x-1">
                <span>🔥</span>
                <span>HOT</span>
              </span>
              <Flame className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{hotCount}</div>
            <p className="text-[11px] text-slate-400 truncate">High intent &amp; budget</p>
          </button>

          {/* WARM */}
          <button
            type="button"
            onClick={() => onSelectFilter('WARM')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'WARM'
                ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-amber-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                <span>🟡</span>
                <span>WARM</span>
              </span>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{warmCount}</div>
            <p className="text-[11px] text-slate-400 truncate">Interested / Exploring</p>
          </button>

          {/* COLD */}
          <button
            type="button"
            onClick={() => onSelectFilter('COLD')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'COLD'
                ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 flex items-center space-x-1">
                <span>🔵</span>
                <span>COLD</span>
              </span>
              <Snowflake className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{coldCount}</div>
            <p className="text-[11px] text-slate-400 truncate">Not interested / Said no</p>
          </button>

          {/* OPT-OUT */}
          <button
            type="button"
            onClick={() => onSelectFilter('OPT-OUT')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'OPT-OUT'
                ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-red-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-400 flex items-center space-x-1">
                <span>⛔</span>
                <span>OPT-OUT</span>
              </span>
              <UserX className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{optOutCount}</div>
            <p className="text-[11px] text-slate-400 truncate">Blocked permanently</p>
          </button>

          {/* AGENT CALLBACK */}
          <button
            type="button"
            onClick={() => onSelectFilter('AGENT_CALLBACK')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'AGENT_CALLBACK'
                ? 'bg-purple-950/40 border-purple-400 ring-2 ring-purple-400/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-purple-400/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
                <span>👤</span>
                <span>CALLBACK</span>
              </span>
              <PhoneForwarded className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{agentCallbackCount}</div>
            <p className="text-[11px] text-slate-400 truncate">Wants human agent</p>
          </button>

          {/* NO ANSWER */}
          <button
            type="button"
            onClick={() => onSelectFilter('NO_ANSWER')}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              activeFilter === 'NO_ANSWER'
                ? 'bg-zinc-800/70 border-zinc-500 ring-2 ring-zinc-500/20 shadow-md'
                : 'bg-slate-900/90 border-slate-800 hover:border-zinc-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center space-x-1">
                <span>☎</span>
                <span>NO ANSWER</span>
              </span>
              <PhoneMissed className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{noAnswerCount}</div>
            <p className="text-[11px] text-slate-400 truncate">No response / timed out</p>
          </button>
        </div>
      </div>
    </div>
  );
};
