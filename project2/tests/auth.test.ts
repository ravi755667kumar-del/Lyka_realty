import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../backend/store.js";
import { sendOtp, verifyOtp, rateLimit } from "../backend/auth.js";

test("OTP delivery, portal binding, verification limits and one-time consumption", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "lyka-auth-"));
  const old = { ...process.env };
  const nativeFetch = globalThis.fetch;
  process.env.DATA_FILE = path.join(dir, "state.sqlite");
  delete process.env.DATABASE_URL;
  process.env.BREVO_API_KEY = "synthetic-provider-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.invalid";
  const store = await openStore();
  let code = "";
  let emailDelivered = false;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options?.body as string);
    code = payload.textContent.match(/\b\d{6}\b/)[0];
    emailDelivered = true;
    return new Response("{}", { status: 201 });
  };
  const req = (body: any, ip = "synthetic-test") => ({ body, ip }) as any;
  const response = () => {
    const data: any = {};
    return {
      data,
      json(value: any) {
        data.body = value;
      },
      cookie(_name: any, value: any, options: any) {
        data.cookie = value;
        data.cookieOptions = options;
      },
    } as any;
  };
  try {
    const sent = response();
    await sendOtp(
      store,
      req({ email: "user@example.invalid", portal: "user" }),
      sent,
    );
    assert(emailDelivered);
    assert(sent.data.body.success);
    assert.equal((await store.read()).otps[0].code, undefined);
    assert(!(await store.read()).otps[0].hash.includes(code));
    await assert.rejects(
      () =>
        verifyOtp(
          store,
          req({ email: "user@example.invalid", portal: "admin", otp: code }),
          response(),
        ),
      /together with your portal password/,
    );
    await assert.rejects(
      () =>
        verifyOtp(
          store,
          req({ email: "user@example.invalid", portal: "user", otp: "000000" }),
          response(),
        ),
      /Invalid or expired/,
    );
    const verified = response();
    await verifyOtp(
      store,
      req({
        email: "user@example.invalid",
        portal: "user",
        otp: code,
        name: "Synthetic user",
      }),
      verified,
    );
    assert.equal(verified.data.body.user.role, "user");
    assert(verified.data.cookieOptions.httpOnly);
    await assert.rejects(
      () =>
        verifyOtp(
          store,
          req({ email: "user@example.invalid", portal: "user", otp: code }),
          response(),
        ),
      /Invalid or expired/,
    );
    const second = response();
    await sendOtp(
      store,
      req({ email: "expired@example.invalid", portal: "user" }),
      second,
    );
    await store.change((s) => {
      s.otps.find((o) => o.email === "expired@example.invalid").expiresAt =
        Date.now() - 1;
    });
    await assert.rejects(
      () =>
        verifyOtp(
          store,
          req({ email: "expired@example.invalid", portal: "user", otp: code }),
          response(),
        ),
      /Invalid or expired/,
    );
    for (let n = 0; n < 5; n++)
      await rateLimit(store, "long-window", 5, 3600000);
    await store.change((s) => {
      s.rateLimits["long-window"] = s.rateLimits["long-window"].map(
        (t) => t - 120000,
      );
    });
    await rateLimit(store, "short-window", 5, 60000);
    await assert.rejects(
      () => rateLimit(store, "long-window", 5, 3600000),
      /Too many/,
    );
    globalThis.fetch = async () => new Response("{}", { status: 500 });
    await assert.rejects(
      () =>
        sendOtp(
          store,
          req({ email: "failed@example.invalid", portal: "user" }),
          response(),
        ),
      /delivery was rejected/,
    );
    assert(
      !(await store.read()).otps.some(
        (o) => o.email === "failed@example.invalid",
      ),
    );
  } finally {
    globalThis.fetch = nativeFetch;
    for (const k of [
      "DATA_FILE",
      "DATABASE_URL",
      "BREVO_API_KEY",
      "BREVO_SENDER_EMAIL",
    ])
      old[k] === undefined ? delete process.env[k] : (process.env[k] = old[k]);
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
