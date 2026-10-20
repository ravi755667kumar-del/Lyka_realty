# Project 02 — Property Listing & CRM Assistant

A React/Express application for preparing and reviewing property listings, customer chat, lead CRM, bookings, and property reporting.

## Start locally

Requires **Node 24+** (SQLite support) and **npm 11**. Use the committed npm lockfile; npm is the supported package manager.

```bash
npm ci
cp .env.example .env.local
# Fill ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters.
# Enable SEED_DEMO=true only if you want 20 fictional example listings.
npm run dev
```

Open `http://localhost:3000`. Sign in with the first administrator account configured above. There are no default passwords. Bootstrap environment variables only create the first admin; use **Access settings** to change accounts or create property/sales manager accounts. Passwords are stored with salted scrypt hashes and never returned by an API. Existing sessions are revoked after a credential change.

Production:

```bash
npm run build
npm start
```

Set `APP_ORIGIN` to the exact browser origin, `COOKIE_SECURE=true` behind HTTPS, and keep application data on persistent storage. Sessions use HttpOnly, SameSite=Strict cookies with eight-hour expiry. Never expose the development server publicly as a production deployment.

## Storage and migrations

SQLite at `DATA_FILE` (default `data/lyka.sqlite`) is the local durable database. Set `DATABASE_URL` to use PostgreSQL instead. Startup creates the required `lyka_state` table and never silently falls back after a database failure. The PostgreSQL user needs table creation rights on first startup. `SELECT ... FOR UPDATE`/SQLite immediate transactions keep inventory, bookings, and audit events atomic, including concurrent booking requests.

This prototype stores a version-one application document in SQL, rather than a normalized production CRM schema. Plan a normalized-table migration before scaling to large datasets. Back up the SQL database and use a single deployment per SQLite file; use PostgreSQL for multiple application instances. Store secrets/data outside the web root and do not commit them.

The previous Firebase client write path and default-credential login are no longer used by the application entry point. **Existing Firebase data is not automatically copied or modified.** Export and explicitly migrate authorized data before using this as a replacement for an existing deployment. The checked-in Firestore rules now deny all direct client access; deploy those rules separately if the old Firebase database is still exposed. Rotate all previously committed portal/system passwords in their real services and remove them from repository history using your normal incident process.

## AI, email and account configuration

- `OPENAI_API_KEY` and `OPENAI_MODEL`: structured property analysis using the official OpenAI SDK, with timeout, bounded retry and backend validation. Missing configuration returns 503. Invalid JSON/failed provider calls return a safe error while the input remains editable. No provider key goes to the browser.
- Title and description generation composes only the validated property facts. With OpenAI configured, constrained Structured Outputs select among verified factual renderings; a provider cannot add unsupported facts. Without OpenAI, an explicitly labeled facts template remains available. It does not invent yields, amenities, legal verification, distances, or unknown fields. All generated text remains editable.
- `GROQ_API_KEY`/`GROQ_MODEL` or `GEMINI_API_KEY`/`GEMINI_MODEL`: optional conversational AI. Chat retains its local qualification behavior without these keys; the server model/keys cannot be overridden by a chat request. Only approved available records priced in AED enter the chat inventory; listings in other currencies remain searchable in inventory, without an assumed exchange rate.
- `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`: required for customer email sign-in. Delivery failures return an error; the app never claims to send an email without a configured service. Codes expire in three minutes, are hashed server-side, limited to five generation attempts per hour and five verification attempts per three minutes, and are bound to email and portal.
- `REQUIRE_PORTAL_OTP=true`: additionally require email OTP along with staff passwords. Configure delivery before enabling. A customer OTP can never authenticate a staff account. Google/phone sign-in from the older frontend is not offered by the new server-session flow.

No live provider service was emulated as a substitute for a verified integration. Provider costs depend on usage/model selection; analysis is capped at 30 requests per account/hour and chat at 60 requests per IP/minute. Provider SDK timeouts bound individual calls; review quotas with the provider before deployment.

## Listing workflow

1. Sign in as administrator or property manager and choose **Properties → Prepare listing**.
2. Paste supplied property information and analyze it with AI, or enter known fields manually. Missing values remain unknown. Keep original source text alongside the record.
3. Edit fields and generate title/short/detailed descriptions.
4. Use **Validate & preview** to see required missing fields, warnings, duplicate candidates and a transparent quality breakdown.
5. Save an incomplete draft, or resolve required information and advance it for review. Only administrators can approve/publish a record. Publishing means a status in this application; no external portal receives content.
6. Public search and chat include only approved/published, available/vacant properties. Booking reserves the property atomically; cancellation releases it and records the change.

Drafts permit unknown fields, but provided prices/area must be positive, bed/bath counts must be nonnegative integers and enum values must be supported. `REQUIRED_LISTING_FIELDS` configures mandatory review fields. Exact reference duplicates are rejected. Potential duplicates compare building, location, type, bedrooms and area (within 5%); only an administrator can explicitly override a similar-record warning. Client-only confirmation never bypasses the server check.

Quality score out of 100: price/currency 15; location 15; type 10; beds/baths 10; area 10; availability 10; amenities 10; title and both descriptions 10; property identification 5; purpose and agent contact 5. Scores measure completeness, not value or legal compliance. Contradictory bedroom counts and unsupported marketing/return claims block progression for review.

## API and permissions

| Operation | Permission |
|---|---|
| GET /api/properties, GET /api/properties/:id | Public gets only approved available inventory without source/customer/contact details; staff get management records |
| POST /api/properties/analyze, /generate-description | Administrator/property manager |
| POST /api/properties/validate, /check-duplicates | Staff |
| POST /api/properties; PATCH /api/properties/:id; DELETE /api/properties/:id | Administrator/property manager; approval is administrator only |
| PATCH /api/properties/:id/status | Staff; approval is administrator only |
| POST /api/properties/book, /unbook; GET /api/bookings | Staff |
| GET /api/dashboard/stats; follow-up management | Staff |
| GET /api/leads; POST /api/leads/sync | Staff or signed-in owner; owner cannot overwrite another user's lead |
| GET /api/auth/all-users | Administrator/sales manager; passwords/hashes excluded |
| POST /api/auth/save-portal-credential | Administrator only |

List filters: `q`, `community`, `type`, `status`, `availability`, `bedrooms`, `min_price`, `max_price`, `page` and `limit` (maximum 100). Error responses use an HTTP error status and `{error, details?}`. Failed transactions do not report a successful save. Never restore public Firestore rules as a workaround.

## Validation

```bash
npm run lint
npm run build
npm test
npm audit --omit=dev
```

Tests use temporary SQL files, random synthetic credentials, an isolated HTTP server, and local provider response fixtures; they do not mutate the configured Firebase project. Live email delivery, live model behavior and production PostgreSQL hosting still need environment-specific verification. Browser smoke checks should cover guest chat, all staff roles, listing analysis/edit/review, duplicate refusal, booking/cancellation and mobile layout.
