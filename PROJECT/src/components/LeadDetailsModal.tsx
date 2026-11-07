import React from 'react';
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
} from 'lucide-react';
import { TalkHistorySection } from './TalkHistorySection';

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
  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base">
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">{lead.name}</h3>
                {lead.blocked && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                    BLOCKED / OPT-OUT
                  </span>
                )}
                {lead.outcome === 'HOT' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    🔥 HOT LEAD
                  </span>
                )}
                {lead.outcome === 'WARM' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    🟡 WARM
                  </span>
                )}
                {lead.language && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                    <Globe className="w-3 h-3" />
                    <span>{lead.language}</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">{lead.phone}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
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

          {/* User Talk History & Q&A Breakdown Section */}
          <div className="space-y-2">
            <TalkHistorySection
              rawTranscript={lead.transcript}
              qaHistory={lead.qaHistory}
              customerName={lead.name}
              aiName="👧 Priya (Lyka Realty)"
            />
          </div>

          {/* Call Metadata & Recording */}
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
