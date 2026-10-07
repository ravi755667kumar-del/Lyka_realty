import React, { useState, useRef, useEffect } from 'react';
import { 
  ChatMessage, 
  LeadProfile, 
  PropertyListing, 
  AgenticDecision 
} from '../types/crm';
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Building2, 
  Calendar, 
  PhoneCall, 
  CheckCircle2, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  ThumbsUp, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Coins,
  Compass,
  ArrowUpRight,
  Brain,
  Share2,
  ExternalLink,
  Cpu,
  Settings,
  X,
  Zap
} from 'lucide-react';

interface AgenticChatProps {
  messages: ChatMessage[];
  currentLead: LeadProfile;
  onSendMessage: (text: string, options?: { groqApiKey?: string; groqModel?: string }) => void;
  isLoading: boolean;
  onBookViewing: (property: PropertyListing) => void;
  onOpenAgentHandoff: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const AgenticChat: React.FC<AgenticChatProps> = ({
  messages,
  currentLead,
  onSendMessage,
  isLoading,
  onBookViewing,
  onOpenAgentHandoff,
  onToggleSidebar,
  sidebarOpen,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [expandedThoughtId, setExpandedThoughtId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  
  // Model & AI Engine configuration state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');
  const [groqKeyInput, setGroqKeyInput] = useState<string>('');
  const [engineProvider, setEngineProvider] = useState<'groq' | 'gemini'>('groq');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim(), {
      groqApiKey: groqKeyInput.trim() || undefined,
      groqModel: activeModel
    });
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Text to speech (TTS)
  const handleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Web Speech Recognition
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use text input.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Gemini Style Starter Prompt Cards
  const promptCards = [
    {
      title: "Say \"Hi\" to Concierge",
      desc: "Warm polite welcome from Lyka Realty asking what you are looking for",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      prompt: "Hi, I am looking for properties with Lyka Realty."
    },
    {
      title: "Buy Waterfront 2BR",
      desc: "Dubai Marina ready apartment around AED 1.8M",
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      prompt: "I want to buy a 2-bedroom apartment in Dubai Marina around AED 1.8M ready to move in."
    },
    {
      title: "High ROI Off-Plan",
      desc: "Business Bay canal with flexible 80/20 payment plan",
      icon: <Coins className="w-4 h-4 text-amber-300" />,
      prompt: "I am an investor looking for high rental yield off-plan properties in Business Bay with a flexible payment plan."
    },
    {
      title: "Mumbai NRI Corridor",
      desc: "Worli / Bandra 3BHK or compare 8% tax-free Dubai yields",
      icon: <Compass className="w-4 h-4 text-cyan-400" />,
      prompt: "I am an NRI from Mumbai looking for luxury 3BHK in Worli or Bandra West, or comparing with Dubai tax-free yields."
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131314] text-[#e3e3e3] overflow-hidden relative font-sans">
      {/* Top Gemini-Style Header Bar */}
      <div className="h-14 border-b border-[#282a2c] px-4 sm:px-6 flex items-center justify-between bg-[#131314]/90 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          {/* Gemini sparkle badge */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-sm shadow-amber-500/20">
            <Sparkles className="w-4 h-4 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-white tracking-tight">Lyka Realty AI</span>
              
              {/* Active Model Indicator Badge */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center space-x-1 text-[10px] bg-[#1e1f20] hover:bg-[#282a2c] text-amber-300 border border-[#3c4043] px-2 py-0.5 rounded-full font-mono transition-colors"
                title="Click to configure Groq / AI Engine"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{engineProvider === 'groq' ? `Groq: ${activeModel}` : 'Gemini 2.5 Flash'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-2">
          {/* Model settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-[#9aa0a6] hover:text-white border border-[#3c4043] transition-colors"
            title="AI Model & Groq Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenAgentHandoff}
            className="hidden sm:flex items-center space-x-1.5 text-xs bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-[#3c4043] px-3 py-1.5 rounded-full transition-colors font-medium"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span>Consult Agent</span>
          </button>

          {/* Toggle CRM dossier button */}
          <button
            onClick={onToggleSidebar}
            className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              sidebarOpen
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border-[#3c4043] font-medium'
            }`}
            title="Toggle CRM Lead Profile"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>CRM Profile ({currentLead.requirement_completeness}%)</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {/* Gemini Welcome Hero if start of conversation */}
          {messages.length <= 1 && (
            <div className="py-6 sm:py-10 space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl sm:text-4xl font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
                    Hello, Welcome to Lyka Realty.
                  </span>
                </div>
                <p className="text-sm sm:text-base text-[#9aa0a6] font-normal leading-relaxed">
                  I am your AI Property Advisor for Dubai & prime India corridors. Tell me what you're looking for, and I will understand your exact requirements, qualify your CRM profile, and recommend matching properties from our verified database.
                </p>
              </div>

              {/* Gemini Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {promptCards.map((card, i) => (
                  <div
                    key={i}
                    onClick={() => onSendMessage(card.prompt, { groqApiKey: groqKeyInput.trim() || undefined, groqModel: activeModel })}
                    className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#3c4043] hover:border-amber-400/50 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 group"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-white text-xs sm:text-sm group-hover:text-amber-300 transition-colors">
                        {card.title}
                      </span>
                      <div className="p-1.5 rounded-lg bg-[#131314] border border-[#3c4043] group-hover:border-amber-400/40 transition-colors">
                        {card.icon}
                      </div>
                    </div>
                    <p className="text-xs text-[#9aa0a6] leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' ? (
                /* Gemini User Message */
                <div className="flex justify-end">
                  <div className="bg-[#282a2c] text-white px-5 py-3 rounded-3xl rounded-tr-sm max-w-xl text-sm leading-relaxed border border-[#3c4043]/50 shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* Gemini Assistant Message */
                <div className="flex items-start space-x-3 sm:space-x-4">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 shrink-0 mt-0.5 shadow-md">
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                  </div>

                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-white">Lyka Realty AI</span>
                      {msg.provider && (
                        <span className="text-[10px] bg-[#1e1f20] text-amber-300/90 border border-[#3c4043] px-2 py-0.5 rounded-full font-mono">
                          {msg.provider}
                        </span>
                      )}
                      <span className="text-[10px] text-[#9aa0a6]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Gemini "Thinking / Reasoning" Box */}
                    {msg.agentic_decision && (
                      <div>
                        <button
                          onClick={() => setExpandedThoughtId(expandedThoughtId === msg.id ? null : msg.id)}
                          className="flex items-center space-x-1.5 text-xs text-[#9aa0a6] hover:text-amber-400 transition-colors py-1 px-2.5 rounded-lg bg-[#1e1f20] border border-[#3c4043]"
                        >
                          <Brain className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-medium">
                            Agentic Reasoning • Intent: <strong className="text-white">{msg.agentic_decision.intent_detected}</strong>
                          </span>
                          {expandedThoughtId === msg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {expandedThoughtId === msg.id && (
                          <div className="mt-2 bg-[#1e1f20] border border-[#3c4043] rounded-2xl p-4 text-xs space-y-2.5 text-[#c4c7c5]">
                            <div className="flex items-center justify-between pb-2 border-b border-[#3c4043]">
                              <span className="text-[#9aa0a6]">Intent Analysis:</span>
                              <span className="font-bold text-amber-300">
                                {msg.agentic_decision.intent_detected} ({msg.agentic_decision.confidence}% completeness)
                              </span>
                            </div>

                            <div>
                              <span className="text-[#9aa0a6] block mb-1">Reasoning Logic:</span>
                              <p className="bg-[#131314] p-2.5 rounded-xl border border-[#282a2c] leading-relaxed text-[#e3e3e3]">
                                {msg.agentic_decision.rationale}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[#9aa0a6]">Next Adaptive Step:</span>
                              <span className="text-emerald-400 font-semibold">{msg.agentic_decision.next_question_intent}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main Assistant Body */}
                    <div className="text-sm text-[#e3e3e3] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Inline Verified Property Cards */}
                    {msg.recommended_properties && msg.recommended_properties.length > 0 && (
                      <div className="pt-3 space-y-3">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                          <Building2 className="w-4 h-4" />
                          <span>Matching Verified Properties ({msg.recommended_properties.length})</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {msg.recommended_properties.map((prop) => (
                            <div
                              key={prop.id}
                              className="bg-[#1e1f20] border border-[#3c4043] hover:border-amber-400/60 rounded-2xl overflow-hidden transition-all duration-200 group flex flex-col justify-between"
                            >
                              <div>
                                <div className="relative h-36 overflow-hidden">
                                  <img 
                                    src={prop.image_url} 
                                    alt={prop.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute top-2 left-2 flex items-center space-x-1">
                                    <span className="bg-amber-500/90 text-slate-950 px-1.5 py-0.5 rounded text-[9px] font-black shadow">
                                      {prop.city || (prop.id.startsWith('MUM') ? 'Mumbai' : 'Dubai')}
                                    </span>
                                    <span className="bg-[#131314]/90 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-400 border border-[#3c4043]">
                                      {prop.community}
                                    </span>
                                  </div>
                                  <div className="absolute top-2 right-2 bg-[#131314]/90 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-300 border border-[#3c4043]">
                                    {prop.status}
                                  </div>
                                </div>

                                <div className="p-3.5 space-y-1.5">
                                  <div className="flex items-baseline justify-between flex-wrap gap-1">
                                    <div>
                                      <span className="text-sm font-extrabold text-amber-400">
                                        AED {prop.price_aed.toLocaleString()}
                                      </span>
                                      <span className="text-[10px] text-slate-400 ml-1">
                                        (≈ ₹{((prop.price_inr || (prop.price_aed * 22.8)) / 10000000).toFixed(2)} Cr)
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-[#9aa0a6]">
                                      {prop.bedrooms} BR • {prop.size_sqft} sqft
                                    </span>
                                  </div>

                                  <h4 className="font-bold text-white text-xs line-clamp-1 group-hover:text-amber-300 transition-colors">
                                    {prop.title}
                                  </h4>

                                  <p className="text-[11px] text-[#9aa0a6] line-clamp-2">
                                    {prop.description}
                                  </p>

                                  <div className="text-[10px] text-emerald-400 font-semibold pt-1">
                                    {prop.expected_roi || 'High Capital Upside'}
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 pt-0 border-t border-[#282a2c] flex items-center justify-between mt-2">
                                <span className="text-[10px] text-[#9aa0a6]">{prop.developer}</span>
                                <button
                                  onClick={() => onBookViewing(prop)}
                                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-xl text-xs transition-colors flex items-center space-x-1"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Book Viewing</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gemini Message Action Bar */}
                    <div className="flex items-center space-x-2 pt-1 text-[#9aa0a6]">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 hover:text-white rounded-lg hover:bg-[#1e1f20] transition-colors"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>

                      {/* Text to Speech */}
                      <button
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className={`p-1.5 rounded-lg hover:bg-[#1e1f20] transition-colors ${
                          speakingId === msg.id ? 'text-amber-400' : 'hover:text-white'
                        }`}
                        title={speakingId === msg.id ? "Stop voice" : "Listen aloud"}
                      >
                        {speakingId === msg.id ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      {/* Like */}
                      <button
                        onClick={() => setLikedMap(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                        className={`p-1.5 rounded-lg hover:bg-[#1e1f20] transition-colors ${
                          likedMap[msg.id] ? 'text-amber-400' : 'hover:text-white'
                        }`}
                        title="Good response"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      {/* Human Agent Hand-off */}
                      <button
                        onClick={onOpenAgentHandoff}
                        className="p-1.5 hover:text-amber-400 rounded-lg hover:bg-[#1e1f20] transition-colors"
                        title="Escalate to Human Agent"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Gemini Generating Sparkle Loading */}
          {isLoading && (
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4 fill-slate-950" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-white">Lyka Realty AI</span>
                  <span className="text-[10px] text-amber-400 animate-pulse">Reasoning customer requirements...</span>
                </div>
                <div className="flex space-x-1.5 py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Gemini-Style Input Container */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-[#131314] via-[#131314]/90 to-transparent shrink-0">
        <div className="max-w-3xl mx-auto w-full">
          {/* Floating Pill Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="bg-[#1e1f20] border border-[#3c4043] focus-within:border-amber-400/80 rounded-3xl p-2 sm:p-2.5 flex items-end space-x-2 shadow-2xl transition-all duration-200"
          >
            {/* Multiline textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Lyka Realty about Dubai properties, budget, ROI, or say 'Hi'..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-0 px-3 py-1.5 text-sm text-white placeholder-[#9aa0a6] outline-none resize-none leading-relaxed min-h-[36px] max-h-[140px]"
            />

            {/* Mic voice button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-full transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
              }`}
              title={isListening ? "Listening... click to stop" : "Speak requirements"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-slate-950 transition-all shrink-0 flex items-center justify-center font-bold"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Gemini Disclaimer Caption */}
          <p className="text-[11px] text-[#9aa0a6] text-center mt-2 flex items-center justify-center space-x-2">
            <span>Lyka Realty Agentic AI</span>
            <span>•</span>
            <span className="text-amber-400/90 font-mono text-[10px]">Active: {engineProvider === 'groq' ? `Groq (${activeModel})` : 'Gemini 2.5 Flash'}</span>
            <span>•</span>
            <span>Verified Dubai & Mumbai Inventory</span>
          </p>
        </div>
      </div>

      {/* Model & Groq Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#3c4043]">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">AI Engine & Model Configuration</h3>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#9aa0a6] block mb-1 font-semibold">Active Engine Provider:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEngineProvider('groq')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      engineProvider === 'groq'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-[#131314] border-[#3c4043] text-[#9aa0a6]'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Groq High-Speed AI</span>
                    </div>
                    <p className="text-[10px] text-[#9aa0a6] mt-1">Llama 3.3 70B, Mixtral 8x7B</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEngineProvider('gemini')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      engineProvider === 'gemini'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-[#131314] border-[#3c4043] text-[#9aa0a6]'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Gemini 2.5 Flash</span>
                    </div>
                    <p className="text-[10px] text-[#9aa0a6] mt-1">Multimodal Reasoning</p>
                  </button>
                </div>
              </div>

              {engineProvider === 'groq' && (
                <>
                  <div>
                    <label className="text-[#9aa0a6] block mb-1 font-semibold">Groq Model Selection:</label>
                    <select
                      value={activeModel}
                      onChange={(e) => setActiveModel(e.target.value)}
                      className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-2.5 text-white outline-none focus:border-amber-400"
                    >
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                      <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest)</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High context)</option>
                      <option value="gemma2-9b-it">gemma2-9b-it</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#9aa0a6] block mb-1 font-semibold">
                      Custom Groq API Key (Optional — overrides .env GROQ_API_KEY):
                    </label>
                    <input
                      type="password"
                      value={groqKeyInput}
                      onChange={(e) => setGroqKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-2.5 text-white font-mono placeholder-[#5f6368] outline-none focus:border-amber-400"
                    />
                    <p className="text-[10px] text-[#9aa0a6] mt-1">
                      If left blank, the server automatically uses the <code className="text-amber-400">GROQ_API_KEY</code> set in your environment variables.
                    </p>
                  </div>
                </>
              )}

              <div className="bg-[#131314] p-3 rounded-xl border border-[#3c4043] space-y-1 text-[11px] text-[#9aa0a6]">
                <div className="flex items-center space-x-1.5 text-white font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Agentic Behavior & Greeting Rule:</span>
                </div>
                <p>
                  When a customer says "hi" or sends a greeting, the assistant will always greet them warmly on behalf of Lyka Realty and politely inquire whether they are seeking to buy, rent, or invest in properties.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
