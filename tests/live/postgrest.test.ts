import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

// Live-stack test: drives the REAL lib/backend.ts and the raw REST surface
// against a REAL PostgREST over the fully-migrated schema. Run via
// `npm run test:live` (scripts/test-live-stack.sh) — skipped without it.
//
// The proxy below does two jobs: (1) bridges supabase-js's /rest/v1 prefix
// to PostgREST's root, and (2) injects the Authorization header for a
// switchable persona — so the app's own singleton client can act as alice,
// bob, carol, or anonymous, exactly as separate signed-in sessions would.

const REST = process.env.POSTGREST_URL;
const SECRET = process.env.POSTGREST_JWT_SECRET;
const PG_ADMIN = process.env.PG_ADMIN;
const gated = !REST || !SECRET || !PG_ADMIN;

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
const CAROL = "00000000-0000-0000-0000-00000000000c";
const TRIP = "11111111-1111-1111-1111-111111111111";
const PIN_SINTRA = "22222222-2222-2222-2222-222222222222";
const REFL = "33333333-3333-3333-3333-333333333333";

function jwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({
    role: "authenticated",
    sub,
    iss: "waypoint-live-test",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const sig = crypto.createHmac("sha256", SECRET!).update(body).digest("base64url");
  return `${body}.${sig}`;
}

type Persona = "alice" | "bob" | "carol" | "anon";
let actAs: Persona = "alice";
const tokens: Record<Exclude<Persona, "anon">, string> = {
  alice: "",
  bob: "",
  carol: "",
};

let proxy: http.Server;
let backend: typeof import("../../lib/backend");

function sql(q: string): string {
  return execSync(`${PG_ADMIN} -c "${q.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim();
}

async function rest(
  path: string,
  opts: { as?: Persona; method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; json: unknown }> {
  const who = opts.as ?? "anon";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(who !== "anon" ? { Authorization: `Bearer ${tokens[who]}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${REST}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* 204s */
  }
  return { status: res.status, json };
}

async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timed out waiting for: ${what}`);
}

before(async () => {
  if (gated) return;
  tokens.alice = jwt(ALICE);
  tokens.bob = jwt(BOB);
  tokens.carol = jwt(CAROL);

  // The /rest/v1 → / bridge with persona-based auth injection.
  proxy = http.createServer((req, res) => {
    const path = (req.url ?? "").replace(/^\/rest\/v1/, "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string" && !["host", "authorization", "apikey"].includes(k)) headers[k] = v;
    }
    if (actAs !== "anon") headers["authorization"] = `Bearer ${tokens[actAs]}`;
    const up = http.request(
      `${REST}${path}`,
      { method: req.method, headers },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 500, upRes.headers);
        upRes.pipe(res);
      }
    );
    req.pipe(up);
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
  const port = (proxy.address() as { port: number }).port;

  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-unused-by-postgrest";
  backend = await import("../../lib/backend");
});

after(() => {
  proxy?.close();
});

test("loadWorld reads the synthetic world through real PostgREST embedding", { skip: gated }, async () => {
  actAs = "alice";
  const world = await backend.loadWorld(ALICE);
  assert.ok(world, "loadWorld returned a world");
  assert.ok(world!.users.length >= 3, "signup trigger created profiles for all synthetic users");
  assert.equal(world!.pins.length, 2);
  const trip = world!.trips.find((t) => t.id === TRIP)!;
  assert.equal(trip.stops.length, 2, "trip_stops embedded and ordered");
  assert.ok(trip.completedOn, "completed_on round-trips");
  assert.equal(world!.reflections.length, 0);
});

test("backend.syncSaveReflection creates a draft with answers (write-through)", { skip: gated }, async () => {
  actAs = "alice";
  backend.syncSaveReflection({
    id: REFL,
    tripId: TRIP,
    userId: ALICE,
    visibility: "friends",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers: [
      {
        questionId: "dont_miss",
        prompt: "What would you tell a friend not to miss?",
        text: "The sea mist over Sintra at dawn.",
        pinId: PIN_SINTRA,
        source: "text",
      },
    ],
  });
  // The write-through upserts the reflection, then replaces its answers —
  // poll until BOTH are visible (observing the gap between them is normal).
  const got = await until(
    () => rest(`/trip_reflections?id=eq.${REFL}&select=*,reflection_answers(*)`, { as: "alice" }),
    (r) =>
      Array.isArray(r.json) &&
      (r.json as { reflection_answers: unknown[] }[])[0]?.reflection_answers.length === 1,
    "draft + answer visible to owner"
  );
  const row = (got.json as { status: string; reflection_answers: unknown[] }[])[0];
  assert.equal(row.status, "draft");
});

test("drafts are invisible to friend, stranger, and anonymous callers", { skip: gated }, async () => {
  for (const who of ["bob", "carol", "anon"] as const) {
    const r = await rest(`/trip_reflections?id=eq.${REFL}`, { as: who });
    assert.deepEqual(r.json, [], `${who} sees no draft`);
    const a = await rest(`/reflection_answers?reflection_id=eq.${REFL}`, { as: who });
    assert.deepEqual(a.json, [], `${who} sees no draft answers`);
  }
});

test("partial progress saves and resumes (wholesale answer replace)", { skip: gated }, async () => {
  actAs = "alice";
  backend.syncSaveReflection({
    id: REFL,
    tripId: TRIP,
    userId: ALICE,
    visibility: "friends",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers: [
      {
        questionId: "dont_miss",
        prompt: "What would you tell a friend not to miss?",
        text: "The sea mist over Sintra at dawn.",
        pinId: PIN_SINTRA,
        source: "text",
      },
      {
        questionId: "skip",
        prompt: "What would you skip next time?",
        text: "Peniche in August.",
        pinId: null,
        source: "text",
      },
    ],
  });
  await until(
    () => rest(`/reflection_answers?reflection_id=eq.${REFL}`, { as: "alice" }),
    (r) => Array.isArray(r.json) && (r.json as unknown[]).length === 2,
    "second answer lands"
  );
  // "Resume from another session": a fresh world load as the owner.
  const world = await backend.loadWorld(ALICE);
  assert.equal(world!.reflections[0]?.answers.length, 2);
  assert.equal(world!.reflections[0]?.status, "draft");
});

test("completing at friends visibility exposes it to the friend only", { skip: gated }, async () => {
  actAs = "alice";
  backend.syncSaveReflection({
    id: REFL,
    tripId: TRIP,
    userId: ALICE,
    visibility: "friends",
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers: [
      {
        questionId: "dont_miss",
        prompt: "What would you tell a friend not to miss?",
        text: "The sea mist over Sintra at dawn.",
        pinId: PIN_SINTRA,
        source: "text",
      },
    ],
  });
  await until(
    () => rest(`/trip_reflections?id=eq.${REFL}&status=eq.complete`, { as: "alice" }),
    (r) => (r.json as unknown[]).length === 1,
    "completion lands"
  );
  // The friend loads their world through the app's own loadWorld.
  actAs = "bob";
  const bobWorld = await backend.loadWorld(BOB);
  const refl = bobWorld!.reflections.find((r) => r.id === REFL);
  assert.ok(refl, "friend sees the completed debrief in loadWorld");
  assert.equal(refl!.answers[0].text, "The sea mist over Sintra at dawn.");
  // The stranger doesn't.
  const carol = await rest(`/trip_reflections?id=eq.${REFL}`, { as: "carol" });
  assert.deepEqual(carol.json, []);
});

test("private hides from everyone but the owner; public is world-readable, never writable", { skip: gated }, async () => {
  await rest(`/trip_reflections?id=eq.${REFL}`, {
    as: "alice",
    method: "PATCH",
    body: { visibility: "private" },
  });
  assert.deepEqual((await rest(`/trip_reflections?id=eq.${REFL}`, { as: "bob" })).json, []);

  await rest(`/trip_reflections?id=eq.${REFL}`, {
    as: "alice",
    method: "PATCH",
    body: { visibility: "public" },
  });
  const asCarol = await rest(`/trip_reflections?id=eq.${REFL}`, { as: "carol" });
  assert.equal((asCarol.json as unknown[]).length, 1, "public readable by stranger");
  // ...but read-only: her PATCH matches zero rows.
  const patch = await rest(`/trip_reflections?id=eq.${REFL}`, {
    as: "carol",
    method: "PATCH",
    body: { visibility: "private" },
    headers: { Prefer: "return=representation" },
  });
  assert.deepEqual(patch.json, [], "stranger PATCH affects nothing");
  await rest(`/trip_reflections?id=eq.${REFL}`, {
    as: "alice",
    method: "PATCH",
    body: { visibility: "friends" },
  });
});

test("unauthorized direct API writes are rejected", { skip: gated }, async () => {
  // Anonymous insert → 401/403.
  const anon = await rest(`/trip_reflections`, {
    method: "POST",
    body: { trip_id: TRIP, user_id: ALICE },
  });
  assert.ok([401, 403].includes(anon.status), `anon insert rejected (${anon.status})`);
  // Impersonation: bob inserting a reflection as alice → RLS with-check 403.
  const imp = await rest(`/trip_reflections`, {
    as: "bob",
    method: "POST",
    body: { trip_id: TRIP, user_id: ALICE },
  });
  assert.equal(imp.status, 403, "impersonated insert rejected");
  // Planting answers into alice's reflection → 403.
  const plant = await rest(`/reflection_answers`, {
    as: "bob",
    method: "POST",
    body: { reflection_id: REFL, question_id: "skip", prompt: "x", text: "planted" },
  });
  assert.equal(plant.status, 403, "answer planting rejected");
  // Cross-user PATCH/DELETE silently match zero rows.
  const patch = await rest(`/reflection_answers?reflection_id=eq.${REFL}`, {
    as: "bob",
    method: "PATCH",
    body: { text: "vandalized" },
    headers: { Prefer: "return=representation" },
  });
  assert.deepEqual(patch.json, []);
  const del = await rest(`/trip_reflections?id=eq.${REFL}`, {
    as: "bob",
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  assert.deepEqual(del.json, []);
});

test("edits replace downstream evidence after reload — no stale quotes", { skip: gated }, async () => {
  actAs = "alice";
  backend.syncSaveReflection({
    id: REFL,
    tripId: TRIP,
    userId: ALICE,
    visibility: "friends",
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers: [
      {
        questionId: "dont_miss",
        prompt: "What would you tell a friend not to miss?",
        text: "The sea mist — but go before 8, the queue is real.",
        pinId: PIN_SINTRA,
        source: "text",
      },
    ],
  });
  await until(
    () => rest(`/reflection_answers?reflection_id=eq.${REFL}&select=text`, { as: "alice" }),
    (r) => JSON.stringify(r.json).includes("go before 8"),
    "edit lands"
  );
  // The friend reloads and asks — the app's actual trust-surface path.
  actAs = "bob";
  const world = await backend.loadWorld(BOB);
  const { askFriends } = await import("../../lib/askFriends");
  const a = askFriends({
    question: "What should I know about Sintra?",
    viewerId: BOB,
    users: world!.users,
    pins: world!.pins,
    friendships: world!.friendships,
    follows: world!.follows,
    topPlaces: world!.topPlaces,
    trips: world!.trips,
    likeCounts: world!.likeCounts,
    reflections: world!.reflections,
  });
  assert.equal(a.quotes.length, 1);
  assert.ok(a.quotes[0].answer.text.includes("go before 8"), "new quote present");
  assert.ok(!JSON.stringify(a).includes("sea mist over Sintra at dawn."), "old quote gone");
});

test("unfriending immediately revokes access", { skip: gated }, async () => {
  sql(`delete from friendships where user_a = '${ALICE}' and user_b = '${BOB}'`);
  assert.deepEqual((await rest(`/trip_reflections?id=eq.${REFL}`, { as: "bob" })).json, []);
  actAs = "bob";
  const world = await backend.loadWorld(BOB);
  assert.equal(world!.reflections.length, 0, "loadWorld after unfriending carries no evidence");
});

test("syncCompleteTrip writes completed_on through PostgREST", { skip: gated }, async () => {
  sql(`update trips set completed_on = null where id = '${TRIP}'`);
  actAs = "alice";
  backend.syncCompleteTrip(TRIP, new Date().toISOString());
  await until(
    () => rest(`/trips?id=eq.${TRIP}&select=completed_on`, { as: "alice" }),
    (r) => Boolean((r.json as { completed_on: string | null }[])[0]?.completed_on),
    "completed_on set"
  );
});

test("deleting the anchored pin detaches the answer without deleting the debrief", { skip: gated }, async () => {
  const before = await rest(
    `/reflection_answers?reflection_id=eq.${REFL}&select=pin_id`,
    { as: "alice" }
  );
  assert.equal((before.json as { pin_id: string | null }[])[0].pin_id, PIN_SINTRA);
  await rest(`/pins?id=eq.${PIN_SINTRA}`, { as: "alice", method: "DELETE" });
  const after = await until(
    () => rest(`/reflection_answers?reflection_id=eq.${REFL}&select=pin_id`, { as: "alice" }),
    (r) => (r.json as { pin_id: string | null }[])[0]?.pin_id === null,
    "anchor nulled"
  );
  assert.equal((after.json as unknown[]).length, 1, "answer survives");
});

test("deleting the trip cascades the debrief and its answers away", { skip: gated }, async () => {
  await rest(`/trips?id=eq.${TRIP}`, { as: "alice", method: "DELETE" });
  await until(
    () => rest(`/trip_reflections?id=eq.${REFL}`, { as: "alice" }),
    (r) => (r.json as unknown[]).length === 0,
    "reflection cascaded"
  );
  const answers = await rest(`/reflection_answers?reflection_id=eq.${REFL}`, { as: "alice" });
  assert.deepEqual(answers.json, []);
});

test("syncDeleteReflection removes a debrief through the write path", { skip: gated }, async () => {
  // Fresh trip + debrief, then the app's own delete.
  sql(
    `insert into trips (id, user_id, title, visibility, completed_on) values ('11111111-1111-1111-1111-111111111112', '${ALICE}', 'Second trip', 'friends', now())`
  );
  actAs = "alice";
  backend.syncSaveReflection({
    id: "33333333-3333-3333-3333-333333333334",
    tripId: "11111111-1111-1111-1111-111111111112",
    userId: ALICE,
    visibility: "friends",
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    answers: [],
  });
  await until(
    () => rest(`/trip_reflections?id=eq.33333333-3333-3333-3333-333333333334`, { as: "alice" }),
    (r) => (r.json as unknown[]).length === 1,
    "second debrief created"
  );
  backend.syncDeleteReflection("33333333-3333-3333-3333-333333333334");
  await until(
    () => rest(`/trip_reflections?id=eq.33333333-3333-3333-3333-333333333334`, { as: "alice" }),
    (r) => (r.json as unknown[]).length === 0,
    "debrief deleted via backend"
  );
});
