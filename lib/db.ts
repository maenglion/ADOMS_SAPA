import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolConfig } from "pg";

export type DbRow = Record<string, any>;

type QueryTupleMetric = {
  relation: string;
  query: string;
  logicalCalls: number;
  sqlCalls: number;
  dbMs: number;
  acquireMs: number;
  sqlMs: number;
};

type DbReadTrace = {
  label: string;
  startedAt: number;
  logicalCalls: number;
  sqlCalls: number;
  cacheHits: number;
  dbMs: number;
  acquireMs: number;
  sqlMs: number;
  cache: Map<string, Promise<DbRow[]>>;
  tuples: Map<string, QueryTupleMetric>;
  scopes: Map<string, { logicalCalls: number; sqlCalls: number; cacheHits: number; dbMs: number; tuples: Set<string> }>;
  semantic: Map<string, {
    calls: number;
    cacheHits: number;
    wallMs: number;
    returnedRows: number;
    args: Set<string>;
    normalization: number;
    filter: number;
    sort: number;
    merge: number;
  }>;
  semanticCache: Map<string, Promise<unknown>>;
};

const dbReadTrace = new AsyncLocalStorage<DbReadTrace>();
const dbReadScope = new AsyncLocalStorage<string>();

const roundMs = (value: number) => Math.round(value * 100) / 100;
const cloneRows = (rows: DbRow[]) => rows.map((row) => ({ ...row }));

type ReadWork = Partial<Record<"normalization" | "filter" | "sort" | "merge", number>>;

function resultSize(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value instanceof Map || value instanceof Set) return value.size;
  return value == null ? 0 : 1;
}

function cloneSemantic<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Profile one semantic READ boundary. `memo` is deliberately opt-in so the
 * same instrumentation can capture the before profile and then prove which
 * exact function/argument results are reused after optimization.
 */
export async function withReadOperation<T>(
  name: string,
  args: unknown,
  run: () => Promise<T>,
  options: { memo?: boolean; work?: ReadWork } = {},
): Promise<T> {
  const trace = dbReadTrace.getStore();
  if (!trace) return run();
  const argKey = JSON.stringify(args);
  const cacheKey = `${name}\u0000${argKey}`;
  const metric = trace.semantic.get(name) || {
    calls: 0, cacheHits: 0, wallMs: 0, returnedRows: 0, args: new Set<string>(),
    normalization: 0, filter: 0, sort: 0, merge: 0,
  };
  metric.calls++;
  metric.args.add(argKey);
  for (const key of ["normalization", "filter", "sort", "merge"] as const) {
    metric[key] += options.work?.[key] || 0;
  }
  trace.semantic.set(name, metric);

  if (options.memo) {
    const cached = trace.semanticCache.get(cacheKey);
    if (cached) {
      metric.cacheHits++;
      const value = await cached as T;
      metric.returnedRows += resultSize(value);
      return cloneSemantic(value);
    }
  }

  const startedAt = performance.now();
  const pending = run();
  if (options.memo) trace.semanticCache.set(cacheKey, pending);
  try {
    const value = await pending;
    metric.wallMs += performance.now() - startedAt;
    metric.returnedRows += resultSize(value);
    return options.memo ? cloneSemantic(value) : value;
  } catch (error) {
    if (options.memo) trace.semanticCache.delete(cacheKey);
    throw error;
  }
}

/**
 * Request-local PostgreSQL read cache and measurement boundary. Only callers
 * explicitly wrapped with this function are memoized; no data survives the
 * current server render.
 */
export async function withDbReadTrace<T>(label: string, run: () => Promise<T>): Promise<T> {
  const trace: DbReadTrace = {
    label,
    startedAt: performance.now(),
    logicalCalls: 0,
    sqlCalls: 0,
    cacheHits: 0,
    dbMs: 0,
    acquireMs: 0,
    sqlMs: 0,
    cache: new Map(),
    tuples: new Map(),
    scopes: new Map(),
    semantic: new Map(),
    semanticCache: new Map(),
  };
  return dbReadTrace.run(trace, async () => {
    try {
      return await run();
    } finally {
      const tuples = [...trace.tuples.values()].map((item) => ({
        ...item,
        dbMs: roundMs(item.dbMs),
        acquireMs: roundMs(item.acquireMs),
        sqlMs: roundMs(item.sqlMs),
      }));
      const scopes = Object.fromEntries([...trace.scopes].map(([scope, item]) => [scope, {
        logicalCalls: item.logicalCalls,
        distinctTuples: item.tuples.size,
        duplicateCalls: item.logicalCalls - item.tuples.size,
        sqlCalls: item.sqlCalls,
        cacheHits: item.cacheHits,
        dbMs: roundMs(item.dbMs),
      }]));
      const semantic = Object.fromEntries([...trace.semantic].map(([name, item]) => [name, {
        calls: item.calls,
        uniqueArgs: item.args.size,
        cacheHits: item.cacheHits,
        returnedRows: item.returnedRows,
        wallMs: roundMs(item.wallMs),
        normalization: item.normalization,
        filter: item.filter,
        sort: item.sort,
        merge: item.merge,
      }]));
      for (const [name, item] of Object.entries(semantic)) {
        console.info("[adoms-read-semantic]", JSON.stringify({ label: trace.label, name, ...item }));
      }
      for (const item of tuples) {
        console.info("[adoms-read-tuple]", JSON.stringify({ label: trace.label, ...item }));
      }
      console.info("[adoms-read-metrics]", JSON.stringify({
        label: trace.label,
        logicalCalls: trace.logicalCalls,
        distinctTuples: trace.tuples.size,
        duplicateCalls: trace.logicalCalls - trace.tuples.size,
        sqlCalls: trace.sqlCalls,
        cacheHits: trace.cacheHits,
        dbMs: roundMs(trace.dbMs),
        acquireMs: roundMs(trace.acquireMs),
        sqlMs: roundMs(trace.sqlMs),
        dataRenderMs: roundMs(performance.now() - trace.startedAt),
        serverComputeMs: roundMs(performance.now() - trace.startedAt - trace.dbMs),
        scopes,
      }));
    }
  });
}

/** Attach a logical sub-operation such as checkFlagged to the current trace. */
export async function withDbReadScope<T>(scope: string, run: () => Promise<T>): Promise<T> {
  return dbReadScope.run(scope, run);
}

const RELATIONS = new Set([
  "action", "annual_schedule", "asset", "asset_target_map", "audit_log", "budget_exec",
  "ceo_activity", "civil_manual", "civil_record", "civil_safety_plan", "compliance_task",
  "contract", "contract_compliance", "contract_duty", "contract_eval_item", "contract_eval_score",
  "contract_eval_setting", "contract_hazard", "contract_hazard_map", "contract_mgmt_item",
  "drill_eval", "drill_plan", "duty_assignment", "duty_class", "eval_criteria", "evidence",
  "evidence_split", "form_template", "hazard_code", "hazard_report", "hazard_step", "incident",
  "incident_nil_check", "incident_report", "incident_response", "incident_response_setting",
  "inspection", "inspection_batch", "law_change", "law_sync_applied", "law_sync_decision",
  "material_item", "notification", "order_received", "org_dept", "org_profile", "risk_assessment",
  "risk_assessment_item", "safety_budget", "safety_manual", "safety_org_role", "safety_policy",
  "staff", "sys_code", "sys_mail_log", "sys_menu", "system_record", "training_check",
  "training_course", "training_record", "usa_order", "usb1_basic", "usb1_contract",
  "usb1_contract_duty", "usb1_hazard_place", "usb1_transport", "usb1_work_site",
  "usb1_workplace", "usb1_ws_mgmt", "usb2_assign", "usb2_basic", "usb2_law", "usb2_role",
  "usb2_timing", "usc_record", "usd_record", "use_plan", "use_record", "use_site",
  "usf_ceo_activity", "usf_ceo_log", "usf_file", "usf_judge", "usf_letter", "usf_letter_read",
  "usf_notice", "usf_round", "usg_case", "usg_stat_occur", "usg_ws_industry", "worker_voice",
  "v_contract_duty", "v_duty_detail", "v_duty_todo", "v_task_approval",
]);
const VIEWS = new Set(["v_contract_duty", "v_duty_detail", "v_duty_todo", "v_task_approval"]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

for (const oid of [20, 21, 23, 700, 701, 1700, 1082, 1114, 1184]) {
  types.setTypeParser(oid, (value) => value);
}

function relationName(value: string): string {
  if (!RELATIONS.has(value)) throw new Error(`PostgreSQL relation is not allowlisted: ${value}`);
  return `adoms2."${value}"`;
}

function columnName(value: string): string {
  if (!IDENT.test(value)) throw new Error(`Invalid PostgreSQL column identifier: ${value}`);
  return `"${value}"`;
}

function databaseUrl(): string {
  const value = (process.env.DATABASE_URL || "").trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error("DATABASE_URL must be a complete PostgreSQL URI when ADOMS_DATA_BACKEND=postgres");
  }
  return value;
}

declare global {
  // eslint-disable-next-line no-var
  var __adomsPgPool: Pool | undefined;
}

export function postgresPool(): Pool {
  if (!globalThis.__adomsPgPool) {
    const config: PoolConfig = {
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "adoms-sapa-read",
    };
    globalThis.__adomsPgPool = new Pool(config);
  }
  return globalThis.__adomsPgPool;
}

/**
 * Compatibility query for the existing read contracts. It accepts only the
 * small PostgREST-style subset already used by lib/data.ts and translates it
 * to parameterized PostgreSQL. Relation names are statically allowlisted;
 * column identifiers must pass the strict identifier grammar above.
 */
export async function queryRows(relation: string, queryString: string): Promise<DbRow[]> {
  const trace = dbReadTrace.getStore();
  const scopeName = dbReadScope.getStore();
  const tupleKey = `${relation}\u0000${queryString}`;
  if (trace) {
    trace.logicalCalls++;
    const tuple = trace.tuples.get(tupleKey) || {
      relation,
      query: queryString,
      logicalCalls: 0,
      sqlCalls: 0,
      dbMs: 0,
      acquireMs: 0,
      sqlMs: 0,
    };
    tuple.logicalCalls++;
    trace.tuples.set(tupleKey, tuple);
    if (scopeName) {
      const scope = trace.scopes.get(scopeName) || {
        logicalCalls: 0,
        sqlCalls: 0,
        cacheHits: 0,
        dbMs: 0,
        tuples: new Set<string>(),
      };
      scope.logicalCalls++;
      scope.tuples.add(tupleKey);
      trace.scopes.set(scopeName, scope);
    }
    const cached = trace.cache.get(tupleKey);
    if (cached) {
      trace.cacheHits++;
      if (scopeName) trace.scopes.get(scopeName)!.cacheHits++;
      return cloneRows(await cached);
    }
  }

  const execute = async (): Promise<DbRow[]> => {
  const params = new URLSearchParams(queryString);
  const values: any[] = [];
  const where: string[] = [];
  const bind = (value: any) => { values.push(value); return `$${values.length}`; };

  let select = "*";
  const selectValue = params.get("select");
  if (selectValue && selectValue !== "*") {
    select = selectValue.split(",").map((part) => columnName(part.trim())).join(", ");
  }

  for (const [key, raw] of params.entries()) {
    if (key === "select" || key === "limit" || key === "order" || key === "or") continue;
    const dot = raw.indexOf(".");
    if (dot < 1) throw new Error(`Unsupported filter for ${relation}.${key}`);
    const op = raw.slice(0, dot);
    const value = raw.slice(dot + 1);
    if (op === "eq") where.push(`${columnName(key)} = ${bind(value)}`);
    else if (op === "ilike") where.push(`${columnName(key)} ILIKE ${bind(value.replaceAll("*", "%"))}`);
    else throw new Error(`Unsupported filter operator: ${op}`);
  }

  const orValue = params.get("or");
  if (orValue) {
    const body = orValue.startsWith("(") && orValue.endsWith(")") ? orValue.slice(1, -1) : orValue;
    const alternatives = body.split(",").map((part) => {
      const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\.ilike\.(.*)$/);
      if (!match) throw new Error(`Unsupported OR filter: ${part}`);
      return `${columnName(match[1])} ILIKE ${bind(match[2].replaceAll("*", "%"))}`;
    });
    where.push(`(${alternatives.join(" OR ")})`);
  }

  let order = "";
  const orderValue = params.get("order");
  if (orderValue) {
    order = " ORDER BY " + orderValue.split(",").map((part) => {
      const [column, direction = "asc"] = part.trim().split(".");
      if (direction !== "asc" && direction !== "desc") throw new Error(`Unsupported order direction: ${direction}`);
      return `${columnName(column)} ${direction.toUpperCase()}`;
    }).join(", ");
  }

  let limit = "";
  const limitValue = params.get("limit");
  if (limitValue !== null) {
    const n = Number(limitValue);
    if (!Number.isSafeInteger(n) || n < 0 || n > 100_000) throw new Error(`Invalid query limit: ${limitValue}`);
    limit = ` LIMIT ${n}`;
  }

  // Baseline rows were inserted in the exact CSV+overlay contract order. Until
  // a screen-specific ORDER BY exists, ctid preserves that read order for the
  // immutable baseline tables. Views must always provide an explicit order.
  if (!order && !VIEWS.has(relation)) order = " ORDER BY ctid";
  const sql = `SELECT ${select} FROM ${relationName(relation)}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}${order}${limit}`;
    const startedAt = performance.now();
    const client = await postgresPool().connect();
    const acquiredAt = performance.now();
    let result;
    try {
      result = await client.query(sql, values);
    } finally {
      client.release();
    }
    const finishedAt = performance.now();
    const acquireElapsed = acquiredAt - startedAt;
    const sqlElapsed = finishedAt - acquiredAt;
    const elapsed = finishedAt - startedAt;
    if (trace) {
      trace.sqlCalls++;
      trace.dbMs += elapsed;
      trace.acquireMs += acquireElapsed;
      trace.sqlMs += sqlElapsed;
      const tuple = trace.tuples.get(tupleKey)!;
      tuple.sqlCalls++;
      tuple.dbMs += elapsed;
      tuple.acquireMs += acquireElapsed;
      tuple.sqlMs += sqlElapsed;
      if (scopeName) {
        const scope = trace.scopes.get(scopeName)!;
        scope.sqlCalls++;
        scope.dbMs += elapsed;
      }
    }
    return result.rows;
  };

  if (!trace) return execute();
  const pending = execute();
  trace.cache.set(tupleKey, pending);
  try {
    return cloneRows(await pending);
  } catch (error) {
    trace.cache.delete(tupleKey);
    throw error;
  }
}

/** Frozen CSV audit-log contract: all overlay rows in stored order; aliases exist only here. */
export async function queryAuditLog(): Promise<DbRow[]> {
  const trace = dbReadTrace.getStore();
  const tupleKey = "audit_log\u0000compat-all-import-order";
  if (trace) {
    trace.logicalCalls++;
    const tuple = trace.tuples.get(tupleKey) || {
      relation: "audit_log", query: "compat-all-import-order", logicalCalls: 0,
      sqlCalls: 0, dbMs: 0, acquireMs: 0, sqlMs: 0,
    };
    tuple.logicalCalls++;
    trace.tuples.set(tupleKey, tuple);
    const cached = trace.cache.get(tupleKey);
    if (cached) {
      trace.cacheHits++;
      return cloneRows(await cached);
    }
  }

  const execute = async () => {
    const startedAt = performance.now();
    const client = await postgresPool().connect();
    const acquiredAt = performance.now();
    let result;
    try {
      result = await client.query(`
        SELECT changed_at AS at,
               changed_by AS by,
               action,
               note,
               target,
               what
          FROM adoms2."audit_log"
         ORDER BY ctid
      `);
    } finally {
      client.release();
    }
    const finishedAt = performance.now();
    if (trace) {
      const acquireElapsed = acquiredAt - startedAt;
      const sqlElapsed = finishedAt - acquiredAt;
      const elapsed = finishedAt - startedAt;
      trace.sqlCalls++;
      trace.dbMs += elapsed;
      trace.acquireMs += acquireElapsed;
      trace.sqlMs += sqlElapsed;
      const tuple = trace.tuples.get(tupleKey)!;
      tuple.sqlCalls++;
      tuple.dbMs += elapsed;
      tuple.acquireMs += acquireElapsed;
      tuple.sqlMs += sqlElapsed;
    }
    return result.rows;
  };

  if (!trace) return execute();
  const pending = execute();
  trace.cache.set(tupleKey, pending);
  try {
    return cloneRows(await pending);
  } catch (error) {
    trace.cache.delete(tupleKey);
    throw error;
  }
}

export async function closePostgresPool(): Promise<void> {
  if (!globalThis.__adomsPgPool) return;
  const pool = globalThis.__adomsPgPool;
  globalThis.__adomsPgPool = undefined;
  await pool.end();
}
