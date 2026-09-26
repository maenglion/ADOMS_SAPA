/**
 * 미이행 조치의 구분 — ⑤ 판정 · ⑥ 조치가 같은 목록을 쓴다. (2026-09-21)
 *
 * 근거(법령DB DOC-000005 원문 대조)
 *   시행령 제5조제2항제2호 · 제9조제2항제2호 · 제11조제2항제2호
 *   「…의무가 이행되지 않은 사실이 확인되는 경우에는 인력을 배치하거나 예산을 추가로 편성ㆍ집행하도록 하는 등
 *     해당 의무 이행에 필요한 조치를 할 것」
 * 「보완」「시정」은 원래 쓰던 값이라 그대로 둔다(기존 조치 기록이 이 값을 들고 있다).
 */
export const ACTION_TYPES = ["보완", "시정", "인력 배치", "예산 추가 편성·집행", "이행 지시"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** 시행령이 이름을 들어 요구하는 조치(인력·예산) — 화면에서 따로 표시한다. */
export const STATUTORY_TYPES = new Set<string>(["인력 배치", "예산 추가 편성·집행"]);

export const ACTION_HINT: Record<ActionType, string> = {
  보완: "증빙·서류·절차를 채워 다시 제출",
  시정: "잘못된 상태를 바로잡음",
  "인력 배치": "담당 인력을 배치하거나 늘림",
  "예산 추가 편성·집행": "예산을 추가로 편성하거나 집행",
  "이행 지시": "담당 부서에 이행을 지시",
};

/** 판정 결과에 맞는 기본 구분(예전 동작 그대로). */
export const defaultActionType = (result?: string): ActionType => (result === "부적합" ? "시정" : "보완");

/** 목록에 없는 값이 오면 기본 구분으로. */
export function actionTypeOf(v: unknown, result?: string): string {
  const s = String(v || "").trim();
  return (ACTION_TYPES as readonly string[]).includes(s) ? s : defaultActionType(result);
}

/** 재해 구분별 근거 조문 — 미이행 조치(제2호). */
export function remedyBasis(area?: string): string {
  if (area === "F") return "시행령 제11조제2항제2호";
  if (area === "M") return "시행령 제9조제2항제2호";
  return "시행령 제5조제2항제2호";
}
