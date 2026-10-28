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
  ChevronDown,
  Check,
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

interface PropertyListing {
  id: string;
  type: string;
  location: string;
  locationTa: string;
  size: string;
  price: string;
  notes: string;
  purpose: 'buy' | 'rent' | 'plot';
}

// Property Listings directly from Property AI Knowledge Base (Property_AI_Tamil_English_Story_Guide.pdf Section 4)
const PDF_PROPERTY_LISTINGS: PropertyListing[] = [
  {
    id: 'P101',
    type: '2BHK Apartment / 2BHK flat',
    location: 'Velachery',
    locationTa: 'வேளச்சேரி',
    size: '950 sq ft',
    price: 'Rs. 72 lakh (72 லட்சம்)',
    notes: 'Ready to move, 2 car parks, lift, near MRT',
    purpose: 'buy',
  },
  {
    id: 'P102',
    type: '3BHK Apartment / 3BHK flat',
    location: 'OMR, Sholinganallur',
    locationTa: 'OMR சோழிங்கநல்லூர்',
    size: '1450 sq ft',
    price: 'Rs. 1.25 crore (1.25 கோடி)',
    notes: 'Possession Dec 2026, gym, pool, CMDA approved',
    purpose: 'buy',
  },
  {
    id: 'P103',
    type: 'Individual House / தனி வீடு',
    location: 'Tambaram',
    locationTa: 'தாம்பரம்',
    size: '1800 sq ft (land 2400)',
    price: 'Rs. 1.6 crore (1.6 கோடி)',
    notes: 'East facing, 3 bedrooms, new construction',
    purpose: 'buy',
  },
  {
    id: 'P104',
    type: 'DTCP Plot / நிலம்',
    location: 'Chengalpattu',
    locationTa: 'செங்கல்பட்டு',
    size: '1200 sq ft',
    price: 'Rs. 18 lakh (18 லட்சம்)',
    notes: 'Clear patta, near highway, loan available',
    purpose: 'plot',
  },
  {
    id: 'P105',
    type: '1BHK Rent / வாடகை',
    location: 'Porur',
    locationTa: 'போரூர்',
    size: '550 sq ft',
    price: 'Rs. 14,000 / month',
    notes: 'Deposit 3 months, bachelors not allowed',
    purpose: 'rent',
  },
  {
    id: 'P106',
    type: '2BHK Rent / வாடகை',
    location: 'Adyar',
    locationTa: 'அடையார்',
    size: '900 sq ft',
    price: 'Rs. 28,000 / month',
    notes: 'Family only, 11-month agreement, pets allowed',
    purpose: 'rent',
  },
];

const getMatchedListingFromPDF = (q: {
  purpose?: string;
  location?: string;
  sizeBHK?: string;
  budget?: string;
  timeline?: string;
  loanOrCash?: string;
  [key: string]: any;
}): PropertyListing => {
  const p = (q.purpose || '').toLowerCase();
  const l = (q.location || '').toLowerCase();
  const s = (q.sizeBHK || '').toLowerCase();

  // Rental requests
  if (p.includes('rent') || p.includes('vaadagai') || p.includes('வாடகை')) {
    if (l.includes('porur') || s.includes('1') || l.includes('போரூர்')) {
      return PDF_PROPERTY_LISTINGS[4]; // P105 Porur 1BHK Rent
    }
    return PDF_PROPERTY_LISTINGS[5]; // P106 Adyar 2BHK Rent
  }

  // Plot requests
  if (p.includes('plot') || p.includes('nilam') || p.includes('நிலம்') || l.includes('chengalpattu') || l.includes('செங்கல்பட்டு')) {
    return PDF_PROPERTY_LISTINGS[3]; // P104 Chengalpattu DTCP Plot
  }

  // Individual House requests
  if (l.includes('tambaram') || l.includes('தாம்பரம்') || s.includes('house') || s.includes('individual') || s.includes('தனி')) {
    return PDF_PROPERTY_LISTINGS[2]; // P103 Tambaram Individual House
  }

  // 3BHK / OMR requests
  if (l.includes('omr') || l.includes('sholinganallur') || l.includes('சோழிங்கநல்லூர்') || s.includes('3')) {
    return PDF_PROPERTY_LISTINGS[1]; // P102 OMR 3BHK Flat
  }

  // Default: Velachery 2BHK Flat
  return PDF_PROPERTY_LISTINGS[0];
};

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

  // Free AI Natural Voice Engine states
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lyka_ai_voice_uri') || '';
    }
    return '';
  });
  const selectedVoiceURIRef = useRef<string>(selectedVoiceURI);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState<boolean>(false);

  // Extracted Qualification Answers (from Property AI Knowledge Base PDF)
  const [qualification, setQualification] = useState({
    interested: '',
    purpose: '',
    location: '',
    sizeBHK: '',
    budget: '',
    timeline: '',
    loanOrCash: '',
    parkingPets: '',
    recommendedProperty: '',
    siteVisit: '',
    buyerOrInvestor: '',
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
  const interimTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTurnProcessingRef = useRef<boolean>(false);
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

  // Voice Quality Scorer: Prioritizes hyper-natural neural girl voices and excludes legacy robotic desktop synthesizers
  const getVoiceQualityScore = (voice: SpeechSynthesisVoice): number => {
    const name = (voice.name || '').toLowerCase();
    const lang = (voice.lang || '').toLowerCase();
    let score = 0;

    // Disqualify male voices immediately
    if (
      name.includes('male') ||
      name.includes('david') ||
      name.includes('george') ||
      name.includes('ravi') ||
      name.includes('mark') ||
      name.includes('guy') ||
      name.includes('stefan') ||
      name.includes('james') ||
      name.includes('richard') ||
      name.includes('daniel') ||
      name.includes('sean') ||
      name.includes('paul')
    ) {
      return -100;
    }

    // Heavy penalty for old robotic desktop SAPI 5 synthesizers (Windows legacy Heera / Zira)
    if (name.includes('desktop') || (name.includes('heera') && !name.includes('natural')) || (name.includes('zira') && !name.includes('natural'))) {
      score -= 100;
    }

    // Tier 1: Natural / Online Neural voices (Azure & Edge neural female voices)
    if (name.includes('natural') || name.includes('online') || name.includes('neural')) {
      score += 180;
    }

    // Tier 2: Google Studio voices (in Chrome)
    if (name.includes('google')) {
      score += 140;
    }

    // Premium Indian English & Hindi natural voices
    if (name.includes('neerja') || (name.includes('swara') && lang.includes('hi'))) {
      score += 100;
    } else if (lang.includes('in') && (name.includes('natural') || name.includes('google'))) {
      score += 80;
    }

    // Google UK English Female in Chrome sounds exceptionally smooth, human, and clear
    if (name.includes('uk english female') || name.includes('british english female')) {
      score += 90;
    }

    // Other top-rated realistic female voices
    if (name.includes('jenny') || name.includes('aria') || name.includes('emma') || name.includes('ava') || name.includes('samantha')) {
      score += 70;
    }

    // General female indicator
    if (
      name.includes('female') ||
      name.includes('girl') ||
      name.includes('woman') ||
      name.includes('kavya') ||
      name.includes('pooja') ||
      name.includes('priya') ||
      name.includes('anushka') ||
      name.includes('sangeeta') ||
      name.includes('veena')
    ) {
      score += 40;
    }

    return score;
  };

  // Test Voice sample generator
  const testVoiceSample = (voiceURI?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) { /* ignore */ }

    const targetURI = voiceURI || selectedVoiceURIRef.current;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.voiceURI === targetURI);

    const testText =
      selectedLanguageRef.current === 'Tamil-English'
        ? 'Hi! Naan Lyka Realty-lendhu, Priya pesuren. How does my voice sound to you?'
        : selectedLanguageRef.current === 'Hindi'
        ? 'Namaste! Main Lyka Realty se Priya baat kar rahi hoon. Kya meri aawaz aapko natural lag rahi hai?'
        : 'Hello! This is Priya from Lyka Realty. How does my natural voice sound to you?';

    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.volume = 1.0;
    utterance.pitch = 1.0;
    utterance.rate = 1.0;
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  };

  // Preload and rank speech synthesis voices for the most natural girl voice
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadAndRankVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const sorted = [...voices].sort((a, b) => getVoiceQualityScore(b) - getVoiceQualityScore(a));
          setAvailableVoices(sorted);

          // Select top-scoring natural female voice if not already selected
          const storedURI = localStorage.getItem('lyka_ai_voice_uri');
          const matchedStored = sorted.find((v) => v.voiceURI === storedURI);
          if (matchedStored) {
            setSelectedVoiceURI(matchedStored.voiceURI);
            selectedVoiceURIRef.current = matchedStored.voiceURI;
          } else {
            const best = sorted.find((v) => getVoiceQualityScore(v) > 0) || sorted[0];
            if (best) {
              setSelectedVoiceURI(best.voiceURI);
              selectedVoiceURIRef.current = best.voiceURI;
              localStorage.setItem('lyka_ai_voice_uri', best.voiceURI);
            }
          }
        }
      };

      loadAndRankVoices();
      window.speechSynthesis.onvoiceschanged = loadAndRankVoices;
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
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isTurnProcessingRef.current = false;

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
      purpose: '',
      location: '',
      sizeBHK: '',
      budget: '',
      timeline: '',
      loanOrCash: '',
      parkingPets: '',
      recommendedProperty: '',
      siteVisit: '',
      buyerOrInvestor: '',
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

  // Speak AI text via SpeechSynthesis with natural young female voice ("Priya" - Free AI)
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

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch (e) { /* ignore */ }

    isSpeechSynthesisSpeakingRef.current = true;

    // Use clean Indian English code for Tanglish if needed
    let effectiveLangCode = langCode;
    if (selectedLanguageRef.current === 'Tamil-English' || langCode.startsWith('ta')) {
      effectiveLangCode = 'en-IN';
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveLangCode;
    utterance.volume = 1.0;
    // Pure, natural human female pitch & smooth conversational flow
    // (pitch: 1.0 eliminates robotic digital distortion and preserves natural vocal cord resonance)
    utterance.pitch = 1.0;
    utterance.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    let chosenVoice: SpeechSynthesisVoice | undefined;

    // 1. If user selected a specific voice from voice picker
    const activeURI = selectedVoiceURIRef.current;
    if (activeURI) {
      chosenVoice = voices.find((v) => v.voiceURI === activeURI);
    }

    // 2. Fallback to the highest-ranked natural female voice
    if (!chosenVoice) {
      const candidates = [...voices].sort((a, b) => getVoiceQualityScore(b) - getVoiceQualityScore(a));
      chosenVoice =
        candidates.find((v) => v.lang.startsWith(effectiveLangCode.substring(0, 2)) && getVoiceQualityScore(v) > 0) ||
        candidates.find((v) => getVoiceQualityScore(v) > 0) ||
        candidates[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    // Persist global reference to prevent Chrome V8 garbage collection mid-speech
    (window as any).__activeUtterance = utterance;

    // Watchdog safety timer to prevent frozen audio state
    const safetyTimeoutMs = Math.max(3000, text.length * 85 + 2000);
    const safetyTimer = setTimeout(() => {
      if (isSpeechSynthesisSpeakingRef.current) {
        console.warn('[SpeechSynthesis] Safety fallback recovered voice state');
        isSpeechSynthesisSpeakingRef.current = false;
        (window as any).__activeUtterance = null;
        updateCallState('Listening...');
        if (onEnd) onEnd();
        startContinuousSpeechRecognition();
        resetNoAnswerTimeout();
      }
    }, safetyTimeoutMs);

    utterance.onend = () => {
      clearTimeout(safetyTimer);
      isSpeechSynthesisSpeakingRef.current = false;
      (window as any).__activeUtterance = null;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startContinuousSpeechRecognition();
      resetNoAnswerTimeout();
    };

    utterance.onerror = (e) => {
      clearTimeout(safetyTimer);
      console.warn('SpeechSynthesis error:', e);
      isSpeechSynthesisSpeakingRef.current = false;
      (window as any).__activeUtterance = null;
      updateCallState('Listening...');
      if (onEnd) onEnd();
      startContinuousSpeechRecognition();
    };

    // Stagger by 50ms so Chrome audio buffer cleanly resets
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis speak failed:', err);
        clearTimeout(safetyTimer);
        isSpeechSynthesisSpeakingRef.current = false;
        updateCallState('Listening...');
        if (onEnd) onEnd();
        startContinuousSpeechRecognition();
      }
    }, 50);
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

    // Instant speech turnaround without chime latency
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

  // Helper to detect quick single-phrase answers to trigger instant sub-second turnaround
  const isQuickAnswerMatch = (text: string, step: number): boolean => {
    const lower = text.toLowerCase().trim();
    if (!lower) return false;

    // Step 0: Language selection
    if (step === 0) {
      return (
        lower.includes('tamil') ||
        lower.includes('tanglish') ||
        lower.includes('english') ||
        lower.includes('hindi') ||
        lower.includes('தமிழ்') ||
        lower.includes('हिंदी')
      );
    }

    // Step 1: Are you free?
    if (step === 1) {
      return (
        lower.includes('free') ||
        lower.includes('aama') ||
        lower.includes('ama') ||
        lower.includes('yes') ||
        lower.includes('sure') ||
        lower.includes('pesalam') ||
        lower.includes('solunga') ||
        lower.includes('solleenga') ||
        lower.includes('illa') ||
        lower.includes('illai') ||
        lower.includes('busy') ||
        lower.includes('no') ||
        lower.includes('not free') ||
        lower.includes('later') ||
        lower.includes('aprom') ||
        lower.includes('apram') ||
        lower.includes('haan') ||
        lower.includes('theek hai')
      );
    }

    // Step 2: Purpose (Buy, Rent, Plot - PDF Question 1)
    if (step === 2) {
      return (
        lower.includes('vaanga') ||
        lower.includes('vaanganum') ||
        lower.includes('buy') ||
        lower.includes('veedu') ||
        lower.includes('flat') ||
        lower.includes('house') ||
        lower.includes('vaadagai') ||
        lower.includes('rent') ||
        lower.includes('rental') ||
        lower.includes('nilam') ||
        lower.includes('plot') ||
        lower.includes('dtcp') ||
        lower.includes('வீடு') ||
        lower.includes('வாடகை') ||
        lower.includes('நிலம்') ||
        lower.includes('வாங்க')
      );
    }

    // Step 3: Area (Velachery, OMR, Tambaram, Porur, Adyar, Chengalpattu - PDF Question 2)
    if (step === 3) {
      return (
        lower.includes('velachery') ||
        lower.includes('வேளச்சேரி') ||
        lower.includes('omr') ||
        lower.includes('sholinganallur') ||
        lower.includes('சோழிங்கநல்லூர்') ||
        lower.includes('tambaram') ||
        lower.includes('தாம்பரம்') ||
        lower.includes('adyar') ||
        lower.includes('அடையார்') ||
        lower.includes('porur') ||
        lower.includes('போரூர்') ||
        lower.includes('chengalpattu') ||
        lower.includes('செங்கல்பட்டு') ||
        lower.includes('chennai') ||
        lower.includes('சென்னை')
      );
    }

    // Step 4: Size (1 BHK, 2 BHK, 3 BHK, Plot sq ft - PDF Question 3)
    if (step === 4) {
      return (
        lower.includes('1') ||
        lower.includes('2') ||
        lower.includes('3') ||
        lower.includes('bhk') ||
        lower.includes('plot') ||
        lower.includes('sq ft') ||
        lower.includes('1200') ||
        lower.includes('podhum') ||
        lower.includes('போதும்')
      );
    }

    // Step 5: Budget (PDF Question 4)
    if (step === 5) {
      return (
        lower.includes('72') ||
        lower.includes('75') ||
        lower.includes('1.25') ||
        lower.includes('1.6') ||
        lower.includes('18') ||
        lower.includes('20') ||
        lower.includes('14000') ||
        lower.includes('14,000') ||
        lower.includes('28000') ||
        lower.includes('28,000') ||
        lower.includes('30000') ||
        lower.includes('lakh') ||
        lower.includes('crore') ||
        lower.includes('kodi') ||
        lower.includes('cr') ||
        lower.includes('லட்சம்') ||
        lower.includes('கோடி')
      );
    }

    // Step 6: Move-in Timeline (PDF Question 5)
    if (step === 6) {
      return (
        lower.includes('udane') ||
        lower.includes('ready') ||
        lower.includes('1 month') ||
        lower.includes('oru maasam') ||
        lower.includes('maasathula') ||
        lower.includes('short wait') ||
        lower.includes('2026') ||
        lower.includes('உடனே') ||
        lower.includes('மாசத்துல')
      );
    }

    // Step 7: Finance (Loan or Cash - PDF Question 6)
    if (step === 7) {
      return (
        lower.includes('loan') ||
        lower.includes('cash') ||
        lower.includes('bank') ||
        lower.includes('கடன்') ||
        lower.includes('லோன்')
      );
    }

    // Step 8: Property Recommendation & Site Visit Offer (PDF Step 8)
    if (step === 8) {
      return (
        lower.includes('aama') ||
        lower.includes('paakkanum') ||
        lower.includes('yes') ||
        lower.includes('sure') ||
        lower.includes('visit') ||
        lower.includes('varalaam') ||
        lower.includes('varren') ||
        lower.includes('போகலாம்') ||
        lower.includes('ஆமா') ||
        lower.includes('பாக்கணும்')
      );
    }

    // Step 9: Visit Day (PDF Step 9)
    if (step === 9) {
      return (
        lower.includes('weekend') ||
        lower.includes('saturday') ||
        lower.includes('sunday') ||
        lower.includes('weekday') ||
        lower.includes('naalaikku') ||
        lower.includes('day') ||
        lower.includes('ஞாயிறு') ||
        lower.includes('சனி')
      );
    }

    return false;
  };

  // Immediate Customer Speech Dispatcher (Bypasses Chrome's 2.5s silence wait)
  const dispatchCustomerSpeech = (text: string) => {
    if (isTurnProcessingRef.current || isSpeechSynthesisSpeakingRef.current || !text.trim()) return;
    isTurnProcessingRef.current = true;
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
    if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
    setLiveSpeechText('');

    if (recognitionRef.current) {
      try {
        isRecognitionRunningRef.current = false;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    handleCustomerInput(text.trim());

    setTimeout(() => {
      isTurnProcessingRef.current = false;
    }, 450);
  };

  // Continuous Speech Recognition Engine with Live Streaming Transcript & Fast Debouncer
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
      if (isTurnProcessingRef.current || isSpeechSynthesisSpeakingRef.current) return;

      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }

      // If Chrome provided isFinal with content, dispatch immediately!
      if (finalTranscript && finalTranscript.trim().length > 0) {
        if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
        dispatchCustomerSpeech(finalTranscript.trim());
        return;
      }

      // Fast Interim Debounce: if user utters quick match, trigger in 220ms; else 550ms!
      if (interim && interim.trim().length > 0) {
        const trimmedInterim = interim.trim();
        setLiveSpeechText(trimmedInterim);

        const isQuick = isQuickAnswerMatch(trimmedInterim, currentStepRef.current);
        const debounceMs = isQuick ? 220 : 550;

        if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
        interimTimerRef.current = setTimeout(() => {
          if (!isTurnProcessingRef.current && !isSpeechSynthesisSpeakingRef.current && trimmedInterim.length > 0) {
            dispatchCustomerSpeech(trimmedInterim);
          }
        }, debounceMs);
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



  // ─── Free AI Telecaller Knowledge Base & In-Call Inquiries (PDF Section 5 FAQs & Section 4 Listings) ──
  const isCustomerAskingQuestion = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    if (lower.includes('?')) return true;
    if (/^(what|where|who|which|how|why|can you|could you|tell me|do you|is there|are there)\b/i.test(lower)) {
      return true;
    }
    const inquiryWords = [
      'who are you', 'who is this', 'who is calling', 'which company', 'why are you calling', 'why calling', 'purpose',
      'project', 'property', 'flat', 'apartment', 'bhk', 'villa', 'amenities', 'facing',
      'price', 'cost', 'rate', 'pricing', 'budget', 'lakh', 'crore',
      'location', 'city', 'velachery', 'omr', 'tambaram', 'chengalpattu', 'porur', 'adyar', 'chennai',
      'brochure', 'catalog', 'whatsapp', 'email', 'send me', 'floor plan',
      'site visit', 'visit', 'appointment', 'see', 'nerla',
      'registration', 'stamp duty', 'loan', 'patta', 'booking', 'documents', 'proof',
      'yaaru', 'enna', 'yenga', 'evlo', 'vilai', 'veedu', 'anuppunga', 'visith', 'nerla',
      'பதிவு', 'முத்திரை', 'லோன்', 'கடன்', 'பட்டா', 'முன்பணம்', 'சான்று', 'சொத்து'
    ];
    return inquiryWords.some((w) => lower.includes(w));
  };

  const getKnowledgeResponse = (
    input: string,
    lang: LanguageOption | null,
    step: number
  ): string => {
    const lower = input.toLowerCase();

    // 1. Registration cost / பதிவுக் கட்டணம் (PDF Section 5 FAQ 1)
    if (lower.includes('registration') || lower.includes('stamp duty') || lower.includes('பதிவு') || lower.includes('முத்திரை')) {
      if (lang === 'Tamil-English') {
        return 'முத்திரைத்தீர்வை, பதிவுக் கட்டணம் guideline value அல்லது விற்பனை விலை, இதுல எது அதிகமோ அதுக்கு கணக்கிடுவாங்க. சரியான தொகைய எங்க sales team சொல்வாங்க.';
      } else if (lang === 'Hindi') {
        return 'Stamp duty aur registration guideline value ya sale value me se jo zyada ho, uspe lagta hai. Exact amount sales team confirm karegi.';
      } else {
        return 'Stamp duty and registration are charged on guideline value or sale value, whichever is higher. The sales team will confirm the exact amount.';
      }
    }

    // 2. Loan availability / லோன் கிடைக்குமா? (PDF Section 5 FAQ 2)
    if (lower.includes('loan') || lower.includes('கடன்') || lower.includes('approval') || lower.includes('bank loan')) {
      if (lang === 'Tamil-English') {
        return 'Partner bank மூலமா கடன் உதவி பண்றோம். வருமானம், credit score பாத்து bank தான் இறுதி முடிவு பண்ணும்.';
      } else if (lang === 'Hindi') {
        return 'Hum partner banks ke through loan assist karte hain. Income aur credit score dekh kar bank hi final decision leta hai.';
      } else {
        return 'We assist with bank loans through our partner banks. The bank decides approval based on your income and credit score.';
      }
    }

    // 3. Site visit timings / Site visit எப்போ பாக்கலாம்? (PDF Section 5 FAQ 3)
    if (lower.includes('site visit') || lower.includes('timing') || lower.includes('visith') || lower.includes('எப்போ பாக்கலாம்') || lower.includes('visit time')) {
      if (lang === 'Tamil-English') {
        return 'திங்கள் முதல் சனி காலை 10 மணி முதல் மாலை 5 மணி வரை site visit பாக்கலாம். ஞாயிறு appointment மூலமா வரலாம்.';
      } else if (lang === 'Hindi') {
        return 'Site visit Somwar se Shanivar subah 10 baje se shaam 5 baje tak allowed hai. Ravivar ko appointment ke through aana hota hai.';
      } else {
        return 'Site visits are available Monday to Saturday from 10 AM to 5 PM, and Sundays by appointment.';
      }
    }

    // 4. Documents needed / என்ன documents வேணும்? (PDF Section 5 FAQ 4)
    if (lower.includes('document') || lower.includes('documents') || lower.includes('proof') || lower.includes('சான்று') || lower.includes('ஆவணம்')) {
      if (lang === 'Tamil-English') {
        return 'அடையாள அட்டை, முகவரிச் சான்று, PAN, வருமானச் சான்று (loan-க்கு), மற்றும் photos வேணும். Property documents-ஐ team மற்றும் உங்க வக்கீல் சரிபாக்கணும்.';
      } else if (lang === 'Hindi') {
        return 'ID proof, address proof, PAN card, income proof (loan ke liye), aur photos chahiye. Property documents sales team aur aapke lawyer verify karenge.';
      } else {
        return 'You will need ID proof, address proof, PAN, income proof for loans, and photos. Property title documents will be verified by our team and your lawyer.';
      }
    }

    // 5. Booking amount / Booking amount எவ்வளவு? (PDF Section 5 FAQ 5)
    if (lower.includes('booking') || lower.includes('advance') || lower.includes('முன்பணம்')) {
      if (lang === 'Tamil-English') {
        return 'பொதுவா சொத்து விலையில 1 முதல் 5 சதவீதம் booking amount இருக்கும். குறிப்பிட்ட project பொறுத்து மாறும்.';
      } else if (lang === 'Hindi') {
        return 'Aam taur par property value ka 1 se 5 percent booking amount hota hai, project ke hisaab se vary karta hai.';
      } else {
        return 'Booking amount is usually 1 to 5 percent of the property price, depending on the specific project.';
      }
    }

    // 6. Company & Office Location (PDF Section 7)
    if (
      lower.includes('who are you') || lower.includes('who is this') || lower.includes('who is calling') ||
      lower.includes('which company') || lower.includes('office') || lower.includes('company') ||
      lower.includes('yaaru') || lower.includes('நிறுவனம்')
    ) {
      if (lang === 'Tamil-English') {
        return 'நாங்க Lyka Realty. எங்க Office Anna Nagar, Chennai-ல இருக்கு. வேலை நேரம்: Mon-Sat 9:30 AM to 6:30 PM.';
      } else if (lang === 'Hindi') {
        return 'Main Lyka Realty se Priya hoon. Humara office Anna Nagar, Chennai me hai. Working hours: Mon-Sat 9:30 AM to 6:30 PM.';
      } else {
        return 'We are Lyka Realty, based in Anna Nagar, Chennai. Open Monday to Saturday, 9:30 AM to 6:30 PM.';
      }
    }

    // 7. Property Listings from PDF (Section 4)
    if (
      lower.includes('project') || lower.includes('property') || lower.includes('flat') ||
      lower.includes('apartment') || lower.includes('bhk') || lower.includes('plot') ||
      lower.includes('veedu') || lower.includes('சொத்து')
    ) {
      if (lang === 'Tamil-English') {
        return 'எங்க verified சொத்து பட்டியல்: வேளச்சேரில 2BHK flat (72L), OMR சோழிங்கநல்லூர்ல 3BHK flat (1.25 Cr), தாம்பரம்ல தனி வீடு (1.6 Cr), செங்கல்பட்டுல DTCP plot (18L), போரூர்ல 1BHK வாடகை (14,000/m), அடையார்ல 2BHK வாடகை (28,000/m). இதுல உங்களுக்கு எதுல ஆர்வம்?';
      } else if (lang === 'Hindi') {
        return 'Humare verified listings: Velachery me 2BHK flat (72L), OMR me 3BHK flat (1.25 Cr), Tambaram me individual house (1.6 Cr), Chengalpattu me DTCP plot (18L), Porur me 1BHK rent (14k/m), aur Adyar me 2BHK rent (28k/m). Aap kis me interested hain?';
      } else {
        return 'Our verified properties include: 2BHK flat in Velachery (72L), 3BHK flat in OMR (1.25 Cr), Individual house in Tambaram (1.6 Cr), DTCP plot in Chengalpattu (18L), 1BHK rental in Porur (14,000/m), and 2BHK rental in Adyar (28,000/m). Which one suits you?';
      }
    }

    // 8. Brochure / WhatsApp / Details
    if (
      lower.includes('brochure') || lower.includes('whatsapp') || lower.includes('send') ||
      lower.includes('email') || lower.includes('details') || lower.includes('அனுப்பு')
    ) {
      if (lang === 'Tamil-English') {
        return 'கண்டிப்பா! Complete property brochure, floor plans and pricing details உங்க WhatsApp-க்கு அனுப்பிடுறோம். உங்க preferred ஏரியா மற்றும் பட்ஜெட் சொல்லுங்க.';
      } else if (lang === 'Hindi') {
        return 'Zaroor! Complete brochure aur details aapke WhatsApp par share kar denge.';
      } else {
        return 'Certainly! We will share the complete property brochure and pricing directly to your WhatsApp.';
      }
    }

    // 9. Escalation / Legal / Unlisted (PDF Section 8)
    if (lang === 'Tamil-English') {
      return 'பட்டியல்ல இல்லாத property, legal கருத்து, discount எல்லாத்துக்கும் எங்க sales team மற்றும் வக்கீல் கிட்ட கேட்டு உறுதி பண்ணி சொல்றோம்.';
    } else if (lang === 'Hindi') {
      return 'Is baare me humare senior sales team aur lawyer se confirm karke aapko batayenge.';
    } else {
      return 'For legal opinions, unlisted properties, or special discounts, our senior sales team and lawyer will confirm directly with you.';
    }
  };

  const handleCustomerQuestion = (questionText: string) => {
    const activeLang = selectedLanguageRef.current;
    const activeStep = currentStepRef.current;
    const answer = getKnowledgeResponse(questionText, activeLang, activeStep);
    appendDialogue('AI', answer);
    speakAIText(answer, getVoiceLangCode());
  };

  // ─── Colloquial NLP Intent Helpers (Supports "Free" vs "Not Free" & Tanglish) ─
  const isDecliningOrBusy = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    const declineWords = [
      'not free', 'not free right now', 'no free', 'free illa', 'free illai', 'ippo free illa',
      'free nahi', 'free nahi hoon', 'busy', 'no', 'not now', 'later', 'call later', 'not available',
      'nahi', 'baad me', 'samay nahi', 'time nahi',
      'illa', 'illai', 'vendam', 'venda', 'mudiyadhu', 'neram illa', 'velai irukku', 'aprom', 'apram',
      'busy-aa', 'busy-ah', 'call pannadheenga'
    ];
    return declineWords.some((w) => lower.includes(w));
  };

  const isAgreeingOrFree = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    // Check positive agreement to "Are you free?" or interest
    const freeWords = [
      'free', 'free thaan', 'free-ah irukken', 'free ah irukken', 'i am free', 'yes free', 'haan free hoon', 'free hoon',
      'yes', 'yeah', 'sure', 'yep', 'ok', 'okay', 'interested', 'fine', 'go ahead', 'speak', 'tell me',
      'haan', 'theek hai', 'bolo', 'batayein', 'zaroor', 'ha',
      'aama', 'aamaa', 'ama', 'sari', 'pesalam', 'pesalaam', 'solunga', 'solleenga', 'pesunga', 'kandippa',
      'dharalama', 'kelunga', 'plan irukku'
    ];
    return freeWords.some((w) => lower.includes(w));
  };

  const isNotInterested = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    const coldWords = [
      'not interested', 'no interest', 'no thanks', 'not looking', 'wrong number',
      'interest nahi', 'nahi chahiye', 'nahi lena',
      'interest illa', 'interest illai', 'thevai illa', 'vendam', 'venda', 'vangala', 'idea illa', 'plan illa'
    ];
    return coldWords.some((w) => lower.includes(w)) || lower === 'no';
  };

  // STEP 0: Language Selection Prompt (Friendly Girl Persona - "Priya")
  const triggerStep0LanguagePrompt = () => {
    const promptText =
      'Hi! Good day! Naan Lyka Realty-lendhu Priya pesuren. Before we begin, ungalukku English, Hindi, illana Tamil-la pesa comfortable-ah?';
    appendDialogue('AI', promptText);
    speakAIText(promptText, 'en-IN');
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

    // Move to Step 1: Specifically ask if they are FREE! ("ask the free")
    updateCurrentStep(1);

    setTimeout(() => {
      if (lang === 'Hindi') {
        const text = 'Bahut badhiya! Kya aap abhi thoda free hain? Bas 2 minute aapse baat karni thi.';
        appendDialogue('AI', text);
        speakAIText(text, 'hi-IN');
      } else if (lang === 'Tamil-English') {
        const text = 'Super! Ippo konjam free-ah irukkeengala? Oru 2 minutes unga kooda pesa mudiyuma?';
        appendDialogue('AI', text);
        speakAIText(text, 'en-IN');
      } else {
        const text = 'Awesome! Are you free right now to talk for just a couple of minutes?';
        appendDialogue('AI', text);
        speakAIText(text, 'en-US');
      }
    }, 80);
  };

  // ─── Extractors for Knowledge Base (Property AI PDF Sections 2, 4, 6) ──────
  const parsePurpose = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('vaadagai') || lower.includes('rent') || lower.includes('rental') || lower.includes('வாடகை')) {
      return 'வாடகைக்கு வேணும் (Rent)';
    }
    if (lower.includes('nilam') || lower.includes('plot') || lower.includes('dtcp') || lower.includes('நிலம்')) {
      return 'நிலம் வாங்கணும் (Plot)';
    }
    return 'வீடு வாங்கணும் (Buy House)';
  };

  const parseLocation = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('velachery') || lower.includes('வேளச்சேரி')) return 'Velachery / வேளச்சேரி';
    if (lower.includes('omr') || lower.includes('sholinganallur') || lower.includes('சோழிங்கநல்லூர்')) return 'OMR, Sholinganallur / சோழிங்கநல்லூர்';
    if (lower.includes('tambaram') || lower.includes('தாம்பரம்')) return 'Tambaram / தாம்பரம்';
    if (lower.includes('adyar') || lower.includes('அடையார்')) return 'Adyar / அடையார்';
    if (lower.includes('porur') || lower.includes('போரூர்')) return 'Porur / போரூர்';
    if (lower.includes('chengalpattu') || lower.includes('செங்கல்பட்டு')) return 'Chengalpattu / செங்கல்பட்டு';
    return text.trim();
  };

  const parseSizeBHK = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('1') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room'))) return '1 BHK';
    if (lower.includes('2') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room'))) return '2 BHK';
    if (lower.includes('3') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room'))) return '3 BHK';
    if (lower.includes('plot') || lower.includes('sq ft') || lower.includes('1200') || lower.includes('நிலம்')) return '1200 sq ft Plot';
    if (lower.includes('house') || lower.includes('individual') || lower.includes('தனி')) return 'Individual House (3 BHK)';
    return text.trim();
  };

  const parseBudget = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('14') || lower.includes('14000') || lower.includes('14,000')) return 'Rs. 14,000 / month';
    if (lower.includes('28') || lower.includes('28000') || lower.includes('28,000') || lower.includes('30')) return 'Rs. 28,000 / month';
    if (lower.includes('18') || (lower.includes('20') && (lower.includes('lakh') || lower.includes('லட்சம்')))) return 'Rs. 18 lakh (18 லட்சம்)';
    if (lower.includes('72') || lower.includes('75') || lower.includes('70')) return 'Rs. 72 lakh (72 லட்சம்)';
    if (lower.includes('1.25') || (lower.includes('1') && lower.includes('crore'))) return 'Rs. 1.25 crore (1.25 கோடி)';
    if (lower.includes('1.6') || (lower.includes('1.5') && lower.includes('crore'))) return 'Rs. 1.6 crore (1.6 கோடி)';
    return text.trim();
  };

  const parseTimeline = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('udane') || lower.includes('ready') || lower.includes('உடனே') || lower.includes('immediate')) {
      return 'உடனே Ready-to-move';
    }
    if (lower.includes('1 month') || lower.includes('oru maasam') || lower.includes('மாசத்துல')) {
      return 'ஒரு மாசத்துல (Within 1 Month)';
    }
    return 'Dec 2026 / Short wait fine';
  };

  const parseFinance = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('cash') || lower.includes('கைப்பணம்') || lower.includes('direct')) {
      return 'Cash';
    }
    return 'Bank Loan (வங்கி கடன்)';
  };

  // Main Customer Input Parser & Flow Controller (PDF 9-Step Flow)
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

    // Check 3: If customer asks a question at ANY step (FAQs from PDF Section 5)
    if (isCustomerAskingQuestion(input)) {
      handleCustomerQuestion(input);
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

    // STEP 1: Are you free to talk check ("ask the free")
    if (activeStep === 1) {
      if (isDecliningOrBusy(input)) {
        const politeEnd =
          activeLang === 'Hindi'
            ? 'Arrey koi baat nahi, aap busy hain toh main samajh sakti hoon! Free hone ke baad connect karenge. Have a lovely day!'
            : activeLang === 'English'
            ? "Oh, no worries at all! I totally understand you're busy right now. We can connect whenever you're free. Have a wonderful day!"
            : 'அய்யோ, no problem at all! நீங்க busy-ஆ இருக்கீங்க, கண்டிப்பா புரியுது. Free ஆகும் போது பேசலாம். Have a lovely day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer was busy or not free to talk.');
        });
        return;
      } else {
        // User is free / agreed (YES) -> Continue to PDF Question 1 (Purpose)
        askQuestion(1);
        return;
      }
    }

    // STEP 2: PDF Question 1 (Purpose: வாங்கணுமா, வாடகைக்கா, நிலமா?)
    if (activeStep === 2) {
      if (isNotInterested(input)) {
        const politeEnd =
          activeLang === 'Hindi'
            ? 'Bilkul koi baat nahi! Aapka time dene ke liye shukriya. Have a great day!'
            : activeLang === 'English'
            ? 'No problem at all, I completely understand! Thanks so much for your time. Have a wonderful day!'
            : 'சரிங்க, no issues at all! உங்கள் time-க்கு ரொம்ப thanks. Have a great day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer is not interested.');
        });
        return;
      }
      const parsed = parsePurpose(input);
      updateQualification({
        purpose: parsed,
        buyerOrInvestor: parsed.includes('Rent') ? 'Tenant' : parsed.includes('Plot') ? 'Plot Buyer' : 'Home Buyer',
      });
      askQuestion(2, parsed);
      return;
    }

    // STEP 3: PDF Question 2 (Area: எந்த ஏரியால பாக்கறீங்க?)
    if (activeStep === 3) {
      const area = parseLocation(input);
      updateQualification({ location: area });
      askQuestion(3, area);
      return;
    }

    // STEP 4: PDF Question 3 (Size: எத்தனை BHK வேணும்?)
    if (activeStep === 4) {
      const size = parseSizeBHK(input);
      updateQualification({ sizeBHK: size });
      askQuestion(4, size);
      return;
    }

    // STEP 5: PDF Question 4 (Budget: உங்க பட்ஜெட் எவ்வளவு?)
    if (activeStep === 5) {
      const budget = parseBudget(input);
      updateQualification({ budget });
      askQuestion(5, budget);
      return;
    }

    // STEP 6: PDF Question 5 (Timeline: எப்போ குடிபோகணும்?)
    if (activeStep === 6) {
      const timeline = parseTimeline(input);
      updateQualification({ timeline });
      askQuestion(6, timeline);
      return;
    }

    // STEP 7: PDF Question 6 (Finance: லோன் போடப் போறீங்களா, இல்ல cash-ஆ?)
    if (activeStep === 7) {
      const finance = parseFinance(input);
      const matched = getMatchedListingFromPDF({ ...qualificationRef.current, loanOrCash: finance });
      updateQualification({
        loanOrCash: finance,
        recommendedProperty: `${matched.id} - ${matched.type} (${matched.location})`,
      });
      askQuestion(7, matched.id);
      return;
    }

    // STEP 8: PDF Property Match Recommendation & Site Visit Offer
    if (activeStep === 8) {
      const isPositive =
        lower.includes('aama') ||
        lower.includes('ama') ||
        lower.includes('yes') ||
        lower.includes('sure') ||
        lower.includes('paakkanum') ||
        lower.includes('varren') ||
        lower.includes('visit') ||
        lower.includes('ஆமா') ||
        lower.includes('பாக்கணும்') ||
        lower.includes('சரி');

      if (isPositive) {
        updateQualification({ siteVisit: 'Yes (Site Visit Requested)' });
        askQuestion(8);
      } else {
        updateQualification({ siteVisit: 'Brochure only via WhatsApp' });
        evaluateAndCompleteQualification({ ...qualificationRef.current, siteVisit: 'Brochure only via WhatsApp' });
      }
      return;
    }

    // STEP 9: PDF Step 9 (Preferred Day for Visit & Confirmation)
    if (activeStep === 9) {
      updateQualification({ siteVisit: `Yes - Preferred: ${input}` });
      evaluateAndCompleteQualification({ ...qualificationRef.current, siteVisit: `Yes - Preferred: ${input}` });
      return;
    }
  };

  const getVoiceLangCode = () => {
    if (selectedLanguageRef.current === 'Hindi') return 'hi-IN';
    if (selectedLanguageRef.current === 'Tamil-English') return 'en-IN';
    return 'en-US';
  };

  // Ask one of the Qualification Questions (Property AI Knowledge Base PDF Section 2 Flow)
  const askQuestion = (qNum: number, contextValue?: string) => {
    updateCurrentStep(qNum + 1); // maps to steps 2, 3, 4, 5, 6, 7, 8, 9
    let questionText = '';
    const activeLang = selectedLanguageRef.current;
    const customerName = lead?.name || 'சார்';
    const q = qualificationRef.current;

    // PDF Q1: Purpose (வாங்கணுமா, வாடகைக்கா, நிலமா?)
    if (qNum === 1) {
      if (activeLang === 'Hindi') {
        questionText = `Bahut shukriya ${customerName}! Aap ghar khareedna chahte hain, rent pe lena hai, ya plot khareedna hai?`;
      } else if (activeLang === 'English') {
        questionText = `Thank you so much ${customerName}! Are you looking to buy a house, rent one, or buy a plot?`;
      } else {
        questionText = `சந்தோஷம் ${customerName}! நீங்க வீடு வாங்கணுமா, வாடகைக்கு வேணுமா, இல்ல நிலம் (plot) வாங்கணுமா?`;
      }
    }

    // PDF Q2: Area (எந்த ஏரியால பாக்கறீங்க?)
    else if (qNum === 2) {
      if (activeLang === 'Hindi') {
        questionText = 'Super! Aap kaun se area me dekh rahe hain? Jaise Velachery, OMR, Tambaram, Adyar, Porur ya Chengalpattu.';
      } else if (activeLang === 'English') {
        questionText = 'Great! Which area are you looking at? For example Velachery, OMR, Tambaram, Adyar, Porur, or Chengalpattu.';
      } else {
        questionText = 'சூப்பர்! எந்த ஏரியால பாக்கறீங்க? உதாரணத்துக்கு வேளச்சேரி, OMR, தாம்பரம், போரூர், அடையார், செங்கல்பட்டு.';
      }
    }

    // PDF Q3: Size (எத்தனை BHK வேணும்? 1, 2, இல்ல 3?)
    else if (qNum === 3) {
      if (activeLang === 'Hindi') {
        questionText = 'Sahi hai. Kitne BHK chahiye? 1, 2 ya 3? Ya plot ke liye kitna sq ft?';
      } else if (activeLang === 'English') {
        questionText = 'Okay. How many BHK do you need? 1, 2, or 3? (Or how many sq ft for plots?)';
      } else {
        questionText = 'சரிங்க. எத்தனை BHK வேணும்? 1, 2, இல்ல 3? (Plot-னா எவ்வளவு sq ft?)';
      }
    }

    // PDF Q4: Budget (உங்க பட்ஜெட் எவ்வளவு?)
    else if (qNum === 4) {
      if (activeLang === 'Hindi') {
        questionText = 'Aapka approximate budget kitna hoga?';
      } else if (activeLang === 'English') {
        questionText = 'What is your approximate budget?';
      } else {
        questionText = 'உங்க பட்ஜெட் எவ்வளவு இருக்கும்?';
      }
    }

    // PDF Q5: Timeline (எப்போ குடிபோகணும்?)
    else if (qNum === 5) {
      if (activeLang === 'Hindi') {
        questionText = 'Kab tak shift hona hai? Immediate ready-to-move chahiye ya thoda wait kar sakte hain?';
      } else if (activeLang === 'English') {
        questionText = 'When do you want to move in? Should it be ready now, or is a short wait fine?';
      } else {
        questionText = 'எப்போ குடிபோகணும்? உடனே ready-ஆ இருக்கணுமா, இல்ல கொஞ்சம் நாள் ஆனாலும் பரவால்லயா?';
      }
    }

    // PDF Q6: Finance (லோன் போடப் போறீங்களா, இல்ல cash-ஆ?)
    else if (qNum === 6) {
      if (activeLang === 'Hindi') {
        questionText = 'Bank loan lenge ya cash me pay karenge?';
      } else if (activeLang === 'English') {
        questionText = 'Will you take a bank loan, or pay in cash?';
      } else {
        questionText = 'லோன் போடப் போறீங்களா, இல்ல cash-ஆ?';
      }
    }

    // PDF Step 8: Match Recommendation & Site Visit Offer (Page 3 & 6 Stories)
    else if (qNum === 7) {
      const matched = getMatchedListingFromPDF(q);
      if (activeLang === 'Hindi') {
        questionText = `${customerName}, aapke liye matching ${matched.location} me ${matched.type} (${matched.id}) available hai. Size ${matched.size}, price ${matched.price}. Notes: ${matched.notes}. Kya aap site visit ke liye aana chahenge?`;
      } else if (activeLang === 'English') {
        questionText = `${customerName}, there is a ${matched.type} (${matched.id}) in ${matched.location} that fits you! ${matched.size}, price ${matched.price}. Features: ${matched.notes}. We assist with loans through partner banks. Would you like to schedule a site visit?`;
      } else {
        if (matched.id === 'P101') {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா வேளச்சேரில 2BHK flat (P101) இருக்கு. 950 sq ft, விலை 72 லட்சம். உடனே குடிபோகலாம், 2 car parking, lift இருக்கு, MRT பக்கத்துலயே இருக்கு. லோன் உதவி partner bank மூலமா பண்ணித் தர்றோம். Site visit போய் பாக்கறீங்களா?`;
        } else if (matched.id === 'P102') {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா OMR சோழிங்கநல்லூர்ல 3BHK flat (P102) இருக்கு! 1450 sq ft, விலை 1.25 கோடி. Gym, pool, CMDA approved! Possession Dec 2026. Site visit போய் பாக்கறீங்களா?`;
        } else if (matched.id === 'P103') {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா தாம்பரம்ல தனி வீடு (P103) இருக்கு! 1800 sq ft, விலை 1.6 கோடி, East facing, 3 bedrooms, new construction. Site visit போய் பாக்கறீங்களா?`;
        } else if (matched.id === 'P104') {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா செங்கல்பட்டுல DTCP plot (P104) இருக்கு! 1200 sq ft, விலை 18 லட்சம், பட்டா clear, highway பக்கத்துல, bank loan கிடைக்கும். Site visit schedule பண்ணலாமா?`;
        } else if (matched.id === 'P105') {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா போரூர்ல 1BHK வாடகை flat (P105) இருக்கு! 550 sq ft, மாசம் 14,000 ரூபாய். Deposit 3 months. Site visit போய் பாக்கறீங்களா?`;
        } else {
          questionText = `${customerName}, உங்களுக்கு பொருத்தமா அடையார்ல 2BHK flat (P106) இருக்கு! 900 sq ft, மாசம் 28,000 ரூபாய். Family only, pets allowed. Site visit போய் பாக்கறீங்களா?`;
        }
      }
    }

    // PDF Step 9: Visit Day Schedule
    else if (qNum === 8) {
      if (activeLang === 'Hindi') {
        questionText = 'Zaroor! Site visit ke liye kaun sa din convenient hoga? This weekend aana chahenge ya weekday me?';
      } else if (activeLang === 'English') {
        questionText = 'Sure! Which day would be convenient for the site visit? Would you prefer this weekend or on a weekday?';
      } else {
        questionText = 'சரிங்க! Site visit எந்த நாள் வசதிப்படும்னு சொல்லுங்க, This Weekend வரீங்களா இல்ல Weekday-ஆ?';
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
        ? 'Haan bilkul, samajh gayi! Main turant aapka number list se remove kar deti hoon. Aage koi call nahi aayega. Thank you, have a good day!'
        : activeLang === 'English'
        ? "I completely understand! I'm removing your number from our list right away so you won't be contacted again. Thank you, have a good day!"
        : 'கண்டிப்பா, புரிஞ்சிடுச்சு! உங்க number-ஐ உடனே list-லிருந்து remove பண்ணிடுறேன். இனி disturbance இருக்காது. மிக்க நன்றி, good day!';
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
        ? 'Haan zaroor! Lyka Realty ke senior property advisor aapse jald hi direct call pe baat karenge. Thank you so much!'
        : activeLang === 'English'
        ? "Certainly! I'll have our senior property advisor connect with you directly very shortly. Thank you so much!"
        : 'நிச்சயமாக! Lyka Realty-ஓட senior property advisor உங்களுக்கு direct-ஆ சீக்கிரம் call பண்ணி பேசுவாங்க. ரொம்ப நன்றி!';
    appendDialogue('AI', agentMsg);
    speakAIText(agentMsg, getVoiceLangCode(), () => {
      finalizeCall('Completed', 'AGENT_CALLBACK', 'Customer specifically requested a senior human advisor callback.');
    });
  };

  // Requirement 10: Lead Classification & Concluding Calls (Property AI PDF Specification)
  const evaluateAndCompleteQualification = (q: typeof qualification) => {
    const activeLang = selectedLanguageRef.current;
    const matched = getMatchedListingFromPDF(q);
    const customerName = lead?.name || 'சார்';

    const summary = `Lead qualified via Property AI Knowledge Base (PDF). Name: ${customerName}, Purpose: ${q.purpose || 'Buy'}, Area: ${q.location || matched.location}, Size: ${q.sizeBHK || matched.size}, Budget: ${q.budget || matched.price}, Timeline: ${q.timeline || 'Immediate'}, Finance: ${q.loanOrCash || 'Loan'}, Matched Listing: ${matched.id} (${matched.type} - ${matched.location}), Site Visit: ${q.siteVisit || 'Requested'}.`;

    const concludingMessage =
      activeLang === 'Hindi'
        ? `Bahut badhiya ${customerName}! Maine ${matched.location} ke ${matched.id} property site visit ke saare details note kar liye hain. Humare senior sales team aapko call karke price aur availability confirm karenge. Shukriya, have a lovely day!`
        : activeLang === 'English'
        ? `Certainly ${customerName}! I have noted down your site visit request for ${matched.id} in ${matched.location}. Our sales team will call you to confirm all details, pricing, and availability. Thank you so much, have a wonderful day!`
        : `சரிங்க ${customerName}! உங்க ${matched.locationTa} ${matched.id} site visit request note பண்ணிக்கிட்டேன். எங்க sales team உங்கள கூப்பிடுவாங்க. விலை, availability எல்லாம் அவங்க உறுதி பண்ணுவாங்க. மிக்க நன்றி, have a great day!`;

    appendDialogue('AI', concludingMessage);
    speakAIText(concludingMessage, getVoiceLangCode(), () => {
      finalizeCall('Completed', 'HOT', summary);
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center space-x-1">
                  <span>👧 Priya • Free AI Telecaller</span>
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

            {/* Free AI Natural Voice Selector & Tester */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
                className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full border text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all shadow-sm"
                title="Click to select or test natural girl voices"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[160px] truncate">
                  👧 Priya:{' '}
                  {availableVoices.find((v) => v.voiceURI === selectedVoiceURI)?.name
                    .replace(/Microsoft |Google |Online \(Natural\)|\(United States\)|\(United Kingdom\)/gi, '')
                    .trim() || 'Natural Girl Voice'}
                </span>
                <ChevronDown className="w-3 h-3 text-emerald-400 opacity-70 ml-0.5" />
              </button>

              {/* Voice Picker Dropdown Modal */}
              {isVoicePickerOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Natural Girl Voices (Free AI)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => testVoiceSample()}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all flex items-center space-x-1 shadow-sm"
                    >
                      <span>🔊 Test Voice</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight">
                    Select the most natural girl voice detected in your browser:
                  </p>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 text-left">
                    {availableVoices
                      .filter((v) => getVoiceQualityScore(v) > -50)
                      .slice(0, 10)
                      .map((v) => {
                        const isSelected = v.voiceURI === selectedVoiceURI;
                        const score = getVoiceQualityScore(v);
                        const isTop = score >= 120;
                        const cleanName = v.name
                          .replace(/Microsoft |Google /g, '')
                          .replace(/\(Natural\)/g, 'Natural')
                          .trim();
                        return (
                          <button
                            key={v.voiceURI}
                            type="button"
                            onClick={() => {
                              setSelectedVoiceURI(v.voiceURI);
                              selectedVoiceURIRef.current = v.voiceURI;
                              localStorage.setItem('lyka_ai_voice_uri', v.voiceURI);
                              setIsVoicePickerOpen(false);
                              testVoiceSample(v.voiceURI);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                            }`}
                          >
                            <div className="truncate mr-2">
                              <div className="truncate font-medium flex items-center space-x-1">
                                {isTop && <span className="text-[10px]">✨</span>}
                                <span>{cleanName}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {v.lang} {isTop ? '• Ultra-Natural Human' : '• Clear Voice'}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
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
                "Hi! Good day! Naan Lyka Realty-lendhu Priya pesuren. Before we begin, ungalukku English, Hindi, illana Tamil-la pesa comfortable-ah?"
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
                  🇮🇳 Tamil / Tanglish
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
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Aama, free thaan, pesalam')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        👍 Aama, free thaan (Yes, I'm free)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Ippo free illa, konjam busy')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30"
                      >
                        ⏳ Ippo free illa (Not free right now)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Yes, I am free to talk.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        👍 Yes, I'm free to talk
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Not free, I am busy right now.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30"
                      >
                        ⏳ Not free / busy right now
                      </button>
                    </>
                  )
                )}

                {currentStep === 2 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Veedu vaanga plan irukku, flat vaanganum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        🏠 வீடு வாங்கணும் (Buy Flat/House)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Rent ku paakuren, vadagai veedu')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                      >
                        🔑 வாடகைக்கு வேணும் (Rent)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Plot vaanganum, nilam theduren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        📐 நிலம் / Plot வாங்கணும் (Plot)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Looking to buy a flat or house.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        🏠 Looking to Buy (Flat/House)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking for rental house.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                      >
                        🔑 Looking for Rent
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking to buy a plot or land.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        📐 Looking for Land / Plot
                      </button>
                    </>
                  )
                )}

                {currentStep === 3 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Velachery area la paakuren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 வேளச்சேரி (Velachery)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('OMR Sholinganallur side la venum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 OMR / சோழிங்கநல்லூர்
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Tambaram area la theduren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 தாம்பரம் (Tambaram)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Adyar location la paakuren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 அடையார் (Adyar)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Porur area la theduren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 போரூர் (Porur)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Chengalpattu side plot paakuren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 செங்கல்பட்டு (Chengalpattu)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Looking in Velachery.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 Velachery
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking along OMR Sholinganallur.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 OMR / Sholinganallur
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking in Tambaram.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 Tambaram
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking in Adyar.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 Adyar
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking in Porur.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 Porur
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Looking in Chengalpattu.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📍 Chengalpattu
                      </button>
                    </>
                  )
                )}

                {currentStep === 4 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('2 BHK venum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        🏢 2 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('3 BHK flat venum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                      >
                        🏢 3 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('1 BHK podhum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                      >
                        🏢 1 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('1200 sq ft plot theduren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        📐 1200 sq ft Plot
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('2 BHK flat')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        🏢 2 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('3 BHK flat')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                      >
                        🏢 3 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('1 BHK flat')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                      >
                        🏢 1 BHK
                      </button>
                      <button
                        onClick={() => handleCustomerInput('1200 sq ft plot')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        📐 1200 sq ft Plot
                      </button>
                    </>
                  )
                )}

                {currentStep === 5 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('En budget around 72 lakhs')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹72 Lakhs (Velachery)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('En budget 1.25 crore kulla')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹1.25 Crore (OMR)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Budget 1.6 crore irukku')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹1.6 Crore (Tambaram)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('En budget 18 lakhs kulla')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹18 Lakhs (Chengalpattu)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Rent 14000 per month kulla paakuren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹14,000 / Mo (Porur)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Rent 28000 per month budget')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹28,000 / Mo (Adyar)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Budget is around 72 Lakhs.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹72 Lakhs (Velachery)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Budget is around 1.25 Crore.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹1.25 Crore (OMR)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Budget is around 1.6 Crore.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹1.6 Crore (Tambaram)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Budget is around 18 Lakhs.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹18 Lakhs (Chengalpattu)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Rent budget is 14000 per month.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹14,000 / Mo (Rent)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Rent budget is 28000 per month.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        ₹28,000 / Mo (Rent)
                      </button>
                    </>
                  )
                )}

                {currentStep === 6 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Udane ready to move venum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        ⚡ உடனே Ready to Move
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Next 1 month kulla plan')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        ⏳ 1 மாசத்துல (Next month)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Dec 2026 konjam naal aanaalum paravaalla')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📅 Dec 2026 / Short wait ok
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Immediate ready to move.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        ⚡ Immediate / Ready
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Within 1 month.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        ⏳ Within 1 Month
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Dec 2026 possession is fine.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📅 Dec 2026 / Wait fine
                      </button>
                    </>
                  )
                )}

                {currentStep === 7 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Bank loan pottu vaanganum')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        🏦 Bank Loan போடணும்
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Direct cash payment thaan')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        💵 Direct Cash-ல Pay பண்ணுவேன்
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Planning to take a bank loan.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        🏦 Need Bank Loan
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Will pay by cash / self-funding.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                      >
                        💵 Self Funding / Cash
                      </button>
                    </>
                  )
                )}

                {currentStep === 8 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Aama, direct site visit poi paakaren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        ✅ ஆமா, Site Visit பாக்கணும்
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Brochure details WhatsApp-la anupunga')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        📱 WhatsApp-ல brochure அனுப்புங்க
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('Yes, I want to do a site visit.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        ✅ Yes, want a Site Visit
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Please send brochure details on WhatsApp.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                      >
                        📱 Send Details on WhatsApp first
                      </button>
                    </>
                  )
                )}

                {currentStep === 9 && (
                  selectedLanguage === 'Tamil-English' ? (
                    <>
                      <button
                        onClick={() => handleCustomerInput('This weekend sani yaayiru varren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        📅 This Weekend வரேன் (Sat / Sun)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('Weekday naalula vara try pandren')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📅 Weekday வரேன் (Mon - Fri)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCustomerInput('I can visit this weekend.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                      >
                        📅 This Weekend (Sat / Sun)
                      </button>
                      <button
                        onClick={() => handleCustomerInput('I will visit on a weekday.')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                      >
                        📅 Weekday (Mon - Fri)
                      </button>
                    </>
                  )
                )}</div>
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
                        {item.speaker === 'AI' ? '👧 Priya • Lyka Realty' : lead.name}
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

              {/* Qualification summary highlights (Property AI PDF Specification) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purpose</span>
                  <span className="text-white font-bold">{qualification.purpose || qualification.buyerOrInvestor || '—'}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Property Matched</span>
                  <span className="text-emerald-400 font-bold">{qualification.recommendedProperty || '—'}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Area & Budget</span>
                  <span className="text-white font-bold">
                    {qualification.location ? `${qualification.location} (${qualification.budget || '—'})` : (qualification.budget || '—')}
                  </span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Site Visit & Loan</span>
                  <span className="text-amber-300 font-bold">
                    {qualification.siteVisit ? `${qualification.siteVisit} • ${qualification.loanOrCash || 'Cash/Loan'}` : (qualification.loanOrCash || '—')}
                  </span>
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
