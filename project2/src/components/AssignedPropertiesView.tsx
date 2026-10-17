import React, { useState } from 'react';
import { PropertyListing } from '../types/crm';
import { 
  Building2, 
  CheckCircle2, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  User, 
  X, 
  AlertCircle, 
  Check, 
  RotateCcw,
  Sparkles,
  Lock,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  Tag,
  MapPin,
  Bed,
  Maximize2,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';

interface AssignedPropertiesViewProps {
  properties: PropertyListing[];
  canManageBookings?: boolean;
  onBookProperty: (propertyId: string, details: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    bookingAmount?: number;
    notes?: string;
  }) => Promise<void> | void;
  onUnbookProperty: (propertyId: string) => Promise<void> | void;
}

export const AssignedPropertiesView: React.FC<AssignedPropertiesViewProps> = ({
  properties,
  canManageBookings = true,
  onBookProperty,
  onUnbookProperty,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [communityFilter, setCommunityFilter] = useState('ALL');
  const [activeViewTab, setActiveViewTab] = useState<'available' | 'booked' | 'all'>('available');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [bookingAmount, setBookingAmount] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Property picker dropdown toggle & search inside modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Available properties that can be booked
  const availableProperties = properties.filter(
    p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
  );

  // Booked / assigned properties
  const bookedProperties = properties.filter(
    p => p.is_booked === true || (p.status || '').toLowerCase() === 'booked'
  );

  // Extract all unique communities for filter dropdown
  const allCommunities = Array.from(new Set(properties.map(p => p.community).filter(Boolean)));

  // Filtered available properties
  const filteredAvailable = availableProperties.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      (p.title || '').toLowerCase().includes(term) ||
      (p.community || '').toLowerCase().includes(term) ||
      (p.property_type || '').toLowerCase().includes(term) ||
      (p.bedrooms || '').toString().includes(term) ||
      (p.price_aed || '').toString().includes(term);
    const matchComm = communityFilter === 'ALL' || p.community === communityFilter;
    return matchSearch && matchComm;
  });

  // Filtered booked properties
  const filteredBooked = bookedProperties.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchTitle = (p.title || '').toLowerCase().includes(term);
    const matchComm = (p.community || '').toLowerCase().includes(term);
    const matchClient = (p.assigned_to || '').toLowerCase().includes(term);
    const matchPhone = (p.assigned_phone || '').includes(term);
    const matchRef = (p.booking_id || '').toLowerCase().includes(term);
    const matchCommFilter = communityFilter === 'ALL' || p.community === communityFilter;
    return (matchTitle || matchComm || matchClient || matchPhone || matchRef) && matchCommFilter;
  });

  const totalBookedValue = bookedProperties.reduce((sum, p) => sum + (Number(p.price_aed) || 0), 0);
  const totalTokenAmount = bookedProperties.reduce((sum, p) => sum + (Number(p.booking_amount_aed) || 0), 0);

  // Currently selected property object in the modal
  const selectedPropertyObj = properties.find(p => p.id === selectedPropId);

  // Filtered available properties for picker search inside modal
  const filteredAvailableForPicker = availableProperties.filter(p => {
    if (!pickerSearch.trim()) return true;
    const term = pickerSearch.toLowerCase();
    return (
      (p.title || '').toLowerCase().includes(term) ||
      (p.community || '').toLowerCase().includes(term) ||
      (p.property_type || '').toLowerCase().includes(term) ||
      (p.bedrooms || '').toString().includes(term) ||
      (p.price_aed || '').toString().includes(term)
    );
  });

  // Open modal directly for a specific property clicked in the list area
  const handleOpenBookingForProperty = (propId: string) => {
    setSelectedPropId(propId);
    setErrorBanner(null);
    setPickerOpen(false);
    setPickerSearch('');
    setShowAssignModal(true);
  };

  const handleApplyBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBookings) {
      setErrorBanner('Super Admin has View-Only access. Only Property Admin can book or assign properties.');
      return;
    }
    if (!selectedPropId) {
      setErrorBanner('Please select a property to assign.');
      return;
    }
    if (!clientName.trim()) {
      setErrorBanner('Please enter the client / customer name.');
      return;
    }
    if (!clientPhone.trim()) {
      setErrorBanner('Please enter the customer mobile number.');
      return;
    }

    setActionLoading(true);
    setErrorBanner(null);
    try {
      await onBookProperty(selectedPropId, {
        customerName: clientName.trim(),
        customerPhone: clientPhone.trim(),
        customerEmail: clientEmail.trim(),
        bookingAmount: Number(bookingAmount) || 0,
        notes: bookingNotes.trim()
      });

      const bookedTarget = properties.find(p => p.id === selectedPropId);
      setSuccessBanner(
        `Property "${bookedTarget?.title || selectedPropId}" successfully BOOKED & assigned to ${clientName}! It will NO LONGER be recommended by the AI Chatbot.`
      );
      setShowAssignModal(false);
      // Switch to booked tab to see the confirmed booking
      setActiveViewTab('booked');
      // Reset form
      setSelectedPropId('');
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setBookingAmount('');
      setBookingNotes('');
      setPickerOpen(false);
      setPickerSearch('');
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not complete booking.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseBooking = async (propertyId: string, title: string) => {
    if (!canManageBookings) {
      setErrorBanner('Super Admin has View-Only access. Only Property Admin can cancel or release bookings.');
      return;
    }
    if (!confirm(`Are you sure you want to cancel booking for "${title}" and make it AVAILABLE again?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await onUnbookProperty(propertyId);
      setSuccessBanner(`Booking for "${title}" has been cancelled. Property is now AVAILABLE and can be recommended by the AI Chatbot.`);
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not cancel booking.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner / Notification */}
      {successBanner && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button 
            onClick={() => setSuccessBanner(null)} 
            className="text-emerald-700 hover:text-emerald-950 ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="bg-rose-500/15 border border-rose-500/40 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-700 hover:text-rose-950 ml-2 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-300 flex items-center space-x-2">
                <span>Assign & Booked Properties</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                  {bookedProperties.length} Booked
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 border border-amber-500/30">
                  {availableProperties.length} Available
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Click any available property in the list area below to assign or book it. Once booked, it is automatically locked and excluded from AI Chatbot recommendations.
              </p>
            </div>
          </div>
        </div>

        {canManageBookings && (
          <button
            onClick={() => {
              setErrorBanner(null);
              setSelectedPropId(availableProperties[0]?.id || '');
              setShowAssignModal(true);
            }}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Book / Assign Property</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Inventory</p>
          <p className="text-2xl font-bold text-slate-300 mt-1">{properties.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">All registered units</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available For Sale</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{availableProperties.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Active in AI Chatbot</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Booked / Assigned</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{bookedProperties.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Excluded from Chatbot</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Booked Volume (AED)</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">
            {totalBookedValue >= 1_000_000 
              ? `${(totalBookedValue / 1_000_000).toFixed(2)}M` 
              : totalBookedValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Token: AED {totalTokenAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── LIST AREA NAVIGATION TABS ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Tab Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveViewTab('available')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeViewTab === 'available'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
            }`}
          >
            <span>🟢 Available Properties to Book</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeViewTab === 'available' ? 'bg-emerald-800/50 text-white' : 'bg-emerald-500/20 text-emerald-700'
            }`}>
              {availableProperties.length}
            </span>
          </button>

          <button
            onClick={() => setActiveViewTab('booked')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeViewTab === 'booked'
                ? 'bg-amber-500 text-amber-950 shadow-sm'
                : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Booked / Assigned Units</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeViewTab === 'booked' ? 'bg-amber-950/40 text-amber-950' : 'bg-amber-500/20 text-amber-800'
            }`}>
              {bookedProperties.length}
            </span>
          </button>

          <button
            onClick={() => setActiveViewTab('all')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeViewTab === 'all'
                ? 'bg-slate-800 text-slate-300 border border-slate-700 shadow-sm'
                : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
            }`}
          >
            <span>All Units ({properties.length})</span>
          </button>
        </div>

        {/* Community filter selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 hidden sm:inline">Community:</span>
          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            style={{ backgroundColor: '#ffffff', color: '#463726' }}
          >
            <option value="ALL">All Communities ({allCommunities.length})</option>
            {allCommunities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeViewTab === 'available'
                ? "Search available properties by title, community, bedrooms, price..."
                : "Search by property, community, client name, or booking ref..."
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
            style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
          />
        </div>

        <span className="text-xs text-slate-500 hidden sm:inline">
          {activeViewTab === 'available' && (
            <>Showing <strong className="text-slate-300 font-bold">{filteredAvailable.length}</strong> of {availableProperties.length} available to book</>
          )}
          {activeViewTab === 'booked' && (
            <>Showing <strong className="text-slate-300 font-bold">{filteredBooked.length}</strong> of {bookedProperties.length} booked properties</>
          )}
          {activeViewTab === 'all' && (
            <>Showing <strong className="text-slate-300 font-bold">{filteredAvailable.length + filteredBooked.length}</strong> units</>
          )}
        </span>
      </div>

      {/* ── SECTION 1: AVAILABLE PROPERTIES LIST AREA (CLICK TO BOOK) ───────── */}
      {activeViewTab === 'available' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Available Properties List (Click to Book)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Click <strong>"Book This Property"</strong> on any unit. Once booked, it will immediately move to the Booked section and will <strong>NOT be recommended during AI Chat</strong>.
              </p>
            </div>
          </div>

          {filteredAvailable.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAvailable.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-500/60 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Image with Available status pill */}
                    <div className="relative h-44 w-full bg-slate-800 overflow-hidden">
                      <img 
                        src={prop.image_url} 
                        alt={prop.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      
                      <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-md">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>AVAILABLE TO BOOK</span>
                      </div>

                      <div className="absolute top-3 right-3 bg-slate-900/90 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-700">
                        {prop.community}
                      </div>

                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">
                        <span className="text-white font-bold truncate max-w-[70%] drop-shadow">{prop.title}</span>
                        <span className="text-amber-400 font-extrabold drop-shadow">AED {Number(prop.price_aed).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Property Specs Body */}
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Specs:</span>
                        <span className="text-slate-300 font-semibold">{prop.bedrooms} Bed • {prop.size_sqft} sqft • {prop.property_type}</span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {prop.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                        <span className="text-slate-500">Expected ROI:</span>
                        <span className="font-bold text-emerald-600">{prop.expected_roi || '7.5% net ROI'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Click to Book Button */}
                  {canManageBookings && (
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => handleOpenBookingForProperty(prop.id)}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer group-hover:bg-emerald-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>⚡ Book / Assign This Property</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-slate-400 opacity-50" />
              <h4 className="text-sm font-bold text-slate-300">No Available Properties Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No properties match your search term or all properties have been booked.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: BOOKED PROPERTIES LIST AREA ─────────────────────────── */}
      {activeViewTab === 'booked' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Booked & Assigned Properties ({bookedProperties.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                These properties have been secured by clients and are <strong>EXCLUDED from AI Chatbot recommendations</strong>.
              </p>
            </div>
          </div>

          {filteredBooked.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBooked.map((prop) => (
                <div 
                  key={prop.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-slate-700 transition-all flex flex-col"
                >
                  {/* Image & Booking Tag */}
                  <div className="relative h-44 w-full bg-slate-800 overflow-hidden">
                    <img 
                      src={prop.image_url} 
                      alt={prop.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    
                    {/* Booked Badge */}
                    <div className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-md">
                      <Lock className="w-3 h-3" />
                      <span>BOOKED / LOCKED</span>
                    </div>

                    {prop.booking_id && (
                      <div className="absolute top-3 right-3 bg-slate-900 text-slate-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-slate-700">
                        {prop.booking_id}
                      </div>
                    )}

                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">
                      <span className="text-white font-bold truncate max-w-[70%] drop-shadow">{prop.title}</span>
                      <span className="text-amber-400 font-extrabold drop-shadow">AED {Number(prop.price_aed).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Booking & Client Details Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Community / Type:</span>
                        <span className="text-slate-300 font-semibold">{prop.community} • {prop.bedrooms} BR</span>
                      </div>

                      {/* Assigned Client Card */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>Assigned Client</span>
                          </span>
                          {prop.booked_at && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {new Date(prop.booked_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-slate-300">
                          {prop.assigned_to || 'Confidential Client'}
                        </p>

                        <div className="flex items-center space-x-3 text-xs text-slate-400">
                          {prop.assigned_phone && (
                            <a 
                              href={`tel:${prop.assigned_phone}`}
                              className="flex items-center space-x-1 text-slate-400 hover:text-emerald-600 transition-colors"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{prop.assigned_phone}</span>
                            </a>
                          )}
                          {prop.assigned_email && (
                            <a 
                              href={`mailto:${prop.assigned_email}`}
                              className="flex items-center space-x-1 text-slate-400 hover:text-emerald-600 transition-colors truncate"
                            >
                              <Mail className="w-3 h-3 text-emerald-600" />
                              <span className="truncate">{prop.assigned_email}</span>
                            </a>
                          )}
                        </div>

                        {prop.booking_amount_aed ? (
                          <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Advance / Token:</span>
                            <span className="font-bold text-emerald-600">AED {Number(prop.booking_amount_aed).toLocaleString()}</span>
                          </div>
                        ) : null}

                        {prop.booking_notes && (
                          <div className="text-[11px] text-slate-500 bg-slate-900 p-2 rounded-lg italic border border-slate-800">
                            "{prop.booking_notes}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] text-amber-700 flex items-center space-x-1 font-semibold">
                        <span>🔒 Excluded from Chatbot</span>
                      </span>

                      {canManageBookings && (
                        <button
                          onClick={() => handleReleaseBooking(prop.id, prop.title)}
                          disabled={actionLoading}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500 hover:bg-rose-950/30 transition-all flex items-center space-x-1 cursor-pointer"
                          title="Cancel booking and restore property to available status in AI Chatbot"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Cancel Booking</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <Lock className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-300">No Properties Currently Booked</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All properties are currently open and available in the AI Chatbot. When you assign or book a property for a client here, it will be automatically locked and hidden from chatbot recommendations.
                </p>
              </div>
              <button
                onClick={() => setActiveViewTab('available')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <span>Browse Available Units & Book</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 3: ALL INVENTORY VIEW ──────────────────────────────────── */}
      {activeViewTab === 'all' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((prop) => {
              const isBooked = prop.is_booked || (prop.status || '').toLowerCase() === 'booked';
              return (
                <div
                  key={prop.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="relative h-40 w-full bg-slate-800 overflow-hidden">
                    <img src={prop.image_url} alt={prop.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      {isBooked ? (
                        <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow">
                          <Lock className="w-3 h-3" />
                          <span>BOOKED</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>AVAILABLE</span>
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">
                      <span className="text-white font-bold truncate max-w-[70%] drop-shadow">{prop.title}</span>
                      <span className="text-amber-400 font-extrabold drop-shadow">AED {Number(prop.price_aed).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{prop.community} • {prop.bedrooms} Bed</span>
                      <span className={isBooked ? 'text-amber-700 font-semibold' : 'text-emerald-600 font-semibold'}>
                        {isBooked ? `Assigned to: ${prop.assigned_to || 'Client'}` : 'Open in Chatbot'}
                      </span>
                    </div>

                    {canManageBookings && (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
                        {isBooked ? (
                          <button
                            onClick={() => handleReleaseBooking(prop.id, prop.title)}
                            className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1 rounded-lg border border-rose-500/30 hover:border-rose-500 cursor-pointer"
                          >
                            Cancel Booking
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenBookingForProperty(prop.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            Book Unit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Assign / Book Property Modal ────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">Book & Assign Property</h3>
                  <p className="text-[11px] text-slate-500">Property will be marked as Booked and hidden from Chatbot</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAssignModal(false);
                  setPickerOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Property Preview Banner */}
            {selectedPropertyObj && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 flex items-center space-x-3">
                <img 
                  src={selectedPropertyObj.image_url} 
                  alt={selectedPropertyObj.title} 
                  className="w-16 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-800"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-300 truncate">{selectedPropertyObj.title}</p>
                  <p className="text-[10px] text-slate-500">{selectedPropertyObj.community} • {selectedPropertyObj.bedrooms} BR {selectedPropertyObj.property_type}</p>
                  <p className="text-xs font-extrabold text-amber-700 mt-0.5">AED {Number(selectedPropertyObj.price_aed).toLocaleString()}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 flex-shrink-0">
                  Ready to Book
                </span>
              </div>
            )}

            <form onSubmit={handleApplyBooking} className="space-y-4">
              {/* Select Property with Interactive Picker */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                  <span>Selected Property Unit *</span>
                  <span className="text-[10px] text-emerald-600 font-bold">{availableProperties.length} available</span>
                </label>

                {/* Custom Interactive Dropdown Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(prev => !prev)}
                    className="w-full text-left bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 flex items-center justify-between hover:border-emerald-500 transition-all shadow-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                    style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                  >
                    {selectedPropertyObj ? (
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-slate-300">{selectedPropertyObj.title}</span>
                          <span className="text-slate-500 ml-1.5">({selectedPropertyObj.community} • {selectedPropertyObj.bedrooms} BR)</span>
                          <span className="text-amber-700 font-extrabold ml-2">AED {Number(selectedPropertyObj.price_aed).toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 font-medium">-- Click to choose an available property --</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ml-2 flex-shrink-0 ${pickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {pickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-2 max-h-72 flex flex-col backdrop-blur-lg">
                      {/* Search box inside dropdown */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Search property, community, beds..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                        />
                      </div>

                      {/* Property Items List */}
                      <div className="overflow-y-auto space-y-1 flex-1 max-h-56 pr-1">
                        {filteredAvailableForPicker.length > 0 ? (
                          filteredAvailableForPicker.map(p => {
                            const isSelected = p.id === selectedPropId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPropId(p.id);
                                  setPickerOpen(false);
                                  setPickerSearch('');
                                }}
                                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between text-xs cursor-pointer ${
                                  isSelected 
                                    ? 'bg-emerald-500/15 border-emerald-500 text-slate-300 font-bold'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                                }`}
                                style={{ color: '#463726' }}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-bold text-slate-300 truncate">{p.title}</p>
                                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                                    <span>{p.community}</span>
                                    <span>•</span>
                                    <span>{p.bedrooms} BR {p.property_type}</span>
                                    <span>•</span>
                                    <span className="font-bold text-amber-700">AED {Number(p.price_aed).toLocaleString()}</span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-500">
                            No properties matching "{pickerSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Standard native select with high-contrast text & background */}
                <select
                  required
                  value={selectedPropId}
                  onChange={(e) => setSelectedPropId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-500 mt-1 cursor-pointer"
                  style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                >
                  <option value="" style={{ backgroundColor: '#ffffff', color: '#463726' }}>
                    -- Or Select from Standard Dropdown --
                  </option>
                  {availableProperties.map(p => (
                    <option 
                      key={p.id} 
                      value={p.id} 
                      style={{ backgroundColor: '#ffffff', color: '#463726' }}
                      className="bg-white text-slate-900 py-1 font-semibold"
                    >
                      {p.title} • {p.community} ({p.bedrooms} BR) — AED {Number(p.price_aed).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Client / Buyer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Client Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="e.g. +971 50 123 4567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                  />
                </div>
              </div>

              {/* Client Email & Token Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Client Email (Optional)</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="e.g. client@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Booking Advance / Token (AED)</label>
                  <input
                    type="number"
                    value={bookingAmount}
                    onChange={(e) => setBookingAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Booking Remarks / Terms</label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g. 10% token deposit received. Sale deed agreement scheduled for next Monday."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-medium"
                  style={{ backgroundColor: '#fdfbf5', color: '#463726' }}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setPickerOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <span>Applying Booking...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply & Book Property</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
