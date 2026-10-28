import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Copy,
  Mail,
  Phone,
  CreditCard,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { PortalStaffMember } from '../types/crm';
import { addPortalStaff, removePortalStaff } from '../lib/firebase';

interface AdminStaffManagementProps {
  staffList: PortalStaffMember[];
  onRefreshStaff: () => Promise<void>;
  onNavigateToPortals?: (portal: 'property_manager' | 'sales_manager') => void;
}

export const AdminStaffManagement: React.FC<AdminStaffManagementProps> = ({
  staffList,
  onRefreshStaff,
  onNavigateToPortals
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'property_manager' | 'sales_manager'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  // Form Fields
  const [formRole, setFormRole] = useState<'property_manager' | 'sales_manager'>('property_manager');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIdCard, setFormIdCard] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedNotice, setGeneratedNotice] = useState(false);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (roleFilter !== 'all' && staff.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (staff.name || '').toLowerCase().includes(q);
        const matchEmail = (staff.email || '').toLowerCase().includes(q);
        const matchPhone = (staff.phone || '').toLowerCase().includes(q);
        const matchIdCard = (staff.idCard || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchPhone || matchIdCard;
      }
      return true;
    });
  }, [staffList, roleFilter, searchQuery]);

  const propertyCount = useMemo(() => {
    return staffList.filter((s) => s.role === 'property_manager').length;
  }, [staffList]);

  const salesCount = useMemo(() => {
    return staffList.filter((s) => s.role === 'sales_manager').length;
  }, [staffList]);

  // Generate a secure 12-char password
  const handleGeneratePassword = () => {
    const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const charsLower = 'abcdefghjkmnpqrstuvwxyz';
    const charsNum = '23456789';
    const charsSym = '!@#$%&*';

    let pass = 'Lyka#';
    for (let i = 0; i < 2; i++) pass += charsUpper[Math.floor(Math.random() * charsUpper.length)];
    for (let i = 0; i < 3; i++) pass += charsLower[Math.floor(Math.random() * charsLower.length)];
    for (let i = 0; i < 2; i++) pass += charsNum[Math.floor(Math.random() * charsNum.length)];
    pass += charsSym[Math.floor(Math.random() * charsSym.length)];

    setFormPassword(pass);
    setShowPassword(true);
    setGeneratedNotice(true);
    setTimeout(() => setGeneratedNotice(false), 3500);
  };

  const handleOpenAddModal = () => {
    setModalError('');
    setModalSuccess('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormIdCard('');
    setFormPassword('');
    setShowPassword(false);
    setShowAddModal(true);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStaff();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();
    const cleanPhone = formPhone.trim();
    const cleanIdCard = formIdCard.trim();
    const cleanPassword = formPassword.trim();

    if (!cleanName) {
      setModalError('Please enter the staff member full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setModalError('Please enter a valid email address.');
      return;
    }
    if (!cleanPhone) {
      setModalError('Please enter the mobile number.');
      return;
    }
    if (!cleanIdCard) {
      setModalError('Please enter the ID card number (e.g. Emirates ID / Govt ID).');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setModalError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addPortalStaff({
        role: formRole,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        idCard: cleanIdCard,
        password: cleanPassword
      });

      if (res.success) {
        setModalSuccess(`Successfully granted access to ${cleanName} for ${formRole === 'property_manager' ? 'Property Admin' : 'Sales Manager'} portal!`);
        await onRefreshStaff();
        setTimeout(() => {
          setShowAddModal(false);
          setModalSuccess('');
        }, 1500);
      } else {
        setModalError(res.error || 'Failed to add staff member.');
      }
    } catch (err: any) {
      setModalError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStaff = async (staff: PortalStaffMember) => {
    const roleLabel = staff.role === 'property_manager' ? 'Property Admin' : 'Sales Manager';
    if (!window.confirm(`Are you sure you want to revoke portal access for ${staff.name} (${staff.email}) from ${roleLabel}?`)) {
      return;
    }

    setDeletingEmail(staff.email);
    try {
      const res = await removePortalStaff(staff.email, staff.role);
      if (res.success) {
        await onRefreshStaff();
      } else {
        alert(res.error || 'Failed to revoke access.');
      }
    } catch (err: any) {
      alert(err.message || 'Error revoking access.');
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfbf5] overflow-hidden select-text text-[#1c1611]">
      {/* Top Banner Header */}
      <div className="border-b border-[#ebdcc4] bg-[#faf6ec] px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-800 border border-amber-500/30 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1c1611]">Staff & Portal Access</h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-900 border border-amber-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-[#5a4835] mt-0.5">
                Add and manage authorized emails for Property Admins and Sales Managers with ID Card and Mobile verification.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-[#ebdcc4] bg-white hover:bg-[#faf6ec] text-[#2d2216] transition-all text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-60"
              title="Refresh staff list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-[#1c1611] hover:bg-[#2d2216] text-white font-bold text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-[#1c1611]"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Add Authorized Manager</span>
            </button>
          </div>
        </div>

        {/* Overview Metric Pills */}
        <div className="max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1680px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
          <div className="p-3 rounded-xl bg-white border border-[#ebdcc4] flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-800">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-[#7d6851] font-medium">Total Authorized</p>
                <p className="text-base font-bold leading-tight text-[#1c1611]">{staffList.length}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#faf6ec] text-[#2d2216] border border-[#ebdcc4]">
              Active Team
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#ebdcc4] flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-800">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-amber-900 font-medium">Property Admins</p>
                <p className="text-base font-bold leading-tight text-[#1c1611]">{propertyCount}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-900 border border-amber-500/30">
              Properties & Bookings
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#ebdcc4] flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-800">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-emerald-900 font-medium">Sales Managers</p>
                <p className="text-base font-bold leading-tight text-[#1c1611]">{salesCount}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">
              Duplicates & QA
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="border-b border-[#ebdcc4] px-4 sm:px-6 py-2.5 bg-white/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#1c1611] text-white shadow-xs'
                : 'text-[#5a4835] hover:text-[#1c1611] hover:bg-[#faf6ec]'
            }`}
          >
            All ({staffList.length})
          </button>
          <button
            onClick={() => setRoleFilter('property_manager')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              roleFilter === 'property_manager'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-[#5a4835] hover:text-[#1c1611] hover:bg-[#faf6ec]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-700" />
            <span>Property Admins ({propertyCount})</span>
          </button>
          <button
            onClick={() => setRoleFilter('sales_manager')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              roleFilter === 'sales_manager'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-[#5a4835] hover:text-[#1c1611] hover:bg-[#faf6ec]'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-emerald-700" />
            <span>Sales Managers ({salesCount})</span>
          </button>
        </div>

        {/* Live Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c765c]" />
          <input
            type="text"
            placeholder="Search by name, email, mobile, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c765c] hover:text-[#1c1611]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area — Staff Cards */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1680px] mx-auto space-y-4">
          {filteredStaff.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-[#ebdcc4] text-center bg-white shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center text-amber-800 mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1c1611]">
                {searchQuery ? 'No staff matching your search' : 'No staff members added yet'}
              </h3>
              <p className="text-xs text-[#5a4835] mt-1 max-w-md mx-auto">
                {searchQuery
                  ? 'Try searching with a different name, email, or mobile number.'
                  : 'Click "+ Add Authorized Manager" to assign Property Admin or Sales Manager access with their ID card and mobile number.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#1c1611] hover:bg-[#2d2216] text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center space-x-1.5 border border-[#1c1611]"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add First Authorized Manager</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStaff.map((staff) => {
                const isProperty = staff.role === 'property_manager';
                const isDeleting = deletingEmail === staff.email;

                return (
                  <div
                    key={`${staff.role}_${staff.email}`}
                    className="p-4 rounded-2xl bg-white border border-[#ebdcc4] hover:border-amber-500/50 shadow-xs transition-all relative group flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs ${
                            isProperty
                              ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-900 border border-emerald-500/30'
                          }`}>
                            {staff.name ? staff.name.substring(0, 2) : 'ST'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#1c1611] truncate max-w-[170px]" title={staff.name}>
                              {staff.name}
                            </h3>
                            <div className="flex items-center space-x-1 mt-0.5">
                              <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isProperty
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}>
                                {isProperty ? <Building2 className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>{isProperty ? 'Property Admin' : 'Sales Manager'}</span>
                              </span>
                              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                                Active
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Revoke Access Button */}
                        <button
                          onClick={() => handleRemoveStaff(staff)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                          title="Revoke portal access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Detail Rows */}
                      <div className="mt-3.5 pt-3 border-t border-[#ebdcc4] space-y-2 text-xs">
                        {/* Email */}
                        <div className="flex items-center space-x-2 text-[#2d2216]">
                          <Mail className="w-3.5 h-3.5 text-[#8c765c] shrink-0" />
                          <span className="truncate font-medium" title={staff.email}>{staff.email}</span>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center space-x-2 text-[#2d2216]">
                          <Phone className="w-3.5 h-3.5 text-[#8c765c] shrink-0" />
                          <span className="font-medium">{staff.phone || 'No phone recorded'}</span>
                        </div>

                        {/* ID Card */}
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="text-[11px] font-semibold text-[#1c1611] bg-[#faf6ec] px-2 py-0.5 rounded-md border border-[#ebdcc4]">
                            ID: {staff.idCard || 'Verified ID Card'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-2.5 border-t border-[#ebdcc4] flex items-center justify-between text-[10px] text-[#7d6851]">
                      <span>Added {staff.addedAt ? new Date(staff.addedAt).toLocaleDateString() : 'Active'}</span>
                      <span className="font-semibold text-emerald-700">Authorized</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Add Authorized Manager ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white border border-[#ebdcc4] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#ebdcc4] flex items-center justify-between bg-[#faf6ec]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-800 border border-amber-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#1c1611]">Add Authorized Manager</h2>
                  <p className="text-[11px] text-[#5a4835]">
                    Grant Property Admin or Sales Manager access with ID Card & Mobile credentials.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#8c765c] hover:text-[#1c1611] hover:bg-[#faf6ec] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddStaffSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Portal Role Selector */}
              <div>
                <label className="block text-xs font-bold text-[#1c1611] mb-1.5">
                  Select Portal Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole('property_manager')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                      formRole === 'property_manager'
                        ? 'bg-amber-500/10 border-amber-500 text-[#1c1611] ring-2 ring-amber-500/30'
                        : 'border-[#ebdcc4] text-[#5a4835] hover:bg-[#faf6ec]'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mt-0.5 ${formRole === 'property_manager' ? 'text-amber-700' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">Property Admin</div>
                      <div className="text-[10px] text-[#7d6851] mt-0.5">
                        Manage properties, viewing bookings & assign agents
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('sales_manager')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                      formRole === 'sales_manager'
                        ? 'bg-emerald-500/10 border-emerald-500 text-[#1c1611] ring-2 ring-emerald-500/30'
                        : 'border-[#ebdcc4] text-[#5a4835] hover:bg-[#faf6ec]'
                    }`}
                  >
                    <Copy className={`w-4 h-4 mt-0.5 ${formRole === 'sales_manager' ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">Sales Manager</div>
                      <div className="text-[10px] text-[#7d6851] mt-0.5">
                        Duplicate detection & quality assurance audits
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Name & Email in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1c1611] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Omar Al-Mansoor"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1c1611] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. omar@lykarealty.ae"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Mobile Number & ID Card in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1c1611] mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c765c]" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +971 50 123 4567"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1c1611] mb-1">
                    ID Card Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c765c]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 784-1990-1234567-1"
                      value={formIdCard}
                      onChange={(e) => setFormIdCard(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Auto-generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1c1611]">
                    Login Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Auto-Generate Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c765c]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter initial password (min 6 chars)"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full pl-8 pr-10 py-2 rounded-xl border border-[#ebdcc4] bg-white text-xs text-[#1c1611] placeholder-[#8c765c] focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c765c] hover:text-[#1c1611]"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {generatedNotice && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                    Strong password generated and copied to input!
                  </p>
                )}
              </div>

              {/* Informational Callout */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Upon saving, this user is immediately authorized. They can open the {formRole === 'property_manager' ? 'Property Admin' : 'Sales Manager'} portal and log in directly using this email and password.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#ebdcc4] text-xs font-semibold hover:bg-[#faf6ec] text-[#2d2216] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#1c1611] hover:bg-[#2d2216] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60 flex items-center space-x-1.5 border border-[#1c1611]"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Granting Access...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Grant Portal Access</span>
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
