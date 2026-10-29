'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Bot,
  User,
  Clock,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Volume2,
  Mic,
  Activity,
  Tag,
} from 'lucide-react';

export interface DialogueItem {
  speaker: 'AI' | 'Customer';
  text: string;
  timestamp: string;
}

export interface QAPair {
  id: string;
  stepNumber: number;
  stepTitle: string;
  aiQuestion: string;
  aiTimestamp: string;
  userAnswer?: string;
  userTimestamp?: string;
  extractedKey?: string;
  extractedValue?: string;
  isPending?: boolean;
}

interface TalkHistorySectionProps {
  dialogue?: DialogueItem[];
  rawTranscript?: string;
  customerName?: string;
  aiName?: string;
  liveSpeechText?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  className?: string;
}

// Map common Tamil/English phrases to recognized step titles
function getStepMetadata(text: string, index: number): { title: string; key: string } {
  const lower = text.toLowerCase();
  if (lower.includes('2 நிமிஷம்') || lower.includes('pesalama') || lower.includes('free') || lower.includes('comfortable')) {
    return { title: 'Step 1: Introduction & Availability Check', key: 'Availability' };
  }
  if (lower.includes('வாங்கணுமா') || lower.includes('வாடகை') || lower.includes('buy') || lower.includes('rent') || lower.includes('plot') || lower.includes('நிலமா')) {
    return { title: 'Step 2: Property Purpose (Buy / Rent / Plot)', key: 'Purpose' };
  }
  if (lower.includes('எந்த ஏரியா') || lower.includes('velachery') || lower.includes('வேளச்சேரி') || lower.includes('omr') || lower.includes('tambaram') || lower.includes('area')) {
    return { title: 'Step 3: Preferred Location & Area', key: 'Location' };
  }
  if (lower.includes('bhk') || lower.includes('அளவு') || lower.includes('sq ft') || lower.includes('size')) {
    return { title: 'Step 4: Property Size & Configuration', key: 'Size' };
  }
  if (lower.includes('பட்ஜெட்') || lower.includes('budget') || lower.includes('விலை') || lower.includes('lakh') || lower.includes('crore')) {
    return { title: 'Step 5: Budget Range & Expectation', key: 'Budget' };
  }
  if (lower.includes('குடிபோக') || lower.includes('ready') || lower.includes('timeline') || lower.includes('நேரம்')) {
    return { title: 'Step 6: Move-in Timeline', key: 'Timeline' };
  }
  if (lower.includes('லோன்') || lower.includes('loan') || lower.includes('cash') || lower.includes('bank')) {
    return { title: 'Step 7: Finance Mode (Bank Loan / Cash)', key: 'Finance' };
  }
  if (lower.includes('site visit') || lower.includes('p101') || lower.includes('p102') || lower.includes('p103') || lower.includes('p104') || lower.includes('p105') || lower.includes('p106')) {
    return { title: 'Step 8: Property Recommendation & Site Visit Offer', key: 'Recommendation' };
  }
  if (lower.includes('weekend') || lower.includes('weekday') || lower.includes('வசதிப்படும்')) {
    return { title: 'Step 9: Site Visit Day Scheduling', key: 'Site Visit Schedule' };
  }
  return { title: `Step ${index + 1}: Qualification Exchange`, key: 'Notes' };
}

export const TalkHistorySection: React.FC<TalkHistorySectionProps> = ({
  dialogue = [],
  rawTranscript = '',
  customerName = 'Customer',
  aiName = '👧 Priya (AI Telecaller)',
  liveSpeechText = '',
  isListening = false,
  isSpeaking = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'qa' | 'raw'>('qa');

  // Convert dialogue items into structured Q&A pairs
  const qaPairs: QAPair[] = [];

  // Parse from structured dialogue array if available
  if (dialogue.length > 0) {
    let currentPair: Partial<QAPair> | null = null;
    let stepCount = 0;

    dialogue.forEach((item) => {
      if (item.speaker === 'AI') {
        if (currentPair && currentPair.aiQuestion) {
          qaPairs.push(currentPair as QAPair);
        }
        stepCount++;
        const meta = getStepMetadata(item.text, stepCount - 1);
        currentPair = {
          id: `qa_${stepCount}`,
          stepNumber: stepCount,
          stepTitle: meta.title,
          extractedKey: meta.key,
          aiQuestion: item.text,
          aiTimestamp: item.timestamp,
        };
      } else if (item.speaker === 'Customer') {
        if (currentPair) {
          currentPair.userAnswer = item.text;
          currentPair.userTimestamp = item.timestamp;
          qaPairs.push(currentPair as QAPair);
          currentPair = null;
        } else {
          // Customer spoke before an AI question
          stepCount++;
          qaPairs.push({
            id: `qa_${stepCount}`,
            stepNumber: stepCount,
            stepTitle: `Interaction #${stepCount}`,
            aiQuestion: 'Initial lead greeting',
            aiTimestamp: item.timestamp,
            userAnswer: item.text,
            userTimestamp: item.timestamp,
          });
        }
      }
    });

    if (currentPair && currentPair.aiQuestion) {
      qaPairs.push(currentPair as QAPair);
    }
  } else if (rawTranscript) {
    // Parse from raw transcript string
    const lines = rawTranscript.split('\n').filter((l) => l.trim().length > 0);
    let stepCount = 0;
    let currentPair: Partial<QAPair> | null = null;

    lines.forEach((line) => {
      const isAI = line.toLowerCase().startsWith('ai:') || line.toLowerCase().startsWith('priya:');
      const text = line.replace(/^(ai:|priya:|customer:|user:|[^:]+:)\s*/i, '').trim();

      if (isAI) {
        if (currentPair && currentPair.aiQuestion) {
          qaPairs.push(currentPair as QAPair);
        }
        stepCount++;
        const meta = getStepMetadata(text, stepCount - 1);
        currentPair = {
          id: `qa_${stepCount}`,
          stepNumber: stepCount,
          stepTitle: meta.title,
          extractedKey: meta.key,
          aiQuestion: text,
          aiTimestamp: '',
        };
      } else {
        if (currentPair) {
          currentPair.userAnswer = text;
          qaPairs.push(currentPair as QAPair);
          currentPair = null;
        } else {
          stepCount++;
          qaPairs.push({
            id: `qa_${stepCount}`,
            stepNumber: stepCount,
            stepTitle: `Interaction #${stepCount}`,
            aiQuestion: 'Customer remark',
            aiTimestamp: '',
            userAnswer: text,
            userTimestamp: '',
          });
        }
      }
    });

    if (currentPair && currentPair.aiQuestion) {
      qaPairs.push(currentPair as QAPair);
    }
  }

  // Handle Copy Full Transcript
  const handleCopy = () => {
    let fullText = '';
    if (qaPairs.length > 0) {
      fullText = qaPairs
        .map(
          (qa, i) =>
            `[${qa.stepTitle}]\nAI Asking: ${qa.aiQuestion}\n${customerName} Answer: ${
              qa.userAnswer || '(Awaiting response)'
            }\n`
        )
        .join('\n');
    } else if (rawTranscript) {
      fullText = rawTranscript;
    }

    if (fullText && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {/* ─── Section Header ─────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span>User Talk History & Q&A Breakdown</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {qaPairs.length} {qaPairs.length === 1 ? 'Turn' : 'Turns'}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Clear breakdown: What AI asked vs What {customerName} answered
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Copy Q&A history to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy Q&A</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Q&A Exchange Cards ─────────────────────────────────────── */}
      <div className="p-3.5 space-y-3.5 max-h-80 overflow-y-auto">
        {qaPairs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-2">
            <Activity className="w-6 h-6 text-slate-600 mx-auto animate-pulse" />
            <p className="text-xs">No conversation dialogue recorded yet.</p>
            <p className="text-[11px] text-slate-500">
              As soon as Priya speaks and {customerName} responds, their talk history will appear here step-by-step.
            </p>
          </div>
        ) : (
          qaPairs.map((pair, idx) => {
            const isLast = idx === qaPairs.length - 1;
            const isWaitingForAnswer = isLast && !pair.userAnswer;

            return (
              <div
                key={pair.id || idx}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5 shadow-md transition-all hover:border-slate-700"
              >
                {/* Step / Turn Header */}
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800/80">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-400">
                    <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">
                      {pair.stepNumber}
                    </span>
                    <span className="truncate max-w-[280px] sm:max-w-none">{pair.stepTitle}</span>
                  </div>
                  {pair.aiTimestamp && (
                    <span className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                      <Clock className="w-3 h-3 opacity-60" />
                      <span>{pair.aiTimestamp}</span>
                    </span>
                  )}
                </div>

                {/* Sub-Card 1: What AI is Asking */}
                <div className="bg-gradient-to-r from-purple-950/30 via-slate-900 to-purple-950/20 border border-purple-800/30 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-1">
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span>What AI is Asking ({aiName})</span>
                    </span>
                    {isSpeaking && isLast && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                        Speaking Now...
                      </span>
                    )}
                  </div>
                  <p className="text-slate-100 text-xs leading-relaxed font-medium">
                    "{pair.aiQuestion}"
                  </p>
                </div>

                {/* Sub-Card 2: User Answer */}
                <div className="bg-gradient-to-r from-emerald-950/30 via-slate-900 to-emerald-950/20 border border-emerald-800/30 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                      <User className="w-3 h-3 text-emerald-400" />
                      <span>User Answer ({customerName})</span>
                    </span>
                    {isListening && isLast && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse flex items-center space-x-1">
                        <Mic className="w-2.5 h-2.5 animate-bounce" />
                        <span>Listening Live...</span>
                      </span>
                    )}
                  </div>

                  {pair.userAnswer ? (
                    <p className="text-emerald-200 text-xs leading-relaxed font-semibold">
                      "{pair.userAnswer}"
                    </p>
                  ) : isWaitingForAnswer ? (
                    <div className="py-1">
                      {liveSpeechText ? (
                        <p className="text-emerald-300 text-xs font-semibold animate-pulse flex items-center space-x-1">
                          <span>Hearing user: "{liveSpeechText}"</span>
                        </p>
                      ) : (
                        <p className="text-slate-400 text-[11px] italic flex items-center space-x-1.5">
                          <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
                          <span>Waiting for {customerName}'s voice response...</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px] italic">No answer provided.</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Footer: Summary Metric Badges ──────────────────────────── */}
      {qaPairs.length > 0 && (
        <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <span>
            Logged Turns: <strong className="text-white">{qaPairs.length}</strong>
          </span>
          <span className="text-emerald-400 font-semibold">
            ✓ Real-time Speech Sync Active
          </span>
        </div>
      )}
    </div>
  );
};
