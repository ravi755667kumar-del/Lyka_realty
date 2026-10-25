import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  X,
  CheckCircle2,
  Lock,
  Building2,
  Scale,
  Sparkles,
  UserCheck,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export interface TermsAndPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const TermsAndPolicyModal: React.FC<TermsAndPolicyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
  onAccept,
  showAcceptButton = false
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 select-none animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-policy-title"
    >
      <div 
        className="bg-[#ffffff] dark:bg-slate-900 border border-[#e2d9c6] dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#1c1611] dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e6d2] dark:border-slate-800 flex items-center justify-between bg-[#faf6ec] dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 id="terms-policy-title" className="text-sm sm:text-base font-bold text-[#1c1611] dark:text-white">
                Legal & Privacy Center
              </h2>
              <p className="text-[11px] text-[#6b5843] dark:text-slate-400">
                Lyka Realty · Dubai & Mumbai Real Estate Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6b5843] hover:text-[#1c1611] hover:bg-[#eee4cf] dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-0 bg-[#faf6ec] dark:bg-slate-900/60 border-b border-[#f0e6d2] dark:border-slate-800 flex space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'terms'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Service</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white dark:bg-slate-900 text-xs sm:text-[13px] leading-relaxed text-[#2d2216] dark:text-slate-200">
          
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: TERMS OF SERVICE
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl flex items-start space-x-3">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#1c1611] dark:text-white">
                    Effective Date: October 2026 · Version 2.4
                  </p>
                  <p className="text-[11px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Please read these Terms carefully before creating an account or booking property viewings with Lyka Realty.
                  </p>
                </div>
              </div>

              {/* Section 1 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>Acceptance & Eligibility</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  By accessing, browsing, registering an account, or interacting with the AI agent on Lyka Realty ("the Platform"), you agree to be bound by these Terms of Service. You must be at least <strong>18 years of age</strong> to register, create a profile, schedule viewings, or execute real estate transactions. Accounts are limited strictly to one per unique email address.
                </p>
              </div>

              {/* Section 2 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>AI Advisory & Informational Scope</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  Lyka Realty operates an agentic artificial intelligence engine designed to provide curated property recommendations, market overviews, and simulated rental yield (ROI) estimations across Dubai (UAE) and Mumbai (India). All statements, predictions, and valuations provided by the AI are for <strong>informational and advisory guidance only</strong> and do not constitute certified financial underwriting, binding appraisal, or legal title guarantee.
                </p>
              </div>

              {/* Section 3 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>Verified Listings & Viewing Appointments</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  Property listings displayed on the platform reflect developer releases and verified inventory at the time of publication. While Lyka Realty actively audits listings for accuracy, property availability and unit pricing (in AED for Dubai or INR for Mumbai) remain subject to market change. Scheduling a viewing (in-person or 3D virtual tour) connects you with a designated senior advisor who conducts formal verification and legal conveyance.
                </p>
              </div>

              {/* Section 4 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">4</span>
                  <span>Account Security & Verification</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  Authentication is conducted via passwordless 6-digit email One-Time Passcodes (OTP) or verified Google OAuth. You are responsible for safeguarding access to your registered email account. You agree not to share OTP codes or allow unauthorized third parties to transact under your account identity.
                </p>
              </div>

              {/* Section 5 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">5</span>
                  <span>Intellectual Property & Platform Conduct</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  The Lyka Realty brand, proprietary system prompts, custom UI styling, database aggregations, and architectural media are protected by copyright, trademark, and international treaty provisions. Automated scraping, malicious extraction of listings, or attempts to disrupt system infrastructure are strictly prohibited.
                </p>
              </div>

              {/* Section 6 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-mono">6</span>
                  <span>Governing Law & Dispute Resolution</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  These Terms are governed by the laws of the United Arab Emirates as applicable in the Emirate of Dubai, and the laws of India for transactions in Mumbai. Any disputes arising out of the use of the platform shall be subject to the exclusive jurisdiction of the competent courts of Dubai, UAE or Mumbai, India respectively.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: PRIVACY POLICY
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-start space-x-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#1c1611] dark:text-white">
                    Privacy Commitment: UAE PDPL & DPDP Act Compliant
                  </p>
                  <p className="text-[11px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Your personal information and search criteria are encrypted and never sold to third-party ad brokers.
                  </p>
                </div>
              </div>

              {/* Section 1 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>Personal Data We Collect</span>
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-[#5a4835] dark:text-slate-300">
                  <li><strong>Account Identity:</strong> Full Name, verified Age (18+ requirement), and primary Email ID.</li>
                  <li><strong>Real Estate Preferences:</strong> Saved/favorited properties, search budget, desired communities (e.g. Palm Jumeirah, Worli), bedroom configurations, and viewing requests.</li>
                  <li><strong>Chat Transcripts:</strong> Conversation logs with Lyka AI to preserve your continuity and shortlist history across devices.</li>
                  <li><strong>Technical Telemetry:</strong> Session authentication timestamps, device display preferences (Ivory, Dark, or Navy themes), and login events.</li>
                </ul>
              </div>

              {/* Section 2 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>How We Use Your Data</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  We process data strictly to provide personalized property curation, dispatch transactional verification OTPs via Brevo, synchronize your chat history, and allow designated senior advisors to confirm viewing appointments requested by you. We do not use your information to train public AI models.
                </p>
              </div>

              {/* Section 3 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>Data Security & Passwordless Safety</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  Lyka Realty utilizes a passwordless architecture. We never ask for or store passwords on our servers. All database records are stored in secure Google Cloud Firestore environments with TLS 1.3 encryption in transit and AES-256 encryption at rest.
                </p>
              </div>

              {/* Section 4 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[10px] font-mono">4</span>
                  <span>User Rights: Update or Delete Account</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  In compliance with UAE Federal Decree-Law No. 45/2021 (PDPL) and India DPDP Act 2023, you have full ownership of your data:
                </p>
                <div className="p-2.5 bg-[#faf6ec] dark:bg-slate-800/80 rounded-xl border border-[#ebdcc4] dark:border-slate-700 text-[11px] space-y-1">
                  <p>• <strong>Instant Update:</strong> Edit your name or verified email directly in Manage Profile.</p>
                  <p>• <strong>Permanent Deletion:</strong> Tap "Delete Account & Data" in Manage Profile to instantly and permanently erase your Firestore account record and all chat sessions.</p>
                </div>
              </div>

              {/* Section 5 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#1c1611] dark:text-white flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[10px] font-mono">5</span>
                  <span>Contact Our Data Protection Officer</span>
                </h3>
                <p className="text-[#5a4835] dark:text-slate-300">
                  For privacy inquiries, rights requests, or regulatory clarifications, contact our compliance team directly at <strong className="text-amber-700 dark:text-amber-400">privacy@lykarealty.ae</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#faf6ec] dark:bg-slate-900/80 border-t border-[#f0e6d2] dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#726048] dark:text-slate-400">
            {activeTab === 'terms' ? 'Read Privacy Policy tab for data rules' : 'Read Terms of Service tab for usage rules'}
          </div>

          <div className="flex items-center space-x-2">
            {showAcceptButton && onAccept ? (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>I Agree & Accept</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-5 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
