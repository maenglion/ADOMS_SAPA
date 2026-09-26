/**
 * 도급·용역·위탁 — 규칙 한 곳 (2026-09-21)
 *
 * 화면(page.tsx)과 쓰기(actions.ts)가 같은 규칙을 쓰게 여기에 둔다.
 * 예시 자료 생성기(build_contracts_orders_v07.py judge_control)도 같은 규칙이다.
 *
 * 근거
 *   법 제5조 · 법 제9조제3항 — 단서: 시설·장비·장소를 실질적으로 지배ㆍ운영ㆍ관리하는 책임이 있는 경우에 한정
 *   시행령 제4조제9호(산업) 가·나·다목 · 반기 1회 이상 점검
 *   시행령 제10조제8호(시민 — 공중이용시설·공중교통수단의 운영ㆍ관리 업무) 가·나목 · 연 1회 이상 점검,
 *     직접 점검하지 않으면 지체 없이 결과를 보고받음
 *   서울시 안내서 4-6(p.139~141) — 평가 10항목 × 우수5·보통3·미흡1, 기관별 가중치 · 합격선 70점(참고 60/70/80)
 */
import { readTable, type Row } from "@/lib/data";

/* ── 적용 틀 ──────────────────────────────────────────────── */

export const FRAMES = ["산업", "시민", "둘 다"] as const;
export const FRAME_INFO: Record<string, { law: string; decree: string; cycle: string }> = {
  산업: { law: "법 제5조", decree: "시행령 제4조제9호 가·나·다목", cycle: "반기 1회 이상 점검" },
  시민: { law: "법 제9조제3항", decree: "시행령 제10조제8호 가·나목", cycle: "연 1회 이상 점검 · 직접 점검하지 않으면 지체 없이 결과를 보고받음" },
};
export const framesOf = (f?: string) => (f === "둘 다" ? ["산업", "시민"] : f === "시민" ? ["시민"] : ["산업"]);
/** 화면 표시 — 데이터 값(산업·시민)은 그대로 두고 법령 용어로 보인다(09-22 정정). */
export const FRAME_LABEL: Record<string, string> = {
  산업: "중대산업재해",
  시민: "중대시민재해(공중이용시설·공중교통수단)",
  "둘 다": "둘 다(중대산업재해·중대시민재해)",
};
export const frameLabel = (f?: string) => FRAME_LABEL[f || "산업"] || f || "";

/** 관리의무 4항목의 근거 — 적용 틀별. ③은 산업(건설업·조선업)에만 있다. */
export const ITEM_BASIS: Record<string, Record<string, string>> = {
  "1": { 산업: "시행령 제4조제9호가목", 시민: "시행령 제10조제8호가목" },
  "2": { 산업: "시행령 제4조제9호나목", 시민: "시행령 제10조제8호나목" },
  "3": { 산업: "시행령 제4조제9호다목" },
  "4": { 산업: "법 제5조", 시민: "법 제9조제3항" },
};

export const ENTRUST_TYPES = ["민간위탁", "자치구 위임", "국가 위임·재위임", "도급", "용역", "물품 구매"] as const;
export const CIVIL_SCOPES = ["해당", "확인 필요", "해당 없음"] as const;

/* ── 실질 지배·운영·관리 판단 ────────────────────────────────── */

export const CTL_CHECKS = [
  ["ctl_own", "시(기관) 소유 시설·장비·장소에서 한다"],
  ["ctl_lease", "시(기관)가 임차한 시설에서 한다(공공 목적 임차 포함)"],
  ["ctl_repair", "보수·보강 의무·예산이 시(기관)에 있다"],
  ["ctl_command", "작업 중지·시정 지시 등 통제를 할 수 있다"],
  ["ctl_vendor_site", "수급인이 소유·임차한 시설에서 하는 일이 있다"],
] as const;

/**
 * 해당 / 비해당 / 확인 필요.
 *   · 수급인 소유·임차 시설에서만 하는 일(시 소유·임차 아님) → 비해당 (서울시 안내서 p.139~141)
 *   · 시 소유·임차 + (보수·보강 의무 또는 통제 가능) 이고 수급인 시설 작업이 섞이지 않음 → 해당
 *   · 나머지 → 확인 필요 (사람이 작업별로 가린다)
 */
export function controlResult(r: Row): "해당" | "비해당" | "확인 필요" {
  const y = (k: string) => r[k] === "Y";
  if (y("ctl_vendor_site") && !y("ctl_own") && !y("ctl_lease")) return "비해당";
  if ((y("ctl_own") || y("ctl_lease")) && (y("ctl_repair") || y("ctl_command")) && !y("ctl_vendor_site")) return "해당";
  return "확인 필요";
}

/* ── 수급인 평가 설정 ─────────────────────────────────────────── */

export const RISKS = ["일반", "위험장소", "화재·폭발·밀폐"] as const;
export type EvalSetting = {
  def: number; marks: Record<string, number>; weights: number[];
  set_at?: string; set_by?: string;
};
export const DEFAULT_SETTING: EvalSetting = {
  def: 70, marks: { 일반: 60, 위험장소: 70, "화재·폭발·밀폐": 80 }, weights: Array(10).fill(2),
};

/** 평가 10항목 — 표(contract_eval_item)가 없을 때도 화면이 서도록 같은 값을 둔다. */
const EVAL_FALLBACK = [
  "조직·인력", "안전예산 구분 관리", "규정·매뉴얼", "안전점검 계획", "이행 확인 절차", "교육·훈련",
  "재해 대응 체계", "비상 대책", "최근 3년 중대재해 발생·행정처분", "안전장비",
].map((n, i) => ({ item_no: String(i + 1), item_name: n, group_code: "가가가나나나다다라마"[i],
  group_name: ["체계", "체계", "체계", "실행", "실행", "실행", "운영", "운영", "발생 이력", "장비"][i],
  mid_hint: i === 8 ? "과태료" : "", low_hint: i === 8 ? "영업정지" : "", default_weight: "2" }));

export async function evalItems(): Promise<Row[]> {
  const t = await readTable("contract_eval_item");
  return (t.length ? t : EVAL_FALLBACK).slice().sort((a, b) => Number(a.item_no) - Number(b.item_no));
}

/** 설정은 화면에서 저장할 때마다 한 줄씩 쌓인다 — 가장 늦은 줄이 지금 설정이다(이력이 남는다). */
export async function evalSetting(): Promise<EvalSetting> {
  const rows = await readTable("contract_eval_setting");
  const last = rows.slice().sort((a, b) => String(b.set_at).localeCompare(String(a.set_at)))[0];
  if (!last) {
    const items = await evalItems();
    return { ...DEFAULT_SETTING, weights: items.map((i) => Number(i.default_weight) || 2) };
  }
  const w = String(last.weights || "").split(",").map((x) => Number(x));
  return {
    def: Number(last.pass_default) || DEFAULT_SETTING.def,
    marks: {
      일반: Number(last.pass_general) || DEFAULT_SETTING.marks.일반,
      위험장소: Number(last.pass_risk) || DEFAULT_SETTING.marks.위험장소,
      "화재·폭발·밀폐": Number(last.pass_fire) || DEFAULT_SETTING.marks["화재·폭발·밀폐"],
    },
    weights: w.length === 10 && w.every((x) => x > 0) ? w : DEFAULT_SETTING.weights,
    set_at: last.set_at, set_by: last.set_by,
  };
}

/** 이 계약에 지금 적용할 합격선 — 작업 위험도를 골랐으면 그 값, 아니면 기본값. */
export const passFor = (c: Row, S: EvalSetting) => (c.work_risk && S.marks[c.work_risk]) || S.def;

/** 평가 당시 합격선 — 저장된 값이 있으면 그것(옛 평가는 75점 기준으로 매겨졌다). */
export const passAtEval = (c: Row, S: EvalSetting) => Number(c.eval_pass_mark) || passFor(c, S);

/** 10항목 점수(5·3·1) × 가중치 → 100점 환산. */
export function totalOf(points: number[], weights: number[]) {
  const got = points.reduce((t, p, i) => t + p * (weights[i] || 0), 0);
  const max = weights.reduce((t, w) => t + 5 * w, 0);
  return max ? Math.round((got / max) * 100) : 0;
}

/* ── 도급 5단계 ─────────────────────────────────────────────── */

export const STAGES = ["발주", "평가", "계약", "이행", "준공 정산"] as const;
export const stageIndex = (s?: string) => {
  const i = STAGES.indexOf((s || "") as any);
  return i < 0 ? 0 : i;
};
