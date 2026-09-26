/**
 * 업무 흐름의 척추 — 중처법 의무이행 관리 한 바퀴. (2026-09-21)
 *
 * 사용자 지시: 「화면을 많이 만들되, 논리적으로 흐름이 빠지는 게 보이면 안 된다.」
 * 그래서 화면을 따로따로 만들지 않고, **이 순서 위에 꽂는다.** 모든 화면은 자기가 몇 번째인지,
 * 앞에서 무엇을 받고 뒤로 무엇을 넘기는지 안다. 흐름이 끊기는 화면이 없어야 한다.
 *
 *   ① 체계 수립   — 경영방침·목표, 조직(선임·지정), 예산          중처법 시행령 제4조제1·2·3·4·5호
 *   ② 의무 확인   — 무엇을 해야 하는가(3축·법령 계층·설명 경로)
 *   ③ 점검 계획   — 이번 반기에 무엇을 누가 점검받는가(회차 생성)
 *   ④ 이행·증빙   — 부서가 해 놓고 근거를 올린다(데스크톱·휴대폰)
 *   ⑤ 점검 판정   — 총괄이 적합·보완필요·부적합을 찍는다
 *   ⑥ 조치·재점검 — 보완·부적합은 조치를 요구하고, 보완되면 다시 판정한다
 *   ⑦ 회차 결재   — 판정이 끝난 회차를 상신·확정한다
 *   ⑧ 보고        — 이행 현황표·한 장 보고서·경영책임자 화면
 *
 * 도급·용역·위탁(법 제5조)은 이 바퀴와 **나란히 도는 곁가지**다 — ①에서 수급인 평가 기준을 세우고,
 * ④에서 계약별 관리의무를 이행한다.
 */
export type FlowKey =
  | "system" | "duties" | "plan" | "submit" | "review" | "action" | "approve" | "report";

export type FlowStep = {
  key: FlowKey;
  no: string;
  name: string;
  href: string;
  who: string;          // 주로 누가 하는가
  gives: string;        // 다음 단계로 넘기는 것
};

// 09-26 사용자: 옛 점검 화면 합치기 — ③ 점검 계획 · ⑤ 점검 판정 · ⑦ 회차 결재 주소를 이행점검 화면으로
export const FLOW: FlowStep[] = [
  { key: "system",  no: "①", name: "체계 수립",   href: "/system",      who: "경영책임자·총괄",
    gives: "경영방침·조직·예산이 서야 무엇을 누가 할지 정할 수 있다" },
  { key: "duties",  no: "②", name: "의무 확인",   href: "/duties",      who: "총괄·부서",
    gives: "지켜야 할 의무와 그 근거 조문" },
  { key: "plan",    no: "③", name: "점검 계획",   href: "/check/ws", who: "총괄",
    gives: "이번 회차의 점검 대상(부서 × 의무조항)" },
  { key: "submit",  no: "④", name: "이행·증빙",   href: "/evidence",    who: "부서 담당자",
    gives: "이행 결과와 증빙 — 결재 제출" },
  { key: "review",  no: "⑤", name: "점검 판정",   href: "/check/ws/review",      who: "점검반(관리자)",
    gives: "적합 / 보완필요 / 부적합" },
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 흐름 막대 이름·주소를 메뉴 이름에 맞춤(⑥ 미이행 조치·재점검 · ⑧ 경영책임자 보고 요약)
  { key: "action",  no: "⑥", name: "미이행 조치·재점검", href: "/actions", who: "부서 ↔ 점검반",
    gives: "보완 결과 — 다시 ⑤로" },
  { key: "approve", no: "⑦", name: "회차 결재",   href: "/check/ws/summary", who: "총괄 → 경영책임자",
    gives: "확정된 회차 결과" },
  { key: "report",  no: "⑧", name: "경영책임자 보고 요약", href: "/exec", who: "경영책임자",
    gives: "다음 반기 계획의 근거" },
];

export function flowIndex(k: FlowKey) {
  return FLOW.findIndex((s) => s.key === k);
}
