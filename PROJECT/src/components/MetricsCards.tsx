import React from 'react';
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
} from 'lucide-react';

interface MetricsCardsProps {
  leads: Lead[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  leads,
  activeFilter,
  onSelectFilter,
}) => {
  // 10 Exact Dashboard Counts from Firestore data
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

  return (
    <div className="space-y-4">
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

      {/* Outcome Breakdown Cards (6 Categories) */}
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
          <p className="text-[11px] text-slate-400 truncate">High intent & budget</p>
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
  );
};

