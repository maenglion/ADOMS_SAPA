import "server-only";
import { postgresPool } from "./db";

export const QA_EVENT_TYPES = new Set([
  "demo_session_start", "page_visit", "role_change", "write_success", "write_failure",
  "cache_reset", "prewarm_start", "prewarm_complete", "prewarm_failure",
  "performance_check", "read_error", "server_error", "qa_login", "qa_logout",
]);

export type QaEventInput = {
  eventType: string;
  route?: string;
  role?: string;
  success?: boolean;
  httpStatus?: number | null;
  durationMs?: number | null;
  cacheState?: string;
  admin?: boolean;
  detail?: Record<string, unknown>;
};

function cleanText(value: unknown, max: number): string | null {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function safeDetail(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const json = JSON.stringify(value);
  if (json.length > 24_000) return { message: "detail omitted: too large" };
  return JSON.parse(json);
}

export async function qaEvent(input: QaEventInput) {
  if (!QA_EVENT_TYPES.has(input.eventType)) throw new Error("Unsupported QA event type");
  const event = {
    eventType: input.eventType,
    route: cleanText(input.route, 240),
    role: cleanText(input.role, 40),
    success: input.success !== false,
    httpStatus: Number.isFinite(input.httpStatus) ? Number(input.httpStatus) : null,
    durationMs: Number.isFinite(input.durationMs) ? Math.max(0, Number(input.durationMs)) : null,
    cacheState: cleanText(input.cacheState, 40),
    admin: Boolean(input.admin),
    detail: safeDetail(input.detail),
  };
  console.info("[adoms-qa-event]", JSON.stringify(event));
  const result = await postgresPool().query(
    `INSERT INTO adoms2.demo_qa_event
      (event_type, route, role, http_status, duration_ms, cache_state, success, is_admin, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING id, occurred_at`,
    [event.eventType, event.route, event.role, event.httpStatus, event.durationMs, event.cacheState,
      event.success, event.admin, JSON.stringify(event.detail)],
  );
  return result.rows[0];
}

export async function qaSnapshot() {
  const pool = postgresPool();
  const [today, recent, errors, writes, performance, last] = await Promise.all([
    pool.query(`SELECT
      count(*) FILTER (WHERE event_type IN ('demo_session_start','page_visit'))::int AS access,
      count(*) FILTER (WHERE event_type='role_change')::int AS "roleChange",
      count(*) FILTER (WHERE event_type IN ('write_success','write_failure'))::int AS writes,
      count(*) FILTER (WHERE success=false OR event_type IN ('read_error','server_error','prewarm_failure','write_failure'))::int AS errors
      FROM adoms2.demo_qa_event WHERE occurred_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`),
    pool.query(`SELECT * FROM adoms2.demo_qa_event ORDER BY occurred_at DESC, id DESC LIMIT 50`),
    pool.query(`SELECT * FROM adoms2.demo_qa_event
      WHERE success=false OR event_type IN ('read_error','server_error','prewarm_failure','write_failure')
      ORDER BY occurred_at DESC, id DESC LIMIT 30`),
    pool.query(`SELECT * FROM adoms2.demo_qa_event WHERE event_type IN ('write_success','write_failure')
      ORDER BY occurred_at DESC, id DESC LIMIT 30`),
    pool.query(`SELECT * FROM adoms2.demo_qa_event WHERE event_type='performance_check'
      ORDER BY occurred_at DESC, id DESC LIMIT 10`),
    pool.query(`SELECT
      max(occurred_at) FILTER (WHERE event_type='cache_reset') AS "cacheReset",
      max(occurred_at) FILTER (WHERE event_type='prewarm_complete') AS prewarm,
      max(occurred_at) FILTER (WHERE event_type='performance_check') AS performance,
      max(occurred_at) FILTER (WHERE success=false OR event_type IN ('read_error','server_error','prewarm_failure','write_failure')) AS error
      FROM adoms2.demo_qa_event`),
  ]);
  return {
    today: today.rows[0], recent: recent.rows, errors: errors.rows, writes: writes.rows,
    performance: performance.rows, last: last.rows[0],
  };
}
