import React from 'react';
import { Layers, Sparkles, Filter } from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';
import LevelCard from './LevelCard';

export default function RoadmapTimeline() {
  const { roadmap, loading } = useRoadmap();

  if (loading && !roadmap) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading personalized learning roadmap...</p>
      </div>
    );
  }

  if (!roadmap) return null;

  const levels = roadmap.levels || [];

  return (
    <div className="space-y-6 pt-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Curriculum Levels & Progression
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Levels unlock sequentially as prerequisites reach 100% completion
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Completed
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            In Progress
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            Locked
          </span>
        </div>
      </div>

      {/* Level Cards Stack */}
      <div className="space-y-4">
        {levels.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            isInitiallyExpanded={level.status === 'In Progress' || level.order === 4}
          />
        ))}
      </div>
    </div>
  );
}
