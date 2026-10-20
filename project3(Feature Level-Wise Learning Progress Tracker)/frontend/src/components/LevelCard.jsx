import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  Flame,
  AlertCircle
} from 'lucide-react';
import TopicChecklist from './TopicChecklist';

export default function LevelCard({ level, isInitiallyExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  if (!level) return null;

  const percentage = level.completionPercentage ?? 0;
  const completedTopics = level.completedTopicsCount ?? 0;
  const totalTopics = level.totalTopics ?? (level.topics?.length || 0);
  const remainingTopics = level.remainingTopicsCount ?? (totalTopics - completedTopics);
  const currentTopic = level.currentTopic;
  const nextTopic = level.nextTopic;
  const estimatedHours = level.estimatedRemainingHours ?? 0;
  const status = level.status || 'Not Started';
  const isLocked = Boolean(level.isLocked);

  // Status badge helper
  const renderStatusBadge = () => {
    if (isLocked) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
          <Lock className="w-3.5 h-3.5" />
          <span>Locked</span>
        </span>
      );
    }
    if (status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed</span>
        </span>
      );
    }
    if (status === 'In Progress') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
          <span>In Progress</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
        <span>Not Started</span>
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-300 border ${
        isLocked
          ? 'bg-gray-950/40 border-gray-800/80 opacity-70'
          : status === 'Completed'
          ? 'bg-gradient-to-b from-[#111827] to-gray-900 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
          : status === 'In Progress'
          ? 'bg-gradient-to-b from-[#131b2e] to-gray-900 border-indigo-500/40 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/20'
          : 'bg-gray-900/60 border-gray-800'
      }`}
    >
      {/* Header bar */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & prerequisites */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                Level {level.order}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {level.title}
              </h2>
              {renderStatusBadge()}
            </div>

            {level.prerequisites && (
              <p className="text-xs text-gray-400">
                <span className="text-gray-500 font-medium">Prerequisites:</span> {level.prerequisites}
              </p>
            )}
          </div>

          {/* Metric percentage pill */}
          <div className="flex items-center gap-4 self-start md:self-auto">
            <div className="text-right">
              <div className="text-2xl font-black text-white tracking-tight font-mono">
                {percentage}%
              </div>
              <div className="text-[11px] text-gray-400">
                {completedTopics} / {totalTopics} topics
              </div>
            </div>

            {/* Toggle Accordion Button */}
            {!isLocked && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all cursor-pointer"
                title={isExpanded ? 'Collapse topic list' : 'Expand topic checklist'}
              >
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Level-Wise Percentage Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span className="font-medium text-gray-300">Level Progress: {percentage}%</span>
            <span>
              {remainingTopics > 0 ? `${remainingTopics} topics remaining` : 'All topics mastered!'}
            </span>
          </div>

          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden p-[1px]">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                status === 'Completed'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : status === 'In Progress'
                  ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400 progress-striped'
                  : 'bg-gray-700'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Level Summary Meta Row (Requirement 2 Example) */}
        {!isLocked && (
          <div className="mt-4 pt-4 border-t border-gray-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-950/40 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Completed Topics</span>
              <strong className="text-white text-sm">{completedTopics} / {totalTopics}</strong>
            </div>

            <div className="bg-gray-950/40 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Remaining Topics</span>
              <strong className="text-white text-sm">{remainingTopics}</strong>
            </div>

            <div className="bg-gray-950/40 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Current Topic</span>
              <strong className="text-indigo-400 truncate block text-xs" title={currentTopic?.title || 'None'}>
                {currentTopic?.title || 'None'}
              </strong>
            </div>

            <div className="bg-gray-950/40 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Est. Remaining Time</span>
              <strong className="text-teal-400 text-sm">
                {status === 'Completed' ? '0 hrs' : `~${estimatedHours} hrs`}
              </strong>
            </div>
          </div>
        )}

        {/* Locked explanation if locked */}
        {isLocked && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-900/40 p-3 rounded-lg border border-gray-800">
            <Lock className="w-4 h-4 text-gray-500 shrink-0" />
            <span>
              This level is locked. Complete 100% of the topics and assessments in the preceding level to unlock.
            </span>
          </div>
        )}
      </div>

      {/* Expandable Topic Checklist */}
      {!isLocked && isExpanded && (
        <div className="border-t border-gray-800/80 bg-gray-950/50 p-4 sm:p-6 rounded-b-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Topic Checklist & Assessment Milestones</span>
            </h3>
            <span className="text-xs text-gray-500">
              Select any topic to review lessons, take quizzes, or submit code
            </span>
          </div>

          <TopicChecklist level={level} />
        </div>
      )}
    </div>
  );
}
