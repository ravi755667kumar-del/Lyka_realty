import React, { useState } from "react";
import {
  Kanban,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  X,
  MapPin,
  Coins,
} from "lucide-react";
import { LeadProfile, FollowUpTask, LeadStatus } from "../types/crm";
import { exportLeadsToCSV } from "../lib/csv";

interface CrmPipelineProps {
  leads: LeadProfile[];
  followUps: FollowUpTask[];
  onSelectLead: (lead: LeadProfile) => void;
  onUpdateLeadStatus: (leadId: string, newStatus: LeadStatus) => void;
  onAddFollowUp: (task: FollowUpTask) => void;
}

const STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "Contacted", label: "Contacted", color: "bg-blue-500/10 text-blue-800 border-blue-300/40" },
  { id: "Interested", label: "Interested", color: "bg-cyan-500/10 text-cyan-800 border-cyan-300/40" },
  { id: "Qualified", label: "Qualified", color: "bg-emerald-500/10 text-emerald-800 border-emerald-300/40" },
  { id: "Viewing Booked", label: "Viewing Booked", color: "bg-purple-500/10 text-purple-800 border-purple-300/40" },
  { id: "Negotiation", label: "Negotiation", color: "bg-amber-500/10 text-amber-800 border-amber-300/40" },
  { id: "Won", label: "Won", color: "bg-emerald-500/20 text-emerald-900 border-emerald-400/50" },
  { id: "Lost", label: "Lost", color: "bg-rose-500/10 text-rose-800 border-rose-300/40" },
];

export const CrmPipeline: React.FC<CrmPipelineProps> = ({
  leads,
  followUps,
  onSelectLead,
  onUpdateLeadStatus,
  onAddFollowUp,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [isExporting, setIsExporting] = useState(false);

  // Modal State for scheduling follow-up
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [targetLeadForTask, setTargetLeadForTask] =
    useState<LeadProfile | null>(null);
  const [taskReason, setTaskReason] = useState("");
  const [taskAction, setTaskAction] = useState(
    "Send property brochures & payment plans",
  );
  const [taskDate, setTaskDate] = useState("");

  const filteredLeads = leads.filter((l) => {
    // Hide 'New' initial state from Kanban view — only show actively engaged leads
    if (l.lead_status === "New") return false;

    // Search query
    const matchQuery =
      searchTerm === "" ||
      (l.full_name &&
        l.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.phone && l.phone.includes(searchTerm)) ||
      (l.id && l.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.preferred_communities &&
        l.preferred_communities.some((c) =>
          c.toLowerCase().includes(searchTerm.toLowerCase()),
        ));

    // Filter Intent
    const matchIntent =
      selectedIntent === "ALL" || l.intent === selectedIntent;

    // Filter Priority
    const matchPriority =
      selectedPriority === "ALL" || l.lead_priority === selectedPriority;

    return matchQuery && matchIntent && matchPriority;
  });

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const activeLeads = leads.filter((l) => l.lead_status !== "New");
      await exportLeadsToCSV(
        activeLeads.length > 0 ? activeLeads : leads,
        followUps,
      );
      setTimeout(() => setIsExporting(false), 2000);
    } catch (err) {
      console.error("Export error:", err);
      setIsExporting(false);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLeadForTask) return;

    const newTask: FollowUpTask = {
      id: "task_" + Math.random().toString(36).substring(2, 9),
      lead_id: targetLeadForTask.id,
      lead_name: targetLeadForTask.full_name || targetLeadForTask.id,
      assigned_agent: targetLeadForTask.assigned_agent || "Tariq Mansoor",
      due_date: taskDate || new Date(Date.now() + 86400000).toISOString(),
      reason: taskReason || "Follow-up discussion on luxury properties",
      recommended_action: taskAction,
      status: "Pending",
    };

    onAddFollowUp(newTask);
    setShowFollowUpModal(false);
    setTaskReason("");
    setTaskDate("");
    setTargetLeadForTask(null);
  };

  return (
    <div className="flex-1 bg-[#fdfbf5] text-[#2d2216] flex flex-col h-full overflow-hidden select-text">
      {/* Top Filter Bar */}
      <div className="p-4 sm:p-6 bg-[#faf6ec] border-b border-[#f0e6d2] space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1680px] mx-auto w-full">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1c1611] flex items-center space-x-2 tracking-tight">
              <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700">
                <Kanban className="w-5 h-5 text-amber-700" />
              </div>
              <span>Lyka Realty CRM Pipeline</span>
            </h2>
            <p className="text-xs text-[#6b5843] mt-0.5">
              Manage Dubai & Mumbai customer journeys, qualification stages, and follow-ups.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className={`flex items-center space-x-1.5 text-xs px-3.5 py-2 rounded-xl transition-all font-semibold shadow-xs cursor-pointer active:scale-95 ${
                isExporting
                  ? "bg-emerald-600 text-white border border-emerald-600"
                  : "bg-white hover:bg-[#f7f2e6] text-[#463726] border border-[#e5d8be]"
              }`}
              title="Export leads to CSV file"
            >
              {isExporting ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-600" />
                  <span>Export CSV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1680px] mx-auto w-full">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-4 h-4 text-[#8c7860] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, community..."
              className="w-full bg-white border border-[#e5d8be] rounded-xl pl-9 pr-3 py-2 text-xs text-[#2d2216] placeholder-[#8c7860] outline-none focus:border-amber-600 shadow-2xs"
            />
          </div>

          <div>
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="w-full bg-white border border-[#e5d8be] rounded-xl px-3 py-2 text-xs text-[#2d2216] outline-none focus:border-amber-600 shadow-2xs cursor-pointer"
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
              className="w-full bg-white border border-[#e5d8be] rounded-xl px-3 py-2 text-xs text-[#2d2216] outline-none focus:border-amber-600 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-center justify-between text-xs text-[#463726] bg-[#f7f2e6] px-3 py-2 rounded-xl border border-[#e5d8be] shadow-2xs">
            <span>Filtered Leads:</span>
            <span className="font-bold text-amber-700">
              {filteredLeads.length} of{" "}
              {leads.filter((l) => l.lead_status !== "New").length}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto p-3 sm:p-6 scrollbar-thin touch-pan-x">
        <div className="flex space-x-4 min-w-max h-full max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1680px] mx-auto">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter(
              (l) => l.lead_status === stage.id,
            );
            return (
              <div
                key={stage.id}
                className="w-72 xl:w-80 2xl:w-88 bg-[#faf6ec] border border-[#f0e6d2] rounded-2xl flex flex-col h-full max-h-[calc(100vh-230px)] shadow-xs"
              >
                {/* Stage Header */}
                <div
                  className={`p-3 border-b border-[#f0e6d2] flex items-center justify-between rounded-t-2xl ${stage.color}`}
                >
                  <span className="font-bold text-xs">
                    {stage.label}
                  </span>
                  <span className="text-[11px] font-bold bg-white text-[#463726] px-2 py-0.5 rounded-full border border-[#e5d8be] shadow-2xs">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {stageLeads.length === 0 ? (
                    <div className="text-center py-8 text-[#8c7860] text-xs italic">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className="bg-white p-3 rounded-xl border border-[#f0e6d2] hover:border-amber-500/70 cursor-pointer transition-all shadow-2xs hover:shadow-md group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono text-amber-700 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {lead.id}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                              lead.lead_priority === "Urgent"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : lead.lead_priority === "High"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {lead.lead_priority}
                          </span>
                        </div>

                        <h4 className="font-bold text-[#1c1611] text-xs leading-tight group-hover:text-amber-700 transition-colors">
                          {lead.full_name || "Prospect Client"}
                        </h4>

                        <p className="text-[11px] text-[#6b5843] mt-0.5">
                          {lead.intent} • {lead.property_type || "Property"} •{" "}
                          {lead.bedrooms ? `${lead.bedrooms}BR` : ""}
                        </p>

                        {/* Budget */}
                        <div className="flex items-center space-x-1 text-[11px] text-[#2d2216] font-bold mt-2">
                          <Coins className="w-3 h-3 text-amber-600" />
                          <span>
                            {lead.budget_max
                              ? `AED ${lead.budget_max / 1000000 >= 1 ? (lead.budget_max / 1000000).toFixed(2) + "M" : (lead.budget_max / 1000).toFixed(0) + "k"}`
                              : "Budget TBD"}
                          </span>
                        </div>

                        {/* Communities */}
                        {lead.preferred_communities &&
                          lead.preferred_communities.length > 0 && (
                            <div className="flex items-center space-x-1 text-[10px] text-[#6b5843] mt-1 truncate">
                              <MapPin className="w-3 h-3 text-[#8c7860] shrink-0" />
                              <span className="truncate">
                                {lead.preferred_communities.join(", ")}
                              </span>
                            </div>
                          )}

                        {/* Completeness meter */}
                        <div className="mt-2.5 pt-2 border-t border-[#f0e6d2] flex items-center justify-between text-[10px]">
                          <span className="text-[#6b5843]">
                            Profile Complete
                          </span>
                          <span className="font-bold text-amber-700">
                            {lead.requirement_completeness}%
                          </span>
                        </div>

                        {/* Quick Action row */}
                        <div className="mt-2 flex items-center justify-between pt-1">
                          <span className="text-[10px] text-[#6b5843] font-medium truncate max-w-[120px]">
                            {lead.assigned_agent.split(" ")[0]}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetLeadForTask(lead);
                              setShowFollowUpModal(true);
                            }}
                            className="text-[10px] bg-[#f4ede0] hover:bg-[#ebdcc4] text-[#463726] border border-[#e5d8be] px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#f0e6d2] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#f0e6d2] pb-3">
              <h3 className="text-sm font-bold text-[#1c1611] flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>
                  Create Follow-up for{" "}
                  {targetLeadForTask.full_name || targetLeadForTask.id}
                </span>
              </h3>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-[#8c7860] hover:text-[#2d2216] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="text-[#463726] font-semibold block mb-1">
                  Follow-up Reason
                </label>
                <input
                  type="text"
                  value={taskReason}
                  onChange={(e) => setTaskReason(e.target.value)}
                  placeholder="e.g. Discuss 2BR payment plan in Dubai Marina"
                  className="w-full bg-[#faf6ec] border border-[#e5d8be] rounded-xl px-3 py-2 text-[#2d2216] placeholder-[#8c7860] outline-none focus:border-amber-600"
                  required
                />
              </div>

              <div>
                <label className="text-[#463726] font-semibold block mb-1">
                  Target Action
                </label>
                <select
                  value={taskAction}
                  onChange={(e) => setTaskAction(e.target.value)}
                  className="w-full bg-[#faf6ec] border border-[#e5d8be] rounded-xl px-3 py-2 text-[#2d2216] outline-none focus:border-amber-600 cursor-pointer"
                >
                  <option value="Contact customer via WhatsApp">
                    Contact customer via WhatsApp
                  </option>
                  <option value="Arrange in-person viewing">
                    Arrange in-person viewing
                  </option>
                  <option value="Send property brochures & payment plans">
                    Send property brochures & payment plans
                  </option>
                  <option value="Connect with Lyka mortgage advisor">
                    Connect with Lyka mortgage advisor
                  </option>
                  <option value="Negotiate price offer with seller/developer">
                    Negotiate price offer with seller/developer
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[#463726] font-semibold block mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full bg-[#faf6ec] border border-[#e5d8be] rounded-xl px-3 py-2 text-[#2d2216] outline-none focus:border-amber-600"
                  required
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="flex-1 bg-[#f4ede0] hover:bg-[#ebdcc4] text-[#463726] border border-[#e5d8be] py-2 rounded-xl font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-2 rounded-xl font-bold shadow-md cursor-pointer transition-all"
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
