/**
 * [400 · 교육자료 버전] 묶음 B1 — 관리대상 현황(SCR-023 · 027~033) 서버 쪽 도우미.
 *
 * 관리대상 3트랙
 *   ws 사업장                  → 사업장 20곳(usb1_workplace · 전부 확인필요) + 소속 근무 장소 76곳(usb1_work_site · 목록만)
 *                                부서(depts())와 이행 과제는 모두 본청(WP-01)에 붙어 있다 — 2026-09-24 사용자 지시
 *   fc 공중이용시설·공중교통수단 → 자산 대장 assetSeed()(FMS 시설물) + 공중교통수단(usb1_transport)
 *   mt 원료·제조물              → 원료·제조물 대장 material_item
 * 기본정보·세부정보는 한 표(usb1_basic)에 「트랙:대상:기준일자」 한 줄로 쌓는다(기준일자 이력).
 */
import "server-only";
import { readTable, depts, staff, assetSeed, assetMapSeed, duties, contracts } from "@/lib/data";
import { ROLE_STAFF, deptOf } from "@/lib/roles";

export type Row = Record<string, any>;
export type TrackKey = "ws" | "fc" | "mt";
export const TRACK_LABEL: Record<TrackKey, string> = {
  ws: "사업장",
  fc: "공중이용시설·공중교통수단",
  mt: "원료·제조물",
};
export const trackKey = (t?: string): TrackKey => (t === "fc" || t === "mt" ? t : "ws");
export const byOf = (role?: string) => ROLE_STAFF[role || "gm"] || "SD01-1";

/* ── 공통 코드값(명세 00 §6 · 03) ─────────────────────────────── */
export const EMP_TYPES = ["공무원", "공무직", "촉탁직", "기간제", "공공안전관", "공공근로", "뉴딜일자리", "기타"] as const;
export const HC_ROWS = ["현원", "현업업무종사자"] as const;
/** 업종분류(안) — 명세 00 §6 코드셋. 코드는 한국표준산업분류(10차). 확실한 것만 자동 채움. */
export const IND_CLASS: { label: string; code: string }[] = [
  { label: "공공행정", code: "84113" },   // 지방 행정 집행기관
  { label: "서비스업", code: "" },        // TODO: 확인 — 세세분류가 부서마다 달라 자동으로 채우지 않는다
  { label: "하수처리업", code: "37011" }, // 하수 처리업
  { label: "보건업", code: "" },          // TODO: 확인
];
export const FACILITY_TYPES = ["전체", "건축물", "상하수도", "옹벽", "하천", "터널", "교량", "절토사면", "저수지", "실내공기질 시설", "기타"] as const;   // 09-24 저수지(관계법령 관리시설) · 09-25 실내공기질 시설(중처법 시행령 제3조제1호 · 별표 2)
/** 09-25: 용인시 공표 634 대조로 들어온 실내공기질관리법 대상 유형 — 시설구분 단추에서는 「실내공기질 시설」 하나로 묶는다 */
const IAQ = new Set(["도서관", "업무시설", "실내공연장", "지하 장례식장", "실내체육시설", "어린이집", "실내어린이놀이시설"]);
/** 명세에 없는 추가 칸 — 공중교통수단(용인경전철)을 목록에 올리기 위해. */
export const TRANSPORT = "공중교통수단";

/** SCR-023 안전보건관리체계 7항목과 선택지. 선택지는 명세에 현재값만 보여 추정 — TODO: 확인(판독불확실). */
export const MGMT_ITEMS = ["안전보건관리규정 작성", "안전보건관리책임자", "안전관리자", "보건관리자 (안전감독자)", "산업보건의", "산업안전보건위원회", "관리감독자"];
export const MGMT_OPTS: string[][] = [
  ["제정", "미제정"], ["지정", "미지정"], ["선임", "미선임"], ["선임", "미선임"], ["위촉", "미위촉"], ["구성", "미구성"], ["지정", "미지정"],
];
/** safety_org_role 의 항목 이름 ↔ 7항목 순서 */
export const MGMT_SOR = ["안전보건관리규정", "안전보건관리책임자", "안전관리자", "보건관리자", "산업보건의", "산업안전보건위원회", "관리감독자"];

/* ── 사업장(ws) ──────────────────────────────────────────── */
/** 본청 사업장(WP-01) — 지금 등록된 부서·이행 과제는 모두 여기에 붙어 있다. */
export const HQ_WP = "WP-01";
export async function workplace(): Promise<Row> {
  const all = await readTable("usb1_workplace", "wp_id");
  const w = all.find((r) => r.wp_id === HQ_WP) || all[0];
  return w || { wp_id: HQ_WP, wp_name: "용인시청 본청", addr: "경기도 용인시 처인구 중부대로 1199", ind_class: "공공행정", ind_code: "84113" };
}

/**
 * 사업장 20곳(09-24 사용자: 큰 근무 장소 20곳 · 전부 확인필요) — 조사 보고서 (조사)용인시_사업장_후보_20260924 의 누리집 표기.
 * 본청(WP-01) 밖 19곳에는 이행 과제가 없다(과제를 만들지 않았다). 사업장 단위는 용인시 확인 뒤 정한다.
 */
export const WP_KINDS = ["본청", "의회", "구청", "직속기관", "사업소", "직영시설"] as const;
export async function workplaces(): Promise<Row[]> {
  const rows = (await readTable("usb1_workplace", "wp_id")).filter((r) => r.deleted !== "Y");
  return [...rows].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}
/** 소속 근무 장소 76곳(도서관 · 보건지소 · 보건진료소 · 읍면동 행정복지센터) — 목록만, 의무·과제는 붙이지 않는다. */
export async function workSites(): Promise<Row[]> {
  const rows = await readTable("usb1_work_site", "site_id");
  return [...rows].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

/** 사업장 소속 부서 — D99(미지정) 는 뺀다. 역할 범위: 담당자는 자기 부서만, 관리자(mgr)는 안전총괄과 하위, 총괄·경영책임자는 전부. */
export async function wsDepts(role?: string): Promise<Row[]> {
  const all = (await depts()).filter((d: Row) => d.dept_id && d.dept_id !== "D99");
  const r = role || "gm";
  const mine = deptOf(r);
  if (r === "mgr") return all.filter((d: Row) => d.dept_id === mine || d.parent_dept_id === mine);
  if (mine) return all.filter((d: Row) => d.dept_id === mine);
  return all;
}

export async function staffMap() {
  const st = await staff();
  const byId = new Map(st.map((s: Row) => [s.staff_id, s]));
  const nameOnly = (sid?: string) => String(byId.get(sid || "")?.display_name || "").split(" ")[0];
  /** 부서 담당자(정담당) 이름 */
  const ownerOf = (deptId: string) => {
    const s = st.find((x: Row) => x.dept_id === deptId && x.duty_role === "정담당") || st.find((x: Row) => x.dept_id === deptId);
    return String(s?.display_name || "").split(" ")[0] || "-";
  };
  return { st, byId, nameOnly, ownerOf };
}

/** 직원 명부(검색용) — 이름·소속·연락처. 연락처는 명부에 없어 부서 대표 번호 규칙(031-324-2NN0/1)으로 채운다(가상). */
export async function staffPick(): Promise<{ name: string; org: string; phone: string; pos: string }[]> {
  const [st, dl] = await Promise.all([staff(), depts()]);
  const dn = new Map(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  return st
    .filter((s: Row) => s.dept_id)
    .map((s: Row) => {
      const [name, pos] = String(s.display_name).split(" ");
      const n = parseInt(String(s.dept_id).slice(1), 10) || 0;
      const k = String(s.staff_id).endsWith("-1") ? "0" : "1";
      return { name, pos: pos || "", org: String(dn.get(s.dept_id) || ""), phone: `031-324-2${String(n).padStart(2, "0")}${k}` };
    });
}

/* ── 공중이용시설·공중교통수단(fc) ───────────────────────────── */
export const facilityBucket = (gbn: string) =>
  IAQ.has(gbn) ? "실내공기질 시설" : (FACILITY_TYPES as readonly string[]).includes(gbn) && gbn !== "전체" ? gbn : "기타";

export async function fcTargets(role?: string): Promise<Row[]> {
  const mine = deptOf(role);
  const r = role || "gm";
  const dl = await depts();
  const under = new Set(dl.filter((d: Row) => d.parent_dept_id === mine || d.dept_id === mine).map((d: Row) => d.dept_id));
  const ok = (dept: string) => (!mine ? true : r === "mgr" ? under.has(dept) : dept === mine);
  const assets = assetSeed().filter((a) => ok(a.dept_id)).map((a) => ({
    id: a.asset_id, name: a.asset_name, gbn: a.asset_gbn, bucket: facilityBucket(a.asset_gbn), kind: a.asset_kind,
    cls: a.asset_class, grade: a.safety_grade, addr: a.addr, dept_id: a.dept_id, completed: a.completed_ymd,
    sapa: a.sapa_l2_result, sapa_basis: a.sapa_basis, need: a.need_data, src: "asset",
    subj: a.subject_tier || "", subj_name: a.subject_name || "",   // 09-24 관리주체(축1) — 용인시 · 용인도시공사 · 타기관 · 확인필요
    mclass: a.mgmt_class || "", mlaws: a.mgmt_laws || "", consign: a.consign || "",          // 09-24 관리 구분(중처법 공중이용시설 · 관계법령 관리시설) · 관리 근거 법령
  }));
  const tr = (await readTable("usb1_transport", "tr_id")).filter((t) => ok(t.dept_id)).map((t) => ({
    id: t.tr_id, name: t.tr_name, gbn: TRANSPORT, bucket: TRANSPORT, kind: t.tr_kind, cls: "", grade: "", addr: t.addr,
    dept_id: t.dept_id, completed: "", sapa: "해당", sapa_basis: t.basis, need: "", src: "transport", law_family: t.law_family, note: t.note, subj: "용인시", subj_name: "", mclass: "중처법 공중이용시설", mlaws: t.law_family || "",
  }));
  return [...tr, ...assets];
}

/** 관리대상 유형(자산 → target_code) 과 그 유형에 걸린 우리 의무 수(duty_class, 중대시민재해 F). */
export async function targetTypesOf(assetId: string) {
  const codes = [...new Set(assetMapSeed().filter((m) => m.asset_id === assetId).map((m) => m.target_code))];
  const all = await duties({ area: "F", limit: 100000 });
  return codes.map((c) => {
    const rows = all.filter((d) => d.target_code === c);
    return { code: c, name: rows[0]?.target_name || c, n: rows.length, y: rows.filter((d) => d.yongin_mark === "Y").length };
  });
}

/** 시설물 제원 — 시설구분마다 칸이 다르다. need = 자산 대장 need_data(중대시민재해 판정에 필요한 자료) 와 맞춰 볼 낱말. */
export const SPEC_FIELDS: Record<string, { key: string; label: string; need?: string[] }[]> = {
  교량: [
    { key: "len", label: "연장(m)", need: ["연장"] }, { key: "width", label: "폭(m)" },
    { key: "maxspan", label: "최대경간장(m)", need: ["최대경간장"] }, { key: "spans", label: "경간 수" },
    { key: "super", label: "상부구조형식", need: ["상부구조형식"] }, { key: "roadgrade", label: "도로등급", need: ["도로등급"] },
  ],
  터널: [
    { key: "len", label: "연장(m)", need: ["연장"] }, { key: "lanes", label: "차로수", need: ["차로수"] },
    { key: "width", label: "폭(m)" }, { key: "height", label: "높이(m)" }, { key: "form", label: "터널 형식" },
    { key: "roadgrade", label: "도로등급", need: ["도로등급"] },
  ],
  건축물: [
    { key: "area", label: "연면적(㎡)", need: ["연면적"] }, { key: "floors_up", label: "층수(지상)", need: ["층수"] },
    { key: "floors_down", label: "층수(지하)" }, { key: "use", label: "주용도", need: ["용도"] },
    { key: "struct", label: "구조형식" }, { key: "edu", label: "교육시설 부대시설 여부", need: ["교육시설 부대시설 여부"] },
  ],
  옹벽: [
    { key: "height", label: "노출높이(m)", need: ["노출높이"] }, { key: "hlen", label: "수평연장(m)", need: ["수평연장"] },
    { key: "len", label: "연장(m)", need: ["연장"] }, { key: "form", label: "옹벽 형식" },
  ],
  절토사면: [
    { key: "height", label: "노출높이(m)", need: ["노출높이"] }, { key: "hlen", label: "수평연장(m)", need: ["수평연장"] },
    { key: "slope", label: "사면 경사(°)" }, { key: "form", label: "보강 공법" },
  ],
  하천: [
    { key: "national", label: "국가하천 여부", need: ["국가하천 여부"] }, { key: "form", label: "시설 형식(수문·통문 등)" },
    { key: "gates", label: "문 수(련)" }, { key: "river", label: "하천명" },
  ],
  상하수도: [
    { key: "cap", label: "1일 최대처리용량(톤)", need: ["1일 최대처리용량"] }, { key: "method", label: "처리 방식" },
    { key: "pipe", label: "관로 연장(m)" }, { key: "area_served", label: "급수·처리 구역" },
  ],
  댐: [
    { key: "storage", label: "총저수용량(㎥)", need: ["총저수용량"] }, { key: "damtype", label: "댐 종류", need: ["댐 종류"] },
    { key: "height", label: "높이(m)" }, { key: "len", label: "마루 길이(m)" },
  ],
  기타: [{ key: "len", label: "연장(m)", need: ["연장"] }, { key: "form", label: "형식" }, { key: "size", label: "규모" }],
  [TRANSPORT]: [
    { key: "route_len", label: "노선 연장(km)" }, { key: "stations", label: "정거장 수" },
    { key: "cars", label: "차량 편성 수" }, { key: "op", label: "운영 형태(직영·위탁)" }, { key: "operator", label: "운영 기관" },
  ],
};
export const specFieldsOf = (gbn: string) => SPEC_FIELDS[gbn] || SPEC_FIELDS["기타"];
/** 이 칸이 판정에 필요한 자료인가 — need_data 「연장·최대경간장·상부구조형식」 을 낱말로 쪼개 맞춘다. */
export function isNeeded(need: string | undefined, f: { need?: string[] }) {
  if (!need || !f.need) return false;
  const toks = need.split("·").map((s) => s.replace(/\(.*?\)/g, "").trim());
  return f.need.some((w) => toks.some((t) => t === w || t.startsWith(w) || w.startsWith(t)));
}

/* ── 원료·제조물(mt) ─────────────────────────────────────── */
export async function mtTargets(role?: string): Promise<Row[]> {
  const mine = deptOf(role);
  const r = role || "gm";
  const dl = await depts();
  const under = new Set(dl.filter((d: Row) => d.parent_dept_id === mine || d.dept_id === mine).map((d: Row) => d.dept_id));
  const rows = await readTable("material_item", "item_id");
  return rows
    .filter((m) => m.deleted !== "Y")
    .filter((m) => (!mine ? true : r === "mgr" ? under.has(m.dept_id) : m.dept_id === mine));
}
/** 원료·제조물 세부정보 칸. */
export const MT_FIELDS: { key: string; label: string }[] = [
  { key: "volume", label: "연간 생산·공급 규모" },
  { key: "receiver", label: "공급·제공 대상" },
  { key: "place", label: "생산·보관 장소" },
  { key: "qc", label: "품질·안전 검사 주기" },
  { key: "supplier", label: "원료 구입처(공급 업체)" },
];

/* ── 기본정보 기록(usb1_basic) ──────────────────────────────── */
export const J = <T,>(s: any, d: T): T => {
  if (s && typeof s === "object") return s as T;
  try { return s ? (JSON.parse(String(s)) as T) : d; } catch { return d; }
};
export async function basics(): Promise<Row[]> {
  return (await readTable("usb1_basic", "basic_id")).filter((r) => r.state !== "삭제");
}
/** 대상 하나의 기준일자 이력(새것부터) · 고른 날짜(없으면 최신)의 기록. */
export async function basicOf(t: TrackKey, id: string, date?: string) {
  const all = (await basics()).filter((r) => r.track === t && r.target_id === id);
  const hist = [...all].sort((a, b) => (a.base_date < b.base_date ? 1 : -1));
  const cur = date ? hist.find((r) => r.base_date === date) : hist[0];
  return { hist, cur };
}
/** 입력 여부 — 기록이 하나라도 있으면 「입력」. */
export async function inputSet(t: TrackKey): Promise<Set<string>> {
  return new Set((await basics()).filter((r) => r.track === t).map((r) => r.target_id));
}

/* ── 도급·용역·위탁(SCR-030~033) ─────────────────────────── */
/** 계약 목록 — 원 자료(contract) 위에 화면에서 등록·수정한 것(usb1_contract)을 같은 id 로 덮는다. */
export async function contractList(role?: string): Promise<Row[]> {
  const base = await contracts();
  const mine = await readTable("usb1_contract", "contract_id");
  const m = new Map<string, Row>();
  base.forEach((c: Row) => m.set(c.contract_id, c));
  // 덮개의 새 줄이 앞에 온다 — 같은 id 는 가장 앞(최신) 줄을 쓴다
  [...mine].reverse().forEach((c) => m.set(c.contract_id, { ...(m.get(c.contract_id) || {}), ...c }));
  let rows = [...m.values()].filter((c) => c.deleted !== "Y");
  const d = deptOf(role);
  const r = role || "gm";
  if (d) {
    const dl = await depts();
    const under = new Set(dl.filter((x: Row) => x.parent_dept_id === d || x.dept_id === d).map((x: Row) => x.dept_id));
    rows = rows.filter((c) => (r === "mgr" ? under.has(c.dept_id) : c.dept_id === d));
  }
  return rows;
}
export async function contractOne(id: string): Promise<Row | null> {
  return (await contractList("gm")).find((c) => c.contract_id === id) || null;
}

/** SCR-032 위험장소·작업 — 산업안전보건법 시행령 제11조 · 시행규칙 제6조 원문(usb1_hazard_place). */
export async function hazardPlaces(): Promise<Row[]> {
  return readTable("usb1_hazard_place", "place_code");
}
/** 유해·위험요인 기록(contract_hazard_map 의 HZ 코드) → 위험장소 항목 짚기. 선택이 아니라 「참고」로만 보인다. */
export const HZ_TO_PLACE: Record<string, string[]> = {
  HZ01: ["P03", "P07"], HZ02: ["P10"], HZ05: ["P09", "P13"], HZ06: ["P15"], HZ08: ["P01", "P02"],
  HZ09: ["P12", "P16"], HZ10: ["P20"], HZ14: ["P19"],
};

/** SCR-033 관리의무 — 명세 표 4줄 그대로. 근거는 중대재해처벌법 시행령 제4조제9호(DOC-000005). */
export const CDUTY: { code: string; group: string; sub?: string; basis: string; unit: string; ccp?: string }[] = [
  { code: "C1", group: "1. 수급인 선정 기준 마련 여부 (안전보건수준 평가표)", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호가목", unit: "UNIT-0004835", ccp: "E4-9-GA" },
  { code: "C2", group: "2. 안전보건관리비 기준 마련 여부", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호나목", unit: "UNIT-0004836", ccp: "E4-9-NA" },
  { code: "C3A", group: "3. 안전보건수준 평가", sub: "수급인 선정 시 안전관리수준평가 실시 여부", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호", unit: "UNIT-0004833" },
  { code: "C3B", group: "3. 안전보건수준 평가", sub: "안전관리비 편성 및 집행점검 여부", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호", unit: "UNIT-0004833" },
];
export const CSTATUS = ["이행완료", "보완필요", "미이행"] as const;
/** 원 자료 상태 → 준수여부 3택. 「해당없음」은 고르지 않은 채로 둔다. */
export const toStatus = (s?: string) => (s === "이행" || s === "이행완료" || s === "점검완료" ? "이행완료" : s === "보완필요" || s === "조치필요" ? "보완필요" : s === "미이행" ? "미이행" : "");

export async function contractDutyState(c: Row) {
  const saved = (await readTable("usb1_contract_duty", "cd_id")).filter((r) => r.contract_id === c.contract_id);
  const ccp = (await readTable("contract_compliance", "cc_id")).filter((r) => r.contract_id === c.contract_id);
  return CDUTY.map((d) => {
    const s = saved.find((r) => r.item_code === d.code);
    if (s) return { ...d, status: s.status || "", files: J<{ name: string; url: string }[]>(s.files, []) };
    // 원 자료에서 처음 값: C1·C2 는 이행 점검 기록(contract_compliance), C3A 는 수급인 평가 실시 여부(evaluation_done)
    let status = "";
    let files: { name: string; url: string }[] = [];
    if (d.ccp) {
      const x = ccp.find((r) => r.item_code === d.ccp);
      status = toStatus(x?.status);
      if (x?.evidence_name) files = [{ name: x.evidence_name, url: "" }];
    } else if (d.code === "C3A") {
      status = c.evaluation_done === "Y" ? "이행완료" : c.evaluation_done === "N" ? "미이행" : "";
    }
    return { ...d, status, files };
  });
}

/** 부서 이름표. */
export async function deptNames() {
  return new Map((await depts()).map((d: Row) => [d.dept_id, d.dept_name]));
}
