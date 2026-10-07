import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  AlertCircle,
  Globe,
  Bot,
  User,
  Clock,
  Sparkles,
  HelpCircle,
  Send,
  FastForward,
  Pause,
  Activity,
  Radio,
} from 'lucide-react';
import { Lead, LeadOutcome } from '../types';
import { saveLeadLanguage, completeBrowserCallSession } from '../services/leadService';
import { sarvamTTS, sarvamSTT } from '../services/campaignService';


interface BrowserCallModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onCallFinished: () => void;
  isCampaignMode?: boolean;
  hasNextLead?: boolean;
  nextLeadName?: string;
  onNextLead?: () => void;
  onStopCampaign?: () => void;
}

type CallState = 'Calling...' | 'Connected' | 'AI Speaking...' | 'Listening...' | 'Call Completed';

type LanguageOption = 'English' | 'Hindi' | 'Tamil-English';

interface ScriptDialogue {
  speaker: 'AI' | 'Customer';
  text: string;
  timestamp: string;
}

export const BrowserCallModal: React.FC<BrowserCallModalProps> = ({
  lead,
  isOpen,
  onClose,
  onCallFinished,
  isCampaignMode = false,
  hasNextLead = false,
  nextLeadName,
  onNextLead,
  onStopCampaign,
}) => {
  // Call States
  const [callState, setCallState] = useState<CallState>('Calling...');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [dialogue, setDialogue] = useState<ScriptDialogue[]>([]);
  const dialogueRef = useRef<ScriptDialogue[]>([]);
  const [currentTextInput, setCurrentTextInput] = useState<string>('');
  const [liveSpeechText, setLiveSpeechText] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const [finalOutcome, setFinalOutcome] = useState<LeadOutcome | null>(null);
  const [nextLeadCountdown, setNextLeadCountdown] = useState<number | null>(null);

  // Extracted Qualification Answers
  const [qualification, setQualification] = useState({
    interested: '',
    buyerOrInvestor: '',
    budget: '',
    location: '',
    timeline: '',
  });

  // State Refs to completely eliminate React closure staleness
  const callStateRef = useRef<CallState>('Calling...');
  const currentStepRef = useRef<number>(0);
  const selectedLanguageRef = useRef<LanguageOption | null>(null);
  const qualificationRef = useRef(qualification);
  const isSpeechSynthesisSpeakingRef = useRef<boolean>(false);
  const isRecognitionRunningRef = useRef<boolean>(false);

  // System Refs
  const callStartTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const noAnswerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dialogueEndRef = useRef<HTMLDivElement | null>(null);

  // Sarvam AI — TTS audio element + availability flag
  const [sarvamAvailable, setSarvamAvailable] = useState<boolean>(false);
  const sarvamAudioRef = useRef<HTMLAudioElement | null>(null);
  // For Sarvam STT — MediaRecorder to capture audio chunks for upload
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);


  // Sync state to refs immediately
  const updateCallState = (newState: CallState) => {
    callStateRef.current = newState;
    setCallState(newState);
  };

  const updateCurrentStep = (newStep: number) => {
    currentStepRef.current = newStep;
    setCurrentStep(newStep);
  };

  const updateSelectedLanguage = (newLang: LanguageOption) => {
    selectedLanguageRef.current = newLang;
    setSelectedLanguage(newLang);
  };

  const updateQualification = (updates: Partial<typeof qualification>) => {
    setQualification((prev) => {
      const next = { ...prev, ...updates };
      qualificationRef.current = next;
      return next;
    });
  };

  // Auto scroll dialogue
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue, liveSpeechText]);

  // Duration timer
  useEffect(() => {
    if (callState !== 'Calling...' && callState !== 'Call Completed') {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Preload speech synthesis voices (fallback only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Check Sarvam API availability on mount
  useEffect(() => {
    fetch('/api/sarvam/settings')
      .then((r) => r.json())
      .then((cfg) => {
        setSarvamAvailable(Boolean(cfg?.apiKeyConfigured));
      })
      .catch(() => setSarvamAvailable(false));
  }, []);



  // Initialize browser call when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      startBrowserCallSession();
    }
    return () => {
      cleanupAudioSession();
    };
  }, [isOpen, lead]);

  const cleanupAudioSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    isRecognitionRunningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Stop Sarvam TTS audio if playing
    if (sarvamAudioRef.current) {
      try {
        sarvamAudioRef.current.pause();
        sarvamAudioRef.current.src = '';
      } catch (e) { /* ignore */ }
      sarvamAudioRef.current = null;
    }

    // Stop Sarvam STT recording
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isSpeechSynthesisSpeakingRef.current = false;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMicActive(false);
    setMicAudioLevel(0);
  };


  // Start real-time audio volume visualizer from microphone stream
  const startAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round(avg * 2.2));
        setMicAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('Audio meter exception:', e);
    }
  };

  const startBrowserCallSession = async () => {
    updateCallState('Calling...');
    setDialogue([]);
    dialogueRef.current = [];
    updateCurrentStep(0);
    updateSelectedLanguage(null as any);
    setFinalSummary(null);
    setFinalOutcome(null);
    setErrorMessage(null);
    setDuration(0);
    setLiveSpeechText('');
    setNextLeadCountdown(null);
    updateQualification({
      interested: '',
      buyerOrInvestor: '',
      budget: '',
      location: '',
      timeline: '',
    });

    callStartTimeRef.current = Date.now();

    // 1. Request microphone permission & start audio meter
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicActive(true);
      startAudioMeter(stream);
    } catch (err: any) {
      console.warn('Microphone permission not granted:', err);
      setErrorMessage(
        'Microphone access is needed for voice recognition. Please allow microphone permission in your browser or use the on-screen options.'
      );
    }

    // 2. Play connecting delay (1.2 seconds)
    setTimeout(() => {
      updateCallState('Connected');
      triggerStep0LanguagePrompt();
    }, 1200);
  };

  // Play crisp notification chime before speech
  const playAudioChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // ignore
    }
  };

  // Map language option to Sarvam language code
  const getSarvamLangCode = (lang: LanguageOption | null): string => {
    if (lang === 'Hindi') return 'hi-IN';
    if (lang === 'Tamil-English') return 'ta-IN';
    return 'en-IN';
  };

  // Map language to Sarvam speaker — using warm female voices for Lyka Realty AI
  const getSarvamSpeaker = (lang: LanguageOption | null): string => {
    if (lang === 'Hindi') return 'meera';       // Warm Hindi female
    if (lang === 'Tamil-English') return 'pavithra'; // South Indian female
    return 'anushka';                            // English-IN female (default)
  };

  // ── Sarvam TTS: play base64 WAV audio ─────────────────────────────────────
  const playSarvamAudio = (base64Wav: string, onEnd?: () => void) => {
    // Stop any previous audio
    if (sarvamAudioRef.current) {
      sarvamAudioRef.current.pause();
      sarvamAudioRef.current.src = '';
    }
    const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
    audio.volume = 1.0;
    sarvamAudioRef.current = audio;
    audio.onended = () => {
      isSpeechSynthesisSpeakingRef.current = false;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startSarvamSTTListening();
      resetNoAnswerTimeout();
    };
    audio.onerror = () => {
      console.warn('[Sarvam Audio] Playback error, falling back to browser TTS');
      isSpeechSynthesisSpeakingRef.current = false;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startSarvamSTTListening();
    };
    audio.play().catch((e) => {
      console.warn('[Sarvam Audio] play() failed:', e);
      // User interaction required — fallback to browser TTS
      speakWithBrowserTTS('', 'en-IN', onEnd);
    });
  };

  // Speak AI text via SpeechSynthesis with MAXIMUM volume boost (fallback)
  const speakWithBrowserTTS = (text: string, langCode: string, onEnd?: () => void) => {
    // Pause speech recognition while AI is speaking
    if (recognitionRef.current) {
      try {
        isRecognitionRunningRef.current = false;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startContinuousSpeechRecognition();
      return;
    }

    window.speechSynthesis.cancel();
    isSpeechSynthesisSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.volume = 1.0;
    utterance.rate = 0.94;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice =
      voices.find(
        (v) =>
          v.lang.startsWith(langCode.substring(0, 2)) &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Neural') ||
            v.name.includes('Enhanced') ||
            v.name.includes('Premium'))
      ) ||
      voices.find((v) => v.lang.startsWith(langCode.substring(0, 2)) && v.localService) ||
      voices.find((v) => v.lang.startsWith(langCode.substring(0, 2))) ||
      voices.find((v) => v.default);

    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onend = () => {
      isSpeechSynthesisSpeakingRef.current = false;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startContinuousSpeechRecognition();
      resetNoAnswerTimeout();
    };
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      isSpeechSynthesisSpeakingRef.current = false;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startContinuousSpeechRecognition();
    };

    window.speechSynthesis.speak(utterance);
  };

  // ── Master speakAIText: tries Sarvam first, falls back to browser ──────────
  const speakAIText = (text: string, langCode: string, onEnd?: () => void) => {
    // Pause speech recognition while AI is speaking
    if (recognitionRef.current) {
      try {
        isRecognitionRunningRef.current = false;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    playAudioChime();
    updateCallState('AI Speaking...');
    isSpeechSynthesisSpeakingRef.current = true;

    if (sarvamAvailable) {
      // Determine Sarvam language code from langCode parameter
      let sarvamLang = 'en-IN';
      if (langCode.startsWith('hi')) sarvamLang = 'hi-IN';
      else if (langCode.startsWith('ta')) sarvamLang = 'ta-IN';

      // Pick speaker matching selected language
      const currentLang = selectedLanguageRef.current;
      const speaker = getSarvamSpeaker(currentLang);

      sarvamTTS({ text, language_code: sarvamLang, speaker, pace: 0.95 })
        .then((base64Audio) => {
          if (base64Audio) {
            playSarvamAudio(base64Audio, onEnd);
          } else {
            // No audio returned — fall back
            speakWithBrowserTTS(text, langCode, onEnd);
          }
        })
        .catch((err) => {
          console.warn('[Sarvam TTS] Error, falling back to browser TTS:', err);
          speakWithBrowserTTS(text, langCode, onEnd);
        });
    } else {
      // Sarvam not configured — use browser SpeechSynthesis
      speakWithBrowserTTS(text, langCode, onEnd);
    }
  };



  // No answer detection (Requirement 11)
  const resetNoAnswerTimeout = () => {
    if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
    noAnswerTimeoutRef.current = setTimeout(() => {
      handleNoAnswerTimeout();
    }, 22000); // 22 seconds of silence -> No Answer
  };

  const handleNoAnswerTimeout = () => {
    if (callStateRef.current === 'Call Completed') return;
    const aiText = "We didn't receive a response. We will retry reaching you at a later time. Thank you.";
    appendDialogue('AI', aiText);
    speakAIText(aiText, 'en-US', () => {
      finalizeCall('No Answer', 'NO_ANSWER', 'No response received from user during call.', true);
    });
  };

  const appendDialogue = (speaker: 'AI' | 'Customer', text: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newEntry = { speaker, text, timestamp: timeStr };
    dialogueRef.current = [...dialogueRef.current, newEntry];
    setDialogue([...dialogueRef.current]);
  };

  // Continuous Speech Recognition Engine with Live Streaming Transcript
  const startContinuousSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'Web Speech Recognition is not natively supported in this browser. You can click the answer chips below or type.'
      );
      return;
    }

    if (isRecognitionRunningRef.current && recognitionRef.current) {
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      }
    } catch (e) {
      // ignore
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Set recognition language
    const currentLang = selectedLanguageRef.current;
    if (currentLang === 'Hindi') {
      recognition.lang = 'hi-IN';
    } else if (currentLang === 'Tamil-English') {
      recognition.lang = 'ta-IN';
    } else {
      recognition.lang = 'en-IN';
    }

    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          if (text && text.trim().length > 0) {
            setLiveSpeechText('');
            if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
            handleCustomerInput(text.trim());
          }
        } else {
          interim += text;
        }
      }
      if (interim) {
        setLiveSpeechText(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage(
          'Microphone permission blocked. Please click the icon in your address bar and allow Microphone.'
        );
      }
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      // If we are still in listening state and AI is not speaking, automatically restart!
      if (callStateRef.current === 'Listening...' && !isSpeechSynthesisSpeakingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // ignore
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Recognition start error:', e);
    }
  };

  // ── Sarvam STT Listening: Record audio → send to /api/sarvam/stt ──────────
  const startSarvamSTTListening = () => {
    if (!sarvamAvailable) {
      // Fall back to browser speech recognition
      startContinuousSpeechRecognition();
      return;
    }

    if (!mediaStreamRef.current) {
      // No mic stream — fall back
      startContinuousSpeechRecognition();
      return;
    }

    if (isRecordingRef.current) return; // Already recording

    try {
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(mediaStreamRef.current, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        isRecordingRef.current = false;
        if (callStateRef.current === 'Call Completed') return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        audioChunksRef.current = [];

        // Skip if blob is too small (silence / near-empty)
        if (audioBlob.size < 1000) {
          startSarvamSTTListening(); // Keep listening
          return;
        }

        const currentLang = selectedLanguageRef.current;
        const langCode =
          currentLang === 'Hindi' ? 'hi-IN' : currentLang === 'Tamil-English' ? 'ta-IN' : 'en-IN';

        try {
          setLiveSpeechText('🎙️ Processing...');
          const transcript = await sarvamSTT(audioBlob, langCode);
          setLiveSpeechText('');
          if (transcript && transcript.trim().length > 0) {
            if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
            handleCustomerInput(transcript.trim());
          } else {
            // Empty transcript — keep listening
            startSarvamSTTListening();
          }
        } catch (err) {
          console.warn('[Sarvam STT] Error, falling back to browser recognition:', err);
          setLiveSpeechText('');
          startContinuousSpeechRecognition();
        }
      };

      // Record in 4-second chunks
      recorder.start();
      // Auto-stop after 6 seconds to send to Sarvam
      setTimeout(() => {
        if (mediaRecorderRef.current === recorder && recorder.state === 'recording') {
          try { recorder.stop(); } catch (e) { /* ignore */ }
        }
      }, 6000);

    } catch (err) {
      console.warn('[Sarvam STT] MediaRecorder setup error:', err);
      startContinuousSpeechRecognition();
    }
  };



  // STEP 0: Language Selection Prompt (Requirement 3)
  const triggerStep0LanguagePrompt = () => {
    const promptText =
      'Hello, I am an AI assistant from Lyka Realty. Before we begin, which language would you prefer: English, Hindi, or Tamil?';
    appendDialogue('AI', promptText);
    speakAIText(promptText, 'en-US');
  };

  // Customer selects language
  const handleSelectLanguage = async (lang: LanguageOption, fromInteraction = true) => {
    updateSelectedLanguage(lang);
    if (fromInteraction) {
      appendDialogue('Customer', lang);
    }

    // Save selected language immediately to Firestore (Requirement 5)
    if (lead) {
      try {
        await saveLeadLanguage(lead.id, lang);
      } catch (err) {
        console.error('Error saving lead language:', err);
      }
    }

    // Move to Step 1: Good time to talk check
    updateCurrentStep(1);

    setTimeout(() => {
      if (lang === 'Hindi') {
        const text = 'Dhanyawad. Kya abhi baat karne ka sahi samay hai?';
        appendDialogue('AI', text);
        speakAIText(text, 'hi-IN');
      } else if (lang === 'Tamil-English') {
        const text = 'Romba nandri! Ippo oru minute pesa mudiyuma?';
        appendDialogue('AI', text);
        speakAIText(text, 'en-IN');
      } else {
        const text = 'Thank you. Is this a good time to talk for a minute?';
        appendDialogue('AI', text);
        speakAIText(text, 'en-US');
      }
    }, 400);
  };

  // Main Customer Input Parser & Flow Controller (Reads from refs to ensure 0 closure lag)
  const handleCustomerInput = (input: string) => {
    appendDialogue('Customer', input);
    setCurrentTextInput('');
    setLiveSpeechText('');

    const lower = input.toLowerCase();
    const activeStep = currentStepRef.current;
    const activeLang = selectedLanguageRef.current;

    // Check 1: Stop / Opt-out (Requirement 8)
    if (
      lower.includes("don't call") ||
      lower.includes('dont call') ||
      lower.includes('stop') ||
      lower.includes('do not contact') ||
      lower.includes('remove my number') ||
      lower.includes('opt out') ||
      lower.includes('opt-out')
    ) {
      handleOptOut();
      return;
    }

    // Check 2: Human Agent Request (Requirement 9)
    if (
      lower.includes('talk to a person') ||
      lower.includes('talk to someone') ||
      lower.includes('human') ||
      lower.includes('real person') ||
      lower.includes('agent call') ||
      lower.includes('speak with someone')
    ) {
      handleAgentCallback();
      return;
    }

    // STEP 0: Language selection step
    if (activeStep === 0) {
      if (lower.includes('hindi') || lower.includes('हिंदी')) {
        handleSelectLanguage('Hindi', false);
      } else if (lower.includes('tamil') || lower.includes('tanglish') || lower.includes('தமிழ்')) {
        handleSelectLanguage('Tamil-English', false);
      } else {
        handleSelectLanguage('English', false);
      }
      return;
    }

    // STEP 1: Good time to talk check (Requirement 6)
    if (activeStep === 1) {
      if (
        lower.includes('no') ||
        lower.includes('busy') ||
        lower.includes('not now') ||
        lower.includes('later') ||
        lower.includes('nahi') ||
        lower.includes('vendam')
      ) {
        // End conversation politely, mark outcome as COLD
        const politeEnd =
          activeLang === 'Hindi'
            ? 'Koi baat nahi! Aapka samay dene ke liye dhanyawad. Have a great day!'
            : activeLang === 'Tamil-English'
            ? 'Sure, no problem! Thank you for your time, have a great day!'
            : 'No problem at all! Thank you for your time. Have a great day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer was busy or not available to talk.');
        });
        return;
      } else {
        // User agreed (YES) -> Continue with 5 questions
        askQuestion(1);
        return;
      }
    }

    // STEP 2: Question 1 (Interested in buying a property?)
    if (activeStep === 2) {
      updateQualification({ interested: input });
      if (
        lower.includes('not interested') ||
        lower.includes('no interest') ||
        lower.includes('no thanks') ||
        lower.includes('nahi') ||
        lower === 'no'
      ) {
        // Cold lead
        const politeEnd =
          activeLang === 'Hindi'
            ? 'Shukriya. Hum aapko aage disturb nahi karenge. Have a nice day!'
            : activeLang === 'Tamil-English'
            ? 'Okay, totally understand. Thank you for your time, have a nice day!'
            : 'Understood. Thank you for your time. Have a nice day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer is not interested in buying a property.');
        });
        return;
      }
      // Continue to Question 2
      askQuestion(2);
      return;
    }

    // STEP 3: Question 2 (Buying for self or investment?)
    if (activeStep === 3) {
      let type = 'unspecified';
      if (lower.includes('invest') || lower.includes('rental') || lower.includes('yield')) type = 'investor';
      else if (
        lower.includes('myself') ||
        lower.includes('self') ||
        lower.includes('own') ||
        lower.includes('live') ||
        lower.includes('living')
      )
        type = 'buyer';
      else if (lower.includes('both')) type = 'both';
      updateQualification({ buyerOrInvestor: type });
      askQuestion(3);
      return;
    }

    // STEP 4: Question 3 (Budget)
    if (activeStep === 4) {
      updateQualification({ budget: input });
      askQuestion(4);
      return;
    }

    // STEP 5: Question 4 (Location)
    if (activeStep === 5) {
      updateQualification({ location: input });
      askQuestion(5);
      return;
    }

    // STEP 6: Question 5 (Expected Purchase Timeline)
    if (activeStep === 6) {
      updateQualification({ timeline: input });
      // Finished all 5 questions! Classify & Conclude
      evaluateAndCompleteQualification({ ...qualificationRef.current, timeline: input });
      return;
    }
  };

  const getVoiceLangCode = () => {
    if (selectedLanguageRef.current === 'Hindi') return 'hi-IN';
    if (selectedLanguageRef.current === 'Tamil-English') return 'en-IN';
    return 'en-US';
  };

  // Ask one of the 5 Qualification Questions (Requirement 7)
  const askQuestion = (qNum: number) => {
    updateCurrentStep(qNum + 1); // map to steps 2, 3, 4, 5, 6
    let questionText = '';
    const activeLang = selectedLanguageRef.current;

    if (qNum === 1) {
      if (activeLang === 'Hindi') {
        questionText = 'Kya aap abhi property kharidne me interested hain?';
      } else if (activeLang === 'Tamil-English') {
        questionText = 'Oru new property purchase panna idea irukka?';
      } else {
        questionText = 'Are you interested in buying a property?';
      }
    } else if (qNum === 2) {
      if (activeLang === 'Hindi') {
        questionText = 'Kya aap khud ke rehne ke liye dekh rahe hain ya investment ke liye?';
      } else if (activeLang === 'Tamil-English') {
        questionText = 'Super. Idhu unga personal use-kkaaga paakureengala illa investment purpose-kka?';
      } else {
        questionText = 'Are you buying for yourself or as an investment?';
      }
    } else if (qNum === 3) {
      if (activeLang === 'Hindi') {
        questionText = 'Aapka approximate budget kitna hai?';
      } else if (activeLang === 'Tamil-English') {
        questionText = 'Okay, unga budget expectation roughly evlo irukkum?';
      } else {
        questionText = 'What is your approximate budget?';
      }
    } else if (qNum === 4) {
      if (activeLang === 'Hindi') {
        questionText = 'Aap kaun si location ya city me interest rakhte hain?';
      } else if (activeLang === 'Tamil-English') {
        questionText = 'Endha specific location-la property thedureenga?';
      } else {
        questionText = 'Which location are you interested in?';
      }
    } else if (qNum === 5) {
      if (activeLang === 'Hindi') {
        questionText = 'Aap kab tak final decision lene ka soch rahe hain?';
      } else if (activeLang === 'Tamil-English') {
        questionText = 'Purchase panna edhavadhu timeline mind-la vechurukingala?';
      } else {
        questionText = 'What is your expected purchase timeline?';
      }
    }

    appendDialogue('AI', questionText);
    speakAIText(questionText, getVoiceLangCode());
  };

  // Requirement 8: Opt-Out
  const handleOptOut = () => {
    const activeLang = selectedLanguageRef.current;
    const endMsg =
      activeLang === 'Hindi'
        ? 'Samajh gaya. Hum turant aapka number block kar denge aur dobara call nahi aayega. Good day.'
        : activeLang === 'Tamil-English'
        ? 'Understood. Unga number-ai block list-la update panniduvom. Inime calls varadhu. Have a good day.'
        : 'Understood. I will immediately update our records and ensure you are not contacted again. Good day.';
    appendDialogue('AI', endMsg);
    speakAIText(endMsg, getVoiceLangCode(), () => {
      finalizeCall('Completed', 'OPT-OUT', 'Customer requested complete opt-out and number blocking.', false, true);
    });
  };

  // Requirement 9: Human Agent Request
  const handleAgentCallback = () => {
    const activeLang = selectedLanguageRef.current;
    const agentMsg =
      activeLang === 'Hindi'
        ? 'Zaroor! Lyka Realty ke senior property advisor aapse jald hi call par baat karenge. Dhanyawad!'
        : activeLang === 'Tamil-English'
        ? 'Sure! Lyka Realty-oda senior advisor ungalukku shortly direct-ah call pannuvanga. Thank you!'
        : 'Certainly! I will have a senior property advisor from Lyka Realty call you directly. Thank you for your time.';
    appendDialogue('AI', agentMsg);
    speakAIText(agentMsg, getVoiceLangCode(), () => {
      finalizeCall('Completed', 'AGENT_CALLBACK', 'Customer specifically requested a senior human advisor callback.');
    });
  };

  // Requirement 10: Lead Classification
  const evaluateAndCompleteQualification = (q: typeof qualification) => {
    const activeLang = selectedLanguageRef.current;
    const budgetPresent = Boolean(q.budget && q.budget.trim().length > 1);
    const locationPresent = Boolean(q.location && q.location.trim().length > 1);
    const timelineLower = (q.timeline || '').toLowerCase();

    const isUrgent =
      timelineLower.includes('month') ||
      timelineLower.includes('immediate') ||
      timelineLower.includes('ready') ||
      timelineLower.includes('soon') ||
      timelineLower.includes('week');

    let outcome: LeadOutcome = 'WARM';
    if (budgetPresent && locationPresent && (isUrgent || timelineLower.includes('3') || timelineLower.includes('6'))) {
      outcome = 'HOT';
    } else if (!budgetPresent && !locationPresent && !isUrgent) {
      outcome = 'COLD';
    }

    const summary = `Lead qualified in ${activeLang || 'English'}. Profile: ${q.buyerOrInvestor || 'Buyer'}, Budget: ${q.budget || 'Not specified'}, Location: ${q.location || 'Not specified'}, Timeline: ${q.timeline || 'Not specified'}.`;

    const concludingMessage =
      outcome === 'HOT'
        ? activeLang === 'Hindi'
          ? 'Bahut badhiya! Lyka Realty ke senior advisor aapse curated options aur site visit ke liye jald hi connect karenge. Have a wonderful day!'
          : activeLang === 'Tamil-English'
          ? 'Super! Lyka Realty senior property advisor ungalukku curated projects & site visit arrange pannuvanga. Have a great day!'
          : 'Thank you so much! Our senior property advisor will reach out to you with curated options for your preferred location. Have a wonderful day!'
        : activeLang === 'Hindi'
        ? 'Dhanyawad! Hum aapko property catalog share kar denge. Have a great day!'
        : activeLang === 'Tamil-English'
        ? 'Nandri! Ungalukku project details share panniduvom. Have a great day!'
        : 'Thank you for your time! We will share project details with you shortly. Have a great day!';

    appendDialogue('AI', concludingMessage);
    speakAIText(concludingMessage, getVoiceLangCode(), () => {
      finalizeCall('Completed', outcome, summary);
    });
  };

  // Finalize call, save to Firestore collections (calls and leads)
  const finalizeCall = async (
    status: string,
    outcome: LeadOutcome,
    summary: string,
    noAnswer = false,
    blocked = false
  ) => {
    updateCallState('Call Completed');
    setFinalOutcome(outcome);
    setFinalSummary(summary);
    cleanupAudioSession();

    if (!lead) return;

    const transcriptText = dialogueRef.current
      .map((d) => `${d.speaker === 'AI' ? 'AI' : lead.name}: ${d.text}`)
      .join('\n');

    const endedAtStr = new Date().toISOString();
    const startedAtStr = new Date(callStartTimeRef.current).toISOString();
    const finalDuration = Math.max(duration, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    const activeLang = selectedLanguageRef.current || lead.language || 'English';
    const q = qualificationRef.current;

    try {
      await completeBrowserCallSession({
        lead,
        callData: {
          language: activeLang,
          status,
          outcome,
          startedAt: startedAtStr,
          endedAt: endedAtStr,
          duration: finalDuration,
          qualification: {
            interested: q.interested || (outcome === 'COLD' ? 'No' : 'Yes'),
            buyerOrInvestor: q.buyerOrInvestor || 'unspecified',
            budget: q.budget || '',
            location: q.location || '',
            timeline: q.timeline || '',
          },
          summary,
          transcript: transcriptText || 'Browser voice session completed.',
          noAnswer,
        },
        leadUpdates: {
          status,
          outcome,
          language: activeLang,
          blocked: blocked || outcome === 'OPT-OUT',
          buyerOrInvestor: (q.buyerOrInvestor || lead.buyerOrInvestor || 'unspecified') as any,
          budget: q.budget || lead.budget || '',
          location: q.location || lead.location || '',
          timeline: q.timeline || lead.timeline || '',
          nextAction:
            outcome === 'HOT'
              ? 'High Priority: Assign Senior Property Advisor for immediate site visit.'
              : outcome === 'AGENT_CALLBACK'
              ? 'URGENT: Human agent to call back customer.'
              : outcome === 'OPT-OUT'
              ? 'DO NOT CONTACT. Number added to internal DNC registry.'
              : outcome === 'NO_ANSWER'
              ? 'Retry call during business hours.'
              : 'Send digital project catalog and follow up next week.',
        },
      });

      onCallFinished();

      // Sequential campaign mode auto-advancement:
      if (hasNextLead && onNextLead) {
        let count = 4;
        setNextLeadCountdown(count);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = setInterval(() => {
          count -= 1;
          setNextLeadCountdown(count);
          if (count <= 0) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setNextLeadCountdown(null);
            onNextLead();
          }
        }, 1000);
      }
    } catch (saveErr: any) {
      console.error('Error saving call session:', saveErr);
      setErrorMessage(`Note saving to Firestore: ${saveErr.message}`);
    }
  };

  // User manually clicks End Call (Requirement 16)
  const handleManualEndCall = () => {
    if (callState === 'Call Completed') {
      onClose();
      return;
    }

    const currentOutcome = finalOutcome || (currentStep > 2 ? 'WARM' : 'COLD');
    const summary = finalSummary || `Call ended manually by user after ${duration} seconds.`;
    finalizeCall('Completed', currentOutcome, summary);
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Call Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg ${
                  callState === 'Call Completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : callState === 'Calling...'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950'
                }`}
              >
                <Phone className="w-5 h-5 fill-current" />
              </div>
              {callState !== 'Call Completed' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">{lead.name}</h3>
                <span className="text-xs text-slate-400 font-mono">({lead.phone})</span>
              </div>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  sarvamAvailable
                    ? 'bg-violet-400/10 text-violet-300 border-violet-400/20'
                    : 'bg-amber-400/10 text-amber-300 border-amber-400/20'
                }`}>
                  {sarvamAvailable ? '✨ Sarvam AI Voice' : 'Browser AI Voice Call'}
                </span>
                <span className="text-xs text-slate-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleManualEndCall}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Call State Bar */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Status:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full border ${
                callState === 'Calling...'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                  : callState === 'AI Speaking...'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : callState === 'Listening...'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse'
                  : callState === 'Connected'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              {callState}
            </span>

            {/* AI Voice Engine indicator */}
            <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
              sarvamAvailable
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/25'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
            }`}>
              <Volume2 className={`w-3.5 h-3.5 ${sarvamAvailable ? 'text-violet-400' : 'text-emerald-400'}`} />
              <span>{sarvamAvailable ? 'Sarvam Bulbul v3 • Anushka' : 'Voice Sound: 100% Max'}</span>
            </div>

          </div>

          <div className="flex items-center space-x-3">
            {/* Live Microphone Audio Level Visualizer */}
            <div className="flex items-center space-x-1.5 text-slate-300 text-[11px]">
              <Mic className={`w-3.5 h-3.5 ${micAudioLevel > 15 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-[10px] text-slate-400">Mic Input:</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    micAudioLevel > 20 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                  }`}
                  style={{ width: `${Math.max(8, micAudioLevel)}%` }}
                />
              </div>
            </div>

            {selectedLanguage && (
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Lang:</span>
                <strong className="text-white font-bold">{selectedLanguage}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Call Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* STEP 0: Language Selection card (Requirement 3 & 4) */}
          {currentStep === 0 && callState !== 'Call Completed' && (
            <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-center space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Globe className="w-4 h-4" />
                <span>Select Preferred Language</span>
              </div>
              <p className="text-slate-200 text-sm font-semibold max-w-md mx-auto">
                "Hello, I am an AI assistant from Lyka Realty. Before we begin, which language would you prefer: English, Hindi, or Tamil?"
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('English', true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md active:scale-95 transition-all"
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('Hindi', true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md active:scale-95 transition-all"
                >
                  🇮🇳 Hindi (हिंदी)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('Tamil-English', true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md active:scale-95 transition-all"
                >
                  🇮🇳 Tamil-English (Tanglish)
                </button>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium flex items-center justify-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Speak into your microphone now, or click an option above.</span>
              </p>
            </div>
          )}

          {/* Quick Voice Answer Suggestion Chips for Subsequent Steps */}
          {currentStep > 0 && callState !== 'Call Completed' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium flex items-center space-x-1">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Speak your answer or click quick options:</span>
                </span>
                {liveSpeechText && (
                  <span className="text-emerald-400 font-semibold animate-pulse">
                    Hearing: "{liveSpeechText}"
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {currentStep === 1 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Yes, I have a minute.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                    >
                      👍 Yes, I have a minute
                    </button>
                    <button
                      onClick={() => handleCustomerInput('No, I am busy right now.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30"
                    >
                      ⏳ Busy right now
                    </button>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Yes, I am interested in buying a property.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                    >
                      ✅ Yes, interested
                    </button>
                    <button
                      onClick={() => handleCustomerInput('No, not interested in purchasing.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                    >
                      ❌ No, not interested
                    </button>
                  </>
                )}

                {currentStep === 3 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Looking for myself to live in.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                    >
                      🏠 For myself (End user)
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Looking as an investment property.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                    >
                      📈 For investment
                    </button>
                  </>
                )}

                {currentStep === 4 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Approximate budget 50 to 75 Lakhs.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      ₹50L - ₹75L
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Budget is around 1 to 2 Crores.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      ₹1 Cr - ₹2 Cr
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Budget is above 3 Crores.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      ₹3 Cr+ (Luxury)
                    </button>
                  </>
                )}

                {currentStep === 5 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Interested in South Mumbai and Worli.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      Worli / South Mumbai
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Looking around Bandra and Western suburbs.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      Bandra / West Suburbs
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Looking near Chennai OMR tech corridor.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      Chennai / OMR
                    </button>
                  </>
                )}

                {currentStep === 6 && (
                  <>
                    <button
                      onClick={() => handleCustomerInput('Planning to buy within 1 month immediately.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                    >
                      ⚡ Immediate (1 Month)
                    </button>
                    <button
                      onClick={() => handleCustomerInput('Expected timeline is 3 to 6 months.')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                    >
                      3 - 6 Months
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Conversation Dialogue Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3.5 max-h-72 overflow-y-auto">
            {dialogue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 flex flex-col items-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-spin">
                  <Phone className="w-4 h-4 text-amber-400" />
                </div>
                <span>Connecting browser microphone and AI voice channels...</span>
              </div>
            ) : (
              dialogue.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-2.5 ${
                    item.speaker === 'AI' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {item.speaker === 'AI' && (
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      item.speaker === 'AI'
                        ? 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-tl-sm'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-tr-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-2 mb-0.5">
                      <span className="text-[10px] font-bold opacity-75">
                        {item.speaker === 'AI' ? 'Lyka Realty AI Agent' : lead.name}
                      </span>
                      <span className="text-[9px] opacity-40 font-mono">{item.timestamp}</span>
                    </div>
                    {item.text}
                  </div>

                  {item.speaker === 'Customer' && (
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Live streaming interim speech indicator */}
            {liveSpeechText && (
              <div className="flex items-start space-x-2.5 justify-end animate-in fade-in">
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-tr-sm italic">
                  <span className="text-[10px] font-bold opacity-75 block not-italic">
                    🎙️ Hearing you...
                  </span>
                  {liveSpeechText}
                </div>
                <div className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                </div>
              </div>
            )}

            <div ref={dialogueEndRef} />
          </div>

          {/* Voice Wave Animation when speaking / listening */}
          {callState !== 'Call Completed' && (
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {callState === 'AI Speaking...' ? (
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-4 bg-purple-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-6 bg-purple-300 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1.5 h-3 bg-purple-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    <span className="text-xs font-semibold text-purple-300 ml-2">
                      AI Speaking (100% Volume)...
                    </span>
                  </div>
                ) : callState === 'Listening...' ? (
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-xs font-semibold text-emerald-300">
                      Microphone Active — Speak your answer now...
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Connecting audio channels...</span>
                )}
              </div>

              {/* Text fallback input in case user prefers typing */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Or type here..."
                  value={currentTextInput}
                  onChange={(e) => setCurrentTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && currentTextInput.trim()) {
                      handleCustomerInput(currentTextInput.trim());
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 w-40"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (currentTextInput.trim()) {
                      handleCustomerInput(currentTextInput.trim());
                    }
                  }}
                  className="p-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Call Completed Summary Card */}
          {callState === 'Call Completed' && (
            <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Call Finished & Logged in Firestore</span>
                </span>
                {finalOutcome && (
                  <span className="px-3 py-1 rounded-full font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Outcome: {finalOutcome}
                  </span>
                )}
              </div>

              {finalSummary && (
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-slate-200 text-xs">
                  {finalSummary}
                </div>
              )}

              {/* Qualification summary highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Budget</span>
                  <span className="text-white font-bold">{qualification.budget || '—'}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location</span>
                  <span className="text-white font-bold">{qualification.location || '—'}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Timeline</span>
                  <span className="text-white font-bold">{qualification.timeline || '—'}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Profile</span>
                  <span className="text-white font-bold capitalize">{qualification.buyerOrInvestor || '—'}</span>
                </div>
              </div>

              {/* Sequential next customer auto-advance banner */}
              {hasNextLead && onNextLead && (
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">
                      Autonomous Sequential Engine
                    </span>
                    <p className="text-slate-200 text-xs mt-0.5">
                      {nextLeadCountdown !== null ? (
                        <>
                          Conversation finished! Automatically calling next customer{' '}
                          <strong className="text-amber-300 font-bold">"{nextLeadName || 'Next Lead'}"</strong> in{' '}
                          <span className="font-mono font-bold text-white text-sm bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                            {nextLeadCountdown}s
                          </span>
                          ...
                        </>
                      ) : (
                        <>
                          Next customer ready in queue:{' '}
                          <strong className="text-amber-300">"{nextLeadName || 'Next Lead'}"</strong>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                        setNextLeadCountdown(null);
                        onNextLead();
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md flex items-center space-x-1.5 active:scale-95 transition-all"
                    >
                      <FastForward className="w-3.5 h-3.5 fill-current" />
                      <span>Call Next Now</span>
                    </button>
                    {isCampaignMode && onStopCampaign && (
                      <button
                        type="button"
                        onClick={() => {
                          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                          setNextLeadCountdown(null);
                          onStopCampaign();
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 flex items-center space-x-1"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer with End Call Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {callState !== 'Call Completed' ? (
              <span className="flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Microphone active • Speak clearly into your mic</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold">Saved to customer profile and calls log.</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {callState === 'Call Completed' ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md transition-all"
              >
                Close Window
              </button>
            ) : (
              <button
                type="button"
                onClick={handleManualEndCall}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
