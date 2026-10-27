import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
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
  where as fsWhere,
  deleteDoc as fsDeleteDoc,
  arrayUnion as fsArrayUnion,
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
const PORT = Number(process.env.PORT) || 3000;

// ── Security Hardening: Disable information-leak headers ──
app.disable('x-powered-by');

// ── Security Hardening: Trust Reverse Proxies (Cloudflare, Render) ──
app.enable('trust proxy');

// ── Security Hardening: Enforce HTTPS Redirect in Production ──
app.use((req: Request, res: Response, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ── Security Hardening: Strict request body size limit (prevent DoS) ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Security Hardening: Prototype Pollution Mitigation ──
app.use((req: Request, _res: Response, next) => {
  if (req.body && typeof req.body === 'object') {
    delete (req.body as any)['__proto__'];
    delete (req.body as any)['constructor'];
    delete (req.body as any)['prototype'];
  }
  next();
});

// ── Security Hardening: Comprehensive HTTP Headers & CSP ──
app.use((_req: Request, res: Response, next) => {
  // HTTP Strict Transport Security (HSTS) - 1 year, all subdomains, preloaded
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' https: data: blob:; " +
    "connect-src 'self' https: wss: http://localhost:* ws://localhost:*;"
  );
  next();
});

// ── Security Hardening: General API rate limiting (prevents DDoS/Scraping) ──
const apiRateLimits: Record<string, { count: number; resetTime: number }> = {};
const API_WINDOW_MS = 60 * 1000;
const MAX_API_CALLS_PER_MIN = 300;

app.use('/api', (req: Request, res: Response, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = apiRateLimits[clientIp];
  if (!record || now > record.resetTime) {
    apiRateLimits[clientIp] = { count: 1, resetTime: now + API_WINDOW_MS };
    return next();
  }
  record.count++;
  if (record.count > MAX_API_CALLS_PER_MIN) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
  }
  next();
});



// Serve public static assets (including /favicon.ico and logos)
app.use(express.static(path.join(__dirname, 'public')));

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
  storage: 'Firebase' | 'LocalStore';
}

const localEmbeddingsStore: StoredVector[] = [];

// In-memory Customer Favorites Cache (Synced with Firestore 'favorites' collection)
const localFavoritesStore: Record<string, any> = {};


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
    const configCandidates = [
      path.join(__dirname, 'firebase-applet-config.json'),
      path.join(process.cwd(), 'firebase-applet-config.json')
    ];
    const configPath = configCandidates.find(p => fs.existsSync(p));
    if (!configPath) {
      firebaseStatus.error = 'firebase-applet-config.json not found';
      console.warn('[Firebase] Config file missing:', configCandidates[0]);
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

// ── Persistent Disk Store & Safe Firestore Helpers for Portal Credentials ─────
const ROOT_CREDENTIALS_FILE = path.resolve(process.cwd(), 'portal-credentials.json');
const DIST_CREDENTIALS_FILE = path.resolve(process.cwd(), 'dist', 'portal-credentials.json');
const CREDENTIALS_FILE = fs.existsSync(ROOT_CREDENTIALS_FILE) ? ROOT_CREDENTIALS_FILE : DIST_CREDENTIALS_FILE;

interface StoredPortalCredentials {
  admin: {
    id: string;
    email: string;
    password: string;
    role: string;
    name: string;
    updatedAt: string;
  };
  property_manager: {
    id: string;
    email: string;
    password: string;
    role: string;
    name: string;
    updatedAt: string;
  };
  sales_manager: {
    id: string;
    email: string;
    password: string;
    role: string;
    name: string;
    updatedAt: string;
  };
}

const DEFAULT_SERVER_CREDENTIALS: StoredPortalCredentials = {
  admin: {
    id: 'admin',
    email: 'raviku6678@gmail.com',
    password: 'LykaAdmin2024',
    role: 'admin',
    name: 'Lyka Super Admin',
    updatedAt: new Date().toISOString()
  },
  property_manager: {
    id: 'property_manager',
    email: 'ravikumar755667@gmail.com',
    password: 'LykaManager2024',
    role: 'property_manager',
    name: 'Lyka Property Manager',
    updatedAt: new Date().toISOString()
  },
  sales_manager: {
    id: 'sales_manager',
    email: 'raviku6678@gmail.com',
    password: 'LykaSales2024',
    role: 'sales_manager',
    name: 'Lyka Sales Manager',
    updatedAt: new Date().toISOString()
  }
};

function loadStoredPortalCredentials(): StoredPortalCredentials {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        admin: { ...DEFAULT_SERVER_CREDENTIALS.admin, ...(parsed.admin || {}) },
        property_manager: { ...DEFAULT_SERVER_CREDENTIALS.property_manager, ...(parsed.property_manager || {}) },
        sales_manager: { ...DEFAULT_SERVER_CREDENTIALS.sales_manager, ...(parsed.sales_manager || {}) }
      };
    }
  } catch (err: any) {
    console.warn('[Credentials] Failed reading credentials file:', err.message);
  }
  return { ...DEFAULT_SERVER_CREDENTIALS };
}

function saveStoredPortalCredentials(creds: StoredPortalCredentials): void {
  try {
    const serialized = JSON.stringify(creds, null, 2);
    try { fs.writeFileSync(ROOT_CREDENTIALS_FILE, serialized, 'utf-8'); } catch (_) {}
    try {
      const distDir = path.dirname(DIST_CREDENTIALS_FILE);
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(DIST_CREDENTIALS_FILE, serialized, 'utf-8');
      }
    } catch (_) {}
  } catch (err: any) {
    console.warn('[Credentials] Failed writing credentials file:', err.message);
  }
}

// Ensure credentials file is initialized on disk
try {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    saveStoredPortalCredentials(DEFAULT_SERVER_CREDENTIALS);
  }
} catch (_) {}

// ── Authorized Portal Staff Management (Property Admin & Sales Manager) ───────
export interface ServerPortalStaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  idCard: string;
  role: 'property_manager' | 'sales_manager';
  password?: string;
  status: 'active' | 'suspended';
  addedAt: string;
  addedBy?: string;
}

const ROOT_STAFF_FILE = path.join(__dirname, 'portal_staff.json');
const DIST_STAFF_FILE = path.join(__dirname, 'dist', 'portal_staff.json');
const STAFF_FILE = fs.existsSync(ROOT_STAFF_FILE) ? ROOT_STAFF_FILE : (fs.existsSync(DIST_STAFF_FILE) ? DIST_STAFF_FILE : ROOT_STAFF_FILE);

function loadPortalStaff(): ServerPortalStaffMember[] {
  try {
    if (fs.existsSync(STAFF_FILE)) {
      const raw = fs.readFileSync(STAFF_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err: any) {
    console.warn('[Staff Management] Failed reading staff file:', err.message);
  }
  return [];
}

function savePortalStaff(staffList: ServerPortalStaffMember[]): void {
  try {
    const serialized = JSON.stringify(staffList, null, 2);
    try { fs.writeFileSync(ROOT_STAFF_FILE, serialized, 'utf-8'); } catch (_) {}
    try {
      const distDir = path.dirname(DIST_STAFF_FILE);
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(DIST_STAFF_FILE, serialized, 'utf-8');
      }
    } catch (_) {}
  } catch (err: any) {
    console.warn('[Staff Management] Failed writing staff file:', err.message);
  }
}

/**
 * Searches credentials across added staff and default portal credentials for login & OTP verification
 */
async function findCredentialForPortalLogin(
  portalKey: 'admin' | 'property_manager' | 'sales_manager',
  cleanEmail: string
): Promise<{
  matched: boolean;
  credential?: {
    id: string;
    email: string;
    password?: string;
    role: 'admin' | 'property_manager' | 'sales_manager';
    name?: string;
    phone?: string;
    idCard?: string;
  };
}> {
  // 1. Check added staff list (Property Managers & Sales Managers added by Admin with ID card and mobile no)
  const staffList = loadPortalStaff();
  const staff = staffList.find(s => 
    s.role === portalKey && 
    s.email.toLowerCase() === cleanEmail && 
    s.status !== 'suspended'
  );
  if (staff && staff.password) {
    return {
      matched: true,
      credential: {
        id: staff.id,
        email: staff.email,
        password: staff.password,
        role: staff.role,
        name: staff.name,
        phone: staff.phone,
        idCard: staff.idCard
      }
    };
  }

  // 2. Check Firestore for added staff in dedicated collection (Property_login or Sales_login)
  if (firestoreDb && portalKey !== 'admin') {
    try {
      const colName = portalKey === 'sales_manager' ? 'Sales_login' : 'Property_login';
      const docRef = fsDoc(firestoreDb, colName, cleanEmail);
      const snap = await safeFirestoreGetDoc(docRef, 3000);
      if (snap && snap.exists()) {
        const d = snap.data();
        if (d && d.password) {
          return {
            matched: true,
            credential: {
              id: snap.id,
              email: d.email || d.Email_id || cleanEmail,
              password: d.password,
              role: portalKey,
              name: d.name || d.Name || (portalKey === 'sales_manager' ? 'Sales Manager' : 'Property Manager'),
              phone: d.phone || d.Phone_number || '',
              idCard: d.id_card || d.idCard || d.idCardNumber || ''
            }
          };
        }
      }
    } catch (fsErr: any) {
      console.warn('[Credential Lookup] Firestore staff check notice:', fsErr.message);
    }
  }

  // 3. Fallback to default disk & firestore admin credentials
  const diskCreds = loadStoredPortalCredentials();
  let targetCred: any = diskCreds[portalKey];

  if (firestoreDb) {
    try {
      const colName = portalKey === 'sales_manager' ? 'Sales_login' : portalKey === 'property_manager' ? 'Property_login' : 'Admin_login';
      const docRef = fsDoc(firestoreDb, colName, portalKey);
      const snap = await safeFirestoreGetDoc(docRef, 3000);
      if (snap && snap.exists()) {
        const d = snap.data();
        if (d.password) {
          targetCred = {
            ...targetCred,
            ...d,
            email: d.email || d.Email_id || targetCred.email,
            password: d.password
          };
        }
      }
    } catch (_) {}
  }

  const expectedEmail = String(targetCred?.email || '').trim().toLowerCase();
  if (cleanEmail === expectedEmail) {
    return {
      matched: true,
      credential: {
        id: targetCred.id || portalKey,
        email: expectedEmail,
        password: targetCred.password,
        role: portalKey,
        name: targetCred.name,
        phone: targetCred.phone,
        idCard: targetCred.idCard
      }
    };
  }

  return { matched: false };
}


/**
 * Safe non-blocking Firestore write that times out after timeoutMs (default 3500ms).
 * Prevents gRPC ETIMEDOUT stream locks from hanging API requests.
 */
async function safeFirestoreSetDoc(docRef: any, data: any, options: any = { merge: true }, timeoutMs = 3500): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const writePromise = fsSetDoc(docRef, data, options);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timeout')), timeoutMs)
    );
    await Promise.race([writePromise, timeoutPromise]);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore Safe Write] Non-blocking notice for ${docRef?.path || 'doc'}:`, err.message);
    return false;
  }
}

/**
 * Safe non-blocking Firestore read with a timeout.
 */
async function safeFirestoreGetDoc(docRef: any, timeoutMs = 3000): Promise<any> {
  if (!firestoreDb) return null;
  try {
    const getPromise = fsGetDoc(docRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore read timeout')), timeoutMs)
    );
    return await Promise.race([getPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[Firestore Safe Read] Non-blocking notice for ${docRef?.path || 'doc'}:`, err.message);
    return null;
  }
}

// Vector status state for Firebase Firestore (Primary Vector Database)
let vectorStoreStatus = {
  storageMode: 'Firebase Firestore',
  projectId: 'angent-chatbot',
  collections: ['pdf_knowledge_embeddings', 'customer_embeddings', 'property_embeddings'],
};

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
  });
});

app.get(['/api/embeddings/status', '/api/mongodb/status'], async (_req: Request, res: Response) => {
  let count = localEmbeddingsStore.length;
  let leadsCount = Object.keys(localLeadsStore).length;
  let followupsCount = Object.keys(localFollowupsStore).length;
  let collectionsList: string[] = ['pdf_knowledge_embeddings', 'customer_embeddings', 'property_embeddings'];

  if (firestoreDb) {
    try {
      const customerSnap = await fsGetDocs(fsCollection(firestoreDb, 'customer_embeddings'));
      count = customerSnap.size;
    } catch (_) {}
  }

  res.json({
    connected: Boolean(firestoreDb),
    firebase: firebaseStatus,
    databaseName: `Firebase Firestore (${firebaseStatus.projectId})`,
    embeddingsCount: count,
    pdfEmbeddingsCount: localPdfEmbeddingsStore.length,
    leadsCount,
    followupsCount,
    collections: collectionsList,
    configuredModel: process.env.TEXT_TO_NUMERICAL_MODEL || 'text-embedding-004',
    storageMode: firestoreDb ? 'Firebase Firestore (Live Connected)' : 'Local Store'
  });
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
      storage: firestoreDb ? 'Firebase' : 'LocalStore',
    };

    const authUid = req.body.user_id || req.body.userId || metadata?.user_id || metadata?.userId;
    if (firestoreDb && authUid) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'customer_embeddings', docId), record, { merge: true });
        record.storage = 'Firebase';
      } catch (fsErr: any) {
        console.warn('Firestore customer embedding insert notice:', fsErr.message);
        localEmbeddingsStore.unshift(record);
        record.storage = 'LocalStore';
      }
    } else {
      localEmbeddingsStore.unshift(record);
      record.storage = 'LocalStore';
    }

    res.json({
      success: true,
      storage: record.storage,
      message: record.storage === 'Firebase'
        ? `Successfully saved directly in Firebase Firestore Database '${firebaseStatus.projectId}', collection 'customer_embeddings' with id: ${record.id}`
        : `Saved to local vector store.`,
      record,
      database: `Firestore (${firebaseStatus.projectId})`,
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
  const candidates = [
    path.join(__dirname, 'src', 'data'),
    path.join(process.cwd(), 'src', 'data')
  ];
  const dataDir = candidates.find(d => fs.existsSync(d));
  if (!dataDir) return null;

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
      console.warn(`[PDF] No instructions PDF found in src/data — RAG knowledge base will be empty.`);
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
      storage: firestoreDb ? 'Firebase' : 'LocalStore',
      createdAt: new Date().toISOString()
    };

    // Update in-memory store
    const existingIdx = localPdfEmbeddingsStore.findIndex(p => p.section_number === sec.section_number);
    if (existingIdx >= 0) localPdfEmbeddingsStore[existingIdx] = doc;
    else localPdfEmbeddingsStore.push(doc);

    // Save directly to Firebase Firestore collection 'pdf_knowledge_embeddings'
    if (firestoreDb) {
      await safeFirestoreSetDoc(fsDoc(firestoreDb, 'pdf_knowledge_embeddings', docId), doc, { merge: true }, 2500);
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
      storage: firestoreDb ? 'Firebase' : 'LocalStore',
      createdAt: new Date().toISOString()
    };

    localPropertyEmbeddingsStore.push(doc);

    if (firestoreDb) {
      await safeFirestoreSetDoc(fsDoc(firestoreDb, 'property_embeddings', docId), doc, { merge: true }, 2500);
    }
  }
  if (firestoreDb) {
    console.log(`[Properties] Embedded ${ALL_VERIFIED_PROPERTIES.length} properties and persisted them to Firebase Firestore collection 'property_embeddings'.`);
  }
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
    properties: ((ALL_VERIFIED_PROPERTIES || []) as any[]).filter(p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'),
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

  try {
    // 2. Ingest and persist PDF & Property embeddings to Firebase Firestore
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

    res.json({ items: localEmbeddingsStore.slice(0, 20), source: 'LocalStore' });
  } catch (err: any) {
    res.json({ items: localEmbeddingsStore.slice(0, 20), source: 'LocalStore', error: err?.message });
  }
});



// ── Administrative Sessions & Role-Based Access Control (RBAC) ──
interface AdminSession {
  portal: 'admin' | 'property_manager' | 'sales_manager';
  role: 'admin' | 'property_manager' | 'sales_manager';
  email: string;
  name?: string;
  phone?: string;
  idCard?: string;
  createdAt: number;
  expiresAt: number;
}
const activeAdminSessions: Record<string, AdminSession> = {};

// Rate limiter for portal logins (Max 5 failed attempts per 15-minute window)
const loginAttemptLimits: Record<string, { count: number; lockedUntil: number; firstAttempt: number }> = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function requireAdminAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : String(req.headers['x-admin-token'] || req.query.admin_token || '').trim();

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication token required.' });
  }

  const session = activeAdminSessions[token];
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired admin session. Please log in again.' });
  }

  if (Date.now() > session.expiresAt) {
    delete activeAdminSessions[token];
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin session expired. Please log in again.' });
  }

  (req as any).adminSession = session;
  next();
}

// In-memory fallback for leads and follow-ups
const localLeadsStore: Record<string, any> = {};
const localFollowupsStore: Record<string, any> = {};

// Save / Update Lead in local store (Firebase client handles primary CRM)
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

    if (firestoreDb && (lead.user_id || lead.userId)) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'leads', lead.id), lead, { merge: true });
      } catch (fsErr: any) {
        console.warn('[Leads API] Firestore lead sync notice:', fsErr.message);
      }
    }

    res.json({ success: true, storage: firestoreDb ? 'Firebase' : 'LocalStore', leadId: lead.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to sync lead' });
  }
});

// Retrieve Leads (Admin / Manager Protected)
app.get('/api/leads', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ leads: Object.values(localLeadsStore), storage: 'LocalStore' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Save / Update Follow-Up in local store
app.post('/api/followups/sync', async (req: Request, res: Response) => {
  try {
    const task = req.body;
    if (!task || !task.id) {
      return res.status(400).json({ error: 'Follow-up task data is required' });
    }

    localFollowupsStore[task.id] = task;

    res.json({ success: true, storage: 'LocalStore', taskId: task.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Retrieve Follow-Ups (Admin / Manager Protected)
app.get('/api/followups', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ tasks: Object.values(localFollowupsStore), storage: 'LocalStore' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// Universal CSV Download Endpoint
// Serves real HTTP attachments so Android OS DownloadManager, Mobile Chrome,
// and Desktop browsers cleanly download files directly to the user's Downloads folder.
app.post('/api/export-csv', (req: Request, res: Response) => {
  try {
    const rawFilename = String(req.body.filename || 'lyka_export.csv').trim();
    // Sanitize filename to prevent header injection or directory traversal
    const safeBase = rawFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.+/g, '.');
    const safeFilename = safeBase.toLowerCase().endsWith('.csv') ? safeBase : `${safeBase}.csv`;
    const content = String(req.body.content || '');

    // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel and Google Sheets compatibility
    const csvBuffer = Buffer.from('\uFEFF' + content, 'utf-8');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader('Content-Length', csvBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(csvBuffer);
  } catch (err: any) {
    console.error('[Export CSV] Error generating download stream:', err);
    return res.status(500).json({ error: 'Failed to stream CSV', message: err?.message });
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
      storage: firestoreDb ? 'Firebase' : 'LocalStore',
      createdAt: new Date().toISOString()
    };

    if (firestoreDb) {
      fsSetDoc(fsDoc(firestoreDb, 'customer_embeddings', customerVecId), customerVecDoc, { merge: true })
        .catch((e: any) => console.warn('Could not store customer vector to Firestore:', e.message));
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
        properties: ((ALL_VERIFIED_PROPERTIES || []) as any[]).filter(p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'),
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

    // Exclude any booked/assigned properties so chatbot NEVER recommends booked properties
    const activeMatchedProperties = (agentResult.matchedProperties || []).filter(
      (p: any) => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
    );

    return res.json({
      reply: agentResult.reply,
      provider: agentResult.provider,
      matchedProperties: activeMatchedProperties,
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

interface PasswordResetTokenRecord {
  token: string;
  email: string;
  portal: 'admin' | 'property_manager' | 'sales_manager';
  expiresAt: number;
  createdAt: number;
}
const activePasswordResetTokens: Record<string, PasswordResetTokenRecord> = {};


// Rate limiter store for OTP requests (Max 5 attempts per 1-hour rolling window)
const ONE_HOUR_MS = 60 * 60 * 1000; // 3,600,000 ms = 1 hour
const MAX_OTP_ATTEMPTS = 5;

interface OtpRateLimitRecord {
  attempts: number[]; // Timestamps of generated OTPs within the 1-hour window
  lockedUntil?: number; // Lockout timestamp if limit reached
}
const otpRateLimits: Record<string, OtpRateLimitRecord> = {};

// Check OTP Rate Limit Status for an Email
app.get('/api/auth/otp-status', (req: Request, res: Response) => {
  try {
    const email = req.query.email;
    if (!email || typeof email !== 'string') {
      return res.json({ locked: false, attemptsUsed: 0, maxAttempts: MAX_OTP_ATTEMPTS, remainingAttempts: MAX_OTP_ATTEMPTS });
    }
    const cleanEmail = email.trim().toLowerCase();
    const rateRecord = otpRateLimits[cleanEmail];
    if (!rateRecord) {
      return res.json({ locked: false, attemptsUsed: 0, maxAttempts: MAX_OTP_ATTEMPTS, remainingAttempts: MAX_OTP_ATTEMPTS });
    }
    const now = Date.now();
    if (rateRecord.lockedUntil && now < rateRecord.lockedUntil) {
      const remainingSeconds = Math.max(1, Math.ceil((rateRecord.lockedUntil - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return res.json({
        locked: true,
        attemptsUsed: MAX_OTP_ATTEMPTS,
        maxAttempts: MAX_OTP_ATTEMPTS,
        remainingAttempts: 0,
        retryAfterMinutes: remainingMinutes,
        retryAfterSeconds: remainingSeconds,
        lockedUntil: rateRecord.lockedUntil
      });
    }
    const validAttempts = (rateRecord.attempts || []).filter(ts => (now - ts) < ONE_HOUR_MS);
    return res.json({
      locked: false,
      attemptsUsed: validAttempts.length,
      maxAttempts: MAX_OTP_ATTEMPTS,
      remainingAttempts: Math.max(0, MAX_OTP_ATTEMPTS - validAttempts.length)
    });
  } catch (err: any) {
    return res.json({ locked: false, attemptsUsed: 0, maxAttempts: 5, remainingAttempts: 5 });
  }
});

// Reset OTP Rate Limit (Strictly restricted to authenticated Super Admin)
app.post('/api/auth/reset-otp-rate-limit', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      delete otpRateLimits[cleanEmail];
    } else {
      for (const k of Object.keys(otpRateLimits)) {
        delete otpRateLimits[k];
      }
    }
    return res.json({ success: true, message: 'OTP rate limit reset successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Send 6-Digit Email OTP via Brevo API (Requires Verified Password for Admin Portals)
app.post('/api/auth/send-email-otp', async (req: Request, res: Response) => {
  try {
    const { email, portal, password } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const portalKey: 'admin' | 'property_manager' | 'sales_manager' =
      portal === 'sales_manager' ? 'sales_manager' : portal === 'property_manager' ? 'property_manager' : 'admin';
    const portalName = portalKey === 'sales_manager' ? 'Sales Manager' : portalKey === 'property_manager' ? 'Property Manager' : 'Admin';

    // ── Enforce Password Verification Before Issuing OTP for Admin Portals ──
    if (portal !== 'user') {
      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          valid: false,
          passwordError: true,
          error: `Please enter your password first. OTP is only sent after password verification.`,
          message: `Password required before sending verification OTP.`
        });
      }

      const cleanPassword = String(password).trim();

      // Look up credential across staff and default portal credentials
      const lookup = await findCredentialForPortalLogin(portalKey, cleanEmail);
      if (!lookup.matched || !lookup.credential) {
        return res.status(401).json({
          success: false,
          valid: false,
          passwordError: true,
          error: `Email ${cleanEmail} is not authorized for ${portalName} portal.`,
          message: `Email ${cleanEmail} is not registered for ${portalName}. Super Admin can add this email in Staff Access.`
        });
      }

      const expectedPassword = String(lookup.credential.password || '').trim();
      const hashA = crypto.createHash('sha256').update(cleanPassword).digest();
      const hashB = crypto.createHash('sha256').update(expectedPassword).digest();
      const passwordMatches = crypto.timingSafeEqual(hashA, hashB);

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          valid: false,
          passwordError: true,
          error: `Incorrect password for ${portalName} portal.`,
          message: `Incorrect password for ${portalName} account. Please verify your password or use "Forgot Password?" below to reset it.`
        });
      }
    }

    const now = Date.now();

    // ── OTP Rate Limiter (Max 5 attempts per 1-hour window) ───────────────
    let rateRecord = otpRateLimits[cleanEmail];
    if (!rateRecord) {
      rateRecord = { attempts: [] };
      otpRateLimits[cleanEmail] = rateRecord;
    }

    // Check if account is in active lockout
    if (rateRecord.lockedUntil && now < rateRecord.lockedUntil) {
      const remainingSeconds = Math.max(1, Math.ceil((rateRecord.lockedUntil - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return res.status(429).json({
        error: `OTP generation limit reached (5 attempts). For security reasons, please wait ${remainingMinutes} minute(s) before requesting a new OTP.`,
        locked: true,
        retryAfterMinutes: remainingMinutes,
        retryAfterSeconds: remainingSeconds,
        lockedUntil: rateRecord.lockedUntil,
        attemptsUsed: MAX_OTP_ATTEMPTS,
        maxAttempts: MAX_OTP_ATTEMPTS,
        remainingAttempts: 0
      });
    }

    // Filter out attempts older than 1 hour (rolling window)
    rateRecord.attempts = rateRecord.attempts.filter(ts => (now - ts) < ONE_HOUR_MS);
    if (rateRecord.lockedUntil && now >= rateRecord.lockedUntil) {
      delete rateRecord.lockedUntil;
    }

    // If already 5 or more attempts in this 1-hour window, trigger 1-hour lockout
    if (rateRecord.attempts.length >= MAX_OTP_ATTEMPTS) {
      rateRecord.lockedUntil = now + ONE_HOUR_MS;
      return res.status(429).json({
        error: 'OTP generation limit reached (5 attempts). For security reasons, please wait 60 minutes before requesting a new OTP.',
        locked: true,
        retryAfterMinutes: 60,
        retryAfterSeconds: 3600,
        lockedUntil: rateRecord.lockedUntil,
        attemptsUsed: MAX_OTP_ATTEMPTS,
        maxAttempts: MAX_OTP_ATTEMPTS,
        remainingAttempts: 0
      });
    }

    // Record this OTP generation attempt
    rateRecord.attempts.push(now);
    const attemptsUsed = rateRecord.attempts.length;
    const remainingAttempts = Math.max(0, MAX_OTP_ATTEMPTS - attemptsUsed);

    // If this was the 5th attempt, lock out further requests for the next 1 hour
    if (attemptsUsed >= MAX_OTP_ATTEMPTS) {
      rateRecord.lockedUntil = now + ONE_HOUR_MS;
    }

    // 1. Generate secure 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
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
        attemptsUsed,
        maxAttempts: MAX_OTP_ATTEMPTS,
        remainingAttempts,
        lockedUntil: rateRecord.lockedUntil,
        message: `OTP generated. Please check your email. (Attempt ${attemptsUsed} of ${MAX_OTP_ATTEMPTS})`
      });
    }

    // 2. Call Brevo Transactional Email API (https://api.brevo.com/v3/smtp/email)
    const emailPayload = {
      sender: {
        name: 'Lyka Realty Portal',
        email: brevoSenderEmail
      },
      replyTo: {
        name: 'Lyka Realty Support',
        email: brevoSenderEmail
      },
      to: [
        {
          email: cleanEmail,
          name: portalName
        }
      ],
      subject: `Your Lyka Realty OTP is: ${otpCode} (Valid for 3 Minutes)`,
      textContent: `Lyka Realty Security Verification

Your verification code is: ${otpCode}

This code is valid for 3 minutes. Enter this code on the ${portalName} login screen to access your portal.
If you did not request this login code, please ignore this email.

Lyka Realty LLC, Dubai, UAE.`,
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
        attemptsUsed,
        maxAttempts: MAX_OTP_ATTEMPTS,
        remainingAttempts,
        lockedUntil: rateRecord.lockedUntil
      });
    }

    console.log(`[Brevo] OTP sent successfully to ${cleanEmail}. MessageId:`, data.messageId);
    return res.json({
      success: true,
      messageId: data.messageId,
      expiresInSeconds: 180,
      attemptsUsed,
      maxAttempts: MAX_OTP_ATTEMPTS,
      remainingAttempts,
      lockedUntil: rateRecord.lockedUntil,
      message: `Verification code sent to ${cleanEmail}. Valid for 3 minutes. (Attempt ${attemptsUsed} of ${MAX_OTP_ATTEMPTS})`
    });

  } catch (error: any) {
    console.error('[Brevo Error]:', error);
    res.status(500).json({ error: error?.message || 'Server error sending email OTP.' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Admin / Manager Password Reset Flow Endpoints (Forgot Password & Brevo Email)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/send-password-reset-link — Generates secure reset token & emails reset link
app.post('/api/auth/send-password-reset-link', async (req: Request, res: Response) => {
  try {
    const { email, portal } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const portalKey: 'admin' | 'property_manager' | 'sales_manager' =
      portal === 'sales_manager' ? 'sales_manager' : portal === 'property_manager' ? 'property_manager' : 'admin';
    const portalName = portalKey === 'sales_manager' ? 'Sales Manager' : portalKey === 'property_manager' ? 'Property Manager' : 'Admin';

    // Verify that the provided email matches the registered portal email
    const allCreds = loadStoredPortalCredentials();
    const targetCred = allCreds[portalKey] || DEFAULT_SERVER_CREDENTIALS[portalKey];
    const registeredEmail = (targetCred?.email || '').trim().toLowerCase();

    // Also check Firestore for the latest registered email in case disk is stale
    let firestoreEmail = '';
    if (firestoreDb) {
      try {
        const collectionName = portalKey === 'sales_manager' ? 'Sales_login' : portalKey === 'property_manager' ? 'Property_login' : 'Admin_login';
        const docSnap = await safeFirestoreGetDoc(fsDoc(firestoreDb, collectionName, portalKey), 3000);
        if (docSnap && docSnap.exists()) {
          const d = docSnap.data();
          firestoreEmail = (d?.email || d?.Email_id || '').trim().toLowerCase();
        }
      } catch (_) {}
    }

    const effectiveRegisteredEmail = firestoreEmail || registeredEmail;
    if (effectiveRegisteredEmail && cleanEmail !== effectiveRegisteredEmail) {
      return res.status(400).json({
        success: false,
        error: `This email address is not registered for the ${portalName} portal. Please use the correct registered email address.`
      });
    }

    // Generate secure 32-byte hex token
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 minutes expiration

    activePasswordResetTokens[token] = {
      token,
      email: cleanEmail,
      portal: portalKey,
      expiresAt,
      createdAt: now
    };

    // Safely write reset token to Firestore 'password_resets'
    if (firestoreDb) {
      safeFirestoreSetDoc(fsDoc(firestoreDb, 'password_resets', token), {
        token,
        email: cleanEmail,
        portal: portalKey,
        expiresAt: new Date(expiresAt).toISOString(),
        createdAt: new Date(now).toISOString()
      }, { merge: true }, 3500).catch(() => {});
    }

    // Determine host URL for the reset link
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const resetUrl = `${protocol}://${host}/?reset_token=${token}&portal=${portalKey}&email=${encodeURIComponent(cleanEmail)}`;

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'admin@lykarealty.ae';

    if (brevoApiKey) {
      const emailPayload = {
        sender: {
          name: 'Lyka Realty Security',
          email: brevoSenderEmail
        },
        replyTo: {
          name: 'Lyka Realty Support',
          email: brevoSenderEmail
        },
        to: [
          {
            email: cleanEmail,
            name: portalName
          }
        ],
        subject: `Reset Your Lyka Realty ${portalName} Password`,
        textContent: `Lyka Realty Password Reset
        
A password reset was requested for your ${portalName} Portal account (${cleanEmail}).
Click the secure link below to generate or set a new password:
${resetUrl}

This link is valid for 30 minutes. If you did not request this, you can safely ignore this email.
Lyka Realty LLC, Dubai, UAE.`,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
              .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
              .brand { color: #f59e0b; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; }
              .title { color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 12px; }
              .text { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
              .btn-box { text-align: center; margin: 30px 0; }
              .btn { display: inline-block; background-color: #f59e0b; color: #0b0f19 !important; font-weight: 800; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35); }
              .link-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 11px; color: #cbd5e1; margin-bottom: 20px; }
              .footer { color: #64748b; font-size: 12px; text-align: center; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="brand">🏰 LYKA REALTY DUBAI</div>
              <h1 class="title">Reset ${portalName} Password</h1>
              <p class="text">
                A password reset was requested for your <strong>${portalName} Portal</strong> account (<span style="color:#f59e0b; font-weight:600;">${cleanEmail}</span>). Click the secure button below to set or generate a new password:
              </p>
              <div class="btn-box">
                <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
              </div>
              <p class="text" style="font-size: 12px; margin-bottom: 8px;">
                Or copy and paste this direct link into your browser:
              </p>
              <div class="link-box">
                <a href="${resetUrl}" style="color: #f59e0b; text-decoration: none;">${resetUrl}</a>
              </div>
              <p class="text" style="font-size: 12px; color: #64748b; margin-bottom: 0;">
                ⏱️ This reset link is valid for <strong>30 minutes</strong> only. If you did not request this password reset, please ignore this email.
              </p>
              <div class="footer">
                © ${new Date().getFullYear()} Lyka Realty LLC, Dubai, UAE. Confidential Security Notification.
              </div>
            </div>
          </body>
          </html>
        `
      };

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });
        const brevoData = await response.json().catch(() => ({}));
        console.log(`[Brevo Password Reset] Sent to ${cleanEmail}. Status: ${response.status}`, brevoData?.messageId || '');
      } catch (brevoErr: any) {
        console.warn('[Brevo Password Reset] Warning dispatching email:', brevoErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Password reset link dispatched to ${cleanEmail}. Please check your Gmail inbox.`,
      resetUrl,
      token,
      email: cleanEmail,
      portal: portalKey
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/verify-reset-token — Verifies if a reset token is valid
app.post('/api/auth/verify-reset-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    let tokenRecord = activePasswordResetTokens[token];

    if (!tokenRecord && firestoreDb) {
      try {
        const docRef = fsDoc(firestoreDb, 'password_resets', token);
        const snap = await safeFirestoreGetDoc(docRef, 3000);
        if (snap && snap.exists()) {
          const d = snap.data();
          if (new Date(d.expiresAt).getTime() > Date.now()) {
            tokenRecord = {
              token,
              email: d.email,
              portal: d.portal,
              expiresAt: new Date(d.expiresAt).getTime(),
              createdAt: new Date(d.createdAt).getTime()
            };
          }
        }
      } catch (_) {}
    }

    if (!tokenRecord || Date.now() > tokenRecord.expiresAt) {
      return res.json({ valid: false, message: 'Invalid or expired reset token.' });
    }

    return res.json({
      valid: true,
      email: tokenRecord.email,
      portal: tokenRecord.portal
    });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// POST /api/auth/reset-portal-password — Updates password in database & invalidates token
app.post('/api/auth/reset-portal-password', async (req: Request, res: Response) => {
  try {
    const { token, email, portal, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // 1. Verify token
    let tokenRecord = activePasswordResetTokens[token];

    if (!tokenRecord && firestoreDb) {
      try {
        const docRef = fsDoc(firestoreDb, 'password_resets', token);
        const snap = await safeFirestoreGetDoc(docRef, 3000);
        if (snap && snap.exists()) {
          const d = snap.data();
          if (new Date(d.expiresAt).getTime() > Date.now()) {
            tokenRecord = {
              token,
              email: d.email,
              portal: d.portal,
              expiresAt: new Date(d.expiresAt).getTime(),
              createdAt: new Date(d.createdAt).getTime()
            };
          }
        }
      } catch (_) {}
    }

    if (!tokenRecord || Date.now() > tokenRecord.expiresAt) {
      return res.status(400).json({ success: false, error: 'This password reset link is invalid or has expired. Please request a new link.' });
    }

    const portalKey: 'admin' | 'property_manager' | 'sales_manager' =
      (portal || tokenRecord.portal) === 'sales_manager' ? 'sales_manager' :
      (portal || tokenRecord.portal) === 'property_manager' ? 'property_manager' : 'admin';
    const cleanPassword = String(newPassword).trim();
    const cleanEmail = String(email || tokenRecord.email).trim().toLowerCase();
    const now = new Date().toISOString();

    // 2. Persist updated password to disk
    const allCreds = loadStoredPortalCredentials();
    const currentRecord = allCreds[portalKey] || DEFAULT_SERVER_CREDENTIALS[portalKey];

    allCreds[portalKey] = {
      ...currentRecord,
      password: cleanPassword,
      email: cleanEmail || currentRecord.email,
      updatedAt: now
    };
    saveStoredPortalCredentials(allCreds);

    // 3. Persist updated password to Firestore
    if (firestoreDb) {
      const collectionName = portalKey === 'sales_manager' ? 'Sales_login' : portalKey === 'property_manager' ? 'Property_login' : 'Admin_login';
      const docRef = fsDoc(firestoreDb, collectionName, portalKey);
      safeFirestoreSetDoc(docRef, {
        id: portalKey,
        email: cleanEmail || currentRecord.email,
        Email_id: cleanEmail || currentRecord.email,
        password: cleanPassword,
        role: portalKey,
        updatedAt: now
      }, { merge: true }, 4000).catch((e) => {
        console.warn(`[Password Reset] Firestore sync notice for ${collectionName}:`, e.message);
      });
      console.log(`[Password Reset] Password updated in Firestore collection '${collectionName}' for ${portalKey} (${cleanEmail})`);
    }

    // 4. Invalidate token
    delete activePasswordResetTokens[token];
    if (firestoreDb) {
      fsDeleteDoc(fsDoc(firestoreDb, 'password_resets', token)).catch(() => {});
    }

    return res.json({
      success: true,
      message: `Password updated successfully in database for ${portalKey}! You can now sign in with your new password.`,
      portal: portalKey,
      email: cleanEmail
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
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
    let record = activeEmailOtps[otpKey];
    if (!record) {
      // Robust lookup fallback: find any active OTP registered for this email
      const matchedKey = Object.keys(activeEmailOtps).find(k => k.endsWith(`_${cleanEmail}`));
      if (matchedKey) record = activeEmailOtps[matchedKey];
    }

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
    const anyAlt = Object.keys(activeEmailOtps).find(k => k.endsWith(`_${cleanEmail}`));
    if (anyAlt) delete activeEmailOtps[anyAlt];
    return res.json({ valid: true, message: 'OTP verified successfully.' });

  } catch (error: any) {
    res.status(500).json({ valid: false, message: error?.message });
  }
});

// Clear / Delete OTP upon logout
app.post('/api/auth/clear-email-otp', async (req: Request, res: Response) => {
  try {
    const { email, portal } = req.body || {};
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      delete activeEmailOtps[`${portal || 'admin'}_${cleanEmail}`];
      delete activeEmailOtps[`admin_${cleanEmail}`];
      delete activeEmailOtps[`property_manager_${cleanEmail}`];
      delete activeEmailOtps[`sales_manager_${cleanEmail}`];
    } else {
      for (const k of Object.keys(activeEmailOtps)) {
        delete activeEmailOtps[k];
      }
    }
    return res.json({ success: true, message: 'Active OTP deleted from memory.' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ── User Authentication & Profile Endpoints (Server-Side Authenticated) ──────

// POST /api/auth/save-user-login — persists user profile & login event via server Firebase session
app.post('/api/auth/save-user-login', async (req: Request, res: Response) => {
  try {
    const { userId, email, fullName, authProvider, age, termsAccepted } = req.body || {};
    if (!email && !userId) {
      return res.status(400).json({ success: false, error: 'Email or userId is required.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanUid = (userId || '').trim();
    const now = new Date().toISOString();

    const userData: any = {
      uid: cleanUid || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      Email_id: (email || '').trim(),
      Name: (fullName || cleanEmail.split('@')[0] || 'User').trim(),
      auth_provider: authProvider || 'Email',
      last_login: now,
      login_history: fsArrayUnion(now)
    };
    if (age !== undefined && age !== null && age !== '') {
      userData.Age = Number(age);
    }
    if (termsAccepted) {
      userData.terms_accepted = true;
      userData.terms_accepted_at = now;
      userData.terms_version = 'v2.4';
    }

    if (firestoreDb) {
      try {
        if (cleanEmail) {
          // Strictly single account per email ID in User_login
          await fsSetDoc(fsDoc(firestoreDb, 'User_login', cleanEmail), userData, { merge: true });
        } else if (cleanUid) {
          await fsSetDoc(fsDoc(firestoreDb, 'User_login', cleanUid), userData, { merge: true });
        }

        // Record login event for analytics
        const eventId = `EVT-${cleanUid ? cleanUid.substring(0, 8) : 'CLIENT'}-${Date.now()}`;
        await fsSetDoc(fsDoc(firestoreDb, 'login_events', eventId), {
          userId: cleanUid,
          email: (email || '').trim(),
          fullName: (fullName || '').trim(),
          authProvider: authProvider || 'Email',
          age: age !== undefined && age !== null && age !== '' ? Number(age) : null,
          timestamp: now
        }, { merge: true });
        console.log(`[Auth API] Saved user login to Firestore for ${cleanEmail || cleanUid}`);
      } catch (fsErr: any) {
        console.warn(`[Auth API] Firestore save error:`, fsErr.message);
      }
    }

    return res.json({ success: true, user: userData });
  } catch (err: any) {
    console.error('[Auth API] save-user-login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

function sanitizeCredential(cred: any) {
  if (!cred) return null;
  const { password, Password, ...safe } = cred;
  return safe;
}

// GET /api/auth/portal-credentials — retrieves current metadata from persistent store & Firestore (Passwords are NEVER exposed)
app.get('/api/auth/portal-credentials', async (_req: Request, res: Response) => {
  try {
    const diskCreds = loadStoredPortalCredentials();
    const result: any = {
      admin: sanitizeCredential(diskCreds.admin),
      property_manager: sanitizeCredential(diskCreds.property_manager),
      sales_manager: sanitizeCredential(diskCreds.sales_manager)
    };

    // Fast-query Firestore if connected and responsive
    if (firestoreDb) {
      try {
        const [aSnap, pSnap, sSnap] = await Promise.all([
          safeFirestoreGetDoc(fsDoc(firestoreDb, 'Admin_login', 'admin'), 2500),
          safeFirestoreGetDoc(fsDoc(firestoreDb, 'Property_login', 'property_manager'), 2500),
          safeFirestoreGetDoc(fsDoc(firestoreDb, 'Sales_login', 'sales_manager'), 2500)
        ]);
        if (aSnap && aSnap.exists()) {
          const d = sanitizeCredential(aSnap.data());
          if (d && (d.email || d.Email_id)) result.admin = { ...result.admin, ...d, email: d.email || d.Email_id };
        }
        if (pSnap && pSnap.exists()) {
          const d = sanitizeCredential(pSnap.data());
          if (d && (d.email || d.Email_id)) result.property_manager = { ...result.property_manager, ...d, email: d.email || d.Email_id };
        }
        if (sSnap && sSnap.exists()) {
          const d = sanitizeCredential(sSnap.data());
          if (d && (d.email || d.Email_id)) result.sales_manager = { ...result.sales_manager, ...d, email: d.email || d.Email_id };
        }
      } catch (err: any) {
        console.warn('[Portal Auth API] Fast Firestore credentials read notice:', err.message);
      }
    }

    const staffList = loadPortalStaff();
    const authorizedEmails = [
      result.admin.email,
      result.property_manager.email,
      result.sales_manager.email,
      ...staffList.map(s => s.email)
    ].filter(Boolean);
    result.authorizedEmails = Array.from(new Set(authorizedEmails.map((e: string) => e.toLowerCase())));
    result.staff = staffList.map(({ password, ...rest }) => rest);

    return res.json({ success: true, credentials: result, staff: result.staff });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/verify-portal-login — server-side secure authentication with constant-time verification & anti-brute-force rate limiting
app.post('/api/auth/verify-portal-login', async (req: Request, res: Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress || 'unknown';
    const { portal, email, password } = req.body || {};

    if (!portal || !email || !password) {
      return res.status(400).json({ valid: false, error: 'Portal, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const portalKey: 'admin' | 'property_manager' | 'sales_manager' =
      portal === 'sales_manager' ? 'sales_manager' : portal === 'property_manager' ? 'property_manager' : 'admin';

    // 1. IP & Email brute-force rate-limiting
    const rateKey = `${clientIp}_${portalKey}_${cleanEmail}`;
    const now = Date.now();
    const rateRecord = loginAttemptLimits[rateKey];
    if (rateRecord && rateRecord.lockedUntil && now < rateRecord.lockedUntil) {
      const waitMinutes = Math.max(1, Math.ceil((rateRecord.lockedUntil - now) / 60000));
      return res.status(429).json({
        valid: false,
        error: `Too many failed login attempts (5/5). Account temporarily locked for security. Please try again in ${waitMinutes} minute(s).`
      });
    }

    // 2. Look up matching credential across staff & default portal credentials
    const lookup = await findCredentialForPortalLogin(portalKey, cleanEmail);
    const targetCred = lookup.credential;
    const expectedPassword = String(targetCred?.password || '').trim();

    let passwordMatches = false;
    if (lookup.matched && expectedPassword) {
      const hashA = crypto.createHash('sha256').update(cleanPassword).digest();
      const hashB = crypto.createHash('sha256').update(expectedPassword).digest();
      passwordMatches = crypto.timingSafeEqual(hashA, hashB);
    }

    if (!lookup.matched || !passwordMatches) {
      if (!loginAttemptLimits[rateKey] || (now - loginAttemptLimits[rateKey].firstAttempt > LOGIN_LOCKOUT_MS)) {
        loginAttemptLimits[rateKey] = { count: 1, lockedUntil: 0, firstAttempt: now };
      } else {
        loginAttemptLimits[rateKey].count += 1;
        if (loginAttemptLimits[rateKey].count >= MAX_LOGIN_ATTEMPTS) {
          loginAttemptLimits[rateKey].lockedUntil = now + LOGIN_LOCKOUT_MS;
        }
      }
      const attemptsUsed = loginAttemptLimits[rateKey]?.count || 1;
      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attemptsUsed);
      return res.status(401).json({
        valid: false,
        error: remaining > 0
          ? `Invalid login or password in database. (${remaining} attempt(s) remaining before 15-minute lockout)`
          : 'Invalid login or password in database. Maximum attempts reached. Account temporarily locked for 15 minutes.'
      });
    }

    // Success: clear rate limits
    delete loginAttemptLimits[rateKey];

    // Generate secure session token (32 random bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');
    activeAdminSessions[token] = {
      portal: portalKey,
      role: portalKey,
      email: cleanEmail,
      name: targetCred?.name,
      phone: targetCred?.phone,
      idCard: targetCred?.idCard,
      createdAt: now,
      expiresAt: now + (8 * 60 * 60 * 1000) // 8-hour session lifetime
    };

    return res.json({
      success: true,
      valid: true,
      token,
      user: {
        id: targetCred?.id || portalKey,
        portal: portalKey,
        role: portalKey,
        email: targetCred?.email || cleanEmail,
        name: targetCred?.name || (portalKey === 'admin' ? 'Lyka Super Admin' : portalKey === 'sales_manager' ? 'Lyka Sales Manager' : 'Lyka Property Manager'),
        phone: targetCred?.phone,
        idCard: targetCred?.idCard
      }
    });
  } catch (err: any) {
    console.error('[Verify Login] Error:', err);
    return res.status(500).json({ valid: false, error: 'Internal server error during verification.' });
  }
});

// POST /api/auth/record-sales-login — records successful Sales Manager login in Firestore (Sales_login and login_events)
app.post('/api/auth/record-sales-login', async (req: Request, res: Response) => {
  try {
    const { email, name, method } = req.body || {};
    const cleanEmail = (email || 'sales@lykarealty.ae').trim();
    const now = new Date().toISOString();

    const salesLoginData: any = {
      id: 'sales_manager',
      email: cleanEmail,
      Email_id: cleanEmail,
      name: (name || 'Lyka Sales Manager').trim(),
      role: 'sales_manager',
      last_login: now,
      status: 'active',
      auth_provider: method || 'Sales_Portal_Login',
      updatedAt: now
    };

    if (firestoreDb) {
      // 1. Update Sales_login collection document safely (non-blocking with timeout)
      safeFirestoreSetDoc(fsDoc(firestoreDb, 'Sales_login', 'sales_manager'), {
        ...salesLoginData,
        login_history: fsArrayUnion(now)
      }, { merge: true }, 3000).catch(e => console.warn('[Sales Login API] Firestore notice:', e.message));

      // 2. Record in login_events collection for analytics and timeline
      const eventId = `EVT-SALES-${Date.now()}`;
      safeFirestoreSetDoc(fsDoc(firestoreDb, 'login_events', eventId), {
        userId: 'sales_manager',
        email: cleanEmail,
        fullName: name || 'Lyka Sales Manager',
        authProvider: method || 'Sales_Portal_Login',
        role: 'sales_manager',
        timestamp: now
      }, { merge: true }, 3000).catch(e => console.warn('[Sales Login API] Firestore event notice:', e.message));

      console.log(`[Sales Login API] Initiated Sales Manager login recording in Firestore for ${cleanEmail}`);
    }

    return res.json({ success: true, record: salesLoginData });
  } catch (err: any) {
    console.error('[Sales Login API] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/save-portal-credential — server-side endpoint to save portal credentials (Super Admin Only)

// ── Staff Access Management Routes ──────────────────────────────────────────

// GET /api/auth/portal-staff — retrieves all authorized staff members (Passwords omitted)
app.get('/api/auth/portal-staff', async (_req: Request, res: Response) => {
  try {
    const staffList = loadPortalStaff();
    const sanitized = staffList.map(({ password, ...rest }) => rest);
    return res.json({ success: true, staff: sanitized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/add-portal-staff — Super Admin adds new Property Admin or Sales Manager
app.post('/api/auth/add-portal-staff', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, idCard, role, password } = req.body || {};
    if (!email || !role || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, role, and password are required.'
      });
    }

    const cleanRole: 'property_manager' | 'sales_manager' =
      role === 'sales_manager' ? 'sales_manager' : 'property_manager';
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanPhone = String(phone || '').trim();
    const cleanIdCard = String(idCard || '').trim();
    const cleanPassword = String(password).trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required.' });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const staffList = loadPortalStaff();
    const existingIndex = staffList.findIndex(s => s.email.toLowerCase() === cleanEmail && s.role === cleanRole);

    const newStaff: ServerPortalStaffMember = {
      id: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      idCard: cleanIdCard,
      role: cleanRole,
      password: cleanPassword,
      status: 'active',
      addedAt: new Date().toISOString(),
      addedBy: 'Super Admin'
    };

    if (existingIndex >= 0) {
      staffList[existingIndex] = { ...staffList[existingIndex], ...newStaff, id: staffList[existingIndex].id };
    } else {
      staffList.unshift(newStaff);
    }
    savePortalStaff(staffList);

    // Sync to Firestore in dedicated collection (Property_login or Sales_login)
    if (firestoreDb) {
      const colName = cleanRole === 'sales_manager' ? 'Sales_login' : 'Property_login';
      const docRef = fsDoc(firestoreDb, colName, cleanEmail);
      safeFirestoreSetDoc(docRef, {
        id: newStaff.id,
        name: cleanName,
        Name: cleanName,
        email: cleanEmail,
        Email_id: cleanEmail,
        phone: cleanPhone,
        Phone_number: cleanPhone,
        id_card: cleanIdCard,
        idCardNumber: cleanIdCard,
        role: cleanRole,
        password: cleanPassword,
        status: 'active',
        createdAt: newStaff.addedAt,
        updatedAt: new Date().toISOString()
      }, { merge: true }, 3000).catch((e) => {
        console.warn(`[Portal Staff] Firestore write warning for ${colName}:`, e.message);
      });
      console.log(`[Portal Staff] Added staff ${cleanEmail} (${cleanName}) for ${cleanRole} in ${colName}`);
    }

    const { password: _, ...sanitizedStaff } = newStaff;
    return res.json({ success: true, staff: sanitizedStaff });
  } catch (err: any) {
    console.error('[Add Portal Staff] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/remove-portal-staff — Super Admin revokes portal access for a staff member
app.post('/api/auth/remove-portal-staff', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanRole = role === 'sales_manager' ? 'sales_manager' : 'property_manager';

    let staffList = loadPortalStaff();
    staffList = staffList.filter(s => !(s.email.toLowerCase() === cleanEmail && s.role === cleanRole));
    savePortalStaff(staffList);

    // Remove from Firestore
    if (firestoreDb) {
      const colName = cleanRole === 'sales_manager' ? 'Sales_login' : 'Property_login';
      const docRef = fsDoc(firestoreDb, colName, cleanEmail);
      fsDeleteDoc(docRef).catch((e) => {
        console.warn(`[Portal Staff] Firestore delete warning for ${colName}:`, e.message);
      });
      console.log(`[Portal Staff] Revoked portal access for ${cleanEmail} in ${colName}`);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Remove Portal Staff] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/save-portal-credential', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).adminSession;
    if (session && session.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Super Admin authorization required to update credentials.' });
    }
    const { portal, email, password, name, docId } = req.body || {};
    if (!portal || !password) {
      return res.status(400).json({ success: false, error: 'portal and password required.' });
    }
    const cleanPassword = String(password).trim();
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const portalKey: 'admin' | 'property_manager' | 'sales_manager' =
      portal === 'sales_manager' ? 'sales_manager' : portal === 'property_manager' ? 'property_manager' : 'admin';
    const targetDocId = docId || portalKey;
    const now = new Date().toISOString();

    // ── Enforce Immutable Admin Email Policy ──
    // Admin emails are permanent and cannot be changed by any admin.
    const allCreds = loadStoredPortalCredentials();
    const existingCred = allCreds[portalKey] || DEFAULT_SERVER_CREDENTIALS[portalKey];
    const permanentEmail = existingCred?.email || (portalKey === 'property_manager' ? 'ravikumar755667@gmail.com' : 'raviku6678@gmail.com');

    // If an incoming request attempts to change the email, reject immediately
    if (email && String(email).trim().toLowerCase() !== permanentEmail.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: `Admin email address is permanently locked and cannot be changed by any admin. Registered email for ${portalKey} is locked to ${permanentEmail}.`
      });
    }

    const payload: any = {
      id: targetDocId,
      email: permanentEmail,
      Email_id: permanentEmail,
      password: cleanPassword,
      role: portalKey,
      name: name || (portalKey === 'sales_manager' ? 'Lyka Sales Manager' : portalKey === 'admin' ? 'Lyka Super Admin' : 'Lyka Property Manager'),
      updatedAt: now
    };

    // 1. Immediately persist to server disk & memory
    allCreds[portalKey] = payload;
    saveStoredPortalCredentials(allCreds);

    // 2. Safely sync to Firestore in the dedicated collection without hanging
    if (firestoreDb) {
      const collectionName = portalKey === 'sales_manager' ? 'Sales_login' : portalKey === 'property_manager' ? 'Property_login' : 'Admin_login';
      const docRef = fsDoc(firestoreDb, collectionName, targetDocId);
      safeFirestoreSetDoc(docRef, payload, { merge: true }, 4000).catch((e) => {
        console.warn(`[Portal Auth API] Background Firestore write warning for ${collectionName}:`, e.message);
      });
      console.log(`[Portal Auth API] Updated password for ${portalKey} in ${collectionName}/${targetDocId} (Email locked to ${permanentEmail})`);
    }

    return res.json({ success: true, credential: payload });
  } catch (err: any) {
    console.error('[Portal Auth API] save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/get-user-profile — retrieves user profile by email or userId
app.get('/api/auth/get-user-profile', async (req: Request, res: Response) => {
  try {
    const emailParam = String(req.query.email || '').trim().toLowerCase();
    const uidParam = String(req.query.userId || '').trim();

    if (!emailParam && !uidParam) {
      return res.status(400).json({ success: false, error: 'email or userId parameter required' });
    }

    if (firestoreDb) {
      try {
        // 1. Direct lookup by clean email
        if (emailParam) {
          const snap = await fsGetDoc(fsDoc(firestoreDb, 'User_login', emailParam));
          if (snap.exists()) {
            const data = snap.data();
            const snapEmail = (data?.Email_id || '').trim().toLowerCase();
            if (!snapEmail || snapEmail === emailParam) {
              return res.json({ success: true, profile: data });
            }
          }
        }

        // 2. Direct lookup by userId
        if (uidParam) {
          const snapUid = await fsGetDoc(fsDoc(firestoreDb, 'User_login', uidParam));
          if (snapUid.exists()) {
            const data = snapUid.data();
            const snapEmail = (data?.Email_id || '').trim().toLowerCase();
            if (!emailParam || !snapEmail || snapEmail === emailParam) {
              return res.json({ success: true, profile: data });
            }
          }
        }

        // 3. Query collection where Email_id == emailParam
        if (emailParam) {
          const q = fsQuery(fsCollection(firestoreDb, 'User_login'), fsWhere('Email_id', '==', emailParam));
          const qSnap = await fsGetDocs(q);
          if (!qSnap.empty) {
            return res.json({ success: true, profile: qSnap.docs[0].data() });
          }
        }
      } catch (fsErr: any) {
        console.warn('[Auth API] Firestore get-user-profile error:', fsErr.message);
      }
    }

    return res.json({ success: true, profile: null });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/update-user-profile — updates Name & Age in Firestore
app.post('/api/auth/update-user-profile', async (req: Request, res: Response) => {
  try {
    const { userId, email, newName, newAge } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanUid = (userId || '').trim();
    const now = new Date().toISOString();

    const updateData: any = {
      Name: (newName || '').trim(),
      updatedAt: now
    };
    if (newAge !== undefined && newAge !== null && newAge !== '') {
      updateData.Age = Number(newAge);
    }

    if (firestoreDb) {
      try {
        if (cleanEmail) {
          await fsSetDoc(fsDoc(firestoreDb, 'User_login', cleanEmail), updateData, { merge: true });
        }
        if (cleanUid && cleanUid.toLowerCase() !== cleanEmail) {
          await fsSetDoc(fsDoc(firestoreDb, 'User_login', cleanUid), updateData, { merge: true });
        }
        console.log(`[Auth API] Updated user profile in Firestore for ${cleanEmail || cleanUid}`);
      } catch (fsErr: any) {
        console.warn(`[Auth API] Firestore update error:`, fsErr.message);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/delete-user-login — deletes user profile from Firestore (Admin Only)
app.post('/api/auth/delete-user-login', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId, email } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanUid = (userId || '').trim();

    if (firestoreDb) {
      try {
        if (cleanEmail) {
          await fsDeleteDoc(fsDoc(firestoreDb, 'User_login', cleanEmail));
        }
        if (cleanUid && cleanUid.toLowerCase() !== cleanEmail) {
          await fsDeleteDoc(fsDoc(firestoreDb, 'User_login', cleanUid));
        }
        console.log(`[Auth API] Deleted user login in Firestore for ${cleanEmail || cleanUid}`);
      } catch (fsErr: any) {
        console.warn(`[Auth API] Firestore delete error:`, fsErr.message);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/all-users — fetches all users from User_login (Admin Only)
app.get('/api/auth/all-users', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    if (firestoreDb) {
      const snap = await fsGetDocs(fsCollection(firestoreDb, 'User_login'));
      const userMap = new Map<string, any>();
      snap.forEach((d) => {
        const data = d.data();
        const key = (data.Email_id || data.uid || d.id).trim().toLowerCase();
        if (!userMap.has(key)) {
          userMap.set(key, { ...data, uid: data.uid || d.id });
        }
      });
      return res.json({ success: true, users: Array.from(userMap.values()) });
    }
    return res.json({ success: true, users: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Property Management & Booking Endpoints ─────────────────────────────────

// GET /api/properties — fetch all properties (merging Firestore & in-memory)
app.get('/api/properties', async (_req: Request, res: Response) => {
  try {
    const propMap = new Map<string, any>();
    // 1. Populate baseline verified listings
    for (const p of (ALL_VERIFIED_PROPERTIES as any[])) {
      propMap.set(p.id, p);
    }
    // 2. Overlay live properties from Firestore 'properties' collection
    if (firestoreDb) {
      try {
        const snap = await fsGetDocs(fsCollection(firestoreDb, 'properties'));
        snap.forEach(d => {
          propMap.set(d.id, { ...d.data(), id: d.id });
        });
      } catch (err: any) {
        console.warn('[Properties API] Firestore fetch warning:', err.message);
      }
    }
    const list = Array.from(propMap.values());
    return res.json({ success: true, properties: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/properties — create or update a property in Firestore and memory
app.post('/api/properties', async (req: Request, res: Response) => {
  try {
    const prop = req.body;
    if (!prop || !prop.id) {
      return res.status(400).json({ success: false, error: 'Property data and ID required' });
    }

    const cleanProp: Record<string, any> = {
      ...prop,
      price_aed: Number(prop.price_aed) || 0,
      price_inr: Number(prop.price_inr) || Math.round((Number(prop.price_aed) || 0) * 22.8),
      size_sqft: Number(prop.size_sqft) || 0,
      status: prop.status || 'Available',
      is_booked: Boolean(prop.is_booked),
      updatedAt: new Date().toISOString(),
      createdAt: prop.createdAt || new Date().toISOString()
    };

    // Clean undefined properties so Firestore never throws
    for (const k of Object.keys(cleanProp)) {
      if (cleanProp[k] === undefined) {
        delete cleanProp[k];
      }
    }

    // 1. Persist to Firestore collection 'properties'
    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'properties', cleanProp.id), cleanProp, { merge: true });
        console.log(`[Properties API] Saved property ${cleanProp.id} to Firestore collection 'properties'`);

        // Generate and persist numerical vector embedding to Firestore 'property_embeddings'
        try {
          const textContent = `${cleanProp.title}. ${cleanProp.property_type || 'Apartment'} in ${cleanProp.community}, ${cleanProp.city || 'Dubai'}. ${cleanProp.bedrooms || '2'} Bedrooms. Price: AED ${cleanProp.price_aed}. Status: ${cleanProp.status}. Developer: ${cleanProp.developer || 'Lyka Reality'}. Amenities: ${(cleanProp.amenities || []).join(', ')}. ${cleanProp.description || ''}`;
          const { vector, model, dimensions } = await getEmbeddingVector(textContent);
          const vector_sum = parseFloat(vector.reduce((a, b) => a + b, 0).toFixed(6));
          const docId = `PROP-${cleanProp.id}`;
          const propEmbedDoc = {
            _id: docId,
            id: docId,
            property_id: cleanProp.id,
            title: cleanProp.title,
            community: cleanProp.community,
            city: cleanProp.city || 'Dubai',
            price_aed: cleanProp.price_aed,
            text_content: textContent,
            vector,
            dimensions,
            vector_sum,
            model,
            status: cleanProp.status,
            is_booked: cleanProp.is_booked,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await safeFirestoreSetDoc(fsDoc(firestoreDb, 'property_embeddings', docId), propEmbedDoc, { merge: true }, 2500);
          console.log(`[Properties API] Saved vector embedding for ${cleanProp.id} to Firestore collection 'property_embeddings'`);
        } catch (embedErr: any) {
          console.warn('[Properties API] Embedding generation notice:', embedErr.message);
        }
      } catch (fsErr: any) {
        console.warn(`[Properties API] Firestore write warning:`, fsErr.message);
      }
    }

    // 2. Update server in-memory list
    const existingIdx = (ALL_VERIFIED_PROPERTIES as any[]).findIndex(p => p.id === cleanProp.id);
    if (existingIdx >= 0) {
      (ALL_VERIFIED_PROPERTIES as any[])[existingIdx] = cleanProp;
    } else {
      (ALL_VERIFIED_PROPERTIES as any[]).unshift(cleanProp);
    }

    // 3. Re-inject agent dependencies
    await injectAgentDependencies();

    return res.json({ success: true, property: cleanProp });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/properties/:id — remove a property from Firestore and in-memory
app.delete('/api/properties/:id', async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.id;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID required' });
    }
    if (firestoreDb) {
      try {
        await fsDeleteDoc(fsDoc(firestoreDb, 'properties', propertyId));
      } catch (e: any) {
        console.warn('[Properties API] Firestore delete warning:', e.message);
      }
    }
    const idx = (ALL_VERIFIED_PROPERTIES as any[]).findIndex(p => p.id === propertyId);
    if (idx >= 0) {
      (ALL_VERIFIED_PROPERTIES as any[]).splice(idx, 1);
    }
    await injectAgentDependencies();
    return res.json({ success: true, deletedId: propertyId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/properties/book — assign / book a property
app.post('/api/properties/book', async (req: Request, res: Response) => {
  try {
    const propertyId = req.body.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'propertyId is required' });
    }

    const target = (ALL_VERIFIED_PROPERTIES as any[]).find(p => p.id === propertyId);

    const customerPhone = (req.body.customerPhone || req.body.assigned_phone || req.body.phone || '').trim();
    let customerName = (req.body.customerName || req.body.assigned_to || req.body.name || '').trim();
    if (!customerName) {
      customerName = customerPhone ? `Client (${customerPhone.slice(-4)})` : 'Valued Client';
    }

    const propertyTitle = req.body.property_title || target?.title || propertyId;
    const community = req.body.community || target?.community || 'Dubai';
    const city = req.body.city || target?.city || req.body.target_city || 'Dubai';
    const bedrooms = String(req.body.bedrooms || target?.bedrooms || '2');
    const priceAed = Number(req.body.price_aed ?? target?.price_aed) || 0;
    const propertyType = req.body.property_type || target?.property_type || 'Apartment';

    // 10% token deposit if booking amount is 0 or not provided
    let bookingAmount = Number(req.body.bookingAmount ?? req.body.booking_amount_aed);
    if (!bookingAmount || bookingAmount <= 0) {
      bookingAmount = priceAed > 0 ? Math.round(priceAed * 0.10) : 50000;
    }

    // Customer email fallback if missing
    let customerEmail = (req.body.customerEmail || req.body.assigned_email || req.body.email || '').trim();
    if (!customerEmail) {
      const cleanDigits = customerPhone.replace(/[^0-9]/g, '');
      customerEmail = cleanDigits ? `client_${cleanDigits}@customer.lykarealty.ae` : 'client@lykarealty.ae';
    }

    // Rich notes from chat answers and booking context
    let notes = (req.body.notes || req.body.booking_notes || '').trim();
    if (!notes) {
      const intentStr = req.body.intent ? `Intent: ${req.body.intent}. ` : '';
      const budgetStr = req.body.budget_max_aed ? `Budget: AED ${Number(req.body.budget_max_aed).toLocaleString()}. ` : '';
      const timelineStr = req.body.move_in_timeline ? `Timeline: ${req.body.move_in_timeline}. ` : '';
      const viewingStr = req.body.viewing_preference ? `Viewing: ${req.body.viewing_preference}. ` : '';
      notes = `Confirmed booking for ${propertyTitle} in ${community} (${bedrooms} BR, AED ${priceAed.toLocaleString()}). ${intentStr}${budgetStr}${timelineStr}${viewingStr}Client: ${customerName} (${customerPhone}).`;
    }

    const customerIdCard = (req.body.assigned_id_card || req.body.customer_id_card || req.body.id_card || '').trim();
    const customerIdType = (req.body.assigned_id_type || req.body.customer_id_type || 'Emirates ID').trim();

    const bookingId = req.body.booking_id || req.body.id || ('BK-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    const bookedAt = req.body.booked_at || new Date().toISOString();

    const bookingUpdate = {
      status: 'Booked',
      is_booked: true,
      assigned_to: customerName,
      assigned_phone: customerPhone,
      assigned_email: customerEmail,
      assigned_id_card: customerIdCard,
      assigned_id_type: customerIdType,
      assignment_verified: true,
      booking_id: bookingId,
      booking_amount_aed: bookingAmount,
      booking_notes: notes,
      booked_at: bookedAt,
      updatedAt: bookedAt
    };

    const bookingRecord = {
      id: bookingId,
      property_id: propertyId,
      property_title: propertyTitle,
      community: community,
      city: city,
      bedrooms: bedrooms,
      price_aed: priceAed,
      property_type: propertyType,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_id_card: customerIdCard,
      customer_id_type: customerIdType,
      assigned_to: customerName,
      assigned_phone: customerPhone,
      assigned_id_card: customerIdCard,
      assigned_id_type: customerIdType,
      assignment_verified: true,
      booking_amount_aed: bookingAmount,
      notes: notes,
      booked_at: bookedAt,
      status: 'Booked',
      lead_id: req.body.lead_id || req.body.leadId || '',
      intent: req.body.intent || 'Buy',
      target_city: city,
      budget_max_aed: Number(req.body.budget_max_aed) || priceAed,
      move_in_timeline: req.body.move_in_timeline || 'Immediate',
      assigned_agent: req.body.assigned_agent || target?.agent_name || 'Zaid Al-Sayed',
      booking_type: req.body.booking_type || 'Direct Booking',
      updatedAt: bookedAt
    };

    // 1. Update in Firestore
    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'properties', propertyId), bookingUpdate, { merge: true });
        await fsSetDoc(fsDoc(firestoreDb, 'booked_properties', bookingId), bookingRecord, { merge: true });
        console.log(`[Properties API] Property ${propertyId} booked for ${customerName} in Firestore`);
      } catch (fsErr: any) {
        console.warn(`[Properties API] Firestore booking error:`, fsErr.message);
      }
    }

    // 2. Update in-memory
    if (target) {
      Object.assign(target, bookingUpdate);
    }

    // 3. Re-inject dependencies so chatbot immediately excludes this booked property
    await injectAgentDependencies();

    return res.json({ success: true, booking: bookingRecord, propertyId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/properties/unbook — cancel booking / release property
app.post('/api/properties/unbook', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'propertyId required' });
    }

    const releaseUpdate = {
      status: 'Available',
      is_booked: false,
      assigned_to: null,
      assigned_phone: null,
      assigned_email: null,
      assigned_id_card: null,
      assigned_id_type: null,
      assignment_verified: false,
      assigned_at: null,
      booking_id: null,
      booked_at: null,
      booking_amount_aed: null,
      booking_notes: null,
      updatedAt: new Date().toISOString()
    };

    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'properties', propertyId), releaseUpdate, { merge: true });

        // Update any matching bookings in booked_properties collection to Cancelled
        const q = fsQuery(fsCollection(firestoreDb, 'booked_properties'), fsWhere('property_id', '==', propertyId));
        const snap = await fsGetDocs(q);
        for (const d of snap.docs) {
          await fsSetDoc(fsDoc(firestoreDb, 'booked_properties', d.id), {
            status: 'Cancelled',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        console.log(`[Properties API] Property ${propertyId} unbooked in Firestore`);
      } catch (fsErr: any) {
        console.warn(`[Properties API] Firestore unbook error:`, fsErr.message);
      }
    }

    const target = (ALL_VERIFIED_PROPERTIES as any[]).find(p => p.id === propertyId);
    if (target) {
      target.status = 'Available';
      target.is_booked = false;
      delete target.assigned_to;
      delete target.assigned_phone;
      delete target.assigned_email;
      delete target.assigned_id_card;
      delete target.assigned_id_type;
      delete target.assignment_verified;
      delete target.booking_id;
    }

    await injectAgentDependencies();

    return res.json({ success: true, propertyId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Customer Favorites & Wishlist API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/favorites/sync — save/sync a favorite property record to database
app.post('/api/favorites/sync', async (req: Request, res: Response) => {
  try {
    const fav = req.body;
    if (!fav || !fav.id || !fav.property_id) {
      return res.status(400).json({ success: false, error: 'id and property_id are required' });
    }

    localFavoritesStore[fav.id] = fav;

    if (firestoreDb) {
      try {
        await fsSetDoc(fsDoc(firestoreDb, 'favorites', fav.id), fav, { merge: true });
        console.log(`[Favorites API] Favorite ${fav.id} synced to Firestore`);
      } catch (fsErr: any) {
        console.warn('[Favorites API] Firestore sync warning:', fsErr.message);
      }
    }

    return res.json({ success: true, favorite: fav });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/favorites/remove — delete a favorite from database
app.post('/api/favorites/remove', async (req: Request, res: Response) => {
  try {
    const { id, propertyId, userId } = req.body;
    const targetId = id || (userId && propertyId ? `fav_${userId}_${propertyId}` : null);

    if (targetId) {
      delete localFavoritesStore[targetId];
      if (firestoreDb) {
        try {
          await fsDeleteDoc(fsDoc(firestoreDb, 'favorites', targetId));
          console.log(`[Favorites API] Favorite ${targetId} deleted from Firestore`);
        } catch (_) {}
      }
    } else if (propertyId) {
      for (const k of Object.keys(localFavoritesStore)) {
        if (localFavoritesStore[k]?.property_id === propertyId) {
          delete localFavoritesStore[k];
          if (firestoreDb) {
            try {
              await fsDeleteDoc(fsDoc(firestoreDb, 'favorites', k));
            } catch (_) {}
          }
        }
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/favorites — list all saved favorites for admin portal
app.get('/api/favorites', async (_req: Request, res: Response) => {
  try {
    let list: any[] = Object.values(localFavoritesStore);

    if (firestoreDb) {
      try {
        const snap = await fsGetDocs(fsCollection(firestoreDb, 'favorites'));
        const dbItems: any[] = [];
        snap.forEach(d => {
          const item = d.data();
          if (item && item.status !== 'removed') {
            dbItems.push({ ...item, id: item.id || d.id });
          }
        });
        if (dbItems.length > 0) {
          list = dbItems;
          // Update in-memory cache
          dbItems.forEach(item => {
            localFavoritesStore[item.id] = item;
          });
        }
      } catch (err: any) {
        console.warn('[Favorites API] Firestore fetch fallback to local:', err.message);
      }
    }

    list.sort((a, b) => new Date(b.saved_at || 0).getTime() - new Date(a.saved_at || 0).getTime());
    return res.json({ success: true, favorites: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, favorites: [] });
  }
});

// Mount Vite or static build
async function startServer() {
  const isProduction = process.env.NODE_ENV?.trim() === 'production' || fs.existsSync(path.join(__dirname, 'index.html'));
  if (isProduction) {
    const staticDir = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : __dirname;
    app.use(express.static(staticDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(staticDir, 'index.html'));
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
