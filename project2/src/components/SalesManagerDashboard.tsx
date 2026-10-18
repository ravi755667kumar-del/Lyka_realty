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
  ExternalLink,
  ChevronDown,
  Database,
  MapPin,
  DollarSign
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
  const [priceFilter, setPriceFilter] = useState<'ALL' | 'UNDER_1_5M' | '1_5M_3M' | '3M_6M' | 'ABOVE_6M'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'READY' | 'OFF_PLAN' | 'BOOKED' | 'AVAILABLE'>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'critical' | 'missing_rera' | 'missing_payment' | 'sales_ready'>('all');
  const [dismissedDuplicateGroupIds, setDismissedDuplicateGroupIds] = useState<string[]>([]);

  // Toast feedback
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
          if (normTitle1 && normTitle2 && (normTitle1 === normTitle2 || normTitle1.includes(normTitle2) || normTitle2.includes(normTitle1))) {
            isMatch = true;
            matchScore = normTitle1 === normTitle2 ? 98 : 94;
            matchReason = normTitle1 === normTitle2 ? 'Identical Project Title and Listing Name' : 'Matching Project Title / Variant Copy';
            matchType = 'exact_title';
          } else {
            const words2 = new Set(normTitle2.split(' ').filter(w => w.length > 2));
            const intersection = [...words1].filter(w => words2.has(w)).length;
            const union = new Set([...words1, ...words2]).size;
            const jaccard = union > 0 ? intersection / union : 0;
            if (jaccard >= 0.55 && p1.community.toLowerCase() === p2.community.toLowerCase()) {
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

      // Location / Community filter
      if (selectedCommunity !== 'ALL' && p.community.toLowerCase() !== selectedCommunity.toLowerCase()) {
        return false;
      }

      // Price filter
      if (priceFilter !== 'ALL') {
        const pr = Number(p.price_aed) || 0;
        if (priceFilter === 'UNDER_1_5M' && (pr <= 0 || pr >= 1500000)) return false;
        if (priceFilter === '1_5M_3M' && (pr < 1500000 || pr > 3000000)) return false;
        if (priceFilter === '3M_6M' && (pr < 3000000 || pr > 6000000)) return false;
        if (priceFilter === 'ABOVE_6M' && pr <= 6000000) return false;
      }

      // Availability filter
      if (availabilityFilter !== 'ALL') {
        const isBooked = Boolean(p.is_booked || (p.status || '').toLowerCase() === 'booked');
        const st = (p.status || '').toLowerCase();
        if (availabilityFilter === 'BOOKED' && !isBooked) return false;
        if (availabilityFilter === 'AVAILABLE' && isBooked) return false;
        if (availabilityFilter === 'READY' && (st !== 'ready' || isBooked)) return false;
        if (availabilityFilter === 'OFF_PLAN' && (st !== 'off-plan' && st !== 'off_plan')) return false;
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
  }, [requirementAudits, searchQuery, selectedCommunity, priceFilter, availabilityFilter, auditSeverityFilter]);

  // Filtered duplicate groups
  const filteredDuplicateGroups = useMemo(() => {
    return duplicateGroups.filter((group) => {
      const p = group.primaryProperty;
      if (selectedCommunity !== 'ALL' && p.community.toLowerCase() !== selectedCommunity.toLowerCase()) {
        return false;
      }
      if (priceFilter !== 'ALL') {
        const pr = Number(p.price_aed) || 0;
        if (priceFilter === 'UNDER_1_5M' && (pr <= 0 || pr >= 1500000)) return false;
        if (priceFilter === '1_5M_3M' && (pr < 1500000 || pr > 3000000)) return false;
        if (priceFilter === '3M_6M' && (pr < 3000000 || pr > 6000000)) return false;
        if (priceFilter === 'ABOVE_6M' && pr <= 6000000) return false;
      }
      if (availabilityFilter !== 'ALL') {
        const isBooked = Boolean(p.is_booked || (p.status || '').toLowerCase() === 'booked');
        const st = (p.status || '').toLowerCase();
        if (availabilityFilter === 'BOOKED' && !isBooked) return false;
        if (availabilityFilter === 'AVAILABLE' && isBooked) return false;
        if (availabilityFilter === 'READY' && (st !== 'ready' || isBooked)) return false;
        if (availabilityFilter === 'OFF_PLAN' && (st !== 'off-plan' && st !== 'off_plan')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchP = p.title.toLowerCase().includes(q) || p.community.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
        const matchDups = group.duplicateProperties.some(d => d.title.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
        if (!matchP && !matchDups) return false;
      }
      return true;
    });
  }, [duplicateGroups, selectedCommunity, priceFilter, availabilityFilter, searchQuery]);

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

  // Delete duplicate listing permanently
  const handleDeleteDuplicate = async (property: PropertyListing) => {
    if (!window.confirm(`Are you sure you want to permanently delete listing "${property.title}" (${property.id})?`)) {
      return;
    }
    try {
      await onDeleteProperty(property.id);
      triggerToast(`Permanently deleted listing ${property.id} from inventory.`, 'success');
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
      if (onUpdateProperty) await onUpdateProperty(merged);
      await onDeleteProperty(duplicate.id);
      triggerToast(`Merged data into master listing (${primary.id}) & deleted duplicate (${duplicate.id}).`, 'success');
    } catch (err: any) {
      triggerToast(`Merge failed: ${err.message}`, 'info');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-24">
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
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 mt-1 flex items-center space-x-2">
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
            </div>
          </div>

          {/* Metric Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Total Properties</span>
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="text-xl font-black text-slate-100 mt-1">{properties.length}</div>
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
              <div className="text-xl font-black text-slate-100 mt-1 flex items-baseline space-x-1.5">
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
        {/* SHARED FILTER & SEARCH TOOLBAR (Location, Price, Availability) */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl space-y-3 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Filter Inventory ({properties.length} Total Properties)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Filter listings by Location (Community), Price Range, and Availability
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, community, ID, developer..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* 2. Location / Community Filter */}
            <div className="relative">
              <MapPin className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCommunity}
                onChange={(e) => setSelectedCommunity(e.target.value)}
                aria-label="Filter by Location"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-8 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="ALL">All Locations / Communities ({uniqueCommunities.length})</option>
                {uniqueCommunities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 3. Price Range Filter */}
            <div className="relative">
              <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as any)}
                aria-label="Filter by Price"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-8 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="ALL">All Price Ranges</option>
                <option value="UNDER_1_5M">Under 1.5M AED</option>
                <option value="1_5M_3M">1.5M - 3M AED</option>
                <option value="3M_6M">3M - 6M AED</option>
                <option value="ABOVE_6M">Above 6M AED</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 4. Availability Filter */}
            <div className="relative">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                aria-label="Filter by Availability"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-8 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="ALL">All Availability Statuses</option>
                <option value="AVAILABLE">Available (Unbooked)</option>
                <option value="READY">Ready to Move</option>
                <option value="OFF_PLAN">Off-Plan / Payment Plan</option>
                <option value="BOOKED">Booked / Reserved</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Active Filter Chips & Reset */}
          {(selectedCommunity !== 'ALL' || priceFilter !== 'ALL' || availabilityFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
                <span className="font-semibold text-slate-300">Active Filters:</span>
                {selectedCommunity !== 'ALL' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span>Location: {selectedCommunity}</span>
                    <button onClick={() => setSelectedCommunity('ALL')} className="hover:text-white font-bold ml-1 text-xs">×</button>
                  </span>
                )}
                {priceFilter !== 'ALL' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span>Price: {priceFilter === 'UNDER_1_5M' ? '< 1.5M AED' : priceFilter === '1_5M_3M' ? '1.5M - 3M AED' : priceFilter === '3M_6M' ? '3M - 6M AED' : '> 6M AED'}</span>
                    <button onClick={() => setPriceFilter('ALL')} className="hover:text-white font-bold ml-1 text-xs">×</button>
                  </span>
                )}
                {availabilityFilter !== 'ALL' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span>Availability: {availabilityFilter === 'AVAILABLE' ? 'Available' : availabilityFilter === 'READY' ? 'Ready to Move' : availabilityFilter === 'OFF_PLAN' ? 'Off-Plan' : 'Booked'}</span>
                    <button onClick={() => setAvailabilityFilter('ALL')} className="hover:text-white font-bold ml-1 text-xs">×</button>
                  </span>
                )}
                {searchQuery.trim() !== '' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span>Search: "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="hover:text-white font-bold ml-1 text-xs">×</button>
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedCommunity('ALL');
                  setPriceFilter('ALL');
                  setAvailabilityFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-red-700 hover:text-red-900 underline transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: DUPLICATE PROPERTIES */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'duplicates' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center">
                  <Copy className="w-4 h-4 text-red-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Duplicate Property Detection System</h3>
                  <p className="text-xs text-slate-200 font-medium">
                    Matches listings based on identical titles, RERA IDs, matching hero photos, or identical specs in the same community.
                  </p>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-200">
                Found <span className="text-slate-100 font-bold">{filteredDuplicateGroups.length}</span> duplicate cluster(s)
                {duplicateGroups.length !== filteredDuplicateGroups.length && (
                  <span className="text-slate-300 font-medium"> (filtered from {duplicateGroups.length})</span>
                )}
              </div>
            </div>

            {/* If No Duplicates Found */}
            {filteredDuplicateGroups.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-700" />
                </div>
                <h4 className="text-base font-bold text-slate-100">
                  {duplicateGroups.length === 0 ? 'No Duplicate Properties Detected!' : 'No Duplicates Match Filter Criteria'}
                </h4>
                <p className="text-xs text-slate-200 mt-1 max-w-md mx-auto">
                  {duplicateGroups.length === 0
                    ? 'All listings in your inventory currently have unique titles, specifications, and permits. Your catalog is clean.'
                    : 'Try clearing or adjusting your location, price, or availability filters to view other duplicate groups.'}
                </p>
              </div>
            ) : (
              /* Duplicate Groups Cards */
              <div className="space-y-6">
                {filteredDuplicateGroups.map((group, gIdx) => {
                  const primary = group.primaryProperty;
                  const duplicates = group.duplicateProperties;

                  return (
                    <div 
                      key={group.id}
                      className="bg-slate-900/90 border border-rose-300/80 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden"
                    >
                      {/* Top banner tag */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-700/80">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-rose-100 text-red-950 border border-rose-300 flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-700 mr-1" />
                            <span>{group.confidence}% Match Confidence</span>
                          </span>
                          <span className="text-xs font-medium text-slate-100">
                            Reason: <strong className="text-slate-100 font-bold">{group.reason}</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => setDismissedDuplicateGroupIds(prev => [...prev, group.id])}
                          className="text-xs font-bold text-slate-200 hover:text-slate-100 px-3 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Ignore this cluster in this session"
                        >
                          Dismiss / Not Duplicate
                        </button>
                      </div>

                      {/* Side-by-side comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {/* Primary Listing */}
                        <div className="bg-white border-2 border-emerald-500/60 rounded-2xl p-4 flex flex-col justify-between relative shadow-sm">
                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 border border-emerald-400">
                            Master / Primary Listing
                          </div>

                          <div>
                            <div className="flex items-start space-x-3">
                              {primary.image_url ? (
                                <img
                                  src={primary.image_url}
                                  alt={primary.title}
                                  className="w-16 h-16 rounded-xl object-cover border border-slate-300 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-6 h-6 text-slate-500" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 pr-16">
                                <span className="text-[11px] font-mono font-bold text-emerald-700">{primary.id}</span>
                                <h4 className="text-sm font-bold text-slate-100 truncate">{primary.title}</h4>
                                <p className="text-xs text-slate-200 font-medium mt-0.5">{primary.community} • {primary.property_type}</p>
                              </div>
                            </div>

                            {/* Key specs comparison */}
                            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 text-xs">
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">Price</span>
                                <span className="font-extrabold text-emerald-800">AED {primary.price_aed ? primary.price_aed.toLocaleString() : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">Size</span>
                                <span className="font-bold text-slate-100">{primary.size_sqft ? `${primary.size_sqft} sqft` : 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">Bedrooms</span>
                                <span className="font-bold text-slate-100">{primary.bedrooms} BR</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">RERA Permit</span>
                                <span className="font-mono text-slate-100 font-bold">{primary.rera_id || 'None'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">Developer</span>
                                <span className="text-slate-100 font-bold truncate">{primary.developer || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-200 font-bold block">Status</span>
                                <span className="text-slate-100 font-bold">{primary.status || 'Ready'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                            <span className="text-xs text-emerald-800 font-bold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Kept as master reference</span>
                            </span>
                            <button
                              onClick={() => handleDeleteDuplicate(primary)}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-red-700 text-red-900 hover:text-white border border-rose-300 transition-all shadow-sm"
                              title="Permanently remove this master listing from inventory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Master</span>
                            </button>
                          </div>
                        </div>

                        {/* Conflicting Duplicate(s) */}
                        <div className="space-y-3">
                          {duplicates.map((dup) => (
                            <div 
                              key={dup.id}
                              className="bg-white border-2 border-rose-400/70 rounded-2xl p-4 flex flex-col justify-between relative shadow-sm"
                            >
                              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-red-950 border border-rose-400">
                                Redundant Duplicate
                              </div>

                              <div>
                                <div className="flex items-start space-x-3">
                                  {dup.image_url ? (
                                    <img
                                      src={dup.image_url}
                                      alt={dup.title}
                                      className="w-16 h-16 rounded-xl object-cover border border-slate-300 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="w-6 h-6 text-slate-500" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1 pr-16">
                                    <span className="text-[11px] font-mono font-bold text-red-700">{dup.id}</span>
                                    <h4 className="text-sm font-bold text-slate-100 truncate">{dup.title}</h4>
                                    <p className="text-xs text-slate-200 font-medium mt-0.5">{dup.community} • {dup.property_type}</p>
                                  </div>
                                </div>

                                {/* Specs */}
                                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 text-xs">
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">Price</span>
                                    <span className="font-extrabold text-slate-100">AED {dup.price_aed ? dup.price_aed.toLocaleString() : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">Size</span>
                                    <span className="font-bold text-slate-100">{dup.size_sqft ? `${dup.size_sqft} sqft` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">Bedrooms</span>
                                    <span className="font-bold text-slate-100">{dup.bedrooms} BR</span>
                                  </div>
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">RERA Permit</span>
                                    <span className="font-mono text-slate-100 font-bold">{dup.rera_id || 'None'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">Developer</span>
                                    <span className="text-slate-100 font-bold truncate">{dup.developer || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[11px] text-slate-200 font-bold block">Status</span>
                                    <span className="text-slate-100 font-bold">{dup.status || 'Ready'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons on duplicate */}
                              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
                                <button
                                  onClick={() => handleMergeAndKeepPrimary(primary, dup)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all shadow-sm"
                                  title="Merge missing fields into master listing, then delete this duplicate"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Merge & Delete Duplicate</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteDuplicate(dup)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white transition-all shadow-sm"
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
            {/* Severity / Quality Status Sub-Tabs */}
            <div className="bg-slate-900/60 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAuditSeverityFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'all'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-white text-slate-100 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  All Properties ({requirementAudits.length})
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('critical')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    auditSeverityFilter === 'critical'
                      ? 'bg-red-700 text-white shadow-md'
                      : 'bg-rose-50 text-red-950 hover:bg-rose-100 border border-rose-300 font-bold'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-700" />
                  <span>Critical Mandatory ({criticalIssuesCount})</span>
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('missing_rera')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'missing_rera'
                      ? 'bg-amber-700 text-white shadow-md'
                      : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 font-bold'
                  }`}
                >
                  Missing RERA Permit ({requirementAudits.filter(a => a.criticalIssues.some(i => i.field === 'rera_id')).length})
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('missing_payment')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    auditSeverityFilter === 'missing_payment'
                      ? 'bg-amber-700 text-white shadow-md'
                      : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 font-bold'
                  }`}
                >
                  Missing Payment/Handover ({requirementAudits.filter(a => a.warningIssues.some(i => i.field === 'payment_plan' || i.field === 'handover_date')).length})
                </button>

                <button
                  onClick={() => setAuditSeverityFilter('sales_ready')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
                    auditSeverityFilter === 'sales_ready'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-300 font-bold'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Sales Ready ({requirementAudits.filter(a => a.status === 'sales_ready').length})</span>
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-200">
                Showing <span className="text-slate-100 font-bold">{filteredAudits.length}</span> of <span className="text-slate-100 font-bold">{requirementAudits.length}</span> audited listing(s)
              </div>
            </div>

            {/* Audit Cards Grid */}
            {filteredAudits.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-100">No properties matching filter</h4>
                <p className="text-xs text-slate-200 mt-1">Try clearing your search query or selecting a different severity filter.</p>
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
                          ? 'border-rose-400/60 shadow-md shadow-rose-950/10'
                          : audit.status === 'incomplete'
                          ? 'border-amber-400/50'
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
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-mono text-emerald-700 font-bold">{p.id}</span>
                                <span className="text-[11px] text-slate-200 font-semibold">• {p.community}</span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-100 truncate mt-0.5">{p.title}</h4>
                              <p className="text-xs text-slate-200 font-semibold truncate">
                                {p.developer || 'No Developer Listed'} • AED {p.price_aed ? p.price_aed.toLocaleString() : 'Price Missing'}
                              </p>
                            </div>
                          </div>

                          {/* Completeness Badge */}
                          <div className="flex-shrink-0 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black ${
                              audit.completenessScore >= 85
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-400'
                                : audit.completenessScore >= 65
                                ? 'bg-amber-100 text-amber-950 border border-amber-400'
                                : 'bg-rose-100 text-red-950 border border-rose-400'
                            }`}>
                              {audit.completenessScore}% Complete
                            </span>
                          </div>
                        </div>

                        {/* Completeness progress bar */}
                        <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden border border-slate-300/60">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              audit.completenessScore >= 85
                                ? 'bg-emerald-600'
                                : audit.completenessScore >= 65
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${audit.completenessScore}%` }}
                          />
                        </div>

                        {/* What Needs To Be Filled Section */}
                        <div className="mt-4 pt-3 border-t border-slate-700/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center space-x-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              <span>What Needs To Be Filled</span>
                            </span>
                            <span className="text-xs text-slate-200 font-semibold">
                              {totalMissing === 0 ? '0 fields missing' : `${totalMissing} item(s) required`}
                            </span>
                          </div>

                          {totalMissing === 0 ? (
                            <div className="flex items-center space-x-2 text-xs font-bold text-slate-100 bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 shadow-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                              <span className="text-slate-100">100% Sales Ready — All mandatory Dubai legal and presentation requirements are complete!</span>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {/* 1. Critical Issues Checklist */}
                              {audit.criticalIssues.length > 0 && (
                                <div className="bg-rose-50/95 border-2 border-rose-300 rounded-xl p-3 space-y-2 shadow-xs">
                                  <div className="text-[11px] font-black uppercase tracking-wider text-red-800 flex items-center space-x-1.5">
                                    <ShieldAlert className="w-4 h-4 text-red-700 flex-shrink-0" />
                                    <span>Critical / Dubai Law Mandatory:</span>
                                  </div>
                                  <ul className="space-y-1.5 pl-0.5">
                                    {audit.criticalIssues.map((issue) => (
                                      <li key={issue.field} className="text-xs text-slate-100 flex items-start space-x-2 leading-relaxed">
                                        <X className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5 font-bold" />
                                        <span className="text-slate-100">
                                          <strong className="text-slate-100 font-bold">{issue.label}:</strong>{' '}
                                          <span className="text-slate-200 font-medium">{issue.description}</span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* 2. Warning Issues Checklist */}
                              {audit.warningIssues.length > 0 && (
                                <div className="bg-amber-50/95 border-2 border-amber-300 rounded-xl p-3 space-y-2 shadow-xs">
                                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                                    <span>Important Sales Information:</span>
                                  </div>
                                  <ul className="space-y-1.5 pl-0.5">
                                    {audit.warningIssues.map((issue) => (
                                      <li key={issue.field} className="text-xs text-slate-100 flex items-start space-x-2 leading-relaxed">
                                        <span className="w-2 h-2 rounded-full bg-amber-700 flex-shrink-0 mt-1.5" />
                                        <span className="text-slate-100">
                                          <strong className="text-slate-100 font-bold">{issue.label}:</strong>{' '}
                                          <span className="text-slate-200 font-medium">{issue.description}</span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* 3. Info Issues Checklist */}
                              {audit.infoIssues.length > 0 && (
                                <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-3 space-y-2 shadow-xs">
                                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                                    <Info className="w-4 h-4 text-slate-700 flex-shrink-0" />
                                    <span>Recommended Marketing Details:</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {audit.infoIssues.map((issue) => (
                                      <span
                                        key={issue.field}
                                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-100 border border-slate-300 shadow-xs"
                                        title={issue.description}
                                      >
                                        <span>• Fill <strong className="text-slate-100 font-bold">{issue.label}</strong></span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card bottom action (NO EDIT OPTION for Sales Manager) */}
                      <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between text-xs">
                        <span className="text-xs text-slate-200 font-semibold">
                          {p.status || 'Ready'} • {p.property_type} • {p.bedrooms} BR
                        </span>

                        <div>
                          {audit.status === 'sales_ready' ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Sales Ready</span>
                            </span>
                          ) : audit.status === 'action_required' ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-red-950 border border-rose-400" title="Missing critical requirements. Must be updated in Property Management.">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-700" />
                              <span>Action Required ({audit.criticalIssues.length} Critical)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-950 border border-amber-400" title="Missing recommended fields. Must be updated in Property Management.">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                              <span>Incomplete ({totalMissing} Items)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
