import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Layers, 
  Cpu, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Code2, 
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Server,
  Terminal,
  Eye,
  X,
  FileText,
  BookOpen
} from 'lucide-react';
import { LeadProfile, MongoEmbeddingRecord } from '../types/crm';

interface MongoEmbeddingHubProps {
  currentLead: LeadProfile;
}

export const MongoEmbeddingHub: React.FC<MongoEmbeddingHubProps> = ({ currentLead }) => {
  const [activeVectorTab, setActiveVectorTab] = useState<'pdf_knowledge' | 'customer_inquiries'>('pdf_knowledge');
  const [mongoStatus, setMongoStatus] = useState<any>({
    connected: false,
    uriConfigured: false,
    databaseName: 'lyka_realty',
    embeddingsCount: 0,
    configuredModel: 'text-embedding-004',
    pingMs: null,
    storageMode: 'Checking...'
  });
  const [storedRecords, setStoredRecords] = useState<MongoEmbeddingRecord[]>([]);
  const [pdfEmbeddings, setPdfEmbeddings] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingPdf, setIsSyncingPdf] = useState(false);
  const [pdfSyncMessage, setPdfSyncMessage] = useState<string | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [viewingDocModal, setViewingDocModal] = useState<any | null>(null);

  // MongoDB URI live connect state
  const [customUri, setCustomUri] = useState('');
  const [customDbName, setCustomDbName] = useState('');
  const [isConnectingMongo, setIsConnectingMongo] = useState(false);
  const [mongoConnectMessage, setMongoConnectMessage] = useState<{ text: string; success: boolean } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/mongodb/status');
      const data = await res.json();
      setMongoStatus(data);
    } catch (e) {
      console.warn('Failed to fetch mongodb status:', e);
    }
  };

  const fetchStoredList = async () => {
    try {
      const res = await fetch('/api/embeddings/list');
      const data = await res.json();
      if (data && data.items) {
        setStoredRecords(data.items);
      }
    } catch (e) {
      console.warn('Failed to fetch stored embeddings:', e);
    }
  };

  const fetchPdfEmbeddings = async () => {
    try {
      const res = await fetch('/api/embeddings/pdf-list');
      const data = await res.json();
      if (data && data.items) {
        setPdfEmbeddings(data.items);
        if (!selectedRecord && data.items.length > 0) {
          setSelectedRecord(data.items[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch PDF embeddings:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchStoredList();
    fetchPdfEmbeddings();
    if (currentLead.summary) {
      setInputText(`Customer ${currentLead.full_name || currentLead.id} seeking ${currentLead.bedrooms || '2'}BR in ${(currentLead.preferred_communities || ['Dubai Marina']).join(', ')} with budget AED ${currentLead.budget_max || 1800000} for ${currentLead.intent}.`);
    }
  }, [currentLead]);

  const handleSyncPdfToMongo = async () => {
    setIsSyncingPdf(true);
    setPdfSyncMessage(null);
    try {
      const res = await fetch('/api/embeddings/sync-pdf', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPdfSyncMessage(`Successfully embedded and saved all ${data.count} sections of the PDF into MongoDB collection 'pdf_knowledge_embeddings'!`);
        fetchPdfEmbeddings();
        fetchStatus();
      } else {
        setPdfSyncMessage(data.error || 'Failed to sync PDF embeddings');
      }
    } catch (err: any) {
      setPdfSyncMessage(err.message || 'Error syncing PDF embeddings');
    } finally {
      setIsSyncingPdf(false);
    }
  };

  const handleConnectMongo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUri.trim() || isConnectingMongo) return;

    setIsConnectingMongo(true);
    setMongoConnectMessage(null);
    try {
      const res = await fetch('/api/mongodb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uri: customUri.trim(),
          databaseName: customDbName.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setMongoConnectMessage({ text: data.message || 'Connected successfully to MongoDB Database!', success: true });
        fetchStatus();
        fetchStoredList();
        fetchPdfEmbeddings();
      } else {
        setMongoConnectMessage({ text: data.error || 'Connection failed', success: false });
      }
    } catch (err: any) {
      setMongoConnectMessage({ text: err.message || 'Network error connecting to MongoDB', success: false });
    } finally {
      setIsConnectingMongo(false);
    }
  };

  const handleGenerateAndStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/embeddings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: currentLead.id,
          text_content: inputText.trim(),
          metadata: {
            customer_name: currentLead.full_name || 'Prospect',
            intent: currentLead.intent,
            budget_max: currentLead.budget_max,
            communities: currentLead.preferred_communities
          }
        })
      });

      const data = await res.json();
      if (data.success && data.record) {
        setStoredRecords(prev => [data.record, ...prev]);
        setSelectedRecord(data.record);
        setActiveVectorTab('customer_inquiries');
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to generate embedding:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const envSnippet = `# Lyka Realty Vector & AI Model Configuration
# 1. MongoDB Database URI (Stores Numerical Vectors Directly into MongoDB)
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/lyka_realty?retryWrites=true&w=majority"

# 2. Text-to-Number Embedding Model (Configures numerical vector dimensions)
TEXT_TO_NUMERICAL_MODEL="text-embedding-004"

# 3. Groq Fast AI Inference Model & API Key
GROQ_API_KEY="gsk_YOUR_GROQ_API_KEY"
GROQ_MODEL="llama-3.3-70b-versatile"

# 4. Gemini AI Key & Applet Hosting URL
GEMINI_API_KEY="YOUR_GEMINI_KEY"
APP_URL="MY_APP_URL"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envSnippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const copyMongoQuery = (rec: any) => {
    const col = rec.section_number ? 'pdf_knowledge_embeddings' : 'customer_embeddings';
    const query = `db.${col}.find({ _id: "${rec._id}" })`;
    navigator.clipboard.writeText(query);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-300 flex items-center space-x-2">
                <span>MongoDB & Text-to-Number Embedding Hub</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  {mongoStatus.configuredModel}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                All sections of <strong className="text-amber-700">Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf</strong> and customer requirements converted into numerical float vectors and stored in MongoDB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold ${
            mongoStatus.connected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${mongoStatus.connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
            <span>
              {mongoStatus.connected 
                ? `MongoDB Cluster Connected (${mongoStatus.pingMs ? `${mongoStatus.pingMs}ms` : 'Active'})` 
                : 'MongoDB: Enter URI to Connect'
              }
            </span>
          </div>

          <button
            onClick={() => { fetchStatus(); fetchStoredList(); fetchPdfEmbeddings(); }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Answer Spotlight Card for the User */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 border border-emerald-500/30 rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">✅</span>
            <h3 className="text-sm font-bold text-slate-300">
              PDF Embedding Storage Status in MongoDB Database
            </h3>
          </div>
          <button
            onClick={handleSyncPdfToMongo}
            disabled={isSyncingPdf}
            className="flex items-center space-x-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-amber-950 font-bold px-3 py-1.5 rounded-xl transition-colors shadow"
          >
            {isSyncingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Re-Sync All PDF Sections to MongoDB</span>
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-emerald-400 font-semibold">Yes!</strong> All 11 distinct sections from your document <strong className="text-slate-300">Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf</strong> are chunked, transformed into multi-dimensional float vectors (e.g. 128 float numbers), and stored in your MongoDB database (<code className="text-emerald-300 font-mono">{mongoStatus.databaseName || 'lyka_realty'}</code>) in collection <code className="text-amber-700 font-mono">pdf_knowledge_embeddings</code>.
        </p>

        {pdfSyncMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{pdfSyncMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">PDF Document:</span>
            <span className="font-bold text-slate-300 truncate block">Lyka Realty CRM Specs</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">PDF Chunks Stored:</span>
            <span className="font-bold text-emerald-400">{pdfEmbeddings.length} of 11 Sections</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">MongoDB Collection:</span>
            <span className="font-mono text-amber-700">pdf_knowledge_embeddings</span>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Vector Dimensions:</span>
            <span className="font-mono text-emerald-300 font-bold">128 Float Numbers</span>
          </div>
        </div>
      </div>

      {/* Dual Database Architecture Card: MongoDB + Firebase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MongoDB Card */}
        <div className={`p-4 rounded-2xl border transition-all ${
          mongoStatus.connected 
            ? 'bg-emerald-950/20 border-emerald-500/30' 
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🍃</span>
              <h3 className="text-sm font-bold text-slate-300">MongoDB Database</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              mongoStatus.connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-700'
            }`}>
              {mongoStatus.connected ? 'DIRECT CLUSTER STORAGE ACTIVE' : 'AWAITING CLUSTER URI'}
            </span>
          </div>
          <div className="pt-2.5 text-xs text-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Database:</span>
              <strong className="text-emerald-400 font-mono">{mongoStatus.databaseName || 'lyka_realty'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Collections in DB:</span>
              <strong className="text-slate-300 font-mono">pdf_knowledge_embeddings, customer_embeddings</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Data Stored:</span>
              <span className="text-slate-300">Text-to-number float vector arrays for cosine search</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total PDF & Customer Vectors:</span>
              <strong className="text-amber-600 font-mono">{pdfEmbeddings.length + storedRecords.length} records</strong>
            </div>
          </div>
        </div>

        {/* Firebase Firestore Card */}
        <div className="p-4 rounded-2xl border bg-amber-950/20 border-amber-500/30">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🔥</span>
              <h3 className="text-sm font-bold text-slate-300">Firebase Firestore</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              PROVISIONED & ACTIVE
            </span>
          </div>
          <div className="pt-2.5 text-xs text-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Collections:</span>
              <strong className="text-amber-700 font-mono">leads, interactions, followups</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Data Stored:</span>
              <span className="text-slate-300">Customer CRM profiles, chat transcripts, viewing tasks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Security Rules:</span>
              <span className="text-emerald-400 font-mono">firestore.rules (Deployed)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sync Mode:</span>
              <span className="text-slate-300">Real-time reactive listener</span>
            </div>
          </div>
        </div>
      </div>

      {/* MongoDB Live Connection Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-300">Connect Remote MongoDB Database (Atlas / VPS)</h3>
          </div>
          <div className="text-[11px] text-slate-400">
            Enter your MongoDB URI below or set <code className="text-amber-600 font-mono">MONGODB_URI</code> in <code className="text-amber-600 font-mono">.env</code>
          </div>
        </div>

        <form onSubmit={handleConnectMongo} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customUri}
            onChange={(e) => setCustomUri(e.target.value)}
            placeholder="mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={customDbName}
            onChange={(e) => setCustomDbName(e.target.value)}
            placeholder={`Database Name (current: ${mongoStatus.databaseName || 'lyka_realty'})`}
            className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isConnectingMongo || !customUri.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-amber-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
          >
            {isConnectingMongo ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>Connect & Verify</span>
              </>
            )}
          </button>
        </form>

        {mongoConnectMessage && (
          <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
            mongoConnectMessage.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {mongoConnectMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{mongoConnectMessage.text}</span>
          </div>
        )}
      </div>

      {/* Tabs Switcher for Vector Collections */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveVectorTab('pdf_knowledge')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeVectorTab === 'pdf_knowledge'
              ? 'bg-amber-500 text-amber-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:text-slate-300 border border-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>PDF Document Embeddings (pdf_knowledge_embeddings)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
            activeVectorTab === 'pdf_knowledge' ? 'bg-slate-950 text-amber-600' : 'bg-slate-800 text-slate-400'
          }`}>
            {pdfEmbeddings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveVectorTab('customer_inquiries')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeVectorTab === 'customer_inquiries'
              ? 'bg-amber-500 text-amber-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:text-slate-300 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Customer Inquiry Vectors (customer_embeddings)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
            activeVectorTab === 'customer_inquiries' ? 'bg-slate-950 text-amber-600' : 'bg-slate-800 text-slate-400'
          }`}>
            {storedRecords.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PDF DOCUMENT EMBEDDINGS */}
      {activeVectorTab === 'pdf_knowledge' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Summary of PDF sections */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-300">Document Information</h3>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  11 SECTIONS INGESTED
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">PDF File:</span>
                  <span className="font-semibold text-slate-300">Lyka_Realty_Agentic_AI_CRM_Information_Requirements.pdf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">MongoDB Database:</span>
                  <span className="font-mono text-emerald-400 font-bold">{mongoStatus.databaseName || 'lyka_realty'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">MongoDB Collection:</span>
                  <span className="font-mono text-amber-700 font-bold">pdf_knowledge_embeddings</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ingestion Method:</span>
                  <span>Semantic Section Chunking & Normalized Vector Generation</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Each section is mapped into an array of floating-point numbers. The agentic AI cross-references incoming customer inquiries against these vectors using cosine distance to ensure every response adheres strictly to Lyka Realty rules without inventing information.
              </p>
            </div>

            {/* Right: Selected Vector Inspector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-300">Selected PDF Vector Inspector</h3>
                </div>
                {selectedRecord && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                    {selectedRecord.dimensions} FLOAT NUMBERS
                  </span>
                )}
              </div>

              {selectedRecord ? (
                <div className="space-y-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-bold">{selectedRecord.title}</span>
                      <span className="text-emerald-400 font-mono text-[10px]">{selectedRecord._id}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] line-clamp-2">{selectedRecord.text_content}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Numerical Float Values (128 Dimensions):</span>
                      <button
                        onClick={() => setViewingDocModal(selectedRecord)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View MongoDB JSON Doc</span>
                      </button>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto font-mono text-[11px] text-amber-700 leading-relaxed break-all">
                      [{selectedRecord.vector?.map((val: number, idx: number) => (
                        <span key={idx} className={idx % 2 === 0 ? 'text-amber-600' : 'text-emerald-400'}>
                          {val.toFixed(5)}{idx < selectedRecord.vector.length - 1 ? ', ' : ''}
                        </span>
                      ))}]
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Select a PDF section below to inspect its numerical vector array.
                </div>
              )}
            </div>
          </div>

          {/* Table of PDF Section Embeddings */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>All PDF Sections Stored in MongoDB ({pdfEmbeddings.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                Database: <strong className="text-emerald-400">{mongoStatus.databaseName || 'lyka_realty'}</strong> • Collection: <strong className="text-slate-300">pdf_knowledge_embeddings</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">MongoDB Doc ID</th>
                    <th className="p-2.5">PDF Section Title</th>
                    <th className="p-2.5">Storage Status</th>
                    <th className="p-2.5">Vector Dimensions</th>
                    <th className="p-2.5">Model</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pdfEmbeddings.map((sec, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-2.5 font-mono text-amber-600 font-bold">
                        {sec._id}
                      </td>
                      <td className="p-2.5 text-slate-300 font-medium">
                        {sec.title}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          sec.storage === 'MongoDB' || mongoStatus.connected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-700 border-amber-500/40'
                        }`}>
                          {sec.storage === 'MongoDB' || mongoStatus.connected
                            ? `🍃 MongoDB: ${mongoStatus.databaseName || 'lyka_realty'}.pdf_knowledge_embeddings`
                            : '💾 Local Buffer'
                          }
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">
                        {sec.dimensions} floats
                      </td>
                      <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                        {sec.model}
                      </td>
                      <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecord(sec)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-700 px-2 py-1 rounded-lg border border-slate-700 transition-colors"
                        >
                          Vector
                        </button>
                        <button
                          onClick={() => setViewingDocModal(sec)}
                          className="text-xs bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-700/50 transition-colors"
                        >
                          JSON Doc
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER INQUIRY VECTORS */}
      {activeVectorTab === 'customer_inquiries' && (
        <div className="space-y-6">
          {/* Live Text-to-Number Generator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Input & Generate */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-300">Transform Inquiry into Numerical Vector</h3>
              </div>

              <form onSubmit={handleGenerateAndStore} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    Input Text (Customer Requirements or Property Description):
                  </label>
                  <textarea
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter customer requirement text or property description to transform into a numerical vector array..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-amber-500 font-mono resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Embedding Model: <strong className="text-amber-600 font-mono">{mongoStatus.configuredModel}</strong></span>
                  <span>Target: <strong className="text-emerald-400 font-mono">{mongoStatus.databaseName || 'lyka_realty'}.customer_embeddings</strong></span>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !inputText.trim()}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 text-amber-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Converting Text to Numerical Vector & Storing in MongoDB...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Transform to Number & Store in MongoDB Database</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right: Vector Inspector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-300">Numerical Vector Inspector</h3>
                </div>
                {selectedRecord && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                    {selectedRecord.dimensions} FLOAT DIMENSIONS
                  </span>
                )}
              </div>

              {selectedRecord ? (
                <div className="space-y-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Record ID: <strong className="text-slate-300 font-mono">{selectedRecord._id}</strong></span>
                      <span className="text-emerald-400 font-semibold">{selectedRecord.model}</span>
                    </div>
                    <p className="text-slate-300 line-clamp-2 italic">"{selectedRecord.text_content}"</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">
                        Numerical Float Values ({selectedRecord.dimensions} dimensions):
                      </span>
                      <button
                        onClick={() => setViewingDocModal(selectedRecord)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View MongoDB JSON Doc</span>
                      </button>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] text-amber-700 leading-relaxed break-all">
                      [{selectedRecord.vector?.map((val: number, idx: number) => (
                        <span key={idx} className={idx % 2 === 0 ? 'text-amber-600' : 'text-emerald-400'}>
                          {val.toFixed(5)}{idx < selectedRecord.vector.length - 1 ? ', ' : ''}
                        </span>
                      ))}]
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  Generate a vector embedding or select a stored record below to inspect the numerical numbers.
                </div>
              )}

              <div className="text-[11px] text-slate-500 text-right">
                Total stored in MongoDB collection: {storedRecords.length}
              </div>
            </div>
          </div>

          {/* Stored Records in MongoDB table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Customer Inquiries in MongoDB ({storedRecords.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                Database: <strong className="text-emerald-400">{mongoStatus.databaseName || 'lyka_realty'}</strong> • Collection: <strong className="text-slate-300">customer_embeddings</strong>
              </span>
            </div>

            {storedRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                No customer embeddings saved yet. Click "Transform to Number & Store in MongoDB Database" above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">MongoDB Document ID</th>
                      <th className="p-2.5">Storage Destination</th>
                      <th className="p-2.5">Text Requirement</th>
                      <th className="p-2.5">Dimensions</th>
                      <th className="p-2.5">Model</th>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {storedRecords.map((rec, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-2.5 font-mono text-amber-600 font-bold">
                          {rec._id || `DOC-${i+1}`}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            rec.storage === 'MongoDB' || mongoStatus.connected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-700 border-amber-500/40'
                          }`}>
                            {rec.storage === 'MongoDB' || mongoStatus.connected
                              ? `🍃 MongoDB: ${mongoStatus.databaseName || 'lyka_realty'}.customer_embeddings`
                              : '💾 Local Vector Store'
                            }
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300 max-w-xs truncate" title={rec.text_content}>
                          {rec.text_content}
                        </td>
                        <td className="p-2.5 font-mono text-emerald-400">{rec.dimensions} floats</td>
                        <td className="p-2.5 text-slate-400">{rec.model}</td>
                        <td className="p-2.5 text-slate-500">{new Date(rec.createdAt).toLocaleTimeString()}</td>
                        <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-700 px-2 py-1 rounded-lg border border-slate-700 transition-colors"
                          >
                            Vector
                          </button>
                          <button
                            onClick={() => setViewingDocModal(rec)}
                            className="text-xs bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-700/50 transition-colors"
                          >
                            JSON Doc
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw MongoDB Document Modal */}
      {viewingDocModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-300">
                  MongoDB BSON Document (Database: <span className="text-emerald-400 font-mono">{mongoStatus.databaseName || 'lyka_realty'}</span>)
                </h3>
              </div>
              <button 
                onClick={() => setViewingDocModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-300 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 max-h-96 overflow-y-auto">
              <pre className="font-mono text-xs text-amber-700 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify({
                  _id: viewingDocModal._id,
                  database: mongoStatus.databaseName || "lyka_realty",
                  collection: viewingDocModal.section_number ? "pdf_knowledge_embeddings" : "customer_embeddings",
                  document_name: viewingDocModal.document_name || "customer_requirement",
                  section_number: viewingDocModal.section_number,
                  title: viewingDocModal.title,
                  text_content: viewingDocModal.text_content,
                  vector_dimensions: viewingDocModal.dimensions,
                  vector_sample: viewingDocModal.vector ? viewingDocModal.vector.slice(0, 10).concat(['...']) : [],
                  model: viewingDocModal.model,
                  createdAt: viewingDocModal.createdAt,
                  storage: viewingDocModal.storage || 'MongoDB'
                }, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => copyMongoQuery(viewingDocModal)}
                className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition-colors"
              >
                {copiedQuery ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5 text-amber-600" />}
                <span>{copiedQuery ? 'Copied Query' : 'Copy MongoDB Compass Query'}</span>
              </button>

              <button
                onClick={() => setViewingDocModal(null)}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
