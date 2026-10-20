import React, { useEffect, useState } from "react";
import { ListingWorkbench, api } from "./components/ListingWorkbench";
import { CrmPipeline } from "./components/CrmPipeline";
import {
  createInitialLeadProfile,
  extractEntitiesFromText,
} from "./lib/agentic_engine";
import type { Listing } from "./types/listing";
import type { LeadProfile, FollowUpTask } from "./types/crm";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "property_manager" | "sales_manager" | "user";
};
type Message = { role: "user" | "assistant"; content: string };
type Tab =
  | "chat"
  | "properties"
  | "dashboard"
  | "crm"
  | "bookings"
  | "customers"
  | "quality"
  | "settings"
  | "knowledge";
const money = (p: Listing) =>
  p.price_aed === null
    ? "Price unknown"
    : `${p.currency} ${p.price_aed.toLocaleString()}`;
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [properties, setProperties] = useState<Listing[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<LeadProfile[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Listing | null | undefined>();
  const [detail, setDetail] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    community: "",
    type: "",
    bedrooms: "",
    max_price: "",
    availability: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [portal, setPortal] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to Lyka Realty. Are you looking to buy, rent, invest, or sell?",
    },
  ]);
  const [input, setInput] = useState("");
  const [lead, setLead] = useState<LeadProfile>(createInitialLeadProfile);
  const [stage, setStage] = useState("new");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [conversation, setConversation] = useState<LeadProfile | null>(null);
  const [bookingProperty, setBookingProperty] = useState<Listing | null>(null);
  const staff = !!user && user.role !== "user";
  const manage = user?.role === "admin" || user?.role === "property_manager";
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(u: User | null = user) {
    const inventory = await api("/api/properties");
    setProperties(inventory.properties);
    if (u && u.role !== "user") {
      const [s, l, f, b] = await Promise.all([
        api("/api/dashboard/stats"),
        api("/api/leads"),
        api("/api/followups"),
        api("/api/bookings"),
      ]);
      setStats(s);
      setLeads(l.leads);
      setTasks(f.tasks);
      setBookings(b.bookings);
      if (u.role === "admin" || u.role === "sales_manager")
        setUsers((await api("/api/auth/all-users")).users);
    }
  }
  useEffect(() => {
    let active = true;
    api("/api/auth/session")
      .then(async (s) => {
        if (!active) return;
        setUser(s.user);
        setOtpRequired(s.portalOtpRequired);
        setSessionReady(true);
        await load(s.user);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setSessionReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    const history = messages.slice(-18);
    const nextLead = { ...lead, ...extractEntitiesFromText(text, lead) };
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    await run(async () => {
      const r = await api("/api/chat", {
        message: text,
        history,
        currentLead: nextLead,
        conversationStage: stage,
      });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
      const updated = {
        ...nextLead,
        ...r.updatedProfile,
        phone: r.updatedProfile?.mobile || nextLead.phone,
        lead_status: "Contacted" as const,
        summary: text,
      };
      setLead(updated);
      setStage(r.nextStage);
      if (user) {
        await api("/api/leads/sync", updated);
        setLeads((l) => [...l.filter((x) => x.id !== updated.id), updated]);
      }
    });
  }
  const tabs: [Tab, string][] = [
    ["chat", "AI chat"],
    ["properties", "Properties"],
    ...(staff
      ? ([
          ["dashboard", "Dashboard"],
          ["crm", "CRM pipeline"],
          ["bookings", "Bookings"],
          ["quality", "Listing review"],
          ...(["admin", "sales_manager"].includes(user!.role)
            ? [["customers", "Customers"]]
            : []),
          ...(user?.role === "admin" ? [["settings", "Access settings"]] : []),
        ] as [Tab, string][])
      : []),
    ["knowledge", "Help & knowledge"],
  ];
  const matches = properties.filter(
    (p) =>
      `${p.title} ${p.community} ${p.property_reference}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filters.community || p.community === filters.community) &&
      (!filters.type || p.property_type === filters.type) &&
      (!filters.bedrooms || p.bedrooms === Number(filters.bedrooms)) &&
      (!filters.max_price ||
        (p.price_aed !== null && p.price_aed <= Number(filters.max_price))) &&
      (!filters.availability || p.availability_status === filters.availability),
  );
  return (
    <div className="application">
      <header className="app-header">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab("chat");
          }}
        >
          <img src="/logo.png" alt="Lyka Realty" />
          <span>Property & CRM assistant</span>
        </a>
        <div className="header-actions">
          {user ? (
            <>
              <span>
                {user.name} · {user.role.replaceAll("_", " ")}
              </span>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api("/api/auth/logout", {});
                    setUser(null);
                    setLeads([]);
                    setUsers([]);
                    setTasks([]);
                    setBookings([]);
                    setTab("chat");
                    setEditing(undefined);
                    setDetail(null);
                    await load(null);
                  })
                }
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setError("");
                setLoginOpen(true);
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <nav className="app-nav" aria-label="Main navigation">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => {
              setTab(id);
              setEditing(undefined);
              setDetail(null);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <main>
        {!sessionReady && <p role="status">Checking your session…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
        {tab === "chat" && (
          <section className="chat-layout">
            <aside className="panel">
              <h2>Your conversation</h2>
              <p className="muted">
                {user
                  ? "Your inquiry is saved to your account."
                  : "Sign in to save inquiries. This guest chat is temporary."}
              </p>
              <button
                onClick={() => {
                  setMessages([
                    {
                      role: "assistant",
                      content: "How can we help with your property search?",
                    },
                  ]);
                  setLead(createInitialLeadProfile());
                  setStage("new");
                }}
              >
                New conversation
              </button>
              <h3>Current requirements</h3>
              <p>{lead.intent || "Intent unknown"}</p>
              <p>
                {lead.preferred_communities?.join(", ") || "Location unknown"}
              </p>
              <p>
                {lead.budget_max
                  ? `AED ${lead.budget_max.toLocaleString()}`
                  : "Budget unknown"}
              </p>
            </aside>
            <div className="panel chat">
              <h1>Property concierge</h1>
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div className={`message ${m.role}`} key={i}>
                    <strong>
                      {m.role === "assistant" ? "Lyka Realty" : "You"}
                    </strong>
                    <p className="preserve">{m.content}</p>
                  </div>
                ))}
              </div>
              <form className="chat-input" onSubmit={sendChat}>
                <label className="sr-only" htmlFor="message">
                  Your message
                </label>
                <textarea
                  id="message"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about properties or tell us your requirements"
                />
                <button className="primary" disabled={busy || !input.trim()}>
                  {busy ? "Thinking…" : "Send"}
                </button>
              </form>
              <button
                onClick={() => {
                  if (user) setHandoffOpen(true);
                  else {
                    setPortal("user");
                    setLoginOpen(true);
                  }
                }}
              >
                Talk to Agent
              </button>
            </div>
          </section>
        )}
        {tab === "properties" && editing !== undefined && manage ? (
          <ListingWorkbench
            key={editing?.id || "new"}
            initial={editing || undefined}
            isAdmin={user?.role === "admin"}
            onCancel={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              void run(async () => {
                await load();
                setNotice("Listing saved.");
              });
            }}
          />
        ) : (
          tab === "properties" && (
            <section>
              <div className="section-title">
                <div>
                  <p className="eyebrow">Property inventory</p>
                  <h1>{staff ? "Manage listings" : "Available properties"}</h1>
                </div>
                {manage && (
                  <button className="primary" onClick={() => setEditing(null)}>
                    Prepare listing
                  </button>
                )}
              </div>
              <label>
                Search properties
                <input
                  placeholder="Title, reference or community"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="form-grid">
                {(
                  ["community", "type", "bedrooms", "availability"] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        community: "Location",
                        type: "Property type",
                        bedrooms: "Bedrooms",
                        availability: "Availability",
                      }[key]
                    }
                    <select
                      value={filters[key]}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, [key]: e.target.value }))
                      }
                    >
                      <option value="">All</option>
                      {Array.from(
                        new Set(
                          properties
                            .map((p) =>
                              String(
                                key === "type"
                                  ? p.property_type
                                  : key === "availability"
                                    ? p.availability_status
                                    : (p[key] ?? ""),
                              ),
                            )
                            .filter(Boolean),
                        ),
                      )
                        .sort()
                        .map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                    </select>
                  </label>
                ))}
                <label>
                  Maximum price (listing currency)
                  <input
                    type="number"
                    min="0"
                    value={filters.max_price}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, max_price: e.target.value }))
                    }
                  />
                </label>
              </div>
              <p className="muted">
                {matches.length} listings. Records marked Demo are fictional and
                are not actual property offers.
              </p>
              <div className="property-grid">
                {matches.map((p) => (
                  <article className="panel property-card" key={p.id}>
                    {p.image_url && (
                      <img src={p.image_url} alt="" loading="lazy" />
                    )}
                    <div>
                      <p className="eyebrow">
                        {p.is_demo_data ? "Demo · " : ""}
                        {p.community} · {p.availability_status}
                      </p>
                      <h2>{p.title || "Untitled draft"}</h2>
                      <strong>{money(p)}</strong>
                      <p>
                        {p.bedrooms ?? "?"} bedrooms · {p.size_sqft ?? "?"} sq.
                        ft.
                      </p>
                      <p>{p.short_description}</p>
                      {staff && (
                        <p>
                          {p.status} · Quality {p.quality_score}/100
                        </p>
                      )}
                      <div className="actions">
                        <button
                          onClick={() =>
                            void run(async () =>
                              setDetail(await api(`/api/properties/${p.id}`)),
                            )
                          }
                        >
                          Details
                        </button>
                        {manage && (
                          <button onClick={() => setEditing(p)}>Edit</button>
                        )}
                        {staff &&
                          !p.is_booked &&
                          ["Approved", "Published"].includes(p.status) && (
                            <button onClick={() => setBookingProperty(p)}>
                              Book viewing / assign
                            </button>
                          )}
                        {manage && (
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "Delete this property? The change will be recorded in history.",
                                )
                              )
                                void run(async () => {
                                  await api(
                                    `/api/properties/${p.id}`,
                                    undefined,
                                    "DELETE",
                                  );
                                  await load();
                                });
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!matches.length && <p>No properties match your search.</p>}
            </section>
          )
        )}
        {tab === "dashboard" && staff && stats && (
          <section>
            <h1>Property dashboard</h1>
            <div className="metrics">
              {Object.entries({
                Listings: stats.total,
                Available: stats.available,
                Booked: stats.booked,
                "Average quality": `${stats.averageQuality}/100`,
                ...stats.byStatus,
              }).map(([label, value]) => (
                <div className="panel" key={label}>
                  <span>{label}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </div>
            <h2>Recent changes</h2>
            {stats.recent.map((e: any) => (
              <p key={e.id}>
                {new Date(e.time).toLocaleString()} · {e.kind} · {e.property_id}
              </p>
            ))}
          </section>
        )}
        {tab === "crm" && staff && (
          <CrmPipeline
            leads={leads}
            followUps={tasks}
            onSelectLead={setConversation}
            onUpdateLeadStatus={(id, status) =>
              void run(async () => {
                await api("/api/leads/sync", {
                  ...leads.find((l) => l.id === id),
                  lead_status: status,
                });
                await load();
              })
            }
            onAddFollowUp={(task) =>
              void run(async () => {
                await api("/api/followups/sync", task);
                await load();
              })
            }
          />
        )}
        {tab === "bookings" && staff && (
          <section>
            <h1>Assignments & bookings</h1>
            {bookings.length === 0 && (
              <p>
                No bookings yet. Choose an available approved property to assign
                it.
              </p>
            )}
            {bookings.map((b) => (
              <article className="panel" key={b.id}>
                <h2>{b.property_title}</h2>
                <p>
                  {b.customer_name} · {b.customer_phone} · {b.status}
                </p>
                <p>
                  Deposit: {b.currency || "AED"}{" "}
                  {(b.booking_amount ?? b.booking_amount_aed)?.toLocaleString()}
                </p>
                {b.status === "Booked" && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm("Cancel this booking and release the property?")
                      )
                        void run(async () => {
                          await api("/api/properties/unbook", {
                            propertyId: b.property_id,
                          });
                          await load();
                        });
                    }}
                  >
                    Cancel booking
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
        {tab === "quality" && staff && (
          <section>
            <h1>Listing quality review</h1>
            <p>
              Required fields and quality scores are calculated by the server.
              Exact reference duplicates are prevented; similar listings require
              administrator confirmation.
            </p>
            {properties
              .filter((p) => p.missing_fields.length || p.warnings.length)
              .map((p) => (
                <article className="panel" key={p.id}>
                  <h2>
                    {p.title || p.id} · {p.quality_score}/100
                  </h2>
                  <p>Missing: {p.missing_fields.join(", ") || "None"}</p>
                  {p.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                  {manage && (
                    <button
                      onClick={() => {
                        setTab("properties");
                        setEditing(p);
                      }}
                    >
                      Review listing
                    </button>
                  )}
                </article>
              ))}
          </section>
        )}
        {tab === "customers" && staff && (
          <section>
            <h1>Customer profiles</h1>
            {users.map((u) => (
              <article className="panel" key={u.id}>
                <h2>{u.name}</h2>
                <p>
                  {u.email} · {u.role}
                </p>
                <p>
                  {leads.filter((l) => l.user_id === u.id).length} inquiries
                </p>
              </article>
            ))}
          </section>
        )}
        {tab === "settings" && user?.role === "admin" && (
          <section className="panel">
            <h1>Portal access</h1>
            <p>
              Create or replace a portal account. Passwords are never displayed.
              Changing an account signs out its existing sessions.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void run(async () => {
                  const portal = d.get("portal");
                  await api(
                    "/api/auth/save-portal-credential",
                    Object.fromEntries(d),
                  );
                  if (portal === "admin") {
                    setUser(null);
                    setTab("chat");
                    await load(null);
                  }
                  setNotice(
                    "Portal account saved. Sign in again if you changed your own account.",
                  );
                  if (portal !== "admin") await load();
                });
              }}
            >
              <label>
                Role
                <select name="portal">
                  <option value="property_manager">Property manager</option>
                  <option value="sales_manager">Sales manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Email
                <input type="email" name="email" required />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                Save account
              </button>
            </form>
          </section>
        )}
        {tab === "knowledge" && (
          <section className="panel">
            <h1>How to use the assistant</h1>
            <h2>Prepare a listing</h2>
            <p>
              Staff can paste raw property information, analyze it, edit the
              extracted facts, generate descriptions, review quality and
              duplicates, and save a draft. Unknown fields remain unknown. An
              administrator approves listings before they appear in public
              search.
            </p>
            <h2>Statuses and availability</h2>
            <p>
              Preparation status tracks Draft → Needs Information → Ready for
              Review → Approved → Published. Availability is tracked separately.
              Published means approved within this application; no external
              portal is updated.
            </p>
            <h2>Quality scoring</h2>
            <p>
              Price/currency 15, location 15, type 10, bedrooms/bathrooms 10,
              area 10, availability 10, amenities 10, title/descriptions 10,
              identification 5, purpose/contact 5. This measures completeness,
              not market value or legal compliance.
            </p>
            <h2>Your data</h2>
            <p>
              Guest conversations are temporary. Signed-in inquiries and staff
              changes are saved by the server. Demo records are fictional.
            </p>
          </section>
        )}
      </main>
      {loginOpen && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
          >
            <div className="section-title">
              <h2>Sign in</h2>
              <button onClick={() => setLoginOpen(false)}>Close</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r =
                    portal === "user"
                      ? await api("/api/auth/verify-email-otp", {
                          email,
                          otp,
                          name,
                          portal,
                        })
                      : await api("/api/auth/login", {
                          email,
                          password,
                          otp,
                          portal,
                        });
                  setUser(r.user);
                  await load(r.user);
                  setLoginOpen(false);
                  setPassword("");
                  setOtp("");
                  setOtpSent(false);
                });
              }}
            >
              <label>
                Account type
                <select
                  value={portal}
                  onChange={(e) => {
                    setPortal(e.target.value);
                    setOtpSent(false);
                    setOtp("");
                  }}
                >
                  <option value="admin">Administrator</option>
                  <option value="property_manager">Property manager</option>
                  <option value="sales_manager">Sales manager</option>
                  <option value="user">Customer (email verification)</option>
                </select>
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setOtpSent(false);
                  }}
                />
              </label>
              {portal === "user" ? (
                <label>
                  Your name
                  <input
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Password
                  <input
                    type="password"
                    required
                    maxLength={200}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {(portal === "user" || otpRequired) && (
                <>
                  <button
                    type="button"
                    disabled={busy || !email}
                    onClick={() =>
                      void run(async () => {
                        await api("/api/auth/send-email-otp", {
                          email,
                          portal,
                        });
                        setOtpSent(true);
                        setNotice(
                          "Verification email sent. The code expires in 3 minutes.",
                        );
                      })
                    }
                  >
                    Send verification code
                  </button>
                  <label>
                    Verification code
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button
                className="primary"
                disabled={
                  busy || ((portal === "user" || otpRequired) && !otpSent)
                }
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-label="Property details"
          >
            <button onClick={() => setDetail(null)}>Close</button>
            <h2>{detail.property.title}</h2>
            <strong>{money(detail.property)}</strong>
            <p className="preserve">{detail.property.description}</p>
            <p>{detail.property.amenities.join(", ")}</p>
            {staff && (
              <>
                <h3>Original information</h3>
                <p className="preserve">
                  {detail.property.original_input || "Not provided"}
                </p>
                <h3>History</h3>
                {detail.history.map((h: any) => (
                  <p key={h.id}>
                    {h.time} · {h.kind}
                  </p>
                ))}
              </>
            )}
          </section>
        </div>
      )}
      {bookingProperty && staff && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-label="Book property"
          >
            <h2>Assign {bookingProperty.title}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void run(async () => {
                  await api("/api/properties/book", {
                    propertyId: bookingProperty.id,
                    customerName: d.get("customerName"),
                    customerPhone: d.get("customerPhone"),
                    customerEmail: d.get("customerEmail"),
                    notes: d.get("notes"),
                  });
                  setBookingProperty(null);
                  await load();
                  setTab("bookings");
                });
              }}
            >
              <label>
                Customer name
                <input name="customerName" required maxLength={150} />
              </label>
              <label>
                Phone (including country code)
                <input
                  type="tel"
                  name="customerPhone"
                  required
                  pattern="\+?[0-9]{8,15}"
                  placeholder="+971501234567"
                />
              </label>
              <label>
                Email
                <input type="email" name="customerEmail" />
              </label>
              <label>
                Notes
                <textarea name="notes" maxLength={2000} />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button type="button" onClick={() => setBookingProperty(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Confirm booking
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {handoffOpen && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-label="Talk to Agent"
          >
            <h2>Request an agent</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void run(async () => {
                  const updated = {
                    ...lead,
                    full_name: String(d.get("name")),
                    phone: String(d.get("phone")),
                    human_handoff_required: true,
                    handoff_reason: String(d.get("notes")),
                    lead_status: "Contacted" as const,
                  };
                  await api("/api/leads/sync", updated);
                  setLead(updated);
                  setLeads((l) => [
                    ...l.filter((x) => x.id !== updated.id),
                    updated,
                  ]);
                  setHandoffOpen(false);
                  setNotice("Your request has been recorded for staff review.");
                });
              }}
            >
              <label>
                Name
                <input
                  name="name"
                  defaultValue={lead.full_name || user?.name}
                  required
                  maxLength={150}
                />
              </label>
              <label>
                Phone including country code
                <input
                  name="phone"
                  type="tel"
                  required
                  pattern="\+?[0-9]{8,15}"
                  placeholder="+971501234567"
                />
              </label>
              <label>
                How can we help?
                <textarea name="notes" maxLength={2000} />
              </label>
              <div className="actions">
                <button type="button" onClick={() => setHandoffOpen(false)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Submit request
                </button>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </section>
        </div>
      )}
      {conversation && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-label="Lead details"
          >
            <button onClick={() => setConversation(null)}>Close</button>
            <h2>{conversation.full_name || "Inquiry"}</h2>
            <p>
              {conversation.email} · {conversation.phone}
            </p>
            <p>{conversation.summary}</p>
            <p>
              {conversation.intent} ·{" "}
              {conversation.preferred_communities?.join(", ")}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
