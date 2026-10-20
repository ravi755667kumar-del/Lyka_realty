import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CircleDashed,
  AlertCircle,
  BookOpen,
  HelpCircle,
  Play,
  FileCode,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function TopicChecklist({ level }) {
  const { openStudyModal, openDiagnosticModal } = useRoadmap();
  const [activeTooltip, setActiveTooltip] = useState(null);

  if (!level || !level.topics) return null;

  const topics = level.topics;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>In Progress</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
            <CircleDashed className="w-3.5 h-3.5" />
            <span>Not Started</span>
          </span>
        );
    }
  };

  const getIncompleteReasons = (topic) => {
    const reasons = [];
    if (topic.status === 'Completed') return reasons;

    if (!topic.lessonCompleted) {
      reasons.push('Core lesson content has not been reviewed');
    }

    const passingScore = topic.requiredPassingScore ?? 70;
    if (topic.assessmentScore !== null && topic.assessmentScore !== undefined) {
      if (topic.assessmentScore < passingScore) {
        reasons.push(`Assessment score (${topic.assessmentScore}%) is below the required ${passingScore}% passing score`);
      }
    } else {
      reasons.push(`Topic quiz/assessment has not been taken (requires ≥ ${passingScore}%)`);
    }

    if (topic.requiresExercise && !topic.exerciseSubmitted) {
      reasons.push('Hands-on practical exercise has not been submitted');
    }

    return reasons;
  };

  return (
    <div className="overflow-x-auto">
      {/* Desktop / Tablet Table View */}
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/60">
            <th className="py-3 px-4">#</th>
            <th className="py-3 px-4">Topic & Learning Objectives</th>
            <th className="py-3 px-4">Lesson</th>
            <th className="py-3 px-4">Assessment</th>
            <th className="py-3 px-4">Exercise</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {topics.map((topic, index) => {
            const incompleteReasons = getIncompleteReasons(topic);
            const isCompleted = topic.status === 'Completed';
            const isCurrent = level.currentTopic?.id === topic.id;

            return (
              <tr
                key={topic.id}
                className={`transition-colors hover:bg-gray-800/30 ${
                  isCurrent ? 'bg-indigo-950/20' : ''
                }`}
              >
                {/* Index */}
                <td className="py-3.5 px-4 text-xs font-mono text-gray-500">
                  {index + 1}
                </td>

                {/* Topic Info */}
                <td className="py-3.5 px-4">
                  <div className="flex items-start gap-2">
                    <div>
                      <div className="font-semibold text-gray-200 flex items-center gap-2">
                        <span>{topic.title}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Current Topic
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1 max-w-md mt-0.5">
                        {topic.shortExplanation}
                      </p>
                      {topic.learningObjectives && topic.learningObjectives.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500">
                          <span className="text-indigo-400 font-medium">Goal:</span>
                          <span className="truncate max-w-sm">{topic.learningObjectives[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Lesson criteria */}
                <td className="py-3.5 px-4 text-xs">
                  {topic.lessonCompleted ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">Pending</span>
                  )}
                </td>

                {/* Assessment criteria */}
                <td className="py-3.5 px-4 text-xs">
                  {topic.assessmentScore !== null && topic.assessmentScore !== undefined ? (
                    <div className="space-y-0.5">
                      <span
                        className={`font-semibold ${
                          topic.assessmentScore >= (topic.requiredPassingScore ?? 70)
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {topic.assessmentScore}%
                      </span>
                      <div className="text-[10px] text-gray-500">
                        req &ge; {topic.requiredPassingScore ?? 70}%
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">Not taken</span>
                  )}
                </td>

                {/* Exercise criteria */}
                <td className="py-3.5 px-4 text-xs">
                  {topic.exerciseSubmitted ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Submitted</span>
                    </span>
                  ) : topic.requiresExercise ? (
                    <span className="text-gray-500">Required</span>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </td>

                {/* Status + Why Incomplete popup */}
                <td className="py-3.5 px-4 relative">
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(topic.status)}

                    {!isCompleted && incompleteReasons.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveTooltip(activeTooltip === topic.id ? null : topic.id)}
                          className="text-gray-500 hover:text-amber-400 transition-colors p-0.5"
                          title="Click to view why topic is incomplete"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>

                        {activeTooltip === topic.id && (
                          <div className="absolute left-0 bottom-full mb-2 z-30 w-72 p-3 bg-gray-900 border border-amber-500/30 rounded-xl shadow-2xl text-xs space-y-1.5">
                            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Completion Requirements Pending:</span>
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-gray-300">
                              {incompleteReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                            <div className="text-[10px] text-gray-500 pt-1 border-t border-gray-800">
                              Click "Study Topic" to satisfy remaining criteria.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Skip / Diagnostic button if not completed */}
                    {!isCompleted && (
                      <button
                        onClick={() => openDiagnosticModal(level, topic)}
                        className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition-all"
                        title="Already know this? Pass the diagnostic assessment to test out"
                      >
                        <span className="hidden xl:inline">Test Out</span>
                        <GraduationCap className="w-3.5 h-3.5 xl:hidden" />
                      </button>
                    )}

                    {/* Resume / Study button */}
                    <button
                      onClick={() => openStudyModal(level, topic)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                        isCompleted
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                          : isCurrent
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isCompleted ? 'Review' : 'Study Topic'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
