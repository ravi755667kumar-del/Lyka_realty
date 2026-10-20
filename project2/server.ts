import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { z, ZodError } from "zod";
import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import { openStore, type Store, type Role } from "./backend/store.js";
import {
  authorize,
  bootstrapAdmin,
  currentUser,
  safeUser,
  sessionHash,
  login,
  sendOtp,
  verifyOtp,
  rateLimit,
  hashPassword,
  emailSchema,
} from "./backend/auth.js";
import {
  HttpError,
  buildListing,
  parseProperty,
  propertySchema,
  quality,
  duplicates,
  descriptions,
  generateDescriptions,
  analyze,
  isPublic,
  requiredFields,
} from "./backend/listings.js";
import { demoListings } from "./backend/seeds.js";
import { injectDependencies, runLykaAgent } from "./langgraph_agent.js";
import { createInitialLeadProfile } from "./src/lib/agentic_engine.js";
import { LISTING_STATUSES, AVAILABILITY } from "./src/types/listing.js";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const directory = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
const store = await openStore();
await bootstrapAdmin(store);
requiredFields();
if (process.env.SEED_DEMO === "true")
  await store.change((s) => {
    if (!s.properties.length) s.properties = demoListings();
  });
const staff: Role[] = ["admin", "property_manager", "sales_manager"];
const managers: Role[] = ["admin", "property_manager"];
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const protect = (allowed: Role[]) => authorize(store, allowed);
const record = (
  s: any,
  actor: string,
  kind: string,
  id: string,
  before?: unknown,
  after?: unknown,
) =>
  s.history.push({
    id: randomUUID(),
    actor,
    kind,
    property_id: id,
    time: new Date().toISOString(),
    before,
    after,
  });
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  const origin = req.get("origin");
  const expected =
    process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    origin !== expected
  )
    return next(new HttpError(403, "Cross-origin writes are not allowed."));
  next();
});
app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    await store.read();
    res.json({
      status: "ok",
      storage: store.mode,
      aiConfigured: !!process.env.OPENAI_API_KEY,
      emailConfigured: !!process.env.BREVO_API_KEY,
    });
  }),
);
app.get(
  "/api/auth/session",
  asyncRoute(async (req, res) => {
    const user = await currentUser(store, req);
    res.json({
      user: user ? safeUser(user) : null,
      portalOtpRequired: process.env.REQUIRE_PORTAL_OTP === "true",
    });
  }),
);
app.post(
  "/api/auth/login",
  asyncRoute((req, res) => login(store, req, res)),
);
app.post(
  "/api/auth/send-email-otp",
  asyncRoute((req, res) => sendOtp(store, req, res)),
);
app.post(
  "/api/auth/verify-email-otp",
  asyncRoute((req, res) => verifyOtp(store, req, res)),
);
app.post(
  "/api/auth/logout",
  asyncRoute(async (req, res) => {
    await store.change((s) => {
      s.sessions = s.sessions.filter((x) => x.tokenHash !== sessionHash(req));
    });
    res.clearCookie("lyka_session", { path: "/" });
    res.json({ success: true });
  }),
);
app.get(
  "/api/auth/portal-credentials",
  protect(["admin"]),
  asyncRoute(async (_req, res) => {
    res.json({
      users: (await store.read()).users
        .filter((u) => u.role !== "user")
        .map(safeUser),
    });
  }),
);
app.post(
  "/api/auth/save-portal-credential",
  protect(["admin"]),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        portal: z.enum(["admin", "property_manager", "sales_manager"]),
        email: emailSchema,
        password: z.string().min(12).max(200),
        name: z.string().trim().min(1).max(150),
      })
      .parse(req.body);
    const user = await store.change((s) => {
      const existing = s.users.find((u) => u.role === input.portal);
      if (s.users.some((u) => u.email === input.email && u.id !== existing?.id))
        throw new HttpError(409, "Email already registered.");
      const u = {
        id: existing?.id || randomUUID(),
        email: input.email,
        name: input.name,
        role: input.portal,
        passwordHash: hashPassword(input.password),
      };
      s.users = s.users.filter((x) => x.id !== u.id);
      s.users.push(u);
      s.sessions = s.sessions.filter((x) => x.userId !== u.id);
      record(s, res.locals.user.id, "credential_changed", u.id);
      return safeUser(u);
    });
    res.json({ success: true, user });
  }),
);
// Old credential and OTP recovery paths are deliberately protected, including
// endpoints formerly usable to reset limits or impersonate profile ownership.
app.post(
  ["/api/auth/reset-otp-rate-limit", "/api/auth/clear-email-otp"],
  protect(["admin"]),
  asyncRoute(async (_req, res) => {
    res.status(410).json({ error: "Use the normal expiry and sign-out flow." });
  }),
);
app.get(
  "/api/auth/otp-status",
  asyncRoute(async (req, res) => {
    const email = emailSchema.parse(req.query.email);
    const attempts = (
      (await store.read()).rateLimits["otp-email:" + email] || []
    ).filter((t) => Date.now() - t < 3600000).length;
    res.json({
      locked: attempts >= 5,
      attemptsUsed: attempts,
      maxAttempts: 5,
      remainingAttempts: Math.max(0, 5 - attempts),
    });
  }),
);
app.get(
  "/api/auth/all-users",
  protect(["admin", "sales_manager"]),
  asyncRoute(async (_req, res) => {
    const s = await store.read();
    res.json({ users: s.users.map(safeUser), events: s.events });
  }),
);
app.get(
  "/api/auth/get-user-profile",
  protect([...staff, "user"]),
  asyncRoute(async (_req, res) => {
    res.json({ profile: safeUser(res.locals.user) });
  }),
);
app.post(
  "/api/auth/save-user-login",
  protect([...staff, "user"]),
  asyncRoute(async (_req, res) => {
    res.json({ success: true, user: safeUser(res.locals.user) });
  }),
);

const querySchema = z.object({
  q: z.string().max(200).optional(),
  community: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  availability: z.enum(AVAILABILITY).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
app.get(
  "/api/properties",
  asyncRoute(async (req, res) => {
    const q = querySchema.parse(req.query);
    const user = await currentUser(store, req);
    const isStaff = user && staff.includes(user.role);
    let properties = (await store.read()).properties;
    if (!isStaff) properties = properties.filter(isPublic);
    properties = properties.filter(
      (p) =>
        (!q.q ||
          `${p.title} ${p.community} ${p.property_reference}`
            .toLowerCase()
            .includes(q.q.toLowerCase())) &&
        (!q.community || p.community === q.community) &&
        (!q.type || p.property_type === q.type) &&
        (!q.status || p.status === q.status) &&
        (!q.availability || p.availability_status === q.availability) &&
        (q.bedrooms === undefined || p.bedrooms === q.bedrooms) &&
        (q.min_price === undefined ||
          (p.price_aed !== null && p.price_aed >= q.min_price)) &&
        (q.max_price === undefined ||
          (p.price_aed !== null && p.price_aed <= q.max_price)),
    );
    const total = properties.length;
    properties = properties.slice((q.page - 1) * q.limit, q.page * q.limit);
    res.json({
      success: true,
      properties: properties.map((p) => publicProperty(p, !!isStaff)),
      total,
      page: q.page,
    });
  }),
);
function publicProperty(p: any, isStaff: boolean) {
  if (isStaff) return p;
  const {
    original_input,
    contact_mobile,
    contact_name,
    booking_id,
    assigned_to,
    assigned_email,
    assigned_phone,
    booking_notes,
    booking_amount_aed,
    booked_at,
    ...safe
  } = p;
  return safe;
}
app.post(
  "/api/properties/analyze",
  protect(managers),
  asyncRoute(async (req, res) => {
    await rateLimit(store, "analysis:" + res.locals.user.id, 30);
    const { raw_text } = z
      .object({ raw_text: z.string().trim().min(1).max(20000) })
      .parse(req.body);
    const property = await analyze(raw_text);
    res.json({ property, quality: quality(property) });
  }),
);
app.post(
  "/api/properties/generate-description",
  protect(managers),
  asyncRoute(async (req, res) => {
    const p = parseProperty(req.body);
    await rateLimit(store, "descriptions:" + res.locals.user.id, 30);
    res.json({ ...(await generateDescriptions(p)), quality: quality(p) });
  }),
);
app.post(
  "/api/properties/validate",
  protect(staff),
  asyncRoute(async (req, res) => {
    const p = parseProperty(req.body);
    res.json({ valid: true, quality: quality(p) });
  }),
);
app.post(
  "/api/properties/check-duplicates",
  protect(staff),
  asyncRoute(async (req, res) => {
    const p = parseProperty(req.body);
    res.json({
      duplicates: duplicates(p, (await store.read()).properties, p.id),
    });
  }),
);
function saveProperty(req: Request, res: Response, replace: boolean) {
  return store
    .change((s) => {
      const existing = s.properties.find((p) => p.id === req.params.id);
      if (replace && !existing) throw new HttpError(404, "Property not found.");
      if (existing?.is_booked)
        throw new HttpError(
          409,
          "Release the booking before editing this property.",
        );
      const input = replace
        ? { ...existing, ...req.body, id: existing!.id }
        : req.body;
      const p = parseProperty(input);
      const matches = duplicates(p, s.properties, existing?.id);
      if (matches.some((m) => m.exact))
        throw new HttpError(409, "Duplicate property reference", matches);
      if (
        matches.length &&
        !(req.body.confirm_similar === true && res.locals.user.role === "admin")
      )
        throw new HttpError(
          409,
          "A similar listing exists. An administrator must review and explicitly confirm.",
          matches,
        );
      if (!existing && p.id && s.properties.some((x) => x.id === p.id))
        throw new HttpError(
          409,
          "Property ID already exists; use PATCH to edit.",
        );
      if (
        ["Approved", "Published"].includes(p.status) &&
        res.locals.user.role !== "admin"
      )
        throw new HttpError(403, "An administrator must approve listings.");
      if (
        existing &&
        ["Sold", "Rented", "Unavailable"].includes(
          existing.availability_status,
        ) &&
        ["Available", "Vacant"].includes(p.availability_status) &&
        req.body.confirm_availability !== true
      )
        throw new HttpError(
          409,
          "Confirm availability before reopening this listing.",
        );
      const property = buildListing(p, existing);
      s.properties = s.properties.filter((x) => x.id !== property.id);
      s.properties.push(property);
      record(
        s,
        res.locals.user.id,
        existing ? "updated" : "created",
        property.id,
        existing,
        property,
      );
      return property;
    })
    .then((property) =>
      res.status(replace ? 200 : 201).json({
        success: true,
        property,
        quality: quality(parseProperty(property)),
      }),
    );
}
app.post(
  "/api/properties",
  protect(managers),
  asyncRoute((req, res) => saveProperty(req, res, false)),
);
app.patch(
  "/api/properties/:id",
  protect(managers),
  asyncRoute((req, res) => saveProperty(req, res, true)),
);
app.patch(
  "/api/properties/:id/status",
  protect(staff),
  asyncRoute(async (req, res) => {
    const { status, confirm_availability } = z
      .object({
        status: z.enum(LISTING_STATUSES),
        confirm_availability: z.boolean().optional(),
      })
      .parse(req.body);
    req.body = { status, confirm_availability };
    await saveProperty(req, res, true);
  }),
);
app.get(
  "/api/properties/:id",
  asyncRoute(async (req, res) => {
    const user = await currentUser(store, req);
    const isStaff = !!user && staff.includes(user.role);
    const p = (await store.read()).properties.find(
      (p) => p.id === req.params.id,
    );
    if (!p || (!isStaff && !isPublic(p)))
      throw new HttpError(404, "Property not found.");
    res.json({
      property: publicProperty(p, isStaff),
      quality: quality(parseProperty(p)),
      history: isStaff
        ? (await store.read()).history.filter((e) => e.property_id === p.id)
        : [],
    });
  }),
);
app.delete(
  "/api/properties/:id",
  protect(managers),
  asyncRoute(async (req, res) => {
    await store.change((s) => {
      const p = s.properties.find((p) => p.id === req.params.id);
      if (!p) throw new HttpError(404, "Property not found.");
      if (p.is_booked)
        throw new HttpError(
          409,
          "Cancel the booking before deleting this property.",
        );
      s.properties = s.properties.filter((p) => p.id !== req.params.id);
      record(s, res.locals.user.id, "deleted", p.id, p);
    });
    res.json({ success: true });
  }),
);
const bookSchema = z.object({
  propertyId: z.string().min(1).max(80),
  customerName: z.string().trim().min(1).max(150),
  customerPhone: z.string().regex(/^\+?[0-9]{8,15}$/),
  customerEmail: z.union([z.literal(""), z.email()]).optional(),
  bookingAmount: z.number().positive().optional(),
  notes: z.string().max(2000).default(""),
});
app.post(
  "/api/properties/book",
  protect(staff),
  asyncRoute(async (req, res) => {
    const input = bookSchema.parse(req.body);
    const booking = await store.change((s) => {
      const p = s.properties.find((x) => x.id === input.propertyId);
      if (!p) throw new HttpError(404, "Property not found.");
      if (p.is_booked || !isPublic(p))
        throw new HttpError(409, "Property is not available for booking.");
      const booking = {
        id: randomUUID(),
        property_id: p.id,
        property_title: p.title,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail || "",
        booking_amount_aed:
          p.currency === "AED"
            ? input.bookingAmount || Math.round(p.price_aed! * 0.1)
            : null,
        notes: input.notes,
        booked_at: new Date().toISOString(),
        status: "Booked",
        currency: p.currency,
        booking_amount: input.bookingAmount || Math.round(p.price_aed! * 0.1),
      };
      p.is_booked = true;
      p.availability_status = "Booked";
      p.booking_id = booking.id;
      s.bookings.push(booking);
      record(s, res.locals.user.id, "booked", p.id);
      return booking;
    });
    res.json({ success: true, booking });
  }),
);
app.post(
  "/api/properties/unbook",
  protect(staff),
  asyncRoute(async (req, res) => {
    const { propertyId } = z
      .object({ propertyId: z.string().min(1) })
      .parse(req.body);
    await store.change((s) => {
      const p = s.properties.find((x) => x.id === propertyId);
      if (!p) throw new HttpError(404, "Property not found.");
      if (!p.is_booked)
        throw new HttpError(409, "Property has no active booking.");
      p.is_booked = false;
      p.availability_status = "Available";
      for (const key of [
        "booking_id",
        "assigned_to",
        "assigned_phone",
        "assigned_email",
        "booking_notes",
        "booking_amount_aed",
        "booked_at",
      ])
        delete p[key];
      for (const b of s.bookings.filter(
        (b) => b.property_id === p.id && b.status === "Booked",
      ))
        b.status = "Cancelled";
      record(s, res.locals.user.id, "booking_cancelled", p.id);
    });
    res.json({ success: true });
  }),
);
app.get(
  "/api/bookings",
  protect(staff),
  asyncRoute(async (_req, res) => {
    res.json({ bookings: (await store.read()).bookings });
  }),
);
app.get(
  "/api/dashboard/stats",
  protect(staff),
  asyncRoute(async (_req, res) => {
    const s = await store.read();
    res.json({
      total: s.properties.length,
      byStatus: Object.fromEntries(
        LISTING_STATUSES.map((st) => [
          st,
          s.properties.filter((p) => p.status === st).length,
        ]),
      ),
      available: s.properties.filter(isPublic).length,
      booked: s.bookings.filter((b) => b.status === "Booked").length,
      averageQuality: s.properties.length
        ? Math.round(
            s.properties.reduce((n, p) => n + p.quality_score, 0) /
              s.properties.length,
          )
        : 0,
      leads: s.leads.length,
      recent: s.history.slice(-10).reverse(),
    });
  }),
);
app.get(
  "/api/leads",
  protect([...staff, "user"]),
  asyncRoute(async (_req, res) => {
    const s = await store.read();
    res.json({
      leads:
        res.locals.user.role === "user"
          ? s.leads.filter((l) => l.user_id === res.locals.user.id)
          : s.leads,
      storage: store.mode,
    });
  }),
);
app.post(
  "/api/leads/sync",
  protect([...staff, "user"]),
  asyncRoute(async (req, res) => {
    const lead = z
      .object({
        id: z.string().regex(/^[\w-]{1,80}$/),
        full_name: z.string().max(150).default(""),
        phone: z.string().max(30).default(""),
        email: z.union([z.literal(""), z.email()]).default(""),
        intent: z
          .enum(["", "Buy", "Rent", "Invest", "Sell", "Commercial", "Lease"])
          .default(""),
        lead_status: z
          .enum([
            "New",
            "Contacted",
            "Interested",
            "Qualified",
            "Viewing",
            "Negotiation",
            "Converted",
            "Follow-up",
            "Lost",
          ])
          .default("New"),
      })
      .extend({
        budget_max: z.number().positive().nullable().default(null),
        preferred_communities: z.array(z.string().max(100)).max(20).default([]),
        property_type: z.string().max(100).default(""),
        bedrooms: z.string().max(10).nullable().default(null),
        customer_type: z.string().max(100).default(""),
        lead_priority: z
          .enum(["Low", "Medium", "High", "Urgent"])
          .default("Medium"),
        requirement_completeness: z.number().min(0).max(100).default(0),
        assigned_agent: z.string().max(150).default(""),
        summary: z.string().max(4000).default(""),
        human_handoff_required: z.boolean().default(false),
        handoff_reason: z.string().max(2000).default(""),
      })
      .parse(req.body);
    await store.change((s) => {
      const previous = s.leads.find((l) => l.id === lead.id);
      if (
        res.locals.user.role === "user" &&
        previous &&
        previous.user_id !== res.locals.user.id
      )
        throw new HttpError(403, "Lead belongs to another user.");
      const saved = {
        ...createInitialLeadProfile(),
        ...lead,
        user_id: previous?.user_id || res.locals.user.id,
        updatedAt: new Date().toISOString(),
      };
      s.leads = s.leads.filter((l) => l.id !== lead.id);
      s.leads.push(saved);
    });
    res.json({ success: true, storage: store.mode });
  }),
);
app.get(
  "/api/followups",
  protect(staff),
  asyncRoute(async (_req, res) => {
    res.json({ tasks: (await store.read()).followups, storage: store.mode });
  }),
);
app.post(
  "/api/followups/sync",
  protect(staff),
  asyncRoute(async (req, res) => {
    const task = z
      .object({
        id: z.string().min(1).max(80),
        lead_id: z.string().min(1).max(80),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().min(1).max(2000),
        status: z
          .enum(["Pending", "Completed", "Rescheduled"])
          .default("Pending"),
      })
      .extend({
        customer_name: z.string().max(150).default(""),
        assigned_agent: z.string().max(150).default(""),
        action: z.string().max(1000).default(""),
        priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
        createdAt: z.string().default(new Date().toISOString()),
      })
      .parse(req.body);
    await store.change((s) => {
      if (!s.leads.some((l) => l.id === task.lead_id))
        throw new HttpError(404, "Lead not found.");
      s.followups = s.followups.filter((t) => t.id !== task.id);
      s.followups.push(task);
    });
    res.json({ success: true });
  }),
);

const groq = process.env.GROQ_API_KEY
  ? new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 15000,
      maxRetries: 0,
    })
  : null;
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 15000 },
    })
  : null;
app.post(
  "/api/chat",
  asyncRoute(async (req, res) => {
    await rateLimit(store, "chat:" + req.ip, 60, 60000);
    const input = z
      .object({
        message: z.string().trim().min(1).max(4000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(20)
          .default([]),
        currentLead: z
          .object({
            intent: z
              .enum([
                "",
                "Buy",
                "Rent",
                "Invest",
                "Sell",
                "Commercial",
                "Lease",
              ])
              .optional(),
            budget_max: z.number().positive().nullable().optional(),
            preferred_communities: z
              .array(z.string().max(100))
              .max(20)
              .optional(),
            target_city: z.enum(["Dubai", "Mumbai", "Both"]).optional(),
            property_type: z.string().max(100).optional(),
            bedrooms: z.string().max(10).nullable().optional(),
          })
          .extend({
            full_name: z.string().max(150).optional(),
            mobile: z.string().max(30).optional(),
            email: z.string().max(254).optional(),
            ready_or_offplan: z.string().max(30).optional(),
            financing: z.string().max(100).optional(),
            timeline: z.string().max(100).optional(),
            rental_budget: z.number().positive().nullable().optional(),
            furnishing: z.string().max(100).optional(),
            move_in_date: z.string().max(100).optional(),
            investment_goal: z.string().max(200).optional(),
            contact_declined: z.boolean().optional(),
            contact_pending: z.enum(["name", "mobile", "email"]).optional(),
            contact_recheck_asked: z.boolean().optional(),
            unsure_slots: z.array(z.string().max(100)).max(20).optional(),
            is_nri: z.boolean().optional(),
          })
          .default({}),
        conversationStage: z
          .enum([
            "new",
            "greet",
            "classify_intent",
            "qualify_buy",
            "qualify_rent",
            "qualify_invest",
            "qualify_sell",
            "search_properties",
            "present_results",
            "no_match",
            "agent_handoff",
            "qualify_contact",
            "sell_handoff",
          ])
          .default("new"),
      })
      .parse(req.body);
    const s = await store.read();
    const properties = s.properties
      .filter((p) => isPublic(p) && p.currency === "AED")
      .map((p) => ({
        ...p,
        status: "Ready",
        bedrooms: p.bedrooms === 0 ? "Studio" : String(p.bedrooms),
        community: p.community || "",
        price_aed: p.price_aed || 0,
        size_sqft: p.size_sqft || 0,
      }));
    injectDependencies({
      groq,
      gemini,
      groqModel: process.env.GROQ_MODEL,
      pdfChunks: [],
      properties: properties as any,
    });
    const result = await runLykaAgent({
      userMessage: input.message,
      chatHistory: input.history,
      profile: input.currentLead,
      conversationStage: input.conversationStage,
    });
    const available = new Set(
      (await store.read()).properties.filter(isPublic).map((p) => p.id),
    );
    res.json({
      ...result,
      matchedProperties: result.matchedProperties.filter((p) =>
        available.has(p.id),
      ),
    });
  }),
);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.path === "/server.js" || req.path.endsWith(".map")) {
      res.status(404).send("Not found");
      return;
    }
    next();
  });
  app.use(express.static(directory));
  app.get("*", (_req, res) => res.sendFile(path.join(directory, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    err instanceof ZodError
      ? 400
      : err instanceof HttpError
        ? err.status
        : err.type === "entity.too.large"
          ? 413
          : err.type === "entity.parse.failed"
            ? 400
            : 500;
  if (status === 500)
    console.error("Request failed:", err.code || err.name || "Error");
  res.status(status).json({
    error:
      status === 500
        ? "The operation could not be saved. Please retry."
        : err instanceof ZodError
          ? "Invalid request data."
          : err.message,
    details:
      err instanceof ZodError
        ? err.issues
        : err instanceof HttpError
          ? err.details
          : undefined,
  });
});
const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log(
    `Lyka Realty ready on port ${process.env.PORT || 3000} (${store.mode})`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      store.close().finally(() => process.exit(0));
    });
  });
