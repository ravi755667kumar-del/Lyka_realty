import React, { useState } from 'react';
import { Play, Square, Loader2, PhoneForwarded, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { CampaignState, Lead } from '../types';

interface CampaignBannerProps {
  campaignState: CampaignState | null;
  leads: Lead[];
  onStartCampaign: () => Promise<void>;
  onStopCampaign: () => Promise<void>;
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({
  campaignState,
  leads,
  onStartCampaign,
  onStopCampaign,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRunning = campaignState?.isRunning || false;

  // Calculate remaining leads
  const callableLeads = leads.filter((l) => l.consent && !l.blocked);
  const completedLeads = leads.filter((l) => l.status === 'Completed' || l.status === 'COMPLETED');
  const pendingLeads = callableLeads.filter((l) => l.status === 'Pending' || l.status === 'PENDING');
  const activeCallingLead = leads.find((l) => l.status === 'Calling' || l.status === 'CALLING');

  const handleStart = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await onStartCampaign();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await onStopCampaign();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to stop campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background glow when active */}
      {isRunning && (
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
        {/* Left Side: Campaign Status & Info */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase font-mono tracking-widest text-slate-400">
              Autonomous Campaign Engine
            </span>
            {isRunning ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>CAMPAIGN RUNNING</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>IDLE / PAUSED</span>
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Lyka Realty Outbound Cold-Calling Workflow
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Autonomous sequential calling: Calls authorized leads (consent=true, blocked=false) one at a time via Direct AI Voice / Telephony, conducts 5-question property qualification, classifies HOT/WARM/COLD/OPT-OUT in Firestore, and smoothly progresses.
          </p>

          {/* Currently Calling Status Card */}
          {isRunning && activeCallingLead && (
            <div className="mt-3 p-3 sm:p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center animate-spin shrink-0">
                  <PhoneForwarded className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Currently Calling (1-at-a-time)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
                      AI Active
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {activeCallingLead.name} ({activeCallingLead.phone})
                  </div>
                </div>
              </div>
              <div className="sm:text-right text-xs">
                <span className="text-slate-400 block">AI Qualification In Progress</span>
                <span className="text-amber-300 font-medium">Auto-saves to Firestore</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-2 flex items-center space-x-2 text-rose-400 text-xs bg-rose-950/50 p-2.5 rounded-lg border border-rose-800/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right Side: Big Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading || pendingLeads.length === 0}
              className={`flex items-center justify-center space-x-2.5 px-6 py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all w-full sm:w-auto ${
                pendingLeads.length === 0
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>STARTING...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>START CAMPAIGN</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center justify-center space-x-2.5 px-6 py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 transition-all cursor-pointer active:scale-95 w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>STOPPING...</span>
                </>
              ) : (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>STOP CAMPAIGN</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress Line */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
          <span>
            Queue: <strong className="text-slate-200">{pendingLeads.length}</strong> Ready
          </span>
          <span>•</span>
          <span>
            Called: <strong className="text-emerald-400">{completedLeads.length}</strong> Completed
          </span>
          <span>•</span>
          <span>
            Blocked: <strong className="text-rose-400">{leads.filter((l) => l.blocked).length}</strong>
          </span>
        </div>
        <div className="text-[11px] sm:text-xs text-slate-400">
          Mode: <span className="text-amber-400 font-medium">One-Lead-At-A-Time Sequencer</span>
        </div>
      </div>
    </div>
  );
};
