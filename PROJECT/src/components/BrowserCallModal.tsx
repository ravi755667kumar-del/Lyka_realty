import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  MessageSquare,
  Settings,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { Lead, LeadOutcome } from '../types';
import { saveLeadLanguage, completeBrowserCallSession } from '../services/leadService';
import {
  groqChat,
  geminiChat,
  openaiChat,
  groqSTT,
  groqTTS,
  geminiSTT,
  geminiTTS,
  openaiSTT,
  openaiTTS,
  speechifyTTS,
  cartesiaTTS,
  deepgramTTS,
  deepgramSTT,
  sarvamTTS,
  sarvamSTT,
  murfTTS,
  getGeminiConfig,
  getGroqConfig,
  getOpenAIConfig,
} from '../services/campaignService';
import {
  prepareSpeech,
  getSpeechDelivery,
  getDefaultTtsForBrain,
  SpeechEmotion,
  SpeechLanguage,
  detectCustomerEmotion,
  refineForSpeech,
} from '../lib/speech';
import { VoiceSphere3D } from './VoiceSphere3D';
import { TalkHistorySection, parseTranscriptToQAPairs } from './TalkHistorySection';


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

type TtsEngineChoice = 'cartesia' | 'deepgram' | 'speechify' | 'groq' | 'sarvam' | 'murf' | 'gemini' | 'openai' | 'browser';
type SttEngineChoice = 'browser' | 'deepgram' | 'groq' | 'sarvam' | 'gemini' | 'openai';
type BrainEngineChoice = 'gemini' | 'groq' | 'openai' | 'rules';
type VoiceGender = 'female' | 'male';
type ConversationStyle = 'engaging' | 'polite';

const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Ultra-fast sub-second telecaller response (Recommended)' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', desc: 'Flagship multimodal speed & accuracy' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', desc: 'Fast, lightweight multimodal reasoning' },
];

const GROQ_MODEL_OPTIONS = [
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Groq)', desc: 'Fast, conversational multilingual reasoning' },
  { id: 'qwen-2.5-32b', label: 'Qwen 2.5 32B (Groq)', desc: 'High accuracy Tanglish reasoning' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)', desc: 'Comprehensive reasoning model' },
];

const OPENAI_TTS_MODELS = [
  { id: 'tts-1', label: 'OpenAI tts-1', desc: 'Real-time low-latency text-to-speech (Recommended)' },
  { id: 'tts-1-hd', label: 'OpenAI tts-1-hd', desc: 'High definition studio audio quality' },
  { id: 'gpt-4o-mini-tts', label: 'OpenAI gpt-4o-mini-tts', desc: 'Next-gen generative voice synthesis' },
];

const OPENAI_TTS_VOICES = [
  { id: 'nova', label: 'Nova (Priya — Warm, Natural & Friendly 👧)', gender: 'female' },
  { id: 'shimmer', label: 'Shimmer (Priya — Clear, Upbeat & Cheerful 👧)', gender: 'female' },
  { id: 'coral', label: 'Coral (Priya — Expressive & Engaging 👧)', gender: 'female' },
  { id: 'alloy', label: 'Alloy (Neutral & Balanced 🎙️)', gender: 'neutral' },
  { id: 'onyx', label: 'Onyx (Karthik — Deep & Authoritative 👦)', gender: 'male' },
  { id: 'echo', label: 'Echo (Karthik — Smooth & Conversational 👦)', gender: 'male' },
  { id: 'ash', label: 'Ash (Karthik — Modern & Confident 👦)', gender: 'male' },
  { id: 'fable', label: 'Fable (British Accent 🇬🇧)', gender: 'neutral' },
  { id: 'sage', label: 'Sage (Calm & Soothing 🌿)', gender: 'neutral' },
];

const OPENAI_STT_MODELS = [
  { id: 'whisper-1', label: 'OpenAI Whisper-1', desc: 'Industry standard robust multilingual STT' },
  { id: 'gpt-4o-mini-transcribe', label: 'OpenAI GPT-4o Mini Transcribe', desc: 'Fast conversational audio transcription' },
  { id: 'gpt-4o-transcribe', label: 'OpenAI GPT-4o Transcribe', desc: 'Highest accuracy multimodal transcription' },
];

const OPENAI_BRAIN_MODELS = [
  { id: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini', desc: 'Sub-second fast, smart & cost-effective (Recommended)' },
  { id: 'gpt-4o', label: 'OpenAI GPT-4o', desc: 'Flagship high-intelligence multimodal model' },
  { id: 'gpt-4.1-mini', label: 'OpenAI GPT-4.1 Mini', desc: 'Latest generation efficient reasoning' },
  { id: 'gpt-4.1', label: 'OpenAI GPT-4.1', desc: 'Latest flagship frontier intelligence' },
];

function readStoredChoice<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return (val as T) || fallback;
  } catch {
    return fallback;
  }
}

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

// ─── Strict work-focus: politely redirect off-topic chit-chat (never engage) ──
const OFFTOPIC_TOPICS = [
  'joke', 'jokes', 'funny', 'cricket', 'ipl', 'movie', 'film', 'cinema', 'song', 'music',
  'politics', 'election', 'weather', 'football', 'tennis', 'recipe', 'astrology', 'horoscope',
  'raasi', 'jadhagam', 'your age', 'unga age', 'aapki age', 'girlfriend', 'boyfriend',
  'propose', 'marry', 'marriage', 'kalyanam', 'coding', 'python', 'homework', 'exam',
  'syllabus', 'chatgpt', 'birthday', 'dance', 'photo',
];

// Business words always win over the off-topic list (e.g. "I love this flat" is on-topic)
const PROPERTY_WORDS = [
  'property', 'flat', 'house', 'plot', 'land', 'bhk', 'price', 'budget', 'rent', 'buy',
  'sale', 'visit', 'location', 'velachery', 'omr', 'sholinganallur', 'tambaram', 'adyar',
  'porur', 'chengalpattu', 'crore', 'lakh', 'booking', 'loan', 'site', 'apartment',
  'veedu', 'வீடு', 'வாடகை', 'நிலம்', 'பாக்க', 'சொத்து', 'விலை',
];

const isOffTopicSmallTalk = (text: string): boolean => {
  const lower = (text || '').toLowerCase().trim();
  if (!lower || lower.length > 140) return false;
  if (PROPERTY_WORDS.some((word) => lower.includes(word))) return false;
  return OFFTOPIC_TOPICS.some((word) => lower.includes(word));
};

// Rotating polite redirects — wording changes every time so it never sounds robotic
const OFFTOPIC_REDIRECTS: Record<'English' | 'Hindi' | 'Tamil-English', string[]> = {
  English: [
    "I'm sorry, I'm here to help you with property-related queries. How can I assist you with that?",
    "That's outside my area of assistance. Let's get back to your requirements — I can help with property details, pricing, and bookings.",
    'I can help you with property details, pricing, and site-visit bookings. Shall we continue with your requirement?',
  ],
  Hindi: [
    'Maaf kijiye, main sirf property se related madad ke liye hoon. Batayein, property me kya assistance chahiye?',
    'Ye mere kaam ke area se bahar hai. Chaliye aapki requirement pe baat karein — property, price ya booking?',
    'Main property details, pricing aur site visit booking me help kar sakti hoon. Aapki requirement kya hai?',
  ],
  'Tamil-English': [
    'Sorry Sir, idhu en working area-la illa. Property details, price, booking — idhula naan full-ah help panren!',
    'Adha naan answer panna mudiyathu Sir, but property-la edhavadhu venumaa? Site visit details sollattuma?',
    'Naan property assistant dhaan Sir. Unga requirement sollunga — budget illa location?',
  ],
};

let offTopicRedirectIndex = 0;
const getNextOffTopicRedirect = (lang: LanguageOption | null): string => {
  const lines = OFFTOPIC_REDIRECTS[lang === 'Hindi' ? 'Hindi' : lang === 'Tamil-English' ? 'Tamil-English' : 'English'];
  const line = lines[offTopicRedirectIndex % lines.length];
  offTopicRedirectIndex += 1;
  return line;
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
  const [initialLanguage, setInitialLanguage] = useState<LanguageOption>('Tamil-English');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [dialogue, setDialogue] = useState<ScriptDialogue[]>([]);
  const dialogueRef = useRef<ScriptDialogue[]>([]);
  const [historyViewTab, setHistoryViewTab] = useState<'qa' | 'bubbles'>('qa');
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
  const currentAiSpeechRef = useRef<string>('');
  const lastAiSpeechEndedAtRef = useRef<number>(0);
  const lastAiSpeechTextRef = useRef<string>('');
  const turnCounterRef = useRef<number>(0);

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

  // ── Complete User Speech Collection & Smart Triggering ──────────────────────
  // 1. END_OF_TURN_SILENCE_MS = 2200ms (2.2 seconds):
  //    - Accurately captures full user answers across pauses of 0.001, 0.2, 0.5, 1, and 2 seconds.
  //    - Any resumed user speech within 2.2s resets the silence timer and continues collecting.
  //    - If the utterance ends on an incomplete thought/word, extended by INCOMPLETE_SENTENCE_EXTRA_MS (1200ms).
  // 2. INACTIVITY_DISCONNECT_MS = 8000ms (8 consecutive seconds):
  //    - If the caller remains completely silent for 8 consecutive seconds, automatically disconnects the call.
  //    - Reset whenever new user speech or VAD activity is detected.
  const END_OF_TURN_SILENCE_MS = 2200;
  const INCOMPLETE_SENTENCE_EXTRA_MS = 1200;
  const INACTIVITY_DISCONNECT_MS = 8000;

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnCommittedSpeechRef = useRef<string>(''); // Holds all committed finalized words across micro-breaks/restarts in the turn
  const userAccumulatedSpeechRef = useRef<string>('');
  const speechSessionPrefixRef = useRef<string>('');
  const [isUserPausing, setIsUserPausing] = useState<boolean>(false);
  const [turnStatusLabel, setTurnStatusLabel] = useState<string>('👂 Listening...');

  // Voice Gender Persona: 'female' (Priya) vs 'male' (Karthik) with client attraction psychology
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(() =>
    readStoredChoice('lyka_voice_gender', 'female') as VoiceGender
  );
  const voiceGenderRef = useRef<VoiceGender>(voiceGender);
  const agentName = voiceGender === 'female' ? 'Priya' : 'Karthik';
  const [conversationStyle, setConversationStyle] = useState<ConversationStyle>(() =>
    readStoredChoice('lyka_conversation_style', 'polite') as ConversationStyle
  );
  const conversationStyleRef = useRef<ConversationStyle>(conversationStyle);

  // AI Engines & Model Selectors
  const [brainEngine, setBrainEngine] = useState<BrainEngineChoice>(() => {
    const stored = readStoredChoice('lyka_brain_engine', 'gemini') as BrainEngineChoice;
    return stored === 'groq' ? 'gemini' : (stored || 'gemini');
  });
  const brainEngineRef = useRef<BrainEngineChoice>(brainEngine);

  const [ttsEngine, setTtsEngine] = useState<TtsEngineChoice>(() =>
    readStoredChoice('lyka_tts_engine', 'cartesia') as TtsEngineChoice
  );
  const ttsEngineRef = useRef<TtsEngineChoice>(ttsEngine);

  const [sttEngine, setSttEngine] = useState<SttEngineChoice>('browser');
  const sttEngineRef = useRef<SttEngineChoice>('browser');

  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(() => {
    const stored = readStoredChoice<string>('lyka_gemini_model', 'gemini-2.5-flash');
    return stored === 'gemini-3.8-flash' ? 'gemini-2.5-flash' : (stored || 'gemini-2.5-flash');
  });
  const selectedGeminiModelRef = useRef<string>(selectedGeminiModel);

  const [selectedGroqModel, setSelectedGroqModel] = useState<string>(() =>
    readStoredChoice('lyka_groq_model', 'qwen/qwen3.8-27b')
  );
  const selectedGroqModelRef = useRef<string>(selectedGroqModel);

  const [useGroqModel, setUseGroqModel] = useState<boolean>(true);
  const useGroqModelRef = useRef<boolean>(true);
  const [isGroqThinking, setIsGroqThinking] = useState<boolean>(false);
  const [isGeminiThinking, setIsGeminiThinking] = useState<boolean>(false);

  // Multi-Engine Provider Availability States (Gemini, Groq & OpenAI)
  const [groqAvailable, setGroqAvailable] = useState<boolean>(false);
  const [geminiAvailable, setGeminiAvailable] = useState<boolean>(false);
  const [openaiAvailable, setOpenaiAvailable] = useState<boolean>(false);

  // OpenAI Model & Voice Selectors
  const [selectedOpenAiTtsModel, setSelectedOpenAiTtsModel] = useState<string>(() =>
    readStoredChoice('lyka_openai_tts_model', 'tts-1')
  );
  const selectedOpenAiTtsModelRef = useRef<string>(selectedOpenAiTtsModel);

  const [selectedOpenAiVoice, setSelectedOpenAiVoice] = useState<string>(() =>
    readStoredChoice('lyka_openai_voice', 'shimmer')
  );
  const selectedOpenAiVoiceRef = useRef<string>(selectedOpenAiVoice);

  const [selectedOpenAiSttModel, setSelectedOpenAiSttModel] = useState<string>(() =>
    readStoredChoice('lyka_openai_stt_model', 'whisper-1')
  );
  const selectedOpenAiSttModelRef = useRef<string>(selectedOpenAiSttModel);

  const [selectedOpenAiBrainModel, setSelectedOpenAiBrainModel] = useState<string>(() =>
    readStoredChoice('lyka_openai_brain_model', 'gpt-4o-mini')
  );
  const selectedOpenAiBrainModelRef = useRef<string>(selectedOpenAiBrainModel);

  const [isOpenAiThinking, setIsOpenAiThinking] = useState<boolean>(false);

  // Pre-Call Engine Setup Screen vs Live In-Call Screen
  const [callPhase, setCallPhase] = useState<'setup' | 'in_call'>('setup');

  // Turn-Taking, Audio Deduplication & Mutual Exclusion Refs
  const lastDispatchedTextRef = useRef<string>('');
  const lastDispatchedTimeRef = useRef<number>(0);
  const lastCustomerEmotionRef = useRef<SpeechEmotion>('neutral');
  // Strict work-focus: consecutive off-topic turns (3 → polite close of call)
  const offTopicTurnsRef = useRef<number>(0);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const bargeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // High-Speed Startup Audio Pre-Cache (eliminates cold-start latency)
  const prefetchedGreetingRef = useRef<{
    key: string;
    audio: string;
    format: string;
    promise?: Promise<void>;
  } | null>(null);

  // For Gemini & Groq STT — MediaRecorder to capture audio chunks for upload
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);

  // Full Call Session Recording (uploaded to Supabase Storage: voice-recordings)
  const fullCallRecorderRef = useRef<MediaRecorder | null>(null);
  const fullCallChunksRef = useRef<Blob[]>([]);
  const callSessionIdRef = useRef<string>('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isRecordingCall, setIsRecordingCall] = useState<boolean>(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState<boolean>(false);


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
    if (newLang) setInitialLanguage(newLang);
  };

  const updateVoiceGender = (gender: VoiceGender) => {
    setVoiceGender(gender);
    voiceGenderRef.current = gender;
    localStorage.setItem('lyka_voice_gender', gender);
  };

  const updateConversationStyle = (style: ConversationStyle) => {
    setConversationStyle(style);
    conversationStyleRef.current = style;
    localStorage.setItem('lyka_conversation_style', style);
  };

  const updateBrainEngine = (engine: BrainEngineChoice) => {
    setBrainEngine(engine);
    brainEngineRef.current = engine;
    localStorage.setItem('lyka_brain_engine', engine);
  };

  const updateTtsEngine = (engine: TtsEngineChoice) => {
    setTtsEngine(engine);
    ttsEngineRef.current = engine;
    localStorage.setItem('lyka_tts_engine', engine);

    // When choosing TTS, automatically activate that TTS engine's female voice (Priya)
    updateVoiceGender('female');
  };

  const updateSttEngine = (engine: SttEngineChoice) => {
    setSttEngine(engine);
    sttEngineRef.current = engine;
    localStorage.setItem('lyka_stt_engine', engine);
  };

  const updateGeminiModelChoice = (model: string) => {
    setSelectedGeminiModel(model);
    selectedGeminiModelRef.current = model;
    localStorage.setItem('lyka_gemini_model', model);
  };

  const updateGroqModelChoice = (model: string) => {
    setSelectedGroqModel(model);
    selectedGroqModelRef.current = model;
    localStorage.setItem('lyka_groq_model', model);
  };

  const updateOpenAiTtsModelChoice = (model: string) => {
    setSelectedOpenAiTtsModel(model);
    selectedOpenAiTtsModelRef.current = model;
    localStorage.setItem('lyka_openai_tts_model', model);
  };

  const updateOpenAiVoiceChoice = (voice: string) => {
    setSelectedOpenAiVoice(voice);
    selectedOpenAiVoiceRef.current = voice;
    localStorage.setItem('lyka_openai_voice', voice);
  };

  const updateOpenAiSttModelChoice = (model: string) => {
    setSelectedOpenAiSttModel(model);
    selectedOpenAiSttModelRef.current = model;
    localStorage.setItem('lyka_openai_stt_model', model);
  };

  const updateOpenAiBrainModelChoice = (model: string) => {
    setSelectedOpenAiBrainModel(model);
    selectedOpenAiBrainModelRef.current = model;
    localStorage.setItem('lyka_openai_brain_model', model);
  };

  const applyPreset = (preset: string) => {
    // Automatically set female voice for all presets as requested
    updateVoiceGender('female');

    if (preset === 'ultrafast') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('cartesia'); // Ultra-low 90ms latency
      updateSttEngine('browser'); // Fast 0ms real-time speech streaming
    } else if (preset === 'openai') {
      updateBrainEngine('openai');
      updateOpenAiBrainModelChoice('gpt-4o-mini');
      updateTtsEngine('openai');
      updateOpenAiTtsModelChoice('tts-1');
      updateOpenAiVoiceChoice('nova');
      updateSttEngine('openai');
      updateOpenAiSttModelChoice('whisper-1');
    } else if (preset === 'cartesia') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('cartesia');
      updateSttEngine('browser');
    } else if (preset === 'deepgram') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('deepgram');
      updateSttEngine('deepgram');
    } else if (preset === 'speechify') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('speechify');
      updateSttEngine('browser');
    } else if (preset === 'sarvam') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('sarvam');
      updateSttEngine('sarvam');
    } else if (preset === 'murf') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('murf');
      updateSttEngine('browser');
    } else if (preset === 'groq') {
      updateBrainEngine('groq');
      updateTtsEngine('groq');
      updateSttEngine('groq');
    } else if (preset === 'gemini') {
      updateBrainEngine('gemini');
      updateGeminiModelChoice('gemini-2.5-flash');
      updateTtsEngine('gemini');
      updateSttEngine('gemini');
    } else if (preset === 'free') {
      updateBrainEngine('rules');
      updateTtsEngine('browser');
      updateSttEngine('browser');
    }
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

  const isMaleVoiceName = (name: string): boolean => {
    const lower = name.toLowerCase();
    const maleNames = ['male', 'david', 'george', 'ravi', 'mark', 'guy', 'stefan', 'james', 'richard', 'daniel', 'sean', 'paul', 'prabhat', 'karthik', 'madhur', 'andrew', 'brian'];
    return maleNames.some((m) => lower.includes(m));
  };

  const isFemaleVoiceName = (name: string): boolean => {
    const lower = name.toLowerCase();
    const femaleNames = ['female', 'girl', 'woman', 'kavya', 'pooja', 'anushka', 'sangeeta', 'veena', 'neerja', 'swara', 'jenny', 'aria', 'emma', 'ava', 'samantha', 'zira', 'heera'];
    return femaleNames.some((f) => lower.includes(f));
  };

  // Voice Quality Scorer: Ranks natural voices for active gender (Girl "Priya" / Boy "Karthik")
  const getVoiceQualityScore = (voice: SpeechSynthesisVoice, targetGender: VoiceGender = voiceGenderRef.current): number => {
    const name = (voice.name || '').toLowerCase();
    const lang = (voice.lang || '').toLowerCase();
    let score = 0;

    if (targetGender === 'female' && isMaleVoiceName(name)) return -100;
    if (targetGender === 'male' && isFemaleVoiceName(name)) return -100;

    // Heavy penalty for old robotic desktop SAPI 5 synthesizers
    if (name.includes('desktop') && !name.includes('natural')) {
      score -= 80;
    }

    // Tier 1: Natural / Online Neural voices (Azure & Edge neural voices)
    if (name.includes('natural') || name.includes('online') || name.includes('neural')) {
      score += 180;
    }

    // Tier 2: Google Studio voices (in Chrome)
    if (name.includes('google')) {
      score += 140;
    }

    // Indian accent voices
    if (lang.includes('in')) {
      score += 80;
    }

    return score;
  };

  // Test audio voice sample preview for active persona and TTS engine
  const testVoiceSample = (voiceURI?: string, genderOverride?: VoiceGender) => {
    if (genderOverride && genderOverride !== voiceGenderRef.current) {
      updateVoiceGender(genderOverride);
    }
    const activeGender = genderOverride || voiceGenderRef.current;
    const testName = activeGender === 'male' ? 'Karthik' : 'Priya';
    const lang = selectedLanguageRef.current || initialLanguage || 'Tamil-English';

    const testText =
      lang === 'Tamil-English'
        ? `Vanakkam! Naan Lyka Realty-la irundhu ${testName} pesaren. En voice ungalukku natural-a thuliyama kekudhaa?`
        : lang === 'Hindi'
        ? (activeGender === 'male'
            ? `Namaste! Main Lyka Realty se ${testName} baat kar raha hoon. Kya meri aawaaz saaf aur natural lag rahi hai?`
            : `Namaste! Main Lyka Realty se ${testName} baat kar rahi hoon. Kya meri aawaaz saaf aur natural lag rahi hai?`)
        : `Hello! This is ${testName} from Lyka Realty. How does my natural voice sound to you?`;

    speakAIText(testText, lang === 'Hindi' ? 'hi-IN' : lang === 'Tamil-English' ? 'ta-IN' : 'en-US');
  };

  // Preload and rank speech synthesis voices for active gender persona
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadAndRankVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const sorted = [...voices].sort((a, b) => getVoiceQualityScore(b) - getVoiceQualityScore(a));
          setAvailableVoices(sorted);

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

  // Check Multi-Provider API availability on mount (Gemini, Groq, OpenAI)
  const refreshProviderConfigs = useCallback(() => {
    getGroqConfig()
      .then((cfg) => setGroqAvailable(Boolean(cfg?.apiKeyConfigured)))
      .catch(() => setGroqAvailable(false));

    getGeminiConfig()
      .then((cfg) => setGeminiAvailable(Boolean(cfg?.apiKeyConfigured)))
      .catch(() => setGeminiAvailable(false));

    getOpenAIConfig()
      .then((cfg) => setOpenaiAvailable(Boolean(cfg?.apiKeyConfigured)))
      .catch(() => setOpenaiAvailable(false));
  }, []);

  useEffect(() => {
    refreshProviderConfigs();
    const handleSettingsUpdated = () => refreshProviderConfigs();
    window.addEventListener('lyka-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('lyka-settings-updated', handleSettingsUpdated);
  }, [refreshProviderConfigs]);

  // Re-verify provider configs whenever the call modal is opened!
  useEffect(() => {
    if (isOpen) {
      refreshProviderConfigs();
    }
  }, [isOpen, refreshProviderConfigs]);

  // Fast, natural telecaller greeting helper following Lyka_Realty_Tanglish_Priya_Agent_Script_v2_Name_and_Pauses.pdf
  const getOpeningGreetingPrompt = (
    lang: string,
    leadHonorific: string,
    name: string = agentName,
    gender: VoiceGender = voiceGenderRef.current
  ): { text: string; langCode: string } => {
    const hasKnownName = Boolean(lead?.name && lead.name.trim().length > 1 && !lead.name.toLowerCase().includes('lead') && !lead.name.toLowerCase().includes('customer'));
    const cleanLeadName = hasKnownName ? lead!.name.trim() : '';

    if (lang === 'Hindi') {
      const verb = gender === 'male' ? 'bol raha hoon' : 'bol rahi hoon';
      if (cleanLeadName) {
        return {
          text: `[happy] Namaste ${cleanLeadName} ji! Main Lyka Realty se ${name} ${verb}. Kaise hain aap?`,
          langCode: 'hi-IN',
        };
      }
      return {
        text: `[happy] Namaste! Main Lyka Realty se ${name} ${verb}. Kaise hain aap?`,
        langCode: 'hi-IN',
      };
    }
    if (lang === 'English') {
      if (cleanLeadName) {
        return {
          text: `[happy] Hello ${cleanLeadName}! This is ${name} from Lyka Realty. How are you doing today?`,
          langCode: 'en-US',
        };
      }
      return {
        text: `[happy] Hello! This is ${name} from Lyka Realty. How are you doing today?`,
        langCode: 'en-US',
      };
    }
    // Tanglish Priya: Natural Tanglish Property Conversation Guide (v14 PDF)
    if (cleanLeadName) {
      return {
        text: `[happy] Hi! How are you ${cleanLeadName}? Naan ${name}, Lyka Realty-lendhu pesuren!`,
        langCode: 'ta-IN',
      };
    }
    return {
      text: `[happy] Hi! How are you? Eppadi irukkeenga! Naan ${name}, Lyka Realty-lendhu pesuren!`,
      langCode: 'ta-IN',
    };
  };

  // Helper to determine the effective TTS engine (resolves 'auto' to preferred provider)
  const resolveCurrentTtsEngine = (_activeLang?: string): TtsEngineChoice => {
    return ttsEngineRef.current || 'gemini';
  };

  // Pre-synthesis engine dispatcher: ensures each API pre-synthesizes with its own native voice
  const synthesizeAudioForEngine = async (
    engine: TtsEngineChoice,
    text: string,
    langCode: string,
    activeLang: LanguageOption | string
  ): Promise<{ audio: string; format: string }> => {
    const isTamil = activeLang === 'Tamil-English';
    const prepared = prepareSpeech(text, {
      language: isTamil ? 'ta-IN' : langCode,
      emotion: 'neutral',
    });

    if (engine === 'gemini') {
      const res = await geminiTTS({
        text: prepared.text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/wav' };
    }

    if (engine === 'groq') {
      const res = await groqTTS({
        text: prepared.text,
        voice: voiceGenderRef.current === 'male' ? 'daniel' : 'diana',
        speed: prepared.delivery.pace,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/wav' };
    }

    if (engine === 'speechify') {
      const isMale = voiceGenderRef.current === 'male';
      const voice = isTamil ? (isMale ? 'aadi' : 'abirami') : (isMale ? 'alton' : 'geffen_32');
      const res = await speechifyTTS({
        text: prepared.text,
        voice,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/mp3' };
    }

    if (engine === 'cartesia') {
      const res = await cartesiaTTS({
        text: prepared.text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/wav' };
    }

    if (engine === 'deepgram') {
      const res = await deepgramTTS({
        text: prepared.text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/mp3' };
    }

    if (engine === 'sarvam') {
      const res = await sarvamTTS({
        text: prepared.text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      return { audio: res.audio, format: res.format || 'audio/wav' };
    }

    if (engine === 'murf') {
      const res = await murfTTS({
        text: prepared.text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
      });
      if (res.audioUrl) {
        try {
          const audioFetch = await fetch(res.audioUrl);
          const arrayBuf = await audioFetch.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(arrayBuf);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          return { audio: base64, format: res.format || 'audio/mp3' };
        } catch {
          // If fetch fails, return empty to fall back to stream URL
        }
      }
    }

    if (engine === 'openai') {
      const isMale = voiceGenderRef.current === 'male';
      const voice = selectedOpenAiVoiceRef.current || (isMale ? 'onyx' : 'nova');
      const res = await openaiTTS({
        text: prepared.text,
        voice,
        model: selectedOpenAiTtsModelRef.current,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: 'neutral',
        speed: prepared.delivery.pace,
      });
      return { audio: res.audio, format: res.format || 'audio/mp3' };
    }

    throw new Error(`Engine ${engine} does not support audio pre-synthesis.`);
  };

  // Initialize browser call setup screen & pre-synthesize greeting for zero-latency start with the selected agent!
  useEffect(() => {
    if (isOpen && lead) {
      setCallPhase('setup');

      const honorific = lead?.name ? ` ${lead.name} Sir` : ' Sir';
      const activeLang = selectedLanguageRef.current || initialLanguage || 'Tamil-English';
      const greeting = getOpeningGreetingPrompt(activeLang, honorific, agentName, voiceGenderRef.current);
      const isTamil = activeLang === 'Tamil-English';
      const prepared = prepareSpeech(greeting.text, { language: isTamil ? 'ta-IN' : greeting.langCode, emotion: 'neutral' });
      const targetEngine = resolveCurrentTtsEngine(activeLang);

      if (targetEngine !== 'browser') {
        const cacheKey = `${targetEngine}:${voiceGenderRef.current}:${isTamil ? 'ta-IN' : prepared.languageCode}:${prepared.text}`;

        if (!prefetchedGreetingRef.current || prefetchedGreetingRef.current.key !== cacheKey) {
          const fetchPromise = synthesizeAudioForEngine(targetEngine, greeting.text, greeting.langCode, activeLang)
            .then(({ audio, format }) => {
              if (audio) {
                prefetchedGreetingRef.current = {
                  key: cacheKey,
                  audio,
                  format: format || 'audio/wav',
                };
                console.log(`[Fast Startup] Pre-synthesized opening audio ready for ${targetEngine.toUpperCase()} agent!`);
              }
            })
            .catch((err) => {
              console.warn(`[Fast Startup] Preload failed for ${targetEngine}, will synthesize on demand:`, err);
            });

          prefetchedGreetingRef.current = {
            key: cacheKey,
            audio: '',
            format: 'audio/wav',
            promise: fetchPromise,
          };
        }
      }
    }
    return () => {
      cleanupAudioSession();
    };
  }, [isOpen, lead?.id, voiceGender, ttsEngine, brainEngine]);

  const cleanupAudioSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    userAccumulatedSpeechRef.current = '';
    turnCommittedSpeechRef.current = '';
    speechSessionPrefixRef.current = '';
    setIsUserPausing(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (bargeInTimerRef.current) { clearTimeout(bargeInTimerRef.current); bargeInTimerRef.current = null; }
    isTurnProcessingRef.current = false;
    currentAiSpeechRef.current = '';
    turnCounterRef.current++;
    lastDispatchedTextRef.current = '';
    lastDispatchedTimeRef.current = 0;

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

    // Stop Remote and Sarvam Audio if playing
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.src = '';
      } catch (e) { /* ignore */ }
      remoteAudioRef.current = null;
    }
    // Stop Server STT recording
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


  // Start real-time audio volume visualizer with Voice-Isolation DSP filter chain
  const startAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        try { audioCtx.resume(); } catch (e) { /* ignore */ }
      }
      const source = audioCtx.createMediaStreamSource(stream);

      // 1. Highpass filter: cuts sub-bass rumble, laptop fan hum, AC rumble (< 180 Hz)
      const highpass = audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 180;
      highpass.Q.value = 0.7;

      // 2. Peaking filter: boosts human speech presence & headphone/close-mic vocal clarity (1.5 kHz - 3.5 kHz)
      const voicePresence = audioCtx.createBiquadFilter();
      voicePresence.type = 'peaking';
      voicePresence.frequency.value = 2400; // Human vocal presence peak
      voicePresence.Q.value = 1.0;
      voicePresence.gain.value = 4.0; // +4dB boost for direct human speech

      // 3. Lowpass filter: cuts ultra-high ambient hiss and room reflections (> 4200 Hz)
      const lowpass = audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 4200;
      lowpass.Q.value = 0.7;

      // Connect filter DSP chain: source -> highpass -> voicePresence -> lowpass
      source.connect(highpass);
      highpass.connect(voicePresence);
      voicePresence.connect(lowpass);

      // 4. Connect to Analyser for voice activity detection (VAD)
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // 128 bins for high frequency resolution
      analyser.smoothingTimeConstant = 0.3;
      lowpass.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const sampleRate = audioCtx.sampleRate || 48000;
      const binWidth = sampleRate / (analyser.frequencyBinCount * 2);
      const minVocalBin = Math.max(1, Math.floor(280 / binWidth));
      const maxVocalBin = Math.min(dataArray.length - 1, Math.ceil(3600 / binWidth));

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate vocal-band specific energy (ignores background fan & rumble)
        let vocalSum = 0;
        let vocalCount = 0;
        for (let i = minVocalBin; i <= maxVocalBin; i++) {
          vocalSum += dataArray[i];
          vocalCount++;
        }
        const vocalAvg = vocalCount > 0 ? vocalSum / vocalCount : 0;
        const normalized = Math.min(100, Math.round(vocalAvg * 2.2));
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
    updateCurrentStep(1);
    const activeStartLang = initialLanguage || selectedLanguageRef.current || 'Tamil-English';
    updateSelectedLanguage(activeStartLang);
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
    callSessionIdRef.current = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setRecordedAudioUrl(null);

    // 1. Parallel Non-Blocking Microphone Setup (runs concurrently without blocking speech start)
    navigator.mediaDevices
      ?.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1, // Mono channel to eliminate spatial background summing
          sampleRate: { ideal: 48000 },
          ...({ voiceIsolation: { ideal: true } } as any),
        } as MediaTrackConstraints,
      })
      .then((stream) => {
        mediaStreamRef.current = stream;
        setMicActive(true);
        startAudioMeter(stream);

        // Start real-time call recording (uploaded to Supabase Storage: voice-recordings)
        try {
          fullCallChunksRef.current = [];
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
          const fullRec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
          fullCallRecorderRef.current = fullRec;
          fullRec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              fullCallChunksRef.current.push(e.data);
            }
          };
          fullRec.start(1000);
          setIsRecordingCall(true);
        } catch (recStartErr) {
          console.warn('[Call Recording] Failed to start session recorder:', recStartErr);
        }
      })
      .catch((err: any) => {
        console.warn('Microphone permission not granted:', err);
        setErrorMessage(
          'Microphone access is needed for voice recognition. Please allow microphone permission in your browser or use the on-screen options.'
        );
      });

    // 2. Connect immediately without arbitrary delays!
    updateCallState('Connected');
    triggerStep0LanguagePrompt();
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

  // ── Unified Audio Playback Done Handler ──────────────────────────────────
  const onAudioPlaybackDone = (onEnd?: () => void) => {
    isSpeechSynthesisSpeakingRef.current = false;
    isTurnProcessingRef.current = false; // Turn finished!
    lastAiSpeechEndedAtRef.current = Date.now();
    lastAiSpeechTextRef.current = currentAiSpeechRef.current;
    updateCallState('Listening...');
    if (onEnd) onEnd();

    // Start STT immediately with ZERO delay — no artificial timeout delay!
    if (
      callStateRef.current === 'Listening...' &&
      !isSpeechSynthesisSpeakingRef.current &&
      !isTurnProcessingRef.current
    ) {
      startContinuousSpeechRecognition();
    }

    resetNoAnswerTimeout();
  };

  const reportTtsFailure = (
    providerName: string,
    error: unknown,
    onEnd?: () => void,
    fallbackText?: string,
    fallbackLang?: string
  ) => {
    const details = error instanceof Error ? error.message : 'The provider could not generate audio.';
    console.warn(`[TTS] ${providerName} voice failed (${details}). Seamlessly speaking with built-in voice.`);
    setErrorMessage(`⚠️ ${providerName} voice unavailable: ${details}. Continuing with system voice.`);
    if (fallbackText) {
      speakWithBrowserTTS(fallbackText, fallbackLang || 'en-IN', onEnd);
    } else {
      onAudioPlaybackDone(onEnd);
    }
  };

  // ── Barge-In / Interruption Handler ─────────────────────────────────────
  // Stops AI audio immediately when the user speaks over the agent
  const handleBargeIn = useCallback(() => {
    if (!isSpeechSynthesisSpeakingRef.current) return;
    console.log('[BargeIn] User interrupted — stopping AI audio immediately');
    currentAiSpeechRef.current = '';

    // Cancel browser TTS
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    // Stop remote (Sarvam, ElevenLabs, Murf, Gemini TTS) audio
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.src = '';
      } catch (e) { /* ignore */ }
      remoteAudioRef.current = null;
    }
    isSpeechSynthesisSpeakingRef.current = false;
    isTurnProcessingRef.current = false;
    setIsGeminiThinking(false);
    setIsGroqThinking(false);
    setIsOpenAiThinking(false);
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    userAccumulatedSpeechRef.current = '';
    turnCommittedSpeechRef.current = '';
    speechSessionPrefixRef.current = '';
    setIsUserPausing(false);
    updateCallState('Listening...');
    resetInactivityDisconnectTimer();

    // If browser recognition is already active, keep it running smoothly without restarting
    // so the customer's full question is captured with zero missing words!
    if (!isRecognitionRunningRef.current) {
      startContinuousSpeechRecognition();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up any pending barge-in timers
  useEffect(() => {
    if (!isSpeechSynthesisSpeakingRef.current && bargeInTimerRef.current) {
      clearTimeout(bargeInTimerRef.current);
      bargeInTimerRef.current = null;
    }
  }, [micAudioLevel]);

  // Play Base64 Audio (WAV from Sarvam, MP3 from ElevenLabs / Murf)
  const playAudioFromBase64 = (
    base64Data: string,
    mimeType: string = 'audio/wav',
    onEnd?: () => void,
    fallbackText?: string,
    fallbackLang?: string,
    providerName?: string
  ) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
    if (remoteAudioRef.current) {
      const previousAudio = remoteAudioRef.current;
      remoteAudioRef.current = null;
      try {
        previousAudio.pause();
        previousAudio.src = '';
      } catch (e) { /* ignore */ }
    }
    const audio = new Audio(`data:${mimeType};base64,${base64Data}`);
    audio.volume = 1.0;
    // Fast phone telecaller playback rate (1.10x) for joyful, engaging pacing
    audio.playbackRate = 1.10;
    remoteAudioRef.current = audio;
    let playbackSettled = false;
    const handlePlaybackError = (reason: unknown) => {
      if (playbackSettled || remoteAudioRef.current !== audio) return;
      playbackSettled = true;
      remoteAudioRef.current = null;
      audio.pause();
      audio.src = '';
      console.warn('[Remote Audio] Playback failed:', reason);
      if (fallbackText) {
        speakWithBrowserTTS(fallbackText, fallbackLang || 'en-IN', onEnd);
      } else {
        if (providerName) {
          setErrorMessage(`${providerName} audio could not be played. Check the provider response and try again.`);
        }
        onAudioPlaybackDone(onEnd);
      }
    };
    audio.onended = () => {
      if (playbackSettled || remoteAudioRef.current !== audio) return;
      playbackSettled = true;
      remoteAudioRef.current = null;
      onAudioPlaybackDone(onEnd);
    };
    audio.onerror = () => {
      handlePlaybackError('audio element error');
    };
    audio.play().catch((e) => {
      handlePlaybackError(e);
    });
  };

  // Play Audio from direct URL (e.g. Murf AI S3 audioFile)
  const playAudioFromUrl = (
    url: string,
    onEnd?: () => void,
    fallbackText?: string,
    fallbackLang?: string,
    providerName?: string
  ) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
    if (remoteAudioRef.current) {
      const previousAudio = remoteAudioRef.current;
      remoteAudioRef.current = null;
      try {
        previousAudio.pause();
        previousAudio.src = '';
      } catch (e) { /* ignore */ }
    }
    const audio = new Audio(url);
    audio.volume = 1.0;
    remoteAudioRef.current = audio;
    let playbackSettled = false;
    const handlePlaybackError = (reason: unknown) => {
      if (playbackSettled || remoteAudioRef.current !== audio) return;
      playbackSettled = true;
      remoteAudioRef.current = null;
      audio.pause();
      audio.src = '';
      console.warn('[Remote Audio] URL playback failed:', reason);
      if (fallbackText) {
        speakWithBrowserTTS(fallbackText, fallbackLang || 'en-IN', onEnd);
      } else {
        if (providerName) {
          setErrorMessage(`${providerName} audio could not be played. Check the provider response and try again.`);
        }
        onAudioPlaybackDone(onEnd);
      }
    };
    audio.onended = () => {
      if (playbackSettled || remoteAudioRef.current !== audio) return;
      playbackSettled = true;
      remoteAudioRef.current = null;
      onAudioPlaybackDone(onEnd);
    };
    audio.onerror = () => {
      handlePlaybackError('audio element error');
    };
    audio.play().catch((e) => {
      handlePlaybackError(e);
    });
  };

  // Speak AI text via SpeechSynthesis with natural voice based on active gender (Girl "Priya" / Boy "Karthik")
  const speakWithBrowserTTS = (text: string, langCode: string, onEnd?: () => void) => {
    currentAiSpeechRef.current = text;
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.src = '';
      } catch (e) { /* ignore */ }
      remoteAudioRef.current = null;
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

    // Use native Tamil code for Tamil/Tanglish when available, fallback to en-IN
    let effectiveLangCode = langCode;
    if (selectedLanguageRef.current === 'Tamil-English' || langCode.startsWith('ta')) {
      effectiveLangCode = 'ta-IN';
    }

    const isMale = voiceGenderRef.current === 'male';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = effectiveLangCode;
    utterance.volume = 1.0;
    // Radiant, attractive, happy tone pitch
    utterance.pitch = isMale ? 1.02 : 1.16;
    // Energetic, attractive phone telecaller rate (1.10x)
    utterance.rate = 1.10;

    const voices = window.speechSynthesis.getVoices();
    let chosenVoice: SpeechSynthesisVoice | undefined;

    const activeURI = selectedVoiceURIRef.current;
    if (activeURI) {
      const candidate = voices.find((v) => v.voiceURI === activeURI);
      if (candidate && getVoiceQualityScore(candidate, voiceGenderRef.current) > 0) {
        chosenVoice = candidate;
      }
    }

    if (!chosenVoice) {
      const genderCandidates = [...voices]
        .filter((v) => (isMale ? !isFemaleVoiceName(v.name) : !isMaleVoiceName(v.name)))
        .sort((a, b) => getVoiceQualityScore(b, voiceGenderRef.current) - getVoiceQualityScore(a, voiceGenderRef.current));
      chosenVoice =
        genderCandidates.find((v) => v.lang.startsWith(effectiveLangCode.substring(0, 2)) && getVoiceQualityScore(v, voiceGenderRef.current) > 0) ||
        genderCandidates.find((v) => getVoiceQualityScore(v, voiceGenderRef.current) > 0) ||
        genderCandidates[0] ||
        voices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    (window as any).__activeUtterance = utterance;

    const safetyTimeoutMs = Math.max(8000, text.length * 120 + 4000);
    const safetyTimer = setTimeout(() => {
      if (isSpeechSynthesisSpeakingRef.current) {
        console.warn('[SpeechSynthesis] Safety fallback recovered voice state');
        isSpeechSynthesisSpeakingRef.current = false;
        (window as any).__activeUtterance = null;
        onAudioPlaybackDone(onEnd);
      }
    }, safetyTimeoutMs);

    utterance.onend = () => {
      clearTimeout(safetyTimer);
      (window as any).__activeUtterance = null;
      onAudioPlaybackDone(onEnd);
    };

    utterance.onerror = (e) => {
      clearTimeout(safetyTimer);
      console.warn('SpeechSynthesis error:', e);
      (window as any).__activeUtterance = null;
      onAudioPlaybackDone(onEnd);
    };

    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis speak failed:', err);
        clearTimeout(safetyTimer);
        onAudioPlaybackDone(onEnd);
      }
    }, 50);
  };

  // ── Master speakAIText: uses the selected provider and falls back to browser speech ────────
  const speakAIText = (rawText: string, langCode: string, onEnd?: () => void) => {
    // 1. Forcefully cancel any currently active audio streams to eliminate duplicate voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.src = '';
      } catch (e) { /* ignore */ }
      remoteAudioRef.current = null;
    }
    // If non-browser STT is active, pause browser recognition; otherwise ensure it is actively listening for instant user barge-in!
    if (sttEngineRef.current !== 'browser') {
      if (recognitionRef.current) {
        try {
          isRecognitionRunningRef.current = false;
          recognitionRef.current.stop();
        } catch (e) { /* ignore */ }
      }
    } else {
      if (!isRecognitionRunningRef.current) {
        startContinuousSpeechRecognition();
      }
    }

    const prepared = prepareSpeech(rawText, {
      language: selectedLanguageRef.current || langCode,
      emotion: lastCustomerEmotionRef.current,
    });
    const text = prepared.text;
    currentAiSpeechRef.current = text;

    updateCallState('AI Speaking...');
    isSpeechSynthesisSpeakingRef.current = true;

    const currentTts = resolveCurrentTtsEngine(selectedLanguageRef.current || 'English');

    // 1. Gemini Voice (Kore — Multimodal Female Voice)
    if (currentTts === 'gemini') {
      geminiTTS({
        text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setGeminiAvailable(true);
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Gemini');
        })
        .catch((error) => {
          console.warn('[Gemini TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Gemini voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 2. Groq Voice (Diana / Autumn)
    if (currentTts === 'groq') {
      const voice = voiceGenderRef.current === 'male' ? 'daniel' : 'diana';
      groqTTS({
        text,
        voice,
        speed: prepared.delivery.pace,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setGroqAvailable(true);
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Groq');
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn('[Groq TTS] Voice failed, auto-falling back to Browser voice:', error);
          if (msg.includes('model_terms_required') || msg.includes('terms')) {
            setErrorMessage('⚠️ Groq Orpheus terms required on console.groq.com. Speaking with system voice.');
          } else {
            setErrorMessage('⚠️ Groq voice unavailable. Speaking with system voice.');
          }
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 3. Speechify Voice (Abirami / Aaliya / Simba-3.5)
    if (currentTts === 'speechify') {
      const isMale = voiceGenderRef.current === 'male';
      let speechifyVoice = isMale ? 'aadi' : 'abirami';
      if (selectedLanguageRef.current === 'Hindi') {
        speechifyVoice = isMale ? 'aadi' : 'aaliya';
      } else if (selectedLanguageRef.current === 'English') {
        speechifyVoice = isMale ? 'alton' : 'geffen_32';
      }

      speechifyTTS({
        text,
        voice: speechifyVoice,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Speechify');
        })
        .catch((error) => {
          console.warn('[Speechify TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Speechify voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 4. Cartesia Voice (Sonic 3.5 — 90ms Ultra-Low Latency)
    if (currentTts === 'cartesia') {
      cartesiaTTS({
        text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Cartesia');
        })
        .catch((error) => {
          console.warn('[Cartesia TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Cartesia voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 5. Deepgram Voice (Aura-2 — 140ms Conversational)
    if (currentTts === 'deepgram') {
      deepgramTTS({
        text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Deepgram');
        })
        .catch((error) => {
          console.warn('[Deepgram TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Deepgram voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 6. Sarvam Voice (Bulbul v3 — Native Indian Voice)
    if (currentTts === 'sarvam') {
      sarvamTTS({
        text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audio, format }) => {
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'Sarvam');
        })
        .catch((error) => {
          console.warn('[Sarvam TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Sarvam voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 7. Murf AI Voice (Falcon-2.1 / GEN2 Studio Quality)
    if (currentTts === 'murf') {
      murfTTS({
        text,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
      })
        .then(({ audioUrl }) => {
          setErrorMessage(null);
          playAudioFromUrl(audioUrl, onEnd, text, langCode, 'Murf');
        })
        .catch((error) => {
          console.warn('[Murf TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ Murf voice unavailable. Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 8. OpenAI Voice (Nova / Shimmer / Onyx / Echo / tts-1 / tts-1-hd)
    if (currentTts === 'openai') {
      const isMale = voiceGenderRef.current === 'male';
      const voice = selectedOpenAiVoiceRef.current || (isMale ? 'onyx' : 'nova');
      openaiTTS({
        text,
        voice,
        model: selectedOpenAiTtsModelRef.current,
        gender: voiceGenderRef.current,
        language: prepared.language,
        emotion: prepared.emotion,
        speed: prepared.delivery.pace,
      })
        .then(({ audio, format }) => {
          setOpenaiAvailable(true);
          setErrorMessage(null);
          playAudioFromBase64(audio, format, onEnd, text, langCode, 'OpenAI');
        })
        .catch((error) => {
          console.warn('[OpenAI TTS] Voice failed, auto-falling back to Browser voice:', error);
          setErrorMessage('⚠️ OpenAI voice unavailable (check credit balance). Speaking with system voice.');
          speakWithBrowserTTS(text, langCode, onEnd);
        });
      return;
    }

    // 9. Browser SpeechSynthesis (Free Client-side Voice)
    speakWithBrowserTTS(text, langCode, onEnd);
  };



  // ── Voice Activity Detection (VAD) Helper (Human Vocal Frequencies Only) ──
  const isMicVADActive = (): boolean => {
    if (!analyserRef.current) return false;
    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const sampleRate = audioContextRef.current?.sampleRate || 48000;
      const binWidth = sampleRate / (dataArray.length * 2);
      const minVocalBin = Math.max(1, Math.floor(280 / binWidth));
      const maxVocalBin = Math.min(dataArray.length - 1, Math.ceil(3600 / binWidth));

      let sum = 0;
      let count = 0;
      for (let i = minVocalBin; i <= maxVocalBin; i++) {
        sum += dataArray[i];
        count++;
      }
      const vocalAvg = count > 0 ? sum / count : 0;
      return vocalAvg > 9;
    } catch (e) {
      return false;
    }
  };

  // ── Tanglish / Tamil Real Estate Speech Normalizer ────────────────────────
  // Accurately maps Tamil Unicode script & Chrome acoustic misrecognitions
  // into clean, natural Tanglish / English words so the UI and AI always write
  // EXACTLY what the user actually meant and spoke!
  const normalizeCustomerSpeech = (text: string): string => {
    if (!text) return '';
    let normalized = text.trim();

    // 1. Map Tamil Script to Clean Tanglish / Real Estate Terms
    const tamilToTanglishMap: [RegExp, string][] = [
      [/\b(ஆமாம்|ஆமாங்க|ஆமா|ஆம்)\b/gi, 'Aama'],
      [/\b(இல்லைங்க|இல்லை|இல்லங்க|இல்ல)\b/gi, 'Illa'],
      [/\b(சரிங்க|சரி சார்|சரி)\b/gi, 'Sari'],
      [/\b(புரியுதுங்க|புரியுது)\b/gi, 'Puriyudhu'],
      [/\b(பேசலாம்)\b/gi, 'Pesalaam'],
      [/\b(வேளச்சேரில|வேளச்சேரி)\b/gi, 'Velachery'],
      [/\b(தாம்பரத்துல|தாம்பரம்)\b/gi, 'Tambaram'],
      [/\b(மேடவாக்கம்)\b/gi, 'Medavakkam'],
      [/\b(சோழிங்கநல்லூர்)\b/gi, 'Sholinganallur'],
      [/\b(மடிப்பாக்கம்)\b/gi, 'Madipakkam'],
      [/\b(கிண்டி)\b/gi, 'Guindy'],
      [/\b(போரூர்)\b/gi, 'Porur'],
      [/\b(அடையார்)\b/gi, 'Adyar'],
      [/\b(அண்ணா\s*நகர்)\b/gi, 'Anna Nagar'],
      [/\b(செங்கல்பட்டு)\b/gi, 'Chengalpattu'],
      [/\b(சென்னை)\b/gi, 'Chennai'],
      [/\b(ஓஎம்ஆர்)\b/gi, 'OMR'],
      [/\b(ஈசிஆர்)\b/gi, 'ECR'],
      [/\b(வாடகைக்கு|வாடகை)\b/gi, 'Rent'],
      [/\b(வாங்கணும்|வாங்க)\b/gi, 'Buy'],
      [/\b(வீடுங்க|வீடு)\b/gi, 'House'],
      [/\b(அபார்ட்மெண்ட்|அபார்ட்மென்ட்)\b/gi, 'Apartment'],
      [/\b(ப்ளாட்|பிளாட்)\b/gi, 'Plot'],
      [/\b(வில்லா)\b/gi, 'Villa'],
      [/\b(1\s*(?:பிஎச்கே|பிகெச்கே))\b/gi, '1 BHK'],
      [/\b(2\s*(?:பிஎச்கே|பிகெச்கே))\b/gi, '2 BHK'],
      [/\b(3\s*(?:பிஎச்கே|பிகெச்கே))\b/gi, '3 BHK'],
      [/\b(4\s*(?:பிஎச்கே|பிகெச்கே))\b/gi, '4 BHK'],
      [/\b(லட்சம்|லக்ஷம்)\b/gi, 'Lakhs'],
      [/\b(கோடி)\b/gi, 'Crore'],
      [/\b(ஃப்ரீ|ப்ரீ)\b/gi, 'Free'],
      [/\b(வேணும்|வேண்டும)\b/gi, 'Venum'],
      [/\b(சொல்லுங்க|சொல்ல\s*முடியுமா)\b/gi, 'Sollunga'],
      [/\b(எந்த\s*ஏரியா|எந்த\s*இடம்)\b/gi, 'Endha area'],
      [/\b(பார்க்கிறேன்|பாக்குறேன்)\b/gi, 'Paakuren'],
      [/\b(கண்டிப்பா)\b/gi, 'Kandippa'],
      [/\b(வணக்கம்)\b/gi, 'Vanakkam'],
      [/\b(நன்றி)\b/gi, 'Nandri'],
      [/\b(பட்ஜெட்)\b/gi, 'Budget'],
      [/\b(சைட்\s*விசிட்)\b/gi, 'Site visit'],
      [/\b(சனி\s*ஞாயிறு)\b/gi, 'Sani yaayiru'],
      [/\b(உடனே)\b/gi, 'Udane'],
      [/\b(வங்கி\s*கடன்|லோன்)\b/gi, 'Bank loan'],
      [/\b(தமிழ்)\b/gi, 'Tamil'],
      [/\b(இங்கிலீஷ்)\b/gi, 'English'],
      [/\b(இந்தி)\b/gi, 'Hindi']
    ];

    for (const [pattern, replacement] of tamilToTanglishMap) {
      normalized = normalized.replace(pattern, replacement);
    }

    // 2. Map Chrome Acoustic Misrecognitions (when Tamil/Tanglish sounds hit English or multilingual STT)
    const phoneticCorrections: [RegExp, string][] = [
      // "Aama" misheard by Chrome (e.g. "armor", "i'm a", "on a", "arma")
      [/\b(armor|i'?m a|on a|arma|alma|almer|ah ma|a ma|ahmaa)\b/gi, 'Aama'],
      // "Velachery" (e.g. "well cherry", "villa cherry", "vela cherry")
      [/\b(well\s*cherry|vela\s*cherry|villa\s*cherry|vella\s*cherry|wellcherry|villacherry)\b/gi, 'Velachery'],
      // BHK configurations (e.g. "to be hk", "two bhk", "tree bhk")
      [/\b(to be hk|to be h k|to bhk|tube hk|tubhk|two bhk|2bhk)\b/gi, '2 BHK'],
      [/\b(one bhk|won bhk|1bhk)\b/gi, '1 BHK'],
      [/\b(three bhk|tree bhk|3bhk)\b/gi, '3 BHK'],
      [/\b(four bhk|for bhk|4bhk)\b/gi, '4 BHK'],
      // "Venum" (want / need)
      [/\b(venom|when home|win um|win home|wenum|when um)\b/gi, 'venum'],
      // "Puriyudhu" (understood)
      [/\b(pretty two|purity|free you too|puriyudu|period)\b/gi, 'Puriyudhu'],
      // "Sari" / "Seri" (okay / sure)
      [/\b(sorry|cherry|semi|seri)\b(?=\s*(?:pesalam|solunga|pesunga|kandippa|ok|okay|sir|dhaan|than|irukku|panlam|$))/gi, 'Sari'],
      // "Illa" (no / not)
      [/\b(ella|in la|il la|illya|illai)\b/gi, 'Illa'],
      // "Pesalaam" (let's talk)
      [/\b(best slam|bassil um|base lamb|pesalam)\b/gi, 'pesalaam'],
      // "Endha area" (which area)
      [/\b(in the area|and the area|in the aria)\b/gi, 'Endha area'],
      // "Paakuren" (looking for)
      [/\b(park run|parker in|park in|paakura)\b/gi, 'paakuren'],
      // "Vadagai" (rental)
      [/\b(water guy|what the guy|vaadagai)\b/gi, 'vadagai'],
      // "Kandippa" (definitely)
      [/\b(can dipper|candy bar|kandipa)\b/gi, 'kandippa'],
      // "Solla mudiyuma" (can you tell)
      [/\b(solar medium|sole ammo diuma|solla mudiuma)\b/gi, 'solla mudiyuma'],
      // Budgets & Numbers
      [/\bfor tea lakhs\b/gi, '40 lakhs'],
      [/\b50lakhs\b/gi, '50 lakhs'],
      [/\b40lakhs\b/gi, '40 lakhs'],
      [/\b30lakhs\b/gi, '30 lakhs'],
      [/\b20lakhs\b/gi, '20 lakhs'],
      [/\btwo crore\b/gi, '2 Crore'],
      [/\bone crore\b/gi, '1 Crore'],
      // "Rent ku"
      [/\brent (?:cool|to|go)\b/gi, 'rent ku'],
      // "Buying ku"
      [/\bbuying (?:cool|go|to)\b/gi, 'buying ku'],
      // Locations
      [/\b(tamber am|tom bram)\b/gi, 'Tambaram'],
      [/\b(anna nogger|ananagar)\b/gi, 'Anna Nagar'],
      [/\b(sho ling anallur|solinganallur)\b/gi, 'Sholinganallur'],
      [/\b(mad pack am|madipakam)\b/gi, 'Madipakkam'],
      [/\b(mid wake am|medavakam)\b/gi, 'Medavakkam'],
      // Phrases
      [/\b(free turn|three time)\b/gi, 'free thaan'],
      [/\b(sunny gyro|sani yairu)\b/gi, 'sani yaayiru'],
      [/\b(you done a|udana)\b/gi, 'udane'],
      // Standalone "sorry" when whole answer is just "sorry" -> customer saying "Sari" (Yes/OK)
      [/^sorry$/i, 'Sari']
    ];

    for (const [pattern, replacement] of phoneticCorrections) {
      normalized = normalized.replace(pattern, replacement);
    }

    if (normalized.length > 0) {
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    return normalized.trim();
  };

  // ── Complete Speech Transcript Combiner (Appends & Preserves All Words) ──
  // Combines partial speech transcripts belonging to current user turn without overwriting earlier speech
  const mergeSpeechTranscripts = (existing: string, incoming: string): string => {
    const cleanExisting = (existing || '').trim().replace(/[,.-]+$/, '').trim();
    const cleanIncoming = (incoming || '').trim().replace(/^[,.-]+/, '').trim();
    if (!cleanExisting) return cleanIncoming;
    if (!cleanIncoming) return cleanExisting;

    const lowerExisting = cleanExisting.toLowerCase();
    const lowerIncoming = cleanIncoming.toLowerCase();

    // If incoming already starts with or contains existing
    if (lowerIncoming.startsWith(lowerExisting)) return cleanIncoming;
    // If existing already ends with incoming
    if (lowerExisting.endsWith(lowerIncoming)) return cleanExisting;

    const existingWords = cleanExisting.split(/\s+/);
    const incomingWords = cleanIncoming.split(/\s+/);

    const maxOverlap = Math.min(existingWords.length, incomingWords.length);
    let overlapCount = 0;

    for (let n = maxOverlap; n > 0; n--) {
      const existingTail = existingWords
        .slice(-n)
        .map((w) => w.replace(/[^a-zA-Z0-9\u0B80-\u0BFF\u0900-\u097F]/g, '').toLowerCase())
        .join(' ');
      const incomingHead = incomingWords
        .slice(0, n)
        .map((w) => w.replace(/[^a-zA-Z0-9\u0B80-\u0BFF\u0900-\u097F]/g, '').toLowerCase())
        .join(' ');
      if (existingTail && existingTail === incomingHead) {
        overlapCount = n;
        break;
      }
    }

    if (overlapCount > 0) {
      return `${cleanExisting} ${incomingWords.slice(overlapCount).join(' ')}`.trim();
    }

    return `${cleanExisting} ${cleanIncoming}`.trim();
  };

  // ── Incomplete Thought / Trailing Filler Detector ─────────────────────────
  const isIncompleteSentence = (text: string): boolean => {
    const trimmed = (text || '').trim().toLowerCase();
    if (!trimmed) return true;
    if (trimmed.endsWith(',') || trimmed.endsWith('...') || trimmed.endsWith('-')) return true;

    const trailingMatch = trimmed.match(/([a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+)[^\w\u0B80-\u0BFF\u0900-\u097F]*$/);
    if (trailingMatch) {
      const lastWord = trailingMatch[1].toLowerCase();
      const incompleteWords = new Set([
        // English
        'and', 'or', 'in', 'at', 'for', 'with', 'around', 'near', 'because', 'like', 'uh', 'um', 'the', 'a', 'an', 'to', 'of', 'but', 'so', 'my', 'is', 'have', 'need', 'want', 'looking',
        // Tamil / Tanglish
        'naan', 'enakku', 'andha', 'indha', 'oru', 'mattum', 'aana', 'aanal', 'aprom', 'apram', 'kooda', 'romba', 'engalukku', 'inga', 'anga',
        // Hindi
        'aur', 'ki', 'mein', 'par', 'se', 'to', 'lekin', 'ya', 'ka', 'ke', 'ko', 'bhi', 'hum', 'mujhe', 'chahiye', 'humein', 'yahan', 'wahan'
      ]);
      if (incompleteWords.has(lastWord)) return true;
    }
    return false;
  };

  // ── 8-Second Inactivity Disconnect Management (Requirement 4) ─────────────
  // If user remains completely silent for 8 consecutive seconds, auto-disconnect call.
  // Reset whenever any new user speech or VAD activity is detected.
  const resetInactivityDisconnectTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (
      callStateRef.current === 'Call Completed' ||
      callStateRef.current === 'Calling...' ||
      isSpeechSynthesisSpeakingRef.current ||
      isTurnProcessingRef.current
    ) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      handleInactivityDisconnect();
    }, INACTIVITY_DISCONNECT_MS);
  };

  const handleInactivityDisconnect = () => {
    if (callStateRef.current === 'Call Completed') return;
    console.log('[Inactivity Disconnect] Caller remained completely silent for 8 consecutive seconds. Auto-disconnecting call.');
    const activeLang = selectedLanguageRef.current;
    const politeClose =
      activeLang === 'Hindi'
        ? 'Aapki taraf se koi aawaz nahi aa rahi hai. Hum call disconnect kar rahe hain. Lyka Realty mein call karne ke liye dhanyavad.'
        : activeLang === 'English'
        ? 'We did not detect any response for 8 seconds. Disconnecting the call now. Thank you for calling Lyka Realty.'
        : 'Unga kitta irundhu bathil varala. Call disconnect panrom. Lyka Realty-ku nandri.';
    appendDialogue('AI', politeClose);
    speakAIText(politeClose, getVoiceLangCode(), () => {
      finalizeCall('No Answer', 'NO_ANSWER', 'Caller remained silent for 8 consecutive seconds. Automatically disconnected.', true);
    });
  };

  // Backwards-compatible aliases
  const resetNoAnswerTimeout = resetInactivityDisconnectTimer;
  const handleNoAnswerTimeout = handleInactivityDisconnect;

  const appendDialogue = (speaker: 'AI' | 'Customer', text: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newEntry = { speaker, text, timestamp: timeStr };
    dialogueRef.current = [...dialogueRef.current, newEntry];
    setDialogue([...dialogueRef.current]);
  };



  // ─── Colloquial NLP Intent Helpers (Supports "Free" vs "Not Free" & Tanglish) ─
  const isDecliningOrBusy = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    // Guard: If the text contains positive signals, property terms or inquiry words, they are NOT declining
    if (
      lower.includes('free') || lower.includes('pesalam') || lower.includes('solunga') ||
      lower.includes('sollunga') || lower.includes('tell') || lower.includes('price') ||
      lower.includes('bhk') || lower.includes('flat') || lower.includes('villa') ||
      lower.includes('house') || lower.includes('plot') || lower.includes('know') ||
      lower.includes('details') || lower.includes('buy') || lower.includes('rent') ||
      lower.includes('budget') || lower.includes('where') || lower.includes('what') ||
      lower.includes('how') || lower.includes('aama') || lower.includes('sure') ||
      lower.includes('yes')
    ) {
      return false;
    }

    // Precise decline phrases with strict word boundaries
    return (
      /\b(not free|ippo free illa|free illa|free illai|free nahi|busy|not now|call later|baad me|samay nahi|time nahi|velai irukku|mudiyadhu|call pannadheenga)\b/i.test(lower) ||
      /^(\bno\b|\bnahi\b|\billa\b|\billai\b|\bvendam\b|\bvenda\b)$/i.test(lower)
    );
  };

  const isAgreeingOrFree = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    // Check positive agreement to "Are you free?", "convenient-aa irukka?" or interest
    const freeWords = [
      'free', 'free thaan', 'free-ah irukken', 'free ah irukken', 'i am free', 'yes free', 'haan free hoon', 'free hoon',
      'convenient', 'convenient thaan', 'convenient-aa irukku', 'convenient-a irukku', 'conveniently',
      'nalla irukken', 'fine', 'good', 'i am good', 'all good',
      'yes', 'yeah', 'sure', 'yep', 'ok', 'okay', 'interested', 'go ahead', 'speak', 'tell me',
      'haan', 'theek hai', 'bolo', 'batayein', 'zaroor', 'ha',
      'aan', 'ah', 'aama', 'aamaa', 'ama', 'sari', 'pesalam', 'pesalaam', 'solunga', 'sollunga', 'solleenga', 'pesunga', 'kandippa',
      'puriyudhu', 'dharalama', 'kelunga', 'plan irukku'
    ];
    return freeWords.some((w) => lower.includes(w));
  };

  const isNotInterested = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    if (
      lower.includes('know') || lower.includes('price') || lower.includes('bhk') ||
      lower.includes('flat') || lower.includes('villa') || lower.includes('house') ||
      lower.includes('plot') || lower.includes('buy') || lower.includes('rent') ||
      lower.includes('details') || lower.includes('interested')
    ) {
      return false;
    }
    return /\b(not interested|no interest|no thanks|not looking|wrong number|interest nahi|nahi chahiye|nahi lena|interest illa|interest illai|thevai illa|idea illa|plan illa)\b/i.test(lower);
  };

  const isCustomerQuestion = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    if (lower.includes('?')) return true;
    if (/^(what|where|who|which|how|why|when|can|could|tell|do you|is there|are there|is it|give me|explain)\b/i.test(lower)) {
      return true;
    }
    if (/^(kya|kaha|kaise|kitna|kab|kaun|batao|bataiye|batayein|suno|kyu|kyun)\b/i.test(lower)) {
      return true;
    }
    if (/^(enna|enga|eppadi|evlo|eppo|yaaru|solreenga|solleenga|solunga|sollunga|oru kelvi|oru doubt|edhukku|yen)\b/i.test(lower)) {
      return true;
    }
    return false;
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

    // Step 1: Customer responds to opening greeting
    if (step === 1) {
      return (
        isAgreeingOrFree(lower) ||
        isDecliningOrBusy(lower) ||
        lower.includes('hello') ||
        lower.includes('hi') ||
        lower.includes('vanakkam') ||
        lower.includes('sollunga') ||
        lower.includes('solren') ||
        lower.includes('yes') ||
        lower.includes('aama') ||
        lower.includes('haan') ||
        lower.includes('boliye') ||
        lower.includes('ok') ||
        lower.includes('okay')
      );
    }

    // Step 2: Purpose (Own Use, Investment, Buy, Rent, Plot - PDF Question 1)
    if (step === 2) {
      return (
        lower.includes('own use') ||
        lower.includes('own') ||
        lower.includes('invest') ||
        lower.includes('investment') ||
        lower.includes('vaanga') ||
        lower.includes('vaanganum') ||
        lower.includes('buy') ||
        lower.includes('veedu') ||
        lower.includes('flat') ||
        lower.includes('house') ||
        lower.includes('apartment') ||
        lower.includes('villa') ||
        lower.includes('townhouse') ||
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
        lower.includes('சென்னை') ||
        lower.includes('medavakkam') ||
        lower.includes('guindy') ||
        lower.includes('anna nagar') ||
        lower.includes('t nagar')
      );
    }

    // Step 4: Size (Studio, 1 BHK, 2 BHK, 3 BHK, Plot sq ft - PDF Question 3)
    if (step === 4) {
      return (
        lower.includes('studio') ||
        lower.includes('one bedroom') ||
        lower.includes('two bedroom') ||
        lower.includes('three bedroom') ||
        lower.includes('1 bedroom') ||
        lower.includes('2 bedroom') ||
        lower.includes('3 bedroom') ||
        /\b(1|2|3|4)\s*bhk\b/i.test(lower) ||
        lower.includes('bhk') ||
        lower.includes('villa') ||
        lower.includes('plot') ||
        lower.includes('sq ft') ||
        lower.includes('sqft') ||
        lower.includes('1200') ||
        lower.includes('podhum') ||
        lower.includes('போதும்')
      );
    }

    // Step 5: Budget (PDF Question 4)
    if (step === 5) {
      return (
        /\b(70|72|75|80|85|90)\b/.test(lower) ||
        lower.includes('lakh') ||
        lower.includes('crore') ||
        lower.includes('kodi') ||
        lower.includes('cr') ||
        lower.includes('1.25') ||
        lower.includes('1.6') ||
        lower.includes('14000') ||
        lower.includes('14,000') ||
        lower.includes('25000') ||
        lower.includes('28000') ||
        lower.includes('28,000') ||
        lower.includes('30000') ||
        lower.includes('லட்சம்') ||
        lower.includes('கோடி')
      );
    }

    // Step 6: Move-in Timeline (PDF Question 5)
    if (step === 6) {
      return (
        lower.includes('next few months') ||
        lower.includes('few months') ||
        lower.includes('compare') ||
        lower.includes('comparing') ||
        lower.includes('udane') ||
        lower.includes('ready') ||
        lower.includes('immediate') ||
        lower.includes('1 month') ||
        lower.includes('oru maasam') ||
        lower.includes('maasathula') ||
        lower.includes('short wait') ||
        lower.includes('2026') ||
        lower.includes('உடனே') ||
        lower.includes('மாசத்துல')
      );
    }

    // Step 7: Finance (Cash, Mortgage, Developer plan - PDF Question 6)
    if (step === 7) {
      return (
        lower.includes('cash') ||
        lower.includes('full cash') ||
        lower.includes('developer') ||
        lower.includes('payment plan') ||
        lower.includes('mortgage') ||
        lower.includes('loan') ||
        lower.includes('bank') ||
        lower.includes('self') ||
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
        lower.includes('tomorrow') ||
        lower.includes('today') ||
        lower.includes('ஞாயிறு') ||
        lower.includes('சனி')
      );
    }

    return false;
  };

  // ── Dynamic Turn Triggering Based on User Answer Content ────────────────────
  // Evaluates the user's answer to determine the natural end-of-turn waiting duration:
  // 1. Direct answer to current question (or decline): ~900ms (natural human response pause)
  // 2. Customer question / inquiry: ~1000ms
  // 3. Incomplete sentence / trailing preposition or conjunction: ~1800ms (patient listener, never interrupts!)
  // 4. Multi-detail answer: ~1000ms
  // 5. Standard conversational turn: ~1200ms
  const getDynamicSilenceWaitMs = (
    text: string,
    step: number
  ): { waitMs: number; statusLabel: string } => {
    const clean = text.trim();
    if (!clean) {
      return { waitMs: 1000, statusLabel: '🎙️ Listening...' };
    }

    // A. Incomplete thoughts, trailing conjunctions, or trailing punctuation — give more time
    if (isIncompleteSentence(clean)) {
      return {
        waitMs: 1800,
        statusLabel: '👂 Listening... (take your time)',
      };
    }

    // B. Direct complete answer to the current qualification step
    if (isQuickAnswerMatch(clean, step) || (step === 1 && isDecliningOrBusy(clean))) {
      return {
        waitMs: 900,
        statusLabel: '✨ Answer heard, responding...',
      };
    }

    // C. Customer asking a question or inquiry (price, location, etc.)
    if (isCustomerQuestion(clean)) {
      return {
        waitMs: 1000,
        statusLabel: '✨ Question heard, answering...',
      };
    }

    // D. Multi-attribute qualification statement (e.g. "2 BHK Velachery under 80L")
    const lower = clean.toLowerCase();
    const hasMultipleDetails =
      (lower.includes('bhk') || lower.includes('flat') || lower.includes('plot') || lower.includes('house')) &&
      (lower.includes('velachery') || lower.includes('omr') || lower.includes('porur') || lower.includes('tambaram') || lower.includes('adyar') || lower.includes('chennai') || lower.includes('lakh') || lower.includes('crore'));
    if (hasMultipleDetails) {
      return {
        waitMs: 1000,
        statusLabel: '✨ Details captured, responding...',
      };
    }

    // E. Standard conversational turn
    return {
      waitMs: 1200,
      statusLabel: '👂 Listening...',
    };
  };

  // Immediate End-of-Turn Trigger: triggers when user clicks 'Respond Now' without waiting for silence window
  const triggerImmediateTurn = () => {
    if (isTurnProcessingRef.current || isSpeechSynthesisSpeakingRef.current) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setIsUserPausing(false);

    const text = (
      userAccumulatedSpeechRef.current || turnCommittedSpeechRef.current
    ).trim();
    userAccumulatedSpeechRef.current = '';
    turnCommittedSpeechRef.current = '';
    speechSessionPrefixRef.current = '';
    if (text.length > 0) {
      console.log('[Immediate End-of-Turn Triggered by User]:', text);
      dispatchCustomerSpeech(text);
    }
  };

  // Acoustic Echo Detector: Determines if spoken text is merely laptop speaker bleed-through from the AI's current/recent speech
  const isAcousticEchoFromAiSpeech = (spoken: string, currentAi?: string, lastAi?: string): boolean => {
    if (!spoken || spoken.trim().length === 0) return true;
    const cleanSpoken = spoken.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F\s]/g, ' ').trim();
    if (!cleanSpoken) return true;

    const fullAi = `${currentAi || ''} ${lastAi || ''}`.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F\s]/g, ' ').trim();
    if (!fullAi) return false;

    // 1. Direct condensed substring check (e.g., "2bhk" inside "...2bhk...")
    const condensedSpoken = cleanSpoken.replace(/\s+/g, '');
    const condensedAi = fullAi.replace(/\s+/g, '');
    if (condensedSpoken.length >= 2 && condensedAi.includes(condensedSpoken)) {
      return true;
    }

    // 2. Token overlap check: if >= 60% of spoken words match words in the AI's speech, it is echo
    const spokenWords = cleanSpoken.split(/\s+/).filter((w) => w.length >= 2);
    if (spokenWords.length === 0) return true;
    const aiWords = new Set(fullAi.split(/\s+/).filter((w) => w.length >= 2));
    const matchCount = spokenWords.filter((w) => aiWords.has(w)).length;
    if (matchCount / spokenWords.length >= 0.6) {
      return true;
    }

    return false;
  };

  // Immediate Customer Speech Dispatcher (Bypasses Chrome's 2.5s silence wait & prevents repeating audio)
  const dispatchCustomerSpeech = (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    if (isSpeechSynthesisSpeakingRef.current) {
      if (isAcousticEchoFromAiSpeech(cleanText, currentAiSpeechRef.current, lastAiSpeechTextRef.current)) {
        console.log('[Turn Ignored] Echo detected during AI speech:', cleanText);
        return;
      }
      console.log('[Interruption Dispatched] User interrupted speaking:', cleanText);
      handleBargeIn();
    } else if (isTurnProcessingRef.current) {
      console.log('[Turn Ignored] Already processing turn:', cleanText);
      return;
    }

    // Clear any silence detection timer and inactivity timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setIsUserPausing(false);
    userAccumulatedSpeechRef.current = '';
    turnCommittedSpeechRef.current = '';
    speechSessionPrefixRef.current = '';

    const now = Date.now();
    // Drop immediate duplicate speech fired within 1000ms
    if (
      lastDispatchedTextRef.current.toLowerCase() === cleanText.toLowerCase() &&
      now - lastDispatchedTimeRef.current < 1000
    ) {
      console.log('[Turn Deduplication] Dropped duplicate speech within 1s:', cleanText);
      return;
    }
    lastDispatchedTextRef.current = cleanText;
    lastDispatchedTimeRef.current = now;

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

    // Safety watchdog: auto-clear turn lock if speech synthesis or API takes more than 10 seconds
    const turnWatchdog = setTimeout(() => {
      if (isTurnProcessingRef.current && !isSpeechSynthesisSpeakingRef.current) {
        console.warn('[Turn Watchdog] Auto-cleared stuck turn processing lock');
        isTurnProcessingRef.current = false;
        updateCallState('Listening...');
      }
    }, 10000);

    // Keep turn lock active while AI answers & speaks; onAudioPlaybackDone will release it.
    handleCustomerInput(cleanText)
      .catch((err) => {
        console.error('[Turn Processing Error]:', err);
        isTurnProcessingRef.current = false;
        updateCallState('Listening...');
      })
      .finally(() => {
        clearTimeout(turnWatchdog);
      });
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

    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // ignore
    }
    recognitionRef.current = null;
    isRecognitionRunningRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Set recognition language:
    // 'ta-IN' accurately captures Tamil & Tanglish sounds ("Aama", "Velachery", "Venum", "Puriyudhu", "Sari")
    // 'hi-IN' captures Hindi words
    // 'en-IN' captures English words
    const currentLang = selectedLanguageRef.current || initialLanguage;
    if (currentStepRef.current === 0) {
      recognition.lang = currentLang === 'Hindi' ? 'hi-IN' : currentLang === 'English' ? 'en-IN' : 'ta-IN';
    } else if (currentLang === 'Hindi') {
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
      // 1. Reset 8-second inactivity disconnect timer on any detected user speech
      resetInactivityDisconnectTimer();

      let sessionFinal = '';
      let sessionInterim = '';

      // Accumulate speech segments cleanly from this recognition session
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item && item[0]) {
          const text = (item[0].transcript || '').trim();
          if (text) {
            if (item.isFinal) {
              sessionFinal += (sessionFinal ? ' ' : '') + text;
            } else {
              sessionInterim += (sessionInterim ? ' ' : '') + text;
            }
          }
        }
      }

      // Raw recognized speech in current recognition session
      const rawCurrentSession = (
        sessionFinal
          ? sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')
          : sessionInterim
      ).trim();

      if (!rawCurrentSession && !speechSessionPrefixRef.current) return;

      // 1b. Acoustic Echo Guard: Reject speaker reverberation within 600ms of AI speech finishing
      if (Date.now() - lastAiSpeechEndedAtRef.current < 600) {
        return;
      }

      // Combine with any prefix from prior micro-pause restart during the same turn
      const rawCombined = speechSessionPrefixRef.current
        ? `${speechSessionPrefixRef.current} ${rawCurrentSession}`.trim()
        : rawCurrentSession;

      // Normalize speech: Translates Tamil script & corrects phonetic acoustic mistranscriptions
      const fullTurnTranscript = normalizeCustomerSpeech(rawCombined);

      if (!fullTurnTranscript || fullTurnTranscript.trim().length < 2) return;

      // 2. While AI is actively speaking:
      if (isSpeechSynthesisSpeakingRef.current) {
        // 2a. Echo check: If what the mic heard is part of the AI's own spoken words, IGNORE IT!
        // It is laptop speaker feedback. Never interrupt or transcribe AI's own words!
        if (isAcousticEchoFromAiSpeech(fullTurnTranscript, currentAiSpeechRef.current, lastAiSpeechTextRef.current)) {
          return;
        }

        // 2b. Genuine User Interruption (Barge-In):
        // Only interrupt AI speech if the user explicitly spoke interruption words or an external question
        const spokenLower = fullTurnTranscript.toLowerCase().trim();
        const isGenuineInterruption =
          /\b(wait|stop|hold\s*on|listen|suno|ruko|oru\s*nimisham|cut\s*pannu|podhum|enna\s*solreenga|who\s*are\s*you|yaar\s*pesura)\b/i.test(spokenLower) ||
          (spokenLower.includes('?') && !isAcousticEchoFromAiSpeech(spokenLower, currentAiSpeechRef.current, lastAiSpeechTextRef.current));

        if (isGenuineInterruption) {
          console.log('[BargeIn via SpeechRecognition] Genuine user interruption detected:', fullTurnTranscript);
          handleBargeIn();
        } else {
          // If not an explicit interruption while AI is talking, let the AI finish asking its question!
          return;
        }
      }

      // 3. LIVE SPEECH WRITING: Display every single word accurately in real-time as the user talks
      setLiveSpeechText(fullTurnTranscript);
      userAccumulatedSpeechRef.current = fullTurnTranscript;

      // Reset the silence timer whenever speech continues or resumes
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // 4. DYNAMIC END-OF-TURN DETECTION:
      // Turn triggering waiting time directly depends on the user's answer!
      const { waitMs, statusLabel } = getDynamicSilenceWaitMs(
        fullTurnTranscript,
        currentStepRef.current
      );

      setIsUserPausing(true);
      setTurnStatusLabel(statusLabel);

      // 5. Trigger response when silence duration matches the completeness of user's answer:
      silenceTimerRef.current = setTimeout(() => {
        setIsUserPausing(false);

        const textToDispatch = (
          userAccumulatedSpeechRef.current || speechSessionPrefixRef.current
        ).trim();

        // Clear turn buffers for next turn
        userAccumulatedSpeechRef.current = '';
        speechSessionPrefixRef.current = '';
        turnCommittedSpeechRef.current = '';

        if (!isTurnProcessingRef.current && !isSpeechSynthesisSpeakingRef.current && textToDispatch.length > 1) {
          // Double-check echo before dispatching
          if (lastAiSpeechTextRef.current) {
            const spokenClean = textToDispatch.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F]/g, '');
            const aiClean = lastAiSpeechTextRef.current.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F]/g, '');
            if (spokenClean.length > 3 && aiClean.includes(spokenClean)) {
              console.log('[Dispatch Echo Shield] Dropped echo dispatch:', textToDispatch);
              return;
            }
          }
          console.log(`[Turn Complete - Wait: ${waitMs}ms (${statusLabel})]:`, textToDispatch);
          dispatchCustomerSpeech(textToDispatch);
        }
      }, waitMs);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage(
          'Microphone permission blocked. Please click the icon in your address bar and allow Microphone.'
        );
      } else if (event.error === 'no-speech' || event.error === 'network') {
        // Non-fatal transient errors: keep prefix and restart smoothly
        isRecognitionRunningRef.current = false;
        setTimeout(() => {
          if (callStateRef.current === 'Listening...' && !isTurnProcessingRef.current) {
            try { recognition.start(); } catch (e) { /* ignore */ }
          }
        }, 120);
      }
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      // In Chrome, recognition can fire onend on micro-pauses (e.g. 1s - 2s pause).
      // We NEVER lose previously recognized words: carry forward userAccumulatedSpeechRef as session prefix!
      if (
        callStateRef.current !== 'Call Completed' &&
        callStateRef.current !== 'Calling...' &&
        !isTurnProcessingRef.current
      ) {
        if (userAccumulatedSpeechRef.current.trim()) {
          speechSessionPrefixRef.current = userAccumulatedSpeechRef.current.trim();
        }

        // Restart recognition immediately (15ms) so speech collection remains continuously active
        setTimeout(() => {
          if (
            callStateRef.current !== 'Call Completed' &&
            callStateRef.current !== 'Calling...' &&
            !isRecognitionRunningRef.current &&
            !isTurnProcessingRef.current
          ) {
            try {
              recognition.start();
            } catch (e) {
              // If restarting instance fails, create a fresh instance to guarantee 100% uptime
              try {
                startContinuousSpeechRecognition();
              } catch (err2) { /* ignore */ }
            }
          }
        }, 15);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Recognition start error:', e);
      setTimeout(() => {
        if (callStateRef.current === 'Listening...' && !isRecognitionRunningRef.current) {
          try { recognition.start(); } catch (err2) { /* ignore */ }
        }
      }, 150);
    }
  };

  // ── High-Speed Native Speech Recognition STT ───────────────────────────────
  // MediaRecorder STT removed per user request. Native Web Speech Recognition
  // provides 100% reliable, real-time streaming voice-to-text with 0ms latency.
  const startServerSTTListening = () => {
    startContinuousSpeechRecognition();
  };



  // ─── Free AI Telecaller Knowledge Base & In-Call Inquiries (PDF Section 5 FAQs & Section 4 Listings) ──
  const isCustomerAskingQuestion = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    if (lower.includes('?')) return true;
    if (/^(what|where|who|which|how|why|when|can|could|tell|do you|is there|are there|is it|give me|explain|hold on|wait)\b/i.test(lower)) {
      return true;
    }
    // Hindi question / interruption triggers
    if (/^(kya|kaha|kaise|kitna|kab|kaun|batao|bataiye|batayein|suno|ek baat|ek question|kyu|kyun|ruko|ek second|ek minute)\b/i.test(lower)) {
      return true;
    }
    // Tamil question starters
    if (/^(enna|enga|eppadi|evlo|eppo|yaaru|solreenga|solleenga|solunga|sollunga|oru kelvi|oru doubt|edhukku|yen)\b/i.test(lower)) {
      return true;
    }

    // Compound inquiry phrases that indicate a customer question rather than a qualification answer
    const compoundInquiries = [
      'who are you', 'who is this', 'who is calling', 'which company', 'why are you calling', 'why calling',
      'edhukku call', 'edhuku call', 'yen call', 'kyu call', 'kyun call',
      'enna price', 'evlo price', 'evlo rate', 'vilai evlo', 'vilai enna', 'rate enna', 'what is the price', 'what is the cost',
      'how much', 'kitna price', 'kitna cost', 'kya price',
      'loan kidaikkuma', 'loan facilities', 'bank loan available', 'cmda approved', 'rera approved', 'dtcp approved',
      'clear title', 'legal documents', 'send me details', 'send on whatsapp', 'whatsapp la anuppunga',
      'brochure send', 'catalog send', 'nerla paakkalaama', 'when can i visit', 'timing enna',
      'lift irukka', 'car parking irukka', 'facing enna', 'amenities enna', 'doubt irukku', 'kelvi kekkanum'
    ];
    return compoundInquiries.some((phrase) => lower.includes(phrase));
  };

  const getKnowledgeResponse = (
    input: string,
    lang: LanguageOption | null,
    step: number
  ): string => {
    const lower = input.toLowerCase();

    // 00. Repetition Request: Repeat / Once again / Marupadiyum / Enna sonneenga / What did you say
    if (
      lower.includes('repeat') || lower.includes('once again') || lower.includes('marupadi') ||
      lower.includes('marubadi') || lower.includes('enna sonneenga') || lower.includes('what did you say') ||
      lower.includes('one more time') || lower.includes('phir se bolo') || lower.includes('dobara bolo') ||
      lower.includes('kekkala') || lower.includes('innum oru thadava')
    ) {
      const lastAiEntry = [...dialogueRef.current].reverse().find((d) => d.speaker === 'AI');
      if (lastAiEntry && lastAiEntry.text) {
        const cleanLast = lastAiEntry.text
          .replace(/^\[.*?\]\s*/, '')
          .replace(/^(once again|marupadiyum solren|ek baar phir se batati hoon)[,\s]*/i, '');
        if (lang === 'Tamil-English') {
          return `[happy] Naan munnadiye explain pannitten sir, aana no problem! Innoru thadava simple-aa solren: ${cleanLast} Ippo ungalukku clear-aa puriyudhaa sir?`;
        } else if (lang === 'Hindi') {
          return `[happy] Zaroor sir! Ek baar phir se batati hoon: ${cleanLast}`;
        } else {
          return `[happy] Sure! Once again: ${cleanLast}`;
        }
      }
    }

    // 0a. In-call Interruption: Wait / Hold on / Oru second
    if (
      lower.includes('wait') || lower.includes('stop') || lower.includes('hold on') ||
      lower.includes('oru second') || lower.includes('oru nimisham') || lower.includes('ek minute') ||
      lower.includes('ek second') || lower.includes('suno') || lower.includes('listen') ||
      lower.includes('irunga')
    ) {
      if (lang === 'Tamil-English') {
        return '[happy] Aan, kandippa! [break] Sollunga, naan kekkaren.';
      } else if (lang === 'Hindi') {
        return '[happy] Haan ji, bilkul! [break] Boliye, main sun rahi hoon.';
      } else {
        return "[happy] Ah, of course! [break] Go ahead, I'm listening.";
      }
    }

    // 0b. Why are you calling? / Ethukku call panreenga? (PDF Section 2)
    if (
      lower.includes('why are you calling') || lower.includes('why did you call') ||
      lower.includes('why call') || lower.includes('edhukku call') || lower.includes('edhuku call') ||
      lower.includes('ethukku call') || lower.includes('yen call') || lower.includes('kyu call') ||
      lower.includes('kyun call') || lower.includes('purpose of call')
    ) {
      if (lang === 'Tamil-English') {
        return 'Sorry, sudden-aa call pannadhukku. Naan Priya, Lyka Realty-lendhu pesuren. Unga contact enga records-la irukku-nu verify pannittu, property-related enquiry irundhucha-nu politely check panna call panninen. Ippo pesuradhukku comfortable illenna, no problem.';
      } else if (lang === 'Hindi') {
        return '[friendly] Haan ji, aapne property ke liye enquiry ki thi, isliye Lyka Realty se call kiya hai taaki sahi options bata sakein. Kya abhi 2 minute baat kar sakte hain?';
      } else {
        return '[friendly] Ah, yes! You had enquired about property options earlier, so I am calling from Lyka Realty to share verified listings. Do you have 2 minutes to talk?';
      }
    }

    // 0c. I don't know you / Enakku ungala theriyadhe (PDF Section 2)
    if (
      lower.includes("don't know you") || lower.includes("dont know you") ||
      lower.includes('theriyadhe') || lower.includes('theriyathu') || lower.includes('jaanta nahi')
    ) {
      if (lang === 'Tamil-English') {
        return 'Puriyudhu. Neenga ennai personally therinjirukkanum-nu avasiyam illa. Naan Lyka Realty team-lendhu call panren. Unexpected call-aa irundhaa sorry. Unga contact source-a naan team kitta verify pannikkaren.';
      } else if (lang === 'Hindi') {
        return 'Main samajh sakti hoon. Main Lyka Realty team se hoon, unexpected call ke liye sorry. Main contact source check karke verify kar loongi.';
      } else {
        return "I understand. You don't need to know me personally; I am calling from the Lyka Realty team. I apologize for the unexpected call and will verify our records.";
      }
    }

    // 0d. I never asked for a call (PDF Section 2)
    if (
      lower.includes('never asked') || lower.includes('request pannala') ||
      lower.includes('call panna sollala') || lower.includes('kabhi call nahi maanga')
    ) {
      if (lang === 'Tamil-English') {
        return 'Sorry about that. Neenga request pannala-na, naan insist panna maatten. Unga contact eppadi enga records-ku vandhuchu-nu verify pannuren. Neenga virumbina, indha conversation inga stop pannalaam.';
      } else if (lang === 'Hindi') {
        return 'Maaf kijiye. Agar aapne request nahi kiya, toh main insist nahi karungi. Records verify karke agar aap chahein toh call yahin end kar sakte hain.';
      } else {
        return 'Sorry about that. If you did not request a call, I will not insist. We can end this conversation right here if you prefer.';
      }
    }

    // 0e. Who gave you my number / How did you get my number (PDF Section 2)
    if (
      lower.includes('who gave you my number') || lower.includes('how did you get my number') ||
      lower.includes('yaaru number kudutha') || lower.includes('number eppadi kedachudhu') ||
      lower.includes('number kahan se mila')
    ) {
      if (lang === 'Tamil-English') {
        return 'Good question. Unga number enga records-la eppadi add aachu-nu naan verify pannanum. Wrong information kudukka virumbala, guess panni solla maatten. Neenga okay-na, team kitta check pannuren.';
      } else if (lang === 'Hindi') {
        return 'Sahi sawaal hai. Main bina verify kiye galat information nahi dena chahti. CRM me contact source check karke team se confirm karwa sakti hoon.';
      } else {
        return 'Good question. I need to verify how your number was added to our records rather than guessing. I can check with our team if you wish.';
      }
    }

    // 0f. Is this a sales call? (PDF Section 2)
    if (
      lower.includes('sales call') || lower.includes('marketing call') ||
      lower.includes('sales-aa') || lower.includes('marketing-aa')
    ) {
      if (lang === 'Tamil-English') {
        return 'Idhu Lyka Realty-lendhu property-related follow-up call. Aana neenga interested illenna, pressure panna maatten. Unga preference-a sollunga; adhukku respect pannuren.';
      } else if (lang === 'Hindi') {
        return 'Yeh Lyka Realty se property follow-up call hai. Lekin aap interested nahi hain toh koi pressure nahi hai. Aapki choice ki respect karti hoon.';
      } else {
        return 'This is a property follow-up call from Lyka Realty. If you are not interested, there is absolutely no pressure. We respect your preference.';
      }
    }

    // 0g. Are you AI? (PDF Section 3 Transparent AI Identity)
    if (
      lower.includes('ai-aa') || lower.includes('are you ai') || lower.includes('are you an ai') ||
      lower.includes('are you robot') || lower.includes('robot-aa') || lower.includes('human or ai') ||
      lower.includes('real person') || lower.includes('unmaiyave priya-va') || lower.includes('are you real') ||
      lower.includes('real human') || lower.includes('human-aa')
    ) {
      if (lang === 'Tamil-English') {
        return 'Aama, naan Lyka Realty-oda AI virtual assistant Priya. Unga property-related questions-ku help panna, basic requirements understand panna, suitable options pathi guide panna inga irukken.';
      } else if (lang === 'Hindi') {
        return 'Haan, main Lyka Realty ki AI virtual assistant Priya hoon. Aapke property sawaalon me madad karne aur basic requirements samajhne ke liye yahan hoon.';
      } else {
        return "Yes, I am Lyka Realty's AI virtual assistant Priya. I am here to understand your requirements and help guide you through verified property options.";
      }
    }

    // 0h. Why should I trust Lyka Realty? (PDF Section 4)
    if (
      lower.includes('trust lyka') || lower.includes('namburadhu') ||
      lower.includes('why should i trust') || lower.includes('bharosa')
    ) {
      if (lang === 'Tamil-English') {
        return 'Neenga verify pannitu dhaan proceed pannanum; adhu romba correct. Company details, listing information and relevant documents-a authorised team moolama check pannalaam. Verify pannaadha information-a naan guarantee panna maatten.';
      } else if (lang === 'Hindi') {
        return 'Aapka verify karna bilkul sahi hai. Company aur property documents authorised team ke zariye check kiye ja sakte hain.';
      } else {
        return 'You should definitely verify before proceeding. Our authorized team can share company details, verified listings, and documentation.';
      }
    }

    // 0i. Total Cost Question (PDF Section 6): Indha property total evlo aagum?
    if (
      lower.includes('total evlo') || lower.includes('total cost') || lower.includes('full cost') ||
      lower.includes('total amount') || lower.includes('extra charges')
    ) {
      if (lang === 'Tamil-English') {
        return 'Oru second, latest cost details verify panren. Property price-kooda registration fees, agency fee if applicable, service charges and other costs irukkalaam. Exact breakdown check pannittu share panren.';
      } else if (lang === 'Hindi') {
        return '[thinking] Ek second, latest cost details check karti hoon. [break] Property price ke saath registration fees, agency charges aur service costs ho sakte hain. Exact breakdown confirm karke batati hoon.';
      } else {
        return '[thinking] One second, let me check the latest costs. [break] Besides property price, there may be DLD/registration fees, agency fees, and service charges. I will share the exact breakdown.';
      }
    }

    // 0j. Lowest Price Request (PDF Section 6)
    if (
      lower.includes('lowest price') || lower.includes('kuraivana vilai') || lower.includes('sabse kam') ||
      lower.includes('cheap property') || lower.includes('kam rate')
    ) {
      if (lang === 'Tamil-English') {
        return 'Sure, budget-friendly options paakalaam. Aana location, size, handover and extra charges-um compare pannalaama? Lowest price mattum base panni decide panna vendaam.';
      } else if (lang === 'Hindi') {
        return 'Sure, budget-friendly options dekh sakte hain. Lekin location, size aur extra charges bhi compare kar lein? Sirf lowest price par decide na karein.';
      } else {
        return 'Sure, we can look at budget-friendly options. But shall we also compare location, size, and handover timeline rather than deciding only on lowest price?';
      }
    }

    // 0k. Legal Approval & Safety (PDF Section 7)
    if (
      lower.includes('legal-aa') || lower.includes('legally approved') || lower.includes('rera approved') ||
      lower.includes('legal approval') || lower.includes('legal status')
    ) {
      if (lang === 'Tamil-English') {
        return 'Idhu romba important question. Project registration, developer details, escrow information if applicable, title or ownership documents and sale agreement details official records-la verify pannanum. Naan guess panni confirm panna maatten; legal team kitta check panni share panren.';
      } else if (lang === 'Hindi') {
        return '[calm] Yeh bahut important sawaal hai. Project registration, escrow details aur title documents verify karna zaroori hai. Hamari legal team confirm karke aapko batayegi.';
      } else {
        return '[calm] That is an important question. Project registration, developer details, and title documents must be verified from official records. Our legal team will confirm directly.';
      }
    }

    // 0l. Off-plan Property Safety (PDF Section 7)
    if (
      lower.includes('off-plan') || lower.includes('offplan') || lower.includes('under construction safe')
    ) {
      if (lang === 'Tamil-English') {
        return 'Off-plan-la developer, project registration, escrow details, payment milestones, SPA terms and expected completion date ellam verify pannradhu important. Risk illai-nu guarantee panna mudiyadhu. Qualified advisor kitta documents review pannunga.';
      } else if (lang === 'Hindi') {
        return 'Off-plan me developer registration, escrow account aur milestones verify karna zaroori hai. Risk-free guarantee nahi de sakte, qualified advisor se review karwayein.';
      } else {
        return 'For off-plan properties, verifying developer escrow, milestones, and SPA terms is vital. We cannot guarantee zero risk, and advise reviewing documents with a qualified advisor.';
      }
    }

    // 0m. Profit / Guarantee Question (PDF Section 7)
    if (
      lower.includes('profit guarantee') || lower.includes('100% safe') || lower.includes('guarantee irukka') ||
      lower.includes('guaranteed return') || lower.includes('guaranteed profit')
    ) {
      if (lang === 'Tamil-English') {
        return 'Guarantee-nu naan solla mudiyadhu. Property investment-la risk irukkum. Verified documents and costs share panren; legal and financial decision-ku qualified professional advice eduthukkonga.';
      } else if (lang === 'Hindi') {
        return 'Guarantee main nahi de sakti. Property investment me market risk hota hai. Verified documents share kar sakti hoon taaki aap sahi faisla le sakein.';
      } else {
        return 'I cannot offer a profit guarantee, as all property investments carry market risk. We share verified documents and costs so you can make an informed decision.';
      }
    }

    // 0n. Specific Chennai Area Request (Velachery, OMR, Tambaram, etc.)
    if (lower.includes('velachery') || lower.includes('omr') || lower.includes('tambaram') || lower.includes('chengalpattu') || lower.includes('porur') || lower.includes('adyar')) {
      if (lang === 'Tamil-English') {
        return 'Oru second, andha area listings and availability check panren. Match aagura verified options irundha price, size, and loan details share panren.';
      } else if (lang === 'Hindi') {
        return '[thinking] Ek second, uss area ke listings check karti hoon. [break] Inventory me jo match hoga, uska price, size aur details share kar doongi.';
      } else {
        return '[thinking] One second, checking listings for that area. [break] If we have matching options in current inventory, I will share the price, size, and loan details.';
      }
    }

    // 0o. Where are your properties? / Unga property endha place-la irukku? (PDF Section 7)
    if (
      lower.includes('where are your properties') || lower.includes('enga place-la irukku') ||
      lower.includes('endha place-la irukku') || lower.includes('properties kahan hai')
    ) {
      if (lang === 'Tamil-English') {
        return 'Namma kitta Chennai-la prime locations-la options irukku: Velachery, OMR Sholinganallur, Tambaram, Porur, Adyar, and Chengalpattu. Ungalukku endha area preference Sir?';
      } else if (lang === 'Hindi') {
        return 'Hamare paas Chennai ke prime locations me options hain: Velachery, OMR Sholinganallur, Tambaram, Porur, Adyar aur Chengalpattu. Aap kaun sa area dekh rahe hain?';
      } else {
        return 'We have verified options across prime Chennai locations: Velachery, OMR Sholinganallur, Tambaram, Porur, Adyar, and Chengalpattu. Which area do you prefer?';
      }
    }

    // 0p. DTCP / CMDA Approved Lands & Plots (PDF P104)
    if (lower.includes('freehold') || lower.includes('dtcp') || lower.includes('cmda plot') || lower.includes('patta')) {
      if (lang === 'Tamil-English') {
        return 'Chengalpattu-la DTCP approved 1200 sq ft plots 18 Lakhs-ku clear patta-voda available-aa irukku. Site visit paakkalama Sir?';
      } else if (lang === 'Hindi') {
        return 'Chengalpattu me DTCP approved 1200 sq ft plots 18 Lakhs me clear patta ke saath available hain. Kya aap site visit dekhna chahenge?';
      } else {
        return 'In Chengalpattu, we have DTCP approved 1200 sq ft plots for Rs. 18 Lakhs with clear patta. Would you like to schedule a site visit?';
      }
    }

    // 0q. Scam / Fraud Concerns (v8 Section 12)
    if (
      lower.includes('scam') || lower.includes('fraud') || lower.includes('cheating') ||
      lower.includes('fake call') || lower.includes('420')
    ) {
      if (lang === 'Tamil-English') {
        return 'Unga concern puriyudhu sir. Naan Lyka Realty-lendhu pesuren, property-related follow-up-kkaaga mattum. Neenga comfortable illenna, inga stop pannalaam. Venumna official channel-la company details verify pannitu apuram pesalaam.';
      } else if (lang === 'Hindi') {
        return 'Aapki concern samajh sakti hoon. Main Lyka Realty se sirf property follow-up ke liye call kar rahi hoon. Agar aap comfortable nahi hain toh abhi call end kar sakte hain aur official website se verify kar sakte hain.';
      } else {
        return 'I understand your concern completely. I am calling from Lyka Realty strictly for property assistance. If you are uncomfortable, we can end the call and you may verify through our official channels.';
      }
    }

    // 0r. Company Licensed / CMDA / DTCP / TN RERA Registered (PDF Section 12)
    if (
      lower.includes('rera') || lower.includes('cmda') || lower.includes('dtcp') || lower.includes('licensed') ||
      lower.includes('license number') || lower.includes('registration number') || lower.includes('approval')
    ) {
      if (lang === 'Tamil-English') {
        return 'Adhu romba important sir. Namma properties ellam CMDA, DTCP, and TN RERA approved. Exact approval numbers and legal documents-a authorised team verify panna share pannuvaanga.';
      } else if (lang === 'Hindi') {
        return 'Yeh bahut zaroori hai. Hamari sabhi properties CMDA, DTCP aur TN RERA se approved hain. Hamari team official legal documents share kar degi.';
      } else {
        return 'That is very important. All our projects are CMDA, DTCP, and TN RERA approved with verified clear title documents.';
      }
    }

    // 0s. Advance Payment / Zero Payment on Call (v8 Section 12 & Section 8)
    if (
      lower.includes('advance') || lower.includes('booking amount') || lower.includes('pay panna') ||
      lower.includes('payment kekkureengala') || lower.includes('paise maang')
    ) {
      if (lang === 'Tamil-English') {
        return 'Illa sir, indha call-la neenga edhuvum pay panna vendaam. Naan payment details, card number or OTP edhuvum kekka maatten. Official accounts moolama mattum dhaan payment proceed aagum.';
      } else if (lang === 'Hindi') {
        return 'Nahi sir, is call par aapko koi payment nahi karni hai. Hum kabhi card number ya OTP nahi maangte. Payment sirf developer ke authorised account se hoti hai.';
      } else {
        return 'No sir, you do not need to make any payment on this call. We never ask for card details or OTPs; transactions are handled strictly through official escrow accounts.';
      }
    }

    // 0t. Handover Delay Concerns (v8 Section 12)
    if (
      lower.includes('handover delay') || lower.includes('delay pannuvaangala') ||
      lower.includes('late handover') || lower.includes('project delay')
    ) {
      if (lang === 'Tamil-English') {
        return 'Idhu important concern sir. Developer track record, project registration, escrow details and payment milestones-a verify pannanum. Delay illa-nu guarantee panna mudiyadhu; documents-a review pannunga.';
      } else if (lang === 'Hindi') {
        return 'Yeh valid concern hai. Developer track record aur escrow account details verify karna zaroori hai. Hum official milestones share kar sakte hain.';
      } else {
        return 'That is a valid concern. Reviewing the developer track record and escrow milestones is essential. We always recommend verifying official documents before committing.';
      }
    }

    // 0u. Rental Income / ROI (v8 Section 11)
    if (
      lower.includes('rental income') || lower.includes('rent evlo') || lower.includes('kiraya') ||
      lower.includes('roi') || lower.includes('rental yield')
    ) {
      if (lang === 'Tamil-English') {
        return 'Exact rental income guarantee panna mudiyadhu sir. Area, property type and market-a poruthu maarum. Available verified data team moolama share panren.';
      } else if (lang === 'Hindi') {
        return 'Rental income ki guarantee nahi di ja sakti. Yeh area aur market conditions par depend karta hai. Historical verified data hum share kar sakte hain.';
      } else {
        return 'We cannot promise guaranteed rental yields as they depend on market trends and property type, but our team can share verified historical rental data.';
      }
    }

    // 0v. UAE Visa / Golden Visa (v8 Section 11)
    if (
      lower.includes('golden visa') || lower.includes('visa kedaikkuma') || lower.includes('uae visa') ||
      lower.includes('residency visa')
    ) {
      if (lang === 'Tamil-English') {
        return 'Visa eligibility pathi naan confirm panna mudiyadhu sir. Adha official sources or qualified immigration adviser-kitta verify pannunga. Property pathi information naan share panren.';
      } else if (lang === 'Hindi') {
        return 'Visa eligibility official immigration rules par depend karti hai. Hum property details provide karte hain aur immigration adviser se verify karne ki salah dete hain.';
      } else {
        return 'Visa eligibility depends on official government thresholds. While I share property details, legal visa verification should always be confirmed with immigration authorities.';
      }
    }

    // 0w. Distance / Location / Where are you now (v8 Section 5B)
    if (
      lower.includes('distance evlo') || lower.includes('how far') || lower.includes('travel time') ||
      lower.includes('enga irukku distance')
    ) {
      if (lang === 'Tamil-English') {
        return 'Sure sir. Distance check panna, Google Maps-la unga location-um property area-um pottaal exact travel time theriyum. Traffic poruthu commute maarum, so office time-la oru thadava check pannunga.';
      } else if (lang === 'Hindi') {
        return 'Sure sir, Google Maps se aapke location aur property ke beech commute travel time aasani se check kar sakte hain.';
      } else {
        return 'Sure! You can check live commute and travel times from your location in Chennai using Google Maps.';
      }
    }

    // 0x. Harmless Compliments & Boundaries (v8 Section 10)
    if (
      lower.includes('nice voice') || lower.includes('sweet voice') || lower.includes('super voice') ||
      lower.includes('sound sweet')
    ) {
      if (lang === 'Tamil-English') {
        return 'Thank you sir. Ungalukku property pathi enna help venum-nu sollunga.';
      } else if (lang === 'Hindi') {
        return 'Shukriya sir. Property ke baare me aapko kya jankari chahiye?';
      } else {
        return 'Thank you sir. How can I assist you with your property search today?';
      }
    }

    // 0y. Personal questions / Flirty remarks (v8 Section 10)
    if (
      lower.includes('single-aa') || lower.includes('are you single') || lower.includes('boyfriend') ||
      lower.includes('married') || lower.includes('coffee') || lower.includes('meet panlaama') ||
      lower.includes('personal number') || lower.includes('photo anupunga')
    ) {
      if (lang === 'Tamil-English') {
        return 'Sir, adhu personal question; adha pathi naan pesa mudiyadhu. Naan Lyka Realty property help-kku mattum. Property pathi edhaavadhu sollunga.';
      } else if (lang === 'Hindi') {
        return 'Sir, yeh personal sawaal hai, main sirf Lyka Realty property queries me madad karti hoon.';
      } else {
        return 'Sir, that is personal and outside my scope. I am here only to assist with Lyka Realty property inquiries.';
      }
    }

    // 0z. Bored or lonely (v8 Section 10)
    if (
      lower.includes('bore adikudhu') || lower.includes('bored') || lower.includes('lonely') ||
      lower.includes('chumma pesunga')
    ) {
      if (lang === 'Tamil-English') {
        return 'Puriyudhu sir, aana naan property queries-kku mattum dhaan help panna mudiyum. Chennai property pathi enquiry irundhaa pesalaam; illenna, unga time-ku thanks.';
      } else if (lang === 'Hindi') {
        return 'Main samajhti hoon sir, par main sirf property queries par hi baat kar sakti hoon. Agar property ke baare me baat karni ho toh zaroor batayein.';
      } else {
        return 'I understand sir, but I can only assist with property-related inquiries. If you have property requirements, I would be glad to help.';
      }
    }

    // 1. Specific Location: Velachery (P101)
    if (lower.includes('velachery') || lower.includes('வேளச்சேரி')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, oru second! [break] வேளச்சேரில ready-to-move 2 BHK flat இருக்கு Sir, 950 sq ft, 72 Lakhs, lift and 2 car parking-oda. Site visit எப்போ பாக்கலாம்?';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, ek second! [break] Velachery me humara ready-to-move 2 BHK flat hai, 950 square feet 72 Lakhs me, lift aur 2 car parking ke saath. Kya aap site visit dekhna chahenge?';
      } else {
        return '[thinking] Ah, let me check that! [break] In Velachery, we have a ready-to-move 2 BHK flat, 950 sq ft for Rs. 72 Lakhs, with 2 car parking and lift. Would you like to schedule a site visit?';
      }
    }

    // 2. Specific Location: OMR / Sholinganallur (P102)
    if (lower.includes('omr') || lower.includes('sholinganallur') || lower.includes('சோழிங்கநல்லூர்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, OMR-aa? [break] OMR சோழிங்கநல்லூர்ல premium 3 BHK flat இருக்கு Sir, 1450 sq ft, gym மற்றும் swimming pool-oda 1.25 Crore. WhatsApp-ல brochure அனுப்பவா?';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, OMR option! [break] OMR Sholinganallur me premium 3 BHK flat hai, 1450 square feet gym aur swimming pool ke saath 1.25 Crore me. Kya brochure WhatsApp pe bhej doon?';
      } else {
        return '[thinking] Ah, OMR! [break] In OMR Sholinganallur, we have a premium 3 BHK flat, 1450 sq ft with gym and pool for Rs. 1.25 Crore. Shall I send the brochure on WhatsApp?';
      }
    }

    // 3. Specific Location: Tambaram (P103)
    if (lower.includes('tambaram') || lower.includes('தாம்பரம்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, Tambaram individual house! [break] தாம்பரம்ல new individual house இருக்கு Sir, 1800 sq ft, 3 bedrooms, East facing, 1.6 Crore. உங்களுக்கு floor plan பார்க்க விருப்பமா?';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, Tambaram me individual house hai, 1800 square feet, 3 bedrooms, East facing 1.6 Crore me. Kya aapko details chahiye?';
      } else {
        return '[thinking] Ah, Tambaram! [break] In Tambaram, we have a newly constructed 3-bedroom individual house, 1800 sq ft, East facing for Rs. 1.6 Crore. Would you like the floor plan?';
      }
    }

    // 4. Specific Location: Chengalpattu (P104)
    if (lower.includes('chengalpattu') || lower.includes('செங்கல்பட்டு')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, Chengalpattu plots! [break] செங்கல்பட்டுல DTCP approved plot இருக்கு Sir, 1200 sq ft, clear patta, 18 Lakhs மட்டும்தான், bank loan support இருக்கு.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, Chengalpattu me DTCP approved plot hai, 1200 square feet clear patta ke saath 18 Lakhs me, aur bank loan facility bhi available hai.';
      } else {
        return '[thinking] Ah, Chengalpattu! [break] In Chengalpattu, we have DTCP approved plots, 1200 sq ft with clear patta for Rs. 18 Lakhs, with bank loan assistance available.';
      }
    }

    // 5. Specific Location: Porur (P105)
    if (lower.includes('porur') || lower.includes('போரூர்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, Porur rental flat! [break] போரூர்ல 1 BHK வாடகை வீடு இருக்கு Sir, மாதம் 14,000 ரூபாய், 3 மாத முன்பணம்.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, Porur me 1 BHK rental flat hai, 14,000 per month 3 months deposit ke saath.';
      } else {
        return '[thinking] Ah, Porur! [break] In Porur, we have a 1 BHK rental flat for Rs. 14,000 per month with 3 months deposit.';
      }
    }

    // 6. Specific Location: Adyar (P106)
    if (lower.includes('adyar') || lower.includes('அடையார்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, Adyar rental flat! [break] அடையார்ல 2 BHK வாடகைக்கு இருக்கு Sir, மாதம் 28,000 ரூபாய், குடும்பங்களுக்கு மட்டும், செல்லப்பிராணிகள் அனுமதிக்கப்படும்.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, Adyar me 2 BHK rental flat hai, 28,000 per month, family aur pet-friendly.';
      } else {
        return '[thinking] Ah, Adyar! [break] In Adyar, we have a 2 BHK rental flat for Rs. 28,000 per month, family only and pet-friendly.';
      }
    }

    // 7. Pricing / Rate Questions
    if (lower.includes('price') || lower.includes('cost') || lower.includes('rate') || lower.includes('pricing') || lower.includes('விலை') || lower.includes('evlo') || lower.includes('kitna')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Ah, price pathi kekkureengala? [break] செங்கல்பட்டு plot 18 Lakhs, வேளச்சேரி 2BHK 72 Lakhs, OMR 3BHK 1.25 Crore. உங்களுக்கு எந்த ஏரியா பட்ஜெட்டுக்கு ஏத்த மாதிரி இருக்கும்?';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, price details! [break] Chengalpattu plot 18 Lakhs, Velachery 2BHK 72 Lakhs, aur OMR 3BHK 1.25 Crore se shuru hota hai. Aapka budget kis area ke liye hai?';
      } else {
        return '[thinking] Ah, speaking of pricing! [break] Our properties start from 18 Lakhs for plots in Chengalpattu, 72 Lakhs for 2BHK in Velachery, and 1.25 Crore for 3BHK in OMR. Which area fits your budget?';
      }
    }

    // 8. Registration cost / பதிவுக் கட்டணம் (PDF Section 5 FAQ 1)
    if (lower.includes('registration') || lower.includes('stamp duty') || lower.includes('பதிவு') || lower.includes('முத்திரை')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, puriyudhu! [break] முத்திரைத்தீர்வை, பதிவுக் கட்டணம் guideline value அல்லது விற்பனை விலை, இதுல எது அதிகமோ அதுக்கு கணக்கிடுவாங்க. சரியான தொகைய எங்க sales team சொல்வாங்க.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, samajh gaya! [break] Stamp duty aur registration guideline value ya sale value me se jo zyada ho, uspe lagta hai. Exact amount sales team confirm karegi.';
      } else {
        return '[thinking] Ah, got it! [break] Stamp duty and registration are charged on guideline value or sale value, whichever is higher. The sales team will confirm the exact amount.';
      }
    }

    // 2. Loan availability / லோன் கிடைக்குமா? (PDF Section 5 FAQ 2)
    if (lower.includes('loan') || lower.includes('கடன்') || lower.includes('approval') || lower.includes('bank loan')) {
      if (lang === 'Tamil-English') {
        return '[warm] Aan, loan facility kandippa irukku! [break] Partner bank மூலமா கடன் உதவி பண்றோம். வருமானம், credit score பாத்து bank தான் இறுதி முடிவு பண்ணும்.';
      } else if (lang === 'Hindi') {
        return '[warm] Haan ji, loan facility bilkul available hai! [break] Hum partner banks ke through loan assist karte hain. Income aur credit score dekh kar bank hi final decision leta hai.';
      } else {
        return '[warm] Ah, yes! Bank loan assistance is definitely available! [break] We assist with bank loans through our partner banks. The bank decides approval based on your income and credit score.';
      }
    }

    // 3. Site visit timings / Site visit எப்போ பாக்கலாம்? (PDF Section 5 FAQ 3)
    if (lower.includes('site visit') || lower.includes('timing') || lower.includes('visith') || lower.includes('எப்போ பாக்கலாம்') || lower.includes('visit time')) {
      if (lang === 'Tamil-English') {
        return '[warm] Aan, site visit kandippa paakkalaam! [break] திங்கள் முதல் சனி காலை 10 மணி முதல் மாலை 5 மணி வரை site visit பாக்கலாம். ஞாயிறு appointment மூலமா வரலாம்.';
      } else if (lang === 'Hindi') {
        return '[warm] Haan ji, site visit zaroor plan kar sakte hain! [break] Site visit Somwar se Shanivar subah 10 baje se shaam 5 baje tak allowed hai. Ravivar ko appointment ke through aana hota hai.';
      } else {
        return '[warm] Ah, definitely! [break] Site visits are available Monday to Saturday from 10 AM to 5 PM, and Sundays by appointment.';
      }
    }

    // 4. Documents needed / என்ன documents வேணும்? (PDF Section 5 FAQ 4)
    if (lower.includes('document') || lower.includes('documents') || lower.includes('proof') || lower.includes('சான்று') || lower.includes('ஆவணம்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, documents list solren! [break] அடையாள அட்டை, முகவரிச் சான்று, PAN, வருமானச் சான்று (loan-க்கு), மற்றும் photos வேணும். Property documents-ஐ team மற்றும் உங்க வக்கீல் சரிபாக்கணும்.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, documents list batati hoon! [break] ID proof, address proof, PAN card, income proof (loan ke liye), aur photos chahiye. Property documents sales team aur aapke lawyer verify karenge.';
      } else {
        return '[thinking] Ah, here are the required documents! [break] You will need ID proof, address proof, PAN, income proof for loans, and photos. Property title documents will be verified by our team and your lawyer.';
      }
    }

    // 5. Booking amount / Booking amount எவ்வளவு? (PDF Section 5 FAQ 5)
    if (lower.includes('booking') || lower.includes('advance') || lower.includes('முன்பணம்')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Aan, puriyudhu! [break] பொதுவா சொத்து விலையில 1 முதல் 5 சதவீதம் booking amount இருக்கும். குறிப்பிட்ட project பொறுத்து மாறும்.';
      } else if (lang === 'Hindi') {
        return '[thinking] Haan ji, booking amount aam taur par property value ka 1 se 5 percent hota hai, project ke hisaab se vary karta hai.';
      } else {
        return '[thinking] Ah, yes! Booking amount is usually 1 to 5 percent of the property price, depending on the specific project.';
      }
    }

    // 6. Company & Office Location (PDF Section 7)
    if (
      lower.includes('who are you') || lower.includes('who is this') || lower.includes('who is calling') ||
      lower.includes('which company') || lower.includes('office') || lower.includes('company') ||
      lower.includes('yaaru') || lower.includes('நிறுவனம்')
    ) {
      if (lang === 'Tamil-English') {
        return '[friendly] Aan, naan Priya! [break] நாங்க Lyka Realty. எங்க Office Anna Nagar, Chennai-ல இருக்கு. வேலை நேரம்: Mon-Sat 9:30 AM to 6:30 PM.';
      } else if (lang === 'Hindi') {
        return '[friendly] Haan ji, main Priya hoon! [break] Main Lyka Realty se hoon. Humara office Anna Nagar, Chennai me hai. Working hours: Mon-Sat 9:30 AM to 6:30 PM.';
      } else {
        return "[friendly] Ah, yes! I'm Priya from Lyka Realty. Our office is in Anna Nagar, Chennai. Open Monday to Saturday, 9:30 AM to 6:30 PM.";
      }
    }

    // 7. Property Listings from PDF (Section 4)
    if (
      lower.includes('project') || lower.includes('property') || lower.includes('flat') ||
      lower.includes('apartment') || lower.includes('bhk') || lower.includes('plot') ||
      lower.includes('veedu') || lower.includes('சொத்து')
    ) {
      if (lang === 'Tamil-English') {
        return '[friendly] Aan, kandippa! [break] எங்க verified சொத்து பட்டியல்: வேளச்சேரில 2BHK flat (72L), OMR சோழிங்கநல்லூர்ல 3BHK flat (1.25 Cr), தாம்பரம்ல தனி வீடு (1.6 Cr), செங்கல்பட்டுல DTCP plot (18L), போரூர்ல 1BHK வாடகை (14,000/m), அடையார்ல 2BHK வாடகை (28,000/m). இதுல உங்களுக்கு எதுல ஆர்வம்?';
      } else if (lang === 'Hindi') {
        return '[friendly] Haan ji, bilkul! [break] Humare verified listings: Velachery me 2BHK flat (72L), OMR me 3BHK flat (1.25 Cr), Tambaram me individual house (1.6 Cr), Chengalpattu me DTCP plot (18L), Porur me 1BHK rent (14k/m), aur Adyar me 2BHK rent (28k/m). Aap kis me interested hain?';
      } else {
        return '[friendly] Ah, certainly! [break] Our verified properties include: 2BHK flat in Velachery (72L), 3BHK flat in OMR (1.25 Cr), Individual house in Tambaram (1.6 Cr), DTCP plot in Chengalpattu (18L), 1BHK rental in Porur (14,000/m), and 2BHK rental in Adyar (28,000/m). Which one suits you?';
      }
    }

    // 8. Brochure / WhatsApp / Details
    if (
      lower.includes('brochure') || lower.includes('whatsapp') || lower.includes('send') ||
      lower.includes('email') || lower.includes('details') || lower.includes('அனுப்பு')
    ) {
      if (lang === 'Tamil-English') {
        return '[friendly] Aan, kandippa! [break] Complete property brochure, floor plans and pricing details உங்க WhatsApp-க்கு அனுப்பிடுறோம். உங்க preferred ஏரியா மற்றும் பட்ஜெட் சொல்லுங்க.';
      } else if (lang === 'Hindi') {
        return '[friendly] Haan ji, zaroor! [break] Complete brochure aur details aapke WhatsApp par share kar denge.';
      } else {
        return '[friendly] Ah, certainly! [break] We will share the complete property brochure and pricing directly to your WhatsApp.';
      }
    }

    // 9. Escalation / Legal / Unlisted (PDF Section 8)
    if (lang === 'Tamil-English') {
      return '[thinking] Aan, puriyudhu. [break] பட்டியல்ல இல்லாத property, legal கருத்து, discount எல்லாத்துக்கும் எங்க sales team மற்றும் வக்கீல் கிட்ட கேட்டு உறுதி பண்ணி சொல்றோம்.';
    } else if (lang === 'Hindi') {
      return '[thinking] Haan ji, samajh gaya. [break] Is baare me humare senior sales team aur lawyer se confirm karke aapko batayenge.';
    } else {
      return '[thinking] Ah, understood. [break] For legal opinions, unlisted properties, or special discounts, our senior sales team and lawyer will confirm directly with you.';
    }
  };

  // "Once again" Repetition Formatter:
  // When AI gives the same answer again or customer asks to repeat, it prefixes "Once again" / "Marupadiyum solren"
  const formatRepeatAnswerIfNeeded = (replyText: string, userQuery?: string): string => {
    if (!replyText || !replyText.trim()) return replyText;
    const lang = selectedLanguageRef.current;
    const cleanCurrent = replyText.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase().trim();
    const userLower = (userQuery || '').toLowerCase().trim();

    const isUserAskingRepeat =
      userLower.includes('repeat') ||
      userLower.includes('once again') ||
      userLower.includes('marupadi') ||
      userLower.includes('marubadi') ||
      userLower.includes('enna sonneenga') ||
      userLower.includes('what did you say') ||
      userLower.includes('phir se bolo') ||
      userLower.includes('dobara bolo') ||
      userLower.includes('one more time') ||
      userLower.includes('kekkala') ||
      userLower.includes('pardon');

    // Check if the AI already spoke this exact or very similar answer earlier in the call
    const previousAiReplies = dialogueRef.current
      .filter((d) => d.speaker === 'AI')
      .map((d) => d.text.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase().trim())
      .filter((text) => text.length > 15);

    const alreadySaid = previousAiReplies.some((prev) => {
      if (prev === cleanCurrent) return true;
      // High overlap check for repeated answers
      if (prev.length > 20 && cleanCurrent.length > 20) {
        const prevWords = prev.split(/\s+/).filter((w) => w.length > 3);
        const currWords = cleanCurrent.split(/\s+/).filter((w) => w.length > 3);
        if (prevWords.length >= 3 && currWords.length >= 3) {
          const matchCount = prevWords.filter((w) => currWords.includes(w)).length;
          const similarity = matchCount / Math.max(prevWords.length, currWords.length);
          if (similarity > 0.70) return true;
        }
      }
      return false;
    });

    const alreadyHasPrefix =
      cleanCurrent.startsWith('once again') ||
      cleanCurrent.startsWith('marupadi') ||
      cleanCurrent.startsWith('marubadi') ||
      cleanCurrent.startsWith('ek baar phir') ||
      cleanCurrent.startsWith('innoru vaati');

    if ((alreadySaid || isUserAskingRepeat) && !alreadyHasPrefix) {
      const strippedReply = replyText.replace(/^\[.*?\]\s*/, '');
      if (lang === 'Tamil-English') {
        return `[happy] Marupadiyum solren, ${strippedReply}`;
      } else if (lang === 'Hindi') {
        return `[happy] Ek baar phir se batati hoon, ${strippedReply}`;
      } else {
        return `[happy] Once again, ${strippedReply}`;
      }
    }

    return replyText;
  };

  const handleCustomerQuestion = async (questionText: string) => {
    const activeLang = selectedLanguageRef.current;
    const activeStep = currentStepRef.current;

    // Answer according to AI model if available
    if (geminiAvailable) {
      try {
        setIsGeminiThinking(true);
        updateCallState('AI Speaking...');
        const historyMessages = dialogueRef.current.slice(-10).map((d) => ({
          role: d.speaker === 'AI' ? ('assistant' as const) : ('user' as const),
          content: d.text,
        }));
        historyMessages.push({ role: 'user', content: questionText });
        const aiAnswer = await geminiChat(
          historyMessages,
          selectedGeminiModelRef.current,
          lead?.name,
          activeLang,
          agentName,
          voiceGenderRef.current,
          lastCustomerEmotionRef.current
        );
        setIsGeminiThinking(false);
        if (aiAnswer && aiAnswer.trim()) {
          const finalAns = formatRepeatAnswerIfNeeded(aiAnswer.trim(), questionText);
          appendDialogue('AI', finalAns);
          speakAIText(finalAns, getVoiceLangCode());
          return;
        }
      } catch (e) {
        console.warn('[handleCustomerQuestion] Gemini model error, falling back to knowledge base:', e);
        setIsGeminiThinking(false);
      }
    }

    const answer = getKnowledgeResponse(questionText, activeLang, activeStep);
    const finalAns = formatRepeatAnswerIfNeeded(answer, questionText);
    appendDialogue('AI', finalAns);
    speakAIText(finalAns, getVoiceLangCode());
  };



  // STEP 0: Language Selection Prompt (Uses the exact selected Agent so each API speaks for itself!)
  const triggerStep0LanguagePrompt = () => {
    const honorific = lead?.name ? ` ${lead.name} Sir` : ' Sir';
    const lang = selectedLanguageRef.current || initialLanguage || 'Tamil-English';
    const greeting = getOpeningGreetingPrompt(lang, honorific, agentName, voiceGenderRef.current);
    const promptText = greeting.text;
    const langCode = greeting.langCode;

    appendDialogue('AI', promptText);

    const isTamil = lang === 'Tamil-English';
    const prepared = prepareSpeech(promptText, { language: isTamil ? 'ta-IN' : langCode, emotion: 'neutral' });
    const targetEngine = resolveCurrentTtsEngine(lang);
    const cacheKey = `${targetEngine}:${voiceGenderRef.current}:${isTamil ? 'ta-IN' : prepared.languageCode}:${prepared.text}`;

    // Fast Path 1: Pre-synthesized audio for this specific agent is ready in memory -> play with 0ms delay!
    if (
      prefetchedGreetingRef.current &&
      prefetchedGreetingRef.current.key === cacheKey &&
      prefetchedGreetingRef.current.audio
    ) {
      console.log(`[Fast Startup] Playing pre-cached opening greeting for ${targetEngine.toUpperCase()} agent with 0ms delay!`);
      updateCallState('AI Speaking...');
      isSpeechSynthesisSpeakingRef.current = true;
      playAudioFromBase64(
        prefetchedGreetingRef.current.audio,
        prefetchedGreetingRef.current.format || 'audio/wav',
        undefined,
        undefined,
        undefined,
        `${targetEngine.toUpperCase()} Agent (Opening Greeting)`
      );
      return;
    }

    // Fast Path 2: Pre-fetch promise for this agent is in-flight -> attach listener to play immediately!
    if (
      prefetchedGreetingRef.current &&
      prefetchedGreetingRef.current.key === cacheKey &&
      prefetchedGreetingRef.current.promise
    ) {
      updateCallState('AI Speaking...');
      isSpeechSynthesisSpeakingRef.current = true;
      prefetchedGreetingRef.current.promise
        .then(() => {
          if (prefetchedGreetingRef.current?.audio) {
            playAudioFromBase64(
              prefetchedGreetingRef.current.audio,
              prefetchedGreetingRef.current.format || 'audio/wav',
              undefined,
              undefined,
              undefined,
              `${targetEngine.toUpperCase()} Agent (Opening Greeting)`
            );
          } else {
            speakAIText(promptText, langCode);
          }
        })
        .catch(() => {
          speakAIText(promptText, langCode);
        });
      return;
    }

    speakAIText(promptText, langCode);
  };

  // Customer selects language
  const handleSelectLanguage = async (lang: LanguageOption, fromInteraction = true) => {
    updateSelectedLanguage(lang);
    if (fromInteraction) {
      appendDialogue('Customer', lang);
    }

    // Save selected language in background without blocking live voice playback
    if (lead) {
      saveLeadLanguage(lead.id, lang).catch((err) => {
        console.error('Error saving lead language in background:', err);
      });
    }

    // Move to Step 1 and proceed to first qualification question directly
    updateCurrentStep(1);

    setTimeout(() => {
      askQuestion(1);
    }, 40);
  };

  // ─── Extractors for Knowledge Base (Property AI PDF Sections 2, 4, 6) ──────
  const parsePurpose = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('invest') || lower.includes('investment')) {
      return 'Investment Purpose (முதலீடு)';
    }
    if (lower.includes('own use') || lower.includes('own')) {
      return 'Own Use (சொந்த உபயோகம்)';
    }
    if (lower.includes('vaadagai') || lower.includes('rent') || lower.includes('rental') || lower.includes('வாடகை')) {
      return 'வாடகைக்கு வேணும் (Rent)';
    }
    if (lower.includes('nilam') || lower.includes('plot') || lower.includes('dtcp') || lower.includes('நிலம்')) {
      return 'நிலம் வாங்கணும் (Plot)';
    }
    if (lower.includes('villa')) return 'Villa (வில்லா)';
    if (lower.includes('townhouse')) return 'Townhouse';
    return 'வீடு வாங்கணும் (Buy House / Apartment)';
  };

  const parseLocation = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('velachery') || lower.includes('வேளச்சேரி')) return 'Velachery / வேளச்சேரி';
    if (lower.includes('omr') || lower.includes('sholinganallur') || lower.includes('சோழிங்கநல்லூர்')) return 'OMR, Sholinganallur / சோழிங்கநல்லூர்';
    if (lower.includes('tambaram') || lower.includes('தாம்பரம்')) return 'Tambaram / தாம்பரம்';
    if (lower.includes('adyar') || lower.includes('அடையார்')) return 'Adyar / அடையார்';
    if (lower.includes('porur') || lower.includes('போரூர்')) return 'Porur / போரூர்';
    if (lower.includes('chengalpattu') || lower.includes('செங்கல்பட்டு')) return 'Chengalpattu / செங்கல்பட்டு';
    if (lower.includes('chennai') || lower.includes('சென்னை')) return 'Chennai / சென்னை';
    return text.trim();
  };

  const parseSizeBHK = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('studio')) return 'Studio Apartment';
    if (lower.includes('one bedroom') || lower.includes('1 bedroom') || (lower.includes('1') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room')))) return '1 BHK / 1 Bedroom';
    if (lower.includes('two bedroom') || lower.includes('2 bedroom') || (lower.includes('2') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room')))) return '2 BHK / 2 Bedroom';
    if (lower.includes('three bedroom') || lower.includes('3 bedroom') || (lower.includes('3') && (lower.includes('bhk') || lower.includes('flat') || lower.includes('room')))) return '3 BHK / 3 Bedroom';
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
      return 'உடனே Ready-to-move / Immediate';
    }
    if (lower.includes('next few months') || lower.includes('few months') || lower.includes('adutha sila maasam')) {
      return 'Next few months';
    }
    if (lower.includes('compare') || lower.includes('comparing') || lower.includes('options')) {
      return 'Just options compare pannitu irukken';
    }
    if (lower.includes('1 month') || lower.includes('oru maasam') || lower.includes('மாசத்துல')) {
      return 'ஒரு மாசத்துல (Within 1 Month)';
    }
    return 'Next few months / Short wait fine';
  };

  const parseFinance = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('full cash') || lower.includes('cash') || lower.includes('கைப்பணம்') || lower.includes('direct')) {
      return 'Full Cash';
    }
    if (lower.includes('developer') || lower.includes('payment plan')) {
      return 'Developer Payment Plan';
    }
    if (lower.includes('mortgage') || lower.includes('bank loan') || lower.includes('loan') || lower.includes('bank')) {
      return 'Bank Mortgage / Loan';
    }
    return 'Bank Mortgage / Loan';
  };

  // Attribute Extractor for Live Lead Qualification Sheet (Captures all answers from the caller's complete speech)
  const extractQualificationFromInput = (_step: number, input: string, lower: string) => {
    const updates: Partial<typeof qualification> = {};

    // 1. Purpose & Buyer Type - Only extract if customer actually mentions real estate purpose
    if (
      lower.includes('buy') || lower.includes('vaanga') || lower.includes('rent') ||
      lower.includes('vaadagai') || lower.includes('plot') || lower.includes('nilam') ||
      lower.includes('flat') || lower.includes('house') || lower.includes('villa') ||
      lower.includes('invest') || lower.includes('investment') || lower.includes('வீடு') ||
      lower.includes('வாடகை') || lower.includes('நிலம்')
    ) {
      const parsed = parsePurpose(input);
      updates.purpose = parsed;
      updates.buyerOrInvestor = parsed.includes('Rent') ? 'Tenant' : parsed.includes('Plot') ? 'Plot Buyer' : 'Home Buyer';
    }

    // 2. Location - Only extract if customer actually mentions a Chennai location
    if (
      lower.includes('velachery') || lower.includes('omr') || lower.includes('tambaram') ||
      lower.includes('porur') || lower.includes('adyar') || lower.includes('chengalpattu') ||
      lower.includes('sholinganallur') || lower.includes('chennai') || lower.includes('anna nagar') ||
      lower.includes('medavakkam') || lower.includes('madipakkam') || lower.includes('guindy') ||
      lower.includes('வேளச்சேரி') || lower.includes('தாம்பரம்') || lower.includes('போரூர்')
    ) {
      updates.location = parseLocation(input);
    }

    // 3. Size / BHK - Only extract if customer actually mentions BHK or configuration
    if (lower.includes('bhk') || lower.includes('sq ft') || lower.includes('bedroom') || lower.includes('studio') || /\b(1|2|3|4)\s*bhk\b/i.test(lower) || lower.includes('பிஎச்கே')) {
      updates.sizeBHK = parseSizeBHK(input);
    }

    // 4. Budget - Only extract if customer actually mentions pricing or numbers
    if (
      lower.includes('lakh') || lower.includes('crore') || lower.includes('cr') ||
      lower.includes('budget') || /\b\d+\s*(k|l|cr|lakh|thousand)\b/i.test(lower) ||
      lower.includes('லட்சம்') || lower.includes('கோடி')
    ) {
      updates.budget = parseBudget(input);
    }

    // 5. Timeline - Only extract if customer actually mentions move-in timeline
    if (
      lower.includes('ready') || lower.includes('udane') || lower.includes('month') ||
      lower.includes('immediate') || lower.includes('2026') || lower.includes('உடனே') ||
      lower.includes('மாசம்')
    ) {
      updates.timeline = parseTimeline(input);
    }

    // 6. Finance (Loan vs Cash) - Only extract if customer actually mentions financing mode
    if (lower.includes('loan') || lower.includes('cash') || lower.includes('bank') || lower.includes('self') || lower.includes('mortgage') || lower.includes('கடன்')) {
      const finance = parseFinance(input);
      updates.loanOrCash = finance;
      const matched = getMatchedListingFromPDF({ ...qualificationRef.current, ...updates, loanOrCash: finance });
      updates.recommendedProperty = `${matched.id} - ${matched.type} (${matched.location})`;
    }

    // 7. Site Visit - Only extract if customer answers site visit
    if (
      lower.includes('visit') || lower.includes('nerla') || lower.includes('paakkanum') ||
      lower.includes('weekend') || lower.includes('weekday') || lower.includes('saturday') || lower.includes('sunday') ||
      lower.includes('brochure') || lower.includes('whatsapp')
    ) {
      const isPositive =
        lower.includes('aama') || lower.includes('ama') || lower.includes('yes') ||
        lower.includes('sure') || lower.includes('paakkanum') || lower.includes('varren') ||
        lower.includes('visit') || lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday') ||
        lower.includes('ஆமா') || lower.includes('பாக்கணும்');
      if (isPositive) {
        updates.siteVisit = `Yes - Preferred: ${input.slice(0, 50)}`;
      } else {
        updates.siteVisit = 'Brochure only via WhatsApp';
      }
    }

    if (Object.keys(updates).length > 0) {
      updateQualification(updates);
    }
  };

  // Fallback Rule Engine step execution
  const runRuleEngineStep = (activeStep: number, input: string) => {
    const lower = input.toLowerCase();
    const activeLang = selectedLanguageRef.current;

    // If customer asks a question at ANY step (FAQs from PDF Section 5)
    if (isCustomerAskingQuestion(input)) {
      handleCustomerQuestion(input);
      return;
    }

    // STEP 1: Are you free to talk check ("ask the free")
    if (activeStep === 1) {
      if (isDecliningOrBusy(input)) {
        const politeEnd =
          activeLang === 'Hindi'
            ? `[understanding] Ji Sir, koi baat nahi. Aapke liye kab baat karna convenient rahega? Main us time par call kar ${voiceGenderRef.current === 'male' ? 'sakta hoon' : 'sakti hoon'}. Have a lovely day!`
            : activeLang === 'English'
            ? "[understanding] Of course Sir, no problem. When would be a better time for me to call you back? Have a wonderful day!"
            : 'Of course, no problem. Disturb pannadhukku sorry. Ungalukku eppo call panna comfortable-aa irukkum? Illenna, neenga free-aa irukkumbodhu pesalaam.';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer was busy or not free to talk.');
        });
        return;
      // Customer responded to opening greeting -> Ask first property question directly!
      askQuestion(1);
      return;
      }
    }

    // STEP 2: PDF Question 1 (Purpose: Own use vs Investment)
    if (activeStep === 2) {
      if (isNotInterested(input)) {
        const politeEnd =
          activeLang === 'Hindi'
            ? '[calm] Ji Sir, koi problem nahi. Aapke time ke liye thank you. Aapka din achha rahe!'
            : activeLang === 'English'
            ? '[calm] Absolutely Sir, I understand. Thank you for your time. Have a lovely day!'
            : 'Seri, puriyudhu. Ungaloda time-ku thanks. Disturb pannadhukku sorry. Have a nice day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer is not interested.');
        });
        return;
      }
      if (isQuickAnswerMatch(input, 2)) {
        const parsed = parsePurpose(input);
        updateQualification({
          purpose: parsed,
          buyerOrInvestor: parsed.includes('Rent') ? 'Tenant' : parsed.includes('Plot') ? 'Plot Buyer' : 'Home Buyer',
        });
        askQuestion(2, parsed);
        return;
      } else {
        const askPurposeAgain =
          activeLang === 'Hindi'
            ? 'Aap property khareedna chahte hain, ya rent ke liye dekh rahe hain?'
            : activeLang === 'English'
            ? 'Are you looking to buy a flat/house, rent, or looking for a plot?'
            : 'Neenga veedu vaanga paakureengala, illa rent-ku paakureengala Sir?';
        appendDialogue('AI', askPurposeAgain);
        speakAIText(askPurposeAgain, getVoiceLangCode());
        return;
      }
    }

    // STEP 3: PDF Question 2 (Area: எந்த ஏரியால பாக்கறீங்க?)
    if (activeStep === 3) {
      if (isQuickAnswerMatch(input, 3)) {
        const area = parseLocation(input);
        updateQualification({ location: area });
        askQuestion(3, area);
        return;
      } else {
        const askAreaAgain =
          activeLang === 'Hindi'
            ? 'Chennai me aap kis area me property dekh rahe hain? Jaise Velachery, OMR, Tambaram?'
            : activeLang === 'English'
            ? 'Which location in Chennai are you looking in? For example Velachery, OMR, or Tambaram?'
            : 'Chennai-la ungalukku endha area convenient-aa irukkum Sir? Velachery, OMR, Tambaram maadhiri?';
        appendDialogue('AI', askAreaAgain);
        speakAIText(askAreaAgain, getVoiceLangCode());
        return;
      }
    }

    // STEP 4: PDF Question 3 (Size: எத்தனை BHK வேணும்?)
    if (activeStep === 4) {
      if (isQuickAnswerMatch(input, 4)) {
        const size = parseSizeBHK(input);
        updateQualification({ sizeBHK: size });
        askQuestion(4, size);
        return;
      } else {
        const askBhkAgain =
          activeLang === 'Hindi'
            ? 'Aapko kitne BHK ki zaroorat hai Sir? 1 BHK, 2 BHK, ya 3 BHK?'
            : activeLang === 'English'
            ? 'How many BHK are you looking for Sir? 1 BHK, 2 BHK, or 3 BHK?'
            : 'Ungalukku ethana BHK thevai padudhu Sir? 1 BHK, 2 BHK, illa 3 BHK-aa?';
        appendDialogue('AI', askBhkAgain);
        speakAIText(askBhkAgain, getVoiceLangCode());
        return;
      }
    }

    // STEP 5: PDF Question 4 (Budget: உங்க பட்ஜெட் எவ்வளவு?)
    if (activeStep === 5) {
      if (isQuickAnswerMatch(input, 5)) {
        const budget = parseBudget(input);
        updateQualification({ budget });
        askQuestion(5, budget);
        return;
      } else {
        const askBudgetAgain =
          activeLang === 'Hindi'
            ? 'Aapka approximate budget kitna rahega Sir?'
            : activeLang === 'English'
            ? 'What is your comfortable budget range Sir?'
            : 'Unga budget approximate-aa evlo plan pannirukeenga Sir?';
        appendDialogue('AI', askBudgetAgain);
        speakAIText(askBudgetAgain, getVoiceLangCode());
        return;
      }
    }

    // STEP 6: PDF Question 5 (Timeline: எப்போ குடிபோகணும்?)
    if (activeStep === 6) {
      if (isQuickAnswerMatch(input, 6)) {
        const timeline = parseTimeline(input);
        updateQualification({ timeline });
        askQuestion(6, timeline);
        return;
      } else {
        const askTimelineAgain =
          activeLang === 'Hindi'
            ? 'Aap kab tak shift hona chahte hain? Immediate ya kuch mahino me?'
            : activeLang === 'English'
            ? 'When are you planning to move in? Immediate or in a few months?'
            : 'Eppodhukulla move-in panna plan pandreenga Sir? Udane-vaa illa adutha sila maasathulaya?';
        appendDialogue('AI', askTimelineAgain);
        speakAIText(askTimelineAgain, getVoiceLangCode());
        return;
      }
    }

    // STEP 7: PDF Question 6 (Finance: லோன் போடப் போறீங்களா, இல்ல cash-ஆ?)
    if (activeStep === 7) {
      if (isQuickAnswerMatch(input, 7)) {
        const finance = parseFinance(input);
        const matched = getMatchedListingFromPDF({ ...qualificationRef.current, loanOrCash: finance });
        updateQualification({
          loanOrCash: finance,
          recommendedProperty: `${matched.id} - ${matched.type} (${matched.location})`,
        });
        askQuestion(7, matched.id);
        return;
      } else {
        const askFinanceAgain =
          activeLang === 'Hindi'
            ? 'Aap bank loan plan kar rahe hain ya self-funding / cash?'
            : activeLang === 'English'
            ? 'Are you planning for a bank home loan or self-funding / cash?'
            : 'Finance bank loan moolama paakureengala, illa direct own funds cash-aa Sir?';
        appendDialogue('AI', askFinanceAgain);
        speakAIText(askFinanceAgain, getVoiceLangCode());
        return;
      }
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

  // Main Customer Input Parser & Flow Controller (STT -> Groq Model / Rule Engine -> TTS)
  const handleCustomerInput = async (input: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    userAccumulatedSpeechRef.current = '';
    turnCommittedSpeechRef.current = '';
    speechSessionPrefixRef.current = '';
    setIsUserPausing(false);

    const cleanNormalized = normalizeCustomerSpeech(input);
    appendDialogue('Customer', cleanNormalized);
    setCurrentTextInput('');
    setLiveSpeechText('');

    const lower = cleanNormalized.toLowerCase().trim();
    const activeStep = currentStepRef.current;
    const activeLang = selectedLanguageRef.current;

    // Guard: ignore empty or whitespace-only inputs
    if (!input || lower.length < 2) {
      return;
    }

    // Step 0: Real-time Emotional Intelligence Detection
    // Primary Rule: LISTEN → UNDERSTAND THE EMOTION → SELECT THE APPROPRIATE TONE → RESPOND NATURALLY
    const detectedEmotion = detectCustomerEmotion(input);
    lastCustomerEmotionRef.current = detectedEmotion;

    // Check 1: Stop / Opt-out (Requirement 8)
    if (
      lower.includes("don't call") ||
      lower.includes('dont call') ||
      lower.includes('stop') ||
      lower.includes('do not contact') ||
      lower.includes('remove my number') ||
      lower.includes('opt out') ||
      lower.includes('opt-out') ||
      lower.includes('not interested') ||
      lower.includes('no interest')
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
      lower.includes('speak with someone') ||
      lower.includes('human agent')
    ) {
      handleAgentCallback();
      return;
    }

    // Strict work-focus: detect unrelated chit-chat and politely redirect.
    // Business words always win — property questions are never treated as off-topic.
    if (isOffTopicSmallTalk(input)) {
      offTopicTurnsRef.current += 1;
      // Repeated attempts: after three chit-chat turns, close the call humbly, never rudely
      if (offTopicTurnsRef.current >= 3) {
        const politeClose =
          activeLang === 'Hindi'
            ? 'Main sirf property madad ke liye yahan hoon. Aapse baat karke accha laga — jab property ki zaroorat ho, humari team hamesha available hai. Have a wonderful day!'
            : activeLang === 'English'
            ? "I'm here only to help with property queries. It was lovely talking with you — whenever you need property details, pricing, or bookings, our team is always happy to help. Have a wonderful day!"
            : 'Naan property vishayam mattum dhaan help panren Sir. Unga time-ku nandri — property venumna eppovum our team ready-la irukkum. Have a wonderful day!';
        appendDialogue('AI', politeClose);
        speakAIText(politeClose, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Caller repeatedly discussed off-topic subjects; agent closed politely.');
        });
        return;
      }
      const redirect = getNextOffTopicRedirect(activeLang);
      appendDialogue('AI', redirect);
      speakAIText(redirect, getVoiceLangCode());
      return;
    }
    // Back on business — reset the consecutive off-topic counter
    offTopicTurnsRef.current = 0;

    // STEP 0: Language selection step
    if (activeStep === 0) {
      const isPureLanguageChoice = /^(tamil|tanglish|தமிழ்|english|inglish|hindi|हिंदी)$/i.test(lower.trim());

      if (isPureLanguageChoice) {
        const chosen = lower.includes('hindi') || lower.includes('हिंदी')
          ? 'Hindi'
          : lower.includes('english') || lower.includes('inglish')
          ? 'English'
          : 'Tamil-English';
        handleSelectLanguage(chosen, false);
        return;
      }

      // Check if caller explicitly chose a language
      const hasLanguageSignal =
        lower.includes('tamil') || lower.includes('tanglish') || lower.includes('தமிழ்') ||
        lower.includes('english') || lower.includes('inglish') ||
        lower.includes('hindi') || lower.includes('हिंदी');

      if (hasLanguageSignal) {
        const chosen = lower.includes('hindi') || lower.includes('हिंदी')
          ? 'Hindi'
          : lower.includes('english') || lower.includes('inglish')
          ? 'English'
          : 'Tamil-English';
        handleSelectLanguage(chosen, false);
        return;
      }

      // If no language specified, default to Tamil-English and proceed directly to first property question
      handleSelectLanguage('Tamil-English', false);
      return;
    }

    // ⚡ LLM Conversational Model execution (Gemini / Groq / OpenAI -> STT -> Reasoning -> TTS)
    const isBrainActive =
      brainEngineRef.current === 'gemini' ||
      brainEngineRef.current === 'groq' ||
      brainEngineRef.current === 'openai';

    const currentEffectiveStep = currentStepRef.current;
    if (isBrainActive && (activeStep >= 1 || currentEffectiveStep >= 1)) {
      const stepForProcessing = Math.max(activeStep, currentEffectiveStep);
      // Step 1: Extract lead qualification details in background
      extractQualificationFromInput(stepForProcessing, input, lower);

      // Check if user is declining or busy in Step 1
      if (stepForProcessing === 1 && isDecliningOrBusy(input)) {
        const politeEnd =
          activeLang === 'Hindi'
            ? `[understanding] Ji Sir, koi baat nahi. Aapke liye kab baat karna convenient rahega? Main us time par call kar ${voiceGenderRef.current === 'male' ? 'sakta hoon' : 'sakti hoon'}. Have a lovely day!`
            : activeLang === 'English'
            ? "[understanding] Of course Sir, no problem. When would be a better time for me to call you back? Have a wonderful day!"
            : 'Of course, no problem. Disturb pannadhukku sorry. Ungalukku eppo call panna comfortable-aa irukkum? Illenna, neenga free-aa irukkumbodhu pesalaam.';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer was busy or not free to talk.');
        });
        return;
      }

      // Advance step indicator ONLY when user ACTUALLY answered the current step's qualification question!
      // NEVER advance automatically when the user didn't give an answer!
      const hasAnsweredCurrentStep = isQuickAnswerMatch(cleanNormalized, activeStep);
      if (hasAnsweredCurrentStep && activeStep < 9) {
        updateCurrentStep(activeStep + 1);
      }

      if (brainEngineRef.current === 'gemini') {
        setIsGeminiThinking(true);
      } else if (brainEngineRef.current === 'openai') {
        setIsOpenAiThinking(true);
      } else {
        setIsGroqThinking(true);
      }
      updateCallState('AI Speaking...');

      try {
        const historyMessages = dialogueRef.current.slice(-12).map((d) => ({
          role: d.speaker === 'AI' ? ('assistant' as const) : ('user' as const),
          content: d.text,
        }));

        let aiReply = '';
        if (brainEngineRef.current === 'gemini') {
          aiReply = await geminiChat(
            historyMessages,
            selectedGeminiModelRef.current,
            lead?.name,
            activeLang,
            agentName,
            voiceGenderRef.current,
            lastCustomerEmotionRef.current
          );
        } else if (brainEngineRef.current === 'openai') {
          try {
            aiReply = await openaiChat(
              historyMessages,
              selectedOpenAiBrainModelRef.current,
              lead?.name,
              activeLang,
              agentName,
              voiceGenderRef.current,
              lastCustomerEmotionRef.current
            );
          } catch (openAiErr) {
            console.warn('[AI Model] OpenAI failed, seamlessly falling back to Gemini:', openAiErr);
            aiReply = await geminiChat(
              historyMessages,
              selectedGeminiModelRef.current,
              lead?.name,
              activeLang,
              agentName,
              voiceGenderRef.current,
              lastCustomerEmotionRef.current
            );
          }
        } else if (brainEngineRef.current === 'groq') {
          try {
            aiReply = await groqChat(
              historyMessages,
              selectedGroqModelRef.current,
              lead?.name,
              activeLang,
              agentName,
              voiceGenderRef.current,
              lastCustomerEmotionRef.current,
              undefined,
              conversationStyleRef.current
            );
          } catch (groqErr) {
            console.warn('[AI Model] Groq failed, seamlessly falling back to Gemini 3.8 Flash:', groqErr);
            aiReply = await geminiChat(
              historyMessages,
              selectedGeminiModelRef.current,
              lead?.name,
              activeLang,
              agentName,
              voiceGenderRef.current,
              lastCustomerEmotionRef.current
            );
          }
        }

        setIsGeminiThinking(false);
        setIsGroqThinking(false);
        setIsOpenAiThinking(false);

        if (aiReply && aiReply.trim()) {
          const cleanReply = formatRepeatAnswerIfNeeded(aiReply.trim(), input);
          appendDialogue('AI', cleanReply);
          speakAIText(cleanReply, getVoiceLangCode(), () => {
            if (activeStep >= 9) {
              evaluateAndCompleteQualification({ ...qualificationRef.current, siteVisit: `Yes - Preferred: ${input}` });
            }
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Model] Call error:', err);
        setIsGeminiThinking(false);
        setIsGroqThinking(false);
        setIsOpenAiThinking(false);
      }
    }

    // Fallback: If customer is asking a question and Gemini is available, answer via Gemini
    if (isCustomerAskingQuestion(input) && geminiAvailable) {
      await handleCustomerQuestion(input);
      return;
    }

    // Fallback: Run Rule Engine with outcome determination
    runRuleEngineStep(activeStep, input);
  };

  const getVoiceLangCode = () => {
    if (selectedLanguageRef.current === 'Hindi') return 'hi-IN';
    if (selectedLanguageRef.current === 'Tamil-English') return 'ta-IN';
    return 'en-US';
  };

  // Ask one of the Qualification Questions (Property AI Knowledge Base PDF Section 2 Flow)
  const askQuestion = (qNum: number, contextValue?: string) => {
    updateCurrentStep(qNum + 1); // maps to steps 2, 3, 4, 5, 6, 7, 8, 9
    let questionText = '';
    const activeLang = selectedLanguageRef.current;
    const customerName = lead?.name || 'சார்';
    const q = qualificationRef.current;

    // PDF Q1: Purpose (Own use vs Investment - Section 5)
    if (qNum === 1) {
      if (activeLang === 'Hindi') {
        questionText = `[curious] Bahut shukriya ${customerName}! [break] Aap Chennai me ghar khareedna chahte hain, ya rent pe dekh rahe hain?`;
      } else if (activeLang === 'English') {
        questionText = `[curious] Thank you so much ${customerName}! [break] Are you looking to buy a flat or house in Chennai, or looking to rent?`;
      } else {
        questionText = `[curious] Vanakkam! [break] Neenga Chennai-la veedu vaanga paakureengala, illa rent-ku paakureengala Sir?`;
      }
    }

    // PDF Q2: Property Type & Location (Section 5)
    else if (qNum === 2) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Super! [break] Chennai me aap kaun se area me dekh rahe hain? Jaise Velachery, OMR, Tambaram, Adyar, Porur ya Chengalpattu.';
      } else if (activeLang === 'English') {
        questionText = '[curious] Great! [break] Which area in Chennai is your preference? For example Velachery, OMR, Tambaram, Adyar, Porur, or Chengalpattu.';
      } else {
        questionText = '[curious] Super! [break] Chennai-la ungalukku endha area preference Sir? Velachery, OMR, Tambaram, Porur, Adyar maadhiri endha area paakureenga?';
      }
    }

    // PDF Q3: Bedrooms and Size (Section 5)
    else if (qNum === 3) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Sahi hai! [break] Aapko kitne BHK chahiye? 1 BHK, 2 BHK, ya 3 BHK? Ya plot ke liye kitna sq ft?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Okay! [break] How many BHK do you need? 1 BHK, 2 BHK, or 3 BHK? Or plot size in sq ft?';
      } else {
        questionText = '[curious] Sahi! [break] Ungalukku ethana BHK thevai padudhu Sir? 1 BHK, 2 BHK, illa 3 BHK-aa?';
      }
    }

    // PDF Q4: Budget (Section 5 & 6)
    else if (qNum === 4) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Samajh gaya. [break] Aapka approximate budget kitna hoga Sir?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Got it! [break] What is your comfortable approximate budget range Sir?';
      } else {
        questionText = '[curious] Budget pathi konjam kekkalaama? [break] Ungalukku comfortable-aa irukkura approximate budget range evlo Sir?';
      }
    }

    // PDF Q5: Timeline (Section 5)
    else if (qNum === 5) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Achha! [break] Kab tak shift hona hai? Immediate ready-to-move chahiye ya thoda wait kar sakte hain?';
      } else if (activeLang === 'English') {
        questionText = '[curious] That helps! [break] When do you want to move in? Should it be ready now, or is a short wait fine?';
      } else {
        questionText = '[curious] Eppo shift aaga plan panreenga Sir? [break] Immediate ready-to-move venuma, illa next few months-la ok-vaa?';
      }
    }

    // PDF Q6: Payment Method (Section 6)
    else if (qNum === 6) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Sahi hai. [break] Aap bank home loan lenge ya direct cash own funds me pay karenge?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Perfect! [break] Are you planning for a bank home loan, or direct self-funding in cash?';
      } else {
        questionText = '[curious] Payment epdi plan panreenga Sir? [break] Bank home loan moolama paakureengala, illa direct cash own funds-aa?';
      }
    }

    // PDF Step 7: Match Recommendation & Confirmation (Section 9)
    else if (qNum === 7) {
      const matched = getMatchedListingFromPDF(q);
      if (activeLang === 'Hindi') {
        questionText = `${customerName}, aapki requirement note kar li hai. ${q.location || matched.location} me aapke liye matching ${q.sizeBHK || matched.type} property available hai. Kya aap iss weekend site visit ke liye aana chahenge?`;
      } else if (activeLang === 'English') {
        questionText = `${customerName}, I have noted your requirements. In ${q.location || matched.location}, there is a matching ${q.sizeBHK || matched.type} available. Would you like to schedule a site visit this weekend?`;
      } else {
        questionText = `Seri Sir, unga requirement note panniten. ${q.location || matched.location}-la ungalukku eatha ${q.sizeBHK || matched.type} property available-aa irukku. Idhoda site visit indha weekend plan pannalaama Sir?`;
      }
    }

    // PDF Step 8: Shortlist Request & Closing (Section 9)
    else if (qNum === 8) {
      if (activeLang === 'Hindi') {
        questionText = 'Zaroor! Site visit ke liye Saturday convenient rahega ya Sunday?';
      } else if (activeLang === 'English') {
        questionText = 'Sure! Which day would be convenient for the site visit? Saturday or Sunday?';
      } else {
        questionText = 'Super Sir! Site visit Saturday convenient-aa irukkuma, illa Sunday comfortable-aa irukkuma?';
      }
    }

    const finalQuestion = formatRepeatAnswerIfNeeded(questionText);
    appendDialogue('AI', finalQuestion);
    speakAIText(finalQuestion, getVoiceLangCode());
  };

  // Requirement 8: Opt-Out
  const handleOptOut = () => {
    const activeLang = selectedLanguageRef.current;
    const endMsg =
      activeLang === 'Hindi'
        ? 'Haan bilkul, samajh gayi! Main turant aapka number list se remove kar deti hoon. Aage koi call nahi aayega. Thank you, have a good day!'
        : activeLang === 'English'
        ? "I completely understand! I'm removing your number from our list right away so you won't be contacted again. Thank you, have a good day!"
        : 'Kandippa, mannichidunga. Unga request-a Do Not Contact-aa update panna team-kku forward pannuren. Inime sales follow-up panna koodaadhu-nu mark pannuvom. Thank you for letting me know.';
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
        : 'Kandippa. Ungalukku human team member kooda pesanum-nu puriyudhu. Unga request-a team-kitta pass pannuren. Convenient time edhu-nu sollunga.';
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
        : `Super, thanks for sharing. Indha details base panni verified options shortlist panna team-kitta request panren. Price, availability, fees and legal details confirm pannittu dhaan share pannuvom. Unga time-ku romba thanks! Have a nice day!`;

    appendDialogue('AI', concludingMessage);
    speakAIText(concludingMessage, getVoiceLangCode(), () => {
      finalizeCall('Completed', 'HOT', summary);
    });
  };

  // Finalize call, save to Supabase collections (calls and leads)
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

    const parsedQA = parseTranscriptToQAPairs(dialogueRef.current, transcriptText);
    const qaHistory = parsedQA.map((qa) => ({
      id: qa.id,
      stepNumber: qa.stepNumber,
      stepTitle: qa.stepTitle,
      question: qa.aiQuestion,
      answer: qa.userAnswer || '',
      extractedKey: qa.extractedKey,
      extractedValue: qa.extractedValue,
      isCustomerQuestion: qa.isCustomerQuestion,
      timestamp: qa.userTimestamp || qa.aiTimestamp,
    }));

    const endedAtStr = new Date().toISOString();
    const startedAtStr = new Date(callStartTimeRef.current).toISOString();
    const finalDuration = Math.max(duration, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    const activeLang = selectedLanguageRef.current || lead.language || 'English';
    const q = qualificationRef.current;

    // Stop recording and upload to Supabase Storage bucket 'voice-recordings'
    let recordingUrl: string | undefined = undefined;
    if (fullCallRecorderRef.current && fullCallRecorderRef.current.state !== 'inactive') {
      try {
        recordingUrl = await new Promise<string | undefined>((resolve) => {
          const rec = fullCallRecorderRef.current!;
          rec.onstop = async () => {
            setIsRecordingCall(false);
            const chunks = fullCallChunksRef.current;
            if (!chunks || chunks.length === 0) {
              resolve(undefined);
              return;
            }
            const mimeType = rec.mimeType || 'audio/webm';
            const audioBlob = new Blob(chunks, { type: mimeType });
            if (audioBlob.size < 500) {
              resolve(undefined);
              return;
            }
            try {
              setIsUploadingRecording(true);
              const formData = new FormData();
              const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
              formData.append('file', audioBlob, `call_session.${ext}`);
              formData.append('leadId', lead.id || 'lead_general');
              formData.append('callId', callSessionIdRef.current || `call_${Date.now()}`);
              formData.append('name', lead.name || '');
              formData.append('phone', lead.phone || '');

              const res = await fetch('/api/recording/upload', {
                method: 'POST',
                body: formData,
              });

              if (res.ok) {
                const data = await res.json();
                if (data.recordingUrl) {
                  setRecordedAudioUrl(data.recordingUrl);
                  resolve(data.recordingUrl);
                  return;
                }
              }
              resolve(undefined);
            } catch (err) {
              console.warn('[Call Recording] Upload failed:', err);
              resolve(undefined);
            } finally {
              setIsUploadingRecording(false);
            }
          };
          try {
            rec.stop();
          } catch (e) {
            resolve(undefined);
          }
        });
      } catch (err) {
        console.warn('[Call Recording] Error stopping recorder:', err);
      }
    }

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
          recordingReference: recordingUrl,
          qaHistory,
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
          transcript: transcriptText,
          recordingReference: recordingUrl,
          qaHistory,
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
      setErrorMessage(`Note saving to Supabase: ${saveErr.message}`);
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

  // Start live session when clicking "Start Live Call"
  const handleStartLiveCall = () => {
    setCallPhase('in_call');
    startBrowserCallSession();
  };

  // Helper to render PDF expression tags nicely in chat without breaking spoken audio
  const formatDialogueText = (raw: string) => {
    if (!raw) return '';
    const parts = raw.split(
      /(\[(?:excited|laughing|whispering|break|curious|reassuring|empathetic|calm|apologetic|confident|softly|serious|warm|happy|understanding|explaining)\])/gi
    );
    if (parts.length === 1) return raw;
    return parts.map((part, i) => {
      const match = part.match(/^\[(.*)\]$/i);
      if (match) {
        const tag = match[1].toLowerCase();
        if (tag === 'break') {
          return (
            <span
              key={i}
              className="inline-block px-1 py-0.2 mx-1 text-[9px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700/60"
              title="Pause break"
            >
              ⏸ break
            </span>
          );
        }
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 align-middle"
          >
            {tag}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!isOpen || !lead) return null;

  // ─── Setup Screen Phase: Choose Persona, Models & Combinations ───────
  if (callPhase === 'setup') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">AI Telecaller Setup</h3>
                <p className="text-xs text-slate-400">
                  Ready to call <span className="text-slate-200 font-semibold">{lead.name}</span> ({lead.phone})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Setup Options */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            {/* 1. CHOOSE PERSONA: BOY OR GIRL */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Choose Caller Persona (Boy or Girl)</span>
                </label>
                <span className="text-[11px] text-amber-400 font-medium">Select voice gender & style</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Girl: Priya */}
                <div
                  onClick={() => updateVoiceGender('female')}
                  className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${
                    voiceGender === 'female'
                      ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl">👧</span>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-extrabold text-white text-sm">Priya (Girl)</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            Client Favorite
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Warm, Polite & Empathetic</p>
                      </div>
                    </div>
                    {voiceGender === 'female' && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                    Gentle, warm, and highly persuasive. Best for residential flats, family homes, and first-time buyers.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      testVoiceSample(undefined, 'female');
                    }}
                    className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-slate-700/60"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>🔊 Preview Priya's Voice</span>
                  </button>
                </div>

                {/* Boy: Karthik */}
                <div
                  onClick={() => updateVoiceGender('male')}
                  className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${
                    voiceGender === 'male'
                      ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl">👦</span>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-extrabold text-white text-sm">Karthik (Boy)</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Authoritative
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Confident, Professional & Crisp</p>
                      </div>
                    </div>
                    {voiceGender === 'male' && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                    Confident, analytical, and articulate. Best for luxury villas, commercial plots, NRI investors, and loan queries.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      testVoiceSample(undefined, 'male');
                    }}
                    className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-slate-700/60"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>🔊 Preview Karthik's Voice</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Female voice delivery style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={conversationStyle === 'engaging'}
                  onClick={() => updateConversationStyle('engaging')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    conversationStyle === 'engaging'
                      ? 'bg-pink-500/10 border-pink-400 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">Friendly &amp; engaging</span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Warm, lively, and naturally enthusiastic when it fits.
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={conversationStyle === 'polite'}
                  onClick={() => updateConversationStyle('polite')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    conversationStyle === 'polite'
                      ? 'bg-pink-500/10 border-pink-400 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">Polite &amp; gentle</span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Courteous, calm, and patient without sounding formal.
                  </span>
                </button>
              </div>
            </div>

            {/* 2. QUICK VOICE PRESETS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Quick Voice Presets</span>
                </label>
                <span className="text-[11px] text-slate-400">Select speaking voice (Brain model remains independent below)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPreset('cartesia')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'cartesia'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-amber-400">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ Cartesia (90ms)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Sonic 3.5 Kanmani (Tamil) / Kiara — Ultra-Fast</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('deepgram')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'deepgram'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-blue-400">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span>⚡ Deepgram (140ms)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Aura-2 Asteria + Nova-2 Multilingual STT</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('speechify')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'speechify'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-purple-400">
                    <span>🎙️ Speechify Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Simba-3.5 + Abirami Tamil Voice (~500ms)</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('groq')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'groq'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-cyan-400">
                    <span>🚀 Groq Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Groq Qwen/Llama + Diana + Whisper Turbo STT</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('sarvam')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'sarvam'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-orange-400">
                    <span>🇮🇳 Sarvam Indian</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Bulbul v3 Kavitha/Gokul + Saaras Indian STT</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('murf')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'murf'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-pink-400">
                    <span>🎭 Murf AI Studio</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">GEN2 Studio Ananya / Aarav Indian Voice</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('gemini')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'gemini'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-emerald-400">
                    <span>💎 Gemini Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Gemini 2.5 Flash + Kore Female + Gemini STT</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('openai')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'openai'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-teal-400">
                    <span>✨ OpenAI All-in-One</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">tts-1 (Nova/Onyx) + Whisper-1 + GPT-4o-mini</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('free')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ttsEngine === 'browser' && brainEngine === 'rules'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center space-x-1.5 text-slate-300">
                    <span>🆓 Free Browser</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Deterministic Rules + Browser Voice (Zero Cost)</p>
                </button>
              </div>
            </div>

            {/* 3. DETAILED ENGINE CONTROLS: TTS, STT, BRAIN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {/* Voice Model (TTS) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Voice Model (TTS)</span>
                </label>
                <select
                  value={ttsEngine}
                  onChange={(e) => updateTtsEngine(e.target.value as TtsEngineChoice)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="openai">✨ OpenAI TTS (tts-1 / tts-1-hd / gpt-4o-mini-tts)</option>
                  <option value="cartesia">⚡ Cartesia Sonic 3.5 (90ms Ultra-Fast — Kanmani)</option>
                  <option value="deepgram">⚡ Deepgram Aura-2 (140ms — Asteria)</option>
                  <option value="speechify">🎙️ Speechify Simba-3.5 (500ms — Abirami Tamil)</option>
                  <option value="groq">🚀 Groq Voice (200ms — Diana)</option>
                  <option value="sarvam">🇮🇳 Sarvam AI Bulbul v3 (350ms — Kavitha)</option>
                  <option value="murf">🎭 Murf AI GEN2 (700ms — Ananya Studio)</option>
                  <option value="gemini">💎 Gemini 3.8 (1,500ms — Kore Multimodal)</option>
                  <option value="browser">🆓 Browser Web Speech (System Voice)</option>
                </select>

                {/* OpenAI TTS Sub-options (Model & Voice) */}
                {ttsEngine === 'openai' && (
                  <div className="space-y-1.5 pt-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-teal-300 font-bold block mb-1">OpenAI TTS Model:</span>
                      <select
                        value={selectedOpenAiTtsModel}
                        onChange={(e) => updateOpenAiTtsModelChoice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {OPENAI_TTS_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-teal-300 font-bold block mb-1">OpenAI Voice Persona:</span>
                      <select
                        value={selectedOpenAiVoice}
                        onChange={(e) => updateOpenAiVoiceChoice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {OPENAI_TTS_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-400">
                  {ttsEngine === 'openai'
                    ? '✨ OpenAI TTS — High-clarity neural speech with Nova/Shimmer (Priya) and Onyx/Echo (Karthik)'
                    : ttsEngine === 'cartesia'
                    ? '⚡ Cartesia Sonic 3.5 — 90ms ultra-low latency with native Tamil Kanmani / Hindi Kavya / English Kiara'
                    : ttsEngine === 'deepgram'
                    ? '⚡ Deepgram Aura-2 — 140ms lightning-fast conversational female voice'
                    : ttsEngine === 'speechify'
                    ? '🎙️ Speechify Simba-3.5 — Expressive native Indian Tamil (Abirami) & Hindi female voice'
                    : ttsEngine === 'sarvam'
                    ? '🇮🇳 Sarvam AI Bulbul v3 — Authentic Indian accent voice (Kavitha / Gokul)'
                    : ttsEngine === 'murf'
                    ? '🎭 Murf AI GEN2 — Premium studio-grade Indian English voice (Ananya / Aarav)'
                    : ttsEngine === 'gemini'
                    ? '💎 Gemini 3.8 Flash — Expressive neural voice with emotion (Kore)'
                    : ttsEngine === 'groq'
                    ? '🚀 Groq Voice — High-speed conversational female voice (Diana)'
                    : '🆓 System native browser voice (0 API cost, offline fallback)'}
                </p>
              </div>

              {/* Listening Model (STT) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hearing Model (STT)</span>
                </label>
                <select
                  value={sttEngine}
                  onChange={(e) => updateSttEngine(e.target.value as SttEngineChoice)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="openai">✨ OpenAI Whisper (whisper-1 / gpt-4o-transcribe)</option>
                  <option value="deepgram">⚡ Deepgram Nova-2 / Nova-3 (~100ms Multilingual)</option>
                  <option value="groq">🚀 Groq Whisper Large v3 Turbo (~150ms Instant)</option>
                  <option value="sarvam">🇮🇳 Sarvam Saaras (~300ms Indian Languages)</option>
                  <option value="gemini">💎 Gemini 3.8 Flash Audio STT (Multimodal)</option>
                  <option value="browser">🌐 Browser Web Speech API (Free Client-side)</option>
                </select>

                {/* OpenAI STT Sub-options (Model) */}
                {sttEngine === 'openai' && (
                  <div className="space-y-1.5 pt-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-teal-300 font-bold block mb-1">OpenAI STT Model:</span>
                    <select
                      value={selectedOpenAiSttModel}
                      onChange={(e) => updateOpenAiSttModelChoice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {OPENAI_STT_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="text-[10px] text-slate-400">
                  {sttEngine === 'openai'
                    ? '✨ OpenAI Whisper-1 — World-class multilingual audio transcription with Indian accents & Tamil'
                    : sttEngine === 'deepgram'
                    ? '⚡ Deepgram Nova-2 — 100ms instant transcription with robust Tamil & Hindi support'
                    : sttEngine === 'groq'
                    ? '🚀 Groq Whisper Large v3 Turbo — 150ms instant high-accuracy transcription'
                    : sttEngine === 'sarvam'
                    ? '🇮🇳 Sarvam Saaras v1 — Native benchmark leader for Indian accents & Tamil-English'
                    : sttEngine === 'gemini'
                    ? '💎 Gemini 3.8 Flash — Multimodal audio comprehension & noise tolerance'
                    : '🆓 Free real-time streaming browser speech recognition'}
                </p>
              </div>

              {/* Brain Model (LLM) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                  <span>Brain Model (LLM)</span>
                </label>
                <select
                  value={brainEngine}
                  onChange={(e) => updateBrainEngine(e.target.value as BrainEngineChoice)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="gemini">Gemini AI (Recommended)</option>
                  <option value="openai">✨ OpenAI GPT (gpt-4o-mini / gpt-4o)</option>
                  <option value="groq">Groq AI</option>
                  <option value="rules">Local Rule Engine (Deterministic)</option>
                </select>
                {brainEngine === 'gemini' && (
                  <select
                    value={selectedGeminiModel}
                    onChange={(e) => updateGeminiModelChoice(e.target.value)}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {GEMINI_MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                {brainEngine === 'openai' && (
                  <select
                    value={selectedOpenAiBrainModel}
                    onChange={(e) => updateOpenAiBrainModelChoice(e.target.value)}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {OPENAI_BRAIN_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                {brainEngine === 'groq' && (
                  <select
                    value={selectedGroqModel}
                    onChange={(e) => updateGroqModelChoice(e.target.value)}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {GROQ_MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {brainEngine === 'openai'
                    ? '✨ OpenAI GPT — Industry-standard conversational property advisor'
                    : brainEngine === 'gemini'
                    ? '🧠 Multimodal property reasoning & PDF context'
                    : brainEngine === 'groq'
                    ? '⚡ Sub-second conversational objection handling'
                    : '📋 100% deterministic script without API'}
                  {' '}Brain Model is fully independent from Voice Model (TTS). Choose any reasoning model with any voice.
                </p>
              </div>
            </div>

            {/* 4. PREFERRED INITIAL LANGUAGE */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 mb-2">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>4. Preferred Initial Language</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Tamil-English', label: '🇮🇳 Tamil / Tanglish' },
                  { id: 'English', label: '🇬🇧 English' },
                  { id: 'Hindi', label: '🇮🇳 Hindi (हिंदी)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setInitialLanguage(item.id as LanguageOption);
                      updateSelectedLanguage(item.id as LanguageOption);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      (selectedLanguage || initialLanguage) === item.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-950/40 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Setup Footer: Start Button */}
          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartLiveCall}
              className="px-6 py-3 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center space-x-2"
            >
              <Phone className="w-4 h-4 fill-current" />
              <span>
                Start Live Call with {agentName} ({voiceGender === 'female' ? 'Priya' : 'Karthik'})
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                  <span>
                    {voiceGender === 'female' ? '👧 Priya' : '👦 Karthik'} •{' '}
                    {ttsEngine === 'openai'
                      ? `OpenAI ${selectedOpenAiTtsModel.toUpperCase()} (${selectedOpenAiVoice})`
                      : ttsEngine === 'cartesia'
                      ? 'Cartesia Sonic Voice'
                      : ttsEngine === 'deepgram'
                      ? 'Deepgram Aura Voice'
                      : ttsEngine === 'speechify'
                      ? 'Speechify Voice'
                      : ttsEngine === 'gemini'
                      ? 'Gemini Voice'
                      : ttsEngine === 'groq'
                      ? 'Groq Voice'
                      : ttsEngine === 'sarvam'
                      ? 'Sarvam Voice'
                      : ttsEngine === 'murf'
                      ? 'Murf Falcon Voice'
                      : 'Free Browser Voice'}{' '}
                    Telecaller
                  </span>
                </span>
                <span className="text-xs text-slate-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => {
                cleanupAudioSession();
                setCallPhase('setup');
              }}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
              title="Change Voice Persona / Engine Setup"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleManualEndCall}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Call State Bar */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Status:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                callState === 'Calling...'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                  : callState === 'AI Speaking...'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : callState === 'Listening...'
                  ? isUserPausing
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse'
                  : callState === 'Connected'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              {callState === 'Listening...' && isUserPausing
                ? turnStatusLabel
                : callState}
            </span>

            {/* Live Call Recording Indicator */}
            {isRecordingCall && (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>REC • voice-recordings</span>
              </span>
            )}

            {/* Optional instant response button if user has finished speaking and wants immediate answer */}
            {callState === 'Listening...' && isUserPausing && (
              <button
                type="button"
                onClick={triggerImmediateTurn}
                className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all active:scale-95 flex items-center space-x-1 shadow-sm"
                title="Finished speaking? Click to generate response immediately"
              >
                <span>⚡ Respond Now</span>
              </button>
            )}

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

            {/* Active AI Model Engine Pill / Badge */}
            <div className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full border text-[11px] font-semibold bg-violet-500/10 text-violet-300 border-violet-500/30">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>
                {isGroqThinking || isGeminiThinking || isOpenAiThinking
                  ? '⚡ AI Thinking...'
                  : brainEngine === 'openai' && openaiAvailable
                  ? `🧠 OpenAI ${selectedOpenAiBrainModel.replace('gpt-', '').toUpperCase()} Active`
                  : brainEngine === 'gemini' && geminiAvailable
                  ? '🧠 Gemini 3.5 Active'
                  : brainEngine === 'groq' && groqAvailable && useGroqModel
                  ? '⚡ Groq Active'
                  : 'Rule Engine'}
              </span>
            </div>

            {/* Active Voice Model Pill */}
            <div className="hidden sm:flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold bg-amber-500/10 text-amber-300 border-amber-500/30">
              <Volume2 className="w-3 h-3 text-amber-400" />
              <span>Voice: {ttsEngine.toUpperCase()} ({voiceGender === 'female' ? 'Priya 👧' : 'Karthik 👦'})</span>
            </div>

            {/* Active Hearing Model Pill (On-the-fly STT switcher) */}
            <div className="hidden sm:flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
              <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
              <select
                value={sttEngine}
                onChange={(e) => updateSttEngine(e.target.value as SttEngineChoice)}
                className="bg-transparent text-emerald-300 text-[10px] font-semibold focus:outline-none cursor-pointer"
                title="Change Speech-to-Text Model"
              >
                <option value="openai" className="bg-slate-900 text-white">STT: OpenAI Whisper-1 (~200ms)</option>
                <option value="deepgram" className="bg-slate-900 text-white">STT: Deepgram Nova-2 (~100ms)</option>
                <option value="groq" className="bg-slate-900 text-white">STT: Groq Whisper Turbo (~150ms)</option>
                <option value="sarvam" className="bg-slate-900 text-white">STT: Sarvam Saaras (Indian)</option>
                <option value="gemini" className="bg-slate-900 text-white">STT: Gemini 3.8 Flash</option>
                <option value="browser" className="bg-slate-900 text-white">STT: Browser Web Speech</option>
              </select>
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

            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">STT Lang:</span>
              <select
                value={selectedLanguage || initialLanguage || 'Tamil-English'}
                onChange={(e) => {
                  const newLang = e.target.value as LanguageOption;
                  updateSelectedLanguage(newLang);
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.abort();
                    } catch (err) {}
                  }
                  setTimeout(() => {
                    if (callStateRef.current === 'Listening...' && !isTurnProcessingRef.current) {
                      startContinuousSpeechRecognition();
                    }
                  }, 50);
                }}
                className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer text-[11px]"
                title="Change Speech Recognition Language"
              >
                <option value="Tamil-English" className="bg-slate-900 text-white">🇮🇳 Tamil / Tanglish</option>
                <option value="English" className="bg-slate-900 text-white">🇬🇧 English</option>
                <option value="Hindi" className="bg-slate-900 text-white">🇮🇳 Hindi (हिंदी)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Call Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 3D Interactive Voice Sphere (Reacts Live while Speaking & Listening) */}
          {callState !== 'Call Completed' && (
            <div className="bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 border border-slate-800 rounded-3xl p-3 shadow-2xl relative overflow-hidden flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
              <VoiceSphere3D
                isSpeaking={callState === 'AI Speaking...'}
                isListening={callState === 'Listening...'}
                audioLevel={micAudioLevel}
                callState={callState}
                duration={duration}
                onSphereClick={() => {
                  if (callState === 'AI Speaking...') {
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                    }
                  } else if (callState === 'Listening...') {
                    testVoiceSample();
                  }
                }}
              />
            </div>
          )}
          {/* STEP 0: Language Selection card (Requirement 3 & 4) */}
          {currentStep === 0 && callState !== 'Call Completed' && (
            <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-center space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Globe className="w-4 h-4" />
                <span>Select Preferred Language</span>
              </div>
              <p className="text-slate-200 text-sm font-semibold max-w-md mx-auto">
                {selectedLanguage === 'Hindi'
                  ? `"Namaste! Main Lyka Realty se ${agentName} bol rahi hoon. Kya main aapka shubh naam jaan sakti hoon?"`
                  : selectedLanguage === 'English'
                  ? `"Hello! This is ${agentName} from Lyka Realty. May I know your name please?"`
                  : `"Vanakkam sir! Naan ${agentName}, Lyka Realty-lendhu pesuren. Ungaloda name therinjukkalama?"`}
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

          {/* Conversation History View Mode Selector (Talk History Section) */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400 font-semibold text-[11px] flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Talk History View Mode:</span>
            </span>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryViewTab('qa')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  historyViewTab === 'qa'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 What AI Asked vs User Answer
              </button>
              <button
                type="button"
                onClick={() => setHistoryViewTab('bubbles')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  historyViewTab === 'bubbles'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                💬 Chat Bubbles
              </button>
            </div>
          </div>

          {historyViewTab === 'qa' ? (
            <TalkHistorySection
              dialogue={dialogue}
              customerName={lead.name}
              aiName="👧 Priya (Lyka Realty)"
              liveSpeechText={liveSpeechText}
              isListening={callState === 'Listening...'}
              isSpeaking={callState === 'AI Speaking...'}
            />
          ) : (
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
                          {item.speaker === 'AI' ? `${voiceGender === 'female' ? '👧 Priya' : '👦 Karthik'} • Lyka Realty` : lead.name}
                        </span>
                        <span className="text-[9px] opacity-40 font-mono">{item.timestamp}</span>
                      </div>
                      {formatDialogueText(item.text)}
                    </div>

                    {item.speaker === 'Customer' && (
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Live streaming speech & patient listener indicator */}
              {liveSpeechText && (
                <div className="flex items-start space-x-2.5 justify-end animate-in fade-in">
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-tr-sm">
                    <div className="flex items-center justify-between text-[10px] font-bold opacity-80 mb-1">
                      <span>
                        {isUserPausing
                          ? turnStatusLabel
                          : '🎙️ Hearing you speak...'}
                      </span>
                      {isUserPausing && (
                        <button
                          type="button"
                          onClick={triggerImmediateTurn}
                          className="ml-2 px-2 py-0.5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold transition-all active:scale-95"
                          title="Click if you have finished speaking"
                        >
                          Respond Now ⚡
                        </button>
                      )}
                    </div>
                    <span className="italic">{liveSpeechText}</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                    <Mic className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Live AI Thinking / Writing Bubble Indicator */}
              {(isGroqThinking || isGeminiThinking || isOpenAiThinking) && (
                <div className="flex items-start space-x-2.5 justify-start animate-in fade-in">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-slate-800/90 text-slate-300 border border-slate-700/60 rounded-tl-sm flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-amber-400">
                      {voiceGender === 'female' ? '👧 Priya' : '👦 Karthik'} is thinking...
                    </span>
                    <span className="flex space-x-1 items-center">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={dialogueEndRef} />
            </div>
          )}

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
                  <span>Call Finished & Logged in Supabase</span>
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

              {/* Call Audio Recording (Uploaded to Supabase Storage: voice-recordings) */}
              {isUploadingRecording ? (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-2 text-xs text-amber-300">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Saving call recording to Supabase Storage (voice-recordings)...</span>
                </div>
              ) : recordedAudioUrl ? (
                <div className="p-3 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call Recording Saved (Supabase Storage: voice-recordings)</span>
                    </div>
                    <a
                      href={recordedAudioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="text-[11px] text-blue-400 hover:text-blue-300 underline font-mono flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Download audio</span>
                    </a>
                  </div>
                  <audio controls src={recordedAudioUrl} className="w-full h-8" />
                </div>
              ) : null}

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
