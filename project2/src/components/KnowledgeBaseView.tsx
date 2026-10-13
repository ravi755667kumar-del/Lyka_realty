import React, { useState } from 'react';
import { 
  LYKA_COMPANY_INFO, 
  LYKA_AGENTS, 
  DUBAI_COMMUNITIES, 
  DUBAI_PURCHASE_FEES, 
  NRI_MUMBAI_DUBAI_CORRIDOR,
  LYKA_CRM_SPECIFICATION_DOCUMENT
} from '../data/dubai_knowledge';
import { 
  BookOpen, 
  ShieldCheck, 
  Calculator, 
  Award, 
  Users, 
  MapPin, 
  Building2, 
  Phone, 
  Mail, 
  Coins, 
  CheckCircle2, 
  Sparkles,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';

export const KnowledgeBaseView: React.FC = () => {
  const [calcPrice, setCalcPrice] = useState<number>(2000000);
  const [expandedSection, setExpandedSection] = useState<number | null>(1);

  // Dubai fee calculation
  const dldFee = calcPrice * 0.04;
  const dldAdminFee = 580;
  const trusteeFee = calcPrice >= 500000 ? 4200 : 2100;
  const agencyCommission = calcPrice * 0.02 * 1.05; // 2% + 5% VAT
  const totalFees = dldFee + dldAdminFee + trusteeFee + agencyCommission;

  return (
    <div className="flex-1 bg-slate-950 text-slate-300 flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 font-bold text-sm">
              LR
            </div>
            <h2 className="text-lg font-bold text-slate-300">{LYKA_COMPANY_INFO.name} Official Knowledge Base</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {LYKA_COMPANY_INFO.headquarters} • RERA License: {LYKA_COMPANY_INFO.license_number} • {LYKA_COMPANY_INFO.clients_served}
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400">Phone: </span>
            <span className="text-amber-600 font-bold">{LYKA_COMPANY_INFO.phone}</span>
          </div>
          <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400">WhatsApp: </span>
            <span className="text-emerald-400 font-bold">{LYKA_COMPANY_INFO.whatsapp}</span>
          </div>
        </div>
      </div>

      {/* PDF CRM Specification Document Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-300">{LYKA_CRM_SPECIFICATION_DOCUMENT.title}</h3>
          </div>
          <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
            Verified Specification (5 Pages)
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {LYKA_CRM_SPECIFICATION_DOCUMENT.summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {LYKA_CRM_SPECIFICATION_DOCUMENT.sections.map((sec) => (
            <div 
              key={sec.number}
              onClick={() => setExpandedSection(expandedSection === sec.number ? null : sec.number)}
              className="bg-slate-950 border border-slate-800 hover:border-amber-500/40 p-3.5 rounded-xl cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-600 flex items-center justify-center text-[10px] font-mono">
                    {sec.number}
                  </span>
                  <span>{sec.title}</span>
                </span>
                {expandedSection === sec.number ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {expandedSection === sec.number && (
                <p className="mt-2 text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                  {sec.content}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dubai vs Mumbai Real Estate Comparison (NRI Corridor) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-300">Dubai vs Mumbai NRI Investment Corridor Benchmark</h3>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
            INR / AED Currency Pegged
          </span>
        </div>

        <p className="text-xs text-slate-500">
          {NRI_MUMBAI_DUBAI_CORRIDOR.overview}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Investment Benchmark</th>
                <th className="p-3 text-amber-600">Dubai Real Estate (AED)</th>
                <th className="p-3 text-cyan-400">Mumbai Prime Corridor (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {NRI_MUMBAI_DUBAI_CORRIDOR.comparison.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-semibold text-slate-300">{item.metric}</td>
                  <td className="p-3 text-emerald-400 font-medium">{item.dubai}</td>
                  <td className="p-3 text-slate-300">{item.mumbai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid of Calculators & Key Guides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DLD Fee Calculator */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-300">Dubai Purchase Fee Calculator (DLD 4%)</h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              Official DLD Rates
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Property Purchase Price in AED:</label>
            <input
              type="number"
              value={calcPrice}
              onChange={(e) => setCalcPrice(Math.max(100000, Number(e.target.value)))}
              step={100000}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-amber-600 font-bold outline-none focus:border-amber-500"
            />
          </div>

          {/* Breakdown */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Dubai Land Department (DLD 4%):</span>
              <span className="font-mono text-slate-300">AED {dldFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>DLD Title Deed Admin Fee:</span>
              <span className="font-mono text-slate-300">AED {dldAdminFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Registration Trustee Fee:</span>
              <span className="font-mono text-slate-300">AED {trusteeFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Agency Commission (2% + 5% VAT):</span>
              <span className="font-mono text-slate-300">AED {agencyCommission.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
              <span className="text-amber-600">Total Purchase Acquisition Cost:</span>
              <span className="font-mono text-emerald-400">AED {totalFees.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* UAE Golden Visa Real Estate Guide */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-300">UAE Golden Visa (10-Year Real Estate Residency)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Minimum Property Investment</span>
              <span className="font-bold text-amber-600 text-sm">AED 2,000,000 (~ ₹4.56 Crore INR)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Validity</span>
                <span className="font-semibold text-slate-300">10-Year Renewable</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Family Coverage</span>
                <span className="font-semibold text-slate-300">Spouse, Children & Parents</span>
              </div>
            </div>

            <div className="space-y-1.5 text-slate-300 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Off-plan Eligible:</strong> Purchases from verified master developers qualify.</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>No Stay Mandate:</strong> Maintain residency without needing to visit UAE every 6 months.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Dubai Communities */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-300">Covered Dubai Key Communities</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DUBAI_COMMUNITIES.map((comm, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-600 text-xs">{comm.name}</h4>
                {comm.metro_connected && (
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                    Metro Direct
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {comm.vibe}
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Net Rental Yield:</span>
                <span className="font-bold text-emerald-400">{comm.avg_rental_yield}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lyka Agents Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-300">Lyka Realty Certified Real Estate Agents</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LYKA_AGENTS.map((agent) => (
            <div key={agent.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-3">
                  <img src={agent.photo} alt={agent.name} className="w-12 h-12 rounded-full object-cover border border-amber-500/40" />
                  <div>
                    <h4 className="font-bold text-slate-300 text-xs leading-tight">{agent.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{agent.role}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                  <p>Languages: <span className="text-slate-300 font-medium">{agent.languages.join(', ')}</span></p>
                  <p>Communities: <span className="text-amber-700 font-medium">{agent.communities.join(', ')}</span></p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">{agent.active_leads} Active Leads</span>
                <a
                  href={`tel:${agent.phone}`}
                  className="text-amber-600 hover:text-amber-700 flex items-center space-x-1 text-xs font-bold"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
