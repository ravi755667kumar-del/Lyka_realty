import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  FileCode,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function TopicStudyModal() {
  const { activeModal, closeModal, updateTopic, searchResources } = useRoadmap();
  const [activeTab, setActiveTab] = useState('lesson'); // 'lesson' | 'exercise' | 'quiz' | 'resources'

  const { level, topic } = activeModal?.data || {};

  // Local state for user inputs
  const [exerciseText, setExerciseText] = useState('');
  const [lessonRead, setLessonRead] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serpResources, setSerpResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (topic) {
      setExerciseText(topic.exerciseSubmissionText || '');
      setLessonRead(Boolean(topic.lessonCompleted));
      setQuizScore(topic.assessmentScore);
      setQuizSubmitted(topic.assessmentScore !== null && topic.assessmentScore !== undefined);
      setQuizAnswers({});

      // Fetch live SerpApi resources for this topic
      setLoadingResources(true);
      searchResources(topic.title)
        .then((data) => {
          if (data?.resources) {
            setSerpResources(data.resources);
          }
        })
        .finally(() => setLoadingResources(false));
    }
  }, [topic]);

  if (!activeModal || activeModal.type !== 'study' || !topic) return null;

  const defaultQuiz = topic.quizQuestions || [
    {
      id: 'q1',
      question: `What is the core conceptual focus of ${topic.title}?`,
      options: [
        'Brute-force iterative trial and error',
        'Mathematical optimization and probabilistic generalization',
        'Manual heuristic rules without data fitting',
        'Static file compression'
      ],
      correctAnswerIndex: 1,
      explanation: 'Machine learning algorithms formulate objective loss functions and optimize them via numerical gradients.'
    },
    {
      id: 'q2',
      question: 'Which metric or methodology is most essential when validating model performance?',
      options: [
        'Training accuracy alone without a test partition',
        'Cross-validation with out-of-sample test splits and confusion matrix analysis',
        'Number of raw lines of code in the script',
        'GPU clock speed during inference'
      ],
      correctAnswerIndex: 1,
      explanation: 'Evaluating on out-of-sample data prevents misleading results due to memorization / overfitting.'
    },
    {
      id: 'q3',
      question: 'How do regularization techniques influence model complexity?',
      options: [
        'They double model parameter count',
        'They penalize large weights to enforce smoother decision boundaries',
        'They eliminate the need for training labels',
        'They guarantee 100% training accuracy'
      ],
      correctAnswerIndex: 1,
      explanation: 'L1/L2 regularization adds a constraint to the loss function, mitigating variance and preventing overfitting.'
    }
  ];

  // Save lesson completion
  const handleToggleLesson = async () => {
    const nextVal = !lessonRead;
    setLessonRead(nextVal);
    await updateTopic(level.id, topic.id, { lessonCompleted: nextVal });
  };

  // Submit practical exercise
  const handleSubmitExercise = async (e) => {
    e.preventDefault();
    if (!exerciseText.trim()) return;
    setSubmitting(true);
    try {
      await updateTopic(level.id, topic.id, {
        exerciseSubmissionText: exerciseText,
        exerciseSubmitted: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit quiz assessment
  const handleEvaluateQuiz = async () => {
    let correctCount = 0;
    defaultQuiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const calculatedScore = Math.round((correctCount / defaultQuiz.length) * 100);
    setQuizScore(calculatedScore);
    setQuizSubmitted(true);

    // Save assessment to persistent backend database
    await updateTopic(level.id, topic.id, {
      assessmentScore: calculatedScore,
    });
  };

  const passingScore = topic.requiredPassingScore ?? 70;
  const isPassing = (quizScore ?? 0) >= passingScore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0E1526] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-800 bg-[#111827]/80 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {level.title}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  topic.status === 'Completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {topic.status}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {topic.title}
            </h2>
          </div>

          <button
            onClick={closeModal}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-6 bg-gray-950/40 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('lesson')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'lesson'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Lesson Content</span>
            {lessonRead && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <button
            onClick={() => setActiveTab('exercise')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'exercise'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Practical Exercise</span>
            {topic.exerciseSubmitted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'quiz'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Quiz & Assessment</span>
            {quizScore !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isPassing ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {quizScore}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'resources'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>SerpApi Resources ({serpResources.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-300">
          {/* TAB 1: LESSON CONTENT */}
          {activeTab === 'lesson' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-2">Topic Overview</h3>
                <p className="text-gray-300 leading-relaxed bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                  {topic.shortExplanation}
                </p>
              </div>

              {/* Learning Objectives */}
              {topic.learningObjectives && topic.learningObjectives.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Learning Objectives</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {topic.learningObjectives.map((obj, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-900/30 border border-gray-800 text-xs text-gray-300"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                          {i + 1}
                        </span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites */}
              {topic.prerequisites && (
                <div className="p-3 rounded-lg bg-gray-900/40 border border-gray-800 text-xs flex items-center gap-2">
                  <span className="text-gray-500 font-semibold uppercase">Prerequisites:</span>
                  <span className="text-gray-300">{topic.prerequisites}</span>
                </div>
              )}

              {/* Lesson Completion Checkbox */}
              <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lessonRead}
                    onChange={handleToggleLesson}
                    className="w-4 h-4 text-indigo-600 rounded bg-gray-800 border-gray-700 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-200">
                    I have thoroughly read and understood this core lesson
                  </span>
                </label>

                <button
                  onClick={() => setActiveTab('exercise')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  <span>Next: Practical Exercise</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PRACTICAL EXERCISE */}
          {activeTab === 'exercise' && (
            <div className="space-y-4">
              <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-teal-400" />
                  <span>Exercise Prompt</span>
                </h3>
                <p className="text-xs text-gray-300">
                  {topic.exercisePrompt ||
                    'Write a Python implementation demonstrating this concept. Include sample input, model initialization, and output predictions.'}
                </p>
              </div>

              <form onSubmit={handleSubmitExercise} className="space-y-3">
                <label className="block text-xs font-medium text-gray-400">
                  Your Python Solution / Submission:
                </label>
                <textarea
                  value={exerciseText}
                  onChange={(e) => setExerciseText(e.target.value)}
                  placeholder="# Type your Python code or explanation here...&#10;from sklearn.ensemble import RandomForestClassifier&#10;clf = RandomForestClassifier(n_estimators=100)&#10;clf.fit(X_train, y_train)"
                  rows={8}
                  className="w-full font-mono text-xs p-3.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-gray-500">
                    {topic.exerciseSubmitted ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Exercise submitted
                      </span>
                    ) : (
                      'Submission is required to satisfy 100% topic mastery.'
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={submitting || !exerciseText.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      {submitting ? 'Saving...' : 'Submit Exercise Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('quiz')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                    >
                      <span>Go to Quiz</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: QUIZ & ASSESSMENT */}
          {activeTab === 'quiz' && (
            <div className="space-y-6">
              {/* Score header */}
              {quizSubmitted && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    isPassing
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isPassing ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-base">
                        {isPassing ? 'Assessment Passed!' : 'Assessment Incomplete'}
                      </div>
                      <div className="text-xs opacity-90">
                        {isPassing
                          ? `Score: ${quizScore}% (Satisfies ≥ ${passingScore}% requirement)`
                          : `Score: ${quizScore}%. Passing threshold is ${passingScore}%. Please review questions and retake.`}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers({});
                    }}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-200 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retake Quiz</span>
                  </button>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-5">
                {defaultQuiz.map((q, qIdx) => (
                  <div key={q.id} className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 space-y-3">
                    <div className="text-xs font-semibold text-gray-200 flex items-start gap-2">
                      <span className="w-5 h-5 rounded bg-gray-800 text-gray-400 flex items-center justify-center shrink-0">
                        {qIdx + 1}
                      </span>
                      <span>{q.question}</span>
                    </div>

                    <div className="space-y-2 pl-7">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = quizAnswers[qIdx] === optIdx;
                        const isCorrect = q.correctAnswerIndex === optIdx;
                        let optionStyle = 'border-gray-800 hover:border-gray-700 bg-gray-950/50 text-gray-300';

                        if (quizSubmitted) {
                          if (isCorrect) {
                            optionStyle = 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300';
                          } else if (isSelected && !isCorrect) {
                            optionStyle = 'border-rose-500/60 bg-rose-950/20 text-rose-300';
                          }
                        } else if (isSelected) {
                          optionStyle = 'border-indigo-500 bg-indigo-950/30 text-indigo-200 ring-1 ring-indigo-500/30';
                        }

                        return (
                          <label
                            key={optIdx}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${optionStyle}`}
                          >
                            <input
                              type="radio"
                              name={`question-${qIdx}`}
                              disabled={quizSubmitted}
                              checked={isSelected}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="pl-7 text-xs text-gray-400 bg-gray-950/40 p-2.5 rounded border border-gray-800/80">
                        <span className="font-semibold text-gray-300">Explanation:</span> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit Quiz Button */}
              {!quizSubmitted && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleEvaluateQuiz}
                    disabled={Object.keys(quizAnswers).length < defaultQuiz.length}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 disabled:opacity-40 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    Submit Assessment for Grading
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SERPAPI RESOURCES */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Curated and live web resources discovered for <strong>{topic.title}</strong>:
                </span>
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  SerpApi Integration
                </span>
              </div>

              {loadingResources ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading resources...</div>
              ) : (
                <div className="space-y-3">
                  {serpResources.map((res, i) => (
                    <a
                      key={i}
                      href={res.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-xl bg-gray-900/50 hover:bg-gray-800/60 border border-gray-800 hover:border-indigo-500/40 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-800 text-teal-400 border border-gray-700">
                              {res.type || 'Article'}
                            </span>
                            <span className="text-xs text-gray-500">{res.source}</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-200 group-hover:text-indigo-300 transition-colors">
                            {res.title}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">{res.snippet}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Strict Completion Summary */}
        <div className="p-4 px-6 border-t border-gray-800 bg-[#0B0F19] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-gray-400">
            <span className="font-semibold text-gray-300">Mastery Criteria:</span>
            <span className={lessonRead ? 'text-emerald-400 flex items-center gap-1' : 'text-gray-500'}>
              {lessonRead ? '✓' : '○'} Lesson
            </span>
            <span className={isPassing ? 'text-emerald-400 flex items-center gap-1' : 'text-gray-500'}>
              {isPassing ? '✓' : '○'} Quiz (&ge;70%)
            </span>
            <span className={topic.exerciseSubmitted ? 'text-emerald-400 flex items-center gap-1' : 'text-gray-500'}>
              {topic.exerciseSubmitted ? '✓' : '○'} Practical Exercise
            </span>
          </div>

          <button
            onClick={closeModal}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-all"
          >
            Close & Save
          </button>
        </div>
      </div>
    </div>
  );
}
