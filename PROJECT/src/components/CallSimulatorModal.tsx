import React, { useState } from 'react';
import { X, Play, Bot, CheckCircle, AlertCircle, Phone, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Lead } from '../types';
import { simulateCallAPI } from '../services/campaignService';
import { VoiceSphere3D } from './VoiceSphere3D';

interface CallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  selectedLead: Lead | null;
  onSuccess: () => void;
}

export const CallSimulatorModal: React.FC<CallSimulatorModalProps> = ({
  isOpen,
  onClose,
  leads,
  selectedLead,
  onSuccess,
}) => {
  const [leadId, setLeadId] = useState<string>(selectedLead?.id || leads[0]?.id || '');
  const [scenario, setScenario] = useState<'HOT' | 'WARM' | 'COLD' | 'OPT-OUT' | 'NO_ANSWER' | 'AGENT_CALLBACK'>('HOT');
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  React.useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleAudio = (transcript: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const lines = (transcript || '').split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    let index = 0;
    setIsPlayingAudio(true);

    const speakNext = () => {
      if (index >= lines.length) {
        setIsPlayingAudio(false);
        return;
      }
      const line = lines[index++];
      const isAI = line.toLowerCase().startsWith('ai:');
      const text = line.replace(/^(ai:|assistant:|customer:|user:)\s*/i, '');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = isAI ? 0.95 : 1.0;
      utterance.pitch = isAI ? 1.05 : 0.95;
      utterance.onend = () => {
        setTimeout(speakNext, 350);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  React.useEffect(() => {
    if (selectedLead) {
      setLeadId(selectedLead.id);
    } else if (leads.length > 0 && !leadId) {
      setLeadId(leads[0].id);
    }
  }, [selectedLead, leads]);

  if (!isOpen) return null;

  const currentLead = leads.find((l) => l.id === leadId);

  const handleSimulate = async () => {
    if (!leadId) {
      setErrorMsg('Please select a lead to simulate.');
      return;
    }

    setSimulating(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await simulateCallAPI({
        leadId,
        scenario,
      });
      setResult(res.lead);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const scenariosList = [
    {
      id: 'HOT' as const,
      label: '🔥 HOT Lead Scenario',
      desc: 'Customer is looking for 3 BHK in Worli/Bandra, budget ₹3-4 Cr, ready to buy in 30-60 days.',
      outcome: 'HOT',
    },
    {
      id: 'WARM' as const,
      label: '🟡 WARM Lead Scenario',
      desc: 'Investor looking in Bangalore for rental yield, budget ~₹1.5-2 Cr, timeline 6-9 months.',
      outcome: 'WARM',
    },
    {
      id: 'COLD' as const,
      label: '🔵 COLD (Customer says "I\'m not interested")',
      desc: 'AI politely ends call. Outcome set to COLD in Firestore.',
      outcome: 'COLD',
    },
    {
      id: 'OPT-OUT' as const,
      label: '⛔ OPT-OUT (Customer says "Don\'t call me again")',
      desc: 'AI stops immediately. Outcome = OPT-OUT, blocked = true. Never called again.',
      outcome: 'OPT-OUT',
    },
    {
      id: 'AGENT_CALLBACK' as const,
      label: '👤 Human Callback ("I want to speak with someone")',
      desc: 'AI stops automated qualification. Outcome = AGENT_CALLBACK. Alert on dashboard.',
      outcome: 'AGENT_CALLBACK',
    },
    {
      id: 'NO_ANSWER' as const,
      label: '☎ NO ANSWER (No pickup / Voicemail)',
      desc: 'No connection made. Outcome = NO_ANSWER. Retry counter updated.',
      outcome: 'NO_ANSWER',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">Interactive Call Simulator</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Info Banner */}
          <div className="bg-purple-950/30 border border-purple-800/30 rounded-xl p-3.5 text-purple-300 space-y-1">
            <span className="font-bold text-white text-xs block">End-to-End Logic Verification Tool</span>
            <p className="text-[11px] text-purple-300/90 leading-relaxed">
              This simulator triggers the full Lyka Realty qualification rules, executes the 5-question script, runs classification logic, and writes real call results, transcripts, and statuses to Supabase.
            </p>
          </div>

          {/* Select Lead */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              Target Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.phone}) {l.blocked ? '— [BLOCKED]' : ''} — Current: {l.outcome || l.status}
                </option>
              ))}
            </select>
          </div>

          {/* Scenario Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              Select Conversation Scenario
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scenariosList.map((sc) => (
                <label
                  key={sc.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    scenario === sc.id
                      ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 text-xs">{sc.label}</span>
                    <input
                      type="radio"
                      name="scenario"
                      checked={scenario === sc.id}
                      onChange={() => setScenario(sc.id)}
                      className="text-purple-500 focus:ring-purple-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{sc.desc}</p>
                </label>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-xs">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Call Completed & Stored in Supabase!</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                  Outcome: {result.outcome}
                </span>
              </div>
              <p className="text-slate-300 text-xs">{result.summary}</p>

              {/* 3D Voice Sphere when listening to simulated voice */}
              {isPlayingAudio && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2 my-2 flex justify-center animate-in fade-in zoom-in-95">
                  <VoiceSphere3D
                    isSpeaking={true}
                    isListening={false}
                    audioLevel={65}
                    callState="AI Speaking..."
                    duration={12}
                    onSphereClick={() => {
                      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        setIsPlayingAudio(false);
                      }
                    }}
                  />
                </div>
              )}

              {result.transcript && (
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleAudio(result.transcript)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/80 text-purple-200 border border-purple-700/60 hover:bg-purple-900/80 transition-colors"
                  >
                    {isPlayingAudio ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                        <span>Stop Voice Playback</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Listen to Call Audio (Spoken Aloud)</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-slate-400">Plays simulated conversation</span>
                </div>
              )}

              {result.nextAction && (
                <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <strong>Next Action:</strong> {result.nextAction}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSimulate}
            disabled={simulating || !leadId}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{simulating ? 'Executing Scenario...' : 'Run Simulation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
