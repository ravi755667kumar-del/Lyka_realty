import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Building2,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Search,
  MessageSquare,
  Globe,
  Users,
  Calendar,
  Mail,
  FileText,
  BookmarkCheck,
  Award,
  TrendingUp,
  MapPin,
  Check,
  Copy,
  DollarSign,
  AlertTriangle,
  Gift,
  BadgeCheck
} from 'lucide-react';
import { LYKA_COMPANY_INFO } from '../data/dubai_knowledge';

interface AboutProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = 'why_use' | 'what_you_get' | 'sample_queries' | 'trust_guarantee';

export const AboutProjectModal: React.FC<AboutProjectModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('why_use');
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuery(text);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Dialog */}
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-600/30 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="about-modal-title" className="text-base font-semibold text-stone-800 tracking-tight">
                  About Lyka Realty
                </h2>
                <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-600/20">
                  Client & Investor Guide
                </span>
              </div>
              <p className="text-xs text-stone-500 font-normal mt-0.5">
                The purpose of this platform, what you get from this project, and how it helps you
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation - Refined Normal Professional Styling */}
        <div className="flex overflow-x-auto border-b border-slate-700 bg-slate-800/40 px-6 py-2 gap-2 text-xs font-medium scrollbar-none">
          <button
            onClick={() => setActiveTab('why_use')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'why_use'
                ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-800 hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>1. Why Use This Platform?</span>
          </button>

          <button
            onClick={() => setActiveTab('what_you_get')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'what_you_get'
                ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-800 hover:bg-slate-800/60'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>2. What Do You Get From This Project?</span>
          </button>

          <button
            onClick={() => setActiveTab('sample_queries')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sample_queries'
                ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-800 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>3. Questions You Can Ask</span>
          </button>

          <button
            onClick={() => setActiveTab('trust_guarantee')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'trust_guarantee'
                ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-800 hover:bg-slate-800/60'
            }`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>4. RERA License & Guarantees</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-stone-700 font-normal leading-relaxed">
          
          {/* TAB 1: WHY USE THIS PLATFORM? */}
          {activeTab === 'why_use' && (
            <div className="space-y-5">
              {/* Primary Value Proposition Banner */}
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 space-y-2">
                <span className="text-[11px] font-semibold text-amber-800 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                  <span>The Core Purpose of Lyka Realty</span>
                </span>
                <h3 className="text-base font-semibold text-stone-800 tracking-tight">
                  Real Estate Guidance with Total Privacy, Zero Sales Pressure, and True Pricing
                </h3>
                <p className="text-stone-600 leading-relaxed font-normal">
                  When searching for property in Dubai or Mumbai, most websites immediately demand your personal contact details, 
                  triggering frequent sales calls and aggressive broker pitches before you have even evaluated your options.
                </p>
                <p className="text-stone-700 leading-relaxed font-normal">
                  Lyka Realty was created to provide an intelligent, private, and impartial advisory environment where you can 
                  freely explore properties, calculate exact government transfer fees, check 10-Year UAE Golden Visa qualifications, 
                  and review live unit availability at your own pace.
                </p>
              </div>

              {/* Problem vs Solution Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Traditional Broker Hassles */}
                <div className="bg-slate-800/50 border border-rose-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-800 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
                    <span>Traditional Real Estate Hassles</span>
                  </div>
                  <ul className="space-y-2 text-stone-600 font-normal">
                    <li className="flex items-start space-x-2">
                      <span className="text-rose-600 font-semibold">✕</span>
                      <span>Forced contact submissions leading to unwanted sales calls.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-rose-600 font-semibold">✕</span>
                      <span>Expired or bait-and-switch listings that were sold months ago.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-rose-600 font-semibold">✕</span>
                      <span>Hidden closing charges, undisclosed service fees, and exaggerated rental ROI promises.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-rose-600 font-semibold">✕</span>
                      <span>Pushy agents steering you toward whichever developer pays the highest commission.</span>
                    </li>
                  </ul>
                </div>

                {/* The Lyka Realty Standard */}
                <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>The Lyka Realty Standard</span>
                  </div>
                  <ul className="space-y-2 text-stone-600 font-normal">
                    <li className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-stone-800 font-medium">100% Privacy & No Spam:</strong> Search and ask questions without giving away your personal contact info.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-stone-800 font-medium">Live Verified Inventory:</strong> Units marked as booked or sold are instantly removed from recommendations.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-stone-800 font-medium">Transparent Cost Invoices:</strong> Exact itemized breakdown of Dubai Land Department (4% DLD), trustee, and NOC fees.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-stone-800 font-medium">Human When Ready:</strong> Request private viewings or speak to a licensed senior broker only on your terms.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Target Audience */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-800" />
                  <span>Who Benefits Most From This Platform?</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-1">
                    <span className="font-semibold text-stone-800 block">First-Time Home Seekers</span>
                    <p className="text-stone-600 font-normal leading-relaxed">
                      Learn about communities, metro connections, schools, annual maintenance costs, and purchase steps in plain language.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-1">
                    <span className="font-semibold text-stone-800 block">Global & NRI Investors</span>
                    <p className="text-stone-600 font-normal leading-relaxed">
                      Evaluate net rental ROI (6-9%), tax efficiency between India/UAE, off-plan developer allocations, and 10-year Golden Visas.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-1">
                    <span className="font-semibold text-stone-800 block">Luxury Property Buyers</span>
                    <p className="text-stone-600 font-normal leading-relaxed">
                      Explore waterfront penthouses and private beachfront villas in Palm Jumeirah, Dubai Marina, and Mumbai prime districts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHAT DO YOU GET FROM THIS PROJECT? */}
          {activeTab === 'what_you_get' && (
            <div className="space-y-5">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-1">
                <h4 className="text-sm font-semibold text-stone-800 flex items-center space-x-2">
                  <Gift className="w-4 h-4 text-amber-800" />
                  <span>Key Benefits & Value You Receive From This Project</span>
                </h4>
                <p className="text-xs text-stone-500 font-normal">
                  Every user of Lyka Realty receives comprehensive, complimentary advisory tools and verified property services:
                </p>
              </div>

              {/* 6 Core Client Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Benefit 1 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <Building2 className="w-4 h-4 text-amber-800" />
                    <span>1. Verified Property Options with Live Availability</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    Access ready-to-move and off-plan luxury residences across Dubai and Mumbai. 
                    Includes authentic high-resolution images, exact floor plans, handover dates, 
                    and guaranteed availability (already booked or sold units are never displayed).
                  </p>
                </div>

                {/* Benefit 2 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    <span>2. Exact Closing Cost Invoices & Fee Breakdown</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    Know your total out-of-pocket costs before signing anything. 
                    Get instant itemized calculations for the Dubai Land Department (4% DLD), AED 580 DLD Admin fee, 
                    Trustee registration fees (AED 4,200), agency commissions, and service charge estimates.
                  </p>
                </div>

                {/* Benefit 3 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4 text-violet-700" />
                    <span>3. UAE 10-Year Golden Visa Eligibility Assessment</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    Clear roadmap to securing long-term UAE residency for yourself, spouse, and children through real estate investment 
                    (AED 2,000,000+). Discover how off-plan, mortgaged, or combined properties qualify.
                  </p>
                </div>

                {/* Benefit 4 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <Globe className="w-4 h-4 text-blue-700" />
                    <span>4. NRI & Cross-Border Mumbai-Dubai Guidance</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    Specialized assistance for Non-Resident Indians: compliance with RBI LRS limits ($250k/year per individual), 
                    NRE/NRO account procedures, zero capital gains tax in the UAE, and 100% tax-free rental income repatriation.
                  </p>
                </div>

                {/* Benefit 5 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <Calendar className="w-4 h-4 text-amber-800" />
                    <span>5. Free Private Viewing Booking</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    Book in-person private inspections or live video walkthroughs with 1 click directly in the chat, 
                    scheduled around your calendar without pressure.
                  </p>
                </div>

                {/* Benefit 6 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-stone-800 font-semibold text-xs">
                    <Users className="w-4 h-4 text-rose-700" />
                    <span>6. Direct Access to Senior RERA Advisors</span>
                  </div>
                  <p className="text-stone-600 font-normal leading-relaxed">
                    When you are ready to visit or negotiate, get connected directly to senior, licensed Dubai brokers 
                    matched to your preferred language (English, Arabic, Hindi, Russian) and neighborhood expertise.
                  </p>
                </div>

              </div>

              {/* Summary Value Banner */}
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-stone-800 block">All Advisory Services on this Platform are 100% Complimentary</span>
                  <span className="text-[11px] text-stone-500 font-normal">No hidden fees, no subscriptions, and no obligation to buy.</span>
                </div>
                <span className="text-xs font-medium text-emerald-800 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full shrink-0">
                  Free Client Service
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: QUESTIONS YOU CAN ASK */}
          {activeTab === 'sample_queries' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-1">
                <h4 className="text-sm font-semibold text-stone-800 flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-amber-800" />
                  <span>Real Questions You Can Ask in the Chat</span>
                </h4>
                <p className="text-xs text-stone-500 font-normal">
                  Not sure where to begin? Click "Copy" on any question below to paste it into the chat and try it out:
                </p>
              </div>

              {/* Sample Question Cards - Clean, Normal, Professional Text */}
              <div className="space-y-2.5">
                {[
                  {
                    category: 'Property Recommendations',
                    tag: 'Search',
                    tagColor: 'text-amber-800 bg-amber-500/15 border-amber-600/20',
                    query: 'Show me available 2 or 3 bedroom luxury apartments in Palm Jumeirah or Dubai Marina under 5 Million AED with sea views.'
                  },
                  {
                    category: 'Closing Cost Breakdown',
                    tag: 'Financials',
                    tagColor: 'text-emerald-800 bg-emerald-500/15 border-emerald-600/20',
                    query: 'If I purchase a villa in Dubai Hills for 4.2 Million AED, what are the total government fees, trustee charges, and agency commission?'
                  },
                  {
                    category: 'UAE Golden Visa Advisory',
                    tag: 'Visa & Residency',
                    tagColor: 'text-violet-800 bg-violet-500/15 border-violet-600/20',
                    query: 'What are the exact rules to get a 10-year UAE Golden Visa through real estate? Can I combine off-plan and ready properties to reach AED 2M?'
                  },
                  {
                    category: 'NRI Cross-Border Corridor',
                    tag: 'NRI Advisory',
                    tagColor: 'text-blue-800 bg-blue-500/15 border-blue-600/20',
                    query: 'I am based in Mumbai, India. How does the RBI LRS remittance limit work for buying off-plan in Dubai, and is rental income tax-free?'
                  },
                  {
                    category: 'Developer Payment Plans',
                    tag: 'Payment Plans',
                    tagColor: 'text-amber-800 bg-amber-500/15 border-amber-600/20',
                    query: 'What off-plan projects in Downtown Dubai have 70/30 or 80/20 payment plans with handovers in 2026 or 2027?'
                  },
                  {
                    category: 'Schedule a Private Viewing',
                    tag: 'Viewing & Advisor',
                    tagColor: 'text-rose-800 bg-rose-500/15 border-rose-600/20',
                    query: 'Can you connect me with a senior Palm Jumeirah specialist to schedule a private viewing for this Saturday?'
                  }
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="p-3.5 bg-slate-800/40 border border-slate-700/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-600/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-md border ${item.tagColor}`}>
                          {item.tag}
                        </span>
                        <span className="text-xs text-stone-500 font-normal">{item.category}</span>
                      </div>
                      <p className="text-xs text-stone-800 font-normal italic leading-relaxed">
                        "{item.query}"
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopy(item.query)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-stone-700 hover:text-stone-900 flex items-center space-x-1.5 transition-colors shrink-0 cursor-pointer self-start sm:self-center"
                      title="Copy to clipboard"
                    >
                      {copiedQuery === item.query ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="text-emerald-700 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RERA LICENSE & TRUST GUARANTEES */}
          {activeTab === 'trust_guarantee' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800">{LYKA_COMPANY_INFO.name}</h4>
                    <p className="text-xs text-stone-500 font-normal">{LYKA_COMPANY_INFO.headquarters}</p>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-600/30 text-xs font-medium">
                    {LYKA_COMPANY_INFO.license_number}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="space-y-0.5">
                    <span className="text-stone-500 font-normal">Contact Email:</span>
                    <p className="text-stone-800 font-medium">{LYKA_COMPANY_INFO.email}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-stone-500 font-normal">Concierge Phone:</span>
                    <p className="text-stone-800 font-medium">{LYKA_COMPANY_INFO.phone}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-stone-500 font-normal">Official Website:</span>
                    <p className="text-stone-800 font-medium">{LYKA_COMPANY_INFO.website}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-stone-500 font-normal">Client Portfolio:</span>
                    <p className="text-stone-800 font-medium">{LYKA_COMPANY_INFO.clients_served}</p>
                  </div>
                </div>
              </div>

              {/* Guarantees */}
              <div className="space-y-2 pt-1">
                <h5 className="text-xs font-semibold text-stone-800 uppercase tracking-wider">Our Official Commitments to Every User</h5>
                <ul className="space-y-2 text-xs text-stone-600 font-normal">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-stone-800 font-medium">Licensed & Regulated:</strong> Operating strictly under Dubai Real Estate Regulatory Authority (RERA) oversight.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-stone-800 font-medium">Escrow Protection (Law No. 8 of 2007):</strong> 100% of investor funds are held in government-monitored bank escrow accounts until construction milestones are met.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-stone-800 font-medium">Zero Fabricated Figures:</strong> All rental yields, capital growth estimates, and property prices are grounded in verifiable market transactions.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-stone-800 font-medium">Verified Developer Allocations:</strong> Direct partnerships with Dubai's tier-1 developers including Emaar, Nakheel, DAMAC, Sobha, and Meraas.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-700 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-normal text-stone-600">Lyka Realty • Luxury Real Estate Intelligence for Dubai & Mumbai</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold transition-colors shadow-xs cursor-pointer text-xs"
          >
            Got It, Back to Chat
          </button>
        </div>
      </div>
    </div>
  );
};
