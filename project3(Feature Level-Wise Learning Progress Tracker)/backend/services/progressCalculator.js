/**
 * Progress Calculator Service
 * Enforces rigorous completion criteria, level percentage calculations,
 * and roadmap weighted progress calculations.
 */

export const DEFAULT_PASSING_SCORE = 70;

/**
 * Evaluates whether a topic satisfies all completion criteria.
 * Does not count a topic as complete just because it was viewed.
 * 
 * @param {Object} topic - Topic object
 * @returns {Object} { isCompleted: boolean, reasons: string[], criteriaBreakdown: Object }
 */
export function evaluateTopicCompletion(topic) {
  const reasons = [];
  const criteria = {
    lessonCompleted: Boolean(topic.lessonCompleted),
    quizPassed: false,
    exerciseSubmitted: Boolean(topic.exerciseSubmitted),
  };

  const passingScore = topic.requiredPassingScore ?? DEFAULT_PASSING_SCORE;
  const currentScore = topic.assessmentScore ?? 0;

  // Check if topic is exempt by passing a diagnostic test
  if (topic.diagnosticPassed) {
    return {
      isCompleted: true,
      reasons: [],
      criteriaBreakdown: {
        lessonCompleted: true,
        quizPassed: true,
        exerciseSubmitted: true,
        diagnosticExempt: true,
        score: topic.diagnosticScore ?? 100,
      },
    };
  }

  // 1. Required lesson content must be completed
  if (!criteria.lessonCompleted) {
    reasons.push('Core lesson content has not been completed');
  }

  // 2. Assessment score must meet or exceed required passing score
  if (topic.assessmentScore !== null && topic.assessmentScore !== undefined) {
    if (currentScore >= passingScore) {
      criteria.quizPassed = true;
    } else {
      reasons.push(`Assessment score (${currentScore}%) is below the required passing threshold (${passingScore}%)`);
    }
  } else {
    reasons.push(`Assessment has not been attempted (passing score: ${passingScore}%)`);
  }

  // 3. Practical exercise must be submitted (if required)
  if (topic.requiresExercise && !criteria.exerciseSubmitted) {
    reasons.push('Practical exercise code or answer has not been submitted');
  } else if (!topic.requiresExercise) {
    criteria.exerciseSubmitted = true;
  }

  const isCompleted = reasons.length === 0;

  return {
    isCompleted,
    reasons,
    criteriaBreakdown: {
      ...criteria,
      score: currentScore,
      passingScore,
      exerciseStatus: topic.exerciseStatus || (criteria.exerciseSubmitted ? 'submitted' : 'pending'),
    },
  };
}

/**
 * Calculates level-wise percentage and metrics
 * Formula: Level completion percentage = (Completed topics / Total topics) * 100
 * 
 * @param {Array} topics - List of topics for this level
 * @returns {Object} Level progress metrics
 */
export function calculateLevelProgress(topics = []) {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return {
      percentage: 0,
      completedTopicsCount: 0,
      totalTopics: 0,
      remainingTopicsCount: 0,
      currentTopic: null,
      nextTopic: null,
      status: 'Not Started',
    };
  }

  let completedTopicsCount = 0;
  let currentTopic = null;
  let nextTopic = null;

  topics.forEach((t) => {
    const evaluation = evaluateTopicCompletion(t);
    if (evaluation.isCompleted || t.status === 'Completed') {
      completedTopicsCount++;
    } else if (!currentTopic) {
      currentTopic = t;
    } else if (!nextTopic && currentTopic.id !== t.id) {
      nextTopic = t;
    }
  });

  const remainingTopicsCount = totalTopics - completedTopicsCount;
  const percentage = Math.round((completedTopicsCount / totalTopics) * 100);

  // Check if any topic has any partial progress
  const hasPartialProgress = topics.some(
    (t) => t.lessonCompleted || t.assessmentScore !== null || t.exerciseSubmitted || t.status === 'In Progress'
  );

  let status = 'Not Started';
  if (completedTopicsCount === totalTopics && totalTopics > 0) {
    status = 'Completed';
  } else if (completedTopicsCount > 0 || hasPartialProgress) {
    status = 'In Progress';
  }

  // Estimate remaining study time in hours (default ~2.5 hrs per remaining topic)
  const estimatedRemainingHours = topics
    .filter((t) => t.status !== 'Completed')
    .reduce((acc, t) => acc + (t.estimatedHours || 2.5), 0);

  return {
    percentage,
    completedTopicsCount,
    totalTopics,
    remainingTopicsCount,
    currentTopic: currentTopic ? { id: currentTopic.id, title: currentTopic.title } : null,
    nextTopic: nextTopic ? { id: nextTopic.id, title: nextTopic.title } : null,
    status,
    estimatedRemainingHours: Math.round(estimatedRemainingHours * 10) / 10,
  };
}

/**
 * Calculates overall roadmap progress percentage using explicit weights
 * Formula: (Sum of weights of completed topics / Sum of all weights) * 100
 * 
 * @param {Array} levels - Array of levels containing topics
 * @returns {Object} Overall roadmap metrics
 */
export function calculateRoadmapProgress(levels = []) {
  let totalWeight = 0;
  let completedWeight = 0;
  let totalTopics = 0;
  let completedTopics = 0;
  let completedLevelsCount = 0;
  let currentLevel = null;
  let currentTopic = null;

  levels.forEach((level) => {
    const levelTopics = level.topics || [];
    let allLevelTopicsCompleted = levelTopics.length > 0;

    levelTopics.forEach((topic) => {
      totalTopics++;
      const weight = Number(topic.weight) || 1.0;
      totalWeight += weight;

      const evaluation = evaluateTopicCompletion(topic);
      const isComplete = evaluation.isCompleted || topic.status === 'Completed';

      if (isComplete) {
        completedTopics++;
        completedWeight += weight;
      } else {
        allLevelTopicsCompleted = false;
        if (!currentTopic && (!level.isLocked || level.status === 'In Progress')) {
          currentTopic = topic;
        }
      }
    });

    if (allLevelTopicsCompleted && levelTopics.length > 0) {
      completedLevelsCount++;
    } else if (!currentLevel && !level.isLocked) {
      currentLevel = level;
    }
  });

  const overallPercentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const remainingTopics = totalTopics - completedTopics;

  return {
    overallPercentage,
    totalTopics,
    completedTopics,
    remainingTopics,
    completedLevelsCount,
    totalLevelsCount: levels.length,
    currentLevel: currentLevel ? { id: currentLevel.id, title: currentLevel.title, order: currentLevel.order } : null,
    currentTopic: currentTopic ? { id: currentTopic.id, title: currentTopic.title, levelId: currentTopic.levelId } : null,
    totalWeight,
    completedWeight,
    calculationMethod: 'Weighted sum of topic workload across all curriculum levels',
  };
}
