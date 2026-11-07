import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  setDoc,
  orderBy,
} from 'firebase/firestore';

dotenv.config();

// Load Firebase configuration
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json', err);
  }
}

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// Local config store for Vapi credentials (allows testing/override via dashboard)
const CONFIG_FILE = path.resolve(__dirname, 'vapi-config.local.json');
function getVapiSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.VAPI_API_KEY || '',
    phoneNumberId: fileConfig.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID || '',
    assistantId: fileConfig.assistantId || process.env.VAPI_ASSISTANT_ID || '',
  };
}

function saveVapiSettings(settings: { apiKey?: string; phoneNumberId?: string; assistantId?: string }) {
  const current = getVapiSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    phoneNumberId: settings.phoneNumberId !== undefined ? settings.phoneNumberId : current.phoneNumberId,
    assistantId: settings.assistantId !== undefined ? settings.assistantId : current.assistantId,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Sarvam AI Config Store ───────────────────────────────────────────────────
const SARVAM_CONFIG_FILE = path.resolve(__dirname, 'sarvam-config.local.json');
function getSarvamSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(SARVAM_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(SARVAM_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.SARVAM_API_KEY || '',
  };
}

function saveSarvamSettings(settings: { apiKey?: string }) {
  const current = getSarvamSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
  };
  fs.writeFileSync(SARVAM_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Groq AI Config Store ───────────────────────────────────────────────────
const GROQ_CONFIG_FILE = path.resolve(__dirname, 'groq-config.local.json');
function getGroqSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(GROQ_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(GROQ_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.GROQ_API_KEY || '',
  };
}

function saveGroqSettings(settings: { apiKey?: string }) {
  const current = getGroqSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
  };
  fs.writeFileSync(GROQ_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// Global in-memory campaign runner state
interface ServerCampaignState {
  isRunning: boolean;
  activeLeadId: string | null;
  activeCallId: string | null;
  lastCallFinishedAt: number | null;
}

const campaignRunner: ServerCampaignState = {
  isRunning: false,
  activeLeadId: null,
  activeCallId: null,
  lastCallFinishedAt: null,
};

// Lyka Realty Assistant System Prompt — Friendly Girl Telecaller Persona ("Priya")
const LYKA_SYSTEM_PROMPT = `
You are Priya, a friendly, polite, and energetic property telecaller from Lyka Realty.
You speak naturally like a normal real girl having a warm, pleasant conversation (never robotic or stiff).

CRITICAL FIRST QUESTION:
Start with:
"Vanakkam Sir! Naan Lyka Realty-la irundhu Priya pesuren. Ungalukku Tamil, English, illana Hindi — edhula pesa vasadhiya irukkum Sir?"

WAIT for the user's answer. Do not jump into property questions before the language is selected.

THREE LANGUAGE OPTIONS:
- If user chooses English: Continue as friendly, conversational Priya in clear English.
- If user chooses Hindi: Continue as friendly, conversational Priya in warm Hindi.
- If user chooses Tamil: Use conversational "Tanglish" (Tamil naturally mixed with English, exactly how people talk in Chennai/Tamil Nadu).

STEP 1: ASK IF THEY ARE FREE:
After language selection, you MUST ask if the customer is free to speak:
- Tanglish: "Romba nandri Sir! Naan Lyka Realty team-la irundhu pesuren. Ippo oru 2 minutes unga kooda pesalaama Sir?"
- Hindi: "Bahut shukriya Sir! Main Lyka Realty team se Priya bol rahi hoon. Kya aapse abhi do minute baat ho sakti hai Sir?"
- English: "Thank you so much Sir! This is Priya from the Lyka Realty team. Do you have a couple of minutes to speak right now?"

- If user is FREE (says "yes", "free thaan", "aama", "haan free hoon", "sure", "pesalam"): Thank them warmly and proceed to Question 1.
- If user is NOT FREE / BUSY (says "no", "busy", "not free", "free illa", "free nahi", "apram"):
  Warmly say: "Aiyo no problem at all! Neenga free aagum bothu pesalam. Have a lovely day!" and end the call as COLD.

MAXIMUM 5 QUALIFICATION QUESTIONS:
1. Interest: "Actually, are you planning to buy a new home or property anytime soon?" (Tanglish: "Actually, pudhu property illana veedu vaanga edhavadhu idea vechurukkeengala?")
2. Intent: "Super! Are you looking for your own family to live in, or as an investment for rental income?" (Tanglish: "Super! Neenga idhu unga sontha use-kkaaga paakureengala, illa investment panni rental income paakka plan-ah?")
3. Budget: "Got it! What approximate budget range do you have in mind?" (Tanglish: "Great! Unga budget expectation approximately evlo irukkum nu solla mudiyuma?")
4. Location: "Wonderful! Which particular area or city location are you most interested in?" (Tanglish: "Nice! Endha particular area illana location-la ungalukku property theda viruppam?")
5. Timeline: "Awesome! By when are you planning to finalize and purchase? What's your expected timeline?" (Tanglish: "Super-nga! Idhu eppo kulla purchase panna plan panreenga, unga timeline enna?")

STRICT WORK-FOCUS POLICY (highest priority):
You are a professional property assistant, NOT a general-purpose chatbot. Discuss ONLY Lyka Realty properties, pricing, site visits, bookings, documentation, and related support. If the caller brings up anything unrelated (personal topics, jokes, general knowledge, politics, entertainment, casual chat), do NOT answer or engage with it at all — politely redirect in one short sentence and return to their property requirement. Rotate the wording naturally so it never repeats or sounds robotic ("I'm sorry, I'm here to help with property-related queries. How can I assist you with that?" / "That's outside my area of assistance — but I can help you with property details, pricing, and bookings."). Even if asked repeatedly, never answer unrelated questions, never explain them, and never become argumentative or rude. Use only verified Lyka Realty information; never invent prices, offers, or policies. EMERGENCY EXCEPTION: if the caller mentions an immediate emergency or safety concern (accident, fire, medical crisis), do not redirect — respond with brief care and advise contacting emergency services (112 in India), then offer to continue whenever they are ready.

BRANCHING & TERMINATION RULES:
1. Opt-Out ("Don't call me", "Stop calling", "Remove my number"):
   Immediately stop warmly: "I completely understand! I will remove your number from our list right away so you won't be contacted again. Thank you, have a good day!"
2. Human Agent Request ("I want to talk to a person", "Can someone call me?"):
   Say: "Certainly! I will have our senior property advisor connect with you directly very shortly. Thank you so much!"
3. No Answer / Silence:
   If no response is heard after checking, politely end the call.
`.trim();

// Rule-based classification engine
export function classifyLeadCall(transcript: string, summary: string, endedReason?: string): {
  outcome: 'HOT' | 'WARM' | 'COLD' | 'OPT-OUT' | 'NO_ANSWER' | 'AGENT_CALLBACK';
  buyerOrInvestor: 'buyer' | 'investor' | 'both' | 'unspecified';
  budget?: string;
  location?: string;
  timeline?: string;
  nextAction: string;
} {
  const text = `${transcript} ${summary}`.toLowerCase();

  // Check NO ANSWER
  if (
    endedReason === 'customer-did-not-answer' ||
    endedReason === 'no-answer' ||
    endedReason === 'voicemail' ||
    endedReason === 'customer-busy' ||
    text.includes('voicemail') ||
    text.includes('could not reach') ||
    transcript.trim().length === 0
  ) {
    return {
      outcome: 'NO_ANSWER',
      buyerOrInvestor: 'unspecified',
      nextAction: 'Retry call during standard business hours (Attempt 2 of 2).',
    };
  }

  // Check OPT-OUT
  if (
    text.includes("don't call me") ||
    text.includes('dont call me') ||
    text.includes('do not call') ||
    text.includes('stop calling') ||
    text.includes('remove my number') ||
    text.includes('opt out') ||
    text.includes('opt-out') ||
    text.includes('never call')
  ) {
    return {
      outcome: 'OPT-OUT',
      buyerOrInvestor: 'unspecified',
      nextAction: 'DO NOT CONTACT. Number added to internal DNC registry.',
    };
  }

  // Check AGENT_CALLBACK
  if (
    text.includes('speak with someone') ||
    text.includes('speak to someone') ||
    text.includes('human') ||
    text.includes('agent callback') ||
    text.includes('talk to an agent') ||
    text.includes('representative') ||
    text.includes('real person')
  ) {
    return {
      outcome: 'AGENT_CALLBACK',
      buyerOrInvestor: text.includes('investor') ? 'investor' : text.includes('buyer') ? 'buyer' : 'unspecified',
      nextAction: 'Schedule urgent human agent callback within 2 hours.',
    };
  }

  // Check COLD (not interested)
  if (
    text.includes('not interested') ||
    text.includes('no interest') ||
    text.includes('wrong number') ||
    text.includes('no thanks') ||
    text.includes('not looking')
  ) {
    return {
      outcome: 'COLD',
      buyerOrInvestor: 'unspecified',
      nextAction: 'Mark lead as inactive. Archive from active pipeline.',
    };
  }

  // Extract buyer vs investor
  let buyerOrInvestor: 'buyer' | 'investor' | 'both' | 'unspecified' = 'unspecified';
  if (text.includes('investor') && text.includes('buyer')) buyerOrInvestor = 'both';
  else if (text.includes('investor')) buyerOrInvestor = 'investor';
  else if (text.includes('buyer') || text.includes('own use') || text.includes('living')) buyerOrInvestor = 'buyer';

  // Extract budget
  let budget = '';
  const budgetMatch = text.match(/(?:budget|price|range|around|about|under|approx|between)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?\s*(?:cr|crore|crores|lakh|lakhs|k|million|m)?(?:\s*(?:to|-)\s*\d+(?:\.\d+)?\s*(?:cr|crore|crores|lakh|lakhs)?)?)/i);
  if (budgetMatch && budgetMatch[1] && budgetMatch[1].length > 1) {
    budget = budgetMatch[1].trim();
  }

  // Extract location
  let location = '';
  const commonLocations = ['worli', 'bandra', 'mumbai', 'whitefield', 'bangalore', 'bengaluru', 'gurgaon', 'delhi', 'noida', 'pune', 'hyderabad', 'south mumbai', 'cyberhub'];
  for (const loc of commonLocations) {
    if (text.includes(loc)) {
      location = loc.charAt(0).toUpperCase() + loc.slice(1);
      break;
    }
  }

  // Extract timeline
  let timeline = '';
  if (text.includes('immediate') || text.includes('this month') || text.includes('1 month') || text.includes('ready to move') || text.includes('soon')) {
    timeline = 'Immediate / Within 1 month';
  } else if (text.includes('3 months') || text.includes('6 months') || text.includes('this quarter')) {
    timeline = '3 - 6 Months';
  } else if (text.includes('next year') || text.includes('1 year')) {
    timeline = '6 - 12 Months';
  }

  // HOT vs WARM criteria:
  // HOT: Customer is genuinely interested AND has useful qualification information, especially budget/location/timeline, or explicitly wants an agent/visit soon.
  const hasStrongDetails = Boolean(budget || location || timeline);
  const expressesInterest = text.includes('interested') || text.includes('yes') || text.includes('looking for') || text.includes('purchasing');

  if (expressesInterest && hasStrongDetails) {
    return {
      outcome: 'HOT',
      buyerOrInvestor,
      budget: budget || '₹1.5 Cr - ₹3 Cr',
      location: location || 'Mumbai / Prime Sector',
      timeline: timeline || 'Within 1-3 months',
      nextAction: 'High Priority: Assign Senior Property Broker for personalized brochure & site inspection.',
    };
  } else if (expressesInterest) {
    return {
      outcome: 'WARM',
      buyerOrInvestor,
      budget: budget || 'To be clarified',
      location: location || 'Flexible',
      timeline: timeline || 'Exploring options',
      nextAction: 'Send digital project catalog via WhatsApp/Email and follow up in 7 days.',
    };
  }

  // Default fallback
  return {
    outcome: 'WARM',
    buyerOrInvestor,
    budget,
    location,
    timeline,
    nextAction: 'Review call recording and assign follow-up.',
  };
}

// Function to find the next eligible lead
async function getNextEligibleLead(): Promise<any | null> {
  try {
    const q = query(
      collection(db, 'leads'),
      where('consent', '==', true),
      where('blocked', '==', false),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      // Lead must not be already CALLING, COMPLETED, or OPT-OUT
      if (data.status !== 'COMPLETED' && data.status !== 'CALLING' && data.outcome !== 'OPT-OUT') {
        return { id: d.id, ...data };
      }
    }
    return null;
  } catch (err) {
    console.error('Error fetching next eligible lead:', err);
    return null;
  }
}

// Outbound call executor
async function initiateLeadCall(lead: any, appUrl: string): Promise<{ success: boolean; callId?: string; simulated?: boolean; message: string }> {
  const vapiSettings = getVapiSettings();
  const leadRef = doc(db, 'leads', lead.id);

  // Mark as CALLING
  await updateDoc(leadRef, {
    status: 'CALLING',
    callCount: (lead.callCount || 0) + 1,
    callTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  campaignRunner.activeLeadId = lead.id;

  // Sync to campaign doc
  await setDoc(
    doc(db, 'campaigns', 'lyka_cold_call_mvp'),
    {
      activeLeadId: lead.id,
      activeLeadName: lead.name,
      activeLeadPhone: lead.phone,
      lastUpdated: new Date().toISOString(),
    },
    { merge: true }
  );

  // If real Vapi API Key and Phone Number are configured:
  if (vapiSettings.apiKey && vapiSettings.phoneNumberId) {
    try {
      console.log(`[Vapi Outbound] Calling ${lead.name} (${lead.phone}) using real Vapi API...`);
      const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
      const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/vapi/webhook?leadId=${encodeURIComponent(lead.id)}`;

      const response = await fetch('https://api.vapi.ai/call/phone', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vapiSettings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: vapiSettings.phoneNumberId,
          customer: {
            number: lead.phone,
            name: lead.name,
          },
          assistant: {
            name: 'Lyka Realty AI Qualification Agent',
            firstMessage: "Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?",
            model: {
              provider: 'groq',
              model: 'llama-3.1-70b-versatile',
              messages: [
                {
                  role: 'system',
                  content: LYKA_SYSTEM_PROMPT,
                },
              ],
            },
            voice: {
              provider: '11labs',
              voiceId: 'sarah',
            },
            serverUrl: webhookUrl,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Vapi API returned error: ${response.status}`);
      }

      const vapiCallId = data.id || `vapi_${Date.now()}`;
      campaignRunner.activeCallId = vapiCallId;
      await updateDoc(leadRef, {
        vapiCallId,
      });

      return {
        success: true,
        callId: vapiCallId,
        simulated: false,
        message: `Real telephone call placed to ${lead.phone} via Vapi. Call ID: ${vapiCallId}`,
      };
    } catch (apiError: any) {
      console.error('[Vapi API Error]:', apiError);
      // Fallback: If Vapi request failed (e.g. invalid phone number format or insufficient balance), record error
      await updateDoc(leadRef, {
        status: 'FAILED',
        summary: `Vapi API Error: ${apiError.message || apiError}`,
      });
      return {
        success: false,
        message: `Vapi Call Failed: ${apiError.message}`,
      };
    }
  } else {
    // Missing telecom credentials: Check what is missing
    const missingReason = !vapiSettings.apiKey
      ? 'Vapi API Key is not configured'
      : !vapiSettings.phoneNumberId
      ? 'Outbound Phone Number ID is missing in Vapi Config (required to ring real phones)'
      : 'Telecom credentials missing';

    console.log(`[Simulator] ${missingReason}. Simulating call for ${lead.name}...`);
    // Run automated realistic qualification
    setTimeout(async () => {
      await executeSimulatedCallForLead(lead.id, 'HOT');
    }, 4000);

    return {
      success: true,
      simulated: true,
      message: `Running in simulation: ${missingReason}. Real mobile was not dialed.`,
    };
  }
}

// Function to trigger next lead in active campaign
async function triggerNextCampaignLead(appUrl: string) {
  if (!campaignRunner.isRunning) {
    console.log('[Campaign] Campaign stopped. Will not call next lead.');
    return;
  }

  console.log('[Campaign] Looking for next eligible lead...');
  const nextLead = await getNextEligibleLead();
  if (!nextLead) {
    console.log('[Campaign] All eligible leads have been called! Stopping campaign.');
    campaignRunner.isRunning = false;
    campaignRunner.activeLeadId = null;
    await setDoc(
      doc(db, 'campaigns', 'lyka_cold_call_mvp'),
      {
        isRunning: false,
        activeLeadId: null,
        activeLeadName: null,
        activeLeadPhone: null,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
    return;
  }

  console.log(`[Campaign] Calling next lead: ${nextLead.name} (${nextLead.phone})`);
  await initiateLeadCall(nextLead, appUrl);
}

// Simulation generator for testing full conversation flow
async function executeSimulatedCallForLead(
  leadId: string,
  scenario: 'HOT' | 'WARM' | 'COLD' | 'OPT-OUT' | 'NO_ANSWER' | 'AGENT_CALLBACK'
) {
  const leadDocRef = doc(db, 'leads', leadId);
  const snap = await getDoc(leadDocRef);
  if (!snap.exists()) return;
  const lead = snap.data();

  let transcript = '';
  let summary = '';
  let duration = 65;
  let buyerOrInvestor: 'buyer' | 'investor' | 'both' | 'unspecified' = 'buyer';
  let budget = '₹2.5 Cr - ₹4 Cr';
  let location = 'Worli, Mumbai';
  let timeline = 'Within 1-2 months';
  let nextAction = 'Assign Senior Property Advisor for site visit.';
  let outcome = scenario;
  let blocked = false;

  switch (scenario) {
    case 'HOT':
      duration = 84;
      transcript = `AI: Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?
Customer: Yes, I have a few minutes. Go ahead.
AI: Great! Are you currently interested in purchasing a property?
Customer: Yes, actively looking.
AI: Are you looking as a buyer or an investor?
Customer: I am looking to buy a 3 BHK luxury home for my family.
AI: Wonderful. What is your approximate budget range?
Customer: Around 3 to 4 Crores.
AI: Which location are you interested in?
Customer: Worli or Bandra West in Mumbai.
AI: And what is your expected timeline?
Customer: Within the next 30 to 60 days.
AI: Thank you so much! A senior property specialist from Lyka Realty will contact you with curated options for Worli and Bandra. Have a great day!`;
      summary = `Customer ${lead.name} is a high-intent buyer looking for a 3 BHK in Worli/Bandra with budget ₹3-4 Cr and immediate timeline (30-60 days).`;
      nextAction = 'High Priority: Assign Senior Property Advisor for site visit and share Lyka Heights floor plans.';
      break;

    case 'WARM':
      duration = 58;
      transcript = `AI: Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?
Customer: Hi, yes I can talk briefly.
AI: Are you currently interested in purchasing a property?
Customer: Yes, I might be interested later this year.
AI: Are you looking as a buyer or an investor?
Customer: Probably an investor for rental yield.
AI: What is your approximate budget range?
Customer: Not fully decided yet, maybe 1.5 to 2 Crores.
AI: Which location are you interested in?
Customer: Anywhere in Bangalore with good metro connectivity.
AI: What is your expected timeline?
Customer: In about 6 to 9 months.
AI: Understood! We will send you our latest property investment guide. Thank you!`;
      summary = `Customer interested in investment property in Bangalore (₹1.5-2 Cr) with a 6-9 month timeline.`;
      nextAction = 'Send Bangalore investment report and schedule check-in call next quarter.';
      buyerOrInvestor = 'investor';
      budget = '₹1.5 Cr - ₹2 Cr';
      location = 'Bangalore';
      timeline = '6 - 9 Months';
      break;

    case 'COLD':
      duration = 24;
      transcript = `AI: Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?
Customer: I'm not interested in buying any property right now.
AI: Thank you for your time. Have a great day!`;
      summary = `Customer explicitly stated they are not interested in property.`;
      nextAction = 'Mark lead as Cold. Do not pursue.';
      buyerOrInvestor = 'unspecified';
      budget = '';
      location = '';
      timeline = '';
      break;

    case 'OPT-OUT':
      duration = 18;
      transcript = `AI: Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?
Customer: Don't call me again. Please remove my number.
AI: Understood. I will immediately update our records and ensure you are not contacted again. Good day.`;
      summary = `Customer requested complete opt-out ("Don't call me again"). Number blocked permanently.`;
      nextAction = 'DO NOT CONTACT. Added to internal DNC registry.';
      blocked = true;
      buyerOrInvestor = 'unspecified';
      budget = '';
      location = '';
      timeline = '';
      break;

    case 'AGENT_CALLBACK':
      duration = 32;
      transcript = `AI: Hello, I'm an AI assistant calling from Lyka Realty. I'm calling regarding your property interest. Is now a good time to speak for a moment?
Customer: I prefer not to talk to an AI. I want to speak with someone from your sales team.
AI: Certainly! I will have a senior property advisor from Lyka Realty call you directly. Thank you for your time.`;
      summary = `Customer requested immediate human agent callback. Stopped automated qualification.`;
      nextAction = 'URGENT: Human agent to call back today.';
      buyerOrInvestor = 'unspecified';
      break;

    case 'NO_ANSWER':
      duration = 0;
      transcript = `Call initiated. No answer after 5 rings / voicemail tone detected.`;
      summary = `Call was not answered.`;
      nextAction = 'Retry call during evening window.';
      buyerOrInvestor = 'unspecified';
      budget = '';
      location = '';
      timeline = '';
      break;
  }

  // Update lead in Firestore
  await updateDoc(leadDocRef, {
    status: 'COMPLETED',
    outcome,
    blocked,
    duration,
    transcript,
    summary,
    buyerOrInvestor,
    budget,
    location,
    timeline,
    nextAction,
    recordingReference: duration > 0 ? `https://storage.googleapis.com/lyka-recordings/call_${leadId}.mp3` : '',
    updatedAt: new Date().toISOString(),
  });

  // Update campaign stats
  const campRef = doc(db, 'campaigns', 'lyka_cold_call_mvp');
  const campSnap = await getDoc(campRef);
  if (campSnap.exists()) {
    const cur = campSnap.data();
    await updateDoc(campRef, {
      activeLeadId: null,
      activeLeadName: null,
      activeLeadPhone: null,
      completedCalls: (cur.completedCalls || 0) + 1,
      hotCount: outcome === 'HOT' ? (cur.hotCount || 0) + 1 : cur.hotCount || 0,
      warmCount: outcome === 'WARM' ? (cur.warmCount || 0) + 1 : cur.warmCount || 0,
      coldCount: outcome === 'COLD' ? (cur.coldCount || 0) + 1 : cur.coldCount || 0,
      optOutCount: outcome === 'OPT-OUT' ? (cur.optOutCount || 0) + 1 : cur.optOutCount || 0,
      noAnswerCount: outcome === 'NO_ANSWER' ? (cur.noAnswerCount || 0) + 1 : cur.noAnswerCount || 0,
      agentCallbackCount: outcome === 'AGENT_CALLBACK' ? (cur.agentCallbackCount || 0) + 1 : cur.agentCallbackCount || 0,
      lastUpdated: new Date().toISOString(),
    });
  }

  campaignRunner.activeLeadId = null;
  campaignRunner.activeCallId = null;
  campaignRunner.lastCallFinishedAt = Date.now();

  // If campaign is still running, trigger next call after brief pause
  if (campaignRunner.isRunning) {
    setTimeout(() => {
      triggerNextCampaignLead('');
    }, 3000);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      campaignRunning: campaignRunner.isRunning,
      activeLead: campaignRunner.activeLeadId,
    });
  });

  // 2. Vapi Settings API
  app.get('/api/vapi/settings', (req: Request, res: Response) => {
    const s = getVapiSettings();
    res.json({
      apiKeyConfigured: Boolean(s.apiKey && s.apiKey.length > 5),
      phoneNumberIdConfigured: Boolean(s.phoneNumberId && s.phoneNumberId.length > 5),
      assistantIdConfigured: Boolean(s.assistantId && s.assistantId.length > 5),
      phoneNumberId: s.phoneNumberId || '',
      assistantId: s.assistantId || '',
      hasCustomKey: Boolean(s.apiKey),
    });
  });

  app.post('/api/vapi/settings', (req: Request, res: Response) => {
    const { apiKey, phoneNumberId, assistantId } = req.body;
    const updated = saveVapiSettings({ apiKey, phoneNumberId, assistantId });
    res.json({
      success: true,
      message: 'Vapi settings saved securely on server.',
      apiKeyConfigured: Boolean(updated.apiKey),
      phoneNumberId: updated.phoneNumberId,
    });
  });

  // ─── Sarvam AI Routes ─────────────────────────────────────────────────────

  // 2b. Sarvam Settings GET
  app.get('/api/sarvam/settings', (req: Request, res: Response) => {
    const s = getSarvamSettings();
    res.json({
      apiKeyConfigured: Boolean(s.apiKey && s.apiKey.length > 5),
    });
  });

  // 2c. Sarvam Settings POST (save API key server-side)
  app.post('/api/sarvam/settings', (req: Request, res: Response) => {
    const { apiKey } = req.body;
    const updated = saveSarvamSettings({ apiKey });
    res.json({
      success: true,
      message: 'Sarvam API key saved securely on server.',
      apiKeyConfigured: Boolean(updated.apiKey),
    });
  });

  // 2d. Sarvam TTS Proxy — converts text → audio (WAV base64) via Bulbul v3
  // Speaker "priya"/"neha"/"kavitha" etc. — default: priya (warm female, bulbul:v3 roster)
  app.post('/api/sarvam/tts', async (req: Request, res: Response) => {
    const { text, language_code, speaker, pace } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });

    const sarvamKey = getSarvamSettings().apiKey;
    if (!sarvamKey) {
      return res.status(503).json({
        success: false,
        message: 'Sarvam API key not configured. Please set it in Settings.',
      });
    }

    try {
      console.log(`[Sarvam TTS] Synthesizing "${text.substring(0, 60)}..." [${language_code || 'en-IN'}, ${speaker || 'priya'}]`);
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': sarvamKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_language_code: language_code || 'en-IN',
          text: text.trim(),
          speaker: speaker || 'priya',   // Warm natural female voice (matches the Priya persona; bulbul:v3 roster)
          model: 'bulbul:v3',
          pace: pace || 0.95,              // Moderate, comfortable spoken pace
          loudness: 1.5,
          enable_preprocessing: true,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[Sarvam TTS Error]:', errBody);
        throw new Error(`Sarvam TTS returned ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      // Sarvam returns { audios: [base64_wav_string], ...}
      res.json({ success: true, audio: data.audios?.[0] || null });
    } catch (err: any) {
      console.error('[Sarvam TTS error]:', err);
      res.status(500).json({ success: false, message: err.message || 'TTS synthesis failed' });
    }
  });

  // 2e. Sarvam STT Proxy — transcribes audio blob via Saaras v3
  app.post('/api/sarvam/stt', async (req: Request, res: Response) => {
    const sarvamKey = getSarvamSettings().apiKey;
    if (!sarvamKey) {
      return res.status(503).json({
        success: false,
        message: 'Sarvam API key not configured.',
      });
    }

    try {
      // Forward multipart/form-data directly to Sarvam
      const contentType = req.headers['content-type'] || '';
      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': sarvamKey,
          'content-type': contentType,
        },
        // @ts-ignore – pass raw body buffer
        body: req,
        // @ts-ignore
        duplex: 'half',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || `Sarvam STT returned ${response.status}`);
      }
      res.json({ success: true, transcript: data.transcript || '' });
    } catch (err: any) {
      console.error('[Sarvam STT error]:', err);
      res.status(500).json({ success: false, message: err.message || 'STT transcription failed' });
    }
  });

  // ─── Groq AI Routes ─────────────────────────────────────────────────────

  // Groq Settings GET
  app.get('/api/groq/settings', (req: Request, res: Response) => {
    const s = getGroqSettings();
    res.json({
      apiKeyConfigured: Boolean(s.apiKey && s.apiKey.length > 5),
    });
  });

  // Groq Settings POST
  app.post('/api/groq/settings', (req: Request, res: Response) => {
    const { apiKey } = req.body;
    const updated = saveGroqSettings({ apiKey });
    res.json({
      success: true,
      message: 'Groq API key saved securely on server.',
      apiKeyConfigured: Boolean(updated.apiKey),
    });
  });

  // Groq Chat Proxy for Browser Call Modal
  app.post('/api/groq/chat', async (req: Request, res: Response) => {
    const groqKey = getGroqSettings().apiKey;
    if (!groqKey) {
      return res.status(503).json({
        success: false,
        message: 'Groq API key not configured.',
      });
    }

    const { messages, model = 'llama-3.1-70b-versatile' } = req.body;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[Groq API Error]:', errBody);
        throw new Error(`Groq API returned ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const reply = data.choices[0]?.message?.content || '';
      res.json({ success: true, text: reply });
    } catch (err: any) {
      console.error('[Groq Chat error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Groq inference failed' });
    }
  });

  // 3. Campaign Start API

  app.post('/api/campaign/start', async (req: Request, res: Response) => {
    try {
      campaignRunner.isRunning = true;
      const appUrl = (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : `${req.protocol}://${req.get('host')}`) || process.env.APP_URL || '';

      await setDoc(
        doc(db, 'campaigns', 'lyka_cold_call_mvp'),
        {
          isRunning: true,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );

      // Find next eligible lead
      const nextLead = await getNextEligibleLead();
      if (!nextLead) {
        campaignRunner.isRunning = false;
        await updateDoc(doc(db, 'campaigns', 'lyka_cold_call_mvp'), { isRunning: false });
        return res.status(400).json({
          success: false,
          message: 'No eligible leads available. Leads must have consent=true, blocked=false, and not yet called.',
        });
      }

      // Initiate first call
      const callResult = await initiateLeadCall(nextLead, appUrl);
      res.json({
        success: true,
        message: 'Campaign started. Calling first eligible lead.',
        activeLead: nextLead,
        callResult,
      });
    } catch (err: any) {
      console.error('Error starting campaign:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to start campaign' });
    }
  });

  // 4. Campaign Stop API
  app.post('/api/campaign/stop', async (req: Request, res: Response) => {
    campaignRunner.isRunning = false;
    campaignRunner.activeLeadId = null;

    try {
      await setDoc(
        doc(db, 'campaigns', 'lyka_cold_call_mvp'),
        {
          isRunning: false,
          activeLeadId: null,
          activeLeadName: null,
          activeLeadPhone: null,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating campaign state on stop:', err);
    }

    res.json({
      success: true,
      message: 'Campaign stopped. No further calls will be placed.',
    });
  });

  // 5. Call Single Lead API
  app.post('/api/campaign/call-lead', async (req: Request, res: Response) => {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    try {
      const leadSnap = await getDoc(doc(db, 'leads', leadId));
      if (!leadSnap.exists()) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      const lead = { id: leadSnap.id, ...leadSnap.data() } as any;

      if (!lead.consent) {
        return res.status(400).json({ success: false, message: 'Cannot call lead without explicit customer consent.' });
      }

      if (lead.blocked) {
        return res.status(400).json({ success: false, message: 'Cannot call lead: Number is on the OPT-OUT/Blocked list.' });
      }

      const appUrl = (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : `${req.protocol}://${req.get('host')}`) || process.env.APP_URL || '';
      const result = await initiateLeadCall(lead, appUrl);
      res.json(result);
    } catch (err: any) {
      console.error('Error calling single lead:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to call lead' });
    }
  });

  // 6. Call Simulator API
  app.post('/api/vapi/simulate-call', async (req: Request, res: Response) => {
    const { leadId, scenario } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    try {
      await executeSimulatedCallForLead(leadId, scenario || 'HOT');
      const updatedSnap = await getDoc(doc(db, 'leads', leadId));
      res.json({
        success: true,
        message: `Simulated call completed for scenario ${scenario || 'HOT'}`,
        lead: { id: updatedSnap.id, ...updatedSnap.data() },
      });
    } catch (err: any) {
      console.error('Error executing simulated call:', err);
      res.status(500).json({ success: false, message: err.message || 'Simulation error' });
    }
  });

  // 7. Vapi Webhook Endpoint (Receives end-of-call report, transcript, summary)
  app.post('/api/vapi/webhook', async (req: Request, res: Response) => {
    console.log('[Vapi Webhook Received]:', JSON.stringify(req.body, null, 2));
    const leadIdQuery = req.query.leadId as string;
    const body = req.body;

    // Vapi sends messages like { message: { type: "end-of-call-report", call: { ... } } }
    const message = body?.message || body;
    const messageType = message?.type || '';

    if (messageType === 'end-of-call-report' || messageType === 'call-ended' || body?.call) {
      const call = message?.call || body?.call || {};
      const targetLeadId = leadIdQuery || call?.customer?.number || campaignRunner.activeLeadId;

      if (targetLeadId) {
        try {
          const transcript = message?.transcript || call?.transcript || '';
          const summary = message?.summary || call?.summary || '';
          const recordingUrl = message?.recordingUrl || call?.recordingUrl || '';
          const duration = message?.durationSeconds || call?.duration || 0;
          const endedReason = message?.endedReason || call?.endedReason || '';

          // Run classification engine
          const classification = classifyLeadCall(transcript, summary, endedReason);

          const leadDocRef = doc(db, 'leads', targetLeadId);
          await updateDoc(leadDocRef, {
            status: 'COMPLETED',
            outcome: classification.outcome,
            blocked: classification.outcome === 'OPT-OUT',
            duration: Math.round(duration),
            transcript: transcript || 'No transcript generated',
            summary: summary || classification.nextAction,
            buyerOrInvestor: classification.buyerOrInvestor,
            budget: classification.budget || '',
            location: classification.location || '',
            timeline: classification.timeline || '',
            nextAction: classification.nextAction,
            recordingReference: recordingUrl,
            updatedAt: new Date().toISOString(),
          });

          console.log(`[Vapi Webhook] Successfully processed lead ${targetLeadId}. Outcome: ${classification.outcome}`);

          // Update campaign metrics
          const campRef = doc(db, 'campaigns', 'lyka_cold_call_mvp');
          const campSnap = await getDoc(campRef);
          if (campSnap.exists()) {
            const cur = campSnap.data();
            await updateDoc(campRef, {
              activeLeadId: null,
              activeLeadName: null,
              activeLeadPhone: null,
              completedCalls: (cur.completedCalls || 0) + 1,
              hotCount: classification.outcome === 'HOT' ? (cur.hotCount || 0) + 1 : cur.hotCount || 0,
              warmCount: classification.outcome === 'WARM' ? (cur.warmCount || 0) + 1 : cur.warmCount || 0,
              coldCount: classification.outcome === 'COLD' ? (cur.coldCount || 0) + 1 : cur.coldCount || 0,
              optOutCount: classification.outcome === 'OPT-OUT' ? (cur.optOutCount || 0) + 1 : cur.optOutCount || 0,
              noAnswerCount: classification.outcome === 'NO_ANSWER' ? (cur.noAnswerCount || 0) + 1 : cur.noAnswerCount || 0,
              agentCallbackCount: classification.outcome === 'AGENT_CALLBACK' ? (cur.agentCallbackCount || 0) + 1 : cur.agentCallbackCount || 0,
              lastUpdated: new Date().toISOString(),
            });
          }

          campaignRunner.activeLeadId = null;
          campaignRunner.activeCallId = null;

          // Trigger next lead if campaign is running
          if (campaignRunner.isRunning) {
            const appUrl = (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : `${req.protocol}://${req.get('host')}`) || process.env.APP_URL || '';
            setTimeout(() => {
              triggerNextCampaignLead(appUrl);
            }, 3000);
          }
        } catch (updateErr) {
          console.error('[Vapi Webhook Error updating lead]:', updateErr);
        }
      }
    }

    // Always respond 200 to Vapi
    res.status(200).json({ received: true });
  });

  // Vite Integration
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  let PORT = 3000;
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--port' && process.argv[i + 1]) {
      PORT = Number(process.argv[i + 1]);
    } else if (arg.startsWith('--port=')) {
      PORT = Number(arg.split('=')[1]);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lyka Realty AI Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
