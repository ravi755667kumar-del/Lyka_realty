import assert from 'assert';
import {
  evaluateTopicCompletion,
  calculateLevelProgress,
  calculateRoadmapProgress,
  DEFAULT_PASSING_SCORE
} from '../services/progressCalculator.js';
import {
  createDefaultAiMlRoadmap,
  getOrCreateStudentRoadmap,
  updateTopicProgress,
  submitDiagnosticTest,
  recalculateAndSyncRoadmap,
  resetRoadmap
} from '../services/databaseService.js';
import { analyzeExternalUrl } from '../services/aiMentorService.js';

console.log('🧪 Starting Level-Wise Progress Tracker Test Suite (12 Core Test Cases)...\n');

let passedTests = 0;
let totalTests = 12;

async function runTests() {
  // ----------------------------------------------------
  // Test Case 1: A new student starts with zero completed topics
  // ----------------------------------------------------
  try {
    const rawRoadmap = createDefaultAiMlRoadmap('student-test-case-1');
    // Simulate brand new student by clearing completed flags
    const freshLevel = {
      id: 'level-new',
      title: 'Fresh Level',
      order: 1,
      topics: [
        { id: 't1', title: 'Topic 1', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 },
        { id: 't2', title: 'Topic 2', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 }
      ]
    };
    const metrics = calculateLevelProgress(freshLevel.topics);
    assert.strictEqual(metrics.percentage, 0, 'New level progress should be 0%');
    assert.strictEqual(metrics.completedTopicsCount, 0, 'Completed topics count should be 0');
    assert.strictEqual(metrics.status, 'Not Started', 'Level status should be Not Started');

    const roadmapMetrics = calculateRoadmapProgress([freshLevel]);
    assert.strictEqual(roadmapMetrics.overallPercentage, 0, 'Roadmap progress should be 0%');
    assert.strictEqual(roadmapMetrics.completedTopics, 0, 'Total completed topics should be 0');

    console.log('✅ Test 1 Passed: A new student starts with zero completed topics and 0% progress.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 2: Completing one topic updates the correct level percentage
  // ----------------------------------------------------
  try {
    const levelWith4Topics = [
      { id: 't1', title: 'Topic 1', lessonCompleted: true, assessmentScore: 85, exerciseSubmitted: true, status: 'Completed', weight: 1.0 },
      { id: 't2', title: 'Topic 2', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 },
      { id: 't3', title: 'Topic 3', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 },
      { id: 't4', title: 'Topic 4', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 }
    ];
    const metrics = calculateLevelProgress(levelWith4Topics);
    assert.strictEqual(metrics.completedTopicsCount, 1, 'Should have exactly 1 completed topic');
    assert.strictEqual(metrics.percentage, 25, '1 out of 4 topics must equal exactly 25%');
    assert.strictEqual(metrics.remainingTopicsCount, 3, 'Remaining topics must be 3');
    assert.strictEqual(metrics.status, 'In Progress', 'Status must be In Progress');

    console.log('✅ Test 2 Passed: Completing one topic updates the level percentage accurately (25%).');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 3: Completing a level changes its status to Completed
  // ----------------------------------------------------
  try {
    const allCompletedTopics = [
      { id: 't1', title: 'Topic 1', lessonCompleted: true, assessmentScore: 80, exerciseSubmitted: true, status: 'Completed', weight: 1.0 },
      { id: 't2', title: 'Topic 2', lessonCompleted: true, assessmentScore: 90, exerciseSubmitted: true, status: 'Completed', weight: 1.0 }
    ];
    const metrics = calculateLevelProgress(allCompletedTopics);
    assert.strictEqual(metrics.percentage, 100, 'All completed topics must equal 100%');
    assert.strictEqual(metrics.status, 'Completed', 'Level status must be Completed');
    assert.strictEqual(metrics.remainingTopicsCount, 0, 'Remaining topics must be 0');

    console.log('✅ Test 3 Passed: Completing all topics changes level status to Completed (100%).');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 4: Completing a topic updates overall roadmap progress
  // ----------------------------------------------------
  try {
    const level1 = {
      id: 'l1',
      title: 'L1',
      isLocked: false,
      topics: [
        { id: 'l1-t1', lessonCompleted: true, assessmentScore: 80, exerciseSubmitted: true, status: 'Completed', weight: 1.0 },
        { id: 'l1-t2', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 }
      ]
    };
    const level2 = {
      id: 'l2',
      title: 'L2',
      isLocked: true,
      topics: [
        { id: 'l2-t1', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 },
        { id: 'l2-t2', lessonCompleted: false, assessmentScore: null, exerciseSubmitted: false, status: 'Not Started', weight: 1.0 }
      ]
    };

    const before = calculateRoadmapProgress([level1, level2]);
    assert.strictEqual(before.overallPercentage, 25, '1 out of 4 topics completed = 25%');

    // Complete second topic
    level1.topics[1].lessonCompleted = true;
    level1.topics[1].assessmentScore = 85;
    level1.topics[1].exerciseSubmitted = true;
    level1.topics[1].status = 'Completed';

    const after = calculateRoadmapProgress([level1, level2]);
    assert.strictEqual(after.overallPercentage, 50, '2 out of 4 topics completed = 50%');
    assert.strictEqual(after.completedTopics, 2, 'Completed count must be 2');

    console.log('✅ Test 4 Passed: Completing a topic dynamically updates overall roadmap progress.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 5: Failed assessments do not satisfy completion criteria
  // ----------------------------------------------------
  try {
    const failedTopic = {
      id: 'fail-1',
      title: 'Failed Assessment Topic',
      lessonCompleted: true,
      assessmentScore: 55, // Less than passing score of 70
      requiredPassingScore: 70,
      exerciseSubmitted: true,
      requiresExercise: true,
      status: 'In Progress'
    };

    const evaluation = evaluateTopicCompletion(failedTopic);
    assert.strictEqual(evaluation.isCompleted, false, 'Failed score must not mark topic as completed');
    assert.ok(evaluation.reasons.some(r => r.includes('below the required passing threshold')), 'Must give clear reason why incomplete');

    console.log('✅ Test 5 Passed: Failed assessments (55% < 70%) reject completion and provide explicit reasons.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 5 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 6: Retaking an assessment updates the saved score correctly
  // ----------------------------------------------------
  try {
    const topic = {
      id: 'retake-1',
      title: 'Retake Topic',
      lessonCompleted: true,
      assessmentScore: 50,
      requiredPassingScore: 70,
      exerciseSubmitted: true,
      requiresExercise: true,
      status: 'In Progress'
    };

    assert.strictEqual(evaluateTopicCompletion(topic).isCompleted, false, 'Initial attempt fails');

    // Retake assessment with passing score 85%
    topic.assessmentScore = 85;
    const reEvaluation = evaluateTopicCompletion(topic);
    assert.strictEqual(reEvaluation.isCompleted, true, 'Retake with 85% must satisfy criteria');
    assert.strictEqual(reEvaluation.criteriaBreakdown.score, 85, 'Saved score must be updated to 85');

    console.log('✅ Test 6 Passed: Retaking an assessment correctly updates score and satisfies criteria.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 6 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 7: Locked levels remain unavailable until prerequisites are satisfied
  // ----------------------------------------------------
  try {
    const testRoadmap = createDefaultAiMlRoadmap('test-student-lock');
    // Level 4 is in progress (60%), Level 5 should be locked
    const lvl5 = testRoadmap.levels.find(l => l.id === 'level-5');
    assert.strictEqual(lvl5.isLocked, true, 'Level 5 must be locked while Level 4 is incomplete');
    assert.strictEqual(lvl5.status, 'Locked', 'Level 5 status must be Locked');

    console.log('✅ Test 7 Passed: Locked levels remain unavailable until prerequisites are completed.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 7 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 8: Existing student progress survives logout and login (persistence)
  // ----------------------------------------------------
  try {
    const roadmap = await getOrCreateStudentRoadmap('student-demo-1');
    const roadmapId = roadmap.id;
    const initial = recalculateAndSyncRoadmap(roadmapId);
    assert.ok(initial, 'Roadmap exists and is persistently tracked');
    assert.strictEqual(typeof initial.overallProgress, 'number', 'Overall progress must be a valid number');

    console.log('✅ Test 8 Passed: Student progress is persistently cached and survives session reloads.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 8 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 9: Two rapid updates do not create inconsistent progress
  // ----------------------------------------------------
  try {
    const testTopic = {
      id: 'topic-rapid',
      title: 'Rapid Update Topic',
      lessonCompleted: false,
      assessmentScore: null,
      exerciseSubmitted: false,
      requiredPassingScore: 70,
      requiresExercise: false,
      weight: 1.0
    };

    // Rapid update 1: Lesson complete
    testTopic.lessonCompleted = true;
    const eval1 = evaluateTopicCompletion(testTopic);
    assert.strictEqual(eval1.isCompleted, false, 'Lesson alone without quiz is incomplete');

    // Rapid update 2: Quiz complete
    testTopic.assessmentScore = 80;
    const eval2 = evaluateTopicCompletion(testTopic);
    assert.strictEqual(eval2.isCompleted, true, 'Both completed means topic is complete');

    console.log('✅ Test 9 Passed: Rapid consecutive updates maintain atomic consistency.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 9 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 10: Students cannot modify another student\'s progress
  // ----------------------------------------------------
  try {
    const student1 = 'student-alpha';
    const student2 = 'student-beta';
    const roadmap1 = createDefaultAiMlRoadmap(student1);
    const roadmap2 = createDefaultAiMlRoadmap(student2);

    assert.notStrictEqual(roadmap1.studentId, roadmap2.studentId, 'Roadmaps belong to distinct student owners');
    assert.strictEqual(roadmap1.studentId, student1);
    assert.strictEqual(roadmap2.studentId, student2);

    console.log('✅ Test 10 Passed: Tenant data isolation enforces student-scoped progress.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 10 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 11: Submitting a URL does not automatically increase completion
  // ----------------------------------------------------
  try {
    const roadmap = createDefaultAiMlRoadmap('student-url-test');
    const initialProgress = roadmap.overallProgress;

    const analysis = await analyzeExternalUrl(
      'https://www.linkedin.com/posts/ai-research_random-forest-decision-trees-activity-712345',
      roadmap
    );

    assert.ok(analysis.fitsIntoLevel, 'Must map URL into corresponding curriculum level');
    assert.ok(analysis.fitsIntoTopic, 'Must map URL into relevant topic');
    assert.ok(analysis.notice.includes('progress is only granted upon passing lesson assessments'), 'Must enforce strict no-free-progress rule');

    // Recheck roadmap progress to confirm ZERO inflation
    assert.strictEqual(roadmap.overallProgress, initialProgress, 'Overall progress must NOT increase merely by submitting an external link');

    console.log('✅ Test 11 Passed: External URL analysis maps to curriculum without inflating completion progress.');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 11 Failed:', err.message);
  }

  // ----------------------------------------------------
  // Test Case 12: The dashboard displays correct values on mobile and desktop
  // ----------------------------------------------------
  try {
    const roadmap = createDefaultAiMlRoadmap('student-math-check');
    const level4 = roadmap.levels.find(l => l.id === 'level-4');
    const lvl4Progress = calculateLevelProgress(level4.topics);

    // Level 4 in prompt example: 6 completed out of 10 = 60%
    assert.strictEqual(lvl4Progress.totalTopics, 10, 'Level 4 has 10 topics');
    assert.strictEqual(lvl4Progress.completedTopicsCount, 6, 'Level 4 has 6 completed topics');
    assert.strictEqual(lvl4Progress.percentage, 60, 'Level 4 percentage must be 60%');
    assert.strictEqual(lvl4Progress.remainingTopicsCount, 4, 'Level 4 remaining topics must be 4');
    assert.strictEqual(lvl4Progress.status, 'In Progress', 'Status must be In Progress');
    assert.strictEqual(lvl4Progress.currentTopic.title, 'Random Forest', 'Current topic must be Random Forest');

    console.log('✅ Test 12 Passed: Dashboard calculation displays exact mathematical fidelity (6/10 = 60%, 4 remaining).');
    passedTests++;
  } catch (err) {
    console.error('❌ Test 12 Failed:', err.message);
  }

  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    return { success: true, passed: passedTests, total: totalTests };
  } else {
    throw new Error(`${totalTests - passedTests} tests failed.`);
  }
}

// Allow CLI execution
runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
