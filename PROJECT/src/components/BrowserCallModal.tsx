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

  const [sttEngine, setSttEngine] = useState<SttEngineChoice>(() =>
    readStoredChoice('lyka_stt_engine', 'browser') as SttEngineChoice
  );
  const sttEngineRef = useRef<SttEngineChoice>(sttEngine);

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
    readStoredChoice('lyka_openai_voice', 'nova')
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
          text: `[warm] Namaste ${cleanLeadName} ji! Main Lyka Realty se ${name} ${verb}. Kya abhi 2 minute baat karne ka convenient time hai?`,
          langCode: 'hi-IN',
        };
      }
      return {
        text: `[warm] Namaste! Main Lyka Realty se ${name} ${verb}. Kya main aapka shubh naam jaan sakti hoon?`,
        langCode: 'hi-IN',
      };
    }
    if (lang === 'English') {
      if (cleanLeadName) {
        return {
          text: `[warm] Hello ${cleanLeadName}! This is ${name} from Lyka Realty. Is this a convenient time to speak?`,
          langCode: 'en-US',
        };
      }
      return {
        text: `[warm] Hello! This is ${name} from Lyka Realty. May I know your name please?`,
        langCode: 'en-US',
      };
    }
    // Tanglish Priya Script v2: Name-first opening
    if (cleanLeadName) {
      return {
        text: `[warm] Vanakkam ${cleanLeadName}! Naan ${name}, Lyka Realty-lendhu pesuren. Ippo konjam pesuradhukku convenient-aa irukka?`,
        langCode: 'ta-IN',
      };
    }
    return {
      text: `[warm] Vanakkam sir! Naan ${name}, Lyka Realty-lendhu pesuren. Ungaloda name therinjukkalama?`,
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
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
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

    // 1. Parallel Non-Blocking Microphone Setup (runs concurrently without blocking speech start)
    navigator.mediaDevices
      ?.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((stream) => {
        mediaStreamRef.current = stream;
        setMicActive(true);
        startAudioMeter(stream);
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
    updateCallState('Listening...');
    if (onEnd) onEnd();

    // 100ms guard delay before restarting mic — just enough to stop speaker reverb bleed
    setTimeout(() => {
      if (
        callStateRef.current === 'Listening...' &&
        !isSpeechSynthesisSpeakingRef.current &&
        !isTurnProcessingRef.current
      ) {
        if (sttEngineRef.current !== 'browser') {
          startServerSTTListening();
        } else {
          startContinuousSpeechRecognition();
        }
      }
    }, 100);

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
    updateCallState('Listening...');

    // If browser recognition is already active, keep it running smoothly without restarting
    // so the customer's full question is captured with zero missing words!
    if (sttEngineRef.current === 'browser') {
      if (!isRecognitionRunningRef.current) {
        startContinuousSpeechRecognition();
      }
    } else {
      if (!isRecordingRef.current) {
        startServerSTTListening();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch mic level — only trigger raw level barge-in if mic level is exceedingly high (> 75)
  // to avoid laptop speaker acoustic bleed-through falsely cancelling AI speech
  useEffect(() => {
    if (!isSpeechSynthesisSpeakingRef.current) {
      // Clear any pending barge-in timer when AI is not actively speaking
      if (bargeInTimerRef.current) {
        clearTimeout(bargeInTimerRef.current);
        bargeInTimerRef.current = null;
      }
      return;
    }
    // High threshold (> 75) ensures laptop speaker volume (usually 20-50) doesn't self-interrupt AI speech
    if (micAudioLevel > 75) {
      if (!bargeInTimerRef.current) {
        bargeInTimerRef.current = setTimeout(() => {
          bargeInTimerRef.current = null;
          if (isSpeechSynthesisSpeakingRef.current && micAudioLevel > 75) {
            handleBargeIn();
          }
        }, 300);
      }
    } else {
      if (bargeInTimerRef.current) {
        clearTimeout(bargeInTimerRef.current);
        bargeInTimerRef.current = null;
      }
    }
  }, [micAudioLevel, handleBargeIn]);

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
    // Fast phone telecaller playback rate (1.06x) for lively, natural pacing
    audio.playbackRate = 1.06;
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
    utterance.pitch = isMale ? 0.96 : 1.08;
    // Fast lively phone telecaller rate (1.08x)
    utterance.rate = 1.08;

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

    const safetyTimeoutMs = Math.max(3000, text.length * 85 + 2000);
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

  // Immediate Customer Speech Dispatcher (Bypasses Chrome's 2.5s silence wait & prevents repeating audio)
  const dispatchCustomerSpeech = (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    if (isSpeechSynthesisSpeakingRef.current) {
      console.log('[Interruption Dispatched] User interrupted speaking:', cleanText);
      handleBargeIn();
    } else if (isTurnProcessingRef.current) {
      console.log('[Turn Ignored] Already processing turn:', cleanText);
      return;
    }

    const now = Date.now();
    // Drop exact duplicate speech repeated within 2500ms
    if (
      lastDispatchedTextRef.current.toLowerCase() === cleanText.toLowerCase() &&
      now - lastDispatchedTimeRef.current < 2500
    ) {
      console.log('[Turn Deduplication] Dropped duplicate speech within 2.5s:', cleanText);
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
      let fullTranscript = '';
      let hasInterim = false;

      // Accumulate all speech segments from the start of this turn so no words are ever lost or truncated
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item && item[0]) {
          fullTranscript += (item[0].transcript || '') + ' ';
          if (!item.isFinal) {
            hasInterim = true;
          }
        }
      }

      const spoken = fullTranscript.trim();
      if (!spoken) return;

      // 1. Barge-In: If user speaks while AI is talking, immediately stop AI audio!
      if (isSpeechSynthesisSpeakingRef.current) {
        const spokenLower = spoken.toLowerCase().trim();
        const aiLower = (currentAiSpeechRef.current || '').toLowerCase().trim();

        // Check if customer is asking a question, interrupting, or speaking new words
        const isInterruptionIntent =
          spokenLower.includes('?') ||
          isCustomerAskingQuestion(spoken) ||
          /^(wait|stop|oru|ek|suno|listen|price|evlo|kitna|enga|enna|solunga|sollunga|tell|what|how|why|when|where|loan|bhk|advance|rent|buy|puriyudhu|aama|illa|kandippa|pesalam|pesunga|edhukku|yaaru)\b/i.test(spokenLower) ||
          (spokenLower.length > 3 && !aiLower.startsWith(spokenLower));

        // It is only pure acoustic echo if it's the exact identical string of the AI's words without user interruption intent
        const isPureEcho = !isInterruptionIntent && aiLower.length > 0 && aiLower === spokenLower;
        if (!isPureEcho) {
          console.log('[BargeIn via SpeechRecognition] User interrupted with:', spoken);
          handleBargeIn();
        } else {
          return;
        }
      }

      // 2. LIVE SPEECH WRITING: Display every word in real-time as the user talks (0ms latency!)
      setLiveSpeechText(spoken);

      // 3. CAPTURE COMPLETE USER QUERY — Smart Fast-Capture Strategy:
      // The key insight: Chrome fires isFinal=true ONLY when the user pauses or ends a sentence.
      // So we watch for the LAST result being isFinal (no more interim) = user truly stopped.
      //
      // Timings:
      // - All results finalized (no interim): user paused → commit fast in 350ms
      // - Interim still flowing (user mid-sentence): keep window open at 700ms
      // - Very short single-word answers ("yes","no","aama"): snap to 250ms
      const wordCount = spoken.trim().split(/\s+/).length;
      const isShortAnswer =
        wordCount <= 2 &&
        /^(yes|no|haan|aama|sari|ok|okay|tamil|hindi|english|illa|illai|vendaam|busy|sure|free|interested)$/i.test(spoken.trim());

      const silenceWindowMs = isShortAnswer
        ? 100          // single-word quick reply ("yes", "aama", "tamil") → answer in 100ms
        : hasInterim
        ? 300          // still speaking (natural breath pause) → wait 300ms for next word
        : 130;         // full sentence finalized (isFinal=true) → commit instantly in 130ms

      if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
      interimTimerRef.current = setTimeout(() => {
        if (!isTurnProcessingRef.current && !isSpeechSynthesisSpeakingRef.current && spoken.length > 0) {
          console.log('[Turn Complete - Full User Query Captured]:', spoken);
          dispatchCustomerSpeech(spoken);
        }
      }, silenceWindowMs);
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
      // If we are still in an active call and not processing a turn, keep recognition alive!
      if (
        callStateRef.current !== 'Call Completed' &&
        callStateRef.current !== 'Calling...' &&
        !isTurnProcessingRef.current
      ) {
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

  // ── Multi-Engine STT Listening: Gemini / Groq / Browser ─────────────────────
  const startServerSTTListening = () => {
    const selectedStt = sttEngineRef.current;
    if (selectedStt === 'browser') {
      startContinuousSpeechRecognition();
      return;
    }

    if (!mediaStreamRef.current) {
      startContinuousSpeechRecognition();
      return;
    }

    if (isRecordingRef.current) return;

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

        if (audioBlob.size < 500) {
          startServerSTTListening();
          return;
        }

        const currentLang = selectedLanguageRef.current;
        const langCode =
          currentLang === 'Hindi' ? 'hi-IN' : currentLang === 'Tamil-English' ? 'ta-IN' : 'en-IN';

        try {
          setLiveSpeechText('🎙️ Transcribing...');
          let transcript = '';
          if (selectedStt === 'deepgram') {
            transcript = await deepgramSTT(audioBlob, langCode);
          } else if (selectedStt === 'openai') {
            transcript = await openaiSTT(audioBlob, langCode, selectedOpenAiSttModelRef.current);
          } else if (selectedStt === 'groq') {
            transcript = await groqSTT(audioBlob, langCode);
          } else if (selectedStt === 'sarvam') {
            transcript = await sarvamSTT(audioBlob, langCode);
          } else if (selectedStt === 'gemini') {
            transcript = await geminiSTT(audioBlob, langCode);
          }
          setLiveSpeechText('');
          if (transcript && transcript.trim().length > 0) {
            if (noAnswerTimeoutRef.current) clearTimeout(noAnswerTimeoutRef.current);
            dispatchCustomerSpeech(transcript.trim());
          } else {
            startServerSTTListening();
          }
        } catch (err) {
          console.warn(`[${selectedStt} STT] Error, falling back to browser recognition:`, err);
          setLiveSpeechText('');
          startContinuousSpeechRecognition();
        }
      };

      // Start recording with 50ms chunks for fast audio stream delivery
      recorder.start(50);

      let hasSpoken = false;
      let silenceStart = 0;
      let vadInterval: any = null;

      const stopVAD = () => {
        if (vadInterval) {
          clearInterval(vadInterval);
          vadInterval = null;
        }
      };

      let sampleCount = 0;
      let noiseFloorSum = 0;
      let calibratedNoiseFloor = 8;

      vadInterval = setInterval(() => {
        if (recorder.state !== 'recording') {
          stopVAD();
          return;
        }

        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const averageVolume = sum / dataArray.length;

          // Dynamically calibrate ambient room and laptop fan noise in first 120ms
          if (sampleCount < 4) {
            noiseFloorSum += averageVolume;
            sampleCount++;
            calibratedNoiseFloor = Math.max(5, Math.min(20, noiseFloorSum / sampleCount));
          }

          const speechThreshold = Math.max(11, calibratedNoiseFloor + 5);
          const silenceThreshold = Math.max(7, calibratedNoiseFloor + 2.5);

          if (averageVolume > speechThreshold) {
            hasSpoken = true;
            silenceStart = 0;
          } else if (hasSpoken && averageVolume < silenceThreshold) {
            if (!silenceStart) {
              silenceStart = Date.now();
            } else if (Date.now() - silenceStart > 220) {
              // 220ms of silence after speech = user finished sentence → stop recording immediately for sub-2s speed
              stopVAD();
              if (recorder.state === 'recording') {
                try { recorder.stop(); } catch (e) { /* ignore */ }
              }
            }
          }
        }
      }, 20); // Poll every 20ms for fast silence detection

      // 6-second safety cap — captures long queries without getting stuck forever
      setTimeout(() => {
        stopVAD();
        if (mediaRecorderRef.current === recorder && recorder.state === 'recording') {
          try { recorder.stop(); } catch (e) { /* ignore */ }
        }
      }, 6000);

    } catch (err) {
      console.warn('[STT] MediaRecorder setup error:', err);
      startContinuousSpeechRecognition();
    }
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
    // Tamil question / interruption triggers
    if (/^(enna|enga|eppadi|evlo|eppo|yaaru|solreenga|solleenga|solunga|sollunga|oru kelvi|oru doubt|edhukku|yen|irunga|oru second|oru nimisham)\b/i.test(lower)) {
      return true;
    }
    const inquiryWords = [
      'who are you', 'who is this', 'who is calling', 'which company', 'why are you calling', 'why calling', 'purpose',
      'edhukku call', 'edhuku call', 'yen call', 'kyu call', 'kyun call',
      'project', 'property', 'flat', 'apartment', 'bhk', 'villa', 'house', 'amenities', 'facing', 'parking', 'lift',
      'price', 'cost', 'rate', 'rates', 'pricing', 'budget', 'lakh', 'crore', 'sqft', 'square feet',
      'location', 'city', 'velachery', 'omr', 'tambaram', 'chengalpattu', 'porur', 'adyar', 'chennai', 'sholinganallur',
      'brochure', 'catalog', 'whatsapp', 'email', 'send me', 'floor plan', 'specifications', 'details',
      'site visit', 'visit', 'appointment', 'see', 'nerla', 'timing', 'open',
      'registration', 'stamp duty', 'loan', 'patta', 'booking', 'documents', 'proof', 'advance', 'emi',
      'dtcp', 'cmda', 'rera', 'approved', 'approval', 'clear title', 'possession', 'handover', 'ready to move',
      'yaaru', 'enna', 'yenga', 'enga', 'evlo', 'vilai', 'veedu', 'anuppunga', 'visith', 'nerla', 'theriyanum', 'kidaikkuma',
      'solreenga', 'solleenga', 'sollunga', 'doubt', 'kelvi',
      'பதிவு', 'முத்திரை', 'லோன்', 'கடன்', 'பட்டா', 'முன்பணம்', 'சான்று', 'சொத்து', 'விலை', 'வீடு', 'எங்கே', 'எப்போ'
    ];
    return inquiryWords.some((w) => lower.includes(w));
  };

  const getKnowledgeResponse = (
    input: string,
    lang: LanguageOption | null,
    step: number
  ): string => {
    const lower = input.toLowerCase();

    // 0a. In-call Interruption: Wait / Hold on / Oru second
    if (
      lower.includes('wait') || lower.includes('stop') || lower.includes('hold on') ||
      lower.includes('oru second') || lower.includes('oru nimisham') || lower.includes('ek minute') ||
      lower.includes('ek second') || lower.includes('suno') || lower.includes('listen') ||
      lower.includes('irunga')
    ) {
      if (lang === 'Tamil-English') {
        return '[warm] Aan, kandippa! [break] Sollunga, naan kekkaren.';
      } else if (lang === 'Hindi') {
        return '[warm] Haan ji, bilkul! [break] Boliye, main sun rahi hoon.';
      } else {
        return "[warm] Ah, of course! [break] Go ahead, I'm listening.";
      }
    }

    // 0b. Why are you calling? / Edhukku call panneenga?
    if (
      lower.includes('why are you calling') || lower.includes('why did you call') ||
      lower.includes('why call') || lower.includes('edhukku call') || lower.includes('edhuku call') ||
      lower.includes('ethukku call') || lower.includes('yen call') || lower.includes('kyu call') ||
      lower.includes('kyun call') || lower.includes('purpose of call')
    ) {
      if (lang === 'Tamil-English') {
        return 'Neenga property enquiry pannirundheenga-nu record-la irukku. Adha follow up panna dhaan call panninen. Ippo property paakka plan irukka?';
      } else if (lang === 'Hindi') {
        return '[friendly] Haan ji, aapne property ke liye enquiry ki thi, isliye Lyka Realty se call kiya hai taaki sahi options bata sakein. Kya abhi 2 minute baat kar sakte hain?';
      } else {
        return '[friendly] Ah, yes! You had enquired about property options earlier, so I am calling from Lyka Realty to share verified listings. Do you have 2 minutes to talk?';
      }
    }

    // 0c. Are you AI? (PDF v4 / v5 Friendly Response)
    if (
      lower.includes('ai-aa') || lower.includes('are you ai') || lower.includes('are you an ai') ||
      lower.includes('are you robot') || lower.includes('robot-aa') || lower.includes('human or ai') ||
      lower.includes('real person') || lower.includes('unmaiyave priya-va')
    ) {
      if (lang === 'Tamil-English') {
        return '[laughing] Hehe! Naan Priya, Lyka Realty-oda virtual property assistant. Aana sollunga… naan AI madhiri pesuren-aa? [playful]';
      } else if (lang === 'Hindi') {
        return '[laughing] Hehe! Main Priya hoon, Lyka Realty ki virtual property assistant. Waise aapko kya lagta hai, main AI lagti hoon? [playful]';
      } else {
        return "[laughing] Hehe! I'm Priya, Lyka Realty's virtual property assistant. But tell me… do I really sound like an AI? [playful]";
      }
    }

    // 0d. Total Cost Question (PDF Section 3): Indha property total evlo aagum?
    if (
      lower.includes('total evlo') || lower.includes('total cost') || lower.includes('full cost') ||
      lower.includes('total amount') || lower.includes('extra charges')
    ) {
      if (lang === 'Tamil-English') {
        return '[thinking] Oru second, latest cost details check panren. [break] Property price-kooda DLD/registration fees, agency fee if applicable, service charges and other costs irukkalaam. Exact breakdown verify pannittu share panren.';
      } else if (lang === 'Hindi') {
        return '[thinking] Ek second, latest cost details check karti hoon. [break] Property price ke saath registration fees, agency charges aur service costs ho sakte hain. Exact breakdown confirm karke batati hoon.';
      } else {
        return '[thinking] One second, let me check the latest costs. [break] Besides property price, there may be DLD/registration fees, agency fees, and service charges. I will share the exact breakdown.';
      }
    }

    // 0e. Lowest Price Request (PDF Section 3)
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

    // 0f. Legal Approval & Safety (PDF Section 4)
    if (
      lower.includes('legal-aa') || lower.includes('legally approved') || lower.includes('rera approved') ||
      lower.includes('legal approval') || lower.includes('legal status')
    ) {
      if (lang === 'Tamil-English') {
        return '[calm] Idhu romba important question. Project registration, developer details, escrow information if applicable, title or ownership documents, and sale agreement details official records-la verify pannanum. Naan guess panni confirm panna maatten; legal team kitta check panni share panren.';
      } else if (lang === 'Hindi') {
        return '[calm] Yeh bahut important sawaal hai. Project registration, escrow details aur title documents verify karna zaroori hai. Hamari legal team confirm karke aapko batayegi.';
      } else {
        return '[calm] That is an important question. Project registration, developer details, and title documents must be verified from official records. Our legal team will confirm directly.';
      }
    }

    // 0g. Off-plan Property Safety (PDF Section 4)
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

    // 0h. Profit / Guarantee Question (PDF Section 4)
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

    // 0i. Specific JVC Area (PDF Section 5)
    if (lower.includes('jvc') || lower.includes('jumeirah village')) {
      if (lang === 'Tamil-English') {
        return '[thinking] Oru second, JVC listings and availability check panren. [break] Current inventory-la match aagura options irundha price, size, handover and payment details share panren.';
      } else if (lang === 'Hindi') {
        return '[thinking] Ek second, JVC listings check karti hoon. [break] Inventory me jo match hoga, uska price, size aur payment plan share kar doongi.';
      } else {
        return '[thinking] One second, checking JVC listings. [break] If we have matching options in current inventory, I will share the price, size, and payment details.';
      }
    }

    // 0j. Dubai Freehold Area (PDF Section 4)
    if (lower.includes('freehold') || lower.includes('ownership area')) {
      if (lang === 'Tamil-English') {
        return 'Oru important detail kekkalaama? Dubai-la freehold ownership allow pannura area-la property paakureengala? Ungalukku specific area already irukka?';
      } else if (lang === 'Hindi') {
        return 'Kya aap Dubai me freehold area me property dekh rahe hain? Koi specific area aapke dhyan me hai?';
      } else {
        return 'Are you looking for properties in Dubai freehold areas? Do you already have a specific area in mind?';
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
          appendDialogue('AI', aiAnswer.trim());
          speakAIText(aiAnswer.trim(), getVoiceLangCode());
          return;
        }
      } catch (e) {
        console.warn('[handleCustomerQuestion] Gemini model error, falling back to knowledge base:', e);
        setIsGeminiThinking(false);
      }
    }

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
      'aan', 'ah', 'aama', 'aamaa', 'ama', 'sari', 'pesalam', 'pesalaam', 'solunga', 'sollunga', 'solleenga', 'pesunga', 'kandippa',
      'puriyudhu', 'dharalama', 'kelunga', 'plan irukku'
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

    // Move to Step 1: Specifically ask if they are FREE! ("ask the free")
    updateCurrentStep(1);

    setTimeout(() => {
      const honorific = lead?.name ? ` ${lead.name} Sir` : ' Sir';
      if (lang === 'Hindi') {
        const text = `[happy] Bahut badhiya${honorific}! [break] Kya aap abhi 2 minute ke liye free hain Sir?`;
        appendDialogue('AI', text);
        speakAIText(text, 'hi-IN');
      } else if (lang === 'Tamil-English') {
        const text = `[happy] Romba nandri${honorific}! [break] Ippo oru 2 nimisham pesalaama Sir?`;
        appendDialogue('AI', text);
        speakAIText(text, 'ta-IN');
      } else {
        const text = `[happy] Thank you so much${honorific}! [break] Are you free to speak for just two minutes right now?`;
        appendDialogue('AI', text);
        speakAIText(text, 'en-US');
      }
    }, 40);
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

  // Attribute Extractor for Live Lead Qualification Sheet
  const extractQualificationFromInput = (step: number, input: string, lower: string) => {
    if (step === 2) {
      const parsed = parsePurpose(input);
      updateQualification({
        purpose: parsed,
        buyerOrInvestor: parsed.includes('Rent') ? 'Tenant' : parsed.includes('Plot') ? 'Plot Buyer' : 'Home Buyer',
      });
    } else if (step === 3) {
      const area = parseLocation(input);
      updateQualification({ location: area });
    } else if (step === 4) {
      const size = parseSizeBHK(input);
      updateQualification({ sizeBHK: size });
    } else if (step === 5) {
      const budget = parseBudget(input);
      updateQualification({ budget });
    } else if (step === 6) {
      const timeline = parseTimeline(input);
      updateQualification({ timeline });
    } else if (step === 7) {
      const finance = parseFinance(input);
      const matched = getMatchedListingFromPDF({ ...qualificationRef.current, loanOrCash: finance });
      updateQualification({
        loanOrCash: finance,
        recommendedProperty: `${matched.id} - ${matched.type} (${matched.location})`,
      });
    } else if (step === 8) {
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
      } else {
        updateQualification({ siteVisit: 'Brochure only via WhatsApp' });
      }
    } else if (step === 9) {
      updateQualification({ siteVisit: `Yes - Preferred: ${input}` });
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
            : '[understanding] Seri Sir, puriyudhu. Neenga free-aa irukkumbodhu pesalaam. Eppo call panna convenient-aa irukkum? Have a lovely day!';
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
            ? '[calm] Ji Sir, koi problem nahi. Aapke time ke liye thank you. Aapka din achha rahe!'
            : activeLang === 'English'
            ? '[calm] Absolutely Sir, I understand. Thank you for your time. Have a lovely day!'
            : '[calm] Seri Sir, parava illa. Unga time-ku romba thanks. Have a wonderful day!';
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

  // Main Customer Input Parser & Flow Controller (STT -> Groq Model / Rule Engine -> TTS)
  const handleCustomerInput = async (input: string) => {
    appendDialogue('Customer', input);
    setCurrentTextInput('');
    setLiveSpeechText('');

    const lower = input.toLowerCase().trim();
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

      // Customer spoke a sentence, question, or requirement right at the start!
      const detectedLang =
        lower.includes('hindi') || /[\u0900-\u097F]/.test(input)
          ? 'Hindi'
          : /[\u0B80-\u0BFF]/.test(input) || lower.includes('enga') || lower.includes('enna') || lower.includes('solunga') || lower.includes('velachery') || lower.includes('tamil') || lower.includes('tanglish')
          ? 'Tamil-English'
          : selectedLanguageRef.current || initialLanguage || 'English';
      updateSelectedLanguage(detectedLang);
      updateCurrentStep(1);
      // Do NOT return — fall through directly to LLM generation below to answer immediately!
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
            : '[understanding] Seri Sir, puriyudhu. Neenga free-aa irukkumbodhu pesalaam. Eppo call panna convenient-aa irukkum? Have a lovely day!';
        appendDialogue('AI', politeEnd);
        speakAIText(politeEnd, getVoiceLangCode(), () => {
          finalizeCall('Completed', 'COLD', 'Customer was busy or not free to talk.');
        });
        return;
      }

      // Check if user is asking a question or interrupting with an in-call inquiry
      const isAskingQuestion = isCustomerAskingQuestion(input);

      // Advance step indicator ONLY when answering qualification flow (NOT when asking inquiries)
      if (!isAskingQuestion && activeStep < 9) {
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
          const cleanReply = aiReply.trim();
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

    // PDF Q1: Purpose (வாங்கணுமா, வாடகைக்கா, நிலமா?)
    if (qNum === 1) {
      if (activeLang === 'Hindi') {
        questionText = `[curious] Bahut shukriya ${customerName}! [break] Aap ghar khareedna chahte hain, rent pe lena hai, ya plot khareedna hai?`;
      } else if (activeLang === 'English') {
        questionText = `[curious] Thank you so much ${customerName}! [break] Are you looking to buy a house, rent one, or buy a plot?`;
      } else {
        questionText = `[curious] Romba sandhosham ${customerName}! [break] Neenga veedu vaanganuma, vaadagaikku venuma, illa nilam (plot) vaanganuma?`;
      }
    }

    // PDF Q2: Area (எந்த ஏரியால பாக்கறீங்க?)
    else if (qNum === 2) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Super! [break] Aap kaun se area me dekh rahe hain? Jaise Velachery, OMR, Tambaram, Adyar, Porur ya Chengalpattu.';
      } else if (activeLang === 'English') {
        questionText = '[curious] Great! [break] Which area are you looking at? For example Velachery, OMR, Tambaram, Adyar, Porur, or Chengalpattu.';
      } else {
        questionText = '[curious] Super! [break] Endha area-la paakareenga? Jaise Velachery, OMR, Tambaram, Porur, Adyar, illana Chengalpattu.';
      }
    }

    // PDF Q3: Size (எத்தனை BHK வேணும்? 1, 2, இல்ல 3?)
    else if (qNum === 3) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Sahi hai. [break] Kitne BHK chahiye? 1, 2 ya 3? Ya plot ke liye kitna sq ft?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Okay. [break] How many BHK do you need? 1, 2, or 3? (Or how many sq ft for plots?)';
      } else {
        questionText = '[curious] Seri Sir. [break] Ethanai BHK venum? 1, 2, illa 3? (Plot-na evvalavu sq ft?)';
      }
    }

    // PDF Q4: Budget (உங்க பட்ஜெட் எவ்வளவு?)
    else if (qNum === 4) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Samajh gaya. [break] Aapka approximate budget kitna hoga?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Got it. [break] What is your approximate budget?';
      } else {
        questionText = '[curious] Purinjiduchu Sir. [break] Ungaloda approximate budget evvalavu irukkum?';
      }
    }

    // PDF Q5: Timeline (எப்போ குடிபோகணும்?)
    else if (qNum === 5) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Achha! [break] Kab tak shift hona hai? Immediate ready-to-move chahiye ya thoda wait kar sakte hain?';
      } else if (activeLang === 'English') {
        questionText = '[curious] That helps! [break] When do you want to move in? Should it be ready now, or is a short wait fine?';
      } else {
        questionText = '[curious] Nalla vishayam Sir. [break] Eppo move-in panna plan? Udane ready-aa irukkanuma, illa konjam naal aanaalum paravaallaya?';
      }
    }

    // PDF Q6: Finance (லோன் போடப் போறீங்களா, இல்ல cash-ஆ?)
    else if (qNum === 6) {
      if (activeLang === 'Hindi') {
        questionText = '[curious] Sahi hai. [break] Bank loan lenge ya direct cash me pay karenge?';
      } else if (activeLang === 'English') {
        questionText = '[curious] Perfect. [break] Will you take a bank loan, or pay in cash?';
      } else {
        questionText = '[curious] Correct Sir. [break] Bank loan eduthu vaanga plan-aa, illa direct cash payment-aa?';
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

              {/* Live AI Thinking / Writing Bubble Indicator */}
              {(isGroqThinking || isGeminiThinking) && (
                <div className="flex items-start space-x-2.5 justify-start animate-in fade-in">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-slate-800/90 text-slate-300 border border-slate-700/60 rounded-tl-sm flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-amber-400">
                      {voiceGender === 'female' ? '👧 Priya' : '👦 Karthik'} is writing...
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
