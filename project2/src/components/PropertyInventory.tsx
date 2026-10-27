import { csvCell, downloadCSV } from '../lib/csv';
import React, { useState, useRef } from 'react';
import { PropertyListing, LeadProfile } from '../types/crm';
import { 
  Building2, 
  Search, 
  Filter, 
  MapPin, 
  Coins, 
  CheckCircle2,
  Download, 
  Plus, 
  Calendar, 
  Home, 
  Sparkles, 
  Check,
  X,
  Upload,
  ImagePlus,
  Trash2,
  Lock,
  Edit3,
  Save,
  ShieldCheck,
  CreditCard,
  Phone,
  User,
  AlertCircle,
  BadgeCheck,
  Shield
} from 'lucide-react';

interface PropertyInventoryProps {
  properties: PropertyListing[];
  currentLead: LeadProfile;
  onBookViewing: (property: PropertyListing) => void;
  onAddProperty: (property: PropertyListing) => void;
  onUpdateProperty?: (property: PropertyListing) => void;
  canAddProperty?: boolean;
}

export const PropertyInventory: React.FC<PropertyInventoryProps> = ({
  properties,
  currentLead,
  onBookViewing,
  onAddProperty,
  onUpdateProperty,
  canAddProperty = true,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedCommunity, setSelectedCommunity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBeds, setSelectedBeds] = useState<string>('ALL');
  const [selectedVerification, setSelectedVerification] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyListing | null>(null);

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

  // Admin Verification state (Required for adding property & legal compliance)
  const [newAdminName, setNewAdminName] = useState('Farhan Qureshi (Property Admin)');
  const [newAdminMobile, setNewAdminMobile] = useState('+971 50 892 4110');
  const [newAdminIdCard, setNewAdminIdCard] = useState('784-1990-1234567-1');
  const [newAdminIdType, setNewAdminIdType] = useState<string>('Emirates ID');
  const [addValidationError, setAddValidationError] = useState('');
  const [addSuccessMsg, setAddSuccessMsg] = useState('');
  const [isAddingProperty, setIsAddingProperty] = useState(false);

  // Edit property form state
  const [editTitle, setEditTitle] = useState('');
  const [editCity, setEditCity] = useState<'Dubai' | 'Mumbai'>('Dubai');
  const [editCommunity, setEditCommunity] = useState('Dubai Marina');
  const [editType, setEditType] = useState('Apartment');
  const [editBeds, setEditBeds] = useState('2');
  const [editPrice, setEditPrice] = useState(1800000);
  const [editStatus, setEditStatus] = useState<string>('Ready');
  const [editDeveloper, setEditDeveloper] = useState('');
  const [editSize, setEditSize] = useState(1200);
  const [editRoi, setEditRoi] = useState('7.8% net ROI');
  const [editImage, setEditImage] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editImageName, setEditImageName] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBathrooms, setEditBathrooms] = useState('2');
  const [editHasPool, setEditHasPool] = useState(false);
  const [editHasGym, setEditHasGym] = useState(false);
  const [editHasParking, setEditHasParking] = useState(false);
  const [editHasBalcony, setEditHasBalcony] = useState(false);
  const [editFurnished, setEditFurnished] = useState<'Furnished' | 'Unfurnished' | 'Semi-Furnished'>('Unfurnished');
  const [editHandoverDate, setEditHandoverDate] = useState('');
  const [editPaymentPlan, setEditPaymentPlan] = useState('');
  const [editReraId, setEditReraId] = useState('');
  const [editListingDate, setEditListingDate] = useState('');
  const [editAvailableDate, setEditAvailableDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminMobile, setEditAdminMobile] = useState('');
  const [editAdminIdCard, setEditAdminIdCard] = useState('');
  const [editAdminIdType, setEditAdminIdType] = useState<string>('Emirates ID');
  const [editAdminVerified, setEditAdminVerified] = useState(true);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  const handleOpenEditModal = (prop: PropertyListing) => {
    setEditingProperty(prop);
    setEditTitle(prop.title || '');
    setEditCity(((prop.city as any) || (prop.id.startsWith('MUM') ? 'Mumbai' : 'Dubai')));
    setEditCommunity(prop.community || 'Dubai Marina');
    setEditType(prop.property_type || 'Apartment');
    setEditBeds(prop.bedrooms || '2');
    setEditPrice(prop.price_aed || 0);
    setEditStatus(prop.status || 'Ready');
    setEditDeveloper(prop.developer || '');
    setEditSize(prop.size_sqft || 0);
    setEditRoi(prop.expected_roi || '7.5% net ROI');
    setEditImage(prop.image_url || '');
    setEditImagePreview(prop.image_url || '');
    setEditImageName('');
    setEditContactName(prop.contact_name || '');
    setEditMobile(prop.contact_mobile || '');
    setEditDescription(prop.description || '');
    setEditBathrooms(prop.bathrooms || '2');
    setEditFurnished((prop.furnished as any) || 'Unfurnished');
    setEditHandoverDate(prop.handover_date || '');
    setEditPaymentPlan(prop.payment_plan || '');
    setEditReraId(prop.rera_id || '');
    setEditListingDate(prop.listing_date || '');
    setEditAvailableDate(prop.available_date || '');
    setEditExpiryDate(prop.expiry_date || '');
    setEditAdminName(prop.admin_verification_name || prop.contact_name || 'Farhan Qureshi (Property Admin)');
    setEditAdminMobile(prop.admin_verification_mobile || prop.contact_mobile || '+971 50 892 4110');
    setEditAdminIdCard(prop.admin_verification_id_card || '784-1990-1234567-1');
    setEditAdminIdType(prop.admin_verification_id_type || (prop.city === 'Mumbai' ? 'Aadhaar Card' : 'Emirates ID'));
    setEditAdminVerified(prop.admin_verified ?? true);

    const ams = prop.amenities || [];
    setEditHasPool(ams.some(a => /pool/i.test(a)));
    setEditHasGym(ams.some(a => /gym/i.test(a)));
    setEditHasParking(ams.some(a => /parking/i.test(a)));
    setEditHasBalcony(ams.some(a => /balcony/i.test(a)));
    setEditSuccessMsg('');
    setShowEditModal(true);
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setEditImage(compressed);
          setEditImagePreview(compressed);
        } else {
          const raw = (event.target?.result as string) || '';
          setEditImage(raw);
          setEditImagePreview(raw);
        }
      };
      img.src = (event.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditedProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    const amenities: string[] = [];
    if (editHasPool) amenities.push('Swimming Pool');
    if (editHasGym) amenities.push('Gym');
    if (editHasParking) amenities.push('Covered Parking');
    if (editHasBalcony) amenities.push('Balcony');
    amenities.push('Concierge 24/7');

    const updatedProp: PropertyListing = {
      ...editingProperty,
      title: editTitle,
      city: editCity,
      community: editCommunity,
      property_type: editType,
      bedrooms: editBeds,
      price_aed: Number(editPrice) || 0,
      price_inr: Math.round((Number(editPrice) || 0) * 22.8),
      status: editStatus as any,
      developer: editDeveloper,
      size_sqft: Number(editSize) || 0,
      expected_roi: editRoi,
      amenities,
      image_url: editImage || editingProperty.image_url,
      description: editDescription || editingProperty.description,
      features: [editFurnished, `${editBathrooms} Bathrooms`, 'High Rental Demand'],
      contact_name: editContactName,
      contact_mobile: editMobile,
      bathrooms: editBathrooms,
      furnished: editFurnished,
      handover_date: editHandoverDate || undefined,
      payment_plan: editPaymentPlan || undefined,
      rera_id: editReraId || undefined,
      listing_date: editListingDate || undefined,
      available_date: editAvailableDate || undefined,
      expiry_date: editExpiryDate || undefined,
      admin_verified: editAdminVerified,
      admin_verification_name: editAdminName.trim() || undefined,
      admin_verification_mobile: editAdminMobile.trim() || undefined,
      admin_verification_id_card: editAdminIdCard.trim() || undefined,
      admin_verification_id_type: editAdminIdType || undefined,
      admin_verification_date: editingProperty.admin_verification_date || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateProperty) {
      onUpdateProperty(updatedProp);
    }
    setEditSuccessMsg(`Property "${editTitle}" updated successfully!`);
    setTimeout(() => {
      setShowEditModal(false);
      setEditingProperty(null);
      setEditSuccessMsg('');
    }, 900);
  };

  const filteredProperties = properties.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.community.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.developer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Boolean(p.admin_verification_name && p.admin_verification_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      Boolean(p.admin_verification_id_card && p.admin_verification_id_card.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = selectedCity === 'ALL' || (p.city || (p.id.startsWith('MUM') ? 'Mumbai' : 'Dubai')) === selectedCity;
    const matchesComm = selectedCommunity === 'ALL' || p.community === selectedCommunity;
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchesBeds = selectedBeds === 'ALL' || p.bedrooms === selectedBeds;
    const matchesVerification = 
      selectedVerification === 'ALL' ||
      (selectedVerification === 'VERIFIED' && (p.admin_verified || p.admin_verification_name)) ||
      (selectedVerification === 'PENDING' && !p.admin_verified && !p.admin_verification_name);

    return matchesSearch && matchesCity && matchesComm && matchesStatus && matchesBeds && matchesVerification;
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setNewImage(compressed);
          setNewImagePreview(compressed);
        } else {
          const raw = (event.target?.result as string) || '';
          setNewImage(raw);
          setNewImagePreview(raw);
        }
      };
      img.src = (event.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddValidationError('');

    if (!newAdminName.trim()) {
      setAddValidationError('Admin verification name is mandatory for property compliance.');
      return;
    }
    if (!newAdminMobile.trim()) {
      setAddValidationError('Admin verification mobile number is mandatory.');
      return;
    }
    if (!newAdminIdCard.trim()) {
      setAddValidationError('Admin ID Card number is mandatory for verification.');
      return;
    }

    const amenities: string[] = [];
    if (newHasPool) amenities.push('Swimming Pool');
    if (newHasGym) amenities.push('Gym');
    if (newHasParking) amenities.push('Covered Parking');
    if (newHasBalcony) amenities.push('Balcony');
    amenities.push('Concierge 24/7');

    const defaultImages = [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'
    ];
    const chosenImage = newImage && newImage.trim().length > 0 
      ? newImage 
      : defaultImages[Math.floor(Math.random() * defaultImages.length)];

    const prop: PropertyListing = {
      id: 'LYKA-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      title: newTitle,
      city: newCity,
      community: newCommunity,
      property_type: newType,
      bedrooms: newBeds,
      price_aed: Number(newPrice) || 0,
      price_inr: Math.round((Number(newPrice) || 0) * 22.8),
      status: newStatus,
      developer: newDeveloper,
      size_sqft: Number(newSize) || 0,
      expected_roi: newRoi,
      amenities,
      image_url: chosenImage,
      description: newDescription || `Premium ${newBeds}-bedroom listing in ${newCommunity} developed by ${newDeveloper}.`,
      features: [newFurnished, `${newBathrooms} Bathrooms`, 'High Rental Demand', 'Admin Verified'],
      contact_name: newContactName || newAdminName,
      contact_mobile: newMobile || newAdminMobile,
      bathrooms: newBathrooms,
      furnished: newFurnished,
      handover_date: newHandoverDate.trim() || undefined,
      payment_plan: newPaymentPlan.trim() || undefined,
      rera_id: newReraId.trim() || undefined,
      listing_date: newListingDate.trim() || undefined,
      available_date: newAvailableDate.trim() || undefined,
      expiry_date: newExpiryDate.trim() || undefined,
      // Admin Verification Details
      admin_verified: true,
      admin_verification_name: newAdminName.trim(),
      admin_verification_mobile: newAdminMobile.trim(),
      admin_verification_id_card: newAdminIdCard.trim(),
      admin_verification_id_type: newAdminIdType,
      admin_verification_date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsAddingProperty(true);
    try {
      await onAddProperty(prop);
      setAddSuccessMsg(`Listing "${newTitle}" created and saved to Firestore database successfully!`);
      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccessMsg('');
        // Reset all fields
        setNewTitle(''); setNewContactName(''); setNewMobile(''); setNewDescription('');
        setNewBathrooms('2'); setNewHasPool(false); setNewHasGym(false);
        setNewHasParking(false); setNewHasBalcony(false); setNewFurnished('Unfurnished');
        setNewHandoverDate(''); setNewPaymentPlan(''); setNewReraId('');
        setNewListingDate(''); setNewAvailableDate(''); setNewExpiryDate('');
        setNewAdminName('Farhan Qureshi (Property Admin)');
        setNewAdminMobile('+971 50 892 4110');
        setNewAdminIdCard('784-1990-1234567-1');
        setNewAdminIdType('Emirates ID');
        setAddValidationError('');
        setNewImage(''); setNewImagePreview(''); setNewImageName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1000);
    } catch (err: any) {
      setAddValidationError('Failed to save property to database: ' + (err?.message || err));
    } finally {
      setIsAddingProperty(false);
    }
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
    <div className="flex-1 bg-slate-950 text-slate-300 flex flex-col h-full overflow-hidden">
      {/* Top Filter Header */}
      <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-300 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>Verified Dubai Property Database</span>
            </h2>
            <p className="text-xs text-slate-500">
              Approved Lyka Realty listings across Dubai Marina, Downtown, Palm Jumeirah, Dubai Hills, and JVC.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const list = filteredProperties.length > 0 ? filteredProperties : properties;
                if (!list || list.length === 0) {
                  alert('No property listings to export.');
                  return;
                }
                const headers = ['Property ID', 'Title', 'Community', 'City', 'Price (AED)', 'Bedrooms', 'Bathrooms', 'Area (Sq Ft)', 'Status', 'Developer', 'Verified'];
                const rows = list.map(p => [
                  p.id,
                  p.title,
                  p.community,
                  p.city || 'Dubai',
                  p.price_aed || 0,
                  p.bedrooms || 0,
                  p.bathrooms || 0,
                  p.size_sqft || 0,
                  p.status || 'Available',
                  p.developer || 'N/A',
                  p.admin_verified ? 'Verified' : 'Pending'
                ].map(csvCell));
                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const dateStr = new Date().toISOString().split('T')[0];
                const ok = downloadCSV(`lyka_property_inventory_${dateStr}.csv`, csvContent);
                if (ok) {
                  setIsExportingCsv(true);
                  setTimeout(() => setIsExportingCsv(false), 2500);
                }
              }}
              className={`flex items-center space-x-1.5 text-xs px-3.5 py-2 rounded-xl transition-all font-semibold border cursor-pointer shadow-xs active:scale-95 ${
                isExportingCsv
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30'
              }`}
              title="Export properties to CSV file"
            >
              {isExportingCsv ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>Export CSV</span>
                </>
              )}
            </button>

            {canAddProperty && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-amber-950 px-3.5 py-2 rounded-xl transition-all font-bold shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Property Listing</span>
              </button>
            )}
          </div>
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

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, community, admin ID..."
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

          <div>
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500 font-semibold"
            >
              <option value="ALL">🛡️ All Verification</option>
              <option value="VERIFIED">✅ Admin Verified Only</option>
              <option value="PENDING">⏳ Pending Verification</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5 2xl:gap-6">
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
                      {prop.is_booked || (prop.status || '').toLowerCase() === 'booked' ? (
                        <span className="bg-rose-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow flex items-center space-x-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>BOOKED</span>
                        </span>
                      ) : (
                        <span className="bg-slate-900/90 backdrop-blur-md text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700">
                          {prop.status}
                        </span>
                      )}
                      {prop.rera_id && (
                        <span className="bg-slate-900/90 backdrop-blur-md text-emerald-400 text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {prop.rera_id}
                        </span>
                      )}
                      {prop.admin_verified || prop.admin_verification_name ? (
                        <span className="bg-emerald-950/90 backdrop-blur-md text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 flex items-center space-x-1" title={`Admin Verified by ${prop.admin_verification_name || 'Property Admin'} (ID: ${prop.admin_verification_id_card || 'Verified'})`}>
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Admin Verified</span>
                        </span>
                      ) : null}
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

                    {/* Admin Verification Details Badge */}
                    <div className="mt-2.5 bg-slate-950/80 border border-slate-800 rounded-xl p-2 text-[10px] space-y-1">
                      <div className="flex items-center justify-between text-slate-300 font-semibold">
                        <span className="flex items-center space-x-1.5 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Admin: <strong>{prop.admin_verification_name || prop.contact_name || 'Property Admin'}</strong></span>
                        </span>
                        <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-700/40 px-1.5 py-0.5 rounded">
                          {prop.admin_verification_id_type || (prop.city === 'Mumbai' ? 'Aadhaar Card' : 'Emirates ID')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[9px] pt-1 border-t border-slate-800/80">
                        <span className="flex items-center space-x-1">
                          <CreditCard className="w-2.5 h-2.5 text-cyan-400" />
                          <span>ID Card: <strong className="text-slate-300 font-mono">{prop.admin_verification_id_card || '784-1990-1234567-1'}</strong></span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Phone className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Mob: <strong className="text-slate-300 font-mono">{prop.admin_verification_mobile || prop.contact_mobile || '+971 50 892 4110'}</strong></span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated Yield</span>
                      <span className="text-xs font-bold text-emerald-400">{prop.expected_roi || '7.5% net ROI'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {canAddProperty && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(prop)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-500 hover:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 border border-slate-700 shadow-sm"
                          title="Edit property details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onBookViewing(prop)}
                        className="bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center space-x-1.5 shadow-sm"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Book Viewing</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Property Modal */}
      {canAddProperty && showAddModal && (
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

            {addSuccessMsg && (
              <div className="bg-emerald-950/90 border border-emerald-500/70 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2 shadow-md animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{addSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">

              {/* Section: 🛡️ Admin Verification (Required for Listing Compliance) */}
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-800/80 to-amber-950/40 border border-emerald-500/50 rounded-xl p-3.5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-bold uppercase tracking-wider text-[11px]">
                      🛡️ Admin Verification & Legal Identity Check (Mandatory)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/50 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compliance Verified</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Real Estate regulatory protocols mandate full Property Admin identification (<strong className="text-amber-300">Admin Name, Mobile, and Official ID Card</strong>) before any listing is published to active database.
                </p>

                {addValidationError && (
                  <div className="bg-rose-950/90 border border-rose-500/60 rounded-xl p-2.5 text-xs text-rose-300 flex items-center space-x-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{addValidationError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Verifier Name <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAdminName(val);
                        if (!newContactName) setNewContactName(val);
                        setAddValidationError('');
                      }}
                      placeholder="E.g., Farhan Qureshi (Property Admin)"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Admin Mobile Number <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      type="tel"
                      value={newAdminMobile}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAdminMobile(val);
                        if (!newMobile) setNewMobile(val);
                        setAddValidationError('');
                      }}
                      placeholder="E.g., +971 50 892 4110"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Admin ID Card Type <span className="text-rose-400">*</span></span>
                    </label>
                    <select
                      value={newAdminIdType}
                      onChange={(e) => setNewAdminIdType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                    >
                      <option value="Emirates ID">Emirates ID (UAE)</option>
                      <option value="Aadhaar Card">Aadhaar Card (India)</option>
                      <option value="Passport / Govt ID">Passport / Govt ID</option>
                      <option value="Corporate Admin ID">Corporate Admin ID</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Admin ID Card Number <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={newAdminIdCard}
                    onChange={(e) => { setNewAdminIdCard(e.target.value); setAddValidationError(''); }}
                    placeholder={newAdminIdType === 'Emirates ID' ? 'E.g., 784-1990-1234567-1' : newAdminIdType === 'Aadhaar Card' ? 'E.g., 1234 5678 9012' : 'E.g., ID-ADM-99420'}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Official Government/Corporate ID confirms admin authorization for this property and eliminates duplicate submissions.
                  </p>
                </div>
              </div>

              {/* Section: Public Contact Info */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">📞 Public Contact & Inquiries</p>
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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">🏠 Property Details</p>

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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">🛏 Rooms & Size</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">✨ Amenities & Features</p>
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
                          ? 'bg-amber-500/20 border-amber-500 text-amber-700'
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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">💰 Pricing</p>
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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">📝 Description</p>
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
                <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">📷 Property Photo</p>

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
                      <p className="text-slate-300 text-xs font-semibold group-hover:text-amber-600">Click to upload photo</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">JPG, PNG, WEBP supported</p>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-700 px-3 py-1 rounded-lg">
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
                  disabled={isAddingProperty}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2 rounded-xl font-bold shadow-md disabled:opacity-50 flex items-center justify-center space-x-1.5 transition-all"
                >
                  {isAddingProperty ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Saving to Firestore Database...</span>
                    </>
                  ) : (
                    <span>Publish & Save to DB</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {canAddProperty && showEditModal && editingProperty && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>Edit Property Listing</span>
                    <span className="font-mono text-[10px] text-amber-400 bg-amber-950/70 border border-amber-600/40 px-2 py-0.5 rounded">
                      {editingProperty.id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update property details, pricing, media, and availability status</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setShowEditModal(false); setEditingProperty(null); }} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success message */}
            {editSuccessMsg && (
              <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditedProperty} className="space-y-4 text-xs">
              {/* Section: 🛡️ Admin Verification Details (Update / Compliance) */}
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-800/80 to-amber-950/40 border border-emerald-500/50 rounded-xl p-3.5 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-bold uppercase tracking-wider text-[11px]">
                      🛡️ Admin Verification & Legal Identity Sign-off
                    </span>
                  </div>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAdminVerified}
                      onChange={(e) => setEditAdminVerified(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                    <span className="text-[11px] font-bold text-emerald-300">Admin Verified Status</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Admin Verifier Name</span>
                    </label>
                    <input
                      type="text"
                      value={editAdminName}
                      onChange={(e) => setEditAdminName(e.target.value)}
                      placeholder="E.g., Farhan Qureshi (Property Admin)"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Admin Mobile Number</span>
                    </label>
                    <input
                      type="tel"
                      value={editAdminMobile}
                      onChange={(e) => setEditAdminMobile(e.target.value)}
                      placeholder="E.g., +971 50 892 4110"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Admin ID Card Type</span>
                    </label>
                    <select
                      value={editAdminIdType}
                      onChange={(e) => setEditAdminIdType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs"
                    >
                      <option value="Emirates ID">Emirates ID (UAE)</option>
                      <option value="Aadhaar Card">Aadhaar Card (India)</option>
                      <option value="Passport / Govt ID">Passport / Govt ID</option>
                      <option value="Corporate Admin ID">Corporate Admin ID</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 text-[11px] font-semibold flex items-center space-x-1">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Admin ID Card Number</span>
                  </label>
                  <input
                    type="text"
                    value={editAdminIdCard}
                    onChange={(e) => setEditAdminIdCard(e.target.value)}
                    placeholder="E.g., 784-1990-1234567-1"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-slate-200 outline-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Section: Public Contact Info */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">📞 Public Contact Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      placeholder="E.g., Ahmed Al Mansouri"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      placeholder="E.g., +971 50 123 4567"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Property Details */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">🏠 Property Details</p>

                <div>
                  <label className="text-slate-400 block mb-1">Listing Title <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="E.g., Marina Gate Luxury 2BR with Yacht Views"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Region / City</label>
                    <select
                      value={editCity}
                      onChange={(e) => {
                        const cityVal = e.target.value as 'Dubai' | 'Mumbai';
                        setEditCity(cityVal);
                        setEditCommunity(cityVal === 'Mumbai' ? 'Worli' : 'Dubai Marina');
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Dubai">Dubai, UAE</option>
                      <option value="Mumbai">Mumbai, India</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Community</label>
                    <select
                      value={editCommunity}
                      onChange={(e) => setEditCommunity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      {editCity === 'Mumbai' ? (
                        <>
                          <option value="Worli">Worli</option>
                          <option value="Bandra West">Bandra West</option>
                          <option value="Juhu">Juhu</option>
                          <option value="BKC">BKC</option>
                          <option value="Powai">Powai</option>
                          <option value="Lower Parel">Lower Parel</option>
                          <option value="Malabar Hill">Malabar Hill</option>
                          <option value="Andheri West">Andheri West</option>
                        </>
                      ) : (
                        <>
                          <option value="Dubai Marina">Dubai Marina</option>
                          <option value="Downtown Dubai">Downtown Dubai</option>
                          <option value="Palm Jumeirah">Palm Jumeirah</option>
                          <option value="Business Bay">Business Bay</option>
                          <option value="Dubai Hills Estate">Dubai Hills Estate</option>
                          <option value="JVC">JVC</option>
                          <option value="Dubai Creek Harbour">Dubai Creek Harbour</option>
                          <option value="Arabian Ranches">Arabian Ranches</option>
                          <option value="Bluewaters Island">Bluewaters Island</option>
                          <option value="JBR">JBR</option>
                        </>
                      )}
                      {editCommunity && ![
                        'Dubai Marina', 'Downtown Dubai', 'Palm Jumeirah', 'Business Bay',
                        'Dubai Hills Estate', 'JVC', 'Dubai Creek Harbour', 'Arabian Ranches',
                        'Bluewaters Island', 'JBR', 'Worli', 'Bandra West', 'Juhu', 'BKC',
                        'Powai', 'Lower Parel', 'Malabar Hill', 'Andheri West'
                      ].includes(editCommunity) && (
                        <option value={editCommunity}>{editCommunity}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Developer</label>
                    <input
                      type="text"
                      value={editDeveloper}
                      onChange={(e) => setEditDeveloper(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Property Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
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
                      value={editFurnished}
                      onChange={(e) => setEditFurnished(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Furnished">Furnished</option>
                      <option value="Unfurnished">Unfurnished</option>
                      <option value="Semi-Furnished">Semi-Furnished</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Rooms, Size & Status */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">🛏 Rooms, Size & Status</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Bedrooms</label>
                    <select
                      value={editBeds}
                      onChange={(e) => setEditBeds(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Studio">Studio</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                      <option value="5">5+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Bathrooms</label>
                    <select
                      value={editBathrooms}
                      onChange={(e) => setEditBathrooms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                      <option value="5">5+</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Size (sqft)</label>
                    <input
                      type="number"
                      value={editSize}
                      onChange={(e) => setEditSize(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    >
                      <option value="Ready">Ready</option>
                      <option value="Off-plan">Off-plan</option>
                      <option value="Available">Available</option>
                      <option value="Booked">Booked</option>
                    </select>
                  </div>
                </div>

                {/* Date Information */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Listing Date</label>
                    <input
                      type="date"
                      value={editListingDate}
                      onChange={(e) => setEditListingDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Available From</label>
                    <input
                      type="date"
                      value={editAvailableDate}
                      onChange={(e) => setEditAvailableDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={editExpiryDate}
                      onChange={(e) => setEditExpiryDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Handover Date & Payment Plan for Off-Plan */}
                {editStatus === 'Off-plan' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Handover Date</label>
                      <input
                        type="date"
                        value={editHandoverDate}
                        onChange={(e) => setEditHandoverDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Payment Plan</label>
                      <input
                        type="text"
                        value={editPaymentPlan}
                        onChange={(e) => setEditPaymentPlan(e.target.value)}
                        placeholder="E.g., 60/40 on handover"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* RERA ID */}
                <div>
                  <label className="text-slate-400 block mb-1">RERA ID</label>
                  <input
                    type="text"
                    value={editReraId}
                    onChange={(e) => setEditReraId(e.target.value)}
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
                    { label: '🏊 Swimming Pool', value: editHasPool, setter: setEditHasPool },
                    { label: '🏋️ Gym', value: editHasGym, setter: setEditHasGym },
                    { label: '🚗 Parking', value: editHasParking, setter: setEditHasParking },
                    { label: '🌇 Balcony', value: editHasBalcony, setter: setEditHasBalcony },
                  ].map(({ label, value, setter }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setter(!value)}
                      className={`flex items-center justify-center space-x-1.5 px-2 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
                        value
                          ? 'bg-amber-500/20 border-amber-500 text-amber-500'
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
                    <label className="text-slate-400 block mb-1">Price (AED) <span className="text-rose-400">*</span></label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Expected ROI</label>
                    <input
                      type="text"
                      value={editRoi}
                      onChange={(e) => setEditRoi(e.target.value)}
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
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the property — layout, views, finishing quality, nearby landmarks, payment plan, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Section: Photo Upload */}
              <div className="bg-slate-800/50 rounded-xl p-3 space-y-3">
                <p className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">📷 Property Photo</p>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageUpload}
                  className="hidden"
                />

                {editImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700">
                    <img
                      src={editImagePreview}
                      alt="Property preview"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-end">
                      <div className="w-full px-3 py-2 flex items-center justify-between bg-slate-950/70 backdrop-blur-sm">
                        <span className="text-[10px] text-slate-300 truncate max-w-[200px]">
                          {editImageName || 'Current Property Image'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="text-[10px] bg-slate-800 border border-slate-600 text-slate-300 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditImage(''); setEditImagePreview(''); setEditImageName(''); if (editFileInputRef.current) editFileInputRef.current.value = ''; }}
                            className="flex items-center space-x-1 text-[10px] bg-red-500/20 border border-red-500/40 text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center space-y-2 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-amber-500/10 flex items-center justify-center transition-colors">
                      <ImagePlus className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 text-xs font-semibold group-hover:text-amber-500">Click to upload new photo</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">JPG, PNG, WEBP supported</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingProperty(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
