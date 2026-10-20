import React from 'react';
import {
  Compass,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Target,
  Flame,
  Award,
  BookOpen,
  AlertTriangle
} from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';
import { useAuth } from '../context/AuthContext';

export default function OverallDashboard() {
  const { user } = useAuth();
  const { roadmap, aiRecommendation, recentAssessments, openStudyModal } = useRoadmap();

  if (!roadmap) return null;

  const overallProgress = roadmap.overallProgress ?? 0;
  const completedTopics = roadmap.completedTopics ?? 0;
  const totalTopics = roadmap.totalTopics ?? 0;
  const remainingTopics = roadmap.remainingTopics ?? 0;
  const completedLevels = roadmap.completedLevelsCount ?? 0;
  const totalLevels = roadmap.totalLevelsCount ?? 7;
  const currentLevel = roadmap.currentLevel || { title: 'Level 4: Machine Learning' };
  const currentTopic = roadmap.currentTopic || { title: 'Random Forest' };

  // Handler to resume current topic
  const handleResumeCurrentTopic = () => {
    const lvl = roadmap.levels.find((l) => l.id === currentTopic.levelId) ||
                roadmap.levels.find((l) => l.status === 'In Progress') ||
                roadmap.levels[3];
    const top = lvl?.topics.find((t) => t.id === currentTopic.id) ||
                lvl?.topics.find((t) => t.status === 'In Progress') ||
                lvl?.topics?.[0];
    if (lvl && top) {
      openStudyModal(lvl, top);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Card: Primary Goal & Overall Progress */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-[#111827] to-indigo-950/40 border border-gray-800 p-6 sm:p-8 shadow-2xl">
        {/* Ambient lighting orb */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Learning Goal & Status */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Personalized Learning Roadmap</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {roadmap.goal || 'AI / Machine Learning Engineer'}
            </h1>

            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              Track your level-wise progress with rigorous completion validation. Every topic requires core lesson completion, passing an assessment (&ge;70%), and submitting practical exercises.
            </p>

            {/* Quick meta indicators */}
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-300">
              <div className="flex items-center gap-1.5 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700/60">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Current Level: <strong className="text-white font-medium">{currentLevel.title}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700/60">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <span>Current Topic: <strong className="text-white font-medium">{currentTopic.title}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Circular / Radial Overall Progress */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-gray-950/40 rounded-xl border border-gray-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between w-full mb-3 px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Roadmap Completion</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Weighted
              </span>
            </div>

            {/* Big Percentage Display & Progress Bar */}
            <div className="w-full text-center py-2">
              <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-teal-300 to-emerald-400 tracking-tight">
                {overallProgress}%
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {completedTopics} of {totalTopics} required curriculum topics mastered
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="w-full mt-3">
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden p-[1px]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 transition-all duration-700 ease-out progress-striped"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between w-full text-[11px] text-gray-500 mt-2 px-1">
              <span>{completedLevels} Levels Finished</span>
              <span>{remainingTopics} Topics Remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Overall Progress */}
        <div className="glass-panel p-4 rounded-xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Overall Progress</div>
            <div className="text-xl font-bold text-white tracking-tight">{overallProgress}%</div>
          </div>
        </div>

        {/* Metric 2: Levels Completed */}
        <div className="glass-panel p-4 rounded-xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Levels Unlocked</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {completedLevels} <span className="text-xs text-gray-500 font-normal">/ {totalLevels}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Topics Mastered */}
        <div className="glass-panel p-4 rounded-xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Topics Mastered</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {completedTopics} <span className="text-xs text-gray-500 font-normal">/ {totalTopics}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Study Streak */}
        <div className="glass-panel p-4 rounded-xl border border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5 fill-amber-500" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Study Streak</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {user?.studyStreak || 12} <span className="text-xs text-gray-500 font-normal">Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendation Banner (Requirement 7) */}
      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-gray-900 to-indigo-900/20 p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">AI Mentor Recommendation</span>
                <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded">Adaptive Guidance</span>
              </div>
              <p className="text-sm text-gray-200 leading-snug">
                {aiRecommendation?.recommendation ||
                  `You have completed ${roadmap.levels[3]?.completionPercentage || 60}% of the Machine Learning level. You have ${roadmap.levels[3]?.remainingTopicsCount || 4} topics remaining. Your current topic is ${currentTopic.title}. Complete the ${currentTopic.title} lesson and assessment before moving to Support Vector Machines.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleResumeCurrentTopic}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all shrink-0 cursor-pointer"
          >
            <span>Resume Current Topic</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Level-Wise Mini Snapshot Progress Strip (Requirement 5 Example) */}
      <div className="glass-panel rounded-xl p-5 border border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <span>Curriculum Progress Breakdown</span>
          </h2>
          <span className="text-xs text-gray-500">Calculated strictly from saved topic assessments</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-1">
          {roadmap.levels.map((lvl) => (
            <div
              key={lvl.id}
              className={`p-3 rounded-lg border text-left transition-all ${
                lvl.status === 'Completed'
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : lvl.status === 'In Progress'
                  ? 'bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/20'
                  : 'bg-gray-900/40 border-gray-800 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-gray-300">Level {lvl.order}</span>
                <span
                  className={`font-bold ${
                    lvl.status === 'Completed'
                      ? 'text-emerald-400'
                      : lvl.status === 'In Progress'
                      ? 'text-indigo-400'
                      : 'text-gray-500'
                  }`}
                >
                  {lvl.completionPercentage}%
                </span>
              </div>
              <div className="text-[11px] text-gray-400 truncate mb-2" title={lvl.title.replace(/^Level \d+:\s*/, '')}>
                {lvl.title.replace(/^Level \d+:\s*/, '')}
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    lvl.status === 'Completed'
                      ? 'bg-emerald-400'
                      : lvl.status === 'In Progress'
                      ? 'bg-indigo-500'
                      : 'bg-gray-700'
                  }`}
                  style={{ width: `${lvl.completionPercentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
