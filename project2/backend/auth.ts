import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import type { Store, State, User, Role } from "./store.js";
import { HttpError } from "./listings.js";
export const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase());
export const roles = [
  "admin",
  "property_manager",
  "sales_manager",
  "user",
] as const;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function passwordMatches(password: string, stored = "") {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function safeUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
export async function bootstrapAdmin(store: Store) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const clean = emailSchema.parse(email);
  if (password.length < 12)
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  await store.change((state) => {
    if (!state.users.some((u) => u.role === "admin"))
      state.users.push({
        id: randomUUID(),
        email: clean,
        name: "Administrator",
        role: "admin",
        passwordHash: hashPassword(password),
      });
  });
}
export async function rateLimit(
  store: Store,
  key: string,
  max: number,
  windowMs = 3600000,
) {
  const allowed = await store.change((state) => {
    const now = Date.now();
    // Bound both key count and history. Request IP comes from the socket unless
    // a trusted reverse-proxy configuration is explicitly installed.
    for (const k of Object.keys(state.rateLimits))
      if (!state.rateLimits[k].some((t) => now - t < 86400000))
        delete state.rateLimits[k];
    const entries = (state.rateLimits[key] || []).filter(
      (t) => now - t < windowMs,
    );
    if (entries.length >= max) return false;
    if (
      !Object.hasOwn(state.rateLimits, key) &&
      Object.keys(state.rateLimits).length >= 10000
    )
      return false;
    state.rateLimits[key] = [...entries, now];
    return true;
  });
  if (!allowed)
    throw new HttpError(429, "Too many requests. Please try again later.");
}
export function createSession(state: State, user: User, res: Response) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  state.sessions = state.sessions.filter((s) => s.expiresAt > now);
  state.sessions.push({
    tokenHash: digest(token),
    userId: user.id,
    expiresAt: now + 8 * 3600000,
  });
  res.cookie("lyka_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.COOKIE_SECURE === undefined
        ? process.env.NODE_ENV === "production"
        : process.env.COOKIE_SECURE === "true",
    maxAge: 8 * 3600000,
    path: "/",
  });
}
export function sessionHash(req: Request) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("lyka_session="))
    ?.slice("lyka_session=".length);
  return token ? digest(token) : "";
}
export async function currentUser(
  store: Store,
  req: Request,
): Promise<User | undefined> {
  const state = await store.read();
  const session = state.sessions.find(
    (s) => s.tokenHash === sessionHash(req) && s.expiresAt > Date.now(),
  );
  return session ? state.users.find((u) => u.id === session.userId) : undefined;
}
export function authorize(store: Store, allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    currentUser(store, req)
      .then((user) => {
        if (!user) throw new HttpError(401, "Sign in to continue.");
        if (!allowed.includes(user.role))
          throw new HttpError(403, "Your role does not permit this action.");
        res.locals.user = user;
        next();
      })
      .catch(next);
  };
}
export async function login(store: Store, req: Request, res: Response) {
  await rateLimit(store, "login-ip:" + req.ip, 20, 900000);
  const { email, password, portal, otp } = z
    .object({
      email: emailSchema,
      password: z.string().min(1).max(200),
      portal: z.enum(roles).default("admin"),
      otp: z.string().optional(),
    })
    .parse(req.body);
  await rateLimit(store, "login-email:" + email, 10, 900000);
  const state = await store.read();
  const user = state.users.find((u) => u.email === email && u.role === portal);
  if (!user || !passwordMatches(password, user.passwordHash))
    throw new HttpError(401, "Invalid email or password.");
  await store.change((s) => {
    const live = s.users.find((u) => u.id === user.id);
    if (!live || live.passwordHash !== user.passwordHash)
      throw new HttpError(401, "Credentials changed. Please sign in again.");
    if (process.env.REQUIRE_PORTAL_OTP === "true")
      consumeOtp(s, email, portal, otp || "");
    createSession(s, user, res);
    s.events.push({
      id: randomUUID(),
      userId: user.id,
      email: user.email,
      fullName: user.name,
      timestamp: new Date().toISOString(),
      authProvider: "Portal",
    });
  });
  res.json({ success: true, user: safeUser(user) });
}
function consumeOtp(state: State, email: string, portal: string, otp: string) {
  const record = state.otps.find(
    (o) => o.email === email && o.portal === portal,
  );
  if (!record || record.expiresAt < Date.now() || record.hash !== digest(otp))
    throw new HttpError(400, "Invalid or expired verification code.");
  state.otps = state.otps.filter((o) => o !== record);
}
export async function sendOtp(store: Store, req: Request, res: Response) {
  await rateLimit(store, "otp-ip:" + req.ip, 20);
  const { email, portal } = z
    .object({ email: emailSchema, portal: z.enum(roles).default("user") })
    .parse(req.body);
  await rateLimit(store, "otp-email:" + email, 5);
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL)
    throw new HttpError(
      503,
      "Email verification is unavailable. Configure the email delivery service.",
    );
  if (
    portal !== "user" &&
    !(await store.read()).users.some(
      (u) => u.email === email && u.role === portal,
    )
  )
    throw new HttpError(
      400,
      "This email is not registered for the selected portal.",
    );
  const code = String(randomInt(100000, 1000000));
  let response: globalThis.Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "Lyka Realty" },
        to: [{ email }],
        subject: "Your Lyka Realty verification code",
        textContent: `Your code is ${code}. It expires in 3 minutes.`,
      }),
    });
  } catch {
    throw new HttpError(
      502,
      "Could not deliver the verification email. Please retry later.",
    );
  }
  if (!response.ok)
    throw new HttpError(
      502,
      "Email delivery was rejected. Please retry later.",
    );
  await store.change((state) => {
    state.otps = state.otps.filter(
      (o) =>
        o.expiresAt > Date.now() && !(o.email === email && o.portal === portal),
    );
    state.otps.push({
      email,
      portal,
      hash: digest(code),
      expiresAt: Date.now() + 180000,
    });
  });
  res.json({
    success: true,
    expiresInSeconds: 180,
    message: "Verification email sent.",
  });
}
export async function verifyOtp(store: Store, req: Request, res: Response) {
  await rateLimit(store, "verify-ip:" + req.ip, 30, 900000);
  const { email, otp, portal, name } = z
    .object({
      email: emailSchema,
      otp: z.string().regex(/^\d{6}$/),
      portal: z.enum(roles).default("user"),
      name: z.string().trim().max(150).default("Customer"),
    })
    .parse(req.body);
  await rateLimit(store, "verify-email:" + email, 5, 180000);
  // Portal OTPs are consumed only as part of the password login transaction.
  if (portal !== "user")
    throw new HttpError(
      400,
      "Submit the verification code together with your portal password.",
    );
  const user = await store.change((state) => {
    consumeOtp(state, email, "user", otp);
    let u = state.users.find((x) => x.email === email && x.role === "user");
    if (!u) {
      u = { id: randomUUID(), email, name, role: "user" };
      state.users.push(u);
    }
    createSession(state, u, res);
    return safeUser(u);
  });
  res.json({ success: true, valid: true, user });
}
