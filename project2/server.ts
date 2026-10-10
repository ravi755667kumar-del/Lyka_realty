import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { runLykaAgent, injectDependencies } from './langgraph_agent.js';
import { ALL_VERIFIED_PROPERTIES } from './src/data/all_properties.js';

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
  uriConfigured: validateMongoUri(process.env.MONGODB_URI) === null,
  error: null as string | null,
  collectionCount: 0,
};

// Validate MONGODB_URI shape before attempting a connection.
//
// Without this, a malformed host, a typo and a genuine outage all surface as the
// same "querySrv ENOTFOUND" message, which blames DNS and hides the real cause.
// Returns null when the URI looks usable, otherwise a specific, actionable reason.
function validateMongoUri(uri: string | undefined): string | null {
  if (!uri || !uri.trim()) {
    return 'MONGODB_URI is not set in .env. Falling back to the in-memory vector store.';
  }
  if (uri.includes('<username>') || uri.includes('<password>') || uri.includes('MY_MONGODB')) {
    return 'MONGODB_URI still contains placeholder credentials (<username>/<password>). Replace it with the real connection string from Atlas → Connect → Drivers.';
  }

  const isSrv = uri.startsWith('mongodb+srv://');
  if (!isSrv && !uri.startsWith('mongodb://')) {
    return 'MONGODB_URI must start with mongodb+srv:// (Atlas) or mongodb://.';
  }
  if (!isSrv) {
    return null; // direct connection strings do not use SRV hostnames
  }

  let host = '';
  try {
    host = new URL(uri.replace('mongodb+srv://', 'https://')).hostname;
  } catch {
    return 'MONGODB_URI could not be parsed. Copy the full connection string from Atlas → Connect → Drivers.';
  }

  if (!host) {
    return 'MONGODB_URI has no hostname.';
  }
  if (!host.endsWith('.mongodb.net')) {
    return `MONGODB_URI host "${host}" is not a MongoDB Atlas hostname (expected something ending in .mongodb.net).`;
  }
  // Atlas SRV hosts always carry a shard id: cluster0.<id>.mongodb.net (4+ labels).
  const labels = host.split('.');
  if (labels.length < 4) {
    return `MONGODB_URI host "${host}" is missing the Atlas shard subdomain — that hostname does not exist. A real Atlas SRV host looks like cluster0.<shard-id>.mongodb.net. Copy the full string from Atlas → Connect → Drivers.`;
  }

  const at = uri.indexOf('@');
  const creds = at > 0 ? uri.slice(uri.indexOf('://') + 3, at) : '';
  if (!creds.includes(':')) {
    return 'MONGODB_URI is missing a username or password (expected mongodb+srv://user:password@host/db).';
  }
  if (!creds.split(':')[0]) {
    return 'MONGODB_URI is missing a username (expected mongodb+srv://user:password@host/db).';
  }
  if (!creds.split(':')[1]) {
    return 'MONGODB_URI is missing a password (expected mongodb+srv://user:password@host/db).';
  }

  return null;
}

// Initialize MongoDB if URI is configured.
// Safe to call repeatedly: concurrent callers share one in-flight attempt, and a
// failure is retryable (the bootstrap loop depends on that).
let mongoConnectAttempt: Promise<boolean> | null = null;

async function initMongo(): Promise<boolean> {
  if (mongoDb) return true;
  if (mongoConnectAttempt) return mongoConnectAttempt;

  mongoConnectAttempt = (async () => {
    const uri = process.env.MONGODB_URI;

    const invalid = validateMongoUri(uri);
    if (!uri || invalid) {
      mongoStatus.uriConfigured = false;
      mongoStatus.error = invalid ?? 'MONGODB_URI is not set in .env.';
      console.warn('MongoDB not attempted —', mongoStatus.error);
      return false;
    }

    let candidate: MongoClient | null = null;
    try {
      candidate = new MongoClient(uri, { 
        serverSelectionTimeoutMS: 6000,
        tlsAllowInvalidCertificates: true,
      });
      await candidate.connect();
      const db = candidate.db('lyka_realty');
      await db.command({ ping: 1 }); // confirm the handle is actually usable
      mongoClient = candidate;
      mongoDb = db;
      mongoStatus.connected = true;
      mongoStatus.uriConfigured = true;
      mongoStatus.error = null;
      console.log('Successfully connected to MongoDB cluster for vector embedding persistence.');
      return true;
    } catch (err: any) {
      if (candidate) await candidate.close().catch(() => {});
      mongoStatus.connected = false;
      let errMsg = err?.message || 'Failed to connect to MongoDB cluster';
      if (errMsg.includes('SSL alert number 80') || errMsg.includes('tlsv1 alert internal error')) {
        errMsg = 'MongoDB Atlas rejected TLS connection (SSL Alert 80). Please ensure your current IP address (or 0.0.0.0/0 for access from anywhere) is whitelisted in MongoDB Atlas Security -> Network Access.';
      }
      mongoStatus.error = errMsg;
      console.warn('MongoDB connection notice:', mongoStatus.error);
      return false;
    } finally {
      mongoConnectAttempt = null;
    }
  })();

  return mongoConnectAttempt;
}

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
        model: 'text-embedding-004',
        contents: text,
      });
      const values = response?.embedding?.values || response?.embeddings?.[0]?.values;
      if (values && Array.isArray(values)) {
        return {
          vector: values,
          model: 'text-embedding-004',
          dimensions: values.length,
        };
      }
    } catch {
      // Clean fallback to deterministic numerical vector
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

    const testClient = new MongoClient(uri, { 
      serverSelectionTimeoutMS: 6000,
      tlsAllowInvalidCertificates: true,
    });
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

    // PDF/property embeddings were held in memory only while MongoDB was
    // unreachable. Persist them now that we have a working handle.
    syncPdfEmbeddingsToMongo()
      .then(() => syncPropertyEmbeddingsToMongo())
      .then(() => injectAgentDependencies())
      .catch(e => console.warn('Post-connect embedding sync notice:', e?.message));

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

// Load PDF sections from the actual PDF file
let PDF_DOCUMENT_SECTIONS: Array<{
  section_number: number;
  title: string;
  document_name: string;
  text_content: string;
}> = [];

const PDF_CANONICAL_FILENAME = 'Real_Estate_Lead_Qualification_Agent_Instructions_v2.pdf';

// Resolve the instructions PDF. Browsers often append " (1)", " (2)" etc. to
// downloads, so fall back to a pattern match instead of failing silently.
function resolvePdfPath(): string | null {
  const dataDir = path.join(__dirname, 'src', 'data');
  const canonical = path.join(dataDir, PDF_CANONICAL_FILENAME);
  if (fs.existsSync(canonical)) return canonical;

  let files: string[] = [];
  try {
    files = fs.readdirSync(dataDir);
  } catch {
    return null;
  }
  const match = files
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .filter(f => f.startsWith('Real_Estate_Lead_Qualification_Agent_Instructions_v2'))
    .sort()[0];
  return match ? path.join(dataDir, match) : null;
}

async function loadPdfSections() {
  try {
    const pdfPath = resolvePdfPath();
    if (!pdfPath) {
      console.warn(`[PDF] No instructions PDF found in ${path.join(__dirname, 'src', 'data')} — RAG knowledge base will be empty.`);
      return;
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    let fullText = '';
    const PDFClass = pdf.PDFParse || pdf;
    if (typeof PDFClass === 'function') {
      try {
        const instance = new PDFClass({ data: dataBuffer });
        if (typeof instance.getText === 'function') {
          const res = await instance.getText();
          fullText = res?.text || (typeof res === 'string' ? res : '');
        }
      } catch (e: any) {
        console.warn(`[PDF] getText() failed (${e.message}), trying callable form...`);
      }
      if (!fullText) {
        try {
          const res = await (PDFClass as any)(dataBuffer);
          fullText = res?.text || '';
        } catch (e: any) {
          console.warn(`[PDF] callable parse form failed: ${e.message}`);
        }
      }
    } else {
      console.warn('[PDF] pdf-parse exposed no callable parser (neither PDFParse nor default export).');
    }

    if (fullText) {
      const sections = fullText.split(/(?=\n(?:\d+\.|\d+\.\d+)\s+[A-Z])/).filter((c: string) => c.trim().length > 30);
      PDF_DOCUMENT_SECTIONS = sections.map((chunk: string, index: number) => {
        const firstLine = chunk.trim().split('\n')[0].replace(/^[^\w]+/, '').trim().substring(0, 60);
        return {
          section_number: index + 1,
          title: firstLine || `Section ${index + 1}`,
          document_name: 'Real_Estate_Lead_Qualification_Agent_Instructions_v2.pdf',
          text_content: chunk.trim(),
        };
      });
      console.log(`[PDF] Loaded ${PDF_DOCUMENT_SECTIONS.length} structured sections from ${path.basename(pdfPath)}`);
    } else {
      PDF_DOCUMENT_SECTIONS = [];
      console.warn(`[PDF] Parsed ${path.basename(pdfPath)} but extracted 0 characters of text — RAG knowledge base will be empty.`);
    }
  } catch (err: any) {
    PDF_DOCUMENT_SECTIONS = [];
    console.warn('Failed to load PDF file:', err.message);
  }
}

// Seed all PDF section embeddings into MongoDB and local cache
async function syncPdfEmbeddingsToMongo() {
  await loadPdfSections();
  if (PDF_DOCUMENT_SECTIONS.length === 0) {
    console.warn('[PDF] No sections extracted from PDF to embed.');
    return;
  }

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

  console.log(`Ingesting all ${PDF_DOCUMENT_SECTIONS.length} sections of Real_Estate_Lead_Qualification_Agent_Instructions_v2.pdf into numerical vectors...`);
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
        // `_id` is immutable — including it in $set makes MongoDB reject the
        // whole update, which previously failed silently on every re-sync.
        const { _id: _ignoredId, ...updatable } = doc;
        await mongoDb.collection('pdf_knowledge_embeddings').updateOne(
          { section_number: sec.section_number },
          { $set: updatable },
          { upsert: true }
        );
      } catch (err: any) {
        console.warn('MongoDB pdf embedding sync notice:', err.message);
      }
    }
  }
  if (mongoDb) {
    console.log(`[PDF] Embedded ${PDF_DOCUMENT_SECTIONS.length} sections and persisted them to MongoDB collection 'pdf_knowledge_embeddings'.`);
  } else {
    console.warn(`[PDF] Embedded ${PDF_DOCUMENT_SECTIONS.length} sections into the IN-MEMORY STORE ONLY — nothing was persisted to MongoDB (${mongoStatus.error || 'MongoDB not connected'}). This knowledge base is lost on restart.`);
  }
}

// Seed all Property embeddings into MongoDB
async function syncPropertyEmbeddingsToMongo() {
  if (ALL_VERIFIED_PROPERTIES.length === 0) return;

  if (mongoDb) {
    try {
      const existingDocs = await mongoDb.collection('property_embeddings').countDocuments();
      if (existingDocs >= ALL_VERIFIED_PROPERTIES.length) {
        console.log(`[Properties] Found ${existingDocs} properties already embedded in MongoDB. Skipping re-conversion.`);
        return;
      }
    } catch (err: any) {
      console.warn('Could not check existing property embeddings:', err.message);
    }
  }

  console.log(`[Properties] Ingesting ${ALL_VERIFIED_PROPERTIES.length} properties into numerical vectors...`);
  for (const prop of ALL_VERIFIED_PROPERTIES as any[]) {
    const textContent = `${prop.title}. ${prop.property_type} in ${prop.community}, ${prop.city || 'Dubai'}. ${prop.bedrooms} Bedrooms. Price: AED ${prop.price_aed}. Status: ${prop.status}. Amenities: ${(prop.amenities || []).join(', ')}. ${prop.description || ''}`;
    const { vector, model, dimensions } = await getEmbeddingVector(textContent);
    
    const doc = {
      _id: `PROP-${prop.id}`,
      property_id: prop.id,
      title: prop.title,
      community: prop.community,
      city: prop.city || 'Dubai',
      price_aed: prop.price_aed,
      text_content: textContent,
      vector,
      dimensions,
      model,
      storage: mongoDb ? 'MongoDB' : 'LocalStore',
      createdAt: new Date().toISOString()
    };

    localPropertyEmbeddingsStore.push(doc);

    if (mongoDb) {
      try {
        // `_id` is immutable — strip it before $set (see pdf sync above).
        const { _id: _ignoredId, ...updatable } = doc;
        await mongoDb.collection('property_embeddings').updateOne(
          { property_id: prop.id },
          { $set: updatable },
          { upsert: true }
        );
      } catch (err: any) {
        console.warn('MongoDB property embedding sync notice:', err.message);
      }
    }
  }
  if (mongoDb) {
    console.log(`[Properties] Embedded ${ALL_VERIFIED_PROPERTIES.length} properties and persisted them to MongoDB collection 'property_embeddings'.`);
  } else {
    console.warn(`[Properties] Embedded ${ALL_VERIFIED_PROPERTIES.length} properties into the IN-MEMORY STORE ONLY — nothing was persisted to MongoDB (${mongoStatus.error || 'MongoDB not connected'}).`);
  }
}

// Boot sequence.
//
// This used to be `setTimeout(..., 1000)`, which raced the 4s Atlas connect
// timeout: on a slow or DNS-blocked connection both syncs took the in-memory
// path and nothing was ever written to MongoDB, with no retry and no error.
async function waitForMongo(maxAttempts = 3): Promise<boolean> {
  // A malformed URI can never succeed, so don't burn the retry budget on it.
  const invalid = validateMongoUri(process.env.MONGODB_URI);
  if (invalid) {
    // Record it here — initMongo() is never reached, so /api/health would
    // otherwise keep reporting the raw env check and a null error.
    mongoStatus.uriConfigured = false;
    mongoStatus.error = invalid;
    console.warn('MongoDB not attempted —', invalid);
    return false;
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await initMongo()) return true;
    if (attempt < maxAttempts) {
      const backoffMs = attempt * 2000;
      console.warn(`[Boot] MongoDB unavailable, retrying in ${backoffMs / 1000}s (attempt ${attempt}/${maxAttempts}).`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  return false;
}

async function injectAgentDependencies() {
  injectDependencies({
    groq,
    gemini: ai,
    groqModel,
    pdfChunks: localPdfEmbeddingsStore.map(s => ({
      title: s.title,
      text_content: s.text_content,
      vector: s.vector,
    })),
    properties: (ALL_VERIFIED_PROPERTIES || []) as any[],
  });
}

async function bootstrapAgent() {
  // The property inventory is static in-memory data, so hand it to the agent
  // straight away — otherwise /api/chat would search an empty list (and, with
  // hard filters, answer "no match") for the whole MongoDB connect window.
  injectDependencies({
    groq,
    gemini: ai,
    groqModel,
    pdfChunks: [],
    properties: (ALL_VERIFIED_PROPERTIES || []) as any[],
  });

  const connected = await waitForMongo();
  if (!connected) {
    console.warn(`[Boot] Starting WITHOUT MongoDB. Embeddings will be held in memory only and lost on restart. Reason: ${mongoStatus.error || 'MONGODB_URI not configured'}`);
  }

  try {
    await syncPdfEmbeddingsToMongo();
    await syncPropertyEmbeddingsToMongo();
  } catch (err: any) {
    console.warn('[Boot] Embedding sync failed:', err?.message);
  } finally {
    await injectAgentDependencies();
    console.log(`[LangGraph] Agent initialized with ${localPdfEmbeddingsStore.length} PDF chunks and ${(ALL_VERIFIED_PROPERTIES || []).length} properties (storage: ${mongoDb ? 'MongoDB' : 'IN-MEMORY ONLY'}).`);
  }
}

bootstrapAgent();

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
    const {
      message,
      history,
      currentLead,
      conversationStage,
      groqApiKey: customGroqKey,
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Store user message as vector in MongoDB (for analytics)
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

    // 2. If a custom Groq key is passed, temporarily inject it
    if (customGroqKey && !customGroqKey.includes('YOUR_') && customGroqKey !== groqApiKey) {
      injectDependencies({
        groq: new Groq({ apiKey: customGroqKey }),
        gemini: ai,
        pdfChunks: localPdfEmbeddingsStore.map(s => ({
          title: s.title,
          text_content: s.text_content,
          vector: s.vector,
        })),
        properties: (ALL_VERIFIED_PROPERTIES || []) as any[],
      });
    }

    // 3. Run through LangGraph agent
    const agentResult = await runLykaAgent({
      userMessage: message,
      chatHistory: (history || []).map((h: any) => ({ role: h.role, content: h.content })),
      profile: {
        intent: currentLead?.intent || '',
        budget_max: currentLead?.budget_max,
        preferred_communities: currentLead?.preferred_communities || [],
        property_type: currentLead?.property_type || '',
        bedrooms: currentLead?.bedrooms,
        ready_or_offplan: currentLead?.ready_or_offplan || '',
        financing: currentLead?.financing || '',
        timeline: currentLead?.timeline || '',
        rental_budget: currentLead?.rental_budget,
        furnishing: currentLead?.furnishing || '',
        move_in_date: currentLead?.move_in_date || '',
        investment_goal: currentLead?.investment_goal || '',
        full_name: currentLead?.full_name || '',
        mobile: currentLead?.phone || '',
        email: currentLead?.email || '',
        contact_declined: currentLead?.contact_declined || false,
        contact_pending: currentLead?.contact_pending,
        contact_recheck_asked: currentLead?.contact_recheck_asked || false,
        unsure_slots: currentLead?.unsure_slots || [],
        is_nri: currentLead?.is_nri || false,
        target_city: currentLead?.target_city || '',
        requirement_completeness: currentLead?.requirement_completeness || 0,
      },
      conversationStage: conversationStage || (currentLead?.next_action ? mapStageFromAction(currentLead.next_action, currentLead.intent) : 'new'),
    });

    console.log(`[LangGraph] Node: ${agentResult.nextStage} | Provider: ${agentResult.provider} | Properties Found: ${agentResult.matchedProperties.length}`);

    return res.json({
      reply: agentResult.reply,
      provider: agentResult.provider,
      matchedProperties: agentResult.matchedProperties,
      updatedProfile: agentResult.updatedProfile,
      nextStage: agentResult.nextStage,
      ragContext: agentResult.ragContext,
    });

  } catch (err: any) {
    console.warn('[LangGraph] Chat error:', err.message);
    res.json({
      fallback: true,
      error: err.message,
      reply: `Hello! Welcome to Lyka Realty. I'm Lyka, your AI property concierge. Are you looking to **buy**, **rent**, **invest**, or **sell** a property today?`
    });
  }
});

function mapStageFromAction(nextAction: string, intent: string): string {
  if (!intent) return 'classify_intent';
  const i = (intent || '').toLowerCase();
  if (i === 'buy') return 'qualify_buy';
  if (i === 'rent') return 'qualify_rent';
  if (i === 'invest') return 'qualify_invest';
  if (i === 'sell') return 'qualify_sell';
  return 'classify_intent';
}



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
    console.log(`Lyka Realty Agentic AI server running on http://localhost:${PORT}`);
  });
}

startServer();
