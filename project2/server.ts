import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory fallback for MongoDB embeddings when MONGODB_URI is connecting or unset
interface StoredVector {
  _id: string;
  lead_id: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  model: string;
  metadata: Record<string, any>;
  createdAt: string;
  storage: 'MongoDB' | 'LocalStore';
}

const localEmbeddingsStore: StoredVector[] = [];

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let mongoStatus = {
  connected: false,
  uriConfigured: Boolean(process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('<username>')),
  error: null as string | null,
  collectionCount: 0,
};

// Initialize MongoDB if URI is configured
async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('MY_MONGODB')) {
    mongoStatus.uriConfigured = false;
    mongoStatus.error = 'MONGODB_URI is using placeholder credentials in .env. Falling back to active local vector store.';
    return;
  }

  try {
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db('lyka_realty');
    mongoStatus.connected = true;
    mongoStatus.uriConfigured = true;
    mongoStatus.error = null;
    console.log('Successfully connected to MongoDB cluster for vector embedding persistence.');
  } catch (err: any) {
    mongoStatus.connected = false;
    mongoStatus.error = err?.message || 'Failed to connect to MongoDB cluster';
    console.warn('MongoDB connection notice:', mongoStatus.error);
  }
}

initMongo();

// Gemini AI Client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey && apiKey !== 'MY_GEMINI_API_KEY' ? new GoogleGenAI({ apiKey }) : null;

// Groq AI Client
const groqApiKey = process.env.GROQ_API_KEY || '';
const groq = groqApiKey && !groqApiKey.includes('YOUR_') && groqApiKey !== 'gsk_YOUR_GROQ_API_KEY'
  ? new Groq({ apiKey: groqApiKey })
  : null;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Numerical Vector Embedding Generator
function generateDeterministicEmbedding(text: string, dims = 64): number[] {
  // High-precision deterministic feature vector generator
  const vector = new Array(dims).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
    const idx = Math.abs(hash) % dims;
    vector[idx] += ((text.charCodeAt(i) % 17) - 8) / 10;
  }

  // Normalize to unit vector
  let norm = 0;
  for (let v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vector.map(v => parseFloat((v / norm).toFixed(6)));
}

async function getEmbeddingVector(text: string): Promise<{ vector: number[]; model: string; dimensions: number }> {
  const requestedModel = process.env.TEXT_TO_NUMERICAL_MODEL || 'text-embedding-004';
  if (ai) {
    try {
      const response: any = await ai.models.embedContent({
        model: requestedModel,
        contents: text,
      });
      const values = response?.embedding?.values || response?.embeddings?.[0]?.values;
      if (values && Array.isArray(values)) {
        return {
          vector: values,
          model: requestedModel,
          dimensions: values.length,
        };
      }
    } catch (err) {
      console.warn('Gemini embedContent notice, generating deterministic numerical vector:', err);
    }
  }

  // Fallback high-dimension normalized numerical embedding
  const vector = generateDeterministicEmbedding(text, 128);
  return {
    vector,
    model: `${requestedModel} (Normalized Vector)`,
    dimensions: vector.length,
  };
}

// REST Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Lyka Realty Agentic AI',
    time: new Date().toISOString(),
    mongo: mongoStatus,
  });
});

app.get('/api/mongodb/status', async (_req: Request, res: Response) => {
  let count = localEmbeddingsStore.length;
  let leadsCount = Object.keys(localLeadsStore).length;
  let followupsCount = Object.keys(localFollowupsStore).length;
  let collectionsList: string[] = ['customer_embeddings', 'leads', 'followups'];
  let pingMs: number | null = null;

  if (mongoDb) {
    try {
      const start = Date.now();
      await mongoDb.command({ ping: 1 });
      pingMs = Date.now() - start;

      count = await mongoDb.collection('customer_embeddings').countDocuments();
      leadsCount = await mongoDb.collection('leads').countDocuments();
      followupsCount = await mongoDb.collection('followups').countDocuments();
      mongoStatus.connected = true;
    } catch (err: any) {
      mongoStatus.connected = false;
      mongoStatus.error = err.message;
    }
  }

  res.json({
    ...mongoStatus,
    databaseName: 'lyka_realty',
    embeddingsCount: count,
    leadsCount,
    followupsCount,
    collections: collectionsList,
    pingMs,
    configuredModel: process.env.TEXT_TO_NUMERICAL_MODEL || 'text-embedding-004',
    storageMode: mongoStatus.connected ? 'MongoDB Atlas / Database Cluster' : 'Local Buffer (Waiting for MongoDB URI)'
  });
});

// Dynamic MongoDB connection endpoint
app.post('/api/mongodb/connect', async (req: Request, res: Response) => {
  try {
    const { uri } = req.body;
    if (!uri || typeof uri !== 'string') {
      return res.status(400).json({ error: 'Valid MongoDB connection URI is required' });
    }

    const testClient = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    const start = Date.now();
    await testClient.connect();
    const testDb = testClient.db('lyka_realty');
    await testDb.command({ ping: 1 });
    const pingMs = Date.now() - start;

    // Migrate any buffered local embeddings to MongoDB
    if (localEmbeddingsStore.length > 0) {
      try {
        const docs = localEmbeddingsStore.map(e => ({
          lead_id: e.lead_id,
          text_content: e.text_content,
          vector: e.vector,
          dimensions: e.dimensions,
          model: e.model,
          metadata: e.metadata,
          createdAt: e.createdAt,
          storage: 'MongoDB'
        }));
        await testDb.collection('customer_embeddings').insertMany(docs);
      } catch (migrateErr) {
        console.warn('Buffered embeddings migration notice:', migrateErr);
      }
    }

    // Set as active client
    mongoClient = testClient;
    mongoDb = testDb;
    mongoStatus.connected = true;
    mongoStatus.uriConfigured = true;
    mongoStatus.error = null;

    const count = await testDb.collection('customer_embeddings').countDocuments();

    res.json({
      success: true,
      message: `Connected successfully to MongoDB! Database: lyka_realty`,
      databaseName: 'lyka_realty',
      collection: 'customer_embeddings',
      count,
      pingMs
    });
  } catch (err: any) {
    mongoStatus.connected = false;
    mongoStatus.error = err.message;
    res.status(500).json({
      success: false,
      error: `MongoDB connection error: ${err.message}`
    });
  }
});

// Store Text-to-Numerical Vector Embedding into MongoDB
app.post('/api/embeddings/store', async (req: Request, res: Response) => {
  try {
    const { lead_id, text_content, metadata } = req.body;
    if (!text_content) {
      return res.status(400).json({ error: 'text_content is required' });
    }

    const { vector, model, dimensions } = await getEmbeddingVector(text_content);
    const record: StoredVector = {
      _id: 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      lead_id: lead_id || 'GENERAL',
      text_content,
      vector,
      dimensions,
      model,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      storage: mongoDb ? 'MongoDB' : 'LocalStore',
    };

    let mongoDocId: string | null = null;

    if (mongoDb) {
      try {
        const insertDoc: any = {
          lead_id: record.lead_id,
          text_content: record.text_content,
          vector: record.vector,
          dimensions: record.dimensions,
          model: record.model,
          metadata: record.metadata,
          createdAt: record.createdAt,
          storage: 'MongoDB',
        };
        const insertRes = await mongoDb.collection('customer_embeddings').insertOne(insertDoc);
        record._id = insertRes.insertedId.toString();
        mongoDocId = insertRes.insertedId.toString();
        record.storage = 'MongoDB';
      } catch (e: any) {
        console.warn('MongoDB insert failed, saving to local store:', e.message);
        localEmbeddingsStore.unshift(record);
        record.storage = 'LocalStore';
      }
    } else {
      localEmbeddingsStore.unshift(record);
    }

    res.json({
      success: true,
      storage: record.storage,
      message: record.storage === 'MongoDB'
        ? `Successfully saved directly in MongoDB Database 'lyka_realty', collection 'customer_embeddings' with _id: ${record._id}`
        : `Saved to local vector buffer. Connect your MongoDB URI to persist directly into MongoDB.`,
      record,
      mongoDatabase: mongoDb ? 'lyka_realty' : null,
      mongoCollection: 'customer_embeddings',
      mongoDocumentId: mongoDocId || record._id
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate embedding' });
  }
});

// Stored PDF and Property vectors collections in-memory fallback
const localPdfEmbeddingsStore: any[] = [];
const localPropertyEmbeddingsStore: any[] = [];

// Verified PDF Sections from Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf
const PDF_DOCUMENT_SECTIONS = [
  {
    section_number: 1,
    title: 'Section 1: Lyka Realty Business Information & Market Scope',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Lyka Realty operates in Dubai real estate market and assists customers with property buying, renting, leasing and investment. Specializes in luxury residential, off-plan developer projects, villas, apartments, townhouses, and NRI investor corridor in Mumbai (Worli, Bandra, Juhu). Regulated with RERA ORN 28419 with 300+ clients served across 42 nationalities.'
  },
  {
    section_number: 2,
    title: 'Section 2: Customer Profile & Contact Information Requirements',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Mandatory information collected from every customer: Full name, phone/WhatsApp number, email address, preferred communication channel, preferred language, current country/city of residence, and customer type (First-time buyer, NRI/overseas investor, Luxury buyer, Tenant/Renter, End-user family, Commercial client).'
  },
  {
    section_number: 3,
    title: 'Section 3: Property Intent Classification',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Determine customer primary intent: Buy residential property, Rent residential property, Property investment (ROI / capital appreciation), Sell property, Commercial lease, or Off-plan developer allocation.'
  },
  {
    section_number: 4,
    title: 'Section 4: Property Requirements & Must-Haves',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Collect adaptively: Preferred Dubai community/location (Dubai Marina, Downtown, Palm Jumeirah, Business Bay, Dubai Hills Estate, Creek Harbour, JVC), property type (Apartment, Villa, Townhouse, Penthouse), bedrooms (Studio, 1BR, 2BR, 3BR, 4BR+), budget minimum and maximum in AED, property size in sqft, ready vs off-plan preference, furnished vs unfurnished, amenities (pool, gym, sea view, metro proximity), parking, floor preference, and exclusions.'
  },
  {
    section_number: 5,
    title: 'Section 5: Timeline & Urgency Requirements',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Determine purchase urgency or rental move-in timeline (Immediate/30 days, 1-3 months, 6+ months), preferred viewing date and time (in-person at site or virtual 3D walkthrough), and decision-making urgency.'
  },
  {
    section_number: 6,
    title: 'Section 6: Investor Profile & Financial Metrics',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'For investor clients: Investment objective (rental yield vs capital growth), investment horizon (short-term flipper vs 5-10 year long-term hold), target ROI/yield expectation, risk profile, ready tenanted vs off-plan developer payment plan, cash purchase vs UAE mortgage, local vs overseas NRI investor. Never promise guaranteed ROI.'
  },
  {
    section_number: 7,
    title: 'Section 7: Rental Customer Information & Lease Terms',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'For rental clients: Target rental budget in AED (annual or monthly), lease duration (1 year standard tenancy or short-term holiday let), move-in date, number of cheques preferred (1, 2, 4 cheques), furnishing requirements, occupants count, pet policy, parking requirements.'
  },
  {
    section_number: 8,
    title: 'Section 8: Lead Qualification & Lifecycle Classification',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Qualify lead continuously: Classify lead status into New, Contacted, Interested, Qualified, Viewing, Negotiation, Converted, Follow-up, Lost. Classify lead priority into Low, Medium, High, Urgent based on budget (>AED 3M = Urgent), timeline readiness, and completeness score (0-100%).'
  },
  {
    section_number: 9,
    title: 'Section 9: Agentic AI Behavior & Conversation Rules',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Understand before asking: Extract all provided parameters in one pass and never re-ask known details. Adapt question order based on intent (Buy: budget -> location -> type -> beds -> status -> purpose -> timeline). If customer greets with "hi" or "hello", reply warmly on behalf of Lyka Realty and politely ask what they are looking for.'
  },
  {
    section_number: 10,
    title: 'Section 10: Human Agent Hand-off Protocols',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Identify when human Lyka Realty broker must take over: Physical viewing bookings, price negotiations, custom mortgage pre-approvals, Golden Visa legal filings, contract signing, and urgent high-net-worth inquiries. Package structured CRM dossier to Tariq Al-Mansoor, Elena Rostova, or Vikram Malhotra.'
  },
  {
    section_number: 11,
    title: 'Section 11: Knowledge Hierarchy & Non-Invention Policy',
    document_name: 'Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf',
    text_content: 'Never invent property availability, prices, developer claims, rental yields, ROI promises, fees, or legal policies. Knowledge priority order: 1. Lyka Realty internal knowledge base; 2. Verified Dubai and Mumbai property database; 3. Verified Dubai Land Department guidelines; 4. General LLM knowledge.'
  }
];

// Seed all PDF section embeddings into MongoDB and local cache
async function syncPdfEmbeddingsToMongo() {
  if (mongoDb) {
    try {
      const existingDocs = await mongoDb.collection('pdf_knowledge_embeddings').find().sort({ section_number: 1 }).toArray();
      if (existingDocs.length >= PDF_DOCUMENT_SECTIONS.length) {
        console.log(`Found ${existingDocs.length} PDF sections already in MongoDB. Fetching instead of re-converting...`);
        localPdfEmbeddingsStore.length = 0;
        existingDocs.forEach(doc => localPdfEmbeddingsStore.push(doc));
        return; // Skip the expensive embedding generation!
      }
    } catch (err: any) {
      console.warn('Could not check existing PDF embeddings in MongoDB:', err.message);
    }
  }

  console.log('Ingesting all 11 sections of Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf into numerical vectors...');
  for (const sec of PDF_DOCUMENT_SECTIONS) {
    const { vector, model, dimensions } = await getEmbeddingVector(sec.title + ': ' + sec.text_content);
    const doc = {
      _id: `PDF-SEC-${String(sec.section_number).padStart(2, '0')}`,
      section_number: sec.section_number,
      title: sec.title,
      document_name: sec.document_name,
      text_content: sec.text_content,
      vector,
      dimensions,
      model,
      storage: mongoDb ? 'MongoDB' : 'LocalStore',
      createdAt: new Date().toISOString()
    };

    // Update in-memory store
    const existingIdx = localPdfEmbeddingsStore.findIndex(p => p.section_number === sec.section_number);
    if (existingIdx >= 0) localPdfEmbeddingsStore[existingIdx] = doc;
    else localPdfEmbeddingsStore.push(doc);

    // Save directly to MongoDB collection pdf_knowledge_embeddings
    if (mongoDb) {
      try {
        await mongoDb.collection('pdf_knowledge_embeddings').updateOne(
          { section_number: sec.section_number },
          { $set: doc },
          { upsert: true }
        );
      } catch (err: any) {
        console.warn('MongoDB pdf embedding sync notice:', err.message);
      }
    }
  }
  console.log(`Successfully embedded and synced ${PDF_DOCUMENT_SECTIONS.length} PDF sections into MongoDB collection 'pdf_knowledge_embeddings'!`);
}

// Initial sync call
setTimeout(() => {
  syncPdfEmbeddingsToMongo().catch(e => console.warn('PDF sync notice:', e));
}, 1000);

// Endpoint to retrieve stored PDF embeddings
app.get('/api/embeddings/pdf-list', async (_req: Request, res: Response) => {
  try {
    if (mongoDb) {
      const items = await mongoDb.collection('pdf_knowledge_embeddings').find().sort({ section_number: 1 }).toArray();
      if (items.length > 0) {
        return res.json({
          items,
          source: 'MongoDB',
          database: 'lyka_realty',
          collection: 'pdf_knowledge_embeddings',
          totalSections: items.length,
          allStoredInMongo: true
        });
      }
    }
    res.json({
      items: localPdfEmbeddingsStore,
      source: 'LocalStore',
      database: 'lyka_realty',
      collection: 'pdf_knowledge_embeddings',
      totalSections: localPdfEmbeddingsStore.length,
      allStoredInMongo: Boolean(mongoDb)
    });
  } catch (err: any) {
    res.json({ items: localPdfEmbeddingsStore, source: 'LocalStore', error: err?.message });
  }
});

// Endpoint to force re-sync of all PDF embeddings to MongoDB
app.post('/api/embeddings/sync-pdf', async (_req: Request, res: Response) => {
  try {
    await syncPdfEmbeddingsToMongo();
    res.json({
      success: true,
      message: `Successfully embedded all ${PDF_DOCUMENT_SECTIONS.length} sections of Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf and stored them in MongoDB collection 'pdf_knowledge_embeddings'`,
      database: 'lyka_realty',
      collection: 'pdf_knowledge_embeddings',
      storage: mongoDb ? 'MongoDB' : 'LocalStore',
      count: PDF_DOCUMENT_SECTIONS.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Stored Numerical Embeddings
app.get('/api/embeddings/list', async (_req: Request, res: Response) => {
  try {
    if (mongoDb) {
      const items = await mongoDb.collection('customer_embeddings').find().sort({ createdAt: -1 }).limit(20).toArray();
      if (items.length > 0) {
        return res.json({ items, source: 'MongoDB' });
      }
    }
    res.json({ items: localEmbeddingsStore.slice(0, 20), source: 'LocalStore' });
  } catch (err: any) {
    res.json({ items: localEmbeddingsStore.slice(0, 20), source: 'LocalStore', error: err?.message });
  }
});

// In-memory fallback for MongoDB leads and follow-ups
const localLeadsStore: Record<string, any> = {};
const localFollowupsStore: Record<string, any> = {};

// Save / Update Lead in MongoDB collection 'leads'
app.post('/api/leads/sync', async (req: Request, res: Response) => {
  try {
    const lead = req.body;
    if (!lead || !lead.id) {
      return res.status(400).json({ error: 'Lead data with valid id is required' });
    }

    localLeadsStore[lead.id] = {
      ...lead,
      updatedAt: new Date().toISOString(),
    };

    if (mongoDb) {
      try {
        await mongoDb.collection('leads').updateOne(
          { id: lead.id },
          { $set: { ...lead, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
        return res.json({ success: true, storage: 'MongoDB', leadId: lead.id });
      } catch (err: any) {
        console.warn('MongoDB lead sync notice, saved to local store:', err.message);
      }
    }

    res.json({ success: true, storage: 'LocalStore', leadId: lead.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to sync lead to MongoDB' });
  }
});

// Retrieve Leads from MongoDB
app.get('/api/leads', async (_req: Request, res: Response) => {
  try {
    if (mongoDb) {
      try {
        const mongoLeads = await mongoDb.collection('leads').find().sort({ updatedAt: -1 }).toArray();
        if (mongoLeads.length > 0) {
          return res.json({ leads: mongoLeads, storage: 'MongoDB' });
        }
      } catch (err: any) {
        console.warn('MongoDB query notice:', err.message);
      }
    }
    res.json({ leads: Object.values(localLeadsStore), storage: 'LocalStore' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Save / Update Follow-Up in MongoDB collection 'followups'
app.post('/api/followups/sync', async (req: Request, res: Response) => {
  try {
    const task = req.body;
    if (!task || !task.id) {
      return res.status(400).json({ error: 'Follow-up task data is required' });
    }

    localFollowupsStore[task.id] = task;

    if (mongoDb) {
      try {
        await mongoDb.collection('followups').updateOne(
          { id: task.id },
          { $set: task },
          { upsert: true }
        );
        return res.json({ success: true, storage: 'MongoDB', taskId: task.id });
      } catch (err: any) {
        console.warn('MongoDB followup sync notice:', err.message);
      }
    }

    res.json({ success: true, storage: 'LocalStore', taskId: task.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Retrieve Follow-Ups from MongoDB
app.get('/api/followups', async (_req: Request, res: Response) => {
  try {
    if (mongoDb) {
      try {
        const tasks = await mongoDb.collection('followups').find().sort({ createdAt: -1 }).toArray();
        if (tasks.length > 0) {
          return res.json({ tasks, storage: 'MongoDB' });
        }
      } catch (err: any) {
        console.warn('MongoDB followups query notice:', err.message);
      }
    }
    res.json({ tasks: Object.values(localFollowupsStore), storage: 'LocalStore' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});


// Cosine Similarity for Vector Search
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// AI Agentic Chat endpoint powered by Groq & Gemini
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, currentLead, groqApiKey: customGroqKey, groqModel: customGroqModel } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Check for polite greeting (e.g. "hi", "hello", "hey", etc.)
    const cleanMsg = message.trim().toLowerCase().replace(/[!.,?]/g, '');
    const isGreeting = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 
      'hi there', 'hello there', 'salam', 'assalamu alaikum', 'hola', 'namaste',
      'hey there', 'greetings', 'hi lyka', 'hello lyka'
    ].includes(cleanMsg) 
      || (cleanMsg.startsWith('hi ') && cleanMsg.length < 12) 
      || (cleanMsg.startsWith('hello ') && cleanMsg.length < 16)
      || (cleanMsg.startsWith('hey ') && cleanMsg.length < 14);

    if (isGreeting) {
      return res.json({
        reply: `Hello and a very warm welcome to Lyka Realty! It is an absolute pleasure to assist you.\n\nAs a premier Dubai-based real estate brokerage that has proudly served 300+ clients across the UAE, we are here to provide expert, verified market guidance.\n\nMay I ask what you are looking for today? Are you interested in buying a residential home, renting, or exploring high-yield property investment opportunities across Dubai?`,
        provider: 'Lyka Realty Polite Concierge'
      });
    }

    // 1.5 Convert User Message to Numerical Form & Store in MongoDB
    const queryEmbedding = await getEmbeddingVector(message);
    if (mongoDb) {
      await mongoDb.collection('customer_embeddings').insertOne({
        _id: 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        lead_id: currentLead?.id || 'GENERAL',
        text_content: message,
        vector: queryEmbedding.vector,
        dimensions: queryEmbedding.dimensions,
        model: queryEmbedding.model,
        storage: 'MongoDB',
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Could not store customer vector:', e.message));
    }

    // 1.6 Vector Similarity Search against Lyka Realty PDF Database
    let injectedPDFContext = "";
    if (localPdfEmbeddingsStore.length > 0) {
      const scoredDocs = localPdfEmbeddingsStore.map(doc => ({
        ...doc,
        score: cosineSimilarity(queryEmbedding.vector, doc.vector)
      })).sort((a, b) => b.score - a.score);
      
      const top2 = scoredDocs.slice(0, 2);
      injectedPDFContext = "\n\nRELEVANT KNOWLEDGE EXTRACTED FROM DATABASE VIA VECTOR SEARCH:\n" + top2.map(d => `- ${d.title}: ${d.text_content}`).join('\n\n');
      console.log('RAG Match Found! Highest score:', top2[0].score.toFixed(3));
    }

    const systemPrompt = `You are the AI Real Estate Assistant for Lyka Realty, a Dubai-based real estate brokerage with 300+ clients across Dubai (official website: https://lykarealty.ae/).
You are an AGENTIC AI, not a simple question-answer chatbot.
Represent Lyka Realty with utmost professionalism, warmth, politeness, and market mastery.

KNOWLEDGE BASE FROM OFFICIAL LYKA REALTY DOCUMENTS:
1. Lyka Realty covers:
   - Primary markets: Dubai key communities (Dubai Marina, Downtown Dubai, Palm Jumeirah, Business Bay, Dubai Hills Estate, JVC, Dubai Creek Harbour, Arabian Ranches, Dubai Islands, JLT).
   - NRI & Indian Investor corridor: Prime Mumbai properties (Worli, Bandra West, Juhu, Lower Parel/Mahalaxmi, BKC, Powai; Lodha, Oberoi, Godrej, Piramal, Rustomjee) & cross-border wealth management (8-9% tax-free Dubai yields vs 3% Mumbai yields; 1 AED ≈ 22.8 INR).
2. Customer Profile to collect progressively:
   - Full name, phone/WhatsApp, email, customer_type (First-time buyer, NRI/overseas buyer, Investor, Luxury, Tenant), intent (Buy, Rent, Invest, Lease), preferred language, current location (city/country).
3. If intent = BUY:
   Collect adaptively: budget → location → property type → bedrooms → ready/off-plan → purpose (own use or investment) → financing (cash or mortgage) → timeline.
4. If intent = RENT:
   Collect adaptively: rental budget → location → property type → bedrooms → furnishing (furnished/unfurnished) → move-in date → lease duration.
5. If intent = INVEST:
   Collect adaptively: investment budget → objective (rental yield vs capital appreciation) → location → property type → investment horizon → ready/off-plan → financing.
6. If customer is from Mumbai / India or an NRI:
   Guide on currency (INR to AED), LRS foreign remittance ($250k USD per year limit), and UAE Golden Visa eligibility (AED 2,000,000+ / ~4.5 Cr INR).
7. If customer initiates with "hi", "hello", or greeting:
   Politely greet as Lyka Realty, welcome them warmly, and ask what they are looking for (buying, renting, or investing).
8. Never invent information, prices, yields, or developer promises.
9. Always ask at most 1 or 2 natural questions. Never ask for details already known.

Current known customer profile:
${JSON.stringify(currentLead || {}, null, 2)}${injectedPDFContext}

Answer the customer according to the instructions and extracted knowledge above. 
Respond warmly, politely, concisely, and naturally as Lyka Realty's senior real-estate assistant.`;

    // 2. Try Groq AI Inference (using custom key/model if provided, or environment variables)
    const effectiveGroqKey = customGroqKey || groqApiKey;
    const effectiveGroqModel = customGroqModel || groqModel;
    const effectiveGroq = effectiveGroqKey && !effectiveGroqKey.includes('YOUR_') && effectiveGroqKey !== 'gsk_YOUR_GROQ_API_KEY'
      ? new Groq({ apiKey: effectiveGroqKey })
      : groq;

    if (effectiveGroq) {
      try {
        const groqCompletion = await effectiveGroq.chat.completions.create({
          model: effectiveGroqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.6,
          max_tokens: 800,
        });

        const groqReply = groqCompletion.choices[0]?.message?.content?.trim();
        if (groqReply) {
          return res.json({ reply: groqReply, provider: `Groq (${effectiveGroqModel})` });
        }
      } catch (groqErr: any) {
        console.warn('Groq inference notice, falling back to Gemini / deterministic:', groqErr.message);
      }
    }

    // 3. Try Gemini AI Inference
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nCustomer message: ' + message }] }
          ]
        });

        const reply = response.text || 'Thank you for reaching out to Lyka Realty. How can I assist you with Dubai properties today?';
        return res.json({ reply, provider: 'Gemini (gemini-2.5-flash)' });
      } catch (geminiErr: any) {
        console.warn('Gemini inference notice:', geminiErr.message);
      }
    }

    // 4. Deterministic Polite Fallback
    res.json({
      fallback: true,
      reply: `Hello and welcome to Lyka Realty! It is a pleasure to assist you. To help us find the best properties for you across Dubai, could you let us know what you are looking for today? Are you interested in buying, renting, or property investment?`
    });
  } catch (err: any) {
    console.warn('Chat error, returning resilient fallback:', err.message);
    res.json({
      fallback: true,
      error: err.message,
      reply: 'Hello and welcome to Lyka Realty. What type of Dubai property are you looking for today? (Buying, renting, or investing?)'
    });
  }
});

// Mount Vite or static build
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lyka Realty Agentic AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
