import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import pg from "pg";

// Railway exposes the public cache/proxy on 3100. Next.js stays private to the
// same process group so a warm response can skip both PostgreSQL and rendering.
const publicPort = Number(process.env.ADOMS_READ_SERVER_PORT || "3100");
const nextPort = Number(process.env.ADOMS_READ_SERVER_NEXT_PORT || publicPort + 1);
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const dnsOrderOption = "--dns-result-order=ipv4first";
const nodeOptions = process.env.NODE_OPTIONS || "";
const token = process.env.ADOMS_READ_SERVER_TOKEN || "";
const screenRoutes = new Set(["/", "/actions", "/duties/list", "/evidence", "/tasks"]);
const healthRoute = "/api/read-server/health";
const controlRoute = "/api/read-server/control/cache-reset";
const qaEventRoute = "/api/read-server/qa/events";
const warmPaths = [
  "/?role=gm",
  "/actions?role=gm",
  "/actions?role=road",
  "/actions?role=road_head",
  "/actions?role=ceo",
  "/duties/list?role=gm",
  "/evidence?role=gm",
  "/tasks?role=gm",
];
const responseCache = new Map();
const MAX_CACHE_ENTRIES = 256;
let ready = false;
let resetInFlight = null;
let prewarmInFlight = null;

async function applyQaSchema() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") return;
  const sql = await fs.readFile(path.join(process.cwd(), "db", "migrations", "0005_demo_qa_event.sql"), "utf8");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "adoms-sapa-qa-migration",
    keepAlive: true,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("[adoms-qa-schema] 0005_demo_qa_event applied");
  } finally {
    await client.end();
  }
}

await applyQaSchema();

const child = spawn(process.execPath, [nextBin, "start", "-p", String(nextPort), "-H", "127.0.0.1"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions.includes(dnsOrderOption)
      ? nodeOptions
      : `${nodeOptions} ${dnsOrderOption}`.trim(),
  },
  stdio: "inherit",
  shell: false,
});

function authorized(req) {
  const supplied = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token || supplied.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
}

function digest(value) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

function representationKey(req, url) {
  const rsc = req.headers.rsc === "1";
  if (!rsc) return "html";
  return `rsc:${digest(JSON.stringify({
    prefetch: req.headers["next-router-prefetch"] || "",
    purpose: req.headers.purpose || "",
    nextUrl: req.headers["next-url"] || "",
    state: req.headers["next-router-state-tree"] || "",
    accept: req.headers.accept || "",
    route: url.pathname,
  }))}`;
}

function cacheKey(req, url) {
  // Date-dependent calculations get a fresh process entry after midnight.
  const basisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const roleCookie = url.searchParams.has("role") ? "" : digest(String(req.headers.cookie || ""));
  const deployVersion = String(req.headers["x-adoms-deploy-version"] || "unknown");
  return `${deployVersion}|${basisDate}|${req.method}|${url.pathname}${url.search}|${representationKey(req, url)}|${roleCookie}`;
}

function trimCache() {
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const first = responseCache.keys().next().value;
    if (first === undefined) return;
    responseCache.delete(first);
  }
}

function requestHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("host");
  headers.delete("x-adoms-prewarm");
  return headers;
}

async function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 1024 * 1024) throw new Error("READ server request body is too large.");
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function forward(req, url) {
  const incomingBody = await requestBody(req);
  const upstream = await fetch(`http://127.0.0.1:${nextPort}${url.pathname}${url.search}`, {
    method: req.method,
    headers: requestHeaders(req),
    body: incomingBody,
    redirect: "manual",
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  const headers = {};
  upstream.headers.forEach((value, name) => {
    if (!["connection", "content-encoding", "content-length", "transfer-encoding"].includes(name.toLowerCase())) {
      headers[name] = value;
    }
  });
  headers["content-length"] = String(body.byteLength);
  return { status: upstream.status, headers, body };
}

function send(res, cached, cacheStatus, elapsedMs) {
  res.statusCode = cached.status;
  for (const [name, value] of Object.entries(cached.headers)) res.setHeader(name, value);
  res.setHeader("x-adoms-response-cache", cacheStatus);
  // A response-cache HIT never enters Next.js or the PostgreSQL adapter, so
  // this is an observed zero rather than an estimate from application data.
  res.setHeader("x-adoms-db-query-count", cacheStatus === "hit" ? "0" : "unmeasured");
  res.setHeader("server-timing", `railway-cache;desc=${cacheStatus};dur=${elapsedMs.toFixed(1)}`);
  res.end(cached.body);
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": String(body.byteLength) });
  res.end(body);
}

async function childJson(route, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("content-type", "application/json");
  const response = await fetch(`http://127.0.0.1:${nextPort}${route}`, { ...init, headers, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${route} failed (${response.status})`);
  return result;
}

async function recordQa(event) {
  try { await childJson(qaEventRoute, { method: "POST", body: JSON.stringify(event) }); }
  catch (error) { console.error("[adoms-qa-event] persist failed", error instanceof Error ? error.message : String(error)); }
}

const server = http.createServer(async (req, res) => {
  const startedAt = performance.now();
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const isScreen = screenRoutes.has(url.pathname);
    const isHealth = url.pathname === healthRoute;

    if (url.pathname === controlRoute) {
      if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
      if (!authorized(req)) return sendJson(res, 401, { ok: false, error: "Unauthorized" });
      if (!resetInFlight) {
        resetInFlight = (async () => {
          if (prewarmInFlight) await prewarmInFlight;
          return resetCachesAndPrewarm();
        })().finally(() => { resetInFlight = null; });
      }
      const result = await resetInFlight;
      return sendJson(res, result.ok ? 200 : 503, result);
    }

    if (isHealth) {
      if (!authorized(req)) return sendJson(res, 401, { ok: false });
      if (!ready) return sendJson(res, 503, { ok: false, ready: false, cacheState: "PREWARMING" });
      const childHealth = await childJson(healthRoute);
      return sendJson(res, 200, {
        ...childHealth,
        ready: true,
        cacheState: "READY",
        responseCacheEntries: responseCache.size,
        warmTargetCount: warmPaths.length,
        backend: "read-server",
      });
    }

    if ((isScreen || isHealth) && !ready && req.headers["x-adoms-prewarm"] !== "1") {
      res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "retry-after": "1" });
      res.end("READ server is warming.");
      return;
    }

    const cacheable = isScreen && (req.method === "GET" || req.method === "HEAD") && authorized(req);
    if (!cacheable) {
      const upstream = await forward(req, url);
      send(res, upstream, "bypass", performance.now() - startedAt);
      return;
    }

    const key = cacheKey(req, url);
    let pending = responseCache.get(key);
    const cacheStatus = pending ? "hit" : "miss";
    if (!pending) {
      pending = forward(req, url);
      responseCache.set(key, pending);
      trimCache();
    }
    const cached = await pending;
    if (cached.status !== 200) responseCache.delete(key);
    send(res, cached, cacheStatus, performance.now() - startedAt);
    console.log(`[adoms-read-response] ${url.pathname} ${cacheStatus} status=${cached.status} bytes=${cached.body.byteLength} ms=${Math.round((performance.now() - startedAt) * 100) / 100}`);
  } catch (error) {
    console.error("[adoms-read-response] failed", error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("READ server upstream failed.");
  }
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`[adoms-read-response] listening port=${publicPort} nextPort=${nextPort}`);
});

async function prewarm() {
  const startedAt = Date.now();
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1" || !token) return { ok: false, elapsedMs: 0, paths: [] };
  const internal = `http://127.0.0.1:${nextPort}`;
  const external = `http://127.0.0.1:${publicPort}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "x-adoms-deploy-version": process.env.RAILWAY_GIT_COMMIT_SHA || "unknown",
    "x-adoms-prewarm": "1",
  };
  let childReady = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${internal}${healthRoute}`, {
        headers: { authorization: `Bearer ${token}` },
        redirect: "manual",
      });
      const location = response.headers.get("location");
      if (response.ok && !location && !response.url.includes("?role=")) { childReady = true; break; }
      if (location) console.error(`[adoms-read-server-warm] health redirected to ${location}`);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!childReady) {
    console.error("[adoms-read-server-warm] health timeout");
    return { ok: false, elapsedMs: Date.now() - startedAt, paths: [] };
  }

  const results = [];
  for (const path of warmPaths) {
    const started = Date.now();
    try {
      const response = await fetch(`${external}${path}`, { headers });
      await response.arrayBuffer();
      console.log(`[adoms-read-server-warm] ${path} status=${response.status} cache=${response.headers.get("x-adoms-response-cache")} ms=${Date.now() - started}`);
      results.push({ path, status: response.status, elapsedMs: Date.now() - started });
      if (!response.ok) return { ok: false, elapsedMs: Date.now() - startedAt, paths: results };
    } catch (error) {
      console.error(`[adoms-read-server-warm] ${path} failed`, error);
      return { ok: false, elapsedMs: Date.now() - startedAt, paths: results };
    }
  }
  ready = true;
  console.log(`[adoms-read-server-warm] READY responses=${responseCache.size}`);
  return { ok: true, elapsedMs: Date.now() - startedAt, paths: results };
}

async function resetCachesAndPrewarm() {
  const startedAt = Date.now();
  ready = false;
  const responseEntries = responseCache.size;
  responseCache.clear();
  let dataCaches = { query: 0, semantic: 0 };
  try {
    const cleared = await childJson(controlRoute, { method: "POST", body: "{}" });
    dataCaches = cleared.cleared || dataCaches;
    await recordQa({ eventType: "cache_reset", success: true, admin: true, detail: { ...dataCaches, response: responseEntries } });
    await recordQa({ eventType: "prewarm_start", success: true, admin: true, detail: { targets: warmPaths.length } });
    const warmed = await prewarm();
    await recordQa({
      eventType: warmed.ok ? "prewarm_complete" : "prewarm_failure",
      success: warmed.ok,
      admin: true,
      durationMs: warmed.elapsedMs,
      detail: { targets: warmed.paths.length },
    });
    return { ok: warmed.ok, elapsedMs: Date.now() - startedAt, cleared: { ...dataCaches, response: responseEntries }, prewarm: warmed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordQa({ eventType: "prewarm_failure", success: false, admin: true, durationMs: Date.now() - startedAt, detail: { message } });
    return { ok: false, elapsedMs: Date.now() - startedAt, error: "캐시 초기화 및 재예열에 실패했습니다." };
  }
}

prewarmInFlight = prewarm().finally(() => { prewarmInFlight = null; });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  server.close();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
