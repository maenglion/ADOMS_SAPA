/**
 * [400 · 교육자료 버전] 묶음 E — 의무이행(실적증빙) 원료·제조물 트랙의 읽기 모델.
 *
 * 저장은 표 하나(`use_record`)에 모은다: 단계 key(step) · 블록(block) · 행 데이터(data, JSON) · 증빙(files, JSON).
 *   block 값 — row(표 한 줄) · item/exec(예산 항목·집행 줄) · card(재해 카드) · card:report/card:response(절차도)
 *              · nil(「없을 경우 체크」) · duty:<duty_key>(관계 법령 의무) · edu:<duty_key>(법정교육) · lawx/edux(직접 더한 줄)
 * 이행점검(묶음 F)이 읽기 쉽게 행마다 status(이행완료·보완필요·미이행·해당없음)도 적는다.
 */
import "server-only";
import { readTable, duties, staff, depts, type Row } from "@/lib/data";

export const TABLE = "use_record";
export const YEAR = "2026";

export type Ev = { name: string; url: string; slot?: string; at?: string };
export type Rec = {
  rec_id: string; site_id: string; dept_id: string; year: string; step: string; block: string;
  seq: number; status: string; data: Row; files: Ev[]; deleted: string;
};

const js = (s: any, d: any) => {
  if (s && typeof s === "object") return s;
  try { return s ? JSON.parse(String(s)) : d; } catch { return d; }
};

/** 한 사업장·한 단계의 기록(지운 것 빼고 · 순서대로). */
export async function recsOf(site: string, step: string): Promise<Rec[]> {
  const rows = await readTable(TABLE, "rec_id");
  return rows
    .filter((r) => r.site_id === site && r.step === step && String(r.year || YEAR) === YEAR && r.deleted !== "Y")
    .map((r) => ({
      rec_id: r.rec_id, site_id: r.site_id, dept_id: r.dept_id, year: r.year, step: r.step, block: r.block,
      seq: Number(r.seq) || 0, status: r.status || "", deleted: r.deleted || "",
      data: js(r.data, {}), files: (js(r.files, []) as Ev[]).filter((f) => f && f.name),
    }))
    .sort((a, b) => a.seq - b.seq);
}

/** 모든 기록(지운 것 포함) — 저장 때 있는지 확인용. */
export async function allRecs(): Promise<Row[]> {
  return readTable(TABLE, "rec_id");
}

export type Site = { site_id: string; site_name: string; dept_id: string; dept_name: string; targets: string[]; note: string };
export async function sites(): Promise<Site[]> {
  const ds = await depts();
  const dn = (id: string) => String(ds.find((d: Row) => d.dept_id === id)?.dept_name || "");
  return (await readTable("use_site", "site_id")).map((r) => ({
    site_id: r.site_id, site_name: r.site_name, dept_id: r.dept_id, dept_name: dn(r.dept_id),
    targets: String(r.targets || "").split(";").map((x) => x.trim()).filter(Boolean), note: r.note || "",
  }));
}

/** 역할 → 기본 사업장(담당자는 자기 부서 사업장, 그 밖은 첫 사업장). */
const ROLE_SITE: Record<string, string> = { water: "MS01" };
export function pickSite(list: Site[], want?: string, role?: string): Site {
  return list.find((s) => s.site_id === want) || list.find((s) => s.site_id === ROLE_SITE[role || ""]) || list[0];
}

export async function plansOf(site: string, step: string, block?: string): Promise<{ plan_id: string; data: Row }[]> {
  return (await readTable("use_plan", "plan_id"))
    .filter((p) => p.site_id === site && p.step === step && (!block || p.block === block))
    .map((p) => ({ plan_id: p.plan_id, data: js(p.data, {}) }));
}

/** 절차도 불러오기 원천 — 카드(report·response)별. */
export async function docPlans(site: string): Promise<{ plan_id: string; card: string; data: Row }[]> {
  return (await readTable("use_plan", "plan_id"))
    .filter((p) => p.site_id === site && p.step === "proc" && String(p.block).startsWith("card:"))
    .map((p) => ({ plan_id: p.plan_id, card: String(p.block).slice(5), data: js(p.data, {}) }));
}

/** 직원 명부 — 이름은 staff_id 로 다시 읽는다(명부 이름이 바뀌어도 따라간다). */
export async function people(): Promise<Row[]> {
  const [ss, ds] = await Promise.all([staff(), depts()]);
  const dn = (id: string) => String(ds.find((d: Row) => d.dept_id === id)?.dept_name || "");
  return ss.filter((s: Row) => s.dept_id).map((s: Row) => ({ ...s, dept_name: dn(s.dept_id) }));
}

/* ── 예산 ─────────────────────────────────────────────────── */
export const BUDGET_ITEMS = ["안전점검비", "보수보강비", "교육·훈련비", "기타"] as const;
/** 09-25 사용자: 명세 오기 「보수보강비」는 화면에서 「보수·보강비」로 보인다.
 *  저장 값(use_record data.item)이 「보수보강비」라 BUDGET_ITEMS(저장·대조 키)는 그대로 두고 표시만 바꾼다. */
export const budgetItemLabel = (it: string) => (it === "보수보강비" ? "보수·보강비" : it);
/** 우리 예산 표(safety_budget)의 원료·제조물(area=M) 줄을 명세 4항목으로 모은다 — 천원. */
const KIND2ITEM: Record<string, string> = { 점검: "안전점검비", 시설: "보수보강비", 교육: "교육·훈련비" };
export async function budgetPlan(dept: string) {
  const rows = (await readTable("safety_budget", "budget_id"))
    .filter((r) => r.area === "M" && r.dept_id === dept && String(r.fiscal_year) === YEAR);
  const out: Record<string, number> = Object.fromEntries(BUDGET_ITEMS.map((k) => [k, 0]));
  for (const r of rows) out[KIND2ITEM[r.budget_kind] || "기타"] += Math.round(Number(r.planned_amount || 0) / 1000);
  return { rows, out };
}

/* ── 관계 법령 — 우리 의무 목록(duties area=M) ─────────────────── */
const first = (c: any) => String(c || "").split(";")[0].trim();
export async function mDuties() {
  return duties({ area: "M", limit: 5000 });
}
export const isLawDuty = (d: Row) => first(d.code36) === "M08";
export const isEduDuty = (d: Row) => first(d.code36) === "M09";
/** 법령 이름 — 중대재해처벌법은 약칭 규칙대로 풀어 쓴 이름(「중대재해처벌법」)으로 보인다. */
export const lawKo = (s?: string) => String(s || "").replace(/중대재해 처벌 등에 관한 법률/g, "중대재해처벌법");
export const markKo = (m?: string) => (m === "Y" ? "용인 확정" : m === "조건부" ? "조건부" : m || "");
export const dutyText = (d: Row) => String(d.duty_name || d.article_title || d.task_name || "");
