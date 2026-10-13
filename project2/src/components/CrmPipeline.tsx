import React, { useState } from 'react';
import { 
  LeadProfile, 
  LeadStatus, 
  LeadPriority, 
  FollowUpTask 
} from '../types/crm';
import { 
  Kanban, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Phone, 
  Mail, 
  UserCheck, 
  Download, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Coins, 
  MapPin, 
  AlertTriangle,
  X
} from 'lucide-react';

interface CrmPipelineProps {
  leads: LeadProfile[];
  followUps: FollowUpTask[];
  onSelectLead: (lead: LeadProfile) => void;
  onUpdateLeadStatus: (leadId: string, newStatus: LeadStatus) => void;
  onAddFollowUp: (task: FollowUpTask) => void;
}

const STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'Contacted', label: 'Contacted', color: 'border-blue-500 bg-blue-500/10' },
  { id: 'Interested', label: 'Interested', color: 'border-amber-500 bg-amber-500/10' },
  { id: 'Qualified', label: 'Qualified', color: 'border-emerald-500 bg-emerald-500/10' },
  { id: 'Viewing', label: 'Viewing Booked', color: 'border-purple-500 bg-purple-500/10' },
  { id: 'Negotiation', label: 'Negotiation', color: 'border-indigo-500 bg-indigo-500/10' },
  { id: 'Converted', label: 'Closed / Won', color: 'border-teal-500 bg-teal-500/10' },
];

export const CrmPipeline: React.FC<CrmPipelineProps> = ({
  leads,
  followUps,
  onSelectLead,
  onUpdateLeadStatus,
  onAddFollowUp,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [targetLeadForTask, setTargetLeadForTask] = useState<LeadProfile | null>(null);

  // New follow-up form state
  const [taskReason, setTaskReason] = useState('Send matching property brochures');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskAction, setTaskAction] = useState('Contact customer via WhatsApp');

  const filteredLeads = leads.filter(l => {
    // Exclude New Inquiries stage from CRM pipeline
    if (l.lead_status === 'New') return false;

    const matchesSearch = 
      l.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.full_name && l.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.phone && l.phone.includes(searchTerm)) ||
      (l.preferred_communities && l.preferred_communities.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesIntent = selectedIntent === 'ALL' || l.intent === selectedIntent;
    const matchesPriority = selectedPriority === 'ALL' || l.lead_priority === selectedPriority;

    return matchesSearch && matchesIntent && matchesPriority;
  });

  const handleExportCSV = () => {
    const headers = ['Lead ID', 'Full Name', 'Phone', 'Email', 'Intent', 'Customer Type', 'Budget Max AED', 'Communities', 'Bedrooms', 'Status', 'Priority', 'Completeness %', 'Assigned Agent'];
    const rows = filteredLeads.map(l => [
      l.id,
      `"${l.full_name || 'Prospect'}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      l.intent,
      l.customer_type,
      l.budget_max || 0,
      `"${(l.preferred_communities || []).join(', ')}"`,
      l.bedrooms || '',
      l.lead_status,
      l.lead_priority,
      l.requirement_completeness,
      `"${l.assigned_agent}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lyka_realty_crm_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLeadForTask) return;

    const newTask: FollowUpTask = {
      id: 'TASK-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: targetLeadForTask.id,
      customer_name: targetLeadForTask.full_name || 'Customer ' + targetLeadForTask.id,
      reason: taskReason,
      date: taskDate,
      assigned_agent: targetLeadForTask.assigned_agent,
      action: taskAction,
      status: 'Pending',
      priority: targetLeadForTask.lead_priority === 'Urgent' ? 'High' : 'Medium',
      createdAt: new Date().toISOString()
    };

    onAddFollowUp(newTask);
    setShowFollowUpModal(false);
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 flex flex-col h-full overflow-hidden">
      {/* Top Filter Bar */}
      <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-300 flex items-center space-x-2">
              <Kanban className="w-5 h-5 text-amber-600" />
              <span>Lyka Realty CRM Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage Dubai real estate customer journeys, qualification stages, and follow-ups.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 text-xs bg-white hover:bg-slate-100 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl transition-colors font-medium"
            >
              <Download className="w-4 h-4 text-amber-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, community..."
              className="w-full bg-white border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500"
            >
              <option value="ALL">All Intents</option>
              <option value="Buy">Buy</option>
              <option value="Rent">Rent</option>
              <option value="Invest">Invest</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 bg-white px-3 py-2 rounded-xl border border-slate-700">
            <span>Filtered Leads:</span>
            <span className="font-bold text-amber-600">
              {filteredLeads.length} of {leads.filter(l => l.lead_status !== 'New').length}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="flex space-x-4 min-w-max h-full">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter(l => l.lead_status === stage.id);
            return (
              <div
                key={stage.id}
                className="w-72 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col h-full max-h-[calc(100vh-250px)]"
              >
                {/* Stage Header */}
                <div className={`p-3 border-b border-slate-800 flex items-center justify-between rounded-t-2xl ${stage.color}`}>
                  <span className="font-bold text-xs text-slate-300">{stage.label}</span>
                  <span className="text-[11px] font-bold bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs italic">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-amber-500/60 cursor-pointer transition-all shadow-sm group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono text-amber-600 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                            {lead.id}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            lead.lead_priority === 'Urgent' 
                              ? 'bg-rose-500/20 text-rose-300' 
                              : lead.lead_priority === 'High' 
                              ? 'bg-amber-500/20 text-amber-700' 
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {lead.lead_priority}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-300 text-xs leading-tight group-hover:text-amber-600 transition-colors">
                          {lead.full_name || 'Prospect Client'}
                        </h4>

                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {lead.intent} • {lead.property_type || 'Property'} • {lead.bedrooms ? `${lead.bedrooms}BR` : ''}
                        </p>

                        {/* Budget */}
                        <div className="flex items-center space-x-1 text-[11px] text-slate-300 font-semibold mt-2">
                          <Coins className="w-3 h-3 text-amber-600" />
                          <span>
                            {lead.budget_max 
                              ? `AED ${(lead.budget_max / 1000000 >= 1 ? (lead.budget_max / 1000000).toFixed(2) + 'M' : (lead.budget_max / 1000).toFixed(0) + 'k')}`
                              : 'Budget TBD'}
                          </span>
                        </div>

                        {/* Communities */}
                        {lead.preferred_communities && lead.preferred_communities.length > 0 && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{lead.preferred_communities.join(', ')}</span>
                          </div>
                        )}

                        {/* Completeness meter */}
                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Profile Complete</span>
                          <span className="font-bold text-amber-600">{lead.requirement_completeness}%</span>
                        </div>

                        {/* Quick Action row */}
                        <div className="mt-2 flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {lead.assigned_agent.split(' ')[0]}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetLeadForTask(lead);
                              setShowFollowUpModal(true);
                            }}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium transition-colors"
                          >
                            + Follow-up
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-up Creation Modal */}
      {showFollowUpModal && targetLeadForTask && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Create Follow-up for {targetLeadForTask.full_name || targetLeadForTask.id}</span>
              </h3>
              <button 
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Follow-up Reason</label>
                <input
                  type="text"
                  value={taskReason}
                  onChange={(e) => setTaskReason(e.target.value)}
                  className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Action</label>
                <select
                  value={taskAction}
                  onChange={(e) => setTaskAction(e.target.value)}
                  className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                >
                  <option value="Contact customer via WhatsApp">Contact customer via WhatsApp</option>
                  <option value="Arrange in-person viewing">Arrange in-person viewing</option>
                  <option value="Send property brochures & payment plans">Send property brochures & payment plans</option>
                  <option value="Connect with Lyka mortgage advisor">Connect with Lyka mortgage advisor</option>
                  <option value="Negotiate price offer with seller/developer">Negotiate price offer with seller/developer</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2 rounded-xl font-bold shadow-md"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
