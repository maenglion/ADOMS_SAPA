/**
 * 재해 발생 직후 대응 — 읽기 모형 (2026-09-22)
 *
 * 근거(법령DB 원문 대조)
 *   시행령 제10조제7호다목 — 「중대시민재해가 발생한 경우 사상자 등에 대한 긴급구호조치, 공중이용시설 또는
 *     공중교통수단에 대한 긴급안전점검, 위험표지 설치 등 추가 피해방지 조치, 관계 행정기관 등에 대한 신고와
 *     원인조사에 따른 개선조치에 관한 사항」 (업무처리절차에 담아 이행)
 *   시행령 제4조제8호 — 중대산업재해 대비 매뉴얼: 가. 작업 중지·근로자 대피·위험요인 제거 등 대응조치
 *     나. 중대산업재해를 입은 사람에 대한 구호조치  다. 추가 피해방지를 위한 조치
 *   산업안전보건법 제54조제2항(중대재해 — 지체 없이 고용노동부장관에게 보고)
 *   산업안전보건법 시행규칙 제73조제1항(사망·3일 이상 휴업 — 1개월 이내 산업재해조사표 제출)
 * 실무 절차(법령 아님): 서울시 시민재해 안전보건업무 안내서 — 표 5-8 상황단계 · 붙임 5-9 보고 체계(최초·직후·수시)
 *   · 붙임 5-10 사고 발생·상황대응 보고 칸 · 붙임 5-16 언론 취재 보고(창구 한 사람).
 *
 * 표
 *   incident_response  — 긴급 조치·경영책임자 지시 1건 = 1행(kind 로 가른다)
 *   incident_report    — 보고 1건 = 1행(최초·직후·수시). 경영책임자 「최초보고 받음」은 그 행의 ceo_ack_* 칸
 *   incident_response_setting — 기관 설정(최초보고 기한 분). 저장할 때마다 한 줄 — 가장 늦은 줄이 지금 설정
 */
import "server-only";
import { readTable, type Row } from "@/lib/data";
import { loadHazards } from "@/app/hazards/load";
import { ymd } from "@/lib/day";

/** 기관이 따로 정하지 않았을 때의 최초보고 기한(분). 안내서는 「즉시」라고만 한다. */
export const DEFAULT_FIRST_LIMIT_MIN = 60;

export const REPORT_STAGES = ["최초보고", "직후보고", "수시보고"] as const;
export const REPORT_STAGE_HINT: Record<string, string> = {
  최초보고: "즉시 — 언제·어디서·규모·추정 원인·담당 부서",
  직후보고: "현장 출동 직후 — 원인·피해·시민 불편·수습 대책",
  수시보고: "상황이 바뀔 때마다 — 진행·문제·대책·언론 동향",
};
export const RECIPIENTS = ["경영책임자", "총괄", "관계 행정기관"] as const;

/** 긴급 조치 종류. area: 어느 재해에 필수인가. 산업은 이름이 다른 것이 있다. */
export type ActKind = {
  key: string; label: string; labelInd?: string;
  civil: boolean; ind: boolean;          // 필수 여부(시민 · 산업)
  basisCivil: string; basisInd: string;  // 근거 — 법령이 아니면 「기관 절차」라고 적는다
  optional?: boolean;
};
export const ACT_KINDS: ActKind[] = [
  { key: "recognize", label: "사고 인지·접수", civil: true, ind: true,
    basisCivil: "보고 시간 계산의 기준 시각", basisInd: "보고 시간 계산의 기준 시각" },
  { key: "call", label: "112·119 신고", civil: true, ind: true,
    basisCivil: "기관 절차(안내서 표 5-8 신고·접수)", basisInd: "기관 절차(안내서 표 5-8 신고·접수)" },
  { key: "rescue", label: "긴급구호(사상자 구호)", civil: true, ind: true,
    basisCivil: "시행령 제10조제7호다목 긴급구호조치", basisInd: "시행령 제4조제8호나목 구호조치" },
  { key: "inspect", label: "긴급안전점검", civil: true, ind: true,
    basisCivil: "시행령 제10조제7호다목 긴급안전점검", basisInd: "시행령 제4조제8호다목 추가 피해방지" },
  { key: "sign", label: "위험표지 설치", civil: true, ind: true,
    basisCivil: "시행령 제10조제7호다목 위험표지 설치", basisInd: "시행령 제4조제8호다목 추가 피해방지" },
  { key: "restrict", label: "이용 제한·통제", labelInd: "작업 중지·근로자 대피", civil: true, ind: true,
    basisCivil: "시행령 제10조제7호다목 추가 피해방지 조치", basisInd: "시행령 제4조제8호가목 · 산업안전보건법 제54조제1항" },
  { key: "notify", label: "주민 알림", civil: true, ind: false,
    basisCivil: "기관 절차(안내서 표 5-8 주민 홍보)", basisInd: "" },
  { key: "agency", label: "관계 행정기관 신고", civil: true, ind: true,
    basisCivil: "시행령 제10조제7호다목 관계 행정기관 등에 대한 신고",
    basisInd: "중대재해: 산업안전보건법 제54조제2항(지체 없이) · 3일 이상 휴업: 같은 법 시행규칙 제73조제1항(1개월 이내 산업재해조사표)" },
  { key: "press", label: "언론 창구 지정", civil: true, ind: true,
    basisCivil: "기관 절차(안내서 붙임 5-16 · 창구 한 사람)", basisInd: "기관 절차(안내서 붙임 5-16 · 창구 한 사람)" },
  { key: "family", label: "피해자·유가족 연락 담당 지정", civil: false, ind: false, optional: true,
    basisCivil: "기관 절차(안내서 — 사망자·유가족 지원)", basisInd: "기관 절차(안내서 — 사망자·유가족 지원)" },
];
export const CEO_KINDS = [
  { key: "ceo_prevent", label: "추가 피해 방지 지시" },
  { key: "ceo_cause", label: "원인 조사 지시" },
] as const;

export const kindLabel = (key: string, area?: string) => {
  const k = ACT_KINDS.find((x) => x.key === key);
  if (k) return area === "산업" && k.labelInd ? k.labelInd : k.label;
  return CEO_KINDS.find((x) => x.key === key)?.label || key;
};
export const kindBasis = (k: ActKind, area?: string) => (area === "산업" ? k.basisInd : k.basisCivil);
export const kindRequired = (k: ActKind, area?: string) => (area === "산업" ? k.ind : k.civil);

/** 「YYYY-MM-DD HH:MM」 → Date(서버 지역 시각). */
const toD = (s?: string) => {
  if (!s) return null;
  const d = new Date(String(s).trim().replace(" ", "T"));
  return isNaN(+d) ? null : d;
};
export const minutesBetween = (a?: string, b?: string) => {
  const x = toD(a), y = b ? toD(b) : new Date();
  if (!x || !y) return null;
  return Math.round((+y - +x) / 60000);
};
export const fmtMin = (m: number | null | undefined) => {
  if (m === null || m === undefined) return "—";
  if (m < 0) return "시각이 앞뒤가 맞지 않음";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return r ? `${h}시간 ${r}분` : `${h}시간`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
};
export const nowStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export type RespView = {
  incident_id: string; area: string; applies: boolean;
  acts: Row[]; reports: Row[]; ceo: Row[];
  byKind: Map<string, Row>;           // 종류별 가장 늦은 기록
  recognizedAt?: string;
  first?: Row; after?: Row; updates: Row[];
  firstMin: number | null;            // 인지 → 최초보고(분). 최초보고가 없으면 지금까지
  firstLate: boolean;
  missing: ActKind[];                 // 필수인데 기록 없는 조치
  ceoAck?: Row;                       // 최초보고를 경영책임자가 받은 기록이 있는 보고
  complete: boolean; started: boolean; active: boolean;
  priorHz: Row[];                     // 같은 시설 이전 유해·위험요인 신고
};

/** 기관 설정 — 최초보고 기한(분). */
export async function responseSetting() {
  const rows = await readTable("incident_response_setting");
  const last = rows.slice().sort((a, b) => String(b.set_at).localeCompare(String(a.set_at)))[0];
  const m = Number(last?.first_report_limit_min);
  return { limitMin: m > 0 ? m : DEFAULT_FIRST_LIMIT_MIN, set_at: last?.set_at || "", set_by: last?.set_by || "", isDefault: !(m > 0) };
}

/** 사고 목록(incident 행)에 대응 기록을 붙인다. */
export async function loadResponses(incs: Row[], today: string) {
  const [acts, reps, setting, hz] = await Promise.all([
    readTable("incident_response", "resp_id"),
    readTable("incident_report", "report_id"),
    responseSetting(),
    loadHazards(),
  ]);
  const out = new Map<string, RespView>();
  for (const i of incs) {
    const id = i.incident_id;
    const area = i.event_area === "산업" ? "산업" : "시민";
    const applies = i.event_class !== "아차사고";
    const mine = acts.filter((r) => r.incident_id === id);
    const act = mine.filter((r) => !String(r.kind).startsWith("ceo_"));
    const ceo = mine.filter((r) => String(r.kind).startsWith("ceo_"));
    const byKind = new Map<string, Row>();
    act.slice().sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)))
      .forEach((r) => byKind.set(r.kind, r));
    ceo.forEach((r) => byKind.set(r.kind, r));
    const reports = reps.filter((r) => r.incident_id === id)
      .sort((a, b) => String(a.reported_at).localeCompare(String(b.reported_at)));
    const first = reports.find((r) => r.report_stage === "최초보고");
    const after = reports.find((r) => r.report_stage === "직후보고");
    const updates = reports.filter((r) => r.report_stage === "수시보고");
    const recognizedAt = byKind.get("recognize")?.done_at || undefined;
    const firstMin = recognizedAt ? minutesBetween(recognizedAt, first?.reported_at) : null;
    const firstLate = firstMin !== null && firstMin > setting.limitMin;
    const missing = ACT_KINDS.filter((k) => kindRequired(k, area) && !byKind.get(k.key));
    const ceoAck = reports.find((r) => r.ceo_ack_at);
    const started = mine.length + reports.length > 0;
    const complete = applies && !missing.length && Boolean(first) && Boolean(after) && Boolean(ceoAck)
      && Boolean(byKind.get("ceo_cause"));
    // 기록이 하나라도 있거나 최근 7일 안에 난 재해는 「진행 중」으로 본다. 기록이 전혀 없는 옛 사고는 따로 센다.
    const recent = i.occurred_at && i.occurred_at >= addDaysStr(today, -7);
    const active = applies && !complete && (started || Boolean(recent));
    const priorHz = i.asset_id
      ? hz.rows.filter((h) => h.asset_id === i.asset_id && String(h.received_at).slice(0, 10) <= String(i.occurred_at))
        .sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)))
      : [];
    out.set(id, {
      incident_id: id, area, applies, acts: act, reports, ceo, byKind, recognizedAt,
      first, after, updates, firstMin, firstLate, missing, ceoAck, complete, started, active, priorHz,
    });
  }
  return { resp: out, setting };
}

function addDaysStr(d: string, n: number) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return ymd(x);
}
