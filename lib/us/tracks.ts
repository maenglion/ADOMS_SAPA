/**
 * [400 · 교육자료 버전] 대상 트랙 3개와 트랙별 의무 단계 — 참고 명세 01·04·05·06 의 좌측 사이드바 원문 그대로.
 * 화면 세 벌을 따로 만들지 않고 「하나의 템플릿 + 트랙」으로 쓴다(명세 00 §1).
 */
export type TrackKey = "ws" | "fc" | "mt";

export const TRACKS: { key: TrackKey; label: string; area: "I" | "F" | "M"; disaster: string }[] = [
  { key: "ws", label: "사업장", area: "I", disaster: "중대산업재해" },
  { key: "fc", label: "공중이용시설·공중교통수단", area: "F", disaster: "중대시민재해" },
  { key: "mt", label: "원료·제조물", area: "M", disaster: "중대시민재해" },
];
export const trackOf = (k?: string) => TRACKS.find((t) => t.key === k) || TRACKS[0];

export type Step = {
  key: string;          // 주소에 쓰는 이름(영문 짧게)
  group: 1 | 2 | 3 | 4; // ①~④
  no?: number;          // ① 아래 1)~8)
  label: string;        // 좌측 메뉴 글자(원문)
  title: string;        // 본문 제목(원문 — 조문 포함)
  scr: string;          // 참고 명세 화면 번호
  code36?: string;      // 우리 의무조항 36 대응(데이터 연결용)
};

// 09-25 사용자: 명세 오기 「관계법령상의무이행」(띄어쓰기 없음) → 「관계 법령상 의무이행」(ws 와 같은 표기)
export const GROUPS: Record<TrackKey, Record<1 | 2 | 3 | 4, string>> = {
  ws: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지 대책 수립 및 이행", 3: "개선·시정 등을 명한 사항 이행", 4: "관계 법령상 의무이행" },
  fc: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지 대책 수립 및 이행", 3: "개선·시정 등을 명한 사항 이행", 4: "관계 법령상 의무이행" },
  mt: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지 대책 수립 및 이행", 3: "중앙행정기관, 지자체 개선·시정 사항 이행", 4: "관계 법령 의무이행 조치" },
};

import { STEPS_WS } from "./steps_ws";
import { STEPS_FC } from "./steps_fc";
import { STEPS_MT } from "./steps_mt";
export const STEPS: Record<TrackKey, Step[]> = { ws: STEPS_WS, fc: STEPS_FC, mt: STEPS_MT };

export const stepOf = (t: TrackKey, k?: string) => STEPS[t].find((s) => s.key === k) || STEPS[t][0];
/** 이전·다음 단계 — 하단 단계 이동 버튼용. */
export function neighbors(t: TrackKey, k: string) {
  const a = STEPS[t], i = a.findIndex((s) => s.key === k);
  return { prev: i > 0 ? a[i - 1] : null, next: i >= 0 && i < a.length - 1 ? a[i + 1] : null, index: i + 1 };
}
