import React, { useState } from 'react';
import { X, GraduationCap, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function DiagnosticTestModal() {
  const { activeModal, closeModal, submitDiagnostic } = useRoadmap();
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!activeModal || activeModal.type !== 'diagnostic') return null;

  const { level, topic } = activeModal.data || {};
  if (!topic) return null;

  const diagnosticQuestions = [
    {
      id: 1,
      question: `What fundamental mathematical objective governs ${topic.title}?`,
      options: [
        'Minimizing empirical loss while penalizing parametric complexity',
        'Maximizing memory allocation during runtime',
        'Randomly permuting feature columns',
        'Executing constant-time lookup tables'
      ],
      correctIndex: 0,
    },
    {
      id: 2,
      question: 'Which condition indicates high variance (overfitting)?',
      options: [
        'High training error and high validation error',
        'Very low training error paired with high test error',
        'Symmetric residual errors around zero',
        'Zero correlation between features'
      ],
      correctIndex: 1,
    },
    {
      id: 3,
      question: 'How do you prevent data leakage during feature preprocessing?',
      options: [
        'Fit scalers on the entire dataset before splitting',
        'Fit scalers strictly on training data, then transform both train and test splits',
        'Duplicate the test dataset twice',
        'Remove target labels prior to ingestion'
      ],
      correctIndex: 1,
    },
    {
      id: 4,
      question: 'In production systems, what is the best strategy when encountering severe class imbalance?',
      options: [
        'Evaluate strictly with accuracy',
        'Apply SMOTE, class-weight rebalancing, and evaluate with PR-AUC / F1-score',
        'Drop all minority class instances',
        'Run training without validation splits'
      ],
      correctIndex: 1,
    }
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    let correct = 0;
    diagnosticQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correct++;
      }
    });

    const score = Math.round((correct / diagnosticQuestions.length) * 100);

    try {
      const res = await submitDiagnostic(level.id, topic.id, score);
      setResult({
        score,
        passed: score >= 80,
        message:
          score >= 80
            ? `Congratulations! You scored ${score}% (threshold ≥ 80%). Existing mastery recognized—topic marked as Completed.`
            : `Score: ${score}%. The diagnostic test requires at least 80% to bypass topic coursework. Please complete the regular lesson and assessment.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0E1526] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Diagnostic Exemption Assessment</h3>
              <p className="text-xs text-gray-400">Topic: {topic.title}</p>
            </div>
          </div>
          <button onClick={closeModal} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          {!result ? (
            <>
              <div className="bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-500/30 text-xs text-indigo-200">
                <strong>Knowledge Recognition Protocol:</strong> If you have prior industry or academic knowledge of this topic, answer these 4 questions. Scoring &ge; 80% marks the topic as Completed without unnecessary repetition.
              </div>

              <div className="space-y-4">
                {diagnosticQuestions.map((q, idx) => (
                  <div key={q.id} className="p-3.5 rounded-xl bg-gray-900/40 border border-gray-800 space-y-2">
                    <div className="font-semibold text-gray-200">
                      {idx + 1}. {q.question}
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedAnswers[idx] === optIdx
                              ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                              : 'border-gray-800 hover:border-gray-700 bg-gray-950/40 text-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`diag-${idx}`}
                            checked={selectedAnswers[idx] === optIdx}
                            onChange={() => setSelectedAnswers({ ...selectedAnswers, [idx]: optIdx })}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || Object.keys(selectedAnswers).length < diagnosticQuestions.length}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 disabled:opacity-40 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
                >
                  {submitting ? 'Evaluating...' : 'Submit Diagnostic Test'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div
                className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
                  result.passed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {result.passed ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>

              <div className="text-3xl font-extrabold text-white">{result.score}%</div>
              <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">{result.message}</p>

              <div className="pt-4">
                <button
                  onClick={closeModal}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
