// 09-24 조직 재편(용인시 실제 조직) — 결재선 4단계: 실무자(road·water) → 부서장(road_head·water_head) → 총괄(gm) → 경영책임자(ceo)
export const ROLE_DEPT: Record<string, string> = {
  ceo: "", gm: "", mgr: "D02", road: "D03", water: "D04", road_head: "D03", water_head: "D04",
};
export const ROLE_LABEL: Record<string, string> = {
  ceo: "경영책임자(시장)", gm: "총괄(중대재해예방팀)", mgr: "관리자(안전점검팀)",
  road: "실무자(도로구조물과)", water: "실무자(상수도사업소)",
  road_head: "부서장(도로구조물과장)", water_head: "부서장(상수도사업소 정수과장)",
};
/**
 * 역할 → 기록에 남는 사람. 경영책임자는 직원 명부에 없어 「보고받음」이 다른 사람 이름으로 남았다(대본 점검 09-21)
 * → CEO-1 「경영책임자(시장)」으로 고정. 이름은 data.staff() 가 붙인다.
 */
export const ROLE_STAFF: Record<string, string> = {
  ceo: "CEO-1", gm: "SD01-1", mgr: "SD02-1", road: "SD03-1", water: "SD04-1", road_head: "H03", water_head: "H04",
};
/** 부서장 역할 — 자기 부서 제출분을 「부서장 확인」한다(총괄 승인 앞 단계). */
export const isHead = (role?: string) => String(role || "").endsWith("_head");
/** 그 역할이 보는 부서 범위. 빈 문자열이면 전 기관. */
export function deptOf(role?: string) { return ROLE_DEPT[role || "gm"] ?? ""; }

/**
 * 결재·판정할 수 있는 역할(2026-09-21). 담당자(도로과·상수도사업소)는 올리기만 한다.
 * 이 역할들은 결재 대기를 부서로 거르지 않는다 — 관리자가 도로과가 올린 것을 못 보던 결함(목록 조사에서 발견).
 */
export const APPROVER = new Set(["ceo", "gm", "mgr"]);
export const canApprove = (role?: string) => APPROVER.has(role || "gm");

/**
 * 경영책임자 확인(「보고받음」) 기록 — 경영책임자(ceo)만 한다. (2026-09-21)
 * 총괄(gm)이 대신 적을 때만 받고 「대리 기록」으로 표시한다. 그 밖의 역할은 받지 않는다.
 */
export function ceoConfirm(role?: string): { ok: boolean; proxy: boolean } {
  const r = role || "gm";
  if (r === "ceo") return { ok: true, proxy: false };
  if (r === "gm") return { ok: true, proxy: true };
  return { ok: false, proxy: false };
}
