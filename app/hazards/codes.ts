/**
 * 유해·위험요인 신고·조치 — 분류 코드와 단계 계산. (2026-09-21)
 *
 * 근거
 *   · 중대재해처벌법 시행령 제10조제7호가목·나목(업무처리절차 — 확인·점검 / 발견 시 신고·조치요구·이용 제한·보수·보강)
 *   · 분류: 서울시 「시민재해 안전보건업무 안내서」 붙임 5-6 조사결과표(시설물 안전 4대분류 · 이용자 안전 5대분류)
 *           · 사고유형 19종(안내서 표 5-4, 공단 산업재해 발생형태 일부수정)
 *   · 보수·보강 기한: 시설물안전법 제24조제1항 · 같은 법 시행령 제19조(법령DB 원문 확인, 2025.12.2 개정)
 *
 * 화면(서버)·입력 창(클라이언트) 모두 이 파일을 읽으므로 server-only 를 두지 않는다.
 */
export const CHANNELS = ["정기점검", "상시점검", "시민 신고", "직원 발견"] as const;
export const CITIZEN_DETAIL = ["120", "안전신문고", "응답소", "전화·방문"] as const;

export const CODE_GROUPS: Record<string, string[]> = {
  "시설물 안전": ["1 주요 구조부", "2 건축마감", "3 부대시설", "4 주변시설"],
  "이용자 안전": ["1 물리적", "2 화학적", "3 전기적", "4 생물학적", "5 기타"],
};

// 09-26 사용자: 재해유형 한 벌로 — 발생통계 원장 이름 기준(lib/acc_types.ts). 옛 값은 읽을 때 accType()으로 맞춘다.
export { ACC_TYPES as ACCIDENT_TYPES } from "@/lib/acc_types";

export const ORDER_TYPES = ["이용제한", "보수·보강", "정밀안전진단", "사용금지", "철거"];

/** 식별자 한글 접두어 — 「HZR-0001」 → 「신고-0001」. */
export const hid = (id?: string) => String(id || "").replace(/^HZR-/, "신고-");

/* ── 법령 원문(법령DB 확인) ─────────────────────────────── */
export const LAW_7GA = "가. 공중이용시설 또는 공중교통수단의 유해ㆍ위험요인의 확인ㆍ점검에 관한 사항";
export const LAW_7NA =
  "나. 공중이용시설 또는 공중교통수단의 유해ㆍ위험요인을 발견한 경우 해당 사항의 신고ㆍ조치요구, 이용 제한, 보수ㆍ보강 등 그 개선에 관한 사항";
export const LAW_FSAM_19 =
  "관리주체는 법 제24조제1항에 따라 같은 항 제1호부터 제3호까지에 따른 조치명령, 지정 또는 통보를 받은 날부터 1년 이내에 " +
  "시설물의 보수ㆍ보강 등 필요한 조치에 착수해야 하며, 특별한 사유가 없으면 착수한 날부터 2년 이내에 이를 완료해야 한다.";

/* ── 단계 ─────────────────────────────────────────────── */
export type Stage =
  | "접수" | "피해방지" | "1차 판단" | "종결"
  | "경영책임자 보고" | "긴급안전점검" | "개선 지시" | "보수·보강 계획" | "완료";

export const FLOW_MINOR: Stage[] = ["접수", "피해방지", "1차 판단", "종결"];
export const FLOW_SERIOUS: Stage[] = ["접수", "피해방지", "1차 판단", "경영책임자 보고", "긴급안전점검", "개선 지시", "보수·보강 계획", "완료"];

/** 지금까지 끝난 마지막 단계. */
export function stageOf(r: Record<string, any>): Stage {
  if (r.severity === "경미") return r.closed_at ? "종결" : "1차 판단";
  if (r.severity === "심각") {
    if (r.done_at) return "완료";
    if (r.fix_items) return "보수·보강 계획";
    if (r.order_at) return "개선 지시";
    if (r.insp_at) return "긴급안전점검";
    if (r.ceo_reported_at) return "경영책임자 보고";
    return "1차 판단";
  }
  if (r.protect_at) return "피해방지";
  return "접수";
}

/** 다음에 할 일. */
export function nextOf(r: Record<string, any>): string {
  const s = stageOf(r);
  if (s === "접수") return "피해방지조치";
  if (s === "피해방지") return "1차 판단(경미·심각)";
  if (s === "1차 판단") return r.severity === "경미" ? "즉시 조치·종결" : "경영책임자 보고";
  if (s === "경영책임자 보고") return "긴급안전점검";
  if (s === "긴급안전점검") return "개선 지시";
  if (s === "개선 지시") return "보수·보강 계획";
  if (s === "보수·보강 계획") return r.fix_started_at ? "보수·보강 완료" : "보수·보강 착수";
  return "";
}

export const isOpen = (r: Record<string, any>) => !["종결", "완료"].includes(stageOf(r));

/* ── 날짜 ─────────────────────────────────────────────── */
const DAY = 86400000;
export const toDate = (s?: string) => (s ? new Date(String(s).replace(" ", "T") + (String(s).length <= 10 ? "T00:00:00" : "")) : null);
/** 로컬 날짜 문자열(YYYY-MM-DD) — toISOString 은 UTC 라 하루가 밀린다. */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function addYears(s: string, n: number) {
  const d = toDate(String(s).slice(0, 10))!;
  d.setFullYear(d.getFullYear() + n);
  return ymd(d);
}
export function dday(target: string, today = new Date()) {
  const t = toDate(String(target).slice(0, 10))!;
  const a = toDate(ymd(today))!;
  return Math.round((+t - +a) / DAY);
}
export const ddayLabel = (n: number) => (n > 0 ? `D-${n}` : n === 0 ? "D-day" : `D+${-n}`);

/** 심각 판정 뒤 보고까지(또는 지금까지) 걸린 시간(시간 단위). */
export function hoursBetween(a?: string, b?: string) {
  const x = toDate(a), y = b ? toDate(b) : new Date();
  if (!x || !y) return null;
  return Math.max(0, Math.round(((+y - +x) / 3600000) * 10) / 10);
}
/** 기관이 정하는 보고 기준 시간 — 안내서는 「즉시」, 시간은 기관이 정한다. 이 화면은 24시간을 넘으면 강조한다. */
export const REPORT_LIMIT_H = 24;

/**
 * 시설물안전법 기한 — 기준일(조치명령·지정·통보를 받은 날)부터 1년 이내 착수, 착수일부터 2년 이내 완료.
 * 아직 착수하지 않았으면 완료 기한은 「착수 기한 + 2년」을 가장 늦은 날로 보인다.
 */
export function fsamDeadline(r: Record<string, any>) {
  if (r.fsam_applies !== "Y" || !r.basis_date) return null;
  const startBy = addYears(r.basis_date, 1);
  const doneBy = addYears(r.fix_started_at || startBy, 2);
  return {
    startBy, doneBy,
    startLeft: r.fix_started_at ? null : dday(startBy),
    doneLeft: r.fix_done_at ? null : dday(doneBy),
    startLate: !r.fix_started_at && dday(startBy) < 0,
    doneLate: !r.fix_done_at && dday(doneBy) < 0,
  };
}

/** 보수·보강 계획 항목 — 「항목~물량~비용(만원)~기간 | …」. */
export type FixItem = { item: string; qty: string; cost: string; period: string };
export function parseFix(s?: string): FixItem[] {
  return String(s || "").split("|").map((x) => x.trim()).filter(Boolean).map((x) => {
    const [item = "", qty = "", cost = "", ...rest] = x.split("~");
    return { item, qty, cost, period: rest.join("~") };
  });
}
export const joinFix = (xs: FixItem[]) =>
  xs.filter((x) => x.item.trim()).map((x) => [x.item, x.qty, x.cost, x.period].map((v) => v.replace(/\|/g, " ").replace(/~/g, "–").trim()).join("~")).join(" | ");
