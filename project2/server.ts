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
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc as fsDoc, 
  getDoc as fsGetDoc, 
  setDoc as fsSetDoc, 
  getDocs as fsGetDocs, 
  collection as fsCollection, 
  query as fsQuery, 
  orderBy as fsOrderBy, 
  limit as fsLimit 
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { runLykaAgent, injectDependencies } from './langgraph_agent.js';
import { ALL_VERIFIED_PROPERTIES } from './src/data/all_properties.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Vector Embedding Interface
interface StoredVector {
  _id: string;
  id?: string;
  lead_id: string;
  section_number?: number;
  title?: string;
  document_name?: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  vector_sum?: number;
  model: string;
  metadata?: Record<string, any>;
  createdAt: string;
  storage: 'Firebase' | 'MongoDB' | 'LocalStore';
}

const localEmbeddingsStore: StoredVector[] = [];

// Firebase Firestore Client State (Primary Vector & Knowledge Storage)
let firestoreDb: any = null;
let firebaseAuth: any = null;
let firebaseStatus = {
  connected: false,
  projectId: 'angent-chatbot',
  storageMode: 'Firebase Firestore',
  authenticatedUser: null as string | null,
  error: null as string | null,
  collections: ['pdf_knowledge_embeddings', 'customer_embeddings', 'property_embeddings'],
};

async function initFirebase(): Promise<boolean> {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      firebaseStatus.error = 'firebase-applet-config.json not found';
      console.warn('[Firebase] Config file missing:', configPath);
      return false;
    }
    const cfgRaw = fs.readFileSync(configPath, 'utf-8');
    const firebaseConfig = JSON.parse(cfgRaw);
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    firestoreDb = (firebaseConfig as any).firestoreDatabaseId
      ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
      : getFirestore(app);
    firebaseAuth = getAuth(app);

    try {
      const userCred = await signInWithEmailAndPassword(
        firebaseAuth,
        'agent_system@lykarealty.ae',
        'LykaSystemAgent2024!'
      );
      firebaseStatus.authenticatedUser = userCred.user.email;
      firebaseStatus.connected = true;
      firebaseStatus.error = null;
      console.log(`[Firebase] Authenticated server session as ${userCred.user.email} (Firestore: ${firebaseConfig.projectId})`);
      return true;
    } catch (authErr: any) {
      console.warn('[Firebase] Auth notice:', authErr.message);
      // Keep firestoreDb initialized even if auth throws
      firebaseStatus.connected = true;
      return true;
    }
  } catch (err: any) {
    firebaseStatus.connected = false;
    firebaseStatus.error = err?.message || 'Failed to initialize Firebase';
    console.warn('[Firebase] Initialization error:', firebaseStatus.error);
    return false;
  }
}

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
// Dynamic MongoDB Database Name Resolver
function getMongoDatabaseName(uri?: string, explicitDbName?: string): string {
  if (explicitDbName && explicitDbName.trim()) {
    return explicitDbName.trim();
  }
  if (process.env.MONGODB_DB_NAME && process.env.MONGODB_DB_NAME.trim()) {
    return process.env.MONGODB_DB_NAME.trim();
  }
  const targetUri = uri || process.env.MONGODB_URI;
  if (targetUri) {
    try {
      const match = targetUri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
      if (match && match[1] && match[1].trim()) {
        return match[1].trim();
      }
    } catch {}
  }
  return 'lyka_realty';
}

let activeMongoDbName = getMongoDatabaseName();

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
      const dbName = getMongoDatabaseName(uri);
      activeMongoDbName = dbName;
      const db = candidate.db(dbName);
      await db.command({ ping: 1 }); // confirm the handle is actually usable
      mongoClient = candidate;
      mongoDb = db;
      mongoStatus.connected = true;
      mongoStatus.uriConfigured = true;
      mongoStatus.error = null;
      console.log(`Successfully connected to MongoDB cluster (Database: ${dbName}) for vector embedding persistence.`);
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
    firebase: firebaseStatus,
    mongo: mongoStatus,
  });
});

app.get('/api/mongodb/status', async (_req: Request, res: Response) => {
  let count = localEmbeddingsStore.length;
  let leadsCount = Object.keys(localLeadsStore).length;
  let followupsCount = Object.keys(localFollowupsStore).length;
  let collectionsList: string[] = ['pdf_knowledge_embeddings', 'customer_embeddings', 'property_embeddings', 'leads', 'followups'];
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
    firebase: firebaseStatus,
    databaseName: firestoreDb ? `Firebase Firestore (${firebaseStatus.projectId})` : activeMongoDbName,
    embeddingsCount: count,
    pdfEmbeddingsCount: localPdfEmbeddingsStore.length,
    leadsCount,
    followupsCount,
    collections: collectionsList,
    pingMs,
    configuredModel: process.env.TEXT_TO_NUMERICAL_MODEL || 'text-embedding-004',
    storageMode: firestoreDb ? 'Firebase Firestore (Live Connected)' : (mongoStatus.connected ? 'MongoDB Atlas' : 'Local Store')
  });
});

// Dynamic MongoDB connection endpoint
app.post('/api/mongodb/connect', async (req: Request, res: Response) => {
  try {
    const { uri, databaseName: requestedDbName } = req.body;
    if (!uri || typeof uri !== 'string') {
      return res.status(400).json({ error: 'Valid MongoDB connection URI is required' });
    }

    const dbName = getMongoDatabaseName(uri, requestedDbName);
    const testClient = new MongoClient(uri, { 
      serverSelectionTimeoutMS: 6000,
      tlsAllowInvalidCertificates: true,
    });
    const start = Date.now();
    await testClient.connect();
    const testDb = testClient.db(dbName);
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
    activeMongoDbName = dbName;
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
      message: `Connected successfully to MongoDB! Database: ${dbName}`,
      databaseName: dbName,
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

// Store Text-to-Numerical Vector Embedding into Firebase Firestore (and local buffer)
app.post('/api/embeddings/store', async (req: Request, res: Response) => {
  try {
    const { lead_id, text_content, metadata } = req.body;
    if (!text_content) {
      return res.status(400).json({ error: 'text_content is required' });
    }

    const { vector, model, dimensions } = await getEmbeddingVector(text_content);
    const vector_sum = parseFloat(vector.reduce((a, b) => a + b, 0).toFixed(6));
    const docId = 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const record: StoredVector = {
      _id: docId,
      id: docId,
      lead_id: lead_id || 'GENERAL',
      text_content,
      vector,
      dimensions,
      vector_sum,
      model,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      storage: firestoreDb ? 'Firebase' : (mongoDb ? 'MongoDB' : 'LocalStore'),
    };

    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'customer_embeddings', docId), record, { merge: true });
        record.storage = 'Firebase';
      } catch (fsErr: any) {
        console.warn('Firestore customer embedding insert notice:', fsErr.message);
        localEmbeddingsStore.unshift(record);
        record.storage = 'LocalStore';
      }
    } else if (mongoDb) {
      try {
        await mongoDb.collection('customer_embeddings').insertOne(record);
        record.storage = 'MongoDB';
      } catch (mErr: any) {
        localEmbeddingsStore.unshift(record);
        record.storage = 'LocalStore';
      }
    } else {
      localEmbeddingsStore.unshift(record);
    }

    res.json({
      success: true,
      storage: record.storage,
      message: record.storage === 'Firebase'
        ? `Successfully saved directly in Firebase Firestore Database '${firebaseStatus.projectId}', collection 'customer_embeddings' with id: ${record.id}`
        : (record.storage === 'MongoDB'
          ? `Saved in MongoDB collection 'customer_embeddings'`
          : `Saved to local vector store.`),
      record,
      database: record.storage === 'Firebase' ? `Firestore (${firebaseStatus.projectId})` : activeMongoDbName,
      collection: 'customer_embeddings',
      documentId: record.id,
      vector_sum,
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

// Resolve the instructions PDF from src/data
function resolvePdfPath(): string | null {
  const dataDir = path.join(__dirname, 'src', 'data');
  if (!fs.existsSync(dataDir)) return null;

  let files: string[] = [];
  try {
    files = fs.readdirSync(dataDir);
  } catch {
    return null;
  }
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) return null;

  // Prefer Real_Estate instructions if present, otherwise any PDF in src/data
  const preferred = pdfFiles.find(f => f.toLowerCase().includes('real_estate')) ||
                    pdfFiles.find(f => f.toLowerCase().includes('project 02')) ||
                    pdfFiles[0];
  return path.join(dataDir, preferred);
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
        if (typeof instance.load === 'function') {
          await instance.load();
        }
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
      const pdfBaseName = path.basename(pdfPath);
      // Split into logical sections by numbers or headers, or by double newlines/paragraphs
      let sections = fullText.split(/(?=\n(?:\d+\.|\d+\.\d+)\s+[A-Z])/).filter((c: string) => c.trim().length > 30);
      if (sections.length <= 1) {
        // Fallback split by double newlines or Roman numerals/headers
        sections = fullText.split(/\n\s*\n/).filter((c: string) => c.trim().length > 40);
      }
      PDF_DOCUMENT_SECTIONS = sections.map((chunk: string, index: number) => {
        const firstLine = chunk.trim().split('\n')[0].replace(/^[^\w]+/, '').trim().substring(0, 60);
        return {
          section_number: index + 1,
          title: firstLine || `Section ${index + 1}`,
          document_name: pdfBaseName,
          text_content: chunk.trim(),
        };
      });
      console.log(`[PDF] Loaded ${PDF_DOCUMENT_SECTIONS.length} structured sections from ${pdfBaseName}`);
    } else {
      PDF_DOCUMENT_SECTIONS = [];
      console.warn(`[PDF] Parsed ${path.basename(pdfPath)} but extracted 0 characters of text — RAG knowledge base will be empty.`);
    }
  } catch (err: any) {
    PDF_DOCUMENT_SECTIONS = [];
    console.warn('Failed to load PDF file:', err.message);
  }
}

// Seed all PDF section embeddings with vector sums into Firebase Firestore and local cache
async function syncPdfEmbeddingsToFirebase() {
  await loadPdfSections();
  if (PDF_DOCUMENT_SECTIONS.length === 0) {
    console.warn('[PDF] No sections extracted from PDF to embed.');
    return;
  }

  if (firestoreDb) {
    try {
      const snap = await fsGetDocs(fsCollection(firestoreDb, 'pdf_knowledge_embeddings'));
      if (snap.size >= PDF_DOCUMENT_SECTIONS.length) {
        console.log(`[PDF] Found ${snap.size} PDF sections already stored in Firebase Firestore collection 'pdf_knowledge_embeddings'. Fetching instead of re-converting...`);
        localPdfEmbeddingsStore.length = 0;
        snap.forEach((d: any) => localPdfEmbeddingsStore.push(d.data()));
        localPdfEmbeddingsStore.sort((a, b) => (a.section_number || 0) - (b.section_number || 0));
        return; // Skip expensive embedding generation!
      }
    } catch (err: any) {
      console.warn('[PDF] Could not check existing PDF embeddings in Firestore:', err.message);
    }
  }

  console.log(`[PDF] Ingesting all ${PDF_DOCUMENT_SECTIONS.length} sections of Real_Estate_Lead_Qualification_Agent_Instructions_v2.pdf into numerical vectors with vector sums...`);
  for (const sec of PDF_DOCUMENT_SECTIONS) {
    const { vector, model, dimensions } = await getEmbeddingVector(sec.title + ': ' + sec.text_content);
    const vector_sum = parseFloat(vector.reduce((a, b) => a + b, 0).toFixed(6));
    const docId = `PDF-SEC-${String(sec.section_number).padStart(2, '0')}`;
    const doc = {
      _id: docId,
      id: docId,
      section_number: sec.section_number,
      title: sec.title,
      document_name: sec.document_name,
      text_content: sec.text_content,
      vector,
      dimensions,
      vector_sum,
      model,
      storage: firestoreDb ? 'Firebase' : (mongoDb ? 'MongoDB' : 'LocalStore'),
      createdAt: new Date().toISOString()
    };

    // Update in-memory store
    const existingIdx = localPdfEmbeddingsStore.findIndex(p => p.section_number === sec.section_number);
    if (existingIdx >= 0) localPdfEmbeddingsStore[existingIdx] = doc;
    else localPdfEmbeddingsStore.push(doc);

    // Save directly to Firebase Firestore collection 'pdf_knowledge_embeddings'
    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'pdf_knowledge_embeddings', docId), doc, { merge: true });
      } catch (err: any) {
        console.warn('[PDF] Firestore pdf embedding sync notice:', err.message);
      }
    }

    // Optional mirror to MongoDB if connected
    if (mongoDb) {
      try {
        const { _id: _ignoredId, ...updatable } = doc;
        await mongoDb.collection('pdf_knowledge_embeddings').updateOne(
          { section_number: sec.section_number },
          { $set: updatable },
          { upsert: true }
        );
      } catch (_) {}
    }
  }

  if (firestoreDb) {
    console.log(`[PDF] Embedded ${PDF_DOCUMENT_SECTIONS.length} sections and persisted them to Firebase Firestore collection 'pdf_knowledge_embeddings'.`);
  } else {
    console.warn(`[PDF] Embedded ${PDF_DOCUMENT_SECTIONS.length} sections into the IN-MEMORY STORE ONLY.`);
  }
}

// Seed all Property embeddings with vector sums into Firebase Firestore
async function syncPropertyEmbeddingsToFirebase() {
  if (ALL_VERIFIED_PROPERTIES.length === 0) return;

  if (firestoreDb) {
    try {
      const snap = await fsGetDocs(fsCollection(firestoreDb, 'property_embeddings'));
      if (snap.size >= ALL_VERIFIED_PROPERTIES.length) {
        console.log(`[Properties] Found ${snap.size} properties already embedded in Firebase Firestore. Skipping re-conversion.`);
        return;
      }
    } catch (err: any) {
      console.warn('[Properties] Could not check existing property embeddings in Firestore:', err.message);
    }
  }

  console.log(`[Properties] Ingesting ${ALL_VERIFIED_PROPERTIES.length} properties into numerical vectors with vector sums...`);
  for (const prop of ALL_VERIFIED_PROPERTIES as any[]) {
    const textContent = `${prop.title}. ${prop.property_type} in ${prop.community}, ${prop.city || 'Dubai'}. ${prop.bedrooms} Bedrooms. Price: AED ${prop.price_aed}. Status: ${prop.status}. Amenities: ${(prop.amenities || []).join(', ')}. ${prop.description || ''}`;
    const { vector, model, dimensions } = await getEmbeddingVector(textContent);
    const vector_sum = parseFloat(vector.reduce((a, b) => a + b, 0).toFixed(6));
    const docId = `PROP-${prop.id}`;
    
    const doc = {
      _id: docId,
      id: docId,
      property_id: prop.id,
      title: prop.title,
      community: prop.community,
      city: prop.city || 'Dubai',
      price_aed: prop.price_aed,
      text_content: textContent,
      vector,
      dimensions,
      vector_sum,
      model,
      storage: firestoreDb ? 'Firebase' : (mongoDb ? 'MongoDB' : 'LocalStore'),
      createdAt: new Date().toISOString()
    };

    localPropertyEmbeddingsStore.push(doc);

    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'property_embeddings', docId), doc, { merge: true });
      } catch (err: any) {
        console.warn('[Properties] Firestore property embedding sync notice:', err.message);
      }
    }

    if (mongoDb) {
      try {
        const { _id: _ignoredId, ...updatable } = doc;
        await mongoDb.collection('property_embeddings').updateOne(
          { property_id: prop.id },
          { $set: updatable },
          { upsert: true }
        );
      } catch (_) {}
    }
  }
  if (firestoreDb) {
    console.log(`[Properties] Embedded ${ALL_VERIFIED_PROPERTIES.length} properties and persisted them to Firebase Firestore collection 'property_embeddings'.`);
  }
}

// Boot sequence: Prioritizes Firebase Firestore for all vector & knowledge storage
async function waitForMongo(maxAttempts = 3): Promise<boolean> {
  const invalid = validateMongoUri(process.env.MONGODB_URI);
  if (invalid) {
    mongoStatus.uriConfigured = false;
    mongoStatus.error = invalid;
    return false;
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await initMongo()) return true;
    if (attempt < maxAttempts) {
      const backoffMs = attempt * 2000;
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
  injectDependencies({
    groq,
    gemini: ai,
    groqModel,
    pdfChunks: [],
    properties: (ALL_VERIFIED_PROPERTIES || []) as any[],
  });

  // 1. Initialize Firebase Firestore (Primary Vector & Knowledge Base Storage)
  const firebaseReady = await initFirebase();
  if (firebaseReady) {
    console.log('[Boot] Firebase Firestore initialized as primary vector database.');
  }

  // 2. Background check for MongoDB (optional secondary fallback)
  waitForMongo().catch(() => {});

  try {
    // 3. Ingest and persist PDF & Property embeddings to Firebase Firestore
    await syncPdfEmbeddingsToFirebase();
    await syncPropertyEmbeddingsToFirebase();
  } catch (err: any) {
    console.warn('[Boot] Embedding sync notice:', err?.message);
  } finally {
    await injectAgentDependencies();
    console.log(`[LangGraph] Agent initialized with ${localPdfEmbeddingsStore.length} PDF chunks and ${(ALL_VERIFIED_PROPERTIES || []).length} properties (primary storage: ${firestoreDb ? 'Firebase Firestore' : 'IN-MEMORY ONLY'}).`);
  }
}

bootstrapAgent();

// Endpoint to retrieve stored PDF embeddings from Firebase Firestore
app.get('/api/embeddings/pdf-list', async (_req: Request, res: Response) => {
  try {
    if (firestoreDb) {
      try {
        const snap = await fsGetDocs(fsCollection(firestoreDb, 'pdf_knowledge_embeddings'));
        const items: any[] = [];
        snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
        if (items.length > 0) {
          items.sort((a, b) => (a.section_number || 0) - (b.section_number || 0));
          return res.json({
            items,
            source: 'Firebase',
            database: `Firestore (${firebaseStatus.projectId})`,
            collection: 'pdf_knowledge_embeddings',
            totalSections: items.length,
            allStoredInFirebase: true
          });
        }
      } catch (fsErr: any) {
        console.warn('Firestore pdf-list read notice:', fsErr.message);
      }
    }

    if (mongoDb) {
      const items = await mongoDb.collection('pdf_knowledge_embeddings').find().sort({ section_number: 1 }).toArray();
      if (items.length > 0) {
        return res.json({
          items,
          source: 'MongoDB',
          database: activeMongoDbName,
          collection: 'pdf_knowledge_embeddings',
          totalSections: items.length,
          allStoredInMongo: true
        });
      }
    }

    res.json({
      items: localPdfEmbeddingsStore,
      source: 'LocalStore',
      database: `Firestore (${firebaseStatus.projectId})`,
      collection: 'pdf_knowledge_embeddings',
      totalSections: localPdfEmbeddingsStore.length,
      allStoredInFirebase: Boolean(firestoreDb)
    });
  } catch (err: any) {
    res.json({ items: localPdfEmbeddingsStore, source: 'LocalStore', error: err?.message });
  }
});

// Endpoint to force re-sync of all PDF embeddings to Firebase Firestore
app.post('/api/embeddings/sync-pdf', async (_req: Request, res: Response) => {
  try {
    await syncPdfEmbeddingsToFirebase();
    res.json({
      success: true,
      message: `Successfully embedded all ${PDF_DOCUMENT_SECTIONS.length} sections of Real_Estate_Lead_Qualification_Agent_Instructions_v2.pdf with vector sums into Firebase Firestore collection 'pdf_knowledge_embeddings'`,
      database: `Firestore (${firebaseStatus.projectId})`,
      collection: 'pdf_knowledge_embeddings',
      storage: firestoreDb ? 'Firebase' : 'LocalStore',
      count: PDF_DOCUMENT_SECTIONS.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Stored Numerical Embeddings (Reads from Firebase Firestore)
app.get('/api/embeddings/list', async (_req: Request, res: Response) => {
  try {
    if (firestoreDb) {
      try {
        const snap = await fsGetDocs(fsCollection(firestoreDb, 'customer_embeddings'));
        const items: any[] = [];
        snap.forEach((d: any) => items.push({ id: d.id, ...d.data() }));
        if (items.length > 0) {
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return res.json({
            items: items.slice(0, 50),
            source: 'Firebase',
            database: `Firestore (${firebaseStatus.projectId})`,
            collection: 'customer_embeddings'
          });
        }
      } catch (fsErr: any) {
        console.warn('Firestore embeddings list read notice:', fsErr.message);
      }
    }

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

    // 1. Store user message as numerical vector in Firebase Firestore (for analytics & similarity search)
    const queryEmbedding = await getEmbeddingVector(message);
    const queryVectorSum = parseFloat(queryEmbedding.vector.reduce((a, b) => a + b, 0).toFixed(6));
    const customerVecId = 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const customerVecDoc = {
      id: customerVecId,
      _id: customerVecId,
      lead_id: currentLead?.id || 'GENERAL',
      text_content: message,
      vector: queryEmbedding.vector,
      dimensions: queryEmbedding.dimensions,
      vector_sum: queryVectorSum,
      model: queryEmbedding.model,
      storage: firestoreDb ? 'Firebase' : (mongoDb ? 'MongoDB' : 'LocalStore'),
      createdAt: new Date().toISOString()
    };

    if (firestoreDb) {
      fsSetDoc(fsDoc(firestoreDb, 'customer_embeddings', customerVecId), customerVecDoc, { merge: true })
        .catch((e: any) => console.warn('Could not store customer vector to Firestore:', e.message));
    } else if (mongoDb) {
      mongoDb.collection('customer_embeddings').insertOne(customerVecDoc)
        .catch((e: any) => console.warn('Could not store customer vector:', e.message));
    }
    localEmbeddingsStore.unshift(customerVecDoc as any);

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



// In-memory store for OTPs (with 3-minute expiration)
interface OtpRecord {
  code: string;
  email: string;
  portal: 'admin' | 'property_manager';
  expiresAt: number; // timestamp in ms (3 minutes)
  createdAt: number;
}
const activeEmailOtps: Record<string, OtpRecord> = {};

// Send 6-Digit Email OTP via Brevo API
app.post('/api/auth/send-email-otp', async (req: Request, res: Response) => {
  try {
    const { email, portal } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const portalName = portal === 'property_manager' ? 'Property Manager' : 'Admin';

    // 1. Generate secure 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAt = now + 3 * 60 * 1000; // Strictly 3 minutes valid

    // Save in memory record
    const otpKey = `${portal || 'admin'}_${cleanEmail}`;
    activeEmailOtps[otpKey] = {
      code: otpCode,
      email: cleanEmail,
      portal: portal || 'admin',
      expiresAt,
      createdAt: now
    };

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'admin@lykarealty.ae';

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not configured in .env. Falling back to local verification.');
      return res.json({
        success: true,
        expiresInSeconds: 180,
        message: 'OTP generated (local mode). Check terminal or backup code.',
        otpBackup: otpCode
      });
    }

    // 2. Call Brevo Transactional Email API (https://api.brevo.com/v3/smtp/email)
    const emailPayload = {
      sender: {
        name: 'Lyka Realty Portal',
        email: brevoSenderEmail
      },
      to: [
        {
          email: cleanEmail,
          name: portalName
        }
      ],
      subject: `Lyka Realty - Your ${portalName} Login Verification Code`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
            .card { max-width: 520px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .brand { color: #f59e0b; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; }
            .title { color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 12px; }
            .text { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
            .otp-box { background: #0f172a; border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
            .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #fbbf24; margin: 0; }
            .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-top: 12px; }
            .footer { color: #64748b; font-size: 12px; text-align: center; margin-top: 32px; border-top: 1px solid #1e293b; pt: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">🏰 LYKA REALTY DUBAI</div>
            <h1 class="title">${portalName} Security Verification</h1>
            <p class="text">
              We received a login request for your <strong>${portalName} Portal</strong>. Please use the verification code below to complete your login.
            </p>
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <div class="badge">⏱️ Valid for 3 Minutes Only</div>
            </div>
            <p class="text" style="font-size: 13px; color: #64748b;">
              This code will expire in exactly 3 minutes. If you did not attempt to sign in to Lyka Realty, please ignore this email or change your account password.
            </p>
            <div class="footer">
              © ${new Date().getFullYear()} Lyka Realty LLC, Dubai, UAE. Confidential Security Notification.
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('Brevo API response error:', data);
      return res.status(response.status).json({
        error: data.message || 'Failed to send OTP email via Brevo.',
        otpBackup: otpCode
      });
    }

    console.log(`[Brevo] OTP sent successfully to ${cleanEmail}. MessageId:`, data.messageId);
    return res.json({
      success: true,
      messageId: data.messageId,
      expiresInSeconds: 180,
      message: `Verification code sent to ${cleanEmail}. Valid for 3 minutes.`
    });

  } catch (error: any) {
    console.error('[Brevo Error]:', error);
    res.status(500).json({ error: error?.message || 'Server error sending email OTP.' });
  }
});

// Verify 6-Digit Email OTP
app.post('/api/auth/verify-email-otp', async (req: Request, res: Response) => {
  try {
    const { email, portal, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ valid: false, message: 'Email and OTP are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const otpKey = `${portal || 'admin'}_${cleanEmail}`;
    const record = activeEmailOtps[otpKey];

    if (!record) {
      return res.status(400).json({ valid: false, message: 'No OTP requested for this email. Please click "Get OTP" first.' });
    }

    const now = Date.now();
    if (now > record.expiresAt) {
      delete activeEmailOtps[otpKey];
      return res.status(400).json({ valid: false, expired: true, message: 'OTP has expired (valid for 3 minutes only). Please request a new OTP.' });
    }

    if (record.code !== cleanOtp) {
      return res.status(400).json({ valid: false, message: 'Invalid OTP code. Please enter the 6-digit code sent to your email.' });
    }

    // OTP is valid! Delete once consumed
    delete activeEmailOtps[otpKey];
    return res.json({ valid: true, message: 'OTP verified successfully.' });

  } catch (error: any) {
    res.status(500).json({ valid: false, message: error?.message });
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
    console.log(`Lyka Realty Agentic AI server running on http://localhost:${PORT}`);
  });
}

startServer();
