import React, { useState } from 'react';
import { Lead, LeadOutcome } from '../types';
import {
  Phone,
  Search,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Flame,
  Clock,
  ArrowRight,
  ExternalLink,
  MoreVertical,
  Check,
  Ban,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { TalkHistorySection, parseTranscriptToQAPairs } from './TalkHistorySection';

interface LeadsTableProps {
  leads: Lead[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  onCallLead: (lead: Lead) => void;
  onViewLead: (lead: Lead) => void;
  onToggleBlock: (lead: Lead) => void;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  activeFilter,
  onSelectFilter,
  onCallLead,
  onViewLead,
  onToggleBlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  const toggleExpandLead = (leadId: string) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  // Filtering
  const filteredLeads = leads.filter((lead) => {
    // 1. Search Query
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      lead.name.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q) ||
      (lead.location && lead.location.toLowerCase().includes(q)) ||
      (lead.summary && lead.summary.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // 2. Tab Filter
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'CALLED' || activeFilter === 'COMPLETED')
      return lead.status === 'Completed' || lead.status === 'COMPLETED';
    if (activeFilter === 'PENDING')
      return lead.status === 'Pending' || lead.status === 'PENDING';
    if (activeFilter === 'CALLING')
      return lead.status === 'Calling' || lead.status === 'CALLING';
    if (activeFilter === 'HOT') return lead.outcome === 'HOT';
    if (activeFilter === 'WARM') return lead.outcome === 'WARM';
    if (activeFilter === 'COLD') return lead.outcome === 'COLD';
    if (activeFilter === 'OPT-OUT') return lead.outcome === 'OPT-OUT' || lead.blocked;
    if (activeFilter === 'NO_ANSWER')
      return lead.status === 'No Answer' || lead.outcome === 'NO_ANSWER';
    if (activeFilter === 'AGENT_CALLBACK') return lead.outcome === 'AGENT_CALLBACK';
    return true;
  });

  const getOutcomeBadge = (lead: Lead) => {
    if (lead.blocked) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-950 text-red-400 border border-red-800">
          ⛔ BLOCKED
        </span>
      );
    }
    if (lead.status === 'Calling' || lead.status === 'CALLING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
          📞 Calling...
        </span>
      );
    }
    if (lead.status === 'No Answer' || lead.outcome === 'NO_ANSWER') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
          <span>☎</span>
          <span>NO ANSWER</span>
        </span>
      );
    }
    switch (lead.outcome) {
      case 'HOT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span>🔥</span>
            <span>HOT</span>
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span>🟡</span>
            <span>WARM</span>
          </span>
        );
      case 'COLD':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <span>🔵</span>
            <span>COLD</span>
          </span>
        );
      case 'OPT-OUT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <span>⛔</span>
            <span>OPT-OUT</span>
          </span>
        );
      case 'AGENT_CALLBACK':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span>👤</span>
            <span>CALLBACK</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Top Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Leads' },
            { id: 'HOT', label: '🔥 HOT' },
            { id: 'WARM', label: '🟡 WARM' },
            { id: 'COLD', label: '🔵 COLD' },
            { id: 'OPT-OUT', label: '⛔ OPT-OUT' },
            { id: 'NO_ANSWER', label: '☎ No Answer' },
            { id: 'AGENT_CALLBACK', label: '👤 Agent Callback' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === tab.id
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, city..."
            className="w-full bg-slate-950/80 border border-slate-700 text-slate-100 pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/50 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3.5">Lead / Contact</th>
              <th className="px-4 py-3.5">Consent & DNC</th>
              <th className="px-4 py-3.5">AI Classification</th>
              <th className="px-4 py-3.5">Qualification Highlights</th>
              <th className="px-4 py-3.5">Recommended Next Action</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <div className="max-w-sm mx-auto space-y-2">
                    <p className="text-sm font-semibold text-slate-300">No leads found in this view</p>
                    <p className="text-xs text-slate-400">
                      Upload a CSV file containing authorized phone numbers or change your filter.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const isCallable = lead.consent && !lead.blocked && lead.status !== 'CALLING';
                const isExpanded = expandedLeadIds.has(lead.id);
                const qaPairs = parseTranscriptToQAPairs(undefined, lead.transcript, lead.qaHistory);

                return (
                  <React.Fragment key={lead.id}>
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors ${
                        lead.outcome === 'HOT' ? 'bg-rose-950/10' : ''
                      } ${lead.blocked ? 'opacity-60 bg-red-950/10' : ''} ${
                        isExpanded ? 'bg-slate-800/50 border-l-2 border-amber-400' : ''
                      }`}
                    >
                      {/* Lead Contact Info */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white text-sm">{lead.name}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">{lead.phone}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {lead.language && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              🌐 {lead.language}
                            </span>
                          )}
                          {lead.callCount && lead.callCount > 0 ? (
                            <span className="text-[10px] text-slate-400">
                              Calls: {lead.callCount} {lead.duration ? `• ${lead.duration}s` : ''}
                            </span>
                          ) : null}
                          {lead.recordingReference && (
                            <span
                              className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              title="Call recording available in Supabase Storage"
                            >
                              <Volume2 className="w-2.5 h-2.5 mr-0.5" />
                              <span>Audio</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Consent & DNC Blocked status */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            {lead.consent ? (
                              <span className="inline-flex items-center text-emerald-400 text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                Consent: True
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-rose-400 text-[11px]">
                                <XCircle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                                No Consent
                              </span>
                            )}
                          </div>

                          {lead.blocked ? (
                            <span className="inline-flex items-center text-red-400 text-[11px] font-medium">
                              <Ban className="w-3 h-3 mr-1 text-red-400" />
                              Blocked (DNC)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Blocked: False</span>
                          )}
                        </div>
                      </td>

                      {/* Outcome Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getOutcomeBadge(lead)}
                        {lead.callTime && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(lead.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Qualification Highlights (Crucial for HOT/WARM leads) */}
                      <td className="px-4 py-3.5 max-w-xs">
                        {lead.outcome === 'HOT' || lead.outcome === 'WARM' || lead.buyerOrInvestor ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-[11px]">
                              <span className="text-slate-400">Profile:</span>
                              <span className="font-semibold text-amber-300 capitalize">
                                {lead.buyerOrInvestor || 'Buyer'}
                              </span>
                            </div>
                            {lead.location && (
                              <div className="flex items-center space-x-2 text-[11px]">
                                <span className="text-slate-400">Location:</span>
                                <span className="text-slate-200">{lead.location}</span>
                              </div>
                            )}
                            {lead.timeline && (
                              <div className="flex items-center space-x-2 text-[11px]">
                                <span className="text-slate-400">Timeline:</span>
                                <span className="text-slate-300">{lead.timeline}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            {lead.summary || (lead.status === 'PENDING' ? 'Awaiting qualification' : 'No details recorded')}
                          </span>
                        )}

                        {qaPairs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandLead(lead.id)}
                            className={`mt-2 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                              isExpanded
                                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm font-bold'
                                : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
                            }`}
                            title="Click to view what AI asked vs what user told"
                          >
                            <MessageSquare className="w-3 h-3 text-amber-400" />
                            <span>{isExpanded ? 'Hide Customer Q&A' : `View User Told Q&A (${qaPairs.length} turns)`}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </td>

                      {/* Next Action */}
                      <td className="px-4 py-3.5 max-w-xs">
                        {lead.nextAction ? (
                          <div className="text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            {lead.nextAction}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending call completion</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Call Now button */}
                          <button
                            onClick={() => onCallLead(lead)}
                            disabled={!isCallable}
                            className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
                              isCallable
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-600 border border-slate-700/50 cursor-not-allowed'
                            }`}
                            title={
                              isCallable
                                ? 'Trigger outbound AI voice call'
                                : lead.blocked
                                ? 'Blocked: Number requested opt-out'
                                : 'Not callable'
                            }
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Call</span>
                          </button>

                          {/* View Q&A Toggle button */}
                          <button
                            type="button"
                            onClick={() => toggleExpandLead(lead.id)}
                            className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isExpanded
                                ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                                : qaPairs.length > 0
                                ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
                                : 'bg-slate-800 text-slate-600 border-slate-700/50 cursor-not-allowed'
                            }`}
                            disabled={qaPairs.length === 0 && !lead.transcript}
                            title={qaPairs.length > 0 ? `View ${qaPairs.length} Q&A Turns (What user told)` : 'No conversation recorded yet'}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* View Details */}
                          <button
                            onClick={() => onViewLead(lead)}
                            className="p-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors"
                            title="View full lead details and qualification metadata"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Block */}
                          <button
                            onClick={() => onToggleBlock(lead)}
                            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                              lead.blocked
                                ? 'bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700'
                                : 'bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700'
                            }`}
                            title={lead.blocked ? 'Unblock lead' : 'Block / Add to DNC'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Expandable Q&A Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-950 border-b border-amber-500/40 animate-in fade-in duration-200">
                        <td colSpan={6} className="p-4 sm:p-5">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                                    <span>Questions Asked & What {lead.name} Told</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                      {qaPairs.length} Q&A Turns Captured
                                    </span>
                                  </h4>
                                  <p className="text-[10px] text-slate-400">
                                    Full conversation breakdown stored for {lead.name} ({lead.phone})
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onViewLead(lead)}
                                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                              >
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span>Full Details Modal</span>
                              </button>
                            </div>

                            <TalkHistorySection
                              rawTranscript={lead.transcript}
                              qaHistory={lead.qaHistory}
                              customerName={lead.name}
                              aiName="👧 Priya (Lyka Realty)"
                              compact={true}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
