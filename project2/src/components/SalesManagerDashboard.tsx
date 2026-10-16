import React, { useState, useMemo } from 'react';
import { PropertyListing, DuplicatePropertyPair, PropertyRequirementAudit, PropertyRequirementIssue } from '../types/crm';
import { 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Trash2, 
  Sparkles, 
  ShieldAlert, 
  FileText, 
  Edit3, 
  Check, 
  X, 
  Building2, 
  Layers, 
  ArrowRight, 
  RefreshCw, 
  Info,
  Calendar,
  BadgeAlert,
  Percent,
  PlusCircle,
  ExternalLink,
  ChevronDown,
  Database
} from 'lucide-react';

interface SalesManagerDashboardProps {
  properties: PropertyListing[];
  onUpdateProperty: (property: PropertyListing) => Promise<void> | void;
  onDeleteProperty: (propertyId: string) => Promise<void> | void;
  onAddProperty?: (property: PropertyListing) => Promise<void> | void;
  activeSubTab?: 'duplicates' | 'missing_requirements';
  onChangeSubTab?: (tab: 'duplicates' | 'missing_requirements') => void;
}

// Requirements checklist definition for Sales Quality Audit
interface RequirementRule {
  field: keyof PropertyListing;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  checkValid: (p: PropertyListing) => boolean;
}

const REQUIREMENT_RULES: RequirementRule[] = [
  {
    field: 'rera_id',
    label: 'RERA Permit ID',
    severity: 'critical',
    description: 'Mandatory Dubai Law compliance for property advertising and sales.',
    checkValid: (p) => Boolean(p.rera_id && p.rera_id.trim().length > 3)
  },
  {
    field: 'price_aed',
    label: 'Price (AED)',
    severity: 'critical',
    description: 'Accurate asking price required for client budget matching.',
    checkValid: (p) => Boolean(p.price_aed && Number(p.price_aed) > 0)
  },
  {
    field: 'size_sqft',
    label: 'Size (Sq.Ft)',
    severity: 'critical',
    description: 'Total unit area required for price/sqft metric calculations.',
    checkValid: (p) => Boolean(p.size_sqft && Number(p.size_sqft) > 0)
  },
  {
    field: 'image_url',
    label: 'High-Res Photo',
    severity: 'critical',
    description: 'Valid visual photo required for pitch cards and client decks.',
    checkValid: (p) => Boolean(p.image_url && p.image_url.trim().startsWith('http'))
  },
  {
    field: 'developer',
    label: 'Developer Name',
    severity: 'warning',
    description: 'Master developer name builds investor trust and validation.',
    checkValid: (p) => Boolean(p.developer && p.developer.trim().length > 2)
  },
  {
    field: 'handover_date',
    label: 'Handover Date',
    severity: 'warning',
    description: 'Completion quarter or ready status needed for move-in planning.',
    checkValid: (p) => Boolean(p.handover_date && p.handover_date.trim().length > 0)
  },
  {
    field: 'payment_plan',
    label: 'Payment Plan',
    severity: 'warning',
    description: 'Milestones (e.g., 60/40) essential for buyers and off-plan sales.',
    checkValid: (p) => Boolean(p.payment_plan && p.payment_plan.trim().length > 0)
  },
  {
    field: 'expected_roi',
    label: 'Expected ROI',
    severity: 'info',
    description: 'Estimated net rental yield critical for investor leads.',
    checkValid: (p) => Boolean(p.expected_roi && p.expected_roi.trim().length > 0)
  },
  {
    field: 'description',
    label: 'Description (>40 chars)',
    severity: 'info',
    description: 'Detailed copywriting enables AI agent to highlight features.',
    checkValid: (p) => Boolean(p.description && p.description.trim().length >= 40)
  },
  {
    field: 'bathrooms',
    label: 'Bathrooms Count',
    severity: 'info',
    description: 'Layout detail for families and luxury buyers.',
    checkValid: (p) => Boolean(p.bathrooms && p.bathrooms.trim().length > 0)
  },
  {
    field: 'contact_mobile',
    label: 'Agent Mobile Contact',
    severity: 'info',
    description: 'Direct phone number for instant dispatch and viewings.',
    checkValid: (p) => Boolean(p.contact_mobile && p.contact_mobile.trim().length >= 7)
  }
];

export const SalesManagerDashboard: React.FC<SalesManagerDashboardProps> = ({
  properties,
  onUpdateProperty,
  onDeleteProperty,
  onAddProperty,
  activeSubTab: externalTab,
  onChangeSubTab
}) => {
  const [internalTab, setInternalTab] = useState<'duplicates' | 'missing_requirements'>('duplicates');
  const activeTab = externalTab || internalTab;
  const setTab = (tab: 'duplicates' | 'missing_requirements') => {
    if (onChangeSubTab) onChangeSubTab(tab);
    setInternalTab(tab);
  };

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'critical' | 'missing_rera' | 'missing_payment' | 'sales_ready'>('all');
  const [dismissedDuplicateGroupIds, setDismissedDuplicateGroupIds] = useState<string[]>([]);

  // State for quick fix modal
  const [editingAuditProperty, setEditingAuditProperty] = useState<PropertyListing | null>(null);
  const [quickFixForm, setQuickFixForm] = useState<Partial<PropertyListing>>({});
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Auto clear toast
  const triggerToast = (message: string, type: 'success' | 'info' = 'success') => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3500);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DUPLICATE PROPERTY DETECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  const duplicateGroups: DuplicatePropertyPair[] = useMemo(() => {
    const list = properties;
    const groups: DuplicatePropertyPair[] = [];
    const pairedIds = new Set<string>();

    const normalizeText = (txt: string) => {
      return (txt || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    };

    for (let i = 0; i < list.length; i++) {
      const p1 = list[i];
      if (pairedIds.has(p1.id)) continue;

      const normTitle1 = normalizeText(p1.title);
      const words1 = new Set(normTitle1.split(' ').filter(w => w.length > 2));
      const rera1 = (p1.rera_id || '').trim().toLowerCase();
      const img1 = (p1.image_url || '').trim();

      const matchedDuplicates: PropertyListing[] = [];
      let matchReason = '';
      let matchScore = 0;
      let matchType: 'exact_title' | 'community_specs' | 'rera_id' | 'image_match' = 'exact_title';

      for (let j = i + 1; j < list.length; j++) {
        const p2 = list[j];
        if (pairedIds.has(p2.id)) continue;

        let isMatch = false;

        // Check 1: Matching RERA Permit ID
        const rera2 = (p2.rera_id || '').trim().toLowerCase();
        if (rera1 && rera2 && rera1 === rera2) {
          isMatch = true;
          matchScore = 99;
          matchReason = `Identical Dubai RERA Permit Registration (${p1.rera_id})`;
          matchType = 'rera_id';
        }

        // Check 2: Exact or high title word similarity
        if (!isMatch) {
          const normTitle2 = normalizeText(p2.title);
          if (normTitle1 && normTitle2 && normTitle1 === normTitle2) {
            isMatch = true;
            matchScore = 96;
            matchReason = 'Identical Project Title and Listing Name';
            matchType = 'exact_title';
          } else {
            const words2 = new Set(normTitle2.split(' ').filter(w => w.length > 2));
            const intersection = [...words1].filter(w => words2.has(w)).length;
            const union = new Set([...words1, ...words2]).size;
            const jaccard = union > 0 ? intersection / union : 0;
            if (jaccard >= 0.70 && p1.community.toLowerCase() === p2.community.toLowerCase()) {
              isMatch = true;
              matchScore = Math.round(jaccard * 100);
              matchReason = `High Title Overlap (${matchScore}%) in same community (${p1.community})`;
              matchType = 'exact_title';
            }
          }
        }

        // Check 3: Same Community + Property Type + Bedrooms + Near Price/Size
        if (!isMatch) {
          const sameCommunity = (p1.community || '').toLowerCase() === (p2.community || '').toLowerCase();
          const sameType = (p1.property_type || '').toLowerCase() === (p2.property_type || '').toLowerCase();
          const sameBeds = String(p1.bedrooms || '') === String(p2.bedrooms || '');

          if (sameCommunity && sameType && sameBeds) {
            const priceDiffPct = p1.price_aed > 0 && p2.price_aed > 0
              ? Math.abs(p1.price_aed - p2.price_aed) / Math.max(p1.price_aed, p2.price_aed)
              : 1;
            const sizeDiffPct = p1.size_sqft > 0 && p2.size_sqft > 0
              ? Math.abs(p1.size_sqft - p2.size_sqft) / Math.max(p1.size_sqft, p2.size_sqft)
              : 1;

            if (priceDiffPct <= 0.05 || sizeDiffPct <= 0.05) {
              isMatch = true;
              matchScore = 88;
              matchReason = `Matching ${p1.community} ${p1.bedrooms}BR ${p1.property_type} with near-identical price/size`;
              matchType = 'community_specs';
            }
          }
        }

        // Check 4: Identical Hero Image URL
        if (!isMatch && img1 && img1.length > 20) {
          const img2 = (p2.image_url || '').trim();
          if (img1 === img2) {
            isMatch = true;
            matchScore = 80;
            matchReason = 'Identical hero photograph URL detected';
            matchType = 'image_match';
          }
        }

        if (isMatch) {
          matchedDuplicates.push(p2);
          pairedIds.add(p2.id);
        }
      }

      if (matchedDuplicates.length > 0) {
        pairedIds.add(p1.id);
        const groupId = `DUP-${p1.id}-${matchedDuplicates[0].id}`;
        if (!dismissedDuplicateGroupIds.includes(groupId)) {
          groups.push({
            id: groupId,
            primaryProperty: p1,
            duplicateProperties: matchedDuplicates,
            confidence: matchScore,
            reason: matchReason,
            matchType
          });
        }
      }
    }

    return groups;
  }, [properties, dismissedDuplicateGroupIds]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MISSING REQUIREMENTS AUDIT ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  const requirementAudits: PropertyRequirementAudit[] = useMemo(() => {
    return properties.map((property) => {
      const criticalIssues: PropertyRequirementIssue[] = [];
      const warningIssues: PropertyRequirementIssue[] = [];
      const infoIssues: PropertyRequirementIssue[] = [];

      let passedCount = 0;

      REQUIREMENT_RULES.forEach((rule) => {
        const isValid = rule.checkValid(property);
        if (isValid) {
          passedCount += 1;
        } else {
          const issue: PropertyRequirementIssue = {
            field: String(rule.field),
            label: rule.label,
            severity: rule.severity,
            description: rule.description
          };
          if (rule.severity === 'critical') criticalIssues.push(issue);
          else if (rule.severity === 'warning') warningIssues.push(issue);
          else infoIssues.push(issue);
        }
      });

      const completenessScore = Math.round((passedCount / REQUIREMENT_RULES.length) * 100);

      let status: 'action_required' | 'incomplete' | 'sales_ready' = 'sales_ready';
      if (criticalIssues.length > 0 || completenessScore < 65) {
        status = 'action_required';
      } else if (warningIssues.length > 0 || completenessScore < 85) {
        status = 'incomplete';
      }

      return {
        property,
        completenessScore,
        criticalIssues,
        warningIssues,
        infoIssues,
        status
      };
    });
  }, [properties]);

  // Filtered requirement audits
  const filteredAudits = useMemo(() => {
    return requirementAudits.filter((audit) => {
      const p = audit.property;
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesCommunity = p.community.toLowerCase().includes(q);
        const matchesDev = (p.developer || '').toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCommunity && !matchesDev && !matchesId) return false;
      }

      // Community filter
      if (selectedCommunity !== 'ALL' && p.community !== selectedCommunity) {
        return false;
      }

      // Severity / Requirement filter
      if (auditSeverityFilter === 'critical') {
        return audit.criticalIssues.length > 0;
      }
      if (auditSeverityFilter === 'missing_rera') {
        return audit.criticalIssues.some(i => i.field === 'rera_id');
      }
      if (auditSeverityFilter === 'missing_payment') {
        return audit.warningIssues.some(i => i.field === 'payment_plan' || i.field === 'handover_date');
      }
      if (auditSeverityFilter === 'sales_ready') {
        return audit.status === 'sales_ready';
      }

      return true;
    });
  }, [requirementAudits, searchQuery, selectedCommunity, auditSeverityFilter]);

  // Communities list for dropdown
  const uniqueCommunities = useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => { if (p.community) set.add(p.community); });
    return Array.from(set).sort();
  }, [properties]);

  // Summary Metrics
  const totalIncompleteCount = requirementAudits.filter(a => a.status !== 'sales_ready').length;
  const criticalIssuesCount = requirementAudits.filter(a => a.criticalIssues.length > 0).length;
  const avgCompleteness = requirementAudits.length > 0
    ? Math.round(requirementAudits.reduce((acc, a) => acc + a.completenessScore, 0) / requirementAudits.length)
    : 100;

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Delete duplicate property
  const handleDeleteDuplicate = async (dupProperty: PropertyListing) => {
    if (!window.confirm(`Are you sure you want to permanently delete redundant listing "${dupProperty.title}" (${dupProperty.id})?`)) {
      return;
    }
    try {
      await onDeleteProperty(dupProperty.id);
      triggerToast(`Removed redundant listing ${dupProperty.id} from inventory.`, 'success');
    } catch (err: any) {
      triggerToast(`Failed to delete: ${err.message}`, 'info');
    }
  };

  // Merge requirements: Copy non-empty fields from duplicate to primary, then delete duplicate
  const handleMergeAndKeepPrimary = async (primary: PropertyListing, duplicate: PropertyListing) => {
    const merged: PropertyListing = {
      ...primary,
      rera_id: primary.rera_id || duplicate.rera_id,
      payment_plan: primary.payment_plan || duplicate.payment_plan,
      handover_date: primary.handover_date || duplicate.handover_date,
      expected_roi: primary.expected_roi || duplicate.expected_roi,
      bathrooms: primary.bathrooms || duplicate.bathrooms,
      contact_name: primary.contact_name || duplicate.contact_name,
      contact_mobile: primary.contact_mobile || duplicate.contact_mobile,
      description: (primary.description && primary.description.length > (duplicate.description?.length || 0))
        ? primary.description
        : (duplicate.description || primary.description),
      image_url: primary.image_url || duplicate.image_url,
      amenities: Array.from(new Set([...(primary.amenities || []), ...(duplicate.amenities || [])]))
    };

    try {
      await onUpdateProperty(merged);
      await onDeleteProperty(duplicate.id);
      triggerToast(`Merged data into master listing (${primary.id}) & deleted duplicate (${duplicate.id}).`, 'success');
    } catch (err: any) {
      triggerToast(`Merge failed: ${err.message}`, 'info');
    }
  };

  // Add a test duplicate to showcase the engine
  const handleAddTestDuplicate = async () => {
    if (properties.length === 0) return;
    const base = properties[0];
    const testDup: PropertyListing = {
      ...base,
      id: `LYKA-DUP-${Math.floor(1000 + Math.random() * 9000)}`,
      title: `${base.title} (Duplicate Copy)`,
      price_aed: base.price_aed,
      createdAt: new Date().toISOString()
    };
    if (onAddProperty) {
      await onAddProperty(testDup);
      triggerToast(`Created test duplicate listing: ${testDup.id}`, 'info');
    }
  };

  // Open Quick Fix modal
  const handleOpenQuickFix = (property: PropertyListing) => {
    setEditingAuditProperty(property);
    setQuickFixForm({
      rera_id: property.rera_id || '',
      price_aed: property.price_aed || 0,
      size_sqft: property.size_sqft || 0,
      developer: property.developer || '',
      handover_date: property.handover_date || '',
      payment_plan: property.payment_plan || '',
      expected_roi: property.expected_roi || '',
      bathrooms: property.bathrooms || '',
      image_url: property.image_url || '',
      description: property.description || '',
      contact_name: property.contact_name || '',
      contact_mobile: property.contact_mobile || ''
    });
  };

  // Save Quick Fix
  const handleSaveQuickFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuditProperty) return;

    const updated: PropertyListing = {
      ...editingAuditProperty,
      ...quickFixForm,
      price_aed: Number(quickFixForm.price_aed) || editingAuditProperty.price_aed,
      price_inr: Math.round((Number(quickFixForm.price_aed) || editingAuditProperty.price_aed) * 22.8),
      size_sqft: Number(quickFixForm.size_sqft) || editingAuditProperty.size_sqft,
      updatedAt: new Date().toISOString()
    };

    try {
      await onUpdateProperty(updated);
      setEditingAuditProperty(null);
      triggerToast(`Successfully updated sales requirements for ${updated.title}!`, 'success');
    } catch (err: any) {
      triggerToast(`Failed to update property: ${err.message}`, 'info');
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen pb-16">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 text-emerald-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{saveToast.message}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border-b border-emerald-800/30 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Sales Manager Portal
                </span>
                <span className="text-xs text-slate-400">Lyka Quality Assurance</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center space-x-2">
                <span>Property Duplicate & Quality Audit Control</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Scan for duplicate property records across your Dubai inventory, and enforce essential sales requirements before listings are presented to buyers.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 shadow-sm">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px]">DB: Sales_login</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Connected to Firestore DB" />
              </div>
              <button
                onClick={handleAddTestDuplicate}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-all shadow-sm"
                title="Create a sample duplicate to test duplicate detection"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Test Duplicate</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Total Properties</span>
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-xl font-black text-white mt-1">{properties.length}</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Active Dubai & Mumbai listings</p>
            </div>

            <div className={`border rounded-2xl p-3.5 transition-all ${
              duplicateGroups.length > 0
                ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-200'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Duplicate Groups</span>
                <Copy className={`w-3.5 h-3.5 ${duplicateGroups.length > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
              </div>
              <div className="text-xl font-black mt-1 flex items-baseline space-x-1.5">
                <span className={duplicateGroups.length > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {duplicateGroups.length}
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  {duplicateGroups.length > 0 ? 'groups detected' : 'clean catalog'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {duplicateGroups.length > 0 ? 'Action needed to clean records' : 'No duplicates detected'}
              </p>
            </div>

            <div className={`border rounded-2xl p-3.5 transition-all ${
              criticalIssuesCount > 0
                ? 'bg-amber-950/20 border-amber-800/40'
                : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Incomplete Listings</span>
                <ShieldAlert className={`w-3.5 h-3.5 ${criticalIssuesCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <div className="text-xl font-black text-white mt-1 flex items-baseline space-x-1.5">
                <span className={totalIncompleteCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  {totalIncompleteCount}
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  ({criticalIssuesCount} critical)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Missing RERA, price, or details</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Catalog Health Score</span>
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1">{avgCompleteness}%</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Average requirement completeness</p>
            </div>
          </div>

          {/* Sub-Tabs Switcher */}
          <div className="flex items-center space-x-2 mt-6 border-b border-slate-800/80 -mb-6">
            <button
              onClick={() => setTab('duplicates')}
              className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs border-b-2 transition-all ${
                activeTab === 'duplicates'
                  ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-t-xl'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Properties</span>
              {duplicateGroups.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {duplicateGroups.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab('missing_requirements')}
              className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs border-b-2 transition-all ${
                activeTab === 'missing_requirements'
                  ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-t-xl'
              }`}
            >
              <BadgeAlert className="w-3.5 h-3.5" />
              <span>Missing Requirements Audit</span>
              {totalIncompleteCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-amber-950">
                  {totalIncompleteCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-10">

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: DUPLICATE PROPERTIES */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'duplicates' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                  <Copy className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Duplicate Property Detection System</h3>
                  <p className="text-xs text-slate-400">
                    Matches listings based on identical titles, RERA IDs, matching hero photos, or identical specs in the same community.
                  </p>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400">
                Found <span className="text-white font-bold">{duplicateGroups.length}</span> duplicate cluster(s)
              </div>
            </div>

            {/* If No Duplicates Found */}
            {duplicateGroups.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h4 className="text-base font-bold text-white">No Duplicate Properties Detected!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  All listings in your inventory currently have unique titles, specifications, and permits. Your catalog is clean.
                </p>
                <div className="mt-5">
                  <button
                    onClick={handleAddTestDuplicate}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Generate Test Duplicate to View Detection</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Duplicate Groups Cards */
              <div className="space-y-6">
                {duplicateGroups.map((group, gIdx) => {
                  const primary = group.primaryProperty;
                  const duplicates = group.duplicateProperties;

                  return (
                    <div 
                      key={group.id}
                      className="bg-slate-900/80 border border-rose-900/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden"
                    >
                      {/* Top banner tag */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400 mr-1" />
                            <span>{group.confidence}% Match Confidence</span>
                          </span>
                          <span className="text-xs font-medium text-slate-300">
                            Reason: <strong className="text-slate-100">{group.reason}</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => setDismissedDuplicateGroupIds(prev => [...prev, group.id])}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Ignore this cluster in this session"
                        >
                          Dismiss / Not Duplicate
                        </button>
                      </div>

                      {/* Side-by-side comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {/* Primary Listing */}
                        <div className="bg-slate-950/70 border-2 border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between relative">
                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Master / Primary Listing
                          </div>

                          <div>
                            <div className="flex items-start space-x-3">
                              {primary.image_url ? (
                                <img
                                  src={primary.image_url}
                                  alt={primary.title}
                                  className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-6 h-6 text-slate-600" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 pr-16">
                                <span className="text-[10px] font-mono text-emerald-400">{primary.id}</span>
                                <h4 className="text-sm font-bold text-white truncate">{primary.title}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{primary.community} • {primary.property_type}</p>
                              </div>
                            </div>

                            {/* Key specs comparison */}
                            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Price</span>
                                <span className="font-bold text-emerald-300">AED {primary.price_aed ? primary.price_aed.toLocaleString() : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Size</span>
                                <span className="font-semibold text-slate-200">{primary.size_sqft ? `${primary.size_sqft} sqft` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Bedrooms</span>
                                <span className="font-semibold text-slate-200">{primary.bedrooms} BR</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">RERA Permit</span>
                                <span className="font-mono text-slate-200">{primary.rera_id || 'None'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Developer</span>
                                <span className="text-slate-200 truncate">{primary.developer || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Status</span>
                                <span className="text-slate-200">{primary.status || 'Ready'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Kept as master reference</span>
                            </span>
                            <button
                              onClick={() => handleOpenQuickFix(primary)}
                              className="text-[11px] font-semibold text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                              Edit Master
                            </button>
                          </div>
                        </div>

                        {/* Conflicting Duplicate(s) */}
                        <div className="space-y-3">
                          {duplicates.map((dup) => (
                            <div 
                              key={dup.id}
                              className="bg-slate-950/70 border-2 border-rose-500/40 rounded-2xl p-4 flex flex-col justify-between relative"
                            >
                              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Redundant Duplicate
                              </div>

                              <div>
                                <div className="flex items-start space-x-3">
                                  {dup.image_url ? (
                                    <img
                                      src={dup.image_url}
                                      alt={dup.title}
                                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="w-6 h-6 text-slate-600" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1 pr-16">
                                    <span className="text-[10px] font-mono text-rose-400">{dup.id}</span>
                                    <h4 className="text-sm font-bold text-white truncate">{dup.title}</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">{dup.community} • {dup.property_type}</p>
                                  </div>
                                </div>

                                {/* Specs */}
                                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">Price</span>
                                    <span className="font-bold text-slate-200">AED {dup.price_aed ? dup.price_aed.toLocaleString() : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">Size</span>
                                    <span className="font-semibold text-slate-200">{dup.size_sqft ? `${dup.size_sqft} sqft` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">Bedrooms</span>
                                    <span className="font-semibold text-slate-200">{dup.bedrooms} BR</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">RERA Permit</span>
                                    <span className="font-mono text-slate-200">{dup.rera_id || 'None'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">Developer</span>
                                    <span className="text-slate-200 truncate">{dup.developer || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">Status</span>
                                    <span className="text-slate-200">{dup.status || 'Ready'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons on duplicate */}
                              <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-end gap-2">
                                <button
                                  onClick={() => handleMergeAndKeepPrimary(primary, dup)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/50 transition-all"
                                  title="Merge missing fields into master listing, then delete this duplicate"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Merge & Delete Duplicate</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteDuplicate(dup)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/50 transition-all"
                                  title="Permanently remove this duplicate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Duplicate</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: MISSING REQUIREMENTS AUDIT */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'missing_requirements' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by property title, community, ID, or developer..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Severity / Issue Type Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setAuditSeverityFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  All ({requirementAudits.length})
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('critical')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    auditSeverityFilter === 'critical'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-rose-300 hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Critical ({criticalIssuesCount})</span>
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('missing_rera')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'missing_rera'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  Missing RERA
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('missing_payment')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'missing_payment'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  Missing Payment/Handover
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('sales_ready')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
                    auditSeverityFilter === 'sales_ready'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-slate-800/60 text-emerald-400 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready ({requirementAudits.filter(a => a.status === 'sales_ready').length})</span>
                </button>
              </div>

              {/* Community Selector */}
              <div className="flex-shrink-0">
                <select
                  value={selectedCommunity}
                  onChange={(e) => setSelectedCommunity(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Communities</option>
                  {uniqueCommunities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audit Cards Grid */}
            {filteredAudits.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-white">No properties matching filter</h4>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting a different severity filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAudits.map((audit) => {
                  const p = audit.property;
                  const totalMissing = audit.criticalIssues.length + audit.warningIssues.length + audit.infoIssues.length;

                  return (
                    <div
                      key={p.id}
                      className={`bg-slate-900/80 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${
                        audit.status === 'action_required'
                          ? 'border-rose-800/50 shadow-md shadow-rose-950/20'
                          : audit.status === 'incomplete'
                          ? 'border-amber-800/40'
                          : 'border-slate-800'
                      }`}
                    >
                      <div>
                        {/* Top header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3 min-w-0">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.title}
                                className="w-14 h-14 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-slate-950 border border-rose-500/40 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono text-emerald-400">{p.id}</span>
                                <span className="text-[10px] text-slate-400">• {p.community}</span>
                              </div>
                              <h4 className="text-xs font-bold text-white truncate mt-0.5">{p.title}</h4>
                              <p className="text-[11px] text-slate-400 truncate">
                                {p.developer || 'No Developer Listed'} • AED {p.price_aed ? p.price_aed.toLocaleString() : 'Price Missing'}
                              </p>
                            </div>
                          </div>

                          {/* Completeness Badge */}
                          <div className="flex-shrink-0 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                              audit.completenessScore >= 85
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : audit.completenessScore >= 65
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {audit.completenessScore}% Complete
                            </span>
                          </div>
                        </div>

                        {/* Completeness progress bar */}
                        <div className="w-full bg-slate-950 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              audit.completenessScore >= 85
                                ? 'bg-emerald-500'
                                : audit.completenessScore >= 65
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${audit.completenessScore}%` }}
                          />
                        </div>

                        {/* Missing tags chips */}
                        <div className="mt-3.5 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {totalMissing === 0 ? 'Requirements Status' : `Missing Requirements (${totalMissing})`}:
                          </div>

                          {totalMissing === 0 ? (
                            <div className="flex items-center space-x-1.5 text-xs text-emerald-300 font-semibold py-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>100% Sales Ready — All mandatory & recommended fields populated.</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {/* Critical Issues */}
                              {audit.criticalIssues.map((issue) => (
                                <span
                                  key={issue.field}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950/60 text-rose-200 border border-rose-500/50"
                                  title={issue.description}
                                >
                                  <X className="w-3 h-3 text-rose-400" />
                                  <span>Missing {issue.label}</span>
                                </span>
                              ))}

                              {/* Warning Issues */}
                              {audit.warningIssues.map((issue) => (
                                <span
                                  key={issue.field}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/50 text-amber-200 border border-amber-500/40"
                                  title={issue.description}
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>Missing {issue.label}</span>
                                </span>
                              ))}

                              {/* Info Issues */}
                              {audit.infoIssues.map((issue) => (
                                <span
                                  key={issue.field}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                                  title={issue.description}
                                >
                                  <Info className="w-3 h-3 text-slate-400" />
                                  <span>{issue.label}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card bottom action */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {p.status || 'Ready'} • {p.property_type}
                        </span>

                        <button
                          onClick={() => handleOpenQuickFix(p)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Quick Fix / Fill Data</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* QUICK FIX MODAL FOR SALES MANAGER */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {editingAuditProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Fill Missing Requirements</h3>
                  <p className="text-[11px] text-slate-400">{editingAuditProperty.title} ({editingAuditProperty.id})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAuditProperty(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuickFix} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-200 leading-relaxed">
                Enter the missing details below. Saving will update both local cache and Firestore database, updating the property completeness score immediately.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RERA Permit */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>RERA Permit ID</span>
                    <span className="text-[10px] text-rose-400 font-bold uppercase">*Dubai Law</span>
                  </label>
                  <input
                    type="text"
                    value={quickFixForm.rera_id || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, rera_id: e.target.value })}
                    placeholder="e.g. RERA-78921-DXB"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Asking Price */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>Price (AED)</span>
                    <span className="text-[10px] text-rose-400 font-bold uppercase">*Mandatory</span>
                  </label>
                  <input
                    type="number"
                    value={quickFixForm.price_aed || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, price_aed: Number(e.target.value) })}
                    placeholder="e.g. 1850000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Size Sqft */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>Size (Sq.Ft)</span>
                    <span className="text-[10px] text-rose-400 font-bold uppercase">*Mandatory</span>
                  </label>
                  <input
                    type="number"
                    value={quickFixForm.size_sqft || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, size_sqft: Number(e.target.value) })}
                    placeholder="e.g. 1240"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Developer */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Developer Name</label>
                  <input
                    type="text"
                    value={quickFixForm.developer || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, developer: e.target.value })}
                    placeholder="e.g. Emaar, Damac, Sobha"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Handover Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Handover Date / Completion</label>
                  <input
                    type="text"
                    value={quickFixForm.handover_date || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, handover_date: e.target.value })}
                    placeholder="e.g. Ready, or Q4 2026"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Payment Plan */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Payment Plan</label>
                  <input
                    type="text"
                    value={quickFixForm.payment_plan || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, payment_plan: e.target.value })}
                    placeholder="e.g. 60/40 on handover, 20% down payment"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Expected ROI */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Expected Net ROI</label>
                  <input
                    type="text"
                    value={quickFixForm.expected_roi || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, expected_roi: e.target.value })}
                    placeholder="e.g. 7.8% net ROI"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Bathrooms */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Bathrooms</label>
                  <input
                    type="text"
                    value={quickFixForm.bathrooms || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, bathrooms: e.target.value })}
                    placeholder="e.g. 2 or 3"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Photo Image URL */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Property Image URL</label>
                <input
                  type="url"
                  value={quickFixForm.image_url || ''}
                  onChange={(e) => setQuickFixForm({ ...quickFixForm, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Property Description</label>
                <textarea
                  rows={3}
                  value={quickFixForm.description || ''}
                  onChange={(e) => setQuickFixForm({ ...quickFixForm, description: e.target.value })}
                  placeholder="Write an appealing overview with amenities and luxury finishes..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Contact Agent Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Assigned Agent Name</label>
                  <input
                    type="text"
                    value={quickFixForm.contact_name || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, contact_name: e.target.value })}
                    placeholder="e.g. Tariq Mansoor"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Agent Mobile Phone</label>
                  <input
                    type="tel"
                    value={quickFixForm.contact_mobile || ''}
                    onChange={(e) => setQuickFixForm({ ...quickFixForm, contact_mobile: e.target.value })}
                    placeholder="+971 50 123 4567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingAuditProperty(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Save & Complete Requirements</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
