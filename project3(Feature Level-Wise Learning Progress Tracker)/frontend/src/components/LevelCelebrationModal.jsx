import React from 'react';
import { Award, Sparkles, CheckCircle2, ArrowRight, X, LockOpen } from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function LevelCelebrationModal() {
  const { celebration, setCelebration } = useRoadmap();

  if (!celebration.open) return null;

  const handleClose = () => {
    setCelebration({ open: false, levelTitle: '', nextLevelTitle: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 to-[#0B0F19] border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl overflow-hidden">
        {/* Glow behind award icon */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 space-y-4">
          {/* Trophy badge */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/30">
            <div className="w-full h-full bg-gray-950 rounded-[15px] flex items-center justify-center">
              <Award className="w-8 h-8 text-emerald-400 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Level Transition Triggered</span>
            </span>
            <h2 className="text-2xl font-extrabold text-white">Level Completed!</h2>
            <p className="text-sm font-semibold text-emerald-300">{celebration.levelTitle}</p>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            All completion criteria, quizzes, and exercises for this level have reached 100% mastery. Your progress has been persistently synchronized.
          </p>

          {celebration.nextLevelTitle && (
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <LockOpen className="w-4 h-4 text-indigo-400" />
                <span>Next Level Unlocked:</span>
              </div>
              <div className="text-sm font-bold text-white">{celebration.nextLevelTitle}</div>
              <p className="text-[11px] text-gray-400">
                Prerequisites satisfied. You are eligible to begin Level coursework now.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Continue Learning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
