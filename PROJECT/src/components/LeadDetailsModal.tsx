import React, { useState, useEffect } from 'react';
import { Lead } from '../types';
import {
  X,
  Phone,
  Clock,
  MapPin,
  DollarSign,
  Calendar,
  Briefcase,
  Play,
  FileText,
  Ban,
  CheckCircle,
  ExternalLink,
  Bot,
  User,
  Trash2,
  Globe,
  Database,
  Copy,
  Check,
  History,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TalkHistorySection } from './TalkHistorySection';
import { fetchUserHistory } from '../services/leadService';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onCallLead: (lead: Lead) => void;
  onToggleBlock: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
}

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  lead,
  isOpen,
  onClose,
  onCallLead,
  onToggleBlock,
  onDeleteLead,
}) => {
  const [dbHistory, setDbHistory] = useState<any | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'database'>('current');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && lead && (lead.phone || lead.name)) {
      setIsLoadingHistory(true);
      fetchUserHistory(lead.phone, lead.name)
        .then((hist) => {
          setDbHistory(hist);
        })
        .catch(() => setDbHistory(null))
        .finally(() => setIsLoadingHistory(false));
    } else {
      setDbHistory(null);
    }
  }, [isOpen, lead]);

  const handleCopyHistory = () => {
    if (!dbHistory?.history_text) return;
    navigator.clipboard.writeText(dbHistory.history_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base shrink-0">
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{lead.name}</h3>
                {lead.blocked && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800 shrink-0">
                    BLOCKED / OPT-OUT
                  </span>
                )}
                {lead.outcome === 'HOT' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                    🔥 HOT LEAD
                  </span>
                )}
                {lead.outcome === 'WARM' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    🟡 WARM
                  </span>
                )}
                {lead.language && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1 shrink-0">
                    <Globe className="w-3 h-3" />
                    <span>{lead.language}</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono block mt-0.5">{lead.phone}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => onCallLead(lead)}
              disabled={!lead.consent || lead.blocked}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                lead.consent && !lead.blocked
                  ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Outbound</span>
            </button>

            <button
              onClick={() => onToggleBlock(lead)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={lead.blocked ? 'Unblock lead' : 'Add to DNC / Block'}
            >
              <Ban className="w-4 h-4 text-red-400" />
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Delete lead ${lead.name}?`)) {
                  onDeleteLead(lead.id);
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Delete lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Key Qualification Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Language</span>
              </div>
              <div className="text-sm font-bold text-white capitalize">
                {lead.language || 'English'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Profile Type</span>
              </div>
              <div className="text-sm font-bold text-white capitalize">
                {lead.buyerOrInvestor || 'Unspecified'}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Budget Range</span>
              </div>
              <div className="text-sm font-bold text-white">{lead.budget || 'Not specified'}</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Location</span>
              </div>
              <div className="text-sm font-bold text-white">{lead.location || 'Not specified'}</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Timeline</span>
              </div>
              <div className="text-sm font-bold text-white">{lead.timeline || 'Not specified'}</div>
            </div>
          </div>

          {/* AI Qualification Summary & Recommended Next Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Conversation Summary
              </span>
              <p className="text-slate-200 text-xs leading-relaxed">
                {lead.summary || 'Call has not been completed yet.'}
              </p>
            </div>

            <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/20 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Recommended Next Action
              </span>
              <p className="text-amber-200 text-xs font-medium leading-relaxed">
                {lead.nextAction || 'Pending call completion and automated lead classification.'}
              </p>
            </div>
          </div>

          {/* Sales Manager Live Dispatch Status (Firebase Synchronized) */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-purple-950/40 p-4 rounded-xl border border-blue-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center space-x-1.5">
                <span>🎯</span>
                <span>Sales Manager Live Dispatch &amp; Firebase Sync</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Auto-Synced to Firebase CRM</span>
              </span>
            </div>
            <div className="text-xs text-slate-200 flex flex-wrap items-center gap-3">
              {lead.outcome === 'HOT' && (
                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  🔥 Hot Lead — Immediate Site Visit Follow-up
                </span>
              )}
              {lead.outcome === 'WARM' && (
                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  🟡 Warm Lead — Send WhatsApp Brochure
                </span>
              )}
              {lead.outcome === 'AGENT_CALLBACK' && (
                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  👤 Human Callback Requested
                </span>
              )}
              {lead.callTime && (
                <span className="text-slate-400 text-[11px]">
                  Called at: <strong className="text-white">{new Date(lead.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </span>
              )}
              {lead.duration !== undefined && (
                <span className="text-slate-400 text-[11px]">
                  Spoke for: <strong className="text-emerald-400">{Math.floor(lead.duration / 60)}m {lead.duration % 60}s ({lead.duration}s)</strong>
                </span>
              )}
            </div>
          </div>

          {/* User History Tabs: Current Call vs Database Cumulative History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('current')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'current'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Current Call</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'database'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>DB User History (Text)</span>
                  {dbHistory?.total_calls ? (
                    <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-200 rounded-full text-[10px] font-mono">
                      {dbHistory.total_calls} {dbHistory.total_calls === 1 ? 'call' : 'calls'}
                    </span>
                  ) : null}
                </button>
              </div>

              {activeTab === 'database' && dbHistory?.history_text && (
                <button
                  type="button"
                  onClick={handleCopyHistory}
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                  title="Copy full accumulated plain text history"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              )}
            </div>

            {activeTab === 'current' ? (
              <TalkHistorySection
                rawTranscript={lead.transcript}
                qaHistory={lead.qaHistory}
                customerName={lead.name}
                aiName="👧 Priya (Lyka Realty)"
              />
            ) : (
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3">
                {isLoadingHistory ? (
                  <div className="py-8 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <History className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Loading database history for {lead.name}...</span>
                  </div>
                ) : dbHistory ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]">
                      <div className="flex items-center space-x-3 text-slate-300">
                        <span>
                          User:{' '}
                          <strong className="text-white">{dbHistory.name}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Mobile:{' '}
                          <strong className="text-white font-mono">{dbHistory.phone}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Total Calls:{' '}
                          <strong className="text-amber-400 font-bold">{dbHistory.total_calls}</strong>
                        </span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Last call:{' '}
                        <span className="text-slate-300 font-mono">
                          {dbHistory.last_call_at
                            ? new Date(dbHistory.last_call_at).toLocaleString()
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {dbHistory.qualification_text && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-200 text-xs font-mono">
                        <strong className="text-emerald-400">Latest Qualification: </strong>
                        {dbHistory.qualification_text}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                        <span>Cumulative Call History (Stored in Pure Text)</span>
                        <span className="text-emerald-400 font-mono">Format: TEXT (No Binary)</span>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto rounded-lg bg-slate-900 border border-slate-800/80 p-3.5 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed selection:bg-blue-500/30 selection:text-white">
                        {dbHistory.history_text}
                      </div>
                    </div>

                    {dbHistory.qa_pairs_text && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Aggregated Q&A Exchange Breakdown (Plain Text)
                        </span>
                        <div className="max-h-[220px] overflow-y-auto rounded-lg bg-slate-900/60 border border-slate-800 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {dbHistory.qa_pairs_text}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <Database className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No previous call history found in DB</p>
                    <p className="text-xs text-slate-500 mt-1">
                      When this lead completes calls, their history will automatically accumulate here in pure text format under {lead.name} ({lead.phone}).
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Call Recording Section (Supabase Storage: voice-recordings) */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Call Recording
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Supabase Storage: voice-recordings
                </span>
              </div>
              {lead.recordingReference && (
                <a
                  href={lead.recordingReference}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Audio File</span>
                </a>
              )}
            </div>

            {lead.recordingReference ? (
              <div className="space-y-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
                <audio
                  controls
                  src={lead.recordingReference}
                  className="w-full h-9 rounded-lg"
                />
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  File URL:{' '}
                  <a
                    href={lead.recordingReference}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {lead.recordingReference}
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-400 text-xs flex items-center space-x-2">
                <VolumeX className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>
                  No call recording file found. When an outbound call is placed, the session is recorded in real-time and stored in your Supabase Storage bucket <code>voice-recordings</code>.
                </span>
              </div>
            )}
          </div>

          {/* Call Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center space-x-4">
              <span>
                Call Duration:{' '}
                <strong className="text-white">{lead.duration !== undefined ? `${lead.duration}s` : '—'}</strong>
              </span>
              <span>•</span>
              <span>
                Call Time:{' '}
                <strong className="text-white">
                  {lead.callTime ? new Date(lead.callTime).toLocaleString() : 'Not called yet'}
                </strong>
              </span>
              {lead.vapiCallId && (
                <>
                  <span>•</span>
                  <span>
                    Vapi Call ID: <strong className="text-slate-300 font-mono">{lead.vapiCallId}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
