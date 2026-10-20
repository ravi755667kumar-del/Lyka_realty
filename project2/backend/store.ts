import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { Listing } from "../src/types/listing.js";

export type Role = "admin" | "property_manager" | "sales_manager" | "user";
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash?: string;
}
export interface State {
  properties: Listing[];
  users: User[];
  sessions: any[];
  otps: any[];
  leads: any[];
  followups: any[];
  bookings: any[];
  events: any[];
  history: any[];
  embeddings: any[];
  rateLimits: Record<string, number[]>;
}
export interface Store {
  mode: string;
  read(): Promise<State>;
  change<T>(fn: (state: State) => T): Promise<T>;
  close(): Promise<void>;
}
export const emptyState = (): State => ({
  properties: [],
  users: [],
  sessions: [],
  otps: [],
  leads: [],
  followups: [],
  bookings: [],
  events: [],
  history: [],
  embeddings: [],
  rateLimits: {},
});

// A single transactional document keeps bookings, audit events and inventory atomic.
// It is intentionally a small-prototype store; no silent in-memory fallback exists.
export async function openStore(): Promise<Store> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS lyka_state (id integer PRIMARY KEY CHECK (id=1), payload jsonb NOT NULL)",
    );
    await pool.query(
      "INSERT INTO lyka_state VALUES (1,$1) ON CONFLICT DO NOTHING",
      [JSON.stringify(emptyState())],
    );
    return {
      mode: "PostgreSQL",
      async read() {
        return (await pool.query("SELECT payload FROM lyka_state WHERE id=1"))
          .rows[0].payload;
      },
      async change(fn) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const state = (
            await client.query(
              "SELECT payload FROM lyka_state WHERE id=1 FOR UPDATE",
            )
          ).rows[0].payload;
          const result = fn(state);
          await client.query("UPDATE lyka_state SET payload=$1 WHERE id=1", [
            JSON.stringify(state),
          ]);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      async close() {
        await pool.end();
      },
    };
  }
  const filename = path.resolve(process.env.DATA_FILE || "data/lyka.sqlite");
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(
    "PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO app_state VALUES (1,?)").run(
    JSON.stringify(emptyState()),
  );
  const read = () =>
    JSON.parse(
      (db.prepare("SELECT payload FROM app_state WHERE id=1").get() as any)
        .payload,
    ) as State;
  return {
    mode: "SQLite",
    async read() {
      return read();
    },
    async change(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = read();
        const result = fn(state);
        db.prepare("UPDATE app_state SET payload=? WHERE id=1").run(
          JSON.stringify(state),
        );
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
}
