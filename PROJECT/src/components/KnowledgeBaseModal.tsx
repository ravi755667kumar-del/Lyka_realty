import React, { useState } from 'react';
import { X, BookOpen, FileText, Check, Plus, AlertCircle, Building2, ShieldCheck } from 'lucide-react';
import { KnowledgeDoc } from '../types';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_DOCS: KnowledgeDoc[] = [
  {
    id: 'doc_worli',
    title: 'Lyka Heights — Worli, South Mumbai (Brochure Factsheet)',
    category: 'Residential Luxury',
    content: `Overview: 45-storey ultra-luxury residential tower overlooking the Arabian Sea in Worli.
Configurations:
- 3 BHK Residences: 2,150 sq.ft. carpet, ₹4.50 Cr to ₹5.50 Cr.
- 4 BHK Sky Mansions: 3,400 sq.ft. carpet, ₹7.20 Cr to ₹9.00 Cr.
Possession: December 2027 (RERA Registered: P51900034291).
Key Amenities: Sky lounge, infinity pool on 45th floor, private elevator access, 3 covered parking slots.
Payment Plan: 10% booking, 40% construction-linked, 50% on possession.`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doc_bangalore',
    title: 'Lyka Green Terraces — Whitefield, Bangalore (Approved Factsheet)',
    category: 'Eco-Luxury Residences',
    content: `Overview: Biophilic eco-homes located 5 minutes from ITPL and Kadugodi Metro Station.
Configurations:
- 2 BHK Premium: 1,280 sq.ft., ₹1.20 Cr to ₹1.45 Cr.
- 3 BHK Royal: 1,850 sq.ft., ₹1.80 Cr to ₹2.40 Cr.
Possession: June 2026.
Sustainability: 80% open green space, zero discharge, solar-powered common areas.`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doc_cyberhub',
    title: 'Lyka TechPark Commercial Suites — Gurgaon CyberHub (Investment Factsheet)',
    category: 'Commercial Investment',
    content: `Overview: Grade-A pre-leased office suites in CyberCity Gurgaon with institutional blue-chip tenants.
Ticket Size: ₹80 Lakh to ₹2.50 Cr.
Projected Rental Yield: 8.5% p.a. with 15% escalation every 3 years.
Lease Term: 9-year corporate lock-in period.`,
    createdAt: new Date().toISOString(),
  },
];

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState<KnowledgeDoc[]>(DEFAULT_DOCS);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc>(DEFAULT_DOCS[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newContent, setNewContent] = useState('');

  if (!isOpen) return null;

  const handleAddDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newD: KnowledgeDoc = {
      id: `doc_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'General Information',
      content: newContent.trim(),
      createdAt: new Date().toISOString(),
    };

    setDocs([newD, ...docs]);
    setSelectedDoc(newD);
    setNewTitle('');
    setNewCategory('');
    setNewContent('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Approved Property Knowledge & PDF Grounding</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row text-xs">
          {/* Left: Document List */}
          <div className="w-full md:w-80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                Grounding Docs ({docs.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Cancel' : 'Add Doc'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsAdding(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedDoc.id === doc.id && !isAdding
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-semibold text-amber-400 block mb-1 uppercase tracking-wider">
                    {doc.category}
                  </span>
                  <div className="font-bold text-xs line-clamp-2 text-white">{doc.title}</div>
                </button>
              ))}
            </div>

            {/* RAG Rule Card */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-slate-400">
              <div className="flex items-center space-x-1 text-amber-400 font-bold text-[10px] uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>AI Grounding Protocol</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The AI is restricted to factual statements from these approved documents. It will never invent pricing or promise availability.
              </p>
            </div>
          </div>

          {/* Right: Document Viewer / Add Form */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
            {isAdding ? (
              <form onSubmit={handleAddDoc} className="space-y-4">
                <h4 className="font-bold text-white text-sm">Add Approved Company Knowledge</h4>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Document Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Lyka SeaBreeze Tower, Bandra West"
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Residential Luxury, Commercial, FAQ..."
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    Document Text (Extracted from PDF)
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Paste approved brochure facts, configurations, pricing, and possession timeline..."
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs leading-relaxed font-mono"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                  >
                    Save Document
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
                    {selectedDoc.category}
                  </span>
                  <h4 className="text-lg font-black text-white">{selectedDoc.title}</h4>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-slate-200 whitespace-pre-wrap leading-relaxed text-xs">
                  {selectedDoc.content}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-300 text-xs">
                  <strong>Fallback Rule:</strong> If the customer asks a question outside of this document, the agent will say:
                  <div className="mt-1 italic text-slate-200">
                    "An agent can provide you with the correct information. Would you like an agent to contact you?"
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
