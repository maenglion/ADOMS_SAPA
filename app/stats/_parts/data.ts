/**
 * [400 · 교육자료 버전] 묶음 G 데이터 가공 — 통계 및 사례.
 *  · 발생통계 원장: 표 usg_stat_occur(예시 자료 CSV + 화면 업로드분)
 *  · 사고사례: 표 usg_case(예시 자료 CSV + 화면 등록·수정·삭제 표시)
 *  · 안전·보건 관계 법령: 우리 의무 목록 duties() 를 법령·위계·시설구분으로 센다
 */
import "server-only";
import { readTable, type Row } from "@/lib/data";

/* ── 발생통계 ───────────────────────────────────────────────────────────── */

/** 원장 20칸 — 화면 머리(원문) · 내보내기 열 이름 · 행의 칸 이름. br = 머리 두 줄 */
export const OCC_COLS: { key: string; head: string; br?: [string, string] }[] = [
  { key: "year", head: "연도별" },
  { key: "seq", head: "연번" },
  { key: "org_name", head: "기관명" },
  { key: "dept_name", head: "실국과" },
  { key: "occurred_at", head: "사고발생일" },
  { key: "report_at", head: "산업재해조사표 제출일", br: ["산업재해조사표", "제출일"] },
  { key: "approve_at", head: "요양결정승인일" },
  { key: "comp", head: "보상현황", br: ["보상", "현황"] },
  { key: "disaster_kind", head: "재해구분", br: ["재해", "구분"] },
  { key: "lost_days", head: "재해자 휴업일수", br: ["재해자", "휴업일수"] },
  { key: "work_type", head: "근로형태" },
  { key: "birth_year", head: "생년" },
  { key: "sex", head: "성별" },
  { key: "acc_type", head: "재해유형" },
  { key: "injury", head: "상해종류" },
  { key: "process", head: "사고과정 (사고내용)", br: ["사고과정", "(사고내용)"] },
  { key: "job", head: "관련작업" },
  { key: "place", head: "발생장소" },
  { key: "cause", head: "발생 원인", br: ["발생 원", "인"] },
  { key: "note", head: "비고" },
];

/** 통계 기준일(원장 자료의 기준연도 끝) — 기준일자 기본값 */
export const OCC_BASE_DATE = "2026-06-30";

export async function occurRows(): Promise<Row[]> {
  const rows = (await readTable("usg_stat_occur", "occ_id")).filter((r) => r.deleted !== "Y");
  return rows.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : Number(a.seq) - Number(b.seq)));
}

export type OccFilter = { y?: string; org?: string; dept?: string; acc?: string; inj?: string; base?: string };

export function filterOcc(rows: Row[], f: OccFilter) {
  const base = f.base || OCC_BASE_DATE;
  return rows.filter((r) =>
    String(r.occurred_at) <= base &&
    (!f.y || String(r.year) === f.y) &&
    (!f.org || r.org_name === f.org) &&
    (!f.dept || r.dept_name === f.dept) &&
    (!f.acc || r.acc_type === f.acc) &&
    (!f.inj || r.injury === f.inj));
}

/** 값 목록(셀렉트용) — 원장에서 나오는 값만 */
export const uniq = (rows: Row[], k: string) => [...new Set(rows.map((r) => String(r[k] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));

/** 집계 — [라벨, 값][] (순서 고정 목록이 있으면 그 순서) */
export function countBy(rows: Row[], key: (r: Row) => string, order?: string[]): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
  if (order) return order.map((k) => [k, m.get(k) || 0] as [string, number]).filter(([, n], i, a) => n > 0 || a.length <= 8);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
/** 구성비(%) — 소수 둘째 자리 */
export const shareOf = (pairs: [string, number][]) => {
  const t = pairs.reduce((a, [, n]) => a + n, 0) || 1;
  return pairs.map(([k, n]) => [k, Math.round((n / t) * 10000) / 100] as [string, number]);
};

/* ── 사고사례 ───────────────────────────────────────────────────────────── */

export async function caseRows(includeDeleted = false): Promise<Row[]> {
  const rows = await readTable("usg_case", "case_no");
  return rows
    .filter((r) => includeDeleted || r.deleted !== "Y")
    .sort((a, b) => Number(b.case_no) - Number(a.case_no));
}

/** 첨부 — 「이름|주소」를 「;;」로 이어 둔 칸 */
export const filesOf = (s: string) =>
  String(s || "").split(";;").filter(Boolean).map((x) => { const [name, url] = x.split("|"); return { name, url }; });

/* ── 안전·보건 관계 법령 ─────────────────────────────────────────────────── */

/** 법령 위계 묶음 — 법률 > 대통령령 > 총리령·부령 · 고시·훈령·예규는 행정규칙(별도 축, 지침 원칙 8) */
export const LAYERS = ["법률", "시행령", "시행규칙", "고시·훈령·예규"] as const;
export function layerOf(layer: string): string {
  const s = String(layer || "");
  if (s === "법률") return "법률";
  if (s.includes("시행령") || s === "대통령령") return "시행령";
  if (s.includes("시행규칙") || s.includes("부령")) return "시행규칙";
  return "고시·훈령·예규";
}

/** 공중이용시설 시설구분(명세 FACILITY_TYPE) — 우리 관리대상 코드로 나눈다 */
export const FAC_TYPES = ["건축물", "상하수도", "옹벽", "하천", "터널", "교량", "절토사면", "기타"] as const;
const BLDG = new Set(["TG07", "TG09", "TG10", "TG11", "TG13", "TG15", "TG16", "TG30", "TG34"]);
export function facTypeOf(r: Row): string {
  const c = r.target_code;
  const text = `${r.duty_name || ""} ${r.article_title || ""} ${r.doc || ""} ${String(r.source_text || "").slice(0, 200)}`;
  if (BLDG.has(c)) return "건축물";
  if (c === "TG01" || c === "TG02") return "상하수도";
  if (c === "TG04" || c === "TG35") return "하천";
  if (c === "TG05") return text.includes("옹벽") ? "옹벽" : "절토사면";
  if (c === "TG03") return text.includes("터널") ? "터널" : /교량|교각|교대/.test(text) ? "교량" : "기타";
  return "기타";
}

/**
 * 원료·제조물 세부 구분 — 무엇(물질·제품)을 다루는 의무인지로 나눈다.
 * 09-25 사용자 지적: 관리대상 코드의 시설 이름(TG13 업무시설 · TG24 모든 시설 공통)을 그대로 쓰면 원료·제조물 밑에 「시설」이 보인다.
 *  · TG13 으로 들어온 81건은 전부 석면안전관리법 계열(건축물 석면조사 등) → 「석면」
 *  · TG24 로 들어온 72건 중 중대재해처벌법(제9조제2항 · 시행령 제8조 확보의무) → 「중대재해처벌법 확보의무」, 나머지(잔류성오염물질 · 신재생에너지 · 자원재활용) → 「기타」
 *  이 구분은 화면 표시만 바꾼다. 석면·잔류성오염물질 등이 원료·제조물 의무가 맞는지는 판정 쪽에서 확인할 일(의무 목록 자체는 그대로).
 */
export const MT_TYPES = ["상수도", "식품·급식", "유해화학물질", "석면", "중처법 확보의무", "기타"] as const;   // 09-25 사용자: 이 구분에서는 「중처법」으로 짧게
export function mtTypeOf(r: Row): string {
  const c = r.target_code;
  const law = String(r.law || r.doc || "");
  if (c === "TG01") return "상수도";
  if (c === "TG28") return "식품·급식";
  if (c === "TG19") return "유해화학물질";
  if (law.includes("석면")) return "석면";
  if (law.startsWith("중대재해 처벌 등에 관한 법률")) return "중처법 확보의무";
  return "기타";
}

/** 중대시민재해 1차 구분 */
export const CIVIL_TARGETS = ["공중이용시설", "공중교통수단", "원료·제조물"] as const;
export const civilOf = (r: Row) => (r.area === "M" ? "원료·제조물" : r.target_code === "TG14" ? "공중교통수단" : "공중이용시설");
/** 1차 구분별 2차 라디오 */
export const SUBS: Record<string, readonly string[]> = {
  공중이용시설: FAC_TYPES,
  공중교통수단: LAYERS,   // TODO: 확인 — 명세에 공중교통수단 세부 유형 화면이 없어(추정) 법령 위계로 나눔
  "원료·제조물": MT_TYPES, // TODO: 확인 — 명세에 원료·제조물 세부 유형 화면이 없어(추정) 관리대상으로 나눔
};
export function subOf(r: Row, target: string): string {
  if (target === "공중이용시설") return facTypeOf(r);
  if (target === "공중교통수단") return layerOf(r.layer);
  return mtTypeOf(r);
}

/** 조 제목 — 경로 모양 값(a901/p3/…)은 보이지 않는다 */
export const titleOf = (r: Row) => (/^[a-z]+\d/.test(String(r.article_title || "")) ? "" : String(r.article_title || ""));

/** 본문 「〈주요 사고 유형〉」 목록 → 카드뉴스 자료(업종 · 사고 · 원인). 본문에 적힌 글만 쓴다(새로 지어내지 않는다). */
export function caseCards(content: string) {
  return [...String(content || "").matchAll(/^(\d)\.\s*\(([^)]+)\)\s*(.+?)(?:\s+—\s+(.+))?$/gm)]
    .map((m) => ({ no: Number(m[1]), sector: m[2].trim(), what: m[3].trim(), cause: (m[4] || "").trim() }));
}
/** 제목 괄호 속 공유 기간 — 「'26.6.22.~7.6.」 */
export const periodOf = (title: string) => (String(title || "").match(/\(([^)]*~[^)]*)\)/) || [])[1] || "";
