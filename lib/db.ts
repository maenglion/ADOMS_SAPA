import "server-only";
import { Pool, type PoolConfig } from "pg";

export type DbRow = Record<string, any>;

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
  const result = await postgresPool().query(sql, values);
  return result.rows;
}

/** Existing audit-log contract: physical changed_* names are aliased only here. */
export async function queryAuditLog(): Promise<DbRow[]> {
  const result = await postgresPool().query(`
    SELECT changed_at AS at,
           changed_by AS by,
           action,
           note,
           target,
           what
      FROM adoms2."audit_log"
     ORDER BY changed_at DESC
     LIMIT 100
  `);
  return result.rows;
}

export async function closePostgresPool(): Promise<void> {
  if (!globalThis.__adomsPgPool) return;
  const pool = globalThis.__adomsPgPool;
  globalThis.__adomsPgPool = undefined;
  await pool.end();
}
