import React from 'react';
import { Building2, Bot, ArrowRight, Phone, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onNavigateToAdmin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAdmin }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 max-w-5xl mx-auto space-y-16 animate-in fade-in duration-500">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-2xl shadow-amber-500/20">
          <Building2 className="w-12 h-12" />
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
          Lyka Realty <span className="text-amber-400">AI</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          The autonomous cold-calling engine that automatically dials, qualifies, and manages your real estate leads using cutting-edge AI.
        </p>
        <div className="flex items-center justify-center pt-4">
          <button
            onClick={onNavigateToAdmin}
            className="flex items-center space-x-2 px-8 py-4 rounded-full font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all hover:scale-105 shadow-xl"
          >
            <span>Access Admin Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12 border-t border-slate-800">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
          <Bot className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Autonomous Agents</h3>
          <p className="text-sm text-slate-400">Multi-lingual AI agents converse naturally in English, Hindi, and Tanglish.</p>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
          <Phone className="w-8 h-8 text-blue-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Voice Calling</h3>
          <p className="text-sm text-slate-400">Directly calls mobile networks or runs real-time voice in-browser to qualify leads.</p>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Smart CRM</h3>
          <p className="text-sm text-slate-400">Auto-updates lead profiles with budget, location, and timeline seamlessly.</p>
        </div>
      </div>
    </div>
  );
};
