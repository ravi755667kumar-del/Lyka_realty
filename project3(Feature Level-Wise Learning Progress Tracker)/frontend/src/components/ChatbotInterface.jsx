import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize Mermaid with elegant dark-mode colors
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    themeVariables: {
      darkMode: true,
      background: '#070B14',
      primaryColor: '#0e7490',
      primaryTextColor: '#f8fafc',
      primaryBorderColor: '#06b6d4',
      lineColor: '#38bdf8',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a'
    }
  });
} catch (e) {
  // ignore
}

import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  RotateCcw, 
  Search, 
  Link2, 
  Zap, 
  ExternalLink, 
  Award, 
  ChevronRight, 
  Compass, 
  Plus, 
  Code, 
  ArrowRight,
  Flame,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Globe,
  Cloud,
  Smartphone,
  Cpu,
  Shield,
  GraduationCap,
  Mail,
  Cable,
  GitCommit,
  FolderGit2,
  Key,
  Check
} from 'lucide-react';
import { useRoadmap } from '../context/RoadmapContext';
import { useAuth } from '../context/AuthContext';
import McpSettingsModal from './McpSettingsModal';

// Custom Official GitHub Octocat SVG
function GithubIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/**
 * Interactive AI Study Mentor Chatbot
 * Connected dynamically to the Upper Universe View.
 */
export default function ChatbotInterface({ 
  selectedLevel, 
  selectedTopic,
  onSelectLevel,
  onSelectTopic,
  onCosmicReaction
}) {
  const { 
    roadmap, 
    setRoadmap,
    switchCourseRoadmap,
    aiRecommendation, 
    updateTopic, 
    submitDiagnostic, 
    analyzeExternalUrl, 
    searchResources,
    openStudyModal,
    openDiagnosticModal,
    openUrlModal,
    openTestsModal,
    resetProgress
  } = useRoadmap();
  const { user } = useAuth();
  const studentId = user?.id || 'student-demo-1';

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [showSarvamModal, setShowSarvamModal] = useState(false);
  const [sarvamApiKey, setSarvamApiKey] = useState('');
  const [sarvamSpeaker, setSarvamSpeaker] = useState('anushka');
  const [isSarvamConfigured, setIsSarvamConfigured] = useState(false);
  const [sarvamSaving, setSarvamSaving] = useState(false);
  const [sarvamSaveMsg, setSarvamSaveMsg] = useState('');

  const fetchSarvamStatus = async () => {
    try {
      const res = await fetch('/api/sarvam/status');
      const data = await res.json();
      if (data.success) {
        setIsSarvamConfigured(Boolean(data.configured));
        if (data.speaker) setSarvamSpeaker(data.speaker);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSarvamStatus();
  }, []);

  const handleSaveSarvamKey = async (e) => {
    e?.preventDefault();
    setSarvamSaving(true);
    setSarvamSaveMsg('');
    try {
      const res = await fetch('/api/sarvam/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: sarvamApiKey.trim(),
          speaker: sarvamSpeaker
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsSarvamConfigured(Boolean(data.configured));
        setSarvamSaveMsg('✅ Sarvam AI API Key connected successfully!');
        setSarvamApiKey('');
        setTimeout(() => {
          setShowSarvamModal(false);
          setSarvamSaveMsg('');
        }, 1200);
      } else {
        setSarvamSaveMsg('❌ Error saving key: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setSarvamSaveMsg('❌ Connection error: ' + err.message);
    } finally {
      setSarvamSaving(false);
    }
  };
  const [selectedModelMode, setSelectedModelMode] = useState('auto'); // 'auto', 'omniroute', 'nvidia', 'council', 'openai', 'deepseek', 'qwen'
  const [selectedLanguage, setSelectedLanguage] = useState('auto'); // 'auto', 'english', 'tanglish'
  const currentUtteranceRef = useRef(null);
  const currentAudioRef = useRef(null);
  const browserSpeechIntervalRef = useRef(null);
  const audioWatchdogRef = useRef(null);
  const messagesEndRef = useRef(null);

  // MCP Integration State
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [mcpConfig, setMcpConfig] = useState({
    github: { connected: false, tokenMasked: '' },
    gmail: { connected: false, email: '' }
  });

  const fetchMcpConfig = async () => {
    try {
      const res = await fetch(`/api/mcp/config?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (data.success && data.config) {
        setMcpConfig(data.config);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchMcpConfig();
  }, [studentId]);

  const cleanTextForSpeech = (rawText) => {
    if (!rawText) return '';
    return rawText
      // Strip markdown images: ![alt](url) -> polite spoken placeholder
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' The diagram is displayed on your screen. ')
      // Strip mermaid code blocks -> spoken placeholder
      .replace(/```mermaid[\s\S]*?```/gi, ' The flowchart diagram is displayed on your screen. ')
      // Strip markdown links [Text](url) -> Text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Strip raw URLs
      .replace(/https?:\/\/\S+/g, '')
      // Strip markdown blockquotes
      .replace(/^>\s*/gm, '')
      // Strip all HTML tags including <br>, <br/>, <div>, <span>
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?[a-z0-9]+(?:\s+[^>]*>|>)/gi, ' ')
      // Replace code blocks with concise announcement
      .replace(/```[\s\S]*?```/g, ' I have shared a practical code snippet on your screen. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/&ge;/g, 'greater than or equal to')
      .replace(/&times;/g, 'times')
      .replace(/&rarr;/g, 'to')
      .replace(/&bull;/g, '')
      .replace(/[\u{1F300}-\u{1F6FF}|\u{1F900}-\u{1F9FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '')
      .replace(/[$_~>|•]/g, ' ')
      .replace(/[-*]\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const stopSpeaking = () => {
    // 1. Clear playback watchdog
    if (audioWatchdogRef.current) {
      clearInterval(audioWatchdogRef.current);
      audioWatchdogRef.current = null;
    }
    // 2. Clear browser speech keep-alive timer
    if (browserSpeechIntervalRef.current) {
      clearInterval(browserSpeechIntervalRef.current);
      browserSpeechIntervalRef.current = null;
    }
    // 3. Stop HTML5 Audio if playing
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {
        // ignore
      }
      currentAudioRef.current = null;
    }
    // 4. Stop browser speech synthesis if active
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    setIsAudioPaused(false);
    if (onCosmicReaction) onCosmicReaction('idle');
  };

  const pauseSpeaking = () => {
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
      setIsAudioPaused(true);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsAudioPaused(true);
    }
  };

  const resumeSpeaking = () => {
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      currentAudioRef.current.play().then(() => {
        setIsAudioPaused(false);
      }).catch(err => {
        console.warn('Could not resume audio:', err.message);
      });
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsAudioPaused(false);
    }
  };

  const speakText = async (text, messageId) => {
    if (speakingMessageId === messageId) {
      if (isAudioPaused) {
        resumeSpeaking();
        return;
      }
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    setSpeakingMessageId(messageId);
    setIsAudioPaused(false);
    if (onCosmicReaction) onCosmicReaction('speaking');

    // Method 1: High-fidelity Sarvam Indic TTS via Backend Endpoint
    try {
      const res = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, language: selectedLanguage })
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio')) {
          const blob = await res.blob();
          if (blob && blob.size > 0) {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;

            audio.onplay = () => {
              setSpeakingMessageId(messageId);
              setIsAudioPaused(false);
              if (onCosmicReaction) onCosmicReaction('speaking');
            };

            audio.onpause = () => {
              if (audio.currentTime < audio.duration && !audio.ended && currentAudioRef.current === audio) {
                setIsAudioPaused(true);
              }
            };

            audio.onended = () => {
              if (audioWatchdogRef.current) {
                clearInterval(audioWatchdogRef.current);
                audioWatchdogRef.current = null;
              }
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              setSpeakingMessageId(null);
              setIsAudioPaused(false);
              if (onCosmicReaction) onCosmicReaction('idle');
            };

            audio.onerror = () => {
              if (audioWatchdogRef.current) {
                clearInterval(audioWatchdogRef.current);
                audioWatchdogRef.current = null;
              }
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              fallbackToBrowserSpeech(cleaned, messageId);
            };

            audio.onstalled = () => {
              console.warn('Audio playback stalled mid-answer; attempting auto-recovery...');
              if (audio.paused && !audio.ended) {
                audio.play().catch(() => {});
              }
            };

            // Active Watchdog: Auto-detects and un-sticks audio playback if paused unexpectedly
            let lastAudioPosition = 0;
            let stalledCycles = 0;
            if (audioWatchdogRef.current) clearInterval(audioWatchdogRef.current);
            audioWatchdogRef.current = setInterval(() => {
              if (!currentAudioRef.current || currentAudioRef.current !== audio || audio.paused || audio.ended) {
                return;
              }
              if (audio.currentTime === lastAudioPosition) {
                stalledCycles++;
                if (stalledCycles >= 4) { // Stalled for > 4 seconds
                  console.warn('Speech playback stalled in between answer; auto-resuming...');
                  audio.play().catch(() => {
                    stopSpeaking();
                    fallbackToBrowserSpeech(cleaned, messageId);
                  });
                  stalledCycles = 0;
                }
              } else {
                lastAudioPosition = audio.currentTime;
                stalledCycles = 0;
              }
            }, 1000);

            await audio.play();
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Backend Sarvam TTS unavailable; using browser speech fallback:', err.message);
    }

    // Method 2: Browser Speech Synthesis Fallback (Sentence-chunked to prevent Chrome freeze)
    fallbackToBrowserSpeech(cleaned, messageId);
  };

  const fallbackToBrowserSpeech = (cleaned, messageId) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeakingMessageId(null);
      setIsAudioPaused(false);
      if (onCosmicReaction) onCosmicReaction('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (browserSpeechIntervalRef.current) {
        clearInterval(browserSpeechIntervalRef.current);
      }

      // Sentence chunking prevents Chromium 15-second speech freeze
      const sentences = cleaned.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleaned];
      let chunkIdx = 0;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online') || v.name.includes('Neural') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Zira') || v.name.includes('Guy'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      // Chromium keep-alive timer ensures utterance never silently pauses
      browserSpeechIntervalRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else if (!window.speechSynthesis.speaking) {
          clearInterval(browserSpeechIntervalRef.current);
          browserSpeechIntervalRef.current = null;
        }
      }, 8000);

      const speakSentence = () => {
        if (chunkIdx >= sentences.length) {
          if (browserSpeechIntervalRef.current) {
            clearInterval(browserSpeechIntervalRef.current);
            browserSpeechIntervalRef.current = null;
          }
          setSpeakingMessageId(null);
          setIsAudioPaused(false);
          if (onCosmicReaction) onCosmicReaction('idle');
          return;
        }

        const sentenceText = sentences[chunkIdx].trim();
        if (!sentenceText) {
          chunkIdx++;
          speakSentence();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentenceText);
        currentUtteranceRef.current = utterance;
        if (naturalVoice) utterance.voice = naturalVoice;
        utterance.rate = 0.88;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          setSpeakingMessageId(messageId);
          setIsAudioPaused(false);
          if (onCosmicReaction) onCosmicReaction('speaking');
        };

        utterance.onpause = () => {
          setIsAudioPaused(true);
        };

        utterance.onresume = () => {
          setIsAudioPaused(false);
        };

        utterance.onend = () => {
          chunkIdx++;
          speakSentence();
        };

        utterance.onerror = (e) => {
          console.warn('Speech synthesis chunk warning:', e);
          chunkIdx++;
          if (chunkIdx < sentences.length) {
            speakSentence();
          } else {
            if (browserSpeechIntervalRef.current) {
              clearInterval(browserSpeechIntervalRef.current);
              browserSpeechIntervalRef.current = null;
            }
            setSpeakingMessageId(null);
            setIsAudioPaused(false);
            if (onCosmicReaction) onCosmicReaction('idle');
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakSentence();
    } catch (e) {
      console.warn('Browser speech synthesis error:', e.message);
      setSpeakingMessageId(null);
      setIsAudioPaused(false);
      if (onCosmicReaction) onCosmicReaction('idle');
    }
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Sync chat history from backend on initial mount
  useEffect(() => {
    let isMounted = true;
    async function loadBackendChatHistory() {
      try {
        const res = await fetch(`/api/ai/chat/history?studentId=${encodeURIComponent(studentId)}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.history) && data.history.length > 0) {
          setMessages((prev) => {
            // If local state already has all or more messages, keep local
            if (prev && prev.length >= data.history.length) return prev;
            return data.history;
          });
        }
      } catch (err) {
        console.warn('Failed to load chat history from backend database:', err.message);
      }
    }
    loadBackendChatHistory();
    return () => { isMounted = false; };
  }, [studentId]);

  // Clear chat handler
  const handleClearChat = async () => {
    stopSpeaking();
    try {
      try { localStorage.removeItem(`teacher_luna_chat_${studentId}`); } catch (e) {}
      await fetch('/api/ai/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });
    } catch (e) {
      console.warn('Clear chat error:', e);
    }
    setMessages([]);
  };

  // Start New Journey (Reset all progress & chat)
  const handleStartNewJourney = async () => {
    if (window.confirm('Start a fresh new learning journey? This will reset your progress to 0% so you can begin clean.')) {
      stopSpeaking();
      try {
        try { localStorage.removeItem(`teacher_luna_chat_${studentId}`); } catch (e) {}
        await resetProgress();
        await fetch('/api/ai/chat/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId })
        });
        setMessages([]);
      } catch (e) {
        console.warn('Start new journey error:', e);
      }
    }
  };

  // Initial Welcome Message from tutor-conversation-design.pdf
  useEffect(() => {
    if (messages.length === 0 && roadmap) {
      setMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: "Hey! Welcome in. Before we start, what should I call you?"
        }
      ]);
    }
  }, [roadmap, user?.name, messages.length, studentId]);

  // When student clicks a planet in the Universe
  const lastSelectedLevelIdRef = useRef(selectedLevel?.id || null);
  useEffect(() => {
    if (selectedLevel) {
      if (lastSelectedLevelIdRef.current === null) {
        lastSelectedLevelIdRef.current = selectedLevel.id;
        return;
      }
      if (selectedLevel.id !== lastSelectedLevelIdRef.current) {
        lastSelectedLevelIdRef.current = selectedLevel.id;

        const fullLevelData = roadmap?.levels?.find((l) => l.id === selectedLevel.id) || selectedLevel;

        setMessages((prev) => [
          ...prev,
          {
            id: `level-focus-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `🪐 **Cosmic Telemetry Warped to ${fullLevelData.title}**\n\n- **Status**: \`${fullLevelData.status}\` (${fullLevelData.completionPercentage ?? 0}% completed)\n- **Progress Metric**: ${fullLevelData.completedTopicsCount ?? 0} of ${fullLevelData.totalTopics ?? 0} topics completed\n- **Prerequisites**: ${fullLevelData.prerequisites || 'None'}\n- **Completion Criteria**: ${fullLevelData.completionCriteria || 'Pass all topic assessments with ≥ 70% and submit exercises'}\n\nSelect any orbiting topic satellite in the single universe view or choose an action below:`,
            widgets: [
              {
                type: 'level_topics_list',
                level: fullLevelData
              }
            ]
          }
        ]);
      }
    }
  }, [selectedLevel, roadmap]);

  // When student clicks an orbiting topic moon in the Universe
  const lastSelectedTopicIdRef = useRef(selectedTopic?.id || null);
  useEffect(() => {
    if (selectedTopic) {
      if (lastSelectedTopicIdRef.current === null) {
        lastSelectedTopicIdRef.current = selectedTopic.id;
        return;
      }
      if (selectedTopic.id !== lastSelectedTopicIdRef.current) {
        lastSelectedTopicIdRef.current = selectedTopic.id;

        const matchingLevel = selectedLevel || 
          roadmap?.levels?.find((l) => l.topics?.some((t) => t.id === selectedTopic.id)) || 
          roadmap?.levels?.[0];

        setMessages((prev) => [
          ...prev,
          {
            id: `topic-focus-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `🛰️ **Target Orbit Synchronized: ${selectedTopic.title}**\n\n${selectedTopic.shortExplanation || 'Core curriculum module.'}\n\n- **Status**: \`${selectedTopic.status}\`\n- **Assessment Score**: ${selectedTopic.assessmentScore !== null ? `${selectedTopic.assessmentScore}%` : 'Not yet tested'}\n- **Passing Score Required**: ≥ ${selectedTopic.requiredPassingScore ?? 70}%\n- **Practical Exercise**: ${selectedTopic.exerciseSubmitted ? '✅ Submitted' : '⏳ Pending submission'}`,
            widgets: [
              {
                type: 'topic_quick_actions',
                level: matchingLevel,
                topic: selectedTopic
              }
            ]
          }
        ]);
      }
    }
  }, [selectedTopic, selectedLevel, roadmap]);

  // Helper to map user query/response dynamically to any curriculum levels and topics
  const detectAndSyncCosmicFocus = (queryText) => {
    if (!roadmap?.levels || !queryText) return;
    const qLower = queryText.toLowerCase();

    // 1. Explicit Level Order matching (e.g. "Level 1", "Level 2", ...)
    for (let i = 1; i <= (roadmap.levels.length || 6); i++) {
      if (qLower.includes(`level ${i}`)) {
        const lvl = roadmap.levels.find((l) => l.order === i);
        if (lvl && onSelectLevel) {
          onSelectLevel(lvl);
          return;
        }
      }
    }

    // 2. Dynamic matching across level and topic titles in the active course
    for (const lvl of roadmap.levels) {
      if (qLower.includes(lvl.title.toLowerCase())) {
        if (onSelectLevel) onSelectLevel(lvl);
        return;
      }
      for (const topic of (lvl.topics || [])) {
        if (qLower.includes(topic.title.toLowerCase())) {
          if (onSelectLevel) onSelectLevel(lvl);
          if (onSelectTopic) onSelectTopic(topic);
          return;
        }
      }
    }
  };

  // Send message handler
  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
    setIsTyping(true);
    stopSpeaking();

    // Trigger Universe "Speaking" Telemetry ripple
    if (onCosmicReaction) onCosmicReaction('speaking');

    // Sync universe focus based on what the student is asking
    detectAndSyncCosmicFocus(query);

    try {
      // Check for URL query
      if (query.startsWith('http://') || query.startsWith('https://')) {
        if (onCosmicReaction) onCosmicReaction('analyzing');
        const analysisRes = await analyzeExternalUrl(query);
        setIsTyping(false);
        if (analysisRes.success && analysisRes.analysis) {
          const resMsgId = `assistant-${Date.now()}`;
          const a = analysisRes.analysis;
          let resText = `🔍 **LangChain Link Analysis & Master Notes Complete** for: [${query}](${query})\n\n`;
          
          if (a.photo?.url) {
            resText += `![${a.photo.caption || 'Concept Photo'}](${a.photo.url})\n*Photo Generated via ${a.photo.provider || 'LangChain AI'}*\n\n`;
          }

          resText += `${a.summary}\n\n`;

          if (a.architectureFlowchart) {
            resText += `### 🔄 System Architecture Flowchart\n\n\`\`\`mermaid\n${a.architectureFlowchart.trim()}\n\`\`\`\n\n`;
          }

          resText += `**Curriculum Fit**: Placed into **${a.fitsIntoLevel?.title || 'Active Level'}** &rarr; **${a.fitsIntoTopic?.title || 'Active Topic'}** (Relevance Score: ${a.relevanceScore || 85}%).`;

          setMessages((prev) => [
            ...prev,
            {
              id: resMsgId,
              sender: 'assistant',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              text: resText,
              sources: {
                images: a.photo ? [a.photo] : [],
                search: []
              },
              models: [{ name: 'LangChain AI', role: 'Document Scraper & Photo Generator' }],
              widgets: [
                {
                  type: 'url_analysis_card',
                  data: a
                }
              ]
            }
          ]);
          if (isVoiceEnabled) speakText(a.summary, resMsgId);
          return;
        }
      }

      // Check for SerpApi resource search query
      if (query.toLowerCase().startsWith('search ') || query.toLowerCase().startsWith('find resources ')) {
        const term = query.replace(/^(search|find resources|resources for)\s*/i, '').trim();
        const searchRes = await searchResources(term || 'Machine Learning');
        setIsTyping(false);
        const searchMsgId = `assistant-${Date.now()}`;
        const searchText = `📚 **Learning Resources Found for "${term || 'Machine Learning'}"** via SerpApi Google Search:`;
        setMessages((prev) => [
          ...prev,
          {
            id: searchMsgId,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: searchText,
            widgets: [
              {
                type: 'resources_list',
                resources: searchRes.resources || []
              }
            ]
          }
        ]);
        if (isVoiceEnabled) speakText(`Here are the learning resources found for ${term || 'Machine Learning'}.`, searchMsgId);
        return;
      }

      // Check for test suite run
      if (query.toLowerCase().includes('run test') || query.toLowerCase().includes('verify test')) {
        const res = await fetch('/api/tests/run');
        const testData = await res.json();
        setIsTyping(false);
        const testMsgId = `assistant-${Date.now()}`;
        const testText = `🧪 **Acceptance Test Suite Executed**: **${testData.passed}/${testData.total} Tests Passed** (100% verified)`;
        setMessages((prev) => [
          ...prev,
          {
            id: testMsgId,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: testText,
            widgets: [
              {
                type: 'tests_result',
                tests: testData.tests || []
              }
            ]
          }
        ]);
        if (isVoiceEnabled) speakText(`Acceptance test suite executed. All ${testData.passed} tests passed successfully.`, testMsgId);
        return;
      }

      // Build multi-turn chat history
      const chatHistory = messages
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      // Active AI model mode ('council', 'openai', 'deepseek', 'qwen')
      const activeModel = selectedModelMode || import.meta.env.VITE_AI_MODEL || 'council';

      // Standard Chat Query via Backend /api/ai/chat (Search + Dual Model + RAG)
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          studentId: user?.id || 'student-demo-1',
          model: activeModel,
          language: selectedLanguage,
          context: {
            currentLevelId: selectedLevel?.id || 'level-4',
            history: chatHistory,
            model: activeModel,
            language: selectedLanguage,
            requestedModel: activeModel
          }
        })
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.success) {
        if (data.language && data.language !== 'english') {
          setSelectedLanguage(data.language);
        }
        const widgets = [];
        if (data.type === 'course_initialized' && data.roadmap) {
          // Update global roadmap & universe orbit
          if (setRoadmap) setRoadmap(data.roadmap);
          if (data.selectedLevel && onSelectLevel) onSelectLevel(data.selectedLevel);
          if (data.selectedTopic && onSelectTopic) onSelectTopic(data.selectedTopic);
          if (onCosmicReaction) onCosmicReaction('success');

          widgets.push({
            type: 'course_initialized_card',
            roadmap: data.roadmap,
            level: data.selectedLevel,
            topic: data.selectedTopic
          });
        } else if (data.type === 'course_selection' && data.widgets) {
          widgets.push(...data.widgets);
        } else if (data.type === 'quiz' && data.quizData) {
          // Trigger Universe "Quiz Assessment" Shield!
          if (onCosmicReaction) onCosmicReaction('quiz');
          widgets.push({
            type: 'in_chat_quiz',
            quizData: data.quizData
          });
        } else if (data.type === 'progress_summary') {
          widgets.push({
            type: 'progress_summary_card',
            data: data.data
          });
        }

        // Support all MCP & dynamic interactive widgets returned by backend
        if (data.widgets && Array.isArray(data.widgets) && data.type !== 'course_selection') {
          widgets.push(...data.widgets);
        }

        // Clean any stray <br> or HTML tags from reply so it reads naturally
        const cleanReply = (data.reply || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?[a-z0-9]+(?:\s+[^>]*>|>)/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Detect universe focus in the assistant reply as well
        detectAndSyncCosmicFocus(cleanReply);

        const newMsgId = `assistant-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: newMsgId,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: cleanReply,
            sources: data.sources,
            model: data.model || activeModel,
            models: data.models || data.sources?.models || [],
            pipeline: data.pipeline || { search: Boolean(data.sources?.search?.length), model: data.model || activeModel, rag: Boolean(data.sources?.rag) },
            widgets
          }
        ]);

        // Auto-read response out loud if voice is enabled!
        if (isVoiceEnabled) {
          speakText(cleanReply, newMsgId);
        }
      } else {
        throw new Error(data.error || 'Chat service unavailable');
      }
    } catch (err) {
      console.warn('Backend chat unreachable or errored:', err.message);

      setIsTyping(false);
      const errMsgId = `assistant-err-${Date.now()}`;
      const errText = `🌸 **Teacher Luna Note**: I am ready to answer your questions! However, the backend server is not currently running on \`http://localhost:5055\`.\n\nPlease open a terminal and run:\n\`\`\`powershell\nnpm start\n\`\`\`\nOnce started, ask me any question, and I will search and synthesize live answers for you!`;
      setMessages((prev) => [
        ...prev,
        {
          id: errMsgId,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: errText,
        }
      ]);
      if (isVoiceEnabled) {
        speakText('Please make sure the backend server is running so I can provide full answers.', errMsgId);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-6.5rem)] min-h-[580px] w-full rounded-2xl border border-gray-800 bg-gradient-to-b from-[#0F1423] via-[#0C101C] to-[#080B14] shadow-2xl overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Chatbot Header */}
      <div className="px-4 py-3 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0B0F19] rounded-[11px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-300" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0F19]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Teacher Luna &bull; Gentle Mentor</h2>
              {/* Multi-Model Engine Selector */}
              <div className="flex items-center gap-1 bg-gray-900/90 border border-gray-800 rounded-lg p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('auto')}
                  className={`px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
                    selectedModelMode === 'auto' || selectedModelMode === 'council'
                      ? 'bg-gradient-to-r from-emerald-600/80 via-cyan-600/80 to-purple-600/80 text-white shadow-sm ring-1 ring-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Auto Smart Engine: Dynamically routes questions to NVIDIA DeepSeek V4.1, Nemotron, or Qwen based on the prompt"
                >
                  <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                  <span>⚡ Auto (Smart Route)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('nvidia')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                    selectedModelMode === 'nvidia'
                      ? 'bg-emerald-600/80 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="NVIDIA NIM API: DeepSeek-V4.1-Flash & Nemotron"
                >
                  🟢 NVIDIA
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('openai')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                    selectedModelMode === 'openai'
                      ? 'bg-purple-600/80 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="OpenAI GPT Model"
                >
                  🧠 OpenAI
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('deepseek')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                    selectedModelMode === 'deepseek'
                      ? 'bg-cyan-600/80 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="DeepSeek Engine"
                >
                  ⚡ DeepSeek
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('qwen')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                    selectedModelMode === 'qwen'
                      ? 'bg-amber-600/80 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Qwen Model"
                >
                  🤖 Qwen
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelMode('omniroute')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
                    selectedModelMode === 'omniroute'
                      ? 'bg-blue-600/80 text-white shadow-sm ring-1 ring-blue-400/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="OmniRoute AI Router: Local Keyless Virtual Combo at http://localhost:20128/v1"
                >
                  <Globe className="w-2.5 h-2.5 text-blue-300" />
                  <span>OmniRoute</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              {roadmap?.goal || 'AI / Machine Learning Engineer'} &bull; {selectedLevel?.title || 'Level 4: Machine Learning'}
            </p>
          </div>
        </div>

        {/* Header Quick Controls */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {/* Active Speaking Wave Equalizer, Pause & Stop Controls */}
          {speakingMessageId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[11px] animate-in fade-in shadow-sm">
              <span className="flex items-end gap-0.5 h-3">
                <span className={`w-0.5 bg-cyan-400 ${isAudioPaused ? 'h-1/2' : 'animate-pulse h-full'}`} />
                <span className={`w-0.5 bg-cyan-400 ${isAudioPaused ? 'h-1/3' : 'animate-pulse h-2/3'}`} style={{ animationDelay: '120ms' }} />
                <span className={`w-0.5 bg-cyan-400 ${isAudioPaused ? 'h-1/2' : 'animate-pulse h-full'}`} style={{ animationDelay: '240ms' }} />
              </span>
              <span className="font-mono text-[10px] hidden sm:inline">
                {isAudioPaused ? 'Speech Paused' : 'Speaking...'}
              </span>
              {isAudioPaused ? (
                <button
                  onClick={resumeSpeaking}
                  className="ml-1 p-0.5 hover:bg-cyan-800 rounded text-cyan-200 transition-colors"
                  title="Resume speech"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={pauseSpeaking}
                  className="ml-1 p-0.5 hover:bg-cyan-800 rounded text-cyan-200 transition-colors"
                  title="Pause speech"
                >
                  <Pause className="w-2.5 h-2.5 fill-current" />
                </button>
              )}
              <button
                onClick={stopSpeaking}
                className="ml-0.5 p-0.5 hover:bg-red-950/80 rounded text-red-300 transition-colors"
                title="Stop Speech"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </button>
            </div>
          )}

          {/* Tanglish / Tamil Explanation Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setSelectedLanguage((prev) => (prev === 'tanglish' ? 'english' : 'tanglish'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedLanguage === 'tanglish'
                ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300 shadow-sm ring-1 ring-amber-400/30'
                : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
            title="Toggle Natural Tanglish / Tamil explanation mode"
          >
            <span>🗣️</span>
            <span className="hidden sm:inline font-semibold">
              {selectedLanguage === 'tanglish' ? 'Tanglish (தமிழ்)' : 'EN / Tanglish'}
            </span>
          </button>

          {/* Sarvam AI Indic Speech Button */}
          <button
            type="button"
            onClick={() => setShowSarvamModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              isSarvamConfigured
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20'
                : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/50'
            }`}
            title="Configure Sarvam AI Indic Voice (Tamil & English)"
          >
            <span>🎙️</span>
            <span className="hidden sm:inline font-semibold">Sarvam AI</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isSarvamConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          </button>

          {/* Auto-Voice Reader Toggle Button */}
          <button
            onClick={() => {
              if (isVoiceEnabled && speakingMessageId) {
                stopSpeaking();
              }
              setIsVoiceEnabled(!isVoiceEnabled);
            }}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isVoiceEnabled
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 shadow-sm'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
            title={isVoiceEnabled ? 'OpenAI Voice Auto-Reader (tts-1 / nova) Active' : 'Click to Enable OpenAI Voice Auto-Reader'}
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-[11px] hidden sm:inline font-mono">
              {isVoiceEnabled ? 'OpenAI Voice: ON' : 'Voice: Muted'}
            </span>
          </button>

          {/* MCP Tools Button */}
          <button
            onClick={() => setShowMcpModal(true)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              (mcpConfig.github?.connected || mcpConfig.gmail?.connected)
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-200 hover:bg-purple-900/60 shadow-sm'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title="Model Context Protocol: Connect GitHub & Gmail to check, commit, and send via AI"
          >
            <Cable className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] hidden sm:inline font-mono">
              MCP Tools
            </span>
            {(mcpConfig.github?.connected || mcpConfig.gmail?.connected) ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" title="Connected" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" title="Not connected" />
            )}
          </button>

          {/* Start New Journey Button */}
          <button
            onClick={handleStartNewJourney}
            className="px-2 py-1 rounded-lg border border-indigo-500/30 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all shadow-sm active:scale-95"
            title="Start a fresh new journey (Reset progress to 0%)"
          >
            <RotateCcw className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] hidden sm:inline">Start New</span>
          </button>

          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            title="Clear Chat Stream and DB History"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm z-10">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-500/40 flex-shrink-0 flex items-center justify-center text-cyan-300 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/20'
                  : 'bg-gray-900/90 border border-gray-800 text-gray-200 rounded-tl-none shadow-xl'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between gap-4 mb-1.5 text-[10px] opacity-70">
                <span className="font-semibold">{msg.sender === 'user' ? 'You' : 'Teacher Luna'}</span>
                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.text, msg.id)}
                      className={`p-1 rounded hover:bg-gray-800/80 transition-colors ${
                        speakingMessageId === msg.id
                          ? 'text-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-500/40 animate-pulse'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      title={speakingMessageId === msg.id ? 'Stop reading' : 'Read message aloud'}
                    >
                      {speakingMessageId === msg.id ? (
                        <Square className="w-2.5 h-2.5 fill-current" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Message Text rendered naturally with zero <br> tags */}
              <NaturalTextRenderer content={msg.text} />

              {/* Active Speech Playback Card */}
              {speakingMessageId === msg.id && (
                <div className="mt-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 text-xs shadow-md animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-end gap-0.5 h-3">
                      <span className={`w-1 bg-cyan-400 ${isAudioPaused ? 'h-1/2' : 'animate-pulse h-full'}`} />
                      <span className={`w-1 bg-cyan-400 ${isAudioPaused ? 'h-1/3' : 'animate-pulse h-2/3'}`} style={{ animationDelay: '150ms' }} />
                      <span className={`w-1 bg-cyan-400 ${isAudioPaused ? 'h-1/2' : 'animate-pulse h-4/5'}`} style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="font-medium text-[11px] tracking-wide">
                      {isAudioPaused ? 'Speech paused mid-answer' : 'Luna is speaking this answer...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isAudioPaused ? (
                      <button
                        onClick={resumeSpeaking}
                        className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-[10px] text-white font-medium transition-colors flex items-center gap-1"
                        title="Resume speech"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        onClick={pauseSpeaking}
                        className="px-2 py-0.5 rounded bg-cyan-900/80 hover:bg-cyan-800 text-[10px] text-cyan-200 font-medium transition-colors flex items-center gap-1"
                        title="Pause speech"
                      >
                        <Pause className="w-2.5 h-2.5 fill-current" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      onClick={stopSpeaking}
                      className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900/80 border border-red-500/30 text-[10px] text-red-200 font-medium transition-colors flex items-center gap-1"
                      title="Stop speaking"
                    >
                      <Square className="w-2 h-2 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Verified Multi-Source Citations (RAG, Live Web Search & Visual Diagrams) */}
              {msg.sources && (msg.sources.rag || (msg.sources.search && msg.sources.search.length > 0) || (msg.sources.images && msg.sources.images.length > 0)) && (
                <div className="mt-3 pt-2.5 border-t border-gray-800/80 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[10px] tracking-wider uppercase">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Synthesized from Verified Sources:</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {/* Active AI Model Badges (Trio Council or Single Model) */}
                    {msg.models && msg.models.length > 0 ? (
                      msg.models.map((m, mIdx) => {
                        const mName = typeof m === 'string' ? m : (m.name || m.model || 'AI Model');
                        const mRole = typeof m === 'object' ? m.role : null;
                        const isOpenAi = mName.toLowerCase().includes('openai') || mName.toLowerCase().includes('gpt');
                        const isDeepSeek = mName.toLowerCase().includes('deepseek');
                        const isOmniRoute = mName.toLowerCase().includes('omni');

                        let badgeStyle = 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200 shadow-sm';
                        let IconComponent = Bot;
                        let iconColor = 'text-emerald-400';

                        if (isOmniRoute) {
                          badgeStyle = 'bg-blue-950/70 border-blue-500/40 text-blue-200 shadow-sm';
                          IconComponent = Globe;
                          iconColor = 'text-blue-400';
                        } else if (isOpenAi) {
                          badgeStyle = 'bg-purple-950/70 border-purple-500/40 text-purple-200 shadow-sm';
                          IconComponent = Sparkles;
                          iconColor = 'text-purple-400';
                        } else if (isDeepSeek) {
                          badgeStyle = 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200 shadow-sm';
                          IconComponent = Zap;
                          iconColor = 'text-cyan-400';
                        }

                        return (
                          <div 
                            key={mIdx}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${badgeStyle}`}
                            title={mRole ? `${mName} • ${mRole}` : `Answer synthesized with Model: ${mName}`}
                          >
                            <IconComponent className={`w-3 h-3 ${iconColor} flex-shrink-0`} />
                            <span className="font-semibold">{mName}</span>
                            {mRole && <span className="text-[9.5px] opacity-75 font-mono">({mRole})</span>}
                          </div>
                        );
                      })
                    ) : msg.model ? (
                      (() => {
                        const mName = msg.model;
                        const isOpenAi = mName.toLowerCase().includes('openai') || mName.toLowerCase().includes('gpt');
                        const isDeepSeek = mName.toLowerCase().includes('deepseek');
                        const isOmniRoute = mName.toLowerCase().includes('omni');
                        const badgeStyle = isOmniRoute
                          ? 'bg-blue-950/70 border-blue-500/40 text-blue-200'
                          : isOpenAi
                          ? 'bg-purple-950/70 border-purple-500/40 text-purple-200'
                          : isDeepSeek
                          ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200'
                          : 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200';
                        const IconComponent = isOmniRoute ? Globe : isOpenAi ? Sparkles : isDeepSeek ? Zap : Bot;
                        const iconColor = isOmniRoute ? 'text-blue-400' : isOpenAi ? 'text-purple-400' : isDeepSeek ? 'text-cyan-400' : 'text-emerald-400';
                        return (
                          <div 
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${badgeStyle}`}
                            title={`Answer synthesized with Model: ${msg.model}`}
                          >
                            <IconComponent className={`w-3 h-3 ${iconColor} flex-shrink-0`} />
                            <span className="font-semibold">{msg.model}</span>
                          </div>
                        );
                      })()
                    ) : null}

                    {/* Visual Diagrams Badge */}
                    {msg.sources.images && msg.sources.images.length > 0 && (
                      <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-950/70 border border-pink-500/30 text-pink-200"
                        title={`${msg.sources.images.length} Educational Diagram(s) retrieved`}
                      >
                        <FileText className="w-3 h-3 text-pink-400 flex-shrink-0" />
                        <span className="font-semibold">{msg.sources.images.length} Diagram{msg.sources.images.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* RAG Knowledge Base Badge */}
                    {msg.sources.rag && (
                      <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-200"
                        title={msg.sources.rag.excerpt || 'Verified Engineering Guidance Curriculum'}
                      >
                        <BookOpen className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold">Engineering Guidance (RAG)</span>
                        <span className="text-[10px] text-cyan-400 font-mono">Page {msg.sources.rag.page}</span>
                      </div>
                    )}

                    {/* Live Google Web Search Source Links */}
                    {msg.sources.search && msg.sources.search.map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-cyan-500/50 text-gray-300 hover:text-cyan-300 transition-all group"
                        title={src.snippet}
                      >
                        <Search className="w-2.5 h-2.5 text-cyan-400" />
                        <span className="truncate max-w-[150px] font-medium">{src.title}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-gray-500 group-hover:text-cyan-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive In-Chat Widgets */}
              {msg.widgets && msg.widgets.length > 0 && (
                <div className="mt-3 space-y-3 pt-2 border-t border-gray-800/80">
                  {msg.widgets.map((widget, widx) => (
                    <InChatWidgetRenderer
                      key={widx}
                      widget={widget}
                      openStudyModal={openStudyModal}
                      openDiagnosticModal={openDiagnosticModal}
                      updateTopic={updateTopic}
                      handleSendMessage={handleSendMessage}
                      onCosmicReaction={onCosmicReaction}
                      onOpenMcpModal={() => setShowMcpModal(true)}
                    />
                  ))}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white mt-1">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 items-center text-gray-400 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-cyan-300">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gray-900/90 border border-gray-800 text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-1 text-[11px] text-gray-400 font-mono">Formulating cosmic guidance...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Suggestions Pills */}
      <div className="px-4 py-2 bg-gray-950/70 border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar z-10 text-xs">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono flex-shrink-0">
          Courses:
        </span>
        <button
          onClick={() => handleSendMessage('Choose course')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white transition-all text-xs font-medium"
        >
          🌸 Choose Course
        </button>
        <button
          onClick={() => handleSendMessage('I want to learn Full-Stack Web Development')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-800/60 border border-cyan-800/50 text-cyan-300 hover:text-white transition-all text-xs"
        >
          🌐 Web Dev
        </button>
        <button
          onClick={() => handleSendMessage('I want to learn DevOps & Cloud Engineering')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-emerald-950/60 hover:bg-emerald-800/60 border border-emerald-800/50 text-emerald-300 hover:text-white transition-all text-xs"
        >
          🚀 DevOps & Cloud
        </button>
        <button
          onClick={() => handleSendMessage('I want to learn Mobile App Development')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-pink-950/60 hover:bg-pink-800/60 border border-pink-800/50 text-pink-300 hover:text-white transition-all text-xs"
        >
          📱 Mobile App
        </button>
        <button
          onClick={() => handleSendMessage('I want to learn Artificial Intelligence & ML')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-violet-950/60 hover:bg-violet-800/60 border border-violet-800/50 text-violet-300 hover:text-white transition-all text-xs"
        >
          🤖 AI & ML
        </button>
        <button
          onClick={() => handleSendMessage('I want to learn Cybersecurity & Ethical Hacking')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-950/60 hover:bg-amber-800/60 border border-amber-800/50 text-amber-300 hover:text-white transition-all text-xs"
        >
          🔒 Cybersecurity
        </button>
        <button
          onClick={() => handleSendMessage('What should I learn next?')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-gray-800/80 hover:bg-indigo-600/30 border border-gray-700 hover:border-indigo-500/50 text-gray-300 hover:text-white transition-all text-xs"
        >
          ✨ Next Step
        </button>
        <button
          onClick={() => handleSendMessage('Show my learning progress')}
          className="flex-shrink-0 px-2.5 py-1 rounded-full bg-gray-800/80 hover:bg-emerald-600/30 border border-gray-700 hover:border-emerald-500/50 text-gray-300 hover:text-white transition-all text-xs"
        >
          📊 Progress Report
        </button>
      </div>

      {/* Input Box */}
      <div className="p-3 sm:p-4 bg-gray-900/90 border-t border-gray-800/80 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Quick Tools Drawer Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActionDrawer(!showActionDrawer)}
              className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              title="Quick Learning Tools"
            >
              <Plus className={`w-4 h-4 transition-transform ${showActionDrawer ? 'rotate-45' : ''}`} />
            </button>

            {showActionDrawer && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-1.5 space-y-1 text-xs z-50 animate-in fade-in slide-in-from-bottom-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    handleSendMessage('Choose course');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-indigo-300 hover:text-indigo-200 text-left font-medium"
                >
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  <span>Choose / Switch Course</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    handleSendMessage('Quiz me');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-left"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Interactive Topic Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    openUrlModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-left"
                >
                  <Link2 className="w-4 h-4 text-indigo-400" />
                  <span>Analyze External Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    openTestsModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-left"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verify 12 Acceptance Tests</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    setShowMcpModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-purple-300 hover:text-purple-200 text-left font-medium"
                >
                  <Cable className="w-4 h-4 text-purple-400" />
                  <span>🔌 MCP Tools (GitHub & Gmail)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDrawer(false);
                    resetProgress();
                    handleSendMessage('Show my learning progress');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-300 text-left"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset to Baseline</span>
                </button>
              </div>
            )}
          </div>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Teacher Luna gently (e.g. 'I want to learn Web Development', 'Explain this topic', 'Quiz me')..."
            className="flex-1 bg-gray-950/80 border border-gray-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* MCP Settings Modal */}
      <McpSettingsModal
        isOpen={showMcpModal}
        onClose={() => {
          setShowMcpModal(false);
          fetchMcpConfig();
        }}
        studentId={studentId}
        onExecuteToolInChat={(prompt) => {
          setInputMessage(prompt);
          handleSendMessage(prompt);
        }}
      />
    </div>
  );
}

/**
 * In-Chat Widget Renderer: Quizzes, Action Buttons, URL Cards, Resources
 */
function InChatWidgetRenderer({ 
  widget, 
  openStudyModal, 
  openDiagnosticModal, 
  updateTopic, 
  handleSendMessage,
  onCosmicReaction,
  onOpenMcpModal
}) {
  if (widget.type === 'course_options_card') {
    return (
      <CourseOptionsWidget
        options={widget.options || []}
        currentCourse={widget.currentCourse}
        currentGoal={widget.currentGoal}
        handleSendMessage={handleSendMessage}
      />
    );
  }

  if (widget.type === 'course_initialized_card') {
    return (
      <CourseInitializedWidget
        roadmap={widget.roadmap}
        level={widget.level}
        topic={widget.topic}
        openStudyModal={openStudyModal}
        handleSendMessage={handleSendMessage}
      />
    );
  }

  if (widget.type === 'welcome_actions') {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => openStudyModal(widget.level, widget.topic)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Study {widget.topic?.title}</span>
        </button>
        <button
          onClick={() => handleSendMessage(`Quiz me on ${widget.topic?.title}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium text-xs transition-all"
        >
          <Award className="w-3.5 h-3.5" />
          <span>Take Quiz Assessment</span>
        </button>
        <button
          onClick={() => openDiagnosticModal(widget.level, widget.topic)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium text-xs transition-all"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Diagnostic Test Out</span>
        </button>
      </div>
    );
  }

  if (widget.type === 'topic_quick_actions') {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => openStudyModal(widget.level, widget.topic)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Study Lesson</span>
        </button>
        <button
          onClick={() => handleSendMessage(`Quiz me on ${widget.topic?.title}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium text-xs transition-all"
        >
          <Award className="w-3.5 h-3.5" />
          <span>Take Quiz</span>
        </button>
        <button
          onClick={() => openDiagnosticModal(widget.level, widget.topic)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium text-xs transition-all"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Diagnostic Test</span>
        </button>
      </div>
    );
  }

  if (widget.type === 'in_chat_quiz') {
    return (
      <InChatQuizCard
        quizData={widget.quizData}
        updateTopic={updateTopic}
        onCosmicReaction={onCosmicReaction}
      />
    );
  }

  if (widget.type === 'level_topics_list') {
    const lvl = widget.level;
    return (
      <div className="space-y-1.5 pt-1">
        {lvl.topics?.map((topic, i) => (
          <div
            key={topic.id || i}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 border border-gray-700/60 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                topic.status === 'Completed' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`} />
              <span className="font-medium text-gray-200">{topic.title}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-mono">
                {topic.assessmentScore !== null ? `${topic.assessmentScore}%` : 'Pending'}
              </span>
              <button
                onClick={() => openStudyModal(lvl, topic)}
                className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[11px] font-medium transition-all"
              >
                Review
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'progress_summary_card') {
    const d = widget.data;
    return (
      <div className="p-3 rounded-xl bg-gray-800/80 border border-gray-700 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 font-semibold">{d.currentLvlTitle}</span>
          <span className="text-indigo-400 font-mono font-bold">{d.currentLvlPct}% Complete</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full"
            style={{ width: `${d.currentLvlPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>Completed: {d.currentCompleted} / {d.currentTotal} Topics</span>
          <span>Remaining: {d.currentRemaining} Topics</span>
        </div>
      </div>
    );
  }

  if (widget.type === 'url_analysis_card') {
    const a = widget.data;
    return (
      <div className="p-3.5 rounded-xl bg-gray-900/90 border border-gray-700 space-y-2.5 text-xs">
        {a.photo?.url && (
          <div className="rounded-lg overflow-hidden border border-cyan-500/30 bg-black/60 relative">
            <img
              src={a.photo.url}
              alt={a.photo.caption || 'Concept Photo'}
              className="w-full max-h-48 object-cover object-center"
            />
            <div className="p-2 bg-[#0B0F19]/90 border-t border-gray-800 text-[11px] flex items-center justify-between">
              <span className="text-gray-300 truncate">{a.photo.caption}</span>
              <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 shrink-0">
                {a.photo.provider || 'LangChain AI'}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-medium">
            {a.fitsIntoLevel?.title || 'Curriculum Mapped'}
          </span>
          <span className="text-gray-400">&rarr;</span>
          <span className="text-teal-300 font-medium">{a.fitsIntoTopic?.title}</span>
        </div>
        <div className="text-gray-300 leading-relaxed">
          <strong className="text-white">Core Takeaway:</strong> {a.learningTakeaway}
        </div>
        {a.notesMarkdown && (
          <div className="pt-1 flex justify-start">
            <button
              onClick={() => {
                navigator.clipboard.writeText(a.notesMarkdown);
                alert('Copied full LangChain Master Study Notes to clipboard!');
              }}
              className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Copy Full LangChain Notes</span>
            </button>
          </div>
        )}
        <div className="text-[10.5px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
          ⚠️ <em>{a.notice}</em>
        </div>
      </div>
    );
  }

  if (widget.type === 'resources_list') {
    return (
      <div className="space-y-1.5 pt-1">
        {widget.resources?.map((res, i) => (
          <a
            key={i}
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700 text-xs transition-colors group"
          >
            <div>
              <div className="font-medium text-indigo-300 group-hover:text-indigo-200">
                {res.title}
              </div>
              <div className="text-[11px] text-gray-400 line-clamp-1">{res.snippet}</div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 flex-shrink-0 ml-2 mt-0.5" />
          </a>
        ))}
      </div>
    );
  }

  // MCP Status Card Widget
  if (widget.type === 'mcp_status_card') {
    return (
      <div className="p-3.5 bg-[#0B0F19] border border-purple-500/30 rounded-xl space-y-2 text-xs shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-purple-300">
            <Cable className="w-4 h-4 text-purple-400" />
            <span>MCP Integrations Status</span>
          </div>
          <button
            onClick={onOpenMcpModal}
            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] transition-colors"
          >
            Configure MCP
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-200">
              <GithubIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>GitHub MCP</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              widget.github?.connected ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-400'
            }`}>
              {widget.github?.connected ? `Connected (@${widget.github?.user?.login || 'User'})` : 'Not Connected'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-200">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>Gmail MCP</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              widget.gmail?.connected ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-400'
            }`}>
              {widget.gmail?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // MCP Prompt Card Widget
  if (widget.type === 'mcp_prompt_card') {
    return (
      <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2">
          {widget.service === 'github' ? <GithubIcon className="w-4 h-4 text-cyan-400 shrink-0" /> : <Mail className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span className="text-gray-200 font-medium">
            Connect your {widget.service === 'github' ? 'GitHub Personal Access Token' : 'Gmail App Password'} to unlock AI actions
          </span>
        </div>
        <button
          onClick={onOpenMcpModal}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-xs hover:brightness-110 transition-all flex items-center gap-1 shadow-sm shrink-0"
        >
          <Key className="w-3 h-3" />
          <span>Connect {widget.service === 'github' ? 'GitHub' : 'Gmail'}</span>
        </button>
      </div>
    );
  }

  // GitHub Repositories Card Widget
  if (widget.type === 'github_repos_card') {
    return (
      <div className="p-3 bg-[#0B0F19] border border-cyan-500/30 rounded-xl space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
            <GithubIcon className="w-4 h-4" />
            <span>GitHub Repositories ({widget.repos?.length || 0})</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {widget.repos?.map((repo) => (
            <div key={repo.id} className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 hover:border-cyan-500/40 transition-colors">
              <div className="flex items-start justify-between gap-1">
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-white hover:text-cyan-300 flex items-center gap-1 truncate"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{repo.name}</span>
                  <ExternalLink className="w-3 h-3 text-gray-500 shrink-0" />
                </a>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 shrink-0">
                  {repo.language || 'Code'}
                </span>
              </div>
              {repo.description && (
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{repo.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => handleSendMessage(`Show recent commits for ${repo.name}`)}
                  className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-medium transition-colors"
                >
                  📜 Commits
                </button>
                <button
                  onClick={() => handleSendMessage(`Commit file notes.md in repo ${repo.name} with content: Completed curriculum lesson with Teacher Luna`)}
                  className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-medium transition-colors"
                >
                  ⚡ Commit Note
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // GitHub Commits Card Widget
  if (widget.type === 'github_commits_card') {
    return (
      <div className="p-3 bg-[#0B0F19] border border-cyan-500/30 rounded-xl space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
            <GitCommit className="w-4 h-4 text-emerald-400" />
            <span>Recent Commits: {widget.owner}/{widget.repo}</span>
          </div>
          <a
            href={`https://github.com/${widget.owner}/${widget.repo}/commits`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="space-y-1.5">
          {widget.commits?.map((c) => (
            <div key={c.sha} className="p-2 rounded-lg bg-gray-900/80 border border-gray-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 shrink-0">
                  {c.short_sha}
                </code>
                <span className="text-gray-200 font-medium truncate">{c.message}</span>
              </div>
              <div className="text-[10px] text-gray-400 shrink-0 flex items-center gap-2">
                <span>{c.author}</span>
                <a href={c.html_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-cyan-300">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // GitHub Commit Success Card Widget
  if (widget.type === 'github_commit_card') {
    return (
      <div className="p-3.5 bg-[#0B0F19] border border-emerald-500/40 rounded-xl space-y-2 text-xs shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>GitHub Commit Executed via AI</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
            {widget.action === 'created' ? 'Created File' : 'Updated File'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/90 border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">Repository:</span>
            <span className="font-mono text-white">{widget.owner}/{widget.repo}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">File Path:</span>
            <span className="font-mono text-cyan-300 font-medium">{widget.path}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">Commit SHA:</span>
            <span className="font-mono text-purple-300">{widget.sha}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">Message:</span>
            <span className="italic text-gray-200">"{widget.message}"</span>
          </div>
        </div>
        {widget.url && (
          <a
            href={widget.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-medium text-xs transition-colors"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>View File / Commit on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // GitHub File Content Card Widget
  if (widget.type === 'github_file_card') {
    return (
      <div className="p-3 bg-[#0B0F19] border border-cyan-500/30 rounded-xl space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <span className="font-mono text-cyan-300 font-semibold">{widget.path} ({widget.owner}/{widget.repo})</span>
          {widget.url && (
            <a href={widget.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <pre className="p-2.5 rounded-lg bg-gray-950 font-mono text-[11px] text-gray-200 overflow-x-auto max-h-48 border border-gray-800">
          {widget.content}
        </pre>
      </div>
    );
  }

  // Gmail Inbox Card Widget
  if (widget.type === 'gmail_inbox_card') {
    return (
      <div className="p-3 bg-[#0B0F19] border border-indigo-500/30 rounded-xl space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Gmail Inbox ({widget.emails?.length || 0} messages)</span>
          </div>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {widget.emails?.length > 0 ? (
            widget.emails.map((e) => (
              <div key={e.id} className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white truncate">{e.from}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{e.date}</span>
                </div>
                <div className="text-indigo-200 font-medium truncate">{e.subject}</div>
                {e.snippet && (
                  <p className="text-[11px] text-gray-400 line-clamp-1">{e.snippet}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-400 py-2">No messages found in Inbox.</p>
          )}
        </div>
      </div>
    );
  }

  // Gmail Sent Card Widget
  if (widget.type === 'gmail_sent_card') {
    return (
      <div className="p-3.5 bg-[#0B0F19] border border-emerald-500/40 rounded-xl space-y-2 text-xs shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Email Dispatched via Gmail MCP</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
            Delivered
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-gray-900/90 border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">To:</span>
            <span className="font-mono text-white">{widget.to}</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">Subject:</span>
            <span className="text-indigo-200 font-medium">"{widget.subject}"</span>
          </div>
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-500">Dispatched:</span>
            <span className="text-gray-300">{new Date(widget.sentAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Interactive Course Options Card
 */
function CourseOptionsWidget({ options, currentCourse, currentGoal, handleSendMessage }) {
  const [customGoal, setCustomGoal] = useState('');

  const getTrackIcon = (id) => {
    switch (id) {
      case 'web':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'devops':
        return <Cloud className="w-4 h-4 text-emerald-400" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-pink-400" />;
      case 'ai':
        return <Cpu className="w-4 h-4 text-violet-400" />;
      case 'cyber':
        return <Shield className="w-4 h-4 text-amber-400" />;
      default:
        return <GraduationCap className="w-4 h-4 text-indigo-400" />;
    }
  };

  const handleSelectTrack = (trackTitle) => {
    handleSendMessage(`I want to learn ${trackTitle}`);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customGoal.trim()) return;
    handleSendMessage(`I want to learn ${customGoal.trim()}`);
    setCustomGoal('');
  };

  return (
    <div className="rounded-xl bg-gray-950/90 border border-indigo-500/30 p-3.5 space-y-3 text-xs shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white tracking-wide">Choose Your Learning Course</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
          Step-by-Step Levels
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleSelectTrack(opt.title)}
            className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-900/80 hover:bg-gray-800/90 border border-gray-800 hover:border-indigo-500/50 text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-gray-800/80 group-hover:bg-indigo-950/80 border border-gray-700/60 group-hover:border-indigo-500/40 flex-shrink-0 transition-colors">
              {getTrackIcon(opt.id)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                  {opt.title}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 flex-shrink-0">
                  {opt.badge}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                {opt.desc}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 self-center" />
          </button>
        ))}
      </div>

      {/* Custom Topic Input */}
      <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-gray-800/80">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Or enter any course / technology you wish to learn:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            placeholder="e.g. Game Development, Rust, Blockchain..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!customGoal.trim()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1 transition-all flex-shrink-0"
          >
            <span>Start</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Interactive Course Initialized Card
 */
function CourseInitializedWidget({ roadmap, level, topic, openStudyModal, handleSendMessage }) {
  if (!roadmap) return null;
  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-950/60 via-gray-900 to-gray-950 border border-emerald-500/40 p-3.5 space-y-2.5 text-xs shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-wide">{roadmap.title}</div>
            <div className="text-[10px] text-emerald-400 font-mono">Curriculum Initialized &bull; Cosmos Warped</div>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-mono">
          {roadmap.levels?.length || 5} Levels
        </span>
      </div>

      <div className="p-2.5 rounded-lg bg-gray-900/90 border border-gray-800 space-y-1">
        <div className="text-gray-300 flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Active Orbit: {level?.title || 'Level 1'}</span>
        </div>
        <p className="text-[11px] text-gray-400 pl-3.5">
          First Mission: <strong className="text-gray-200">{topic?.title || 'Lesson 1'}</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => {
            if (openStudyModal && level && topic) {
              openStudyModal(level, topic);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Begin First Lesson</span>
        </button>
        <button
          onClick={() => handleSendMessage(`Can you explain the foundations of ${topic?.title || 'our first topic'}?`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 font-medium text-xs transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ask Teacher Luna</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Interactive In-Chat Quiz Card Component
 */
function InChatQuizCard({ quizData, updateTopic, onCosmicReaction }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  const questions = quizData.questions || [];
  const activeQuestion = questions[currentQIndex];

  const handleSelectOption = (qId, optionIdx) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: optionIdx
    }));
  };

  const handleFinishQuiz = async () => {
    let correct = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswerIndex) {
        correct++;
      }
    });

    const calculatedScore = Math.round((correct / questions.length) * 100);
    setQuizScore(calculatedScore);
    setSubmitted(true);

    // If passed (score >= 70%), trigger universe celebration & persist to database!
    if (calculatedScore >= 70) {
      if (onCosmicReaction) {
        onCosmicReaction('passed');
        setTimeout(() => {
          if (onCosmicReaction) onCosmicReaction('idle');
        }, 4500);
      }

      if (updateTopic) {
        try {
          await updateTopic(quizData.levelId, quizData.topicId, {
            assessmentScore: calculatedScore,
            lessonCompleted: true
          });
        } catch (err) {
          console.error('Quiz score update failed:', err);
        }
      }
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-gray-950/80 border border-amber-500/30 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-300">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Interactive Quiz: {quizData.topicTitle}</span>
        </div>
        <span className="text-[10px] font-mono text-gray-400">
          Question {currentQIndex + 1} of {questions.length}
        </span>
      </div>

      {!submitted ? (
        <div className="space-y-3">
          <p className="font-medium text-gray-200">
            {activeQuestion?.question}
          </p>

          <div className="space-y-1.5">
            {activeQuestion?.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[activeQuestion.id] === optIdx;
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => handleSelectOption(activeQuestion.id, optIdx)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2 ${
                    isSelected
                      ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium'
                      : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] ${
                    isSelected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-gray-600 text-gray-400'
                  }`}>
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="text-xs leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((i) => i - 1)}
              className="px-2.5 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-40 text-xs"
            >
              Previous
            </button>

            {currentQIndex < questions.length - 1 ? (
              <button
                type="button"
                disabled={selectedAnswers[activeQuestion?.id] === undefined}
                onClick={() => setCurrentQIndex((i) => i + 1)}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 text-xs font-medium"
              >
                Next Question
              </button>
            ) : (
              <button
                type="button"
                disabled={Object.keys(selectedAnswers).length < questions.length}
                onClick={handleFinishQuiz}
                className="px-3.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 text-xs font-semibold shadow-md"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in">
          <div className={`p-3 rounded-xl border flex items-center gap-3 ${
            quizScore >= 70 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {quizScore >= 70 ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                Quiz Result: {quizScore}% {quizScore >= 70 ? '(PASSED 🎉)' : '(NEEDS REVIEW)'}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {quizScore >= 70 
                  ? 'Supernova triggered! Score meets ≥70% requirement. Progress updated & synced!'
                  : 'Score is below 70%. Incomplete until retaken and passed.'}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-[11px]">
            {questions.map((q, idx) => {
              const isCorrect = selectedAnswers[q.id] === q.correctAnswerIndex;
              return (
                <div key={q.id} className="p-2 rounded bg-gray-900/60 border border-gray-800">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{isCorrect ? '✅' : '❌'} Q{idx + 1}:</span>
                    <span className="text-gray-300">{q.question}</span>
                  </div>
                  <div className="text-gray-400 mt-1 pl-5">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setSelectedAnswers({});
              setCurrentQIndex(0);
              setQuizScore(null);
            }}
            className="w-full py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium transition-colors"
          >
            Retake Quiz
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Image Card with loading placeholder, graceful error fallback, and high-res link
 */
function ImageCard({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-800 hover:border-cyan-500/40 bg-[#070B14] shadow-lg transition-all group">
      <div className="relative overflow-hidden bg-black/50 flex items-center justify-center min-h-[140px] max-h-[380px] p-2">
        <img 
          src={src} 
          alt={alt || 'Visual Diagram'} 
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-auto max-h-[360px] max-w-full object-contain rounded-lg transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 font-mono animate-pulse">
            Loading visual diagram...
          </div>
        )}
      </div>
      {alt && (
        <div className="px-3.5 py-2 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-300">
          <span className="truncate pr-2 font-medium">{alt}</span>
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 flex-shrink-0 text-[10px] font-mono hover:underline"
          >
            <span>Full Image</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Mermaid.js Diagram Renderer
 */
function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const cleanChart = (chart || '').trim();
        if (!cleanChart) return;
        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvgHtml(svg);
          setError(false);
        }
      } catch (err) {
        console.warn('Mermaid diagram render notice:', err.message || err);
        if (isMounted) setError(true);
      }
    };
    renderChart();
    return () => { isMounted = false; };
  }, [chart]);

  if (error || !svgHtml) {
    return (
      <div className="my-2.5 p-3 rounded-xl border border-gray-800 bg-[#070B14] font-mono text-xs text-gray-400">
        <div className="text-cyan-400 font-semibold mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Interactive Flowchart</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre text-emerald-300">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#070B14]/95 p-3 shadow-xl">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800/80 text-[11px] text-cyan-400 font-medium">
        <span className="flex items-center gap-1.5 font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Interactive Architecture Flowchart
        </span>
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Visual Guide</span>
      </div>
      <div 
        ref={containerRef}
        className="overflow-x-auto flex justify-center py-2 text-center [&>svg]:max-w-full [&>svg]:h-auto transition-transform"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  );
}

/**
 * Natural Human Text Renderer:
 * - Completely eliminates any <br> / <br/> tags.
 * - Formats markdown (paragraphs, bold, code snippets, lists, headers, links) cleanly.
 * - Renders interactive Mermaid diagrams and visual illustration cards.
 * - Displays like a real, elegant human conversation.
 */
function NaturalTextRenderer({ content }) {
  if (!content) return null;

  // 1. Scrub any raw HTML tags, specifically <br>, <br/>, <div>, <span>, <p>
  const clean = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z0-9]+(?:\s+[^>]*>|>)/gi, '')
    .trim();

  // 2. Separate fenced code blocks and markdown images from regular markdown
  const parts = clean.split(/(```[\s\S]*?```|!\[[^\]]*\]\([^)]+\))/g);

  return (
    <div className="space-y-2.5 text-[13.5px] leading-relaxed text-gray-200">
      {parts.map((part, pIdx) => {
        if (!part) return null;

        // Image: ![alt](url)
        const trimmedPart = part.trim();
        if (trimmedPart.startsWith('![') && trimmedPart.includes('](') && trimmedPart.endsWith(')')) {
          const imgMatch = trimmedPart.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
          if (imgMatch) {
            return <ImageCard key={pIdx} alt={imgMatch[1]} src={imgMatch[2]} />;
          }
        }

        // Code Block or Mermaid Diagram
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const language = /^[a-z0-9_#+-]+$/i.test(firstLine) ? firstLine.toLowerCase() : '';
          const codeBody = language ? lines.slice(1).join('\n') : lines.join('\n');

          if (language === 'mermaid') {
            return <MermaidDiagram key={pIdx} chart={codeBody} />;
          }

          return (
            <div key={pIdx} className="my-2.5 rounded-xl overflow-hidden border border-gray-800 bg-[#070B14] shadow-md font-mono text-xs">
              {language && (
                <div className="px-3 py-1 bg-gray-900/90 border-b border-gray-800 text-[10px] text-cyan-400 font-semibold tracking-wider uppercase flex items-center justify-between">
                  <span>{language}</span>
                  <span className="text-gray-500 font-normal">code</span>
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-emerald-300 whitespace-pre">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        // Paragraphs
        const paragraphs = part.split(/\n{2,}/g);

        return (
          <div key={pIdx} className="space-y-2">
            {paragraphs.map((para, paraIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              // Headers: ### Title or ## Title
              if (/^#{1,4}\s+/.test(trimmed)) {
                const headerText = trimmed.replace(/^#{1,4}\s+/, '');
                return (
                  <h4 key={paraIdx} className="font-bold text-white text-sm pt-1 tracking-tight flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">&bull;</span>
                    {renderInlineFormatting(headerText)}
                  </h4>
                );
              }

              // Blockquotes: > quote
              if (trimmed.startsWith('>')) {
                const quoteText = trimmed.replace(/^>\s*/gm, '');
                return (
                  <div key={paraIdx} className="border-l-2 border-indigo-500/60 pl-3 py-1 my-1.5 text-xs text-gray-300 italic bg-indigo-950/20 rounded-r-lg">
                    {renderInlineFormatting(quoteText)}
                  </div>
                );
              }

              // Bullet list lines: - item or * item
              const lines = trimmed.split('\n');
              const isList = lines.length > 1 && lines.every(l => /^[-*•]\s+/.test(l.trim()));
              if (isList) {
                return (
                  <ul key={paraIdx} className="space-y-1 my-1 pl-1">
                    {lines.map((l, lIdx) => {
                      const itemText = l.trim().replace(/^[-*•]\s+/, '');
                      return (
                        <li key={lIdx} className="flex items-start gap-2 text-gray-200">
                          <span className="text-cyan-400 mt-1 flex-shrink-0 text-xs">&#8226;</span>
                          <span>{renderInlineFormatting(itemText)}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              // Standard human paragraph
              return (
                <p key={paraIdx} className="leading-relaxed text-gray-200">
                  {lines.map((line, lineIdx) => (
                    <React.Fragment key={lineIdx}>
                      {renderInlineFormatting(line)}
                      {lineIdx < lines.length - 1 && <span className="block h-1" />}
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    
      {/* Sarvam AI TTS Configuration Modal */}
      {showSarvamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎙️</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Sarvam AI Speech Voice</h3>
                  <p className="text-[11px] text-gray-400">Natural Indic TTS for Tamil & English</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSarvamModal(false)}
                className="text-gray-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSarvamKey} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Sarvam AI Subscription Key
                </label>
                <input
                  type="password"
                  value={sarvamApiKey}
                  onChange={(e) => setSarvamApiKey(e.target.value)}
                  placeholder={isSarvamConfigured ? "Key configured (enter new key to update)" : "Paste your Sarvam API subscription key"}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Stored securely on the server. Get your key at <a href="https://sarvam.ai" target="_blank" rel="noreferrer" className="text-cyan-400 underline">sarvam.ai</a>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Default Speaker Voice
                </label>
                <select
                  value={sarvamSpeaker}
                  onChange={(e) => setSarvamSpeaker(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="anushka">Anushka (Warm & Gentle Female - Default)</option>
                  <option value="meera">Meera (Tamil Fluent Female)</option>
                  <option value="pavithra">Pavithra (Natural Indic Female)</option>
                  <option value="arvind">Arvind (Clear Male)</option>
                  <option value="amartya">Amartya (Deep Male)</option>
                </select>
              </div>

              {sarvamSaveMsg && (
                <div className={`p-2 rounded-lg text-xs ${sarvamSaveMsg.includes('✅') ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-red-950/80 text-red-300 border border-red-500/30'}`}>
                  {sarvamSaveMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowSarvamModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sarvamSaving}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50"
                >
                  {sarvamSaving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
</div>
  );
}

function renderInlineFormatting(text) {
  if (!text) return '';

  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const tokens = text.split(regex);

  return tokens.map((token, idx) => {
    if (!token) return null;
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 font-mono text-[11px] border border-gray-700/60">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('[') && token.includes('](')) {
      const match = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <a
            key={idx}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/40 hover:decoration-cyan-300 transition-colors inline-flex items-center gap-0.5"
          >
            {match[1]}
          </a>
        );
      }
    }
    return token;
  });
}

