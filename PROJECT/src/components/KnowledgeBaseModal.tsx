import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Building2,
  MapPin,
  Compass,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  FileText,
  IndianRupee,
  Layers,
  Search,
} from 'lucide-react';
import { KnowledgeDoc, PropertyItem } from '../types';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddProperty?: () => void;
}

const DEFAULT_DOCS: KnowledgeDoc[] = [
  {
    id: 'doc_priya_guide',
    title: 'Lyka Realty Priya Conversation Guide (v14 Specification)',
    category: 'Spoken Tanglish Telecalling',
    content: `Overview: Spoken conversational telecalling guide for Chennai property leads.
Guidelines:
- 1-Second turnaround brisk telecalling pace.
- Transparent AI Identity: Priya is Lyka Realty's virtual property assistant.
- Never ask for OTP, banking, or payments on calls (100% Zero payment on call policy).
- Strictly verified Chennai property guidance: Velachery, OMR Sholinganallur, Tambaram, Chengalpattu, Porur, and Adyar.
- Two-strike polite objection handling and immediate DNC honor.`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doc_rera_cmda',
    title: 'Chennai Regulatory & Compliance Standards (CMDA, DTCP, TN RERA)',
    category: 'Legal & Approvals',
    content: `All Lyka Realty properties are strictly verified with authorized government statutory bodies:
- CMDA: Chennai Metropolitan Development Authority planning permission.
- DTCP: Directorate of Town and Country Planning approved layouts.
- TN RERA: Tamil Nadu Real Estate Regulatory Authority registered developments.
- Title: Clear legal titles with Patta and bank pre-approval from SBI, HDFC, and ICICI.`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doc_voice_tags',
    title: 'Natural Telecaller Voice Modulation & Pronunciation Rules',
    category: 'Voice Acoustics',
    content: `Rules for Priya's Natural Spoken Delivery:
- Radiant happiness and smiling voice in every utterance.
- Indian English, Tanglish, and Hinglish pronunciation refinement.
- Acronyms spoken letter-by-letter: C-M-D-A, D-T-C-P, B-H-K, E-M-I, S-B-I.
- 15 to 25 words maximum punchy conversational responses.`,
    createdAt: new Date().toISOString(),
  },
];

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  onOpenAddProperty,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'documents'>('properties');
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [docs, setDocs] = useState<KnowledgeDoc[]>(DEFAULT_DOCS);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc>(DEFAULT_DOCS[0]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quick Inline Add Property State
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNearbyLocation, setNewNearbyLocation] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('Apartment');
  const [newBhk, setNewBhk] = useState('2 BHK');
  const [newListingType, setNewListingType] = useState('Buy');
  const [newPrice, setNewPrice] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newPossession, setNewPossession] = useState('Ready to Move');
  const [newDescription, setNewDescription] = useState('');
  const [newNextStep, setNewNextStep] = useState('');
  const [submittingProp, setSubmittingProp] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch properties from /api/properties on open
  const loadProperties = async () => {
    setLoadingProps(true);
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      if (data.success && Array.isArray(data.properties)) {
        setProperties(data.properties);
        if (data.properties.length > 0 && !selectedProperty) {
          setSelectedProperty(data.properties[0]);
        }
      }
    } catch (err) {
      console.warn('Could not load properties from API:', err);
    } finally {
      setLoadingProps(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProperties();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInlineAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!newTitle.trim() || !newLocation.trim() || !newPrice.trim() || !newNearbyLocation.trim() || !newDescription.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please fill in Title, Location, Nearby Landmarks, Price, and Description.' });
      return;
    }

    setSubmittingProp(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          location: newLocation.trim(),
          nearbyLocation: newNearbyLocation.trim(),
          propertyType: newPropertyType,
          bhk: newBhk,
          listingType: newListingType,
          price: newPrice.trim(),
          size: newSize.trim() || undefined,
          possession: newPossession.trim(),
          description: newDescription.trim(),
          nextStep: newNextStep.trim() || `Would you like to schedule a site visit to ${newTitle.trim()} this weekend?`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save property.');
      }

      setFeedbackMsg({ type: 'success', text: 'Property added! The AI Agent now has instant access to this property with its description and nearby location.' });
      await loadProperties();

      // Reset form
      setNewTitle('');
      setNewLocation('');
      setNewNearbyLocation('');
      setNewPrice('');
      setNewSize('');
      setNewDescription('');
      setNewNextStep('');
      setIsAddingProperty(false);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error adding property.' });
    } finally {
      setSubmittingProp(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this property from the AI agent knowledge base?')) {
      return;
    }
    setDeleteId(id);
    try {
      const res = await fetch(`/api/properties?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProperties((prev) => prev.filter((p) => p.id !== id));
        if (selectedProperty?.id === id) {
          setSelectedProperty(properties.find((p) => p.id !== id) || null);
        }
      }
    } catch (e) {
      console.warn('Failed to delete property:', e);
    } finally {
      setDeleteId(null);
    }
  };

  const filteredProperties = properties.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.nearbyLocation?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.price.toLowerCase().includes(q) ||
      p.bhk?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Lyka Property Knowledge Base</h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Agent Accessible</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Grounding facts that the AI telecaller (Priya / Karthik) uses during customer calls.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Quick Add Button */}
        <div className="px-3 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('properties');
                setIsAddingProperty(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
                activeTab === 'properties'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Property Inventory ({properties.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('documents');
                setIsAddingProperty(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
                activeTab === 'documents'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>PDF Rules & Scenarios ({docs.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'properties' && (
              <button
                type="button"
                onClick={() => setIsAddingProperty(!isAddingProperty)}
                className="px-3 py-1.5 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 hover:from-emerald-400 hover:to-emerald-300 transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingProperty ? 'Close Form' : 'Add Property'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row text-xs">
          {activeTab === 'properties' ? (
            <>
              {/* Left Column: Properties List & Search */}
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 space-y-3 overflow-y-auto bg-slate-950/40 shrink-0 max-h-56 md:max-h-none">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by area, landmark, BHK..."
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Available Listings</span>
                  <span>{filteredProperties.length} items</span>
                </div>

                <div className="space-y-2">
                  {filteredProperties.map((p) => {
                    const isCustom = p.id.startsWith('prop_');
                    const isSelected = selectedProperty?.id === p.id && !isAddingProperty;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProperty(p);
                          setIsAddingProperty(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all relative group ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            {p.bhk || p.propertyType} • {p.listingType}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400">{p.price}</span>
                        </div>

                        <div className="font-bold text-xs text-white line-clamp-1">{p.title}</div>

                        <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-1">
                          <MapPin className="w-3 h-3 text-amber-400/80 shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </div>

                        {p.nearbyLocation && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-0.5">
                            <Compass className="w-3 h-3 text-emerald-400/80 shrink-0" />
                            <span className="truncate">{p.nearbyLocation}</span>
                          </div>
                        )}

                        {isCustom && (
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              Custom Added
                            </span>
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProperty(p.id);
                              }}
                              className="text-red-400 hover:text-red-300 p-1 opacity-80 hover:opacity-100"
                              title="Delete Property"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Add Property Form OR Selected Property Details */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
                {feedbackMsg && (
                  <div
                    className={`p-3 mb-4 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-200 ${
                      feedbackMsg.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}
                  >
                    {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    <span>{feedbackMsg.text}</span>
                  </div>
                )}

                {isAddingProperty ? (
                  /* Add Property Form */
                  <form onSubmit={handleInlineAddProperty} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-bold text-white text-sm">Add New Property to Agent Knowledge</h4>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Instant AI Access</span>
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                        Property Name / Title <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Marina Bay 3BHK Luxury Residence"
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px] flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>Primary Location / Area <span className="text-amber-400">*</span></span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="e.g. Besant Nagar, ECR, Anna Nagar"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px] flex items-center space-x-1">
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Nearby Location & Landmarks <span className="text-amber-400">*</span></span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newNearbyLocation}
                          onChange={(e) => setNewNearbyLocation(e.target.value)}
                          placeholder="e.g. 2 mins to Beach, 5 mins to Metro, near DLF IT Park"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Type</label>
                        <select
                          value={newPropertyType}
                          onChange={(e) => setNewPropertyType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                        >
                          <option value="Apartment">Apartment</option>
                          <option value="Villa">Villa</option>
                          <option value="Individual House">Individual House</option>
                          <option value="Plot">Plot / Land</option>
                          <option value="Commercial">Commercial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Configuration</label>
                        <select
                          value={newBhk}
                          onChange={(e) => setNewBhk(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                        >
                          <option value="1 BHK">1 BHK</option>
                          <option value="2 BHK">2 BHK</option>
                          <option value="3 BHK">3 BHK</option>
                          <option value="4 BHK">4 BHK</option>
                          <option value="Villa">Villa</option>
                          <option value="Plot">Plot</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Listing</label>
                        <select
                          value={newListingType}
                          onChange={(e) => setNewListingType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                        >
                          <option value="Buy">For Sale / Buy</option>
                          <option value="Rent">For Rent</option>
                          <option value="Plot">Plot</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                          Price <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          placeholder="e.g. ₹1.45 Cr"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Built-up Size</label>
                        <input
                          type="text"
                          value={newSize}
                          onChange={(e) => setNewSize(e.target.value)}
                          placeholder="e.g. 1650 sq ft"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Possession</label>
                        <input
                          type="text"
                          value={newPossession}
                          onChange={(e) => setNewPossession(e.target.value)}
                          placeholder="e.g. Ready to Move, Dec 2026"
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                        Detailed Description & Amenities <span className="text-amber-400">*</span>
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="e.g. East facing, 2 car parking, swimming pool, gym, 24/7 security, CMDA approved, bank loan pre-approved."
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                        Agent Next Question / Site Visit Offer
                      </label>
                      <input
                        type="text"
                        value={newNextStep}
                        onChange={(e) => setNewNextStep(e.target.value)}
                        placeholder="e.g. Site visit arrange pannalaama this weekend?"
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsAddingProperty(false)}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingProp}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold hover:from-emerald-400 hover:to-emerald-300 shadow-lg shadow-emerald-500/20"
                      >
                        {submittingProp ? 'Saving & Syncing...' : 'Save & Give Access to Agent'}
                      </button>
                    </div>
                  </form>
                ) : selectedProperty ? (
                  /* Selected Property Details View */
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            {selectedProperty.bhk || selectedProperty.propertyType} • {selectedProperty.listingType}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            {selectedProperty.price}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-white">{selectedProperty.title}</h4>
                      </div>

                      {selectedProperty.id.startsWith('prop_') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(selectedProperty.id)}
                          className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-slate-800 text-xs flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Property</span>
                        </button>
                      )}
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Location</span>
                        <span className="text-xs font-semibold text-white">{selectedProperty.location}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Configuration</span>
                        <span className="text-xs font-semibold text-white">{selectedProperty.bhk || selectedProperty.propertyType}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Built-up Size</span>
                        <span className="text-xs font-semibold text-white">{selectedProperty.size || 'Standard'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Possession</span>
                        <span className="text-xs font-semibold text-emerald-400">{selectedProperty.possession || 'Ready to Move'}</span>
                      </div>
                    </div>

                    {/* Nearby Location & Landmarks Callout */}
                    <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-500/30 space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                        <Compass className="w-3.5 h-3.5" />
                        <span>Nearby Locations, Landmarks & Connectivity</span>
                      </div>
                      <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                        {selectedProperty.nearbyLocation || 'Prime connectivity with direct road and transport access.'}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Property Description & Features</span>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 leading-relaxed text-xs">
                        {selectedProperty.description}
                      </div>
                    </div>

                    {/* Agent Spoken Next Question */}
                    <div className="p-3.5 bg-purple-950/20 border border-purple-500/30 rounded-xl text-purple-300 text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block">
                        Agent Site Visit Offer / Next Step
                      </span>
                      <p className="italic text-purple-200 font-medium">
                        "{selectedProperty.nextStep || 'Would you like to schedule a site visit this weekend?'}"
                      </p>
                    </div>

                    {/* AI Agent Status Pill */}
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Active in Agent Knowledge Base: When a customer asks about {selectedProperty.location} or its nearby landmarks, the AI agent will quote these exact details.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <Building2 className="w-10 h-10 opacity-30" />
                    <p>Select a property to view its details or click "Add Property".</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Documents Tab */
            <>
              <div className="w-full md:w-80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto bg-slate-950/40 shrink-0">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Grounding Documents ({docs.length})
                </div>

                <div className="space-y-2">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedDoc.id === doc.id
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
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-slate-900 space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">
                    {selectedDoc.category}
                  </span>
                  <h4 className="text-lg font-black text-white">{selectedDoc.title}</h4>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed text-xs">
                  {selectedDoc.content}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px] flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Knowledge Base Sync Active</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
