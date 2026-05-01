import {
  AppPolicy,
  GuardRequest,
  evaluatePolicy,
  shouldSample,
} from "./policy";

export interface Env {
  APP_GUARD_RULES: KVNamespace;
  APP_GUARD_DB: D1Database;
  ADMIN_TOKEN: string;
}

const ALLOWED_CLIENT_FIELDS = new Set([
  "app_id",
  "version",
  "build_id",
  "batch_id",
  "channel",
  "sdk_version",
  "runtime",
  "platform",
  "install_id",
  "event",
]);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "POST" && url.pathname === "/check") return cors(await handleCheck(request, env));
      if (request.method === "POST" && url.pathname === "/event") return cors(await handleEvent(request, env));
      if (request.method === "GET" && url.pathname === "/admin/apps") return cors(await handleApps(request, env, url));
      if (request.method === "GET" && url.pathname === "/admin/stats") return cors(await handleStats(request, env, url));
      if (request.method === "GET" && url.pathname === "/admin/rules") return cors(await handleGetRules(request, env, url));
      if (request.method === "POST" && url.pathname === "/admin/rules") return cors(await handleRules(request, env));
      return json({ error: "not_found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return cors(json({ error: "internal_error", message }, 500));
    }
  },
};

async function handleCheck(request: Request, env: Env): Promise<Response> {
  const body = await readClientPayload(request);
  const validation = validateGuardRequest(body);
  if (validation) return json({ error: validation }, 400);

  const policy = await loadPolicy(env, body.app_id);
  const decision = evaluatePolicy(policy, body);

  if (shouldSample(policy, body.install_id)) {
    await insertEvent(env, { ...body, event: "startup_check" }, decision.status);
  }

  return json(decision);
}

async function handleEvent(request: Request, env: Env): Promise<Response> {
  const body = await readClientPayload(request);
  const validation = validateGuardRequest(body);
  if (validation) return json({ error: validation }, 400);
  if (!body.event || !/^[a-z][a-z0-9_:-]{0,63}$/.test(body.event)) {
    return json({ error: "invalid_event" }, 400);
  }

  const policy = await loadPolicy(env, body.app_id);
  if (shouldSample(policy, body.install_id)) {
    await insertEvent(env, body, "allow");
  }
  return json({ ok: true });
}

async function handleApps(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") ?? "30") || 30));
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const rows = await env.APP_GUARD_DB.prepare(
    `SELECT app_id,
            COUNT(*) AS checks,
            COUNT(DISTINCT install_id) AS installs,
            MAX(created_at) AS last_seen
     FROM guard_events
     WHERE event = 'startup_check' AND created_at >= ?
     GROUP BY app_id
     ORDER BY last_seen DESC, checks DESC
     LIMIT 200`,
  ).bind(since).all();

  return json({
    days,
    apps: rows.results,
  });
}

async function handleStats(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  const appId = url.searchParams.get("app_id");
  if (!appId) return json({ error: "missing_app_id" }, 400);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") ?? "30") || 30));

  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const versionRows = await env.APP_GUARD_DB.prepare(
    `SELECT version, COUNT(*) AS checks, COUNT(DISTINCT install_id) AS installs
     FROM guard_events
     WHERE app_id = ? AND event = 'startup_check' AND created_at >= ?
     GROUP BY version
     ORDER BY checks DESC`,
  ).bind(appId, since).all();

  const buildRows = await env.APP_GUARD_DB.prepare(
    `SELECT version, build_id, batch_id, COUNT(*) AS checks, COUNT(DISTINCT install_id) AS installs
     FROM guard_events
     WHERE app_id = ? AND event = 'startup_check' AND created_at >= ?
     GROUP BY version, build_id, batch_id
     ORDER BY installs DESC, checks DESC
     LIMIT 100`,
  ).bind(appId, since).all();

  const dailyRows = await env.APP_GUARD_DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS checks, COUNT(DISTINCT install_id) AS installs
     FROM guard_events
     WHERE app_id = ? AND event = 'startup_check' AND created_at >= ?
     GROUP BY day
     ORDER BY day DESC`,
  ).bind(appId, since).all();

  return json({
    app_id: appId,
    days,
    versions: versionRows.results,
    builds: buildRows.results,
    daily: dailyRows.results,
  });
}

async function handleGetRules(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  const appId = url.searchParams.get("app_id");
  if (!appId || !/^[a-zA-Z0-9_.-]{1,80}$/.test(appId)) {
    return json({ error: "invalid_app_id" }, 400);
  }

  const key = policyKey(appId);
  const policy = await env.APP_GUARD_RULES.get(key, "json") as AppPolicy | null;
  return json({
    app_id: appId,
    key,
    policy: policy ?? defaultPolicy(),
    exists: Boolean(policy),
  });
}

async function handleRules(request: Request, env: Env): Promise<Response> {
  const auth = requireAdmin(request, env);
  if (auth) return auth;

  const body = await request.json() as { app_id?: string; policy?: AppPolicy };
  if (!body.app_id || !/^[a-zA-Z0-9_.-]{1,80}$/.test(body.app_id)) {
    return json({ error: "invalid_app_id" }, 400);
  }
  if (!body.policy || body.policy.schema_version !== 1 || !Array.isArray(body.policy.rules)) {
    return json({ error: "invalid_policy" }, 400);
  }

  const key = policyKey(body.app_id);
  await env.APP_GUARD_RULES.put(key, JSON.stringify(body.policy, null, 2));
  return json({ ok: true, key });
}

function defaultPolicy(): AppPolicy {
  return {
    schema_version: 1,
    default: {
      status: "allow",
      message: "",
      message_level: "info",
      next_check_after_seconds: 86400,
      support_url: "",
    },
    telemetry: {
      enabled: true,
      sample_rate: 1,
    },
    rules: [],
  };
}

async function readClientPayload(request: Request): Promise<GuardRequest> {
  const raw = await request.json() as Record<string, unknown>;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_CLIENT_FIELDS.has(key)) continue;
    if (typeof value === "string") clean[key] = value.slice(0, 200);
  }
  return clean as unknown as GuardRequest;
}

function validateGuardRequest(req: GuardRequest): string | null {
  if (!req.app_id || !/^[a-zA-Z0-9_.-]{1,80}$/.test(req.app_id)) return "invalid_app_id";
  if (!req.version || !/^[a-zA-Z0-9_.+-]{1,40}$/.test(req.version)) return "invalid_version";
  for (const key of ["build_id", "batch_id", "channel", "sdk_version", "runtime", "platform", "install_id"] as const) {
    const value = req[key];
    if (value !== undefined && !/^[a-zA-Z0-9_.:+@-]{0,200}$/.test(value)) return `invalid_${key}`;
  }
  return null;
}

async function loadPolicy(env: Env, appId: string): Promise<AppPolicy | null> {
  const appPolicy = await env.APP_GUARD_RULES.get(policyKey(appId), "json") as AppPolicy | null;
  if (appPolicy) return appPolicy;
  return await env.APP_GUARD_RULES.get(policyKey("default"), "json") as AppPolicy | null;
}

async function insertEvent(env: Env, req: GuardRequest, decision: string): Promise<void> {
  await env.APP_GUARD_DB.prepare(
    `INSERT INTO guard_events
     (created_at, app_id, event, version, build_id, batch_id, channel, sdk_version, runtime, platform, install_id, decision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    new Date().toISOString(),
    req.app_id,
    req.event || "startup_check",
    req.version,
    req.build_id || "",
    req.batch_id || "",
    req.channel || "",
    req.sdk_version || "",
    req.runtime || "",
    req.platform || "",
    req.install_id || "",
    decision,
  ).run();
}

function requireAdmin(request: Request, env: Env): Response | null {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

function policyKey(appId: string): string {
  return `app:${appId}:policy`;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: JSON_HEADERS });
}

function cors(response: Response): Response {
  const next = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  next.headers.set("access-control-allow-origin", "*");
  next.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  next.headers.set("access-control-allow-headers", "authorization,content-type");
  return next;
}
