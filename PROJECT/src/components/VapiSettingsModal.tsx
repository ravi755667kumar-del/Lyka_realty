import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Key,
  Check,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Phone,
  ExternalLink,
  BarChart3,
  Zap,
  Mic,
  Volume2,
  RotateCcw,
  DollarSign,
  Cpu,
  Smartphone,
  Wifi,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import {
  isNativeMobile,
  getMobilePlatform,
  getApiBaseUrl,
  setApiBaseUrl,
} from '../lib/capacitor';
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
import { GroqConfig, GeminiConfig, OpenAIConfig } from '../types';
import {
  getAiUsageStats,
  resetAiUsageStats,
  AiUsageStats,
  getAiQuotaConfig,
  saveAiQuotaConfig,
  resetAiQuotaConfig,
  calculateQuotaRemaining,
  getModelTokenQuota,
  getSttMinutesQuota,
  getTtsCharsQuota,
  AiQuotaConfig,
  DEFAULT_AI_QUOTAS,
} from '../services/aiUsageTracker';

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

  // Tabs & Usage state
  const [activeTab, setActiveTab] = useState<'ai' | 'usage' | 'twilio'>('ai');
  const [usageStats, setUsageStats] = useState<AiUsageStats>(getAiUsageStats());

  // AI Quota & Limits state (Total, Used, Remaining)
  const [quotaConfig, setQuotaConfig] = useState<AiQuotaConfig>(getAiQuotaConfig());
  const [showQuotaEditor, setShowQuotaEditor] = useState(false);
  const [quotaSavedNotice, setQuotaSavedNotice] = useState(false);
  const [customTokenQuota, setCustomTokenQuota] = useState(1000000);
  const [customSttQuota, setCustomSttQuota] = useState(120);
  const [customTtsQuota, setCustomTtsQuota] = useState(250000);

  // Capacitor Mobile Backend URL state
  const [mobileApiUrl, setMobileApiUrl] = useState('');
  const [mobileTestStatus, setMobileTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [mobileTestMsg, setMobileTestMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setUsageStats(getAiUsageStats());
      const qc = getAiQuotaConfig();
      setQuotaConfig(qc);
      setCustomTokenQuota(qc.monthlyTokenQuota);
      setCustomSttQuota(qc.monthlyAudioMinutesQuota);
      setCustomTtsQuota(qc.monthlyTtsCharsQuota);
      setMobileApiUrl(getApiBaseUrl());
      setMobileTestStatus('idle');
      setMobileTestMsg(null);
    }
  }, [isOpen]);

  const handleSaveQuotas = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tTokens = Math.max(10000, Number(customTokenQuota) || 1000000);
    const tStt = Math.max(1, Number(customSttQuota) || 120);
    const tTts = Math.max(1000, Number(customTtsQuota) || 250000);

    const updated: AiQuotaConfig = {
      monthlyTokenQuota: tTokens,
      monthlyAudioMinutesQuota: tStt,
      monthlyTtsCharsQuota: tTts,
      byModelTokenQuota: {
        'Google Gemini 2.5 Flash': tTokens,
        'Groq Llama 3.3 70B': Math.round(tTokens / 2),
        'OpenAI GPT-4o-mini': Math.round(tTokens / 2),
      },
      bySttMinutesQuota: {
        'Deepgram Nova-2': Math.round(tStt * 0.5),
        'Groq Whisper-large-v3': Math.round(tStt * 0.35),
        'Sarvam Saaras v2': Math.round(tStt * 0.25),
      },
      byTtsCharsQuota: {
        'Cartesia Sonic': Math.round(tTts * 0.4),
        'Deepgram Aura': Math.round(tTts * 0.3),
        'Sarvam Bulbul v3': Math.round(tTts * 0.2),
        'Murf Falcon': Math.round(tTts * 0.2),
      },
    };
    saveAiQuotaConfig(updated);
    setQuotaConfig(updated);
    setQuotaSavedNotice(true);
    setTimeout(() => setQuotaSavedNotice(false), 2500);
  };

  const handleApplyTierPreset = (tier: 'starter' | 'pro' | 'enterprise') => {
    let tTokens = 1000000;
    let tStt = 120;
    let tTts = 250000;
    if (tier === 'starter') {
      tTokens = 500000;
      tStt = 60;
      tTts = 100000;
    } else if (tier === 'enterprise') {
      tTokens = 5000000;
      tStt = 600;
      tTts = 1000000;
    }
    setCustomTokenQuota(tTokens);
    setCustomSttQuota(tStt);
    setCustomTtsQuota(tTts);

    const updated: AiQuotaConfig = {
      monthlyTokenQuota: tTokens,
      monthlyAudioMinutesQuota: tStt,
      monthlyTtsCharsQuota: tTts,
      byModelTokenQuota: {
        'Google Gemini 2.5 Flash': tTokens,
        'Groq Llama 3.3 70B': Math.round(tTokens / 2),
        'OpenAI GPT-4o-mini': Math.round(tTokens / 2),
      },
      bySttMinutesQuota: {
        'Deepgram Nova-2': Math.round(tStt * 0.5),
        'Groq Whisper-large-v3': Math.round(tStt * 0.35),
        'Sarvam Saaras v2': Math.round(tStt * 0.25),
      },
      byTtsCharsQuota: {
        'Cartesia Sonic': Math.round(tTts * 0.4),
        'Deepgram Aura': Math.round(tTts * 0.3),
        'Sarvam Bulbul v3': Math.round(tTts * 0.2),
        'Murf Falcon': Math.round(tTts * 0.2),
      },
    };
    saveAiQuotaConfig(updated);
    setQuotaConfig(updated);
    setQuotaSavedNotice(true);
    setTimeout(() => setQuotaSavedNotice(false), 2500);
  };

  const handleResetQuotas = () => {
    const def = resetAiQuotaConfig();
    setQuotaConfig(def);
    setCustomTokenQuota(def.monthlyTokenQuota);
    setCustomSttQuota(def.monthlyAudioMinutesQuota);
    setCustomTtsQuota(def.monthlyTtsCharsQuota);
    setQuotaSavedNotice(true);
    setTimeout(() => setQuotaSavedNotice(false), 2500);
  };

  const handleSaveAndTestMobileUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = setApiBaseUrl(mobileApiUrl);
    setMobileApiUrl(saved);
    setMobileTestStatus('testing');
    setMobileTestMsg(null);
    try {
      const target = saved ? `${saved}/api/health` : '/api/health';
      const res = await fetch(target, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setMobileTestStatus('ok');
      setMobileTestMsg(`Connected to ${saved || 'local backend'} cleanly!`);
      await loadConfig();
    } catch (err: any) {
      setMobileTestStatus('error');
      setMobileTestMsg(
        `Saved URL (${saved}), but health check failed: ${err?.message || 'Unreachable'}. Make sure Next.js backend is running.`
      );
    }
  };

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
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioPhoneNumber('');
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

  const tokenQuotaDetail = calculateQuotaRemaining(usageStats.llm.totalTokens, quotaConfig.monthlyTokenQuota);
  const sttQuotaDetail = calculateQuotaRemaining(usageStats.stt.totalAudioMinutes, quotaConfig.monthlyAudioMinutesQuota);
  const ttsQuotaDetail = calculateQuotaRemaining(usageStats.tts.totalCharacters, quotaConfig.monthlyTtsCharsQuota);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden transition-all duration-200 ${
        activeTab === 'usage' ? 'max-w-4xl' : 'max-w-3xl'
      }`}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
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
        <div className="px-3 sm:px-6 pt-2 pb-0 border-b border-slate-800 bg-slate-950/60 flex items-center space-x-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
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
        </div>

        {/* Tab 1: AI Engines (Gemini & Groq) */}
        {activeTab === 'ai' && (
          <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs">
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

            {/* Quick Live Usage & Quota Snapshot Banner */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-xs flex items-center space-x-2">
                      <span>Live AI Quota & Resource Allocation</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {tokenQuotaDetail.percentRemaining}% Tokens Available
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Est. Spend: ${usageStats.estimatedCost.totalCostUsd} (₹{usageStats.estimatedCost.totalCostInr}) • {usageStats.estimatedCost.savingsPercent}% lower than legacy telephony
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
                  <span>View Full Resource & Quota Breakdown</span>
                  <span>→</span>
                </button>
              </div>

              {/* 3 Metric Cards: Total Quota, How Much Used, Remaining */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/80">
                {/* Tokens */}
                <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-amber-300 flex items-center space-x-1">
                      <Cpu className="w-3 h-3 text-amber-400" />
                      <span>LLM Reasoning Tokens</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">
                      {tokenQuotaDetail.percentRemaining}% Left
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
                    <div>
                      <div className="text-slate-400 text-[9px]">TOTAL</div>
                      <div className="text-white font-bold">{tokenQuotaDetail.totalQuota.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">USED ({tokenQuotaDetail.percentUsed}%)</div>
                      <div className="text-amber-400 font-bold">{tokenQuotaDetail.used.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">REMAINING</div>
                      <div className="text-emerald-400 font-bold">{tokenQuotaDetail.remaining.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-amber-400 h-full" style={{ width: `${tokenQuotaDetail.percentUsed}%` }} />
                    <div className="bg-emerald-500 h-full" style={{ width: `${tokenQuotaDetail.percentRemaining}%` }} />
                  </div>
                </div>

                {/* STT Audio */}
                <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-300 flex items-center space-x-1">
                      <Mic className="w-3 h-3 text-emerald-400" />
                      <span>STT Audio Minutes</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">
                      {sttQuotaDetail.percentRemaining}% Left
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
                    <div>
                      <div className="text-slate-400 text-[9px]">TOTAL</div>
                      <div className="text-white font-bold">{sttQuotaDetail.totalQuota}m</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">USED ({sttQuotaDetail.percentUsed}%)</div>
                      <div className="text-emerald-400 font-bold">{sttQuotaDetail.used}m</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">REMAINING</div>
                      <div className="text-cyan-400 font-bold">{sttQuotaDetail.remaining}m</div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-400 h-full" style={{ width: `${sttQuotaDetail.percentUsed}%` }} />
                    <div className="bg-cyan-500 h-full" style={{ width: `${sttQuotaDetail.percentRemaining}%` }} />
                  </div>
                </div>

                {/* TTS Chars */}
                <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-blue-300 flex items-center space-x-1">
                      <Volume2 className="w-3 h-3 text-blue-400" />
                      <span>TTS Spoken Characters</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">
                      {ttsQuotaDetail.percentRemaining}% Left
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center bg-slate-950/50 p-1.5 rounded border border-slate-800/60">
                    <div>
                      <div className="text-slate-400 text-[9px]">TOTAL</div>
                      <div className="text-white font-bold">{ttsQuotaDetail.totalQuota.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">USED ({ttsQuotaDetail.percentUsed}%)</div>
                      <div className="text-blue-400 font-bold">{ttsQuotaDetail.used.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[9px]">REMAINING</div>
                      <div className="text-indigo-400 font-bold">{ttsQuotaDetail.remaining.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-blue-400 h-full" style={{ width: `${ttsQuotaDetail.percentUsed}%` }} />
                    <div className="bg-indigo-500 h-full" style={{ width: `${ttsQuotaDetail.percentRemaining}%` }} />
                  </div>
                </div>
              </div>
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

              {/* Gemini Model Quota: Total, Used, Remaining */}
              {(() => {
                const geminiUsed = usageStats.llm.byModel['Google Gemini 2.5 Flash']?.totalTokens || 0;
                const geminiQuota = getModelTokenQuota('Google Gemini 2.5 Flash', quotaConfig);
                const geminiDetail = calculateQuotaRemaining(geminiUsed, geminiQuota);
                return (
                  <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-200 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        <span>Gemini Token Allowance & Remaining Balance</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        geminiDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        geminiDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {geminiDetail.percentRemaining}% Available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Quota</div>
                        <div className="font-mono font-bold text-white text-xs">{geminiDetail.totalQuota.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Used ({geminiDetail.percentUsed}%)</div>
                        <div className="font-mono font-bold text-amber-400 text-xs">{geminiDetail.used.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining ({geminiDetail.percentRemaining}%)</div>
                        <div className="font-mono font-bold text-emerald-400 text-xs">{geminiDetail.remaining.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="bg-amber-400 h-full" style={{ width: `${geminiDetail.percentUsed}%` }} title={`Used: ${geminiDetail.percentUsed}%`} />
                      <div className="bg-emerald-500 h-full" style={{ width: `${geminiDetail.percentRemaining}%` }} title={`Remaining: ${geminiDetail.percentRemaining}%`} />
                    </div>
                  </div>
                );
              })()}

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

              {/* Groq Model Quota: Total, Used, Remaining */}
              {(() => {
                const groqUsed = usageStats.llm.byModel['Groq Llama 3.3 70B']?.totalTokens || 0;
                const groqQuota = getModelTokenQuota('Groq Llama 3.3 70B', quotaConfig);
                const groqDetail = calculateQuotaRemaining(groqUsed, groqQuota);
                return (
                  <div className="bg-orange-950/20 border border-orange-500/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-orange-200 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-orange-400" />
                        <span>Groq LPU Token Allowance & Remaining Balance</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        groqDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        groqDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {groqDetail.percentRemaining}% Available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Quota</div>
                        <div className="font-mono font-bold text-white text-xs">{groqDetail.totalQuota.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Used ({groqDetail.percentUsed}%)</div>
                        <div className="font-mono font-bold text-amber-400 text-xs">{groqDetail.used.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining ({groqDetail.percentRemaining}%)</div>
                        <div className="font-mono font-bold text-emerald-400 text-xs">{groqDetail.remaining.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="bg-amber-400 h-full" style={{ width: `${groqDetail.percentUsed}%` }} title={`Used: ${groqDetail.percentUsed}%`} />
                      <div className="bg-emerald-500 h-full" style={{ width: `${groqDetail.percentRemaining}%` }} title={`Remaining: ${groqDetail.percentRemaining}%`} />
                    </div>
                  </div>
                );
              })()}

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

              {/* OpenAI Model Quota: Total, Used, Remaining */}
              {(() => {
                const openAiUsed = usageStats.llm.byModel['OpenAI GPT-4o-mini']?.totalTokens || 0;
                const openAiQuota = getModelTokenQuota('OpenAI GPT-4o-mini', quotaConfig);
                const openAiDetail = calculateQuotaRemaining(openAiUsed, openAiQuota);
                return (
                  <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-200 flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>OpenAI Token Allowance & Remaining Balance</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        openAiDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        openAiDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        {openAiDetail.percentRemaining}% Available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Quota</div>
                        <div className="font-mono font-bold text-white text-xs">{openAiDetail.totalQuota.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Used ({openAiDetail.percentUsed}%)</div>
                        <div className="font-mono font-bold text-amber-400 text-xs">{openAiDetail.used.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining ({openAiDetail.percentRemaining}%)</div>
                        <div className="font-mono font-bold text-emerald-400 text-xs">{openAiDetail.remaining.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="bg-amber-400 h-full" style={{ width: `${openAiDetail.percentUsed}%` }} title={`Used: ${openAiDetail.percentUsed}%`} />
                      <div className="bg-emerald-500 h-full" style={{ width: `${openAiDetail.percentRemaining}%` }} title={`Remaining: ${openAiDetail.percentRemaining}%`} />
                    </div>
                  </div>
                );
              })()}

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

            {/* Capacitor Mobile Backend Server Connection */}
            <form onSubmit={handleSaveAndTestMobileUrl} className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-cyan-400 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>Mobile App Backend Server (Capacitor Android / iOS)</span>
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 capitalize">
                  Runtime: {isNativeMobile() ? `${getMobilePlatform()} Native App` : 'Web Browser'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">
                  Next.js API Base URL (for Android / iOS APK)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={mobileApiUrl}
                    onChange={(e) => setMobileApiUrl(e.target.value)}
                    placeholder="http://10.0.2.2:3001 or https://your-lyka-server.com"
                    className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileApiUrl('http://10.0.2.2:3001')}
                    className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0"
                    title="Set standard Android Emulator loopback IP"
                  >
                    Emulator (10.0.2.2)
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  When running inside the mobile APK/IPA, relative <code>/api/*</code> requests route automatically to this server URL.
                </p>
              </div>

              {mobileTestStatus === 'ok' && mobileTestMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                  <Wifi className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{mobileTestMsg}</span>
                </div>
              )}

              {mobileTestStatus === 'error' && mobileTestMsg && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{mobileTestMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={mobileTestStatus === 'testing'}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500 shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
                >
                  {mobileTestStatus === 'testing' ? 'Testing...' : 'Save & Test Mobile Connection'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Usage & Token Analytics */}
        {activeTab === 'usage' && (
          <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-white">AI Models Resource & Quota Allocation</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live Quotas</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Real-time metrics: Total Allowance, Amount Used, and Remaining Quotas across all AI reasoning models, STT, and TTS engines
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-y-2">
                <button
                  type="button"
                  onClick={() => setShowQuotaEditor(!showQuotaEditor)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    showQuotaEditor
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Configure monthly limits and allowances"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>{showQuotaEditor ? 'Hide Quotas' : 'Adjust Quotas'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsageStats(getAiUsageStats());
                    setQuotaConfig(getAiQuotaConfig());
                  }}
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

            {/* Quota & Limits Configuration Drawer */}
            {showQuotaEditor && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider">
                      Adjust Monthly AI Quotas & Resource Caps
                    </h5>
                  </div>
                  {quotaSavedNotice && (
                    <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Quotas Saved Successfully!</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[11px] flex-wrap gap-y-2">
                  <span className="text-slate-400 font-medium">Quick Tier Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyTierPreset('starter')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-400 text-[11px]"
                  >
                    Starter (500K tokens / 60m / 100K TTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTierPreset('pro')}
                    className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-[11px]"
                  >
                    Pro Standard (1M tokens / 120m / 250K TTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTierPreset('enterprise')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-400 text-[11px]"
                  >
                    Enterprise (5M tokens / 600m / 1M TTS)
                  </button>
                </div>

                <form onSubmit={handleSaveQuotas} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Monthly Token Quota (LLMs)
                    </label>
                    <input
                      type="number"
                      min="10000"
                      step="50000"
                      value={customTokenQuota}
                      onChange={(e) => setCustomTokenQuota(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">Total tokens across Gemini, Groq & OpenAI</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Monthly Audio Quota (STT Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="10"
                      value={customSttQuota}
                      onChange={(e) => setCustomSttQuota(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">Total customer voice minutes allowed</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Monthly TTS Quota (Characters)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="25000"
                      value={customTtsQuota}
                      onChange={(e) => setCustomTtsQuota(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">Total synthesized speech character capacity</p>
                  </div>

                  <div className="sm:col-span-3 flex justify-end items-center space-x-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleResetQuotas}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                    >
                      Reset to Defaults
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      Apply &amp; Save Quotas
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 4 Summary Cards: Total, Used, Remaining */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: LLM Reasoning Tokens */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>LLM Reasoning Tokens</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                    tokenQuotaDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                    tokenQuotaDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                    'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}>
                    {tokenQuotaDetail.percentRemaining}% Left
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black text-white font-mono">
                    {tokenQuotaDetail.used.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {tokenQuotaDetail.totalQuota.toLocaleString()}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono font-semibold flex items-center justify-between">
                    <span>Remaining:</span>
                    <span>{tokenQuotaDetail.remaining.toLocaleString()} tokens</span>
                  </div>
                </div>

                {/* Dual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: `${tokenQuotaDetail.percentUsed}%` }}
                      title={`Used: ${tokenQuotaDetail.percentUsed}%`}
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${tokenQuotaDetail.percentRemaining}%` }}
                      title={`Remaining: ${tokenQuotaDetail.percentRemaining}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Used: {tokenQuotaDetail.percentUsed}%</span>
                    <span>Available: {tokenQuotaDetail.percentRemaining}%</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1.5 text-[11px] text-slate-400 border-t border-slate-800/80">
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
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>STT Transcribed Audio</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                    sttQuotaDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                    sttQuotaDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                    'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}>
                    {sttQuotaDetail.percentRemaining}% Left
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {sttQuotaDetail.used}m{' '}
                    <span className="text-xs font-normal text-slate-400">/ {sttQuotaDetail.totalQuota}m</span>
                  </div>
                  <div className="text-[11px] text-cyan-400 font-mono font-semibold flex items-center justify-between">
                    <span>Remaining:</span>
                    <span>{sttQuotaDetail.remaining} mins audio</span>
                  </div>
                </div>

                {/* Dual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-400 h-full"
                      style={{ width: `${sttQuotaDetail.percentUsed}%` }}
                      title={`Used: ${sttQuotaDetail.percentUsed}%`}
                    />
                    <div
                      className="bg-cyan-500 h-full"
                      style={{ width: `${sttQuotaDetail.percentRemaining}%` }}
                      title={`Remaining: ${sttQuotaDetail.percentRemaining}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Used: {sttQuotaDetail.percentUsed}%</span>
                    <span>Available: {sttQuotaDetail.percentRemaining}%</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1.5 text-[11px] text-slate-400 border-t border-slate-800/80">
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
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>TTS Spoken Characters</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                    ttsQuotaDetail.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                    ttsQuotaDetail.status === 'warning' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                    'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}>
                    {ttsQuotaDetail.percentRemaining}% Left
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black text-blue-400 font-mono">
                    {ttsQuotaDetail.used.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {ttsQuotaDetail.totalQuota.toLocaleString()}</span>
                  </div>
                  <div className="text-[11px] text-indigo-400 font-mono font-semibold flex items-center justify-between">
                    <span>Remaining:</span>
                    <span>{ttsQuotaDetail.remaining.toLocaleString()} chars</span>
                  </div>
                </div>

                {/* Dual Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-400 h-full"
                      style={{ width: `${ttsQuotaDetail.percentUsed}%` }}
                      title={`Used: ${ttsQuotaDetail.percentUsed}%`}
                    />
                    <div
                      className="bg-indigo-500 h-full"
                      style={{ width: `${ttsQuotaDetail.percentRemaining}%` }}
                      title={`Remaining: ${ttsQuotaDetail.percentRemaining}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Used: {ttsQuotaDetail.percentUsed}%</span>
                    <span>Available: {ttsQuotaDetail.percentRemaining}%</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1.5 text-[11px] text-slate-400 border-t border-slate-800/80">
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

              {/* Card 4: Cost Savings & Spend */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="flex items-center space-x-1.5 font-medium text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                    <span>Estimated Spend</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                    {usageStats.estimatedCost.savingsPercent}% Saved
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-black text-white font-mono flex items-baseline space-x-2">
                    <span>${usageStats.estimatedCost.totalCostUsd}</span>
                    <span className="text-xs font-normal text-slate-400">(₹{usageStats.estimatedCost.totalCostInr})</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono font-semibold flex items-center justify-between">
                    <span>Est. Budget Left:</span>
                    <span>${Math.max(0, Number((25.0 - usageStats.estimatedCost.totalCostUsd).toFixed(2)))}</span>
                  </div>
                </div>

                {/* Spend Meter */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-purple-400 h-full"
                      style={{ width: `${Math.min(100, Math.round((usageStats.estimatedCost.totalCostUsd / 25.0) * 100))}%` }}
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${Math.max(0, 100 - Math.round((usageStats.estimatedCost.totalCostUsd / 25.0) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Spent: ${(usageStats.estimatedCost.totalCostUsd).toFixed(2)}</span>
                    <span>Cap: $25.00/mo</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1.5 text-[11px] text-slate-400 border-t border-slate-800/80">
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

            {/* Section 1: LLM Reasoning Breakdown by Model (Total, Used, Remaining) */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">LLM Brain Models: Total Allowance, Used &amp; Remaining Tokens</h5>
                    <p className="text-[11px] text-slate-400">Total capacity, consumed prompt/completion tokens, and remaining available quota per model</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(usageStats.llm.byModel).map(([modelName, detail]) => {
                  const modelQuota = getModelTokenQuota(modelName, quotaConfig);
                  const modelDetail = calculateQuotaRemaining(detail.totalTokens, modelQuota);

                  return (
                    <div key={modelName} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-white text-xs">{modelName}</div>
                          <div className="text-[10px] text-slate-400">{detail.calls} conversational turns</div>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-amber-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                          {detail.avgLatencyMs || 250}ms
                        </span>
                      </div>

                      {/* 3-Column Quota Stats Box */}
                      <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase font-semibold">Total Quota</div>
                          <div className="font-mono font-bold text-white text-xs">{modelDetail.totalQuota.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase font-semibold">Used ({modelDetail.percentUsed}%)</div>
                          <div className="font-mono font-bold text-amber-400 text-xs">{modelDetail.used.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase font-semibold">Remaining</div>
                          <div className="font-mono font-bold text-emerald-400 text-xs">{modelDetail.remaining.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Tri-Color Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-slate-500 h-full"
                            style={{
                              width: `${Math.round((detail.promptTokens / Math.max(1, modelDetail.totalQuota)) * 100)}%`,
                            }}
                            title={`Input Prompt: ${detail.promptTokens.toLocaleString()} tokens`}
                          />
                          <div
                            className="bg-amber-400 h-full"
                            style={{
                              width: `${Math.round((detail.completionTokens / Math.max(1, modelDetail.totalQuota)) * 100)}%`,
                            }}
                            title={`Output Completion: ${detail.completionTokens.toLocaleString()} tokens`}
                          />
                          <div
                            className="bg-emerald-500 h-full"
                            style={{
                              width: `${modelDetail.percentRemaining}%`,
                            }}
                            title={`Remaining: ${modelDetail.remaining.toLocaleString()} tokens (${modelDetail.percentRemaining}%)`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          <span className="flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            <span>Used: {modelDetail.percentUsed}%</span>
                          </span>
                          <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            <span>Left: {modelDetail.percentRemaining}%</span>
                          </span>
                        </div>
                      </div>

                      {/* Detailed Input vs Output breakdown */}
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: STT & TTS Providers Breakdown (Total, Used, Remaining) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* STT Breakdown */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">Speech-to-Text (STT): Total, Used &amp; Remaining Audio</h5>
                    <p className="text-[11px] text-slate-400">Customer audio transcription quota breakdown</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(usageStats.stt.byProvider).map(([providerName, detail]) => {
                    const providerQuota = getSttMinutesQuota(providerName, quotaConfig);
                    const sttDetailObj = calculateQuotaRemaining(detail.audioMinutes, providerQuota);

                    return (
                      <div key={providerName} className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white text-xs">{providerName}</div>
                            <div className="text-[11px] text-slate-400">
                              {detail.requests} requests • ~{detail.wordsTranscribed.toLocaleString()} words
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                            sttDetailObj.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' :
                            sttDetailObj.status === 'warning' ? 'bg-amber-500/15 text-amber-300' :
                            'bg-rose-500/15 text-rose-300'
                          }`}>
                            {sttDetailObj.percentRemaining}% Left
                          </span>
                        </div>

                        {/* 3-Column Quota display */}
                        <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-950/50 p-1.5 rounded border border-slate-800/60 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-400 text-[9px] block">TOTAL</span>
                            <span className="text-white font-bold">{sttDetailObj.totalQuota}m</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[9px] block">USED ({sttDetailObj.percentUsed}%)</span>
                            <span className="text-emerald-400 font-bold">{sttDetailObj.used}m</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[9px] block">REMAINING</span>
                            <span className="text-cyan-400 font-bold">{sttDetailObj.remaining}m</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-400 h-full"
                            style={{ width: `${sttDetailObj.percentUsed}%` }}
                            title={`Used: ${sttDetailObj.percentUsed}%`}
                          />
                          <div
                            className="bg-cyan-500 h-full"
                            style={{ width: `${sttDetailObj.percentRemaining}%` }}
                            title={`Remaining: ${sttDetailObj.percentRemaining}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TTS Breakdown */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">Text-to-Speech (TTS): Total, Used &amp; Remaining Chars</h5>
                    <p className="text-[11px] text-slate-400">Priya AI synthesized speech character quota breakdown</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(usageStats.tts.byProvider).map(([providerName, detail]) => {
                    const providerQuota = getTtsCharsQuota(providerName, quotaConfig);
                    const ttsDetailObj = calculateQuotaRemaining(detail.characters, providerQuota);

                    return (
                      <div key={providerName} className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white text-xs">{providerName}</div>
                            <div className="text-[11px] text-slate-400">
                              {detail.requests} utterances • {detail.audioMinutes}m spoken
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                            ttsDetailObj.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' :
                            ttsDetailObj.status === 'warning' ? 'bg-amber-500/15 text-amber-300' :
                            'bg-rose-500/15 text-rose-300'
                          }`}>
                            {ttsDetailObj.percentRemaining}% Left
                          </span>
                        </div>

                        {/* 3-Column Quota display */}
                        <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-950/50 p-1.5 rounded border border-slate-800/60 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-400 text-[9px] block">TOTAL</span>
                            <span className="text-white font-bold">{ttsDetailObj.totalQuota.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[9px] block">USED ({ttsDetailObj.percentUsed}%)</span>
                            <span className="text-blue-400 font-bold">{ttsDetailObj.used.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[9px] block">REMAINING</span>
                            <span className="text-indigo-400 font-bold">{ttsDetailObj.remaining.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-blue-400 h-full"
                            style={{ width: `${ttsDetailObj.percentUsed}%` }}
                            title={`Used: ${ttsDetailObj.percentUsed}%`}
                          />
                          <div
                            className="bg-indigo-500 h-full"
                            style={{ width: `${ttsDetailObj.percentRemaining}%` }}
                            title={`Remaining: ${ttsDetailObj.percentRemaining}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Twilio Physical Telephony */}
        {activeTab === 'twilio' && (
          <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs">
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
                    placeholder={
                      twilioConfig?.accountSidMasked
                        ? `${twilioConfig.accountSidMasked} (Leave blank to keep saved SID)`
                        : 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                    required={!twilioConfig?.configured}
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
                    placeholder={
                      twilioConfig?.phoneNumberMasked
                        ? `${twilioConfig.phoneNumberMasked} (Leave blank to keep saved number)`
                        : '+14155552671 or +91XXXXXXXXXX'
                    }
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                    required={!twilioConfig?.configured}
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
      </div>
    </div>
  );
};
