/**
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 위험성평가(조회 전용)를 사업장에 잇는 규칙 한 곳.
 *   「위험성평가는 지원 시스템에서 입력하고, ADOMS 에서는 관리대상을 확인하는 용도로 조회만 한다.」
 *
 * 자료가 어떻게 이어지는가(2026-09-26 표를 읽어 확인한 그대로)
 *   · 예시 자료 us_v1.8(09-26 사용자 「사업장별 위험성평가 결과를 풍성하게」)의 위험성평가 표(risk_assessment 98건 ·
 *     risk_assessment_item 296항목)에는 사업장 칸 `wp_id`(WP-01~WP-20, 20곳 모두 2~11건)가 있다 → 이 칸으로 잇는다.
 *   · 그 앞 자료(ops_v0.3, 12건)에는 부서(dept_id)만 있고 사업장 칸이 없었다. 그 판으로 되돌리면(us_v1.8 을 빼면)
 *     `wp_id` 가 빈 줄은 부서 소속 = 본청(WP-01) 것으로 본다 — 지금 등록된 부서는 모두 본청 소속이다(2026-09-24 사용자 지시 · HQ_WP).
 *     평가 장소 이름으로 다른 사업장에 붙이지 않는다(추정으로 채우지 않는다).
 *
 * 쓰는 곳: app/risk/page.tsx(전체 보기) · app/targets/basic/[id]/page.tsx(사업장 기본정보 상세의 「이 사업장 위험성평가(조회)」 칸).
 * 주소 형식: /risk?wp=<사업장 id>&role=… (부서까지 좁힐 때 &dept=<부서 id>) — 의무이행 › 사업장 유해·위험요인 단계(몫 B)도 이 형식으로 연다.
 */
import "server-only";
import { readTable, type Row } from "@/lib/data";
import { workplaces, HQ_WP } from "../targets/_lib";

export type RiskScope = {
  kind: "all" | "wp" | "unknown";   // all = 사업장을 고르지 않음 · wp = 사업장 하나 · unknown = 없는 사업장 id
  wp?: Row;                         // 고른 사업장
  dept?: string;                    // 좁힌 부서
  ra: Row[];                        // 평가(최근 평가일 순)
  ri: Row[];                        // 평가 항목(유해·위험요인)
  wps: Row[];                       // 사업장 20곳(목록 순)
  raAll: Row[];                     // 전체 평가(사업장별 요약용)
  riAll: Row[];
};

/** 평가 한 건의 사업장 — 칸이 비면 본청(부서 소속). */
export const wpOfRisk = (a: Row) => String(a.wp_id || "") || HQ_WP;

export async function riskScope(wpId?: string, deptId?: string): Promise<RiskScope> {
  const [raRaw, riAll, wps] = await Promise.all([
    readTable("risk_assessment", "risk_id"), readTable("risk_assessment_item", "risk_item_id"), workplaces(),
  ]);
  const raAll = [...raRaw].sort((a, b) => String(b.assessed_at || "").localeCompare(String(a.assessed_at || "")));
  const wp = wpId ? wps.find((w) => w.wp_id === wpId) : undefined;
  const kind: RiskScope["kind"] = !wpId ? "all" : wp ? "wp" : "unknown";
  let ra = kind === "all" ? raAll : kind === "wp" ? raAll.filter((a) => wpOfRisk(a) === wp!.wp_id) : [];
  const dept = deptId || undefined;
  if (dept) ra = ra.filter((x) => x.dept_id === dept);
  const ids = new Set(ra.map((x) => x.risk_id));
  const ri = riAll.filter((x) => ids.has(x.risk_id));
  return { kind, wp, dept, ra, ri, wps, raAll, riAll };
}

/** 위험 수준 세기 · 조치 미완 — 사업장 상세 칸 · 20곳 요약 표가 같이 쓴다. */
export function riskCounts(ra: Row[], ri: Row[]) {
  const ids = new Set(ra.map((a) => a.risk_id));
  const its = ri.filter((x) => ids.has(x.risk_id));
  const lv = (l: string) => its.filter((x) => x.risk_level === l).length;
  return {
    n: ra.length,
    items: its.length,
    high: lv("높음"), mid: lv("보통"), low: lv("낮음"),
    open: its.filter((x) => !x.measure_done_at).length,
    openHigh: its.filter((x) => x.risk_level === "높음" && !x.measure_done_at).length,
    last: ra.reduce((m, a) => (String(a.assessed_at || "") > m ? String(a.assessed_at) : m), ""),
    ing: ra.filter((a) => a.status === "진행 중").length,
    plan: ra.filter((a) => a.status === "계획").length,
  };
}

/** 확인된 관리대상(설비·물질·장소) — 「 · 」로 이어 적힌 칸을 낱개로 */
export const targetsOf = (a: Row) => String(a.targets || "").split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);

/** 평가 상태 배지 색 */
export const statusTone = (s?: string) => (s === "완료" ? "ok" : s === "진행 중" ? "warn" : "none");
/** 위험 수준 배지 색 */
export const levelTone = (s?: string) => (s === "높음" ? "bad" : s === "보통" ? "warn" : "none");
