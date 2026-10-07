import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Phone, Check, Copy, AlertCircle, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';
import { getVapiConfig, updateVapiConfig, getSarvamConfig, updateSarvamConfig, getGroqConfig, updateGroqConfig } from '../services/campaignService';
import { VapiConfig, SarvamConfig, GroqConfig } from '../types';


interface VapiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VapiSettingsModal: React.FC<VapiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<VapiConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sarvam state
  const [sarvamConfig, setSarvamConfig] = useState<SarvamConfig | null>(null);
  const [sarvamApiKey, setSarvamApiKey] = useState('');
  const [sarvamSaving, setSarvamSaving] = useState(false);
  const [sarvamSaveSuccess, setSarvamSaveSuccess] = useState(false);
  const [sarvamErrorMsg, setSarvamErrorMsg] = useState<string | null>(null);

  // Groq state
  const [groqConfig, setGroqConfig] = useState<GroqConfig | null>(null);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqSaving, setGroqSaving] = useState(false);
  const [groqSaveSuccess, setGroqSaveSuccess] = useState(false);
  const [groqErrorMsg, setGroqErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await getVapiConfig();
      setConfig(cfg);
      setPhoneNumberId(cfg.phoneNumberId || '');
      setAssistantId(cfg.assistantId || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load Vapi settings');
    }
    try {
      const scfg = await getSarvamConfig();
      setSarvamConfig(scfg);
    } catch {
      // Non-fatal — Sarvam may not be configured yet
    }
    try {
      const gcfg = await getGroqConfig();
      setGroqConfig(gcfg);
    } catch {
      // Non-fatal — Groq may not be configured yet
    }
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await updateVapiConfig({
        apiKey: apiKey.trim() || undefined,
        phoneNumberId: phoneNumberId.trim() || undefined,
        assistantId: assistantId.trim() || undefined,
      });
      setSaveSuccess(true);
      setApiKey('');
      await loadConfig();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSarvamSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSarvamSaving(true);
    setSarvamErrorMsg(null);
    setSarvamSaveSuccess(false);
    try {
      await updateSarvamConfig({ apiKey: sarvamApiKey.trim() || undefined });
      setSarvamSaveSuccess(true);
      setSarvamApiKey('');
      await loadConfig();
      setTimeout(() => setSarvamSaveSuccess(false), 3000);
    } catch (err: any) {
      setSarvamErrorMsg(err.message || 'Failed to save Sarvam key');
    } finally {
      setSarvamSaving(false);
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
      setTimeout(() => setGroqSaveSuccess(false), 3000);
    } catch (err: any) {
      setGroqErrorMsg(err.message || 'Failed to save Groq key');
    } finally {
      setGroqSaving(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/vapi/webhook` : '/api/vapi/webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Vapi Voice Calling Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Security notice */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-emerald-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-white text-xs">Zero-Exposure Security Architecture</span>
              <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                All Vapi API keys remain strictly stored on the secure server. The frontend never accesses or exposes your private key. Outbound calls are executed server-side.
              </p>
            </div>
          </div>

          {/* Vapi Private Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Vapi Private API Key</span>
              </label>
              {config?.apiKeyConfigured && (
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ✓ Configured on Server
                </span>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKeyConfigured ? '•••••••••••••••••••••••• (Leave blank to keep existing)' : 'Paste your private Vapi key (vapi_...)'}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-400">
              Obtain from <a href="https://dashboard.vapi.ai" target="_blank" rel="noreferrer" className="text-amber-400 underline">Vapi Dashboard</a> &gt; API Keys &gt; Private Key.
            </p>
          </div>

          {/* Vapi Phone Number ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>Outbound Phone Number ID (Optional for Cellular Calls)</span>
              </label>
              {config?.phoneNumberIdConfigured && (
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ✓ Connected
                </span>
              )}
            </div>
            <input
              type="text"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Leave blank for Browser AI Voice Calls (No number needed)"
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-400">
              Not required for Browser Calls! Only needed if you later decide to place real cellular phone calls.
            </p>
          </div>

          {/* Assistant ID (Optional) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              Optional Custom Assistant ID
            </label>
            <input
              type="text"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              placeholder="Leave blank to use Lyka Realty 5-Question Dynamic Agent"
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-400">
              By default, the server dynamically provisions the exact Lyka Realty script and 5 questions with Sarah 11Labs voice and gpt-4o-mini.
            </p>
          </div>

          {/* Webhook URL Card */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                Vapi Server Webhook URL
              </span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="bg-slate-900 px-3 py-2 rounded-lg font-mono text-[11px] text-slate-300 break-all select-all border border-slate-800">
              {webhookUrl}
            </div>
            <p className="text-[11px] text-slate-400">
              Automatically attached to all outbound calls. Vapi calls this webhook upon conversation completion to save transcript, duration, and classification into Firestore.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Settings updated and saved successfully!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              {saving ? 'Saving...' : 'Save Vapi Config'}
            </button>
          </div>
        </form>

        {/* ── Sarvam AI Voice Configuration (separate form) ─────────────────── */}
        <form onSubmit={handleSarvamSave} className="px-6 pb-6 space-y-4 text-xs border-t border-slate-800 pt-5">
          {/* Sarvam header */}
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-bold text-white">Sarvam AI Voice Engine</h4>
            {sarvamConfig?.apiKeyConfigured && (
              <span className="text-[10px] text-violet-300 font-semibold bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/30">
                ✓ Active
              </span>
            )}
          </div>

          {/* Description */}
          <div className="bg-violet-950/30 border border-violet-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-violet-300">
            <ShieldCheck className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-white text-xs">Sarvam Bulbul v3 — Indian Language Voice AI</span>
              <p className="text-[11px] text-violet-300/90 leading-relaxed">
                Replaces browser TTS with <strong>Anushka</strong> (English-IN), <strong>Meera</strong> (Hindi), and <strong>Pavithra</strong> (Tamil) — warm female AI voices with natural Indian accents. Also powers superior Hindi/Tamil speech recognition via <strong>Saaras v2</strong>.
              </p>
            </div>
          </div>

          {/* Voice preview pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Anushka', lang: 'English-IN', color: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
              { name: 'Meera', lang: 'Hindi', color: 'text-pink-300 border-pink-500/30 bg-pink-500/10' },
              { name: 'Pavithra', lang: 'Tamil-English', color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
            ].map((v) => (
              <div key={v.name} className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center space-x-1 ${v.color}`}>
                <span>🎙️</span>
                <span>{v.name}</span>
                <span className="opacity-60">• {v.lang}</span>
              </div>
            ))}
          </div>

          {/* Sarvam API Key input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-violet-400" />
                <span>Sarvam API Subscription Key</span>
              </label>
              {sarvamConfig?.apiKeyConfigured && (
                <span className="text-[10px] text-violet-400 font-semibold bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/30">
                  ✓ Configured
                </span>
              )}
            </div>
            <input
              type="password"
              value={sarvamApiKey}
              onChange={(e) => setSarvamApiKey(e.target.value)}
              placeholder={
                sarvamConfig?.apiKeyConfigured
                  ? '•••••••••••••••••••••••• (Leave blank to keep existing)'
                  : 'Paste your Sarvam subscription key...'
              }
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            />
            <p className="text-[11px] text-slate-400">
              Get your free API key from{' '}
              <a
                href="https://dashboard.sarvam.ai"
                target="_blank"
                rel="noreferrer"
                className="text-violet-400 underline"
              >
                dashboard.sarvam.ai
              </a>{' '}
              → API Keys. Stored securely on the server only.
            </p>
          </div>

          {sarvamSaveSuccess && (
            <div className="p-3 rounded-lg bg-violet-950/50 border border-violet-800 text-violet-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Sarvam API key saved! Voice calls will now use Bulbul v3.</span>
            </div>
          )}

          {sarvamErrorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{sarvamErrorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={sarvamSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/20 active:scale-95 transition-all"
            >
              {sarvamSaving ? 'Saving...' : 'Save Sarvam Key'}
            </button>
          </div>
        </form>

        {/* ─── Groq AI Configuration (separate form) ───────────────────────── */}
        <form onSubmit={handleGroqSave} className="px-6 pb-6 space-y-4 text-xs border-t border-slate-800 pt-5">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <h4 className="text-sm font-bold text-white">Groq AI Inference Engine</h4>
            {groqConfig?.apiKeyConfigured && (
              <span className="text-[10px] text-orange-300 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30">
                ✓ Active
              </span>
            )}
          </div>

          <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl p-3.5 flex items-start space-x-3 text-orange-300">
            <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-white text-xs">Groq Llama 3 Inference</span>
              <p className="text-[11px] text-orange-300/90 leading-relaxed">
                Powers the conversational brain of the AI assistant using ultra-fast <strong>llama-3.1-70b-versatile</strong> via Groq API.
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
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            />
          </div>

          {groqSaveSuccess && (
            <div className="p-3 rounded-lg bg-orange-950/50 border border-orange-800 text-orange-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Groq API key saved! Calls will now use LLM generation.</span>
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 text-white hover:bg-orange-500 shadow-md shadow-orange-600/20 active:scale-95 transition-all"
            >
              {groqSaving ? 'Saving...' : 'Save Groq Key'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

