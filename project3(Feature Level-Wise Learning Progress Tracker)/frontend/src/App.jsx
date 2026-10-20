import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { RoadmapProvider, useRoadmap } from './context/RoadmapContext';
import Navbar from './components/Navbar';
import ChatbotInterface from './components/ChatbotInterface';
import TopicStudyModal from './components/TopicStudyModal';
import DiagnosticTestModal from './components/DiagnosticTestModal';
import UrlAnalyzerModal from './components/UrlAnalyzerModal';
import AutomatedTestRunnerModal from './components/AutomatedTestRunnerModal';
import LevelCelebrationModal from './components/LevelCelebrationModal';

function DashboardContent() {
  const { roadmap } = useRoadmap();
  const [selectedLevelId, setSelectedLevelId] = useState(() => {
    try {
      return localStorage.getItem('cosmo_selected_level_id') || null;
    } catch (e) {
      return null;
    }
  });
  const [selectedTopicId, setSelectedTopicId] = useState(() => {
    try {
      return localStorage.getItem('cosmo_selected_topic_id') || null;
    } catch (e) {
      return null;
    }
  });

  // Derive activeLevel from selectedLevelId and current fresh roadmap
  const activeLevel = (selectedLevelId && roadmap?.levels?.find((l) => l.id === selectedLevelId)) ||
    roadmap?.levels?.find((l) => l.status === 'In Progress') ||
    roadmap?.levels?.[0];

  // Derive currentTopic from selectedTopicId and activeLevel
  const currentTopic = (selectedTopicId && activeLevel?.topics?.find((t) => t.id === selectedTopicId)) ||
    activeLevel?.topics?.find((t) => t.status !== 'Completed') ||
    activeLevel?.topics?.[0];

  const handleSelectLevel = (lvl) => {
    if (lvl) {
      setSelectedLevelId(lvl.id);
      setSelectedTopicId(null);
      try {
        localStorage.setItem('cosmo_selected_level_id', lvl.id);
        localStorage.removeItem('cosmo_selected_topic_id');
      } catch (e) {}
    }
  };

  const handleSelectTopic = (top) => {
    if (top) {
      setSelectedTopicId(top.id);
      try {
        localStorage.setItem('cosmo_selected_topic_id', top.id);
      } catch (e) {}
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070A12] text-gray-100">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-2 sm:px-6 py-4 flex flex-col">
        <div className="flex-1 flex flex-col w-full h-full">
          <ChatbotInterface
            selectedLevel={activeLevel}
            selectedTopic={currentTopic}
            onSelectLevel={handleSelectLevel}
            onSelectTopic={handleSelectTopic}
          />
        </div>
      </main>

      {/* Global Modals triggered from in-chat interactive widgets */}
      <TopicStudyModal />
      <DiagnosticTestModal />
      <UrlAnalyzerModal />
      <AutomatedTestRunnerModal />
      <LevelCelebrationModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RoadmapProvider>
        <DashboardContent />
      </RoadmapProvider>
    </AuthProvider>
  );
}
