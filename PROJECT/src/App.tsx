'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AuthUser,
  onAuthStateChanged,
  installSecureApiFetchInterceptor,
  isAuthorizedAdminUser,
  logout,
} from './lib/supabase';
import {
  installMobileApiFetchInterceptor,
  initCapacitorNativeFeatures,
  triggerHapticFeedback,
} from './lib/capacitor';
import { Lead, CampaignState } from './types';
import {
  subscribeToLeads,
  updateLead,
  deleteLead,
  bulkCreateLeads,
  clearSensitiveLocalCaches,
  restoreAdminLocalStores,
  INITIAL_DEMO_LEADS,
} from './services/leadService';
import {
  subscribeToCampaignState,
  startCampaignAPI,
  stopCampaignAPI,
  callSingleLeadAPI,
  initCampaignDoc,
  placeTwilioCall,
} from './services/campaignService';
import { Navbar } from './components/Navbar';
import { CampaignBanner } from './components/CampaignBanner';
import { MetricsCards } from './components/MetricsCards';
import { LeadsTable } from './components/LeadsTable';
import { CsvUploadModal } from './components/CsvUploadModal';
import { AddLeadModal } from './components/AddLeadModal';
import { LeadDetailsModal } from './components/LeadDetailsModal';
import { VapiSettingsModal } from './components/VapiSettingsModal';
import { KnowledgeBaseModal } from './components/KnowledgeBaseModal';
import { AddPropertyModal } from './components/AddPropertyModal';
import { CallSimulatorModal } from './components/CallSimulatorModal';
import { BrowserCallModal } from './components/BrowserCallModal';
import { Sparkles, Phone, Database, CheckCircle2, Building2, Users, Lock, ShieldAlert, LogIn, LogOut, Loader2 } from 'lucide-react';
import { AdminLoginModal } from './components/AdminLoginModal';
import { UserHistoryPanel } from './components/UserHistoryPanel';
import {
  listenToFirebaseCrmLeads,
  listenToFirebaseCrmProperties,
  writeReportBackToFirebaseCRM,
  updateCallInProgressInFirebaseCRM,
} from './services/firebaseSyncService';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaignState, setCampaignState] = useState<CampaignState | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [activeSection, setActiveSection] = useState<'pipeline' | 'history'>('pipeline');
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const isAuthorized = Boolean(user && isAuthorizedAdminUser(user));

  // Modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [addPropertyModalOpen, setAddPropertyModalOpen] = useState(false);
  const [simulatorModalOpen, setSimulatorModalOpen] = useState(false);
  const [browserCallModalOpen, setBrowserCallModalOpen] = useState(false);
  const [browserCallLead, setBrowserCallLead] = useState<Lead | null>(null);
  const [isCampaignMode, setIsCampaignMode] = useState(false);
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<Lead | null>(null);
  const [selectedLeadForSimulator, setSelectedLeadForSimulator] = useState<Lead | null>(null);

  // Install Capacitor mobile proxy & Bearer auth fetch interceptors immediately on client mount
  if (typeof window !== 'undefined') {
    installMobileApiFetchInterceptor();
    installSecureApiFetchInterceptor();
  }

  // Keep latest modal state accessible inside Android hardware back-button handler
  const handleNativeBackRef = useRef<() => boolean>(() => false);
  handleNativeBackRef.current = () => {
    if (selectedLeadForDetails) {
      setSelectedLeadForDetails(null);
      return true;
    }
    if (browserCallModalOpen) {
      setBrowserCallModalOpen(false);
      return true;
    }
    if (settingsModalOpen) {
      setSettingsModalOpen(false);
      return true;
    }
    if (knowledgeModalOpen) {
      setKnowledgeModalOpen(false);
      return true;
    }
    if (addPropertyModalOpen) {
      setAddPropertyModalOpen(false);
      return true;
    }
    if (addLeadModalOpen) {
      setAddLeadModalOpen(false);
      return true;
    }
    if (uploadModalOpen) {
      setUploadModalOpen(false);
      return true;
    }
    if (simulatorModalOpen) {
      setSimulatorModalOpen(false);
      return true;
    }
    if (loginModalOpen) {
      setLoginModalOpen(false);
      return true;
    }
    if (activeSection === 'history') {
      setActiveSection('pipeline');
      return true;
    }
    return false;
  };

  useEffect(() => {
    installMobileApiFetchInterceptor();
    installSecureApiFetchInterceptor();
    return initCapacitorNativeFeatures({
      onBackPressed: () => handleNativeBackRef.current(),
    });
  }, []);

  // Auth observer (strictly fail-closed when unauthenticated or unauthorized)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser && isAuthorizedAdminUser(currentUser)) {
        restoreAdminLocalStores();
      } else {
        setLeads([]);
        setCampaignState(null);
        setSelectedLeadForDetails(null);
        setSelectedLeadForSimulator(null);
        setBrowserCallLead(null);
        setBrowserCallModalOpen(false);
        setSettingsModalOpen(false);
        setKnowledgeModalOpen(false);
        setAddPropertyModalOpen(false);
        setAddLeadModalOpen(false);
        setUploadModalOpen(false);
        setSimulatorModalOpen(false);
        clearSensitiveLocalCaches();
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize campaign doc ONLY after authenticated admin session is verified
  useEffect(() => {
    if (!isAuthorized) return;
    initCampaignDoc().catch((err) => console.log('Campaign doc init note:', err));
  }, [isAuthorized]);

  // Subscribe to Leads ONLY when authorized
  useEffect(() => {
    if (!isAuthorized) return;
    const unsub = subscribeToLeads(
      (updatedLeads) => {
        setLeads(updatedLeads);
      },
      (err) => {
        console.error('Error in leads listener:', err);
      }
    );
    return () => unsub();
  }, [isAuthorized]);

  // Subscribe to Campaign state ONLY when authorized
  useEffect(() => {
    if (!isAuthorized) return;
    const unsub = subscribeToCampaignState(
      (state) => {
        setCampaignState(state);
      },
      (err) => {
        console.error('Error in campaign listener:', err);
      }
    );
    return () => unsub();
  }, [isAuthorized]);

  // Synchronize live with External Firebase CRM ONLY when authorized
  useEffect(() => {
    if (!isAuthorized) return;
    const unsubLeads = listenToFirebaseCrmLeads({
      onLeadsUpdated: (fbLeads) => {
        if (fbLeads && fbLeads.length > 0) {
          setLeads((prev) => {
            const map = new Map(prev.map((l) => [l.id, l]));
            fbLeads.forEach((fbLead) => {
              const existing = map.get(fbLead.id);
              map.set(fbLead.id, existing ? { ...existing, ...fbLead } : fbLead);
            });
            return Array.from(map.values());
          });
        }
      },
      onNewPendingLead: (newLead) => {
        notify(`New customer from Super Admin CRM: ${newLead.name} (${newLead.phone})`);
      },
      onError: (err) => {
        console.log('Firebase CRM Leads sync note:', err.message);
      },
    });

    const unsubProps = listenToFirebaseCrmProperties({
      onPropertiesUpdated: (props) => {
        if (props.length > 0) {
          notify(`Synced ${props.length} projects from Property Admin CRM to AI Knowledge Base`);
        }
      },
      onError: (err) => {
        console.log('Firebase CRM Properties sync note:', err.message);
      },
    });

    return () => {
      unsubLeads();
      unsubProps();
    };
  }, [isAuthorized]);

  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 4000);
  };

  const getNextPendingLead = (currentLeadId?: string) => {
    return (
      leads.find(
        (l) =>
          l.id !== currentLeadId &&
          (l.status === 'Pending' || l.status === 'PENDING') &&
          l.consent &&
          !l.blocked
      ) || null
    );
  };

  const handleStartCampaign = async () => {
    void triggerHapticFeedback('medium');
    const firstPendingLead = leads.find(
      (l) => (l.status === 'Pending' || l.status === 'PENDING') && l.consent && !l.blocked
    );

    if (firstPendingLead) {
      setIsCampaignMode(true);
      setBrowserCallLead(firstPendingLead);
      setBrowserCallModalOpen(true);
      notify(`Campaign started! Calling first customer: ${firstPendingLead.name} (${firstPendingLead.phone})`);
    } else {
      notify('All leads have already been qualified or none are pending.');
    }

    try {
      await startCampaignAPI();
    } catch (e) {
      console.log('Campaign API background sync:', e);
    }
  };

  const handleStopCampaign = async () => {
    void triggerHapticFeedback('light');
    setIsCampaignMode(false);
    try {
      await stopCampaignAPI();
    } catch (e) {
      console.log('Campaign stop sync:', e);
    }
    notify('Campaign paused. Sequential calling stopped.');
  };

  const handleNextLeadInCampaign = () => {
    const next = getNextPendingLead(browserCallLead?.id);
    if (next) {
      setBrowserCallLead(next);
      notify(`Calling next customer in queue: ${next.name} (${next.phone})`);
    } else {
      setIsCampaignMode(false);
      setBrowserCallModalOpen(false);
      setBrowserCallLead(null);
      notify('All pending customers in your pipeline have been completed!');
    }
  };

  const handleCallSingleLead = (lead: Lead) => {
    void triggerHapticFeedback('medium');
    setIsCampaignMode(false);
    setBrowserCallLead(lead);
    setBrowserCallModalOpen(true);
    // Real-time update for Sales Manager: AI call started
    updateCallInProgressInFirebaseCRM({
      leadId: lead.id,
      lead,
      callingMethod: 'Web Browser AI Voice Agent',
    }).catch(() => {});
  };

  const handlePhysicalCallLead = async (lead: Lead) => {
    void triggerHapticFeedback('heavy');
    try {
      notify(`Initiating real phone call to ${lead.name} (${lead.phone}) via Twilio...`);
      // Real-time update for Sales Manager: Outbound Twilio call dialing
      updateCallInProgressInFirebaseCRM({
        leadId: lead.id,
        lead,
        callingMethod: 'Twilio Real Phone Call (PSTN)',
      }).catch(() => {});

      const res = await placeTwilioCall({
        leadId: lead.id,
        phone: lead.phone,
        name: lead.name,
        language: lead.language || 'English',
      });

      if (res.success) {
        notify(`📞 Real phone ringing! Call placed to ${lead.name} via Twilio.`);
        await updateLead(lead.id, {
          status: 'Calling',
          callCount: (lead.callCount || 0) + 1,
          callTime: new Date().toISOString(),
          duration: 35,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error('Twilio physical call error:', err);
      if (err.message && err.message.toLowerCase().includes('not configured')) {
        setSettingsModalOpen(true);
      }
      notify(`Twilio Error: ${err.message || 'Failed to place physical call'}`);
    }
  };

  const handleToggleBlock = async (lead: Lead) => {
    const newBlocked = !lead.blocked;
    await updateLead(lead.id, {
      blocked: newBlocked,
      outcome: newBlocked ? 'OPT-OUT' : lead.outcome === 'OPT-OUT' ? 'PENDING' : lead.outcome,
    });
    notify(`${lead.name} is now ${newBlocked ? 'Blocked (DNC)' : 'Unblocked'}`);
  };

  const handleDeleteLead = async (leadId: string) => {
    await deleteLead(leadId);
    notify('Lead removed from database.');
  };

  // Seed verified sample customer leads with full qualification details (budget, location, timeline, transcript, Q&A)
  const handleSeedSampleLeads = async () => {
    const sample = INITIAL_DEMO_LEADS.map((l) => ({
      name: l.name,
      phone: l.phone,
      consent: l.consent,
      blocked: l.blocked,
      status: l.status,
      language: l.language,
      outcome: l.outcome,
      callCount: l.callCount,
      callTime: l.callTime,
      duration: l.duration,
      summary: l.summary,
      transcript: l.transcript,
      qaHistory: l.qaHistory,
      buyerOrInvestor: l.buyerOrInvestor,
      budget: l.budget,
      location: l.location,
      timeline: l.timeline,
      nextAction: l.nextAction,
    }));
    await bulkCreateLeads(sample);
    notify('Loaded customer leads with full qualification details & call transcripts!');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex items-center space-x-3 bg-slate-900/90 border border-slate-800 px-6 py-4 rounded-2xl shadow-2xl">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-sm font-semibold text-slate-200">
            Verifying encrypted admin session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            {user ? <ShieldAlert className="w-8 h-8 text-red-400" /> : <Lock className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Lyka Realty — Protected Vault
            </h1>
            {user ? (
              <p className="text-sm text-red-300 leading-relaxed">
                Signed in as <span className="font-semibold text-white">{user.email}</span>, which
                is not authorized for admin data access.
              </p>
            ) : (
              <p className="text-sm text-slate-400 leading-relaxed">
                Customer phone numbers, call transcripts, user history, and telephony controls are
                strictly locked. Sign in with an authorized admin account to continue.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  clearSensitiveLocalCaches();
                  await logout();
                }}
                className="w-full flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl font-bold bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out & Switch Account</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="w-full flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Admin Portal</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Zero unauthenticated exposure • Token-verified API access
          </p>
        </div>

        <AdminLoginModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Navigation Bar */}
      <Navbar
        user={user}
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenUpload={() => setUploadModalOpen(true)}
        onOpenAddLead={() => setAddLeadModalOpen(true)}
        onOpenAddProperty={() => setAddPropertyModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenKnowledge={() => setKnowledgeModalOpen(true)}
        onOpenSimulator={() => {
          setSelectedLeadForSimulator(leads[0] || null);
          setSimulatorModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full space-y-5 sm:space-y-8 animate-in fade-in duration-300">
        {/* Top-Level Section Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveSection('pipeline')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                activeSection === 'pipeline'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Lead Qualification Pipeline</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeSection === 'pipeline'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {leads.length}
              </span>
            </button>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {activeSection === 'history'
              ? 'Viewing caller mobile numbers, languages used, Q&A logs & full transcripts'
              : 'Manage leads, run AI voice campaigns & monitor live qualification'}
          </span>
        </div>

        {/* Floating Notification Toast */}
        {statusNotification && (
          <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 bg-slate-900 border border-amber-400 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-300">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold">{statusNotification}</span>
          </div>
        )}

        {activeSection === 'history' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6 shadow-xl">
            <UserHistoryPanel
              refreshKey={historyRefreshKey}
              leads={leads}
              onViewLead={(lead) => setSelectedLeadForDetails(lead)}
              onCallLead={handleCallSingleLead}
              variant="page"
            />
          </section>
        ) : (
          <>
            {/* Empty State Banner if no leads */}
            {leads.length === 0 && (
              <div className="bg-gradient-to-r from-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">No Leads in Pipeline</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                    Upload your CSV containing customer phone numbers and consent, or load authorized test leads.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleSeedSampleLeads}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md"
                  >
                    Load Test Leads (Rahul, Amit, Priya)
                  </button>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    Upload CSV
                  </button>
                </div>
              </div>
            )}

            {/* 1. Campaign Control Banner */}
            <CampaignBanner
              campaignState={campaignState}
              leads={leads}
              onStartCampaign={handleStartCampaign}
              onStopCampaign={handleStopCampaign}
            />

            {/* 2. Today's Performance & Pipeline Metrics */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <MetricsCards
                leads={leads}
                activeFilter={activeFilter}
                onSelectFilter={(f) => setActiveFilter(f)}
                onViewLead={(lead) => setSelectedLeadForDetails(lead)}
                onCallLead={handleCallSingleLead}
                onPhysicalCallLead={handlePhysicalCallLead}
              />
            </div>

            {/* 3. Leads Master Table (Visible to all) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Lead Qualification Pipeline</h3>
                  <p className="text-xs text-slate-400">
                    Live Supabase synchronization • Automated classification after every call
                  </p>
                </div>
                {leads.length > 0 && (
                  <button
                    onClick={handleSeedSampleLeads}
                    className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
                  >
                    + Add Sample Leads
                  </button>
                )}
              </div>

              <LeadsTable
                leads={leads}
                activeFilter={activeFilter}
                onSelectFilter={(f) => setActiveFilter(f)}
                onCallLead={handleCallSingleLead}
                onPhysicalCallLead={handlePhysicalCallLead}
                onViewLead={(lead) => setSelectedLeadForDetails(lead)}
                onToggleBlock={handleToggleBlock}
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 pb-safe text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Lyka Realty AI Voice Qualification Engine • Next.js, Tailwind CSS & Supabase</span>
          <span>Outbound PSTN Mobile Telephony • Zero Client-Side Secret Exposure</span>
        </div>
      </footer>

      {/* Modals */}
      <AdminLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <CsvUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => notify('CSV leads successfully imported to Supabase!')}
      />

      <AddLeadModal
        isOpen={addLeadModalOpen}
        onClose={() => setAddLeadModalOpen(false)}
        onSuccess={() => notify('Lead added to pipeline!')}
      />

      <LeadDetailsModal
        lead={selectedLeadForDetails}
        isOpen={Boolean(selectedLeadForDetails)}
        onClose={() => setSelectedLeadForDetails(null)}
        onCallLead={(lead) => {
          setSelectedLeadForDetails(null);
          handleCallSingleLead(lead);
        }}
        onToggleBlock={handleToggleBlock}
        onDeleteLead={handleDeleteLead}
      />

      <VapiSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      <KnowledgeBaseModal
        isOpen={knowledgeModalOpen}
        onClose={() => setKnowledgeModalOpen(false)}
        onOpenAddProperty={() => setAddPropertyModalOpen(true)}
      />

      <AddPropertyModal
        isOpen={addPropertyModalOpen}
        onClose={() => setAddPropertyModalOpen(false)}
        onPropertyAdded={(newProp) => {
          notify(`Property "${newProp.title}" added & synced with AI Agent!`);
        }}
      />

      <CallSimulatorModal
        isOpen={simulatorModalOpen}
        onClose={() => setSimulatorModalOpen(false)}
        leads={leads}
        selectedLead={selectedLeadForSimulator}
        onSuccess={() => notify('Simulation completed and synced to Supabase!')}
      />

      {/* Browser-based AI Voice Call Modal */}
      {(() => {
        const nextPending = getNextPendingLead(browserCallLead?.id);
        return (
          <BrowserCallModal
            lead={browserCallLead}
            isOpen={browserCallModalOpen}
            isCampaignMode={isCampaignMode}
            hasNextLead={Boolean(nextPending)}
            nextLeadName={nextPending?.name}
            onNextLead={handleNextLeadInCampaign}
            onStopCampaign={handleStopCampaign}
            onClose={() => {
              setBrowserCallModalOpen(false);
              setBrowserCallLead(null);
              setIsCampaignMode(false);
            }}
            onCallFinished={() => {
              setHistoryRefreshKey((k) => k + 1);
              notify(`Call finished for ${browserCallLead?.name || 'customer'} and stored in Supabase.`);
            }}
          />
        );
      })()}
    </div>
  );
}
