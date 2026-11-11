import React, { useState } from 'react';
import { X, Building2, MapPin, Compass, IndianRupee, Tag, CheckCircle2, Sparkles, Layers, ShieldCheck, Info } from 'lucide-react';
import { PropertyItem } from '../types';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPropertyAdded?: (newProp: PropertyItem) => void;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onPropertyAdded,
}) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [nearbyLocation, setNearbyLocation] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bhk, setBhk] = useState('2 BHK');
  const [listingType, setListingType] = useState('Buy');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [possession, setPossession] = useState('Ready to Move');
  const [description, setDescription] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a property title or name.');
      return;
    }
    if (!location.trim()) {
      setErrorMsg('Please enter the property location (e.g., ECR, Velachery, Besant Nagar).');
      return;
    }
    if (!price.trim()) {
      setErrorMsg('Please enter the price or rent (e.g., ₹85 Lakhs or ₹30,000 / month).');
      return;
    }
    if (!nearbyLocation.trim()) {
      setErrorMsg('Please specify nearby locations or landmarks (e.g., Near Metro, 5 mins to Beach, IT park).');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please enter a description of the property features.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<PropertyItem> = {
        title: title.trim(),
        location: location.trim(),
        nearbyLocation: nearbyLocation.trim(),
        propertyType,
        bhk,
        listingType,
        price: price.trim(),
        size: size.trim() || undefined,
        possession: possession.trim(),
        description: description.trim(),
        nextStep: nextStep.trim() || `Would you like to schedule a site visit to ${title.trim()} this weekend?`,
      };

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to add property.');
      }

      const createdProp = data.property as PropertyItem;

      // Update client-side localStorage cache so offline / browser turns also know about it
      try {
        const stored = localStorage.getItem('lyka_custom_properties');
        const list: PropertyItem[] = stored ? JSON.parse(stored) : [];
        list.unshift(createdProp);
        localStorage.setItem('lyka_custom_properties', JSON.stringify(list));
      } catch (lsErr) {
        console.warn('LocalStorage property cache note:', lsErr);
      }

      setSuccessMsg('Property added successfully! The AI Agent now has full access to this property with its description and nearby location.');
      if (onPropertyAdded) {
        onPropertyAdded(createdProp);
      }

      // Reset form fields
      setTimeout(() => {
        setTitle('');
        setLocation('');
        setNearbyLocation('');
        setPrice('');
        setSize('');
        setDescription('');
        setNextStep('');
        setIsSubmitting(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error adding property.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
                <span>Add Property to AI Knowledge</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live AI Access
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                The AI Agent will immediately use this property during calls.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center space-x-2 animate-in fade-in duration-200">
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* AI Live Sync Callout Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-emerald-500/10 border border-amber-500/20 flex items-start space-x-2.5 text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-300">Instant AI Telecaller Knowledge Integration</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When a lead asks about locations, nearby landmarks, or pricing, Priya / Karthik will recommend this property using your description and suggest a site visit.
              </p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
              Property Name / Title <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Marina Bay 3BHK Luxury Residence"
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Location & Nearby Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Primary Location / Area <span className="text-amber-400">*</span></span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Besant Nagar, ECR, Anna Nagar, Velachery"
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
                value={nearbyLocation}
                onChange={(e) => setNearbyLocation(e.target.value)}
                placeholder="e.g. 2 mins to Beach, 5 mins to Metro, near DLF IT Park & School"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Agent uses this when customer asks: "distance evlo?", "nearby metro irukka?", etc.
              </span>
            </div>
          </div>

          {/* Type, BHK, Listing Type, Price */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Property Type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="Apartment">Apartment</option>
                <option value="Villa">Villa</option>
                <option value="Individual House">Individual House</option>
                <option value="Plot">Residential Plot</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Configuration</label>
              <select
                value={bhk}
                onChange={(e) => setBhk(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK">2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4 BHK">4 BHK</option>
                <option value="5+ BHK">5+ BHK</option>
                <option value="Villa">Luxury Villa</option>
                <option value="Plot">Plot / Land</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Listing Type</label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="Buy">For Sale / Buy</option>
                <option value="Rent">For Rent</option>
                <option value="Plot">Land / Plot</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                Price / Rent <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. ₹1.25 Cr or ₹25,000/mo"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Size & Possession */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Built-up Size / Area</label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 1450 sq ft or 1200 sq ft plot"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Possession / Timeline</label>
              <input
                type="text"
                value={possession}
                onChange={(e) => setPossession(e.target.value)}
                placeholder="e.g. Ready to Move, Dec 2026, Immediate"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-[11px] flex items-center justify-between">
              <span>Detailed Description & Features <span className="text-amber-400">*</span></span>
              <span className="text-[10px] text-slate-500 font-normal">Mention facing, parking, legal approval (CMDA/RERA), amenities</span>
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. East facing, 2 covered car parking, lift, swimming pool, clubhouse, 24/7 security. 100% CMDA & TN RERA approved. Partner bank loan facility available from SBI and HDFC."
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-amber-500 font-sans"
            />
          </div>

          {/* Next Step / Offer Question */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
              Agent Follow-up Question / Call to Action
            </label>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="e.g. Site visit arrange pannalaama this weekend?"
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800">
            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auto-synced to Gemini, Groq & OpenAI RAG</span>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold hover:from-amber-400 hover:to-amber-300 transition-all flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Syncing with Agent...' : 'Save & Give Access to Agent'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
