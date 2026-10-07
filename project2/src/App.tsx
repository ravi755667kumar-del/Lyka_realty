import React, { useState, useEffect } from 'react';
import { 
  LeadProfile, 
  ChatMessage, 
  PropertyListing, 
  FollowUpTask, 
  LeadStatus,
  AgenticDecision 
} from './types/crm';
import { 
  createInitialLeadProfile, 
  extractEntitiesFromText, 
  computeCompletenessAndMissing, 
  evaluateLeadStatusAndPriority, 
  findMatchingProperties, 
  generateNextAdaptiveQuestion 
} from './lib/agentic_engine';
import { ALL_VERIFIED_PROPERTIES } from './data/all_properties';
import { LYKA_AGENTS } from './data/dubai_knowledge';
import { 
  testConnection, 
  saveLeadToFirestore, 
  getLeadsFromFirestore, 
  saveInteractionToFirestore, 
  saveFollowUpToFirestore, 
  getFollowUpsFromFirestore 
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { AgenticChat } from './components/AgenticChat';
import { LeadProfileSidebar } from './components/LeadProfileSidebar';
import { CrmPipeline } from './components/CrmPipeline';
import { PropertyInventory } from './components/PropertyInventory';
import { MongoEmbeddingHub } from './components/MongoEmbeddingHub';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { 
  Calendar, 
  CheckCircle2, 
  PhoneCall, 
  UserCheck, 
  X, 
  AlertCircle, 
  Building2, 
  Send 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge'>('chat');
  const [currentLead, setCurrentLead] = useState<LeadProfile>(createInitialLeadProfile());
  const [leadsList, setLeadsList] = useState<LeadProfile[]>([]);
  const [propertiesList, setPropertiesList] = useState<PropertyListing[]>(ALL_VERIFIED_PROPERTIES);
  const [followUpsList, setFollowUpsList] = useState<FollowUpTask[]>([]);
  const [firestoreActive, setFirestoreActive] = useState(false);
  const [mongoStatus, setMongoStatus] = useState({ connected: false, uriConfigured: false, count: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'MSG-INIT',
      lead_id: 'INITIAL',
      role: 'assistant',
      content: `Hello, and welcome! Thanks for reaching out to Lyka Realty. What brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      timestamp: new Date().toISOString(),
      agentic_decision: {
        intent_detected: 'Inquiry Initiation',
        confidence: 100,
        extracted_fields: {},
        still_missing_fields: ['Intent (Buy/Rent/Invest)', 'Budget range', 'Preferred community'],
        next_question_intent: 'Identify Role First',
        rationale: 'Initial greeting per PDF: ask what brings them today before criteria.',
        qualify_score: 0,
        handoff_suggested: false,
        suggested_action: 'Greet customer and identify role first'
      }
    }
  ]);

  // Modals
  const [viewingModalProperty, setViewingModalProperty] = useState<PropertyListing | null>(null);
  const [viewingDate, setViewingDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewingTime, setViewingTime] = useState('11:00 AM');
  const [viewingMode, setViewingMode] = useState<'In-person at property' | 'Virtual 3D walkthrough'>('In-person at property');

  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffNotes, setHandoffNotes] = useState('');

  // Initial data loading & connection testing
  useEffect(() => {
    async function init() {
      const fsOk = await testConnection();
      setFirestoreActive(fsOk);

      // Load existing Firestore leads or seed with sample leads
      const existingLeads = await getLeadsFromFirestore();
      if (existingLeads.length > 0) {
        setLeadsList(existingLeads);
      } else {
        // Seed initial representative leads for CRM pipeline
        const initialLead = currentLead;
        const seedLeads: LeadProfile[] = [
          initialLead,
          {
            ...createInitialLeadProfile(),
            id: 'LEAD-DXB102',
            full_name: 'Mohammed Al-Hashimi',
            phone: '+971 50 234 5678',
            email: 'm.hashimi@investments.ae',
            customer_type: 'Investor',
            intent: 'Invest',
            budget_max: 3500000,
            budget_min: 2500000,
            preferred_communities: ['Downtown Dubai', 'Dubai Creek Harbour'],
            property_type: 'Apartment',
            bedrooms: '2',
            ready_or_offplan: 'Off-plan',
            purpose: 'High ROI & Capital Growth',
            lead_status: 'Qualified',
            lead_priority: 'Urgent',
            requirement_completeness: 85,
            assigned_agent: LYKA_AGENTS[1].name,
            summary: 'Overseas investor seeking off-plan 2BR with post-handover payment plan.'
          },
          {
            ...createInitialLeadProfile(),
            id: 'LEAD-DXB103',
            full_name: 'David & Claire Wilson',
            phone: '+44 7911 123456',
            email: 'david.wilson@ukemail.co.uk',
            customer_type: 'End-user / Family',
            intent: 'Buy',
            budget_max: 4800000,
            budget_min: 4000000,
            preferred_communities: ['Dubai Hills Estate'],
            property_type: 'Villa',
            bedrooms: '4',
            ready_or_offplan: 'Ready',
            purpose: 'Family Relocation',
            financing: 'Mortgage',
            lead_status: 'Viewing',
            lead_priority: 'High',
            requirement_completeness: 90,
            assigned_agent: LYKA_AGENTS[2].name,
            summary: 'UK family relocating to Dubai Hills Estate, looking for 4BR villa with private garden.'
          }
        ];
        setLeadsList(seedLeads);
        // Persist seed leads to firestore
        seedLeads.forEach(l => saveLeadToFirestore(l));
      }

      // Load follow-ups
      const existingFollowups = await getFollowUpsFromFirestore();
      if (existingFollowups.length > 0) {
        setFollowUpsList(existingFollowups);
      }

      // Check MongoDB status
      try {
        const res = await fetch('/api/mongodb/status');
        const data = await res.json();
        setMongoStatus({
          connected: data.connected,
          uriConfigured: data.uriConfigured,
          count: data.embeddingsCount || 0
        });
      } catch (err) {
        console.warn('MongoDB status check:', err);
      }
    }

    init();
  }, []);

  // Update current lead state in leads list and Firestore
  const updateActiveLead = (updatedFields: Partial<LeadProfile>) => {
    setCurrentLead(prev => {
      const merged = { ...prev, ...updatedFields, updatedAt: new Date().toISOString() };
      setLeadsList(list => {
        const index = list.findIndex(l => l.id === merged.id);
        if (index >= 0) {
          const updatedList = [...list];
          updatedList[index] = merged;
          return updatedList;
        }
        return [merged, ...list];
      });
      // Sync to firestore
      saveLeadToFirestore(merged);
      // Sync to MongoDB database
      fetch('/api/leads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(err => console.warn('MongoDB lead sync notice:', err));
      return merged;
    });
  };

  // Start new customer chat
  const handleStartNewChat = () => {
    const newLead = createInitialLeadProfile();
    setCurrentLead(newLead);
    setLeadsList(prev => [newLead, ...prev]);
    saveLeadToFirestore(newLead);

    setMessages([
      {
        id: 'MSG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: newLead.id,
        role: 'assistant',
        content: `Hello, and welcome! Thanks for reaching out to Lyka Realty.\n\nWhat brings you to us today? Are you looking to invest, buy, sell, or something else?`,
        timestamp: new Date().toISOString(),
      }
    ]);
    setActiveTab('chat');
  };

  // Maps current lead state to the correct LangGraph conversation stage
  const mapLeadToStage = (lead: typeof currentLead): string => {
    if (!lead.intent) return 'classify_intent';
    const i = lead.intent.toLowerCase();
    if (i === 'buy') return 'qualify_buy';
    if (i === 'rent') return 'qualify_rent';
    if (i === 'invest') return 'qualify_invest';
    if (i === 'sell') return 'qualify_sell';
    return 'classify_intent';
  };

  // User sends message
  const handleSendMessage = async (userText: string, options?: { groqApiKey?: string; groqModel?: string }) => {
    const userMsg: ChatMessage = {
      id: 'MSG-U-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Agentic Extraction
      const extracted = extractEntitiesFromText(userText, currentLead);
      const mergedLead: LeadProfile = {
        ...currentLead,
        ...extracted,
        updatedAt: new Date().toISOString(),
      };

      // 2. Compute Completeness & Missing Fields
      const { completeness, missing } = computeCompletenessAndMissing(mergedLead);
      mergedLead.requirement_completeness = completeness;
      mergedLead.missing_fields = missing;

      // 3. Evaluate Status & Priority
      const { status, priority } = evaluateLeadStatusAndPriority(mergedLead, completeness);
      mergedLead.lead_status = status;
      mergedLead.lead_priority = priority;

      // 4. Assign best matching agent based on community or customer type
      if (mergedLead.preferred_communities && mergedLead.preferred_communities.length > 0) {
        const firstComm = mergedLead.preferred_communities[0];
        const matchedAgent = LYKA_AGENTS.find(a => a.communities.includes(firstComm));
        if (matchedAgent) {
          mergedLead.assigned_agent = matchedAgent.name;
        }
      }

      // 5. Match properties if enough criteria collected
      let matchingProps: PropertyListing[] = [];
      if (completeness >= 40 || mergedLead.preferred_communities.length > 0 || mergedLead.budget_max) {
        matchingProps = findMatchingProperties(mergedLead);
      }

      // 6. Next Question logic
      const { nextQuestion, rationale, intentCategory } = generateNextAdaptiveQuestion(mergedLead, missing, userText);
      mergedLead.next_action = intentCategory;
      mergedLead.summary = `Customer ${mergedLead.full_name || mergedLead.id} seeking ${mergedLead.property_type || 'property'} (${mergedLead.bedrooms || ''}BR) in ${(mergedLead.preferred_communities || []).join(', ') || 'Dubai'}. Budget: AED ${mergedLead.budget_max || 'TBD'}. Intent: ${mergedLead.intent}.`;

      // 7. Update Lead in State and Firestore
      updateActiveLead(mergedLead);

      // 8. Try Server AI endpoint or fallback to deterministic Agentic Question
      let assistantReply = nextQuestion;
      let assistantProvider = 'Lyka Realty Polite Concierge';
      let serverMatchedProperties: any[] = [];
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })),
            currentLead: mergedLead,
            conversationStage: mapLeadToStage(mergedLead),
            groqApiKey: options?.groqApiKey,
            groqModel: options?.groqModel
          })
        });
        const chatData = await chatRes.json();
        if (chatData && chatData.reply) {
          if (!chatData.fallback) {
            assistantReply = chatData.reply;
          }
          if (chatData.provider) {
            assistantProvider = chatData.provider;
          }
          if (chatData.matchedProperties && chatData.matchedProperties.length > 0) {
            serverMatchedProperties = chatData.matchedProperties;
          }
          // Merge any profile updates from LangGraph back into lead
          if (chatData.updatedProfile) {
            const serverUpdates = chatData.updatedProfile;
            if (serverUpdates.intent && !mergedLead.intent) mergedLead.intent = serverUpdates.intent;
            if (serverUpdates.budget_max) mergedLead.budget_max = serverUpdates.budget_max;
            if (serverUpdates.rental_budget) mergedLead.rental_budget = serverUpdates.rental_budget;
            if (serverUpdates.property_type && !mergedLead.property_type) mergedLead.property_type = serverUpdates.property_type;
          }
        }
      } catch (err) {
        console.warn('Using client agentic response generator:', err);
      }

      const agenticDecision: AgenticDecision = {
        intent_detected: mergedLead.intent,
        confidence: Math.round(completeness),
        extracted_fields: extracted,
        still_missing_fields: missing,
        next_question_intent: intentCategory,
        rationale: rationale,
        qualify_score: completeness,
        handoff_suggested: mergedLead.human_handoff_required,
        suggested_action: intentCategory
      };

      const finalProperties = serverMatchedProperties.length > 0
        ? serverMatchedProperties.slice(0, 3)
        : matchingProps.length > 0 ? matchingProps.slice(0, 3) : null;

      const assistantMsg: ChatMessage = {
        id: 'MSG-A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: mergedLead.id,
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date().toISOString(),
        provider: assistantProvider,
        agentic_decision: agenticDecision,
        recommended_properties: finalProperties,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Save interactions to Firestore
      saveInteractionToFirestore(userMsg);
      saveInteractionToFirestore(assistantMsg);

      // Asynchronously generate numerical vector embedding and store into MongoDB
      fetch('/api/embeddings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: mergedLead.id,
          text_content: `${mergedLead.full_name || 'Customer'} inquiry: ${userText}. Extracted: ${mergedLead.intent} ${mergedLead.property_type || ''} in ${(mergedLead.preferred_communities || []).join(', ')} budget AED ${mergedLead.budget_max || ''}`,
          metadata: {
            customer_name: mergedLead.full_name || 'Prospect',
            intent: mergedLead.intent,
            budget_max: mergedLead.budget_max,
            communities: mergedLead.preferred_communities
          }
        })
      }).catch(e => console.warn('Vector store background sync:', e));

    } catch (err) {
      console.error('Agentic execution error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Schedule viewing submission
  const handleConfirmViewing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingModalProperty) return;

    const newTask: FollowUpTask = {
      id: 'TASK-VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      customer_name: currentLead.full_name || 'Client ' + currentLead.id,
      reason: `Viewing for ${viewingModalProperty.title} (${viewingModalProperty.community})`,
      date: `${viewingDate} at ${viewingTime}`,
      assigned_agent: currentLead.assigned_agent,
      action: `${viewingMode} with ${currentLead.assigned_agent}`,
      status: 'Pending',
      priority: 'High',
      createdAt: new Date().toISOString()
    };

    setFollowUpsList(prev => [newTask, ...prev]);
    saveFollowUpToFirestore(newTask);
    fetch('/api/followups/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).catch(err => console.warn('MongoDB followup sync notice:', err));

    // Update lead status to Viewing
    updateActiveLead({
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      viewing_preference: `${viewingMode} on ${viewingDate} at ${viewingTime}`,
      human_handoff_required: true,
      handoff_reason: `Confirmed viewing for ${viewingModalProperty.title}`
    });

    // Add confirmation message to chat
    const confirmMsg: ChatMessage = {
      id: 'MSG-VIEW-CONFIRM-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'assistant',
      content: `I have scheduled your ${viewingMode.toLowerCase()} for **${viewingModalProperty.title}** on **${viewingDate} at ${viewingTime}**.\n\nYour assigned Lyka Realty senior property advisor, **${currentLead.assigned_agent}**, has received the confirmation and will contact you via WhatsApp / phone with the location pin and access details.`,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, confirmMsg]);
    saveInteractionToFirestore(confirmMsg);
    setViewingModalProperty(null);
  };

  // Human handoff confirmation
  const handleConfirmHandoff = () => {
    updateActiveLead({
      human_handoff_required: true,
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      handoff_reason: handoffNotes || 'Client requested direct coordination with Lyka agent'
    });

    const handoffMsg: ChatMessage = {
      id: 'MSG-HANDOFF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'assistant',
      content: `### Lyka Realty CRM Handoff Summary\n\n- **Client:** ${currentLead.full_name || 'Prospect Client'}\n- **Phone:** ${currentLead.phone || 'Pending verification'}\n- **Intent:** ${currentLead.intent} (${currentLead.customer_type})\n- **Budget:** AED ${currentLead.budget_max ? currentLead.budget_max.toLocaleString() : 'TBD'}\n- **Target Community:** ${(currentLead.preferred_communities || []).join(', ') || 'Open'}\n- **Assigned Agent:** ${currentLead.assigned_agent}\n- **Recommended Next Action:** Connect directly for personalized portfolio presentation and viewing arrangements.\n\n${currentLead.assigned_agent} has been alerted and will reach out shortly.`,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, handoffMsg]);
    saveInteractionToFirestore(handoffMsg);
    setShowHandoffModal(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        leadCount={leadsList.length}
        firestoreActive={firestoreActive}
        mongoStatus={mongoStatus}
        onStartNewChat={handleStartNewChat}
      />

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' && (
          <div className="flex-1 flex w-full h-full overflow-hidden relative">
            <AgenticChat
              messages={messages}
              currentLead={currentLead}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onBookViewing={(prop) => setViewingModalProperty(prop)}
              onOpenAgentHandoff={() => setShowHandoffModal(true)}
              onToggleSidebar={() => setSidebarOpen(prev => !prev)}
              sidebarOpen={sidebarOpen}
            />
            {sidebarOpen && (
              <LeadProfileSidebar
                lead={currentLead}
                onUpdateLead={updateActiveLead}
                onTriggerHandoff={() => setShowHandoffModal(true)}
                onScheduleViewing={() => {
                  const sampleProp = propertiesList[0];
                  setViewingModalProperty(sampleProp);
                }}
                onClose={() => setSidebarOpen(false)}
              />
            )}
          </div>
        )}

        {activeTab === 'crm' && (
          <CrmPipeline
            leads={leadsList}
            followUps={followUpsList}
            onSelectLead={(lead) => {
              setCurrentLead(lead);
              setActiveTab('chat');
            }}
            onUpdateLeadStatus={(id, st) => {
              const target = leadsList.find(l => l.id === id);
              if (target) {
                const updated = { ...target, lead_status: st };
                updateActiveLead(updated);
              }
            }}
            onAddFollowUp={(task) => {
              setFollowUpsList(prev => [task, ...prev]);
              saveFollowUpToFirestore(task);
              fetch('/api/followups/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
              }).catch(err => console.warn('MongoDB followup sync notice:', err));
            }}
          />
        )}

        {activeTab === 'properties' && (
          <PropertyInventory
            properties={propertiesList}
            currentLead={currentLead}
            onBookViewing={(prop) => setViewingModalProperty(prop)}
            onAddProperty={(newProp) => {
              setPropertiesList(prev => [newProp, ...prev]);
            }}
          />
        )}

        {activeTab === 'embeddings' && (
          <MongoEmbeddingHub currentLead={currentLead} />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeBaseView />
        )}
      </main>

      {/* Viewing Scheduler Modal */}
      {viewingModalProperty && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Schedule Property Viewing</h3>
              </div>
              <button 
                onClick={() => setViewingModalProperty(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
              <img 
                src={viewingModalProperty.image_url} 
                alt={viewingModalProperty.title}
                className="w-16 h-14 rounded-lg object-cover" 
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{viewingModalProperty.title}</h4>
                <p className="text-[11px] text-amber-400 font-semibold mt-0.5">AED {viewingModalProperty.price_aed.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{viewingModalProperty.community} • {viewingModalProperty.bedrooms} BR</p>
              </div>
            </div>

            <form onSubmit={handleConfirmViewing} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Preferred Viewing Mode</label>
                <select
                  value={viewingMode}
                  onChange={(e) => setViewingMode(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                >
                  <option value="In-person at property">In-person at property</option>
                  <option value="Virtual 3D walkthrough">Virtual 3D walkthrough / Video call</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={viewingDate}
                    onChange={(e) => setViewingDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Time Slot</label>
                  <select
                    value={viewingTime}
                    onChange={(e) => setViewingTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  >
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                    <option value="06:00 PM">06:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setViewingModalProperty(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-bold shadow-md"
                >
                  Confirm Viewing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Human Agent Handoff Modal */}
      {showHandoffModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Escalate to Lyka Senior Agent</h3>
              </div>
              <button 
                onClick={() => setShowHandoffModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Lyka Specialist:</span>
                <span className="font-bold text-white">{currentLead.assigned_agent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer Intent:</span>
                <span className="text-amber-400 font-semibold">{currentLead.intent} ({currentLead.customer_type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Budget:</span>
                <span className="text-white font-mono">AED {currentLead.budget_max ? currentLead.budget_max.toLocaleString() : 'In discussion'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Communities:</span>
                <span className="text-slate-200">{(currentLead.preferred_communities || []).join(', ') || 'Any prime community'}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 block">Handoff Reason & Notes for Agent:</label>
              <textarea
                rows={3}
                value={handoffNotes}
                onChange={(e) => setHandoffNotes(e.target.value)}
                placeholder="E.g., Client requested in-person meeting or price negotiation guidance on Marina 2BR..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowHandoffModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHandoff}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-bold shadow-md text-xs flex items-center justify-center space-x-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Confirm Handoff</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
