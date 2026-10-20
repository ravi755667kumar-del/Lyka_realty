import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

test("secure API, persistence, production serving and booking lifecycle", async (t) => {
  let externalDatabase = process.env.TEST_DATABASE_URL || "";
  const pool = externalDatabase
    ? new Pool({ connectionString: externalDatabase })
    : null;
  const schema = "test_" + randomBytes(12).toString("hex");
  if (pool) {
    await pool.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(externalDatabase);
    url.searchParams.set("options", `-c search_path=${schema}`);
    externalDatabase = url.toString();
  }
  const dir = await mkdtemp(path.join(tmpdir(), "lyka-test-"));
  const password = randomBytes(24).toString("hex");
  const finder = createServer();
  await new Promise<void>((r) => finder.listen(0, "127.0.0.1", r));
  const port = (finder.address() as any).port;
  await new Promise<void>((r) => finder.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess;
  let cookie = "";
  let output = "";
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATA_FILE: path.join(dir, "test.sqlite"),
    DATABASE_URL: externalDatabase,
    ADMIN_EMAIL: "admin@example.invalid",
    ADMIN_PASSWORD: password,
    SEED_DEMO: "true",
    COOKIE_SECURE: "false",
    REQUIRE_PORTAL_OTP: "false",
    APP_ORIGIN: base,
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    GROQ_API_KEY: "",
    BREVO_API_KEY: "",
    BREVO_SENDER_EMAIL: "",
  };
  async function start() {
    child = spawn(process.execPath, ["dist/server.js"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => (output += d));
    child.stderr?.on("data", (d) => (output += d));
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null)
        throw new Error("Server failed to start: " + output);
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Readiness timeout: " + output);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const closed = new Promise((r) => child.once("exit", r));
      child.kill("SIGTERM");
      await closed;
    }
  }
  async function call(
    url: string,
    data?: any,
    method?: string,
    authenticated = true,
  ) {
    const r = await fetch(base + url, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: {
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    let b: any;
    try {
      b = await r.json();
    } catch {
      b = null;
    }
    return { status: r.status, body: b, headers: r.headers };
  }
  try {
    await start();
    await t.test("production root and assets load", async () => {
      const r = await fetch(base);
      assert.equal(r.status, 200);
      const html = await r.text();
      const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/);
      assert(asset);
      assert.equal((await fetch(base + asset[1])).status, 200);
      assert.equal((await fetch(base + "/server.js")).status, 404);
    });
    await t.test("anonymous writes and password endpoints denied", async () => {
      for (const [url, data] of [
        ["/api/auth/portal-credentials", undefined],
        ["/api/auth/save-portal-credential", {}],
        ["/api/properties", {}],
        ["/api/properties/book", {}],
        ["/api/auth/reset-otp-rate-limit", {}],
        ["/api/auth/save-user-login", {}],
      ] as any[])
        assert.equal(
          (await call(url, data, undefined, false)).status,
          401,
          url,
        );
    });
    await t.test("browser storage cannot create a server session", async () => {
      assert.equal(
        (await call("/api/auth/session", undefined, undefined, false)).body
          .user,
        null,
      );
      assert.equal(
        (await call("/api/dashboard/stats", undefined, undefined, false))
          .status,
        401,
      );
    });
    await t.test(
      "password login establishes an HttpOnly session without disclosing hash",
      async () => {
        const r = await call("/api/auth/login", {
          email: "admin@example.invalid",
          password,
          portal: "admin",
        });
        assert.equal(r.status, 200);
        assert.equal(r.body.user.passwordHash, undefined);
        assert(r.headers.get("set-cookie")?.includes("HttpOnly"));
        cookie = r.headers.get("set-cookie")!.split(";")[0];
      },
    );
    await t.test("credential listing includes no plaintext/hash", async () => {
      const r = await call("/api/auth/portal-credentials");
      assert.equal(r.status, 200);
      assert(!JSON.stringify(r.body).includes(password));
      assert(!JSON.stringify(r.body).includes("passwordHash"));
    });
    await t.test(
      "cross origin writes and malformed chat rejected",
      async () => {
        const r = await fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: { Origin: "https://untrusted.invalid", Cookie: cookie },
        });
        assert.equal(r.status, 403);
        for (const data of [
          { message: 12 },
          { message: "Hi", history: "bad" },
          { message: "" },
          { message: "Hi", currentLead: { preferred_communities: "bad" } },
        ])
          assert.equal((await call("/api/chat", data)).status, 400);
      },
    );
    await t.test("seeds, filtering and individual detail", async () => {
      const r = await call("/api/properties");
      assert.equal(r.body.total, 20);
      assert.equal((await call("/api/properties?max_price=1")).body.total, 0);
      assert.equal(
        (await call("/api/properties/" + r.body.properties[0].id)).status,
        200,
      );
    });
    await t.test("missing mail/AI fail truthfully", async () => {
      assert.equal(
        (
          await call(
            "/api/auth/send-email-otp",
            { email: "client@example.invalid", portal: "user" },
            undefined,
            false,
          )
        ).status,
        503,
      );
      assert.equal(
        (
          await call("/api/properties/analyze", {
            raw_text: "2 bedroom apartment",
          })
        ).status,
        503,
      );
    });
    const property = {
      id: "TEST-PROPERTY",
      property_reference: "SYNTHETIC-TEST",
      title: "Synthetic apartment",
      short_description: "Known facts",
      description: "Synthetic property facts only",
      property_type: "Apartment",
      listing_purpose: "Sale",
      community: "Synthetic Community",
      city: "Dubai",
      bedrooms: 2,
      bathrooms: 2,
      size_sqft: 1250,
      price_aed: 1000000,
      currency: "AED",
      amenities: ["Parking"],
      availability_status: "Available",
      status: "Approved",
      contact_name: "Synthetic agent",
      contact_mobile: "+971500000000",
    };
    await t.test("invalid numbers and arbitrary enums rejected", async () => {
      for (const extra of [
        { price_aed: -1 },
        { size_sqft: 0 },
        { bedrooms: -1 },
        { property_type: "Spaceship" },
        { status: "Anything" },
      ])
        assert.equal(
          (await call("/api/properties", { ...property, ...extra })).status,
          400,
        );
    });
    await t.test("save, duplicate prevention, update and stats", async () => {
      assert.equal((await call("/api/properties", property)).status, 201);
      assert.equal(
        (await call("/api/properties", { ...property, id: "OTHER" })).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/api/properties/" + property.id,
            { title: "Updated synthetic apartment" },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            "/api/properties/" + property.id + "/status",
            { status: "Approved" },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal((await call("/api/dashboard/stats")).body.total, 21);
    });
    await t.test(
      "database failures never report a successful write",
      async () => {
        if (pool)
          await pool.query(
            `ALTER TABLE ${schema}.lyka_state RENAME TO unavailable_state`,
          );
        else await chmod(dir, 0o500);
        try {
          assert.equal(
            (
              await call("/api/properties", {
                ...property,
                id: "FAILED-SAVE",
                property_reference: "FAILED-SAVE",
              })
            ).status,
            500,
          );
        } finally {
          if (pool)
            await pool.query(
              `ALTER TABLE ${schema}.unavailable_state RENAME TO lyka_state`,
            );
          else await chmod(dir, 0o700);
        }
        assert.equal((await call("/api/properties/FAILED-SAVE")).status, 404);
      },
    );
    await t.test(
      "concurrent booking produces exactly one success",
      async () => {
        const input = {
          propertyId: property.id,
          customerName: "Synthetic Customer",
          customerPhone: "+971500000000",
        };
        const responses = await Promise.all([
          call("/api/properties/book", input),
          call("/api/properties/book", input),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          (
            await call("/api/properties/book", {
              ...input,
              propertyId: "MISSING",
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "booked property hidden publicly; cancellation clears metadata",
      async () => {
        assert.equal(
          (
            await call(
              "/api/properties/" + property.id,
              undefined,
              undefined,
              false,
            )
          ).status,
          404,
        );
        assert.equal(
          (await call("/api/properties/unbook", { propertyId: property.id }))
            .status,
          200,
        );
        const p = (await call("/api/properties/" + property.id)).body.property;
        assert.equal(p.is_booked, false);
        for (const k of [
          "booking_id",
          "assigned_to",
          "assigned_email",
          "booked_at",
          "booking_amount_aed",
          "booking_notes",
        ])
          assert.equal(p[k], undefined);
      },
    );
    await t.test("role authorization enforced by server", async () => {
      const other = randomBytes(20).toString("hex");
      assert.equal(
        (
          await call("/api/auth/save-portal-credential", {
            portal: "sales_manager",
            email: "sales@example.invalid",
            password: other,
            name: "Sales",
          })
        ).status,
        200,
      );
      const login = await call("/api/auth/login", {
        email: "sales@example.invalid",
        password: other,
        portal: "sales_manager",
      });
      const saved = cookie;
      cookie = login.headers.get("set-cookie")!.split(";")[0];
      assert.equal(
        (await call("/api/properties", { ...property, id: "DENIED" })).status,
        403,
      );
      assert.equal((await call("/api/auth/portal-credentials")).status, 403);
      cookie = saved;
    });
    await t.test("leads, followups and session survive restart", async () => {
      assert.equal(
        (
          await call("/api/leads/sync", {
            id: "TEST-LEAD",
            full_name: "Synthetic Customer",
            intent: "Buy",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call("/api/followups/sync", {
            id: "TEST-TASK",
            lead_id: "TEST-LEAD",
            date: "2026-11-01",
            reason: "Synthetic follow-up",
          })
        ).status,
        200,
      );
      await stop();
      await start();
      assert.equal((await call("/api/auth/session")).body.user.role, "admin");
      assert.equal((await call("/api/leads")).body.leads.length, 1);
      assert.equal((await call("/api/followups")).body.tasks.length, 1);
      assert.equal((await call("/api/properties")).body.total, 21);
    });
    await t.test("delete and logout", async () => {
      assert.equal(
        (await call("/api/properties/" + property.id, undefined, "DELETE"))
          .status,
        200,
      );
      assert.equal((await call("/api/auth/logout", {})).status, 200);
      assert.equal((await call("/api/dashboard/stats")).status, 401);
    });
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
    if (pool) {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    }
  }
});
