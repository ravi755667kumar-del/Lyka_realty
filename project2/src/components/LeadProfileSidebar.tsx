import React from 'react';
import { 
  LeadProfile, 
  LeadPriority, 
  LeadStatus 
} from '../types/crm';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Coins, 
  Home, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  UserCheck, 
  Share2, 
  Zap, 
  FileText,
  BadgeAlert
} from 'lucide-react';

interface LeadProfileSidebarProps {
  lead: LeadProfile;
  onUpdateLead: (updated: Partial<LeadProfile>) => void;
  onTriggerHandoff: () => void;
  onScheduleViewing: () => void;
  onClose?: () => void;
}

export const LeadProfileSidebar: React.FC<LeadProfileSidebarProps> = ({
  lead,
  onUpdateLead,
  onTriggerHandoff,
  onScheduleViewing,
  onClose
}) => {
  const formatAED = (amount: number | null | undefined) => {
    if (!amount) return 'Not set';
    if (amount >= 1000000) {
      return `AED ${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `AED ${(amount / 1000).toFixed(0)}k`;
    }
    return `AED ${amount.toLocaleString()}`;
  };

  const getPriorityColor = (priority: LeadPriority) => {
    switch (priority) {
      case 'Urgent': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'High': return 'bg-amber-500/20 text-amber-700 border-amber-500/30';
      case 'Medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'Qualified': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Viewing': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Interested': return 'bg-amber-500/20 text-amber-700 border-amber-500/30';
      case 'Negotiation': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="w-full sm:w-96 fixed sm:static inset-y-0 right-0 z-40 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-y-auto p-4 space-y-4 shadow-2xl sm:shadow-none">
      {/* Header Profile Title */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono tracking-wider text-amber-600 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-bold">
            {lead.id}
          </span>
          <div className="flex items-center space-x-1.5">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${getPriorityColor(lead.lead_priority)}`}>
              {lead.lead_priority}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${getStatusColor(lead.lead_status)}`}>
              {lead.lead_status}
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-300 rounded-lg transition-colors ml-1"
                title="Close CRM profile"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-amber-600 font-bold">
            {lead.full_name ? lead.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5 text-slate-400" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-300 leading-tight">
              {lead.full_name || 'Prospect Client'}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {lead.customer_type} • {lead.intent}
            </p>
          </div>
        </div>

        {/* Completeness Bar */}
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium">Requirement Completeness</span>
            <span className="font-bold text-amber-600">{lead.requirement_completeness}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${lead.requirement_completeness}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Human Handoff Banner if triggered */}
      {lead.human_handoff_required && (
        <div className="bg-rose-950/40 border border-rose-500/40 p-3 rounded-xl">
          <div className="flex items-start space-x-2">
            <BadgeAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-200">Human Agent Hand-off Required</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                {lead.handoff_reason || 'Client requested direct agent coordination or viewing.'}
              </p>
              <p className="text-[11px] text-slate-300 mt-1">
                Assigned: <span className="font-semibold text-slate-300">{lead.assigned_agent}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary Extracted Fields */}
      <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center space-x-1.5">
          <FileText className="w-3.5 h-3.5 text-amber-600" />
          <span>Extracted CRM Profile</span>
        </h4>

        {/* Budget */}
        <div className="flex items-start space-x-2 text-xs">
          <Coins className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-slate-400 block text-[11px]">Budget Range</span>
            <span className="font-bold text-slate-300">
              {lead.budget_max ? `${formatAED(lead.budget_min)} - ${formatAED(lead.budget_max)}` : 'In discussion...'}
            </span>
          </div>
        </div>

        {/* Communities */}
        <div className="flex items-start space-x-2 text-xs">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-slate-400 block text-[11px]">Preferred Communities</span>
            {lead.preferred_communities && lead.preferred_communities.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {lead.preferred_communities.map((comm, idx) => (
                  <span key={idx} className="bg-slate-700/80 text-amber-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-600">
                    {comm}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 italic">Open / Location not confirmed</span>
            )}
          </div>
        </div>

        {/* Property Type & Bedrooms */}
        <div className="flex items-start space-x-2 text-xs">
          <Home className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-slate-400 block text-[11px]">Type & Configuration</span>
            <span className="font-semibold text-slate-300">
              {lead.property_type || 'Unspecified Type'} • {lead.bedrooms ? `${lead.bedrooms} Bedroom` : 'Beds TBD'}
            </span>
          </div>
        </div>

        {/* Status: Ready vs Off-plan */}
        <div className="flex items-start space-x-2 text-xs">
          <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-slate-400 block text-[11px]">Timeline & Status</span>
            <span className="font-medium text-slate-200">
              {lead.ready_or_offplan || 'Ready / Off-plan'} {lead.timeline ? `(${lead.timeline})` : ''}
            </span>
          </div>
        </div>

        {/* Purpose / Financing */}
        <div className="flex items-start space-x-2 text-xs">
          <Zap className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-slate-400 block text-[11px]">Purpose & Funding</span>
            <span className="font-medium text-slate-200">
              Purpose: {lead.purpose || 'Not stated'} • Financing: {lead.financing || 'Cash / Mortgage'}
            </span>
          </div>
        </div>

        {/* Contact info */}
        <div className="pt-2 border-t border-slate-700/50 space-y-1.5 text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{lead.phone || 'Phone: Not provided yet'}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{lead.email || 'Email: Not provided yet'}</span>
          </div>
        </div>
      </div>

      {/* Information Still Missing */}
      <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
        <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
          <span>Information Still Needed</span>
          <span className="text-[10px] text-amber-600 font-bold">{lead.missing_fields.length} items</span>
        </h4>
        {lead.missing_fields.length === 0 ? (
          <div className="flex items-center space-x-2 text-xs text-emerald-400 py-1">
            <CheckCircle className="w-4 h-4" />
            <span>Profile 100% complete & qualified!</span>
          </div>
        ) : (
          <ul className="space-y-1 text-xs">
            {lead.missing_fields.map((field, idx) => (
              <li key={idx} className="flex items-center space-x-1.5 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onScheduleViewing}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-all"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Property Viewing</span>
        </button>

        <button
          onClick={onTriggerHandoff}
          className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-xl text-xs transition-colors"
        >
          <UserCheck className="w-4 h-4 text-amber-600" />
          <span>Handoff to {lead.assigned_agent.split(' ')[0]}</span>
        </button>
      </div>

      {/* Assigned Agent Footer */}
      <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Assigned Lyka Agent</span>
          <span className="font-bold text-slate-300 text-xs">{lead.assigned_agent}</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Active on CRM"></span>
      </div>
    </div>
  );
};
