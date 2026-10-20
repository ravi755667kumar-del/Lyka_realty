import React, { useState } from "react";
import {
  LISTING_STATUSES,
  AVAILABILITY,
  type Listing,
  type Quality,
} from "../types/listing";
export async function api(path: string, body?: unknown, method?: string) {
  const response = await fetch(path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const blankListing = () =>
  ({
    property_reference: "",
    title: "",
    short_description: "",
    description: "",
    original_input: "",
    property_type: null,
    listing_purpose: null,
    community: null,
    city: "Dubai",
    building_name: null,
    bedrooms: null,
    bathrooms: null,
    size_sqft: null,
    price_aed: null,
    currency: "AED",
    amenities: [],
    features: [],
    view: null,
    status: "Draft",
    availability_status: "Unknown",
    contact_name: "",
    contact_mobile: "",
    image_url: "",
    developer: "",
    is_demo_data: false,
  }) as Partial<Listing>;
export function ListingWorkbench({
  initial,
  onSaved,
  onCancel,
  isAdmin,
}: {
  initial?: Listing;
  onSaved: () => void;
  onCancel: () => void;
  isAdmin: boolean;
}) {
  const [draft, setDraft] = useState<Partial<Listing>>(initial || blankListing);
  const [review, setReview] = useState<Quality>();
  const [matches, setMatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const set = (key: string, value: unknown) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setReview(undefined);
    setConfirmed(false);
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function validate() {
    const [v, d] = await Promise.all([
      api("/api/properties/validate", draft),
      api("/api/properties/check-duplicates", draft),
    ]);
    setReview(v.quality);
    setMatches(d.duplicates);
    return d.duplicates;
  }
  const field = (key: string, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        value={String(draft[key] ?? "")}
        onChange={(e) =>
          set(
            key,
            type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </label>
  );
  const select = (key: string, label: string, options: readonly string[]) => (
    <label>
      {label}
      <select
        value={String(draft[key] ?? "")}
        onChange={(e) => set(key, e.target.value || null)}
      >
        {!["city", "currency", "status", "availability_status"].includes(
          key,
        ) && <option value="">Unknown</option>}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="panel workbench">
      <div className="section-title">
        <div>
          <p className="eyebrow">Listing preparation</p>
          <h1>{initial ? "Edit property" : "Prepare a property listing"}</h1>
        </div>
        <button onClick={onCancel}>Close</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          void run(async () => {
            await validate();
            await api(
              initial ? `/api/properties/${initial.id}` : "/api/properties",
              { ...draft, confirm_similar: confirmed },
              initial ? "PATCH" : "POST",
            );
            onSaved();
          });
        }}
      >
        <label>
          Original property information
          <textarea
            rows={4}
            value={draft.original_input || ""}
            placeholder="Paste the supplied property facts. Unknown details will remain blank."
            onChange={(e) => set("original_input", e.target.value)}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            disabled={busy || !draft.original_input?.trim()}
            onClick={() =>
              void run(async () => {
                const r = await api("/api/properties/analyze", {
                  raw_text: draft.original_input,
                });
                setDraft((p) => ({
                  ...p,
                  ...r.property,
                  id: p.id,
                  property_reference: p.property_reference,
                }));
                setReview(r.quality);
              })
            }
          >
            Analyze with AI
          </button>
          <span className="muted">
            Only supplied facts are used. Review all results before saving.
          </span>
        </div>
        <div className="form-grid">
          {field("property_reference", "Property reference")}
          {select("property_type", "Property type", [
            "Apartment",
            "Villa",
            "Townhouse",
            "Penthouse",
            "Duplex",
            "Commercial / Office",
          ])}
          {select("listing_purpose", "Purpose", ["Sale", "Rent"])}
          {select("city", "City", ["Dubai", "Mumbai"])}
          {field("community", "Location / community")}
          {field("building_name", "Building name")}
          {field("bedrooms", "Bedrooms (0 = studio)", "number")}
          {field("bathrooms", "Bathrooms", "number")}
          {field("size_sqft", "Area (sq. ft.)", "number")}
          {field("price_aed", "Price / annual rent", "number")}
          {select("currency", "Currency", ["AED", "INR", "USD"])}
          {select("availability_status", "Availability", AVAILABILITY)}
          {field("view", "View")}
          {field("developer", "Developer")}
          {field("contact_name", "Agent name")}
          {field("contact_mobile", "Agent contact")}
          {field("image_url", "Photo URL")}
          <label>
            Amenities (comma separated)
            <input
              value={(draft.amenities || []).join(", ")}
              onChange={(e) =>
                set(
                  "amenities",
                  e.target.value.split(",").map((s) => s.trim()),
                )
              }
              onBlur={() =>
                set("amenities", (draft.amenities || []).filter(Boolean))
              }
            />
          </label>
        </div>
        <div className="actions">
          <button
            disabled={busy}
            type="button"
            onClick={() =>
              void run(async () => {
                const r = await api(
                  "/api/properties/generate-description",
                  draft,
                );
                setDraft((p) => ({
                  ...p,
                  title: r.title,
                  short_description: r.short_description,
                  description: r.description,
                }));
                setReview(undefined);
              })
            }
          >
            Generate title & descriptions
          </button>
        </div>
        {field("title", "Listing title")}
        <label>
          Short description
          <textarea
            rows={2}
            value={draft.short_description || ""}
            onChange={(e) => set("short_description", e.target.value)}
          />
        </label>
        <label>
          Detailed description
          <textarea
            rows={5}
            value={draft.description || ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        {select(
          "status",
          "Preparation status",
          isAdmin ? LISTING_STATUSES : LISTING_STATUSES.slice(0, 3),
        )}
        {review && (
          <div className="review">
            <h2>Listing quality: {review.score}/100</h2>
            <div className="score-grid">
              {review.breakdown.map((b) => (
                <div key={b.label}>
                  {b.label}
                  <strong>
                    {b.points}/{b.max}
                  </strong>
                </div>
              ))}
            </div>
            <p>
              Required information missing:{" "}
              {review.missing.join(", ") || "None"}
            </p>
            {review.warnings.map((w) => (
              <p className="warning" key={w}>
                {w}
              </p>
            ))}
          </div>
        )}
        {matches.length > 0 && (
          <div className="review">
            <h2>Duplicate review</h2>
            {matches.map((m) => (
              <p key={m.id}>
                {m.title}: {m.reason}
              </p>
            ))}
            {isAdmin && !matches.some((m) => m.exact) && (
              <label className="inline">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I reviewed these similar listings and confirm this is a separate
                property.
              </label>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await validate();
                setPreview(true);
              })
            }
          >
            Validate & preview
          </button>
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Processing…" : initial ? "Save changes" : "Save listing"}
          </button>
        </div>
      </form>
      {preview && (
        <div className="preview">
          <h2>Listing preview</h2>
          <h3>{draft.title || "Untitled property"}</h3>
          <p>{draft.short_description}</p>
          <p className="preserve">{draft.description}</p>
          <p>
            {draft.currency} {draft.price_aed?.toLocaleString()} ·{" "}
            {draft.community} · {draft.bedrooms ?? "?"} bedrooms ·{" "}
            {draft.bathrooms ?? "?"} bathrooms · {draft.size_sqft ?? "?"} sq.
            ft.
          </p>
          <p>{draft.amenities?.join(", ")}</p>
          <p>
            {draft.availability_status} · {draft.status} · Quality{" "}
            {review?.score}/100
          </p>
          <p className="muted">
            Saving records a listing in this application. Nothing is published
            to external portals.
          </p>
        </div>
      )}
    </section>
  );
}
