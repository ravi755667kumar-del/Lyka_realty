import React, { useState, useRef } from 'react';
import { PropertyListing, LeadProfile } from '../types/crm';
import { 
  Building2, 
  Search, 
  Filter, 
  MapPin, 
  Coins, 
  CheckCircle2, 
  Plus, 
  Calendar, 
  Home, 
  Sparkles, 
  Check,
  X,
  Upload,
  ImagePlus,
  Trash2
} from 'lucide-react';

interface PropertyInventoryProps {
  properties: PropertyListing[];
  currentLead: LeadProfile;
  onBookViewing: (property: PropertyListing) => void;
  onAddProperty: (property: PropertyListing) => void;
}

export const PropertyInventory: React.FC<PropertyInventoryProps> = ({
  properties,
  currentLead,
  onBookViewing,
  onAddProperty,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedCommunity, setSelectedCommunity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBeds, setSelectedBeds] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New property form state
  const [newTitle, setNewTitle] = useState('');
  const [newCity, setNewCity] = useState<'Dubai' | 'Mumbai'>('Dubai');
  const [newCommunity, setNewCommunity] = useState('Dubai Marina');
  const [newType, setNewType] = useState('Apartment');
  const [newBeds, setNewBeds] = useState('2');
  const [newPrice, setNewPrice] = useState(1800000);
  const [newStatus, setNewStatus] = useState<'Ready' | 'Off-plan'>('Ready');
  const [newDeveloper, setNewDeveloper] = useState('Emaar Properties');
  const [newSize, setNewSize] = useState(1200);
  const [newRoi, setNewRoi] = useState('7.8% net ROI');
  const [newImage, setNewImage] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newImageName, setNewImageName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Extra fields
  const [newContactName, setNewContactName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBathrooms, setNewBathrooms] = useState('2');
  const [newHasPool, setNewHasPool] = useState(false);
  const [newHasGym, setNewHasGym] = useState(false);
  const [newHasParking, setNewHasParking] = useState(false);
  const [newHasBalcony, setNewHasBalcony] = useState(false);
  const [newFurnished, setNewFurnished] = useState<'Furnished' | 'Unfurnished' | 'Semi-Furnished'>('Unfurnished');
  // NEW FIELDS
  const [newHandoverDate, setNewHandoverDate] = useState('');
  const [newPaymentPlan, setNewPaymentPlan] = useState('');
  const [newReraId, setNewReraId] = useState('');
  const [newListingDate, setNewListingDate] = useState('');
  const [newAvailableDate, setNewAvailableDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  const filteredProperties = properties.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.community.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.developer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCity = selectedCity === 'ALL' || (p.city || (p.id.startsWith('MUM') ? 'Mumbai' : 'Dubai')) === selectedCity;
    const matchesComm = selectedCommunity === 'ALL' || p.community === selectedCommunity;
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchesBeds = selectedBeds === 'ALL' || p.bedrooms === selectedBeds;

    return matchesSearch && matchesCity && matchesComm && matchesStatus && matchesBeds;
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setNewImage(base64);
      setNewImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    const amenities: string[] = [];
    if (newHasPool) amenities.push('Swimming Pool');
    if (newHasGym) amenities.push('Gym');
    if (newHasParking) amenities.push('Covered Parking');
    if (newHasBalcony) amenities.push('Balcony');
    amenities.push('Concierge 24/7');

    const prop: PropertyListing = {
      id: 'LYKA-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      title: newTitle,
      city: newCity,
      community: newCommunity,
      property_type: newType,
      bedrooms: newBeds,
      price_aed: Number(newPrice),
      price_inr: Math.round(Number(newPrice) * 22.8),
      status: newStatus,
      developer: newDeveloper,
      size_sqft: Number(newSize),
      expected_roi: newRoi,
      amenities,
      image_url: newImage,
      description: newDescription || `Premium ${newBeds}-bedroom listing in ${newCommunity} developed by ${newDeveloper}.`,
      features: [newFurnished, `${newBathrooms} Bathrooms`, 'High Rental Demand'],
      contact_name: newContactName,
      contact_mobile: newMobile,
      bathrooms: newBathrooms,
      furnished: newFurnished,
      handover_date: newHandoverDate || undefined,
      payment_plan: newPaymentPlan || undefined,
      rera_id: newReraId || undefined,
      listing_date: newListingDate || undefined,
      available_date: newAvailableDate || undefined,
      expiry_date: newExpiryDate || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddProperty(prop);
    setShowAddModal(false);
    // Reset all fields
    setNewTitle(''); setNewContactName(''); setNewMobile(''); setNewDescription('');
    setNewBathrooms('2'); setNewHasPool(false); setNewHasGym(false);
    setNewHasParking(false); setNewHasBalcony(false); setNewFurnished('Unfurnished');
    setNewHandoverDate(''); setNewPaymentPlan(''); setNewReraId('');
    setNewListingDate(''); setNewAvailableDate(''); setNewExpiryDate('');
    setNewImage(''); setNewImagePreview(''); setNewImageName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compatibility score with active lead
  const computeMatchScore = (prop: PropertyListing): number => {
    let score = 50;
    if (currentLead.preferred_communities?.includes(prop.community)) score += 25;
    if (currentLead.property_type && currentLead.property_type.toLowerCase() === prop.property_type.toLowerCase()) score += 15;
    if (currentLead.bedrooms && currentLead.bedrooms === prop.bedrooms) score += 10;
    if (currentLead.budget_max && prop.price_aed <= currentLead.budget_max) score += 10;
    return Math.min(99, score);
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden">
      {/* Top Filter Header */}
      <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-300 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>Verified Dubai Property Database</span>
            </h2>
            <p className="text-xs text-slate-400">
              Approved Lyka Realty listings across Dubai Marina, Downtown, Palm Jumeirah, Dubai Hills, and JVC.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-amber-950 px-3.5 py-2 rounded-xl transition-all font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Property Listing</span>
          </button>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <span className="text-xs text-slate-400 font-semibold mr-1">Region:</span>
          <button
            onClick={() => setSelectedCity('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              selectedCity === 'ALL'
                ? 'bg-amber-500 text-amber-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-800'
            }`}
          >
            All Portfolios ({properties.length})
          </button>
          <button
            onClick={() => setSelectedCity('Dubai')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              selectedCity === 'Dubai'
                ? 'bg-amber-500 text-amber-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-800'
            }`}
          >
            Dubai Properties
          </button>
          <button
            onClick={() => setSelectedCity('Mumbai')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              selectedCity === 'Mumbai'
                ? 'bg-amber-500 text-amber-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-800'
            }`}
          >
            Mumbai NRI Corridor
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, developer, community..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={selectedCommunity}
              onChange={(e) => setSelectedCommunity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500"
            >
              <option value="ALL">All Communities</option>
              <optgroup label="Dubai Communities">
                <option value="Dubai Marina">Dubai Marina</option>
                <option value="Downtown Dubai">Downtown Dubai</option>
                <option value="Palm Jumeirah">Palm Jumeirah</option>
                <option value="Business Bay">Business Bay</option>
                <option value="Dubai Hills Estate">Dubai Hills Estate</option>
                <option value="JVC">JVC</option>
                <option value="Dubai Creek Harbour">Dubai Creek Harbour</option>
                <option value="Arabian Ranches">Arabian Ranches</option>
                <option value="Dubai Islands">Dubai Islands</option>
                <option value="JLT">JLT</option>
              </optgroup>
              <optgroup label="Mumbai Localities">
                <option value="Worli">Worli</option>
                <option value="Bandra West">Bandra West</option>
                <option value="Juhu">Juhu</option>
                <option value="Powai">Powai</option>
                <option value="Lower Parel / Mahalaxmi">Lower Parel / Mahalaxmi</option>
                <option value="BKC (Bandra Kurla Complex)">BKC (Bandra Kurla)</option>
              </optgroup>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Ready">Ready to Move</option>
              <option value="Off-plan">Off-Plan with Payment Plan</option>
            </select>
          </div>

          <div>
            <select
              value={selectedBeds}
              onChange={(e) => setSelectedBeds(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500"
            >
              <option value="ALL">All Bedrooms</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3 Bedrooms</option>
              <option value="4">4+ Bedrooms</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((prop) => {
            const matchScore = computeMatchScore(prop);
            return (
              <div
                key={prop.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all shadow-md group flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={prop.image_url} 
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span className="bg-amber-500/90 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded shadow">
                        {prop.city || (prop.id.startsWith('MUM') ? 'Mumbai' : 'Dubai')}
                      </span>
                      <span className="bg-slate-900/90 backdrop-blur-md text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">
                        {prop.community}
                      </span>
                      <span className="bg-slate-900/90 backdrop-blur-md text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700">
                        {prop.status}
                      </span>
                      {prop.rera_id && (
                        <span className="bg-slate-900/90 backdrop-blur-md text-emerald-400 text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {prop.rera_id}
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 right-3 bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>{matchScore}% Match</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-baseline justify-between flex-wrap gap-1">
                      <div>
                        <span className="text-base font-extrabold text-amber-600">
                          AED {prop.price_aed.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                          (≈ ₹{((prop.price_inr || (prop.price_aed * 22.8)) / 10000000).toFixed(2)} Cr)
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {prop.bedrooms} Bed • {prop.size_sqft} sqft
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-300 text-sm leading-snug line-clamp-1 group-hover:text-amber-700 transition-colors">
                      {prop.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2">
                      {prop.description}
                    </p>

                    <div className="pt-2 flex flex-wrap gap-1">
                      {prop.amenities.slice(0, 3).map((am, i) => (
                        <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated Yield</span>
                      <span className="text-xs font-bold text-emerald-400">{prop.expected_roi || '7.5% net ROI'}</span>
                    </div>

                    <button
                      onClick={() => onBookViewing(prop)}
                      className="bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center space-x-1.5 shadow-sm"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book Viewing</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>Add Verified Property Listing</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">

              {/* Section: Contact Info */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">📞 Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="E.g., Ahmed Al Mansouri"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      placeholder="E.g., +971 50 123 4567"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section: Property Details */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">🏠 Property Details</p>

                <div>
                  <label className="text-slate-400 block mb-1">Listing Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="E.g., Marina Gate Luxury 2BR with Yacht Views"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Community</label>
                    <select
                      value={newCommunity}
                      onChange={(e) => setNewCommunity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Dubai Marina">Dubai Marina</option>
                      <option value="Downtown Dubai">Downtown Dubai</option>
                      <option value="Palm Jumeirah">Palm Jumeirah</option>
                      <option value="Business Bay">Business Bay</option>
                      <option value="Dubai Hills Estate">Dubai Hills Estate</option>
                      <option value="JVC">JVC</option>
                      <option value="Dubai Creek Harbour">Dubai Creek Harbour</option>
                      <option value="Arabian Ranches">Arabian Ranches</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Developer</label>
                    <input
                      type="text"
                      value={newDeveloper}
                      onChange={(e) => setNewDeveloper(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Property Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option>Apartment</option>
                      <option>Villa</option>
                      <option>Townhouse</option>
                      <option>Penthouse</option>
                      <option>Duplex</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Furnished Status</label>
                    <select
                      value={newFurnished}
                      onChange={(e) => setNewFurnished(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Furnished">Furnished</option>
                      <option value="Unfurnished">Unfurnished</option>
                      <option value="Semi-Furnished">Semi-Furnished</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Rooms & Size */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">🛏 Rooms & Size</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Bedrooms</label>
                    <select
                      value={newBeds}
                      onChange={(e) => setNewBeds(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Studio">Studio</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Bathrooms</label>
                    <select
                      value={newBathrooms}
                      onChange={(e) => setNewBathrooms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Size (sqft)</label>
                    <input
                      type="number"
                      value={newSize}
                      onChange={(e) => setNewSize(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Ready">Ready</option>
                      <option value="Off-plan">Off-plan</option>
                    </select>
                  </div>
                </div>

                {/* Date Information */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Listing Date</label>
                    <input
                      type="date"
                      value={newListingDate}
                      onChange={(e) => setNewListingDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Available From</label>
                    <input
                      type="date"
                      value={newAvailableDate}
                      onChange={(e) => setNewAvailableDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

              {/* Handover Date (for off-plan) */}
                {newStatus === 'Off-plan' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Handover Date</label>
                      <input
                        type="date"
                        value={newHandoverDate}
                        onChange={(e) => setNewHandoverDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Payment Plan</label>
                      <input
                        type="text"
                        value={newPaymentPlan}
                        onChange={(e) => setNewPaymentPlan(e.target.value)}
                        placeholder="E.g., 10/20/30/40 or Post-handover"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* RERA ID */}
                <div>
                  <label className="text-slate-400 block mb-1">RERA ID (Optional)</label>
                  <input
                    type="text"
                    value={newReraId}
                    onChange={(e) => setNewReraId(e.target.value)}
                    placeholder="E.g., RERA-12345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Section: Amenities */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">✨ Amenities & Features</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '🏊 Swimming Pool', value: newHasPool, setter: setNewHasPool },
                    { label: '🏋️ Gym', value: newHasGym, setter: setNewHasGym },
                    { label: '🚗 Parking', value: newHasParking, setter: setNewHasParking },
                    { label: '🌇 Balcony', value: newHasBalcony, setter: setNewHasBalcony },
                  ].map(({ label, value, setter }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setter(!value)}
                      className={`flex items-center justify-center space-x-1.5 px-2 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
                        value
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {value && <Check className="w-3 h-3" />}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section: Pricing */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">💰 Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Price (AED)</label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Expected ROI</label>
                    <input
                      type="text"
                      value={newRoi}
                      onChange={(e) => setNewRoi(e.target.value)}
                      placeholder="E.g., 7.8% net ROI"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Description */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">📝 Description</p>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the property — layout, views, finishing quality, nearby landmarks, payment plan, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Section: Photo Upload */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">📷 Property Photo</p>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {newImagePreview ? (
                  /* Preview of uploaded image */
                  <div className="relative rounded-xl overflow-hidden border border-slate-700">
                    <img
                      src={newImagePreview}
                      alt="Property preview"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-end">
                      <div className="w-full px-3 py-2 flex items-center justify-between bg-slate-950/70 backdrop-blur-sm">
                        <span className="text-[10px] text-slate-300 truncate max-w-[180px]">{newImageName}</span>
                        <button
                          type="button"
                          onClick={() => { setNewImage(''); setNewImagePreview(''); setNewImageName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="flex items-center space-x-1 text-[10px] bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-0.5 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Upload drop zone */
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center space-y-2 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-amber-500/10 flex items-center justify-center transition-colors">
                      <ImagePlus className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 text-xs font-semibold group-hover:text-amber-400">Click to upload photo</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">JPG, PNG, WEBP supported</p>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-lg">
                      <Upload className="w-3 h-3" />
                      <span>Browse Files</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2 rounded-xl font-bold shadow-md"
                >
                  Publish Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
