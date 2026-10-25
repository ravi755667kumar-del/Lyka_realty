import React, { useState, useRef, useEffect } from 'react';
import { PropertyListing, LeadProfile, FollowUpTask } from '../types/crm';
import {
  Sparkles,
  Bot,
  Send,
  X,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Lock,
  ArrowRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AdminCopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionButton?: {
    label: string;
    tab: string;
    description?: string;
  };
  metrics?: {
    label: string;
    value: string;
    color?: string;
  }[];
}

interface AdminCopilotChatProps {
  properties: PropertyListing[];
  leads: LeadProfile[];
  customerCount: number;
  followUps?: FollowUpTask[];
  activeTab: string;
  onNavigateTab: (tab: string) => void;
}
const renderFormattedContent = (content: string) => {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-black dark:text-amber-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const AdminCopilotChat: React.FC<AdminCopilotChatProps> = ({
  properties,
  leads,
  customerCount,
  followUps = [],
  activeTab,
  onNavigateTab
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  const [messages, setMessages] = useState<AdminCopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello Super Admin! I am your real-time Admin Copilot. You can ask me about today\'s sales, booking revenue, CRM leads, or inventory metrics, and I can take you straight to that section.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionButton: {
        label: 'Open Assigned Properties / Sales',
        tab: 'assigned_properties',
        description: 'View current booked units and revenue records'
      }
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Real-time calculation helpers
  const calculateTodaySales = () => {
    const todayStr = new Date().toDateString();
    const todayBookings = properties.filter(p => {
      if (!p.is_booked && (p.status || '').toLowerCase() !== 'booked') return false;
      const bookedDate = p.booked_at ? new Date(p.booked_at) : (p.updatedAt ? new Date(p.updatedAt) : null);
      return bookedDate ? bookedDate.toDateString() === todayStr : false;
    });

    const totalVolume = todayBookings.reduce((sum, p) => sum + (p.price_aed || 0), 0);
    const totalDeposits = todayBookings.reduce((sum, p) => sum + (p.booking_amount_aed || 0), 0);

    return {
      count: todayBookings.length,
      totalVolume,
      totalDeposits,
      bookings: todayBookings
    };
  };

  const calculateAllTimeSales = () => {
    const allBooked = properties.filter(p => p.is_booked || (p.status || '').toLowerCase() === 'booked');
    const totalVolume = allBooked.reduce((sum, p) => sum + (p.price_aed || 0), 0);
    const totalDeposits = allBooked.reduce((sum, p) => sum + (p.booking_amount_aed || 0), 0);
    return {
      count: allBooked.length,
      totalVolume,
      totalDeposits,
      allBooked
    };
  };

  const handleProcessQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const userMsg: AdminCopilotMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: cleanQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    // Analyze query locally first for instant, accurate real-time answers
    const lower = cleanQuery.toLowerCase();
    const todaySales = calculateTodaySales();
    const allTimeSales = calculateAllTimeSales();

    let reply = '';
    let actionBtn: { label: string; tab: string; description?: string } | undefined = undefined;
    let metrics: { label: string; value: string; color?: string }[] | undefined = undefined;

    // 1. TODAY'S SALES / TODAY'S REVENUE / TODAY BOOKINGS
    if (
      lower.includes('today') && 
      (lower.includes('sell') || lower.includes('sale') || lower.includes('revenue') || lower.includes('book') || lower.includes('earn'))
    ) {
      if (todaySales.count > 0) {
        reply = `Today's sales volume is **AED ${todaySales.totalVolume.toLocaleString()}** across **${todaySales.count} booked property${todaySales.count > 1 ? 'ies' : ''}**. Direct booking deposits collected today: **AED ${todaySales.totalDeposits.toLocaleString()}**.`;
        const listText = todaySales.bookings.map((b, idx) => 
          `${idx + 1}. **${b.title}** in ${b.community} (${b.bedrooms}BR) — AED ${b.price_aed.toLocaleString()} (Client: ${b.assigned_to || 'Assigned'})`
        ).join('\n');
        reply += `\n\n**Today's Booked Units:**\n${listText}`;

        metrics = [
          { label: "Today's Volume", value: `AED ${(todaySales.totalVolume / 1000000).toFixed(2)}M`, color: 'text-amber-700' },
          { label: 'Units Booked', value: `${todaySales.count}`, color: 'text-emerald-700' },
          { label: 'Deposits', value: `AED ${todaySales.totalDeposits.toLocaleString()}`, color: 'text-violet-700' }
        ];

        actionBtn = {
          label: "View Today's Bookings in Assigned Properties",
          tab: 'assigned_properties',
          description: 'Opens Assigned Properties to view full client booking cards and receipts'
        };
      } else {
        reply = `No properties have been booked today yet (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). All-time booked volume stands at **AED ${allTimeSales.totalVolume.toLocaleString()}** across **${allTimeSales.count} total units**.`;
        metrics = [
          { label: "Today's Volume", value: 'AED 0', color: 'text-zinc-600' },
          { label: 'Today Bookings', value: '0 Units', color: 'text-zinc-600' },
          { label: 'All-Time Sales', value: `AED ${(allTimeSales.totalVolume / 1000000).toFixed(1)}M`, color: 'text-emerald-700' }
        ];
        actionBtn = {
          label: 'Open Assigned Properties & Sales',
          tab: 'assigned_properties',
          description: 'View current booked inventory and transaction pipeline'
        };
      }
    } 
    // 2. TOTAL SALES / ALL-TIME REVENUE
    else if (
      lower.includes('total sales') || 
      lower.includes('all-time sales') || 
      lower.includes('total revenue') || 
      lower.includes('overall sales') || 
      lower.includes('how much sales') ||
      lower.includes('all sales')
    ) {
      reply = `Total booked sales volume to date is **AED ${allTimeSales.totalVolume.toLocaleString()}** (≈ ₹${((allTimeSales.totalVolume * 22.8) / 10000000).toFixed(1)} Cr) across **${allTimeSales.count} booked properties**. Total booking deposits held: **AED ${allTimeSales.totalDeposits.toLocaleString()}**.`;
      metrics = [
        { label: 'Total Volume', value: `AED ${(allTimeSales.totalVolume / 1000000).toFixed(2)}M`, color: 'text-amber-700' },
        { label: 'Properties Booked', value: `${allTimeSales.count} Units`, color: 'text-emerald-700' },
        { label: 'Total Deposits', value: `AED ${allTimeSales.totalDeposits.toLocaleString()}`, color: 'text-violet-700' }
      ];
      actionBtn = {
        label: 'View Assigned Properties Pipeline',
        tab: 'assigned_properties'
      };
    }
    // 3. BOOKED vs AVAILABLE PROPERTIES COUNT
    else if (
      lower.includes('how many booked') || 
      lower.includes('booked count') || 
      lower.includes('how many available') || 
      lower.includes('inventory count') ||
      lower.includes('available properties')
    ) {
      const bookedCount = allTimeSales.count;
      const availableCount = properties.length - bookedCount;
      reply = `Inventory status: You have **${properties.length} total properties** registered. **${bookedCount} units** are booked/assigned, and **${availableCount} units** are currently available for sale.`;
      metrics = [
        { label: 'Total Inventory', value: `${properties.length}`, color: 'text-zinc-700' },
        { label: 'Available', value: `${availableCount}`, color: 'text-emerald-700' },
        { label: 'Booked', value: `${bookedCount}`, color: 'text-rose-700' }
      ];
      actionBtn = {
        label: 'Open Dubai Property Inventory',
        tab: 'properties'
      };
    }
    // 4. CRM / LEADS STATUS
    else if (
      lower.includes('crm') || 
      lower.includes('lead') || 
      lower.includes('pipeline') || 
      lower.includes('prospect')
    ) {
      const newLeads = leads.filter(l => l.lead_status === 'New').length;
      const qualified = leads.filter(l => l.lead_status === 'Qualified').length;
      const viewing = leads.filter(l => l.lead_status === 'Viewing').length;
      reply = `The CRM Pipeline has **${leads.length} active leads** (${newLeads} New, ${qualified} Qualified, ${viewing} Viewings Scheduled). Follow-up tasks in queue: **${followUps.length}**.`;
      metrics = [
        { label: 'Total Leads', value: `${leads.length}`, color: 'text-violet-700' },
        { label: 'New Inquiries', value: `${newLeads}`, color: 'text-amber-700' },
        { label: 'Qualified', value: `${qualified}`, color: 'text-emerald-700' }
      ];
      actionBtn = {
        label: 'Open CRM Pipeline',
        tab: 'crm'
      };
    }
    // 5. CUSTOMER PROFILES / LOGINS
    else if (
      lower.includes('customer') || 
      lower.includes('who logged in') || 
      lower.includes('login') || 
      lower.includes('user')
    ) {
      reply = `You have **${customerCount} registered customer accounts** tracked in Firebase Firestore. You can inspect login timestamps, verified emails, and activity trends in Customer Profiles.`;
      metrics = [
        { label: 'Registered Customers', value: `${customerCount}`, color: 'text-amber-700' }
      ];
      actionBtn = {
        label: 'Open Customer Profiles & Login Trends',
        tab: 'customers'
      };
    }
    // 6. PROPERTY STATS / AVERAGE PRICES / YIELD
    else if (
      lower.includes('stat') || 
      lower.includes('average price') || 
      lower.includes('yield') || 
      lower.includes('roi') ||
      lower.includes('chart')
    ) {
      const avgPrice = Math.round(properties.reduce((s, p) => s + p.price_aed, 0) / (properties.length || 1));
      reply = `Dubai property portfolio summary: Average listing price is **AED ${avgPrice.toLocaleString()}** with an average projected yield of **7.5% – 8.5% net ROI**. Detailed community charts and price bands are available in Property Stats.`;
      metrics = [
        { label: 'Avg Price', value: `AED ${(avgPrice / 1000000).toFixed(2)}M`, color: 'text-amber-700' },
        { label: 'Avg ROI', value: '7.8% net', color: 'text-emerald-700' }
      ];
      actionBtn = {
        label: 'Open Property Stats & Charts',
        tab: 'stats'
      };
    }
    // 7. DIRECT NAVIGATION COMMANDS
    else if (lower.includes('go to') || lower.includes('open') || lower.includes('show')) {
      if (lower.includes('booking') || lower.includes('assigned') || lower.includes('sales')) {
        reply = 'Switching your view to **Assigned Properties & Sales** now...';
        actionBtn = { label: 'Go to Assigned Properties', tab: 'assigned_properties' };
        onNavigateTab('assigned_properties');
      } else if (lower.includes('crm') || lower.includes('pipeline') || lower.includes('lead')) {
        reply = 'Switching your view to **CRM Pipeline** now...';
        actionBtn = { label: 'Go to CRM Pipeline', tab: 'crm' };
        onNavigateTab('crm');
      } else if (lower.includes('properties') || lower.includes('inventory')) {
        reply = 'Switching your view to **Dubai Properties** inventory now...';
        actionBtn = { label: 'Go to Dubai Properties', tab: 'properties' };
        onNavigateTab('properties');
      } else if (lower.includes('stats') || lower.includes('analytics')) {
        reply = 'Switching your view to **Property Stats** now...';
        actionBtn = { label: 'Go to Property Stats', tab: 'stats' };
        onNavigateTab('stats');
      } else if (lower.includes('customer')) {
        reply = 'Switching your view to **Customer Profiles** now...';
        actionBtn = { label: 'Go to Customer Profiles', tab: 'customers' };
        onNavigateTab('customers');
      } else {
        reply = `I can help you navigate or analyze: "today's sales", "CRM pipeline", "property inventory", "customer logins", or "property stats".`;
      }
    }
    // 8. FALLBACK / GENERAL QUERY
    else {
      reply = `Here is the current executive snapshot:\n• **Today's Sales Volume**: AED ${todaySales.totalVolume.toLocaleString()} (${todaySales.count} bookings today)\n• **All-Time Booked Sales**: AED ${allTimeSales.totalVolume.toLocaleString()} (${allTimeSales.count} units)\n• **Total Portfolio**: ${properties.length} properties (${properties.length - allTimeSales.count} available)\n• **Active Leads**: ${leads.length} in CRM Pipeline\n• **Customer Accounts**: ${customerCount} registered.`;
      actionBtn = {
        label: 'Open Assigned Properties & Sales',
        tab: 'assigned_properties'
      };
    }

    setTimeout(() => {
      const assistantMsg: AdminCopilotMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionButton: actionBtn,
        metrics
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 400);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleProcessQuery(prompt);
  };

  return (
    <>
      {/* Collapsed Toggle Pill (Shown on Right Edge when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-3 bottom-6 z-40 bg-gradient-to-r from-violet-700 via-purple-700 to-amber-600 hover:from-violet-600 hover:to-amber-500 text-white px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 border border-violet-400/30 transition-all hover:scale-105 group"
          title="Open Admin AI Copilot"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="text-xs font-bold tracking-wide">Admin Copilot</span>
          <ChevronLeft className="w-4 h-4 text-amber-200 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Expanded Right-Side Chatbot Drawer */}
      {isOpen && (
        <aside
          className="w-80 sm:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-2xl z-30 transition-all duration-300 relative"
          aria-label="Admin Copilot Panel"
        >
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-espresso-900 via-espresso-800 to-amber-950 border-b border-espresso-700 shrink-0 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-xs font-bold text-white">Admin Copilot</h3>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                      Live Data
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-200/90 font-medium">Live Sales Analytics & Navigation</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([
                      {
                        id: 'welcome-' + Date.now(),
                        role: 'assistant',
                        content: 'Chat refreshed. Ask me about today\'s sales, total revenue, leads, or inventory metrics!',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      }
                    ]);
                  }}
                  className="p-1.5 text-amber-200/80 hover:text-white hover:bg-espresso-750 rounded-lg transition-colors"
                  title="Reset conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-amber-200/80 hover:text-white hover:bg-espresso-750 rounded-lg transition-colors"
                  title="Minimize Copilot"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pt-2.5 pb-0.5 scrollbar-none text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickPrompt("What is today's sales?")}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 border border-amber-600/30 px-2 py-1 rounded-lg shrink-0 transition-all font-semibold active:scale-95 flex items-center space-x-1"
              >
                <span>💰 Today's Sales</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("What is total sales?")}
                className="bg-slate-100 hover:bg-slate-200 text-zinc-800 border border-slate-300 px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95 font-medium"
              >
                <span>📊 Total Revenue</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("How many properties are booked?")}
                className="bg-slate-100 hover:bg-slate-200 text-zinc-800 border border-slate-300 px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95 font-medium"
              >
                <span>🔒 Booked Units</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt("How many leads in CRM?")}
                className="bg-slate-100 hover:bg-slate-200 text-zinc-800 border border-slate-300 px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95 font-medium"
              >
                <span>📋 CRM Leads</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs bg-[#faf8f4]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Role & Timestamp Header */}
                <span className="text-[10px] text-zinc-500 font-medium mb-1 px-1">
                  {msg.role === 'user' ? 'You (Super Admin)' : 'Admin Copilot'} • {msg.timestamp}
                </span>

                {/* Message Bubble */}
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 leading-relaxed space-y-2 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-xs font-medium'
                      : 'bg-white dark:bg-slate-800 border border-amber-600/20 text-[#1e2430] dark:text-slate-100 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-line text-[11.5px] leading-relaxed text-[#1e2430] dark:text-slate-100">
                    {renderFormattedContent(msg.content)}
                  </div>

                  {/* Key Metrics Chips (if any) */}
                  {msg.metrics && msg.metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-amber-500/20">
                      {msg.metrics.map((m, idx) => (
                        <div key={idx} className="bg-[#faf8f4] border border-amber-600/20 rounded-xl p-2 shadow-xs">
                          <span className="text-[9.5px] text-zinc-600 uppercase tracking-wider block font-semibold">{m.label}</span>
                          <span className={`text-xs font-bold font-mono ${m.color || 'text-amber-800'}`}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Smart Action Navigation Button */}
                  {msg.actionButton && (
                    <div className="pt-1.5">
                      <button
                        type="button"
                        onClick={() => onNavigateTab(msg.actionButton!.tab)}
                        className="w-full bg-gradient-to-r from-amber-500 hover:from-amber-400 to-amber-600 text-amber-950 font-bold px-3 py-2 rounded-xl text-[11px] shadow-md transition-all flex items-center justify-between active:scale-98 group"
                      >
                        <span className="truncate mr-1">{msg.actionButton.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                      {msg.actionButton.description && (
                        <p className="text-[9.5px] text-zinc-600 mt-1 px-1 font-medium">
                          {msg.actionButton.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-2 text-zinc-600 text-xs py-1">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                </div>
                <span className="text-[11px] italic font-medium">Analyzing real-time database records...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessQuery(inputQuery);
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask e.g. What is today's sales?..."
                className="flex-1 bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 outline-none transition-colors font-medium"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isTyping}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 p-2 rounded-xl font-bold transition-all shadow-md active:scale-95"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[9.5px] text-zinc-500 pt-1.5 px-0.5 font-medium">
              <span>Super Admin Exclusive</span>
              <span className="text-amber-700 font-semibold">Real-Time Firestore & State</span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
