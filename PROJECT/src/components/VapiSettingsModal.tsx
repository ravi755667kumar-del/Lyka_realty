import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Settings,
  Key,
  Check,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  History,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Radio,
  ExternalLink,
  BarChart3,
  Zap,
  Mic,
  Volume2,
  RotateCcw,
  DollarSign,
  TrendingDown,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  getGroqConfig,
  updateGroqConfig,
  getGeminiConfig,
  updateGeminiConfig,
  getOpenAIConfig,
  updateOpenAIConfig,
  getTwilioConfig,
  updateTwilioConfig,
  TwilioConfig,
} from '../services/campaignService';
import { fetchAllCallHistory } from '../services/leadService';
import { GroqConfig, GeminiConfig, OpenAIConfig, CallRecord } from '../types';
import { TalkHistorySection } from './TalkHistorySection';
import {
  getAiUsageStats,
  resetAiUsageStats,
  AiUsageStats,
} from '../services/aiUsageTracker';

function formatDateGroup(isoString?: string): string {
  if (!isoString) return 'Unknown Date';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown Date';

  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (isToday) return `Today — ${formatted}`;
  if (isYesterday) return `Yesterday — ${formatted}`;
  return formatted;
}

function formatTime(isoString?: string): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getOutcomeBadge(outcome?: string) {
  const norm = (outcome || 'PENDING').toUpperCase();
  switch (norm) {
    case 'HOT':
      return { bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30', label: 'HOT 🔥' };
    case 'WARM':
      return { bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30', label: 'WARM ☀️' };
    case 'COLD':
      return { bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30', label: 'COLD ❄️' };
    case 'OPT_OUT':
    case 'OPT-OUT':
      return { bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: 'OPT-OUT ⛔' };
    case 'AGENT_CALLBACK':
      return { bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30', label: 'CALLBACK 📞' };
    default:
      return { bg: 'bg-slate-700/30 text-slate-300 border-slate-600', label: norm };
  }
}

interface VapiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VapiSettingsModal: React.FC<VapiSettingsModalProps> = ({ isOpen, onClose }) => {
  // Groq state
  const [groqConfig, setGroqConfig] = useState<GroqConfig | null>(null);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqSaving, setGroqSaving] = useState(false);
  const [groqSaveSuccess, setGroqSaveSuccess] = useState(false);
  const [groqErrorMsg, setGroqErrorMsg] = useState<string | null>(null);

  // Gemini state
  const [geminiConfig, setGeminiConfig] = useState<GeminiConfig | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [geminiSaveSuccess, setGeminiSaveSuccess] = useState(false);
  const [geminiErrorMsg, setGeminiErrorMsg] = useState<string | null>(null);

  // OpenAI state
  const [openaiConfig, setOpenaiConfig] = useState<OpenAIConfig | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiSaveSuccess, setOpenaiSaveSuccess] = useState(false);
  const [openaiErrorMsg, setOpenaiErrorMsg] = useState<string | null>(null);

  // Twilio Telephony state
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig | null>(null);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioSaveSuccess, setTwilioSaveSuccess] = useState(false);
  const [twilioErrorMsg, setTwilioErrorMsg] = useState<string | null>(null);

  // Tabs & History state
  const [activeTab, setActiveTab] = useState<'ai' | 'usage' | 'twilio' | 'history'>('ai');
  const [usageStats, setUsageStats] = useState<AiUsageStats>(getAiUsageStats());
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('ALL');
  const [historyOutcomeFilter, setHistoryOutcomeFilter] = useState('ALL');
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadCallHistory();
      setUsageStats(getAiUsageStats());
    }
  }, [isOpen]);

  const loadCallHistory = async () => {
    setHistoryLoading(true);
    try {
      const records = await fetchAllCallHistory();
      setCallHistory(records);
      if (records.length > 0) {
        setExpandedCallIds(new Set([records[0].id]));
      }
    } catch (err) {
      console.error('Failed to load call history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleCallExpand = (id: string) => {
    setExpandedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    callHistory.forEach((c) => {
      const group = formatDateGroup(c.startedAt);
      if (group && group !== 'Unknown Date') {
        dates.add(group);
      }
    });
    return Array.from(dates);
  }, [callHistory]);

  const filteredCalls = useMemo(() => {
    return callHistory.filter((call) => {
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchName = call.name?.toLowerCase().includes(q);
        const matchPhone = call.phone?.includes(q);
        const matchTranscript = call.transcript?.toLowerCase().includes(q);
        const matchSummary = call.summary?.toLowerCase().includes(q);
        const matchLocation = call.qualification?.location?.toLowerCase().includes(q);
        const matchQa = call.qaHistory?.some(
          (item) =>
            item.question?.toLowerCase().includes(q) ||
            item.answer?.toLowerCase().includes(q) ||
            item.stepTitle?.toLowerCase().includes(q)
        );
        if (!matchName && !matchPhone && !matchTranscript && !matchSummary && !matchLocation && !matchQa) {
          return false;
        }
      }

      if (historyOutcomeFilter !== 'ALL') {
        if ((call.outcome || '').toUpperCase() !== historyOutcomeFilter) {
          return false;
        }
      }

      if (historyDateFilter !== 'ALL') {
        const group = formatDateGroup(call.startedAt);
        if (group !== historyDateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [callHistory, historySearch, historyOutcomeFilter, historyDateFilter]);

  const groupedCalls = useMemo(() => {
    const groups: { dateGroup: string; isoDate: string; calls: CallRecord[] }[] = [];
    const map = new Map<string, { dateGroup: string; isoDate: string; calls: CallRecord[] }>();

    for (const call of filteredCalls) {
      const dateGroup = formatDateGroup(call.startedAt);
      if (!map.has(dateGroup)) {
        const entry = { dateGroup, isoDate: call.startedAt, calls: [] };
        map.set(dateGroup, entry);
        groups.push(entry);
      }
      map.get(dateGroup)!.calls.push(call);
    }

    return groups;
  }, [filteredCalls]);

  const loadConfig = async () => {
    try {
      const gcfg = await getGroqConfig();
      setGroqConfig(gcfg);
    } catch {
      // Non-fatal
    }
    try {
      const geminiRes = await getGeminiConfig();
      setGeminiConfig(geminiRes);
    } catch {
      // Non-fatal
    }
    try {
      const openAiRes = await getOpenAIConfig();
      setOpenaiConfig(openAiRes);
    } catch {
      // Non-fatal
    }
    try {
      const twilioRes = await getTwilioConfig();
      setTwilioConfig(twilioRes);
      if (twilioRes.accountSid) setTwilioAccountSid(twilioRes.accountSid);
      if (twilioRes.phoneNumber) setTwilioPhoneNumber(twilioRes.phoneNumber);
    } catch {
      // Non-fatal
    }
  };

  const handleTwilioSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwilioSaving(true);
    setTwilioErrorMsg(null);
    setTwilioSaveSuccess(false);
    try {
      await updateTwilioConfig({
        accountSid: twilioAccountSid.trim(),
        authToken: twilioAuthToken.trim(),
        phoneNumber: twilioPhoneNumber.trim(),
      });
      setTwilioSaveSuccess(true);
      setTwilioAuthToken('');
      await loadConfig();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('lyka-settings-updated'));
      setTimeout(() => setTwilioSaveSuccess(false), 3000);
    } catch (err: any) {
      setTwilioErrorMsg(err.message || 'Failed to save Twilio settings');
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleOpenAiSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenaiSaving(true);
    setOpenaiErrorMsg(null);
    setOpenaiSaveSuccess(false);
    try {
      await updateOpenAIConfig({ apiKey: openaiApiKey.trim() || undefined });
      setOpenaiSaveSuccess(true);
      setOpenaiApiKey('');
      await loadConfig();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('lyka-settings-updated'));
      setTimeout(() => setOpenaiSaveSuccess(false), 3000);
    } catch (err: any) {
      setOpenaiErrorMsg(err.message || 'Failed to save OpenAI key');
    } finally {
      setOpenaiSaving(false);
    }
  };

  const handleGroqSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroqSaving(true);
    setGroqErrorMsg(null);
    setGroqSaveSuccess(false);
    try {
      await updateGroqConfig({ apiKey: groqApiKey.trim() || undefined });
      setGroqSaveSuccess(true);
      setGroqApiKey('');
      await loadConfig();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('lyka-settings-updated'));
      setTimeout(() => setGroqSaveSuccess(false), 3000);
    } catch (err: any) {
      setGroqErrorMsg(err.message || 'Failed to save Groq key');
    } finally {
      setGroqSaving(false);
    }
  };

  const handleGeminiSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiSaving(true);
    setGeminiErrorMsg(null);
    setGeminiSaveSuccess(false);
    try {
      await updateGeminiConfig({ apiKey: geminiApiKey.trim() || undefined });
      setGeminiSaveSuccess(true);
      setGeminiApiKey('');
      await loadConfig();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('lyka-settings-updated'));
      setTimeout(() => setGeminiSaveSuccess(false), 3000);
    } catch (err: any) {
      setGeminiErrorMsg(err.message || 'Failed to save Gemini key');
    } finally {
      setGeminiSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-200 ${
        activeTab === 'history' || activeTab === 'usage' ? 'max-w-4xl' : 'max-w-3xl'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Settings className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">AI Models & Telephony Settings</h3>
              <p className="text-[11px] text-slate-400">Configure LLM intelligence, voice engines, and Twilio phone calling</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-2 pb-0 border-b border-slate-800 bg-slate-950/60 flex items-center space-x-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'ai'
                ? 'border-amber-400 text-amber-400 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>AI Models & Engines</span>
            <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30">Active</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('usage');
              setUsageStats(getAiUsageStats());
            }}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'usage'
                ? 'border-amber-400 text-amber-400 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Model & Token Usage</span>
            <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30 font-mono">
              Live
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('twilio')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'twilio'
                ? 'border-amber-400 text-amber-400 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Twilio Telephony</span>
            {twilioConfig?.configured ? (
              <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                Connected
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                Setup
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadCallHistory();
            }}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center space-x-2 shrink-0 ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-400 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <History className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Call History</span>
            {callHistory.length > 0 && (
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                {callHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: AI Engines (Gemini & Groq) */}
        {activeTab === 'ai' && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            {/* Active AI Engines Banner */}
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-white text-xs">Dedicated AI Engines: OpenAI, Google Gemini & Groq</span>
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  Your telecaller runs cleanly on <strong>OpenAI</strong>, <strong>Google Gemini</strong>, and <strong>Groq</strong> APIs for conversational reasoning (LLM), ultra-fast transcription (STT), and speech synthesis (TTS).
                </p>
              </div>
            </div>

            {/* Quick Live Usage Snapshot Banner */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-white font-semibold flex flex-wrap items-center gap-1.5 text-xs">
                    <span>Usage Snapshot:</span>
                    <span className="text-amber-400 font-mono font-bold">{usageStats.llm.totalTokens.toLocaleString()} Tokens</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-emerald-400 font-mono font-bold">{usageStats.stt.totalAudioMinutes}m STT</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-blue-400 font-mono font-bold">{usageStats.tts.totalCharacters.toLocaleString()} Chars TTS</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Est. Cost: ${usageStats.estimatedCost.totalCostUsd} (₹{usageStats.estimatedCost.totalCostInr}) • {usageStats.estimatedCost.savingsPercent}% lower than legacy telephony
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('usage');
                  setUsageStats(getAiUsageStats());
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[11px] transition-colors flex items-center space-x-1 shrink-0 border border-slate-700 hover:border-amber-500/30"
              >
                <span>View Full Model & Token Breakdown</span>
                <span>→</span>
              </button>
            </div>

            {/* Google Gemini AI Engine */}
            <form onSubmit={handleGeminiSave} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-bold text-white">Google Gemini AI Engine</h4>
                {geminiConfig?.apiKeyConfigured && (
                  <span className="text-[10px] text-blue-300 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                    ✓ Active
                  </span>
                )}
              </div>

              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-3 flex items-start space-x-3 text-blue-300">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-white text-xs">Gemini 3.8 Flash, Gemini STT & Voice</span>
                  <p className="text-[11px] text-blue-300/90 leading-relaxed">
                    Powers flagship multimodal property reasoning, knowledge dataset Q&A, and voice generation via Google Gemini API.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    <span>Gemini API Key</span>
                  </label>
                  {geminiConfig?.apiKeyConfigured && (
                    <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                      ✓ Configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={
                    geminiConfig?.apiKeyConfigured
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing)'
                      : 'Paste your Gemini API key (AIzaSy...)'
                  }
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <p className="text-[11px] text-slate-400">
                  Loaded from GEMINI_API_KEY in .env. Enter a new key here to override or update.
                </p>
              </div>

              {geminiSaveSuccess && (
                <div className="p-3 rounded-lg bg-blue-950/50 border border-blue-800 text-blue-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Gemini API key saved successfully!</span>
                </div>
              )}

              {geminiErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{geminiErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={geminiSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                >
                  {geminiSaving ? 'Saving...' : 'Save Gemini Key'}
                </button>
              </div>
            </form>

            {/* Groq AI Inference Engine */}
            <form onSubmit={handleGroqSave} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <h4 className="text-sm font-bold text-white">Groq AI Inference Engine</h4>
                {groqConfig?.apiKeyConfigured && (
                  <span className="text-[10px] text-orange-300 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30">
                    ✓ Active
                  </span>
                )}
              </div>

              <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl p-3 flex items-start space-x-3 text-orange-300">
                <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-white text-xs">Groq LPU Inference (Qwen 2.5 / Llama 3.3)</span>
                  <p className="text-[11px] text-orange-300/90 leading-relaxed">
                    Powers sub-second objection handling, Whisper Large v3 Turbo transcription, and Groq Voice synthesis.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-orange-400" />
                    <span>Groq API Key</span>
                  </label>
                  {groqConfig?.apiKeyConfigured && (
                    <span className="text-[10px] text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30">
                      ✓ Configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder={
                    groqConfig?.apiKeyConfigured
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing)'
                      : 'Paste your Groq API key (gsk_...)'
                  }
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                />
                <p className="text-[11px] text-slate-400">
                  Loaded from GROQ_API_KEY in .env. Enter a new key here to override or update.
                </p>
              </div>

              {groqSaveSuccess && (
                <div className="p-3 rounded-lg bg-orange-950/50 border border-orange-800 text-orange-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Groq API key saved successfully!</span>
                </div>
              )}

              {groqErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{groqErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={groqSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-orange-600 text-white hover:bg-orange-500 shadow-md shadow-orange-600/20 active:scale-95 transition-all"
                >
                  {groqSaving ? 'Saving...' : 'Save Groq Key'}
                </button>
              </div>
            </form>

            {/* OpenAI AI Engine */}
            <form onSubmit={handleOpenAiSave} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">OpenAI AI Engine (Whisper, TTS & GPT)</h4>
                {openaiConfig?.apiKeyConfigured && (
                  <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Active
                  </span>
                )}
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 flex items-start space-x-3 text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-white text-xs">GPT-4o Mini / GPT-4o, Whisper STT & OpenAI TTS</span>
                  <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                    Powers conversational telecaller intelligence, Whisper-1 real-time voice transcription, and lifelike natural speech synthesis with 9 voices (Nova, Shimmer, Coral, Alloy, Onyx, Echo, Ash, Fable, Sage).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>OpenAI API Key</span>
                  </label>
                  {openaiConfig?.apiKeyConfigured && (
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ✓ Configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder={
                    openaiConfig?.apiKeyConfigured
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing)'
                      : 'Paste your OpenAI API key (sk-proj-...)'
                  }
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
                <p className="text-[11px] text-slate-400">
                  Loaded from OPENAI_API_KEY in .env or openai-config.local.json. Enter a new key here to override or update.
                </p>
              </div>

              {openaiSaveSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>OpenAI API key saved successfully!</span>
                </div>
              )}

              {openaiErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{openaiErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={openaiSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  {openaiSaving ? 'Saving...' : 'Save OpenAI Key'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Usage & Token Analytics */}
        {activeTab === 'usage' && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-white">AI Engine & Telephony Usage Analytics</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live Tracking</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Real-time monitoring of LLM reasoning tokens, Speech-to-Text audio minutes, and Text-to-Speech characters
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setUsageStats(getAiUsageStats())}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors font-medium text-xs"
                  title="Reload latest usage numbers"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Reset usage counters to baseline?')) {
                      setUsageStats(resetAiUsageStats());
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1.5 transition-colors font-medium text-xs"
                  title="Reset counters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: LLM Reasoning Tokens */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>LLM Reasoning Tokens</span>
                  </span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                    {usageStats.llm.totalCalls} Calls
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {usageStats.llm.totalTokens.toLocaleString()}
                </div>
                <div className="space-y-1 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Input (Prompt):</span>
                    <span className="font-mono text-slate-300">{usageStats.llm.totalPromptTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output (Completion):</span>
                    <span className="font-mono text-amber-300">{usageStats.llm.totalCompletionTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: STT Speech-to-Text */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>STT Transcribed Audio</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                    {usageStats.stt.totalRequests} Turns
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {usageStats.stt.totalAudioMinutes} <span className="text-sm font-normal text-slate-400">mins</span>
                </div>
                <div className="space-y-1 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Total Duration:</span>
                    <span className="font-mono text-slate-300">{usageStats.stt.totalAudioSeconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Words Recognized:</span>
                    <span className="font-mono text-emerald-300">~{usageStats.stt.totalWords.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: TTS Text-to-Speech */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>TTS Spoken Characters</span>
                  </span>
                  <span className="text-[10px] bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                    {usageStats.tts.totalRequests} Clips
                  </span>
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {usageStats.tts.totalCharacters.toLocaleString()} <span className="text-sm font-normal text-slate-400">chars</span>
                </div>
                <div className="space-y-1 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Speech Duration:</span>
                    <span className="font-mono text-slate-300">{usageStats.tts.totalAudioMinutes} mins</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Speech Volume:</span>
                    <span className="font-mono text-blue-300">{usageStats.tts.totalAudioSeconds}s audio</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Cost Savings */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                    <span>Estimated Spend</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                    {usageStats.estimatedCost.savingsPercent}% Saved
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono flex items-baseline space-x-2">
                  <span>${usageStats.estimatedCost.totalCostUsd}</span>
                  <span className="text-xs font-normal text-slate-400">(₹{usageStats.estimatedCost.totalCostInr})</span>
                </div>
                <div className="space-y-1 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Legacy Telephony:</span>
                    <span className="font-mono text-rose-400 line-through">${usageStats.estimatedCost.legacyCostUsd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Architecture Cost:</span>
                    <span className="font-mono text-emerald-400">&lt; $0.005 / min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: LLM Reasoning Breakdown by Model */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">LLM Brain Model Uses & Token Distribution</h5>
                    <p className="text-[11px] text-slate-400">Input (system instructions + lead history) and output conversational answers</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(usageStats.llm.byModel).map(([modelName, detail]) => (
                  <div key={modelName} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{modelName}</div>
                        <div className="text-[10px] text-slate-400">{detail.calls} conversational turns</div>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-amber-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                        {detail.avgLatencyMs || 250}ms
                      </span>
                    </div>

                    <div className="text-lg font-bold text-amber-400 font-mono">
                      {detail.totalTokens.toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-slate-400">tokens</span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <div className="flex justify-between">
                        <span>Input (Prompt):</span>
                        <span className="font-mono text-slate-200">{detail.promptTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Output (Answer):</span>
                        <span className="font-mono text-amber-300">{detail.completionTokens.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-slate-500 h-full"
                        style={{
                          width: `${Math.round((detail.promptTokens / Math.max(1, detail.totalTokens)) * 100)}%`,
                        }}
                        title={`Input: ${Math.round((detail.promptTokens / Math.max(1, detail.totalTokens)) * 100)}%`}
                      />
                      <div
                        className="bg-amber-400 h-full"
                        style={{
                          width: `${Math.round((detail.completionTokens / Math.max(1, detail.totalTokens)) * 100)}%`,
                        }}
                        title={`Output: ${Math.round((detail.completionTokens / Math.max(1, detail.totalTokens)) * 100)}%`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: STT & TTS Providers Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* STT Breakdown */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">Speech-to-Text (STT) Engines</h5>
                    <p className="text-[11px] text-slate-400">Customer audio transcription volume</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(usageStats.stt.byProvider).map(([providerName, detail]) => (
                    <div key={providerName} className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{providerName}</div>
                        <div className="text-[11px] text-slate-400">
                          {detail.requests} requests • ~{detail.wordsTranscribed.toLocaleString()} words
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          {detail.audioMinutes}m
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {detail.audioSeconds}s audio
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TTS Breakdown */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">Text-to-Speech (TTS) Voice Engines</h5>
                    <p className="text-[11px] text-slate-400">Priya AI synthesized speech character volume</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(usageStats.tts.byProvider).map(([providerName, detail]) => (
                    <div key={providerName} className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{providerName}</div>
                        <div className="text-[11px] text-slate-400">
                          {detail.requests} utterances • {detail.audioMinutes}m spoken
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-blue-400 text-sm">
                          {detail.characters.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          chars synthesized
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Twilio Physical Telephony */}
        {activeTab === 'twilio' && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            {/* Header info card */}
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-amber-950/30 border border-blue-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
                    <Phone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Twilio PSTN Telephony (Physical Calling)</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Rings customers on their actual mobile handset over real cellular networks
                    </p>
                  </div>
                </div>

                {twilioConfig?.configured ? (
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Telephony Active &amp; Ready</span>
                  </span>
                ) : (
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Credentials Needed
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                When you click <strong>&quot;Twilio Real Call&quot;</strong> in your Leads Pipeline, Twilio dials the customer&apos;s physical phone number. Once the customer picks up, the Lyka Realty AI introduces itself as Priya in natural voice (English, Hindi, or Tamil) and qualifies their property interest!
              </p>
            </div>

            {/* Success message */}
            {twilioSaveSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Twilio credentials verified and saved successfully! Physical calling is active.</span>
              </div>
            )}

            {/* Error message */}
            {twilioErrorMsg && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{twilioErrorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleTwilioSave} className="space-y-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              {/* Account SID */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  1. Twilio Account SID (Starts with AC...)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Located in your Twilio Console (twilio.com/console) under Project Info.
                </p>
              </div>

              {/* Auth Token */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Twilio Auth Token
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    placeholder={twilioConfig?.hasAuthToken ? '•••••••••••••••••••••••••••••••• (Leave blank to keep saved token)' : 'Paste your Twilio Auth Token'}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                    required={!twilioConfig?.hasAuthToken}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Secret primary auth token for API authentication.
                </p>
              </div>

              {/* Twilio Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Twilio Outbound Phone Number (Caller ID)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={twilioPhoneNumber}
                    onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                    placeholder="+14155552671 or +91XXXXXXXXXX"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Your active purchased Twilio number with country code. This number will appear on customer phones when calling.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                >
                  <span>Open Twilio Console Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="submit"
                  disabled={twilioSaving}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {twilioSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify &amp; Save Twilio Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: User Chat & Call History */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">Customer Chat & Call History</h4>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                    {filteredCalls.length} of {callHistory.length} calls
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Chronological history of caller conversations grouped by date and time with Q&A insights.
                </p>
              </div>

              <button
                type="button"
                onClick={loadCallHistory}
                disabled={historyLoading}
                className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin text-amber-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search name, phone, question..."
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <select
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Dates</option>
                  {availableDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <select
                  value={historyOutcomeFilter}
                  onChange={(e) => setHistoryOutcomeFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="HOT">HOT 🔥</option>
                  <option value="WARM">WARM ☀️</option>
                  <option value="COLD">COLD ❄️</option>
                  <option value="OPT-OUT">OPT-OUT ⛔</option>
                  <option value="AGENT_CALLBACK">CALLBACK 📞</option>
                </select>
              </div>
            </div>

            {/* Call List Grouped by Date */}
            {historyLoading ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
                <p>Loading conversation records...</p>
              </div>
            ) : groupedCalls.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No Call History Found</p>
                <p className="text-xs text-slate-500">
                  {historySearch || historyOutcomeFilter !== 'ALL' || historyDateFilter !== 'ALL'
                    ? 'Try clearing the search or filters.'
                    : 'Completed browser calls and customer turns will be recorded here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedCalls.map((group) => (
                  <div key={group.dateGroup} className="space-y-3">
                    <div className="flex items-center space-x-2 sticky top-0 bg-slate-900/95 backdrop-blur-sm py-1.5 z-10 border-b border-slate-800/60">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                        {group.dateGroup}
                      </span>
                      <span className="text-[10px] text-slate-500">({group.calls.length} calls)</span>
                    </div>

                    <div className="space-y-2.5">
                      {group.calls.map((call) => {
                        const isExpanded = expandedCallIds.has(call.id);
                        const badge = getOutcomeBadge(call.outcome);
                        return (
                          <div
                            key={call.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-colors overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCallExpand(call.id)}
                              className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                                  <User className="w-4 h-4 text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-white text-xs truncate">
                                      {call.name || 'Anonymous Customer'}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {call.phone || 'No Phone'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                                    <span className="flex items-center space-x-1">
                                      <Clock className="w-3 h-3 text-slate-500" />
                                      <span>{formatTime(call.startedAt)}</span>
                                    </span>
                                    <span>•</span>
                                    <span>Duration: {formatDuration(call.duration)}</span>
                                    {call.language && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-300">{call.language}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                                  {badge.label}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 bg-slate-950/80 space-y-3.5">
                                {call.summary && (
                                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                      Call Summary
                                    </span>
                                    <p className="text-xs text-slate-200 leading-relaxed">{call.summary}</p>
                                  </div>
                                )}

                                {call.qaHistory && call.qaHistory.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-2">
                                      Questions & Answers Log ({call.qaHistory.length})
                                    </span>
                                    <TalkHistorySection qaHistory={call.qaHistory} />
                                  </div>
                                )}

                                {call.transcript && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                      Full Dialogue Transcript
                                    </span>
                                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap bg-slate-900 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                                      {call.transcript}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
