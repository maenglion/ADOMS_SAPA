/**
 * 대피훈련 — 코드·평가표·단계. (2026-09-21)
 *
 * 근거
 *   · 중대재해처벌법 시행령 제10조제7호라목(법령DB 원문 확인)
 *     「공중교통수단 또는 「시설물의 안전 및 유지관리에 관한 특별법」 제7조제1호의 제1종시설물에서
 *       비상상황이나 위급상황 발생 시 대피훈련에 관한 사항」
 *   · 같은 호 단서 — 철도안전법 제7조 비상대응계획을 포함한 철도안전관리체계를 수립·시행하고
 *     경영책임자등이 그 수립 여부·내용을 직접 점검하거나 점검 결과를 보고받은 경우 이행한 것으로 본다.
 *   · 계획서·임무카드·평가표·결과보고서 칸: 서울시 안내서 붙임 5-17·5-20·5-21·5-22(기관 운영 기준)
 */
export const DRILL_TYPES = ["화재", "지진", "붕괴", "침수", "위험물 누출", "테러", "폭설", "정전"];
export const METHODS = ["토론기반", "실행기반", "도상+실제"];
export const HALVES = ["상반기", "하반기"];

export const LAW_7RA =
  "라. 공중교통수단 또는 「시설물의 안전 및 유지관리에 관한 특별법」 제7조제1호의 제1종시설물에서 비상상황이나 위급상황 발생 시 대피훈련에 관한 사항";
export const LAW_7_PROVISO =
  "다만, 철도운영자가 「철도안전법」 제7조에 따라 비상대응계획을 포함한 철도안전관리체계를 수립하여 시행하거나 … " +
  "사업주 또는 경영책임자등이 그 수립 여부 및 내용을 직접 점검하거나 점검 결과를 보고받은 경우에는 업무처리절차를 마련하여 이행한 것으로 본다.";

/** 용인경전철 — 관리대상 대장에 한 줄로 없는 공중교통수단이라 따로 둔다. */
export const LRT = { asset_id: "LRT-EVERLINE", asset_name: "용인경전철(에버라인)", asset_gbn: "공중교통수단", asset_class: "", dept_id: "D10" };

/** 대상 구분 — 법정 대상(공중교통수단·제1종시설물) / 자체 확대(서울시처럼 모든 시설물로 넓힌 것). */
export function scopeOf(a: { asset_id: string; asset_class?: string; sapa_l2_result?: string }) {
  if (a.asset_id === LRT.asset_id) return { scope: "법정 대상", kind: "공중교통수단" };
  const c = a.asset_class || "";
  if (c === "1종") return { scope: a.sapa_l2_result === "해당" ? "법정 대상" : "법정 대상(공중이용시설 확인 필요)", kind: "제1종시설물" };
  if (c === "2종" || c === "3종") return { scope: "자체 확대", kind: `${c}시설물` };
  return { scope: "확인 필요", kind: "종별 확인 필요" };
}
export const scopeTone = (s: string) => (s === "법정 대상" ? "bad" : s.startsWith("법정") ? "warn" : s === "자체 확대" ? "none" : "warn");

/** 임무카드 역할(붙임 5-20 예시의 비상시 직책). */
export const ROLES = [
  { key: "cmd", name: "위기상황 총괄자", duty: "상황 확인·신고, 전파·안내방송, 대응 지휘, 구조기관 도착 시 상황 설명" },
  { key: "evac", name: "대피유도팀", duty: "비상대피로 확보, 직원·이용자 대피 유도, 병목 해소" },
  { key: "resp", name: "현장대응팀", duty: "확산 지연, 위험요인 제거·승강기 통제, 소방관 안내" },
  { key: "aid", name: "구호지원팀", duty: "안전취약계층 우선 대피, 부상자 이송, 집결지 인원 파악·보고" },
  { key: "eval", name: "훈련 검증자(평가)", duty: "진행 관찰·시간 측정, 평가표 작성" },
];

/** 평가표 100점(붙임 5-21). 평가자가 배점 안에서 정성 평가한다. */
export const RUBRIC = [
  { g: "1. 훈련계획 수립", total: 30, items: [
    { k: "p1", t: "훈련의 취지·목적에 맞게 훈련계획을 문서로 수립하였는가", max: 10 },
    { k: "p2", t: "훈련 시나리오는 시설의 취약성·사고발생 가능성·빈도 등을 고려하여 작성하였는가", max: 10 },
    { k: "p3", t: "훈련 참석대상에게 통보 및 사전 교육을 실시하였는가", max: 5 },
    { k: "p4", t: "훈련을 위한 시설·장비 등의 준비상태는 적절한지 확인하였는가", max: 5 },
  ] },
  { g: "2. 위기상황 인지 및 전파(신고)", total: 20, items: [
    { k: "c1", t: "훈련에 대한 사전안내·안내방송·교육 등을 실시하였는가", max: 10 },
    { k: "c2", t: "119/재난상황실 신고, 경보기 작동, 자위소방대 연락 등을 실시하였는가", max: 10 },
  ] },
  { g: "3. 훈련실시 현황", total: 30, items: [
    { k: "x1", t: "훈련 참가자들이 목표대피시간 내로 신속하게 외부로 대피하였는가", max: 10 },
    { k: "x2", t: "대피유도는 병목·지체현상이 발생하지 않도록 유도하였는가", max: 10 },
    { k: "x3", t: "시설관계자 및 이용자가 모두 참석하였는가", max: 5 },
    { k: "x4", t: "소방서·경찰서·인근 시설과의 협업 또는 참여 여부", max: 5 },
  ] },
  { g: "4. 평가 및 개선", total: 20, items: [
    { k: "e1", t: "훈련종료 후 평가를 실시하였는가", max: 10 },
    { k: "e2", t: "훈련결과 보고서에는 잘된 점과 개선사항이 포함되어 있는가", max: 10 },
  ] },
];
export const RUBRIC_KEYS = RUBRIC.flatMap((g) => g.items.map((i) => i.k));

/** 단계 — 저장된 값에서 계산한다. */
export type DStage = "계획" | "준비" | "실시" | "평가 완료";
export const DFLOW: DStage[] = ["계획", "준비", "실시", "평가 완료"];
export function dstageOf(d: Record<string, any>, hasEval: boolean): DStage {
  if (d.done_at && hasEval && (d.shortfalls || d.improvements || d.good_points)) return "평가 완료";
  if (d.done_at) return "실시";
  if (d.prep_coop === "완료" && d.prep_items === "완료" && d.prep_budget === "완료") return "준비";
  return "계획";
}
export const stageTone = (s: DStage) => (s === "평가 완료" ? "ok" : s === "실시" ? "" : s === "준비" ? "none" : "warn");

/** 식별자 한글 접두어. */
export const did = (id?: string) => String(id || "").replace(/^DRL-/, "훈련-");
