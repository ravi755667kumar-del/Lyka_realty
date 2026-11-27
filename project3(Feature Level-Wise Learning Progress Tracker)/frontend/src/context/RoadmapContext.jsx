import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from './AuthContext';

const RoadmapContext = createContext();

export const RoadmapProvider = ({ children }) => {
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [activeModal, setActiveModal] = useState({ type: null, data: null });
  const [celebration, setCelebration] = useState({ open: false, levelTitle: '', nextLevelTitle: '' });

  // Fetch roadmap data
  const fetchRoadmap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const studentId = user?.id || 'student-demo-1';
      const res = await fetch(`/api/roadmap?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.success && data.roadmap) {
        setRoadmap(data.roadmap);
      }
    } catch (err) {
      console.error('Failed to load roadmap:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch AI recommendation
  const fetchRecommendation = useCallback(async () => {
    try {
      const studentId = user?.id || 'student-demo-1';
      const res = await fetch(`/api/ai/recommendations?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (data.success) {
        setAiRecommendation(data);
      }
    } catch (err) {
      console.warn('AI recommendation fetch error:', err.message);
    }
  }, [user?.id]);

  // Fetch recent assessments
  const fetchAssessments = useCallback(async () => {
    try {
      const studentId = user?.id || 'student-demo-1';
      const res = await fetch(`/api/progress/recent-assessments?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (data.success) {
        setRecentAssessments(data.assessments || []);
      }
    } catch (err) {
      console.warn('Assessment list error:', err.message);
    }
  }, [user?.id]);

  // On initial mount / browser refresh: start fresh and clean (no DB persistence)
  useEffect(() => {
    let isMounted = true;

    const initFreshSessionOnRefresh = async () => {
      setLoading(true);
      const studentId = user?.id || 'student-demo-1';
      try {
        // Clear local storage chat cache
        try {
          localStorage.removeItem(`teacher_luna_chat_${studentId}`);
        } catch (e) {}

        const res = await fetch('/api/progress/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId })
        });
        const data = await res.json();
        if (isMounted && data.roadmap) {
          setRoadmap(data.roadmap);
        }
      } catch (err) {
        console.warn('Initial fresh reset notice, falling back to standard fetch:', err);
        if (isMounted) await fetchRoadmap();
      } finally {
        if (isMounted) setLoading(false);
      }
      if (isMounted) {
        fetchRecommendation();
        fetchAssessments();
      }
    };

    initFreshSessionOnRefresh();

    return () => {
      isMounted = false;
    };
  }, [user?.id, fetchRoadmap, fetchRecommendation, fetchAssessments]);

  // Refresh all data from database on demand
  const refreshAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRoadmap(),
        fetchRecommendation(),
        fetchAssessments()
      ]);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRoadmap, fetchRecommendation, fetchAssessments]);

  // Update a topic (lesson, assessment, exercise)
  const updateTopic = async (levelId, topicId, updates) => {
    try {
      const prevLevel = roadmap?.levels?.find((l) => l.id === levelId);
      const prevPercentage = prevLevel?.completionPercentage ?? 0;

      const res = await fetch('/api/progress/update-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapId: roadmap?.id || 'roadmap-aiml-1',
          studentId: user?.id || 'student-demo-1',
          levelId,
          topicId,
          updates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update topic');
      }

      setRoadmap(data.roadmap);
      fetchRecommendation();
      fetchAssessments();

      // Trigger celebration if level transitioned to 100% completion!
      const newLevel = data.roadmap?.levels?.find((l) => l.id === levelId);
      if (prevPercentage < 100 && newLevel?.completionPercentage === 100) {
        const nextLvl = data.roadmap.levels.find((l) => l.order === (newLevel.order + 1));
        triggerConfetti();
        setCelebration({
          open: true,
          levelTitle: newLevel.title,
          nextLevelTitle: nextLvl ? nextLvl.title : null,
        });
      }

      return data;
    } catch (err) {
      console.error('Update topic error:', err);
      throw err;
    }
  };

  // Submit diagnostic test to test out of topic
  const submitDiagnostic = async (levelId, topicId, score) => {
    try {
      const res = await fetch('/api/progress/diagnostic-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapId: roadmap?.id || 'roadmap-aiml-1',
          studentId: user?.id || 'student-demo-1',
          levelId,
          topicId,
          score,
        }),
      });
      const data = await res.json();
      if (!res.ok || (data.success === false && data.passed === false)) {
        return data;
      }
      if (data.roadmap) {
        setRoadmap(data.roadmap);
        fetchRecommendation();
        fetchAssessments();
      }
      return data;
    } catch (err) {
      console.error('Diagnostic error:', err);
      throw err;
    }
  };

  // Reset roadmap
  const resetProgress = async () => {
    try {
      const res = await fetch('/api/progress/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user?.id || 'student-demo-1' }),
      });
      const data = await res.json();
      if (data.roadmap) {
        setRoadmap(data.roadmap);
        if (data.roadmap.levels && data.roadmap.levels.length > 0) {
          const firstLvl = data.roadmap.levels.find(l => l.status === 'In Progress') || data.roadmap.levels[0];
          setSelectedLevel(firstLvl);
          if (firstLvl.topics && firstLvl.topics.length > 0) {
            setSelectedTopic(firstLvl.topics.find(t => t.status !== 'Completed') || firstLvl.topics[0]);
          }
        }
        fetchRecommendation();
        fetchAssessments();
        return data.roadmap;
      }
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Analyze external link via LangChain or standard pipeline
  const analyzeExternalUrl = async (url, options = {}) => {
    const res = await fetch('/api/ai/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, studentId: user?.id || 'student-demo-1', generatePhoto: true, ...options }),
    });
    return res.json();
  };

  // Dedicated LangChain Link Analysis, Structured Notes & Photo Generation
  const analyzeLinkWithLangChain = async (url, options = {}) => {
    const res = await fetch('/api/ai/langchain/analyze-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, studentId: user?.id || 'student-demo-1', generatePhoto: true, ...options }),
    });
    return res.json();
  };

  // Search resources via SerpApi
  const searchResources = async (query) => {
    const res = await fetch(`/api/resources/search?q=${encodeURIComponent(query)}`);
    return res.json();
  };

  // Switch or dynamically create course curriculum
  const switchCourseRoadmap = async (goal, experienceLevel = 'beginner') => {
    try {
      setLoading(true);
      const res = await fetch('/api/roadmap/create-or-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user?.id || 'student-demo-1',
          goal,
          experienceLevel
        })
      });
      const data = await res.json();
      if (data.success && data.roadmap) {
        setRoadmap(data.roadmap);
        fetchRecommendation();
        fetchAssessments();
        return data;
      }
    } catch (err) {
      console.error('Failed to switch course:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'],
      });
    } catch (e) {
      // safe fallback
    }
  };

  const openStudyModal = (level, topic) => {
    setActiveModal({ type: 'study', data: { level, topic } });
  };

  const openDiagnosticModal = (level, topic) => {
    setActiveModal({ type: 'diagnostic', data: { level, topic } });
  };

  const openUrlModal = () => {
    setActiveModal({ type: 'url', data: null });
  };

  const openTestsModal = () => {
    setActiveModal({ type: 'tests', data: null });
  };

  const closeModal = () => {
    setActiveModal({ type: null, data: null });
  };

  return (
    <RoadmapContext.Provider
      value={{
        roadmap,
        setRoadmap,
        loading,
        error,
        aiRecommendation,
        recentAssessments,
        activeModal,
        celebration,
        setCelebration,
        fetchRoadmap,
        refreshAllData,
        switchCourseRoadmap,
        updateTopic,
        submitDiagnostic,
        resetProgress,
        analyzeExternalUrl,
        analyzeLinkWithLangChain,
        searchResources,
        openStudyModal,
        openDiagnosticModal,
        openUrlModal,
        openTestsModal,
        closeModal,
      }}
    >
      {children}
    </RoadmapContext.Provider>
  );
};

export const useRoadmap = () => useContext(RoadmapContext);
