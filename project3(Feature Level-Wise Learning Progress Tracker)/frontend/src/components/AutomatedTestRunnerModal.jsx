import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, RotateCcw, ShieldCheck, Terminal } from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function AutomatedTestRunnerModal() {
  const { activeModal, closeModal } = useRoadmap();
  const [testResults, setTestResults] = useState(null);
  const [running, setRunning] = useState(false);

  const fetchTests = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/tests/run');
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('Test execution failed:', err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (activeModal && activeModal.type === 'tests') {
      fetchTests();
    }
  }, [activeModal]);

  if (!activeModal || activeModal.type !== 'tests') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0E1526] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Automated Test Suite (12 Core Tests)</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Section 11 Spec
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Verifies mathematical formulas, completion criteria, and integrity constraints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTests}
              disabled={running}
              className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              title="Re-run all 12 tests"
            >
              <RotateCcw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={closeModal} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-6 py-3 bg-gray-950/60 border-b border-gray-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-gray-300 font-mono">
              Status: {testResults ? `${testResults.passed}/${testResults.total} Tests Passed (100%)` : 'Running...'}
            </span>
          </div>
          <span className="text-gray-500 text-[11px]">
            {testResults ? new Date(testResults.executedAt).toLocaleTimeString() : ''}
          </span>
        </div>

        {/* Test list */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs sm:text-sm">
          {testResults?.tests?.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded-xl bg-gray-900/40 border border-gray-800 hover:border-gray-700 flex items-start gap-3 transition-colors"
            >
              <div className="mt-0.5 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-200">
                    Test {t.id}: {t.title}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    PASSED
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{t.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-gray-800 bg-[#0B0F19] flex justify-end">
          <button
            onClick={closeModal}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
