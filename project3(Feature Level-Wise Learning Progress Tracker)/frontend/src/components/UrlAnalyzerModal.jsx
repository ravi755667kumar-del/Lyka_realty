import React, { useState } from 'react';
import { 
  X, 
  Link2, 
  Sparkles, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Image as ImageIcon,
  Copy,
  Check,
  Zap,
  FileText,
  Code,
  Cpu,
  HelpCircle
} from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';

export default function UrlAnalyzerModal() {
  const { activeModal, closeModal, analyzeExternalUrl, openStudyModal, roadmap } = useRoadmap();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'photo' | 'flashcards'

  if (!activeModal || activeModal.type !== 'url') return null;

  const sampleUrls = [
    {
      label: '🎬 YouTube Lecture: Build GPT (Karpathy)',
      url: 'https://www.youtube.com/watch?v=kCc8FmEb1nY'
    },
    {
      label: 'Paper: Transformers & Attention (LangChain)',
      url: 'https://arxiv.org/abs/1706.03762-attention-transformers'
    },
    {
      label: 'Guide: Random Forest Ensembles',
      url: 'https://www.linkedin.com/posts/ai-research_random-forest-decision-trees-activity-712345'
    },
    {
      label: 'Tutorial: NumPy Vectorization',
      url: 'https://numpy.org/doc/stable/user/quickstart.html'
    }
  ];

  const handleAnalyze = async (targetUrl = url) => {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeExternalUrl(targetUrl, { generatePhoto: true });
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to analyze URL');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyNotes = () => {
    if (!analysis?.notesMarkdown) return;
    navigator.clipboard.writeText(analysis.notesMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToMatchedTopic = () => {
    if (!analysis?.fitsIntoLevel || !analysis?.fitsIntoTopic) return;
    const lvl = roadmap.levels.find((l) => l.id === analysis.fitsIntoLevel.id);
    const top = lvl?.topics.find((t) => t.id === analysis.fitsIntoTopic.id);
    if (lvl && top) {
      closeModal();
      openStudyModal(lvl, top);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0E1526] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 via-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">LangChain Link Analyzer & Notes Generator</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono">
                  LangChain AI
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Extracts structured study notes, generates conceptual photos, and aligns with your curriculum
              </p>
            </div>
          </div>
          <button onClick={closeModal} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs sm:text-sm flex-1">
          {/* Quick presets */}
          <div>
            <span className="text-xs text-gray-400 block mb-2 font-medium">Try a sample educational link:</span>
            <div className="flex flex-wrap gap-2">
              {sampleUrls.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setUrl(s.url);
                    handleAnalyze(s.url);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 text-xs transition-colors cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste article, GitHub, ArXiv, or LinkedIn link: https://..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all font-mono"
              />
            </div>
            <button
              onClick={() => handleAnalyze()}
              disabled={loading || !url.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-cyan-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-900/20"
            >
              {loading ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Analyze with LangChain</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Analysis Results Container */}
          {analysis && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-300">
              {/* Top Banner: Generated Photo by LangChain */}
              {analysis.photo?.url && (
                <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-gray-950 shadow-xl group">
                  <img
                    src={analysis.photo.url}
                    alt={analysis.photo.caption || 'Concept Illustration'}
                    className="w-full max-h-60 object-cover object-center group-hover:scale-102 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-cyan-500/40 text-[11px] text-cyan-300 font-mono shadow-md">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>Photo Generated via {analysis.photo.provider || 'LangChain AI'}</span>
                  </div>
                  <div className="p-3 bg-[#0B0F19]/90 border-t border-gray-800 text-xs flex items-center justify-between">
                    <span className="text-gray-200 font-medium truncate pr-2">{analysis.photo.caption}</span>
                    <a
                      href={analysis.photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] underline flex-shrink-0 flex items-center gap-1"
                    >
                      <span>Full Image</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Curriculum Alignment Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-cyan-950/20 to-gray-900 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Curriculum Alignment Detected</span>
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold font-mono">
                    {analysis.relevanceScore}% Match
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-950/70 p-3 rounded-lg border border-gray-800">
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Mapped Level</span>
                    <strong className="text-white text-xs block truncate mt-0.5">{analysis.fitsIntoLevel?.title || 'Level 4: Machine Learning'}</strong>
                  </div>
                  <div className="bg-gray-950/70 p-3 rounded-lg border border-gray-800">
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Mapped Topic</span>
                    <strong className="text-teal-400 text-xs block truncate mt-0.5">{analysis.fitsIntoTopic?.title || 'Core Topic'}</strong>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-300">Executive Summary:</span>
                  <p className="text-xs text-gray-300 leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Takeaway */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-indigo-300">Core Takeaway:</span>
                  <p className="text-xs text-gray-400 leading-relaxed">{analysis.learningTakeaway}</p>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-gray-800 pt-1 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('notes')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'notes'
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Master Study Notes</span>
                  </button>
                  {analysis.quizFlashcards && analysis.quizFlashcards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('flashcards')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        activeTab === 'flashcards'
                          ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Quiz Flashcards ({analysis.quizFlashcards.length})</span>
                    </button>
                  )}
                </div>

                {analysis.notesMarkdown && (
                  <button
                    onClick={handleCopyNotes}
                    className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copy full Markdown study notes to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-gray-400" />
                        <span>Copy Notes</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Tab 1: Master Study Notes */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {/* Key Concepts with Real-World Analogies */}
                  {analysis.keyConcepts && analysis.keyConcepts.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5 uppercase tracking-wider">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Key Concepts & Analogies</span>
                      </h4>
                      <div className="grid gap-2.5">
                        {analysis.keyConcepts.map((kc, kIdx) => (
                          <div key={kIdx} className="p-3 rounded-xl bg-gray-950 border border-gray-800/80 space-y-1">
                            <span className="font-semibold text-white text-xs block">{kc.concept}</span>
                            <p className="text-xs text-gray-300">{kc.explanation}</p>
                            {kc.analogy && (
                              <p className="text-[11px] text-cyan-300/90 italic pt-0.5">
                                <span className="font-semibold not-italic">Analogy:</span> {kc.analogy}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Implementation Code Snippet */}
                  {analysis.codeSnippet && analysis.codeSnippet.code && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5 uppercase tracking-wider">
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Implementation Blueprint</span>
                      </h4>
                      <pre className="p-3.5 rounded-xl bg-black/90 border border-gray-800 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
                        <code>{analysis.codeSnippet.code}</code>
                      </pre>
                      {analysis.codeSnippet.explanation && (
                        <p className="text-[11px] text-gray-400">{analysis.codeSnippet.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Quiz Flashcards */}
              {activeTab === 'flashcards' && analysis.quizFlashcards && (
                <div className="space-y-3">
                  {analysis.quizFlashcards.map((q, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                      <span className="font-semibold text-white text-xs block">
                        Q{idx + 1}: {q.question}
                      </span>
                      <div className="space-y-1 pl-1">
                        {q.options?.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                              oIdx === q.correctIndex
                                ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
                                : 'bg-gray-900/50 text-gray-400'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-900">
                        <span className="text-cyan-400 font-medium">Explanation:</span> {q.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Anti-Inflation Policy Notice */}
              <div className="p-3 rounded-lg bg-gray-900/80 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Anti-Inflation Policy:</strong> {analysis.notice}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleCopyNotes}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Full Markdown Notes'}</span>
                </button>

                <button
                  onClick={handleGoToMatchedTopic}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer shadow-md shadow-indigo-900/30"
                >
                  <span>Open Mapped Topic</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
