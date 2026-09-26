/**
 * [400 · 교육자료 버전] 묶음 B2 — 법 의무사항(SCR-034·035) 공용 도우미.
 *  · 트랙별 「법 의무사항 이행 시기」 항목 마스터(참고 명세 SCR-035 표 원문 — 공중이용시설 트랙)
 *  · 트랙별 대상 목록(사업장 = 용인시 사업장 20곳(09-25 — 과제는 본청에만) · 공중이용시설 = 시설물 대장 · 원료·제조물 = 원료·제조물 대장)
 *  · 대상별 관계 법령 = **우리 의무 목록 duties({area})** 을 법령별로 묶은 것
 *  · 저장 기록(usb2_timing) — 저장할 때마다 한 줄을 쌓고, 대상별 가장 최근 줄을 읽는다(되돌릴 수 있게 지우지 않는다).
 */
import "server-only";
import { duties, assets, assetMapSeed, depts, staff, readTable, type Row } from "@/lib/data";
import type { TrackKey } from "@/lib/us/tracks";
import { workplaces, HQ_WP, WP_KINDS } from "../targets/_lib";   // 09-25 사용자: 사업장 20곳 기준

/** 사업장 구분(목록 거르기) — 관리대상 현황의 사업장 구분과 같다. */
export const WP_TYPES = ["전체", ...WP_KINDS];

/* ── 이행 시기 항목 마스터 ───────────────────────────────────────────── */
export type Item = {
  id: string;
  g: 1 | 2 | 3 | 4;          // ①~④
  step?: string;             // 시행령 열(1) 안전인력 확보 …)
  duty?: string;             // 의무사항 열
  sub?: string;              // 의무사항 2단(정기안전점검 …)
  sub2?: string;             // 의무사항 3단(상반기·하반기)
  input: "ym" | "half";      // 이행 시기 입력유형 — 연-월 / 상·하반기(명세 00 §7 · SCR-035)
  del?: boolean;             // 🗑 — 대상마다 뺄 수 있는 항목(명세: 사용자 추가/삭제 가능한 동적 항목으로 추정)
};

// SCR-035 원문 그대로(법령 이름만 줄이지 않고 적는다 — 사용자 규칙)
const FC: Item[] = [
  { id: "f1", g: 1, step: "1) 안전인력 확보", duty: "필요한 인력 확보", input: "ym" },
  { id: "f2", g: 1, step: "2) 안전예산 편성·집행", duty: "필요한 예산 편성·집행", input: "ym" },
  { id: "f3a", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "시설물의 안전 및 유지관리에 관한 특별법 상 안전점검 등", sub: "정기안전점검", sub2: "상반기", input: "ym" },
  { id: "f3b", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "시설물의 안전 및 유지관리에 관한 특별법 상 안전점검 등", sub: "정기안전점검", sub2: "하반기", input: "ym" },
  { id: "f3c", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "시설물의 안전 및 유지관리에 관한 특별법 상 안전점검 등", sub: "정밀안전점검", input: "ym", del: true },
  { id: "f3d", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "시설물의 안전 및 유지관리에 관한 특별법 상 안전점검 등", sub: "정밀안전진단", input: "ym", del: true },
  { id: "f3e", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "시설물의 안전 및 유지관리에 관한 특별법 상 안전점검 등", sub: "성능평가", input: "ym", del: true },
  { id: "f3f", g: 1, step: "3) 안전점검 계획 수립·수행", duty: "그 외 안전·보건 관계 법령에 따른 안전점검 등", input: "half" },
  { id: "f4a", g: 1, step: "4) 안전계획 수립·이행", duty: "시설물 안전 및 유지관리계획", input: "ym", del: true },
  { id: "f4b", g: 1, step: "4) 안전계획 수립·이행", duty: "중대시민재해 안전계획", input: "ym", del: true },
  { id: "f5a", g: 1, step: "5) 재해예방업무처리절차", duty: "유해·위험요인의 확인·점검", input: "ym" },
  { id: "f5b", g: 1, step: "5) 재해예방업무처리절차", duty: "유해·위험요인 발견시 신고 및 개선", input: "ym" },
  { id: "f5c", g: 1, step: "5) 재해예방업무처리절차", duty: "중대시민재해 발생시 대응 조치", input: "ym" },
  { id: "f5d", g: 1, step: "5) 재해예방업무처리절차", duty: "비상대피훈련", input: "ym", del: true },
  { id: "f6", g: 2, input: "half" },
  { id: "f7", g: 3, input: "half" },
  { id: "f8a", g: 4, step: "1) 관계 법령상 의무이행", duty: "안전·보건 관계 법령에 따른 의무이행", input: "ym" },
  { id: "f8b", g: 4, step: "2) 법정교육 이수", duty: "안전·보건 관계 법령에 따른 교육 이수", input: "ym" },
];

// 사업장 트랙 — 명세에 이 화면 컷이 없다(SCR-035 는 공중이용시설만). 사업장 의무 단계(명세 04 좌측 메뉴)로 같은 모양을 만들었다.
// 반기 항목은 시행령 제4조제3호·제5호·제7호의 「반기 1회 이상」을 따랐다. // TODO: 확인(사업장 항목 구성)
const WS: Item[] = [
  { id: "w1", g: 1, step: "1) 안전·보건 목표 및 경영방침 설정", duty: "안전·보건 목표 및 경영방침 설정", input: "ym" },
  { id: "w2", g: 1, step: "2) 안전·보건·총괄·관리 전담 조직 설치", duty: "전담 조직 설치·운영", input: "ym" },
  { id: "w3", g: 1, step: "3) 안전보건관계자 배치", duty: "안전관리자·보건관리자 등 배치", input: "ym" },
  { id: "w4a", g: 1, step: "4) 유해·위험요인 확인 및 개선 절차 마련(위험성평가)", duty: "유해·위험요인 확인·개선 점검", sub: "상반기", input: "ym" },
  { id: "w4b", g: 1, step: "4) 유해·위험요인 확인 및 개선 절차 마련(위험성평가)", duty: "유해·위험요인 확인·개선 점검", sub: "하반기", input: "ym" },
  { id: "w5", g: 1, step: "5) 안전예산 편성·집행", duty: "필요한 예산 편성·집행", input: "ym" },
  { id: "w6a", g: 1, step: "6) 안전보건관계자 업무수행", duty: "업무수행 평가·관리", sub: "상반기", input: "ym" },
  { id: "w6b", g: 1, step: "6) 안전보건관계자 업무수행", duty: "업무수행 평가·관리", sub: "하반기", input: "ym" },
  { id: "w7a", g: 1, step: "7) 종사자 의견 청취 및 개선", duty: "의견 청취 및 개선방안 이행 점검", sub: "상반기", input: "ym" },
  { id: "w7b", g: 1, step: "7) 종사자 의견 청취 및 개선", duty: "의견 청취 및 개선방안 이행 점검", sub: "하반기", input: "ym" },
  { id: "w8a", g: 1, step: "8) 비상조치계획 수립 및 이행", duty: "비상조치계획(매뉴얼) 마련", input: "ym" },
  { id: "w8b", g: 1, step: "8) 비상조치계획 수립 및 이행", duty: "비상대피훈련", input: "ym", del: true },
  { id: "w9", g: 2, input: "half" },
  { id: "w10", g: 3, input: "half" },
  { id: "w11a", g: 4, step: "1) 관계 법령상 의무이행", duty: "안전·보건 관계 법령에 따른 의무이행", input: "ym" },
  { id: "w11b", g: 4, step: "2) 법정교육 이수", duty: "안전·보건 관계 법령에 따른 교육 이수", input: "ym" },
];

// 원료·제조물 트랙 — 이 화면 컷도 명세에 없다. 원료·제조물 의무 단계(명세 06·07 좌측 메뉴)로 만들었다. // TODO: 확인(원료·제조물 항목 구성)
const MT: Item[] = [
  { id: "m1", g: 1, step: "1) 안전인력 확보", duty: "필요한 인력 확보", input: "ym" },
  // 09-25 사용자: 명세 오기 「예산·편성·집행」 → 「예산 편성·집행」(몫 Y · id 「m2」는 그대로)
  { id: "m2", g: 1, step: "2) 중대시민재해 예방 예산 편성·집행", duty: "필요한 예산 편성·집행", input: "ym" },
  { id: "m3a", g: 1, step: "3) 재해예방업무처리 절차 마련·이행", duty: "유해·위험요인의 주기적인 점검", sub: "상반기", input: "ym" },
  { id: "m3b", g: 1, step: "3) 재해예방업무처리 절차 마련·이행", duty: "유해·위험요인의 주기적인 점검", sub: "하반기", input: "ym" },
  { id: "m3c", g: 1, step: "3) 재해예방업무처리 절차 마련·이행", duty: "유해·위험요인 발견시 신고 및 조치", input: "ym" },
  { id: "m3d", g: 1, step: "3) 재해예방업무처리 절차 마련·이행", duty: "중대시민재해 발생시 사후조치", input: "ym", del: true },
  { id: "m4", g: 2, input: "half" },
  { id: "m5", g: 3, input: "half" },
  { id: "m6a", g: 4, step: "1) 관계 법령 의무이행 조치", duty: "안전·보건 관계 법령에 따른 의무이행", input: "ym" },
  { id: "m6b", g: 4, step: "2) 법정교육 이수", duty: "안전·보건 관계 법령에 따른 교육 이수", input: "ym" },
];
export const ITEMS: Record<TrackKey, Item[]> = { ws: WS, fc: FC, mt: MT };

/** ①~④ 법 열 글자(명세 SCR-035 원문 · 트랙별 단계 이름) */
export const LAW_COL: Record<TrackKey, Record<1 | 2 | 3 | 4, string>> = {
  ws: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지대책 수립 및 이행", 3: "개선·시정 등을 명한 사항 이행", 4: "관계 법령상 의무이행" },
  fc: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지대책 수립 및 이행", 3: "개선·시정 등을 명한 사항 이행", 4: "관계 법령상 의무이행" },
  mt: { 1: "안전보건관리체계 구축 및 이행", 2: "재해발생시 재발방지대책 수립 및 이행", 3: "중앙행정기관, 지자체 개선·시정 사항 이행", 4: "관계 법령 의무이행 조치" },
};

/* ── 시설구분(명세 공통 코드 FACILITY_TYPE) ───────────────────────────── */
export const FACILITY_TYPES = ["전체", "건축물", "상하수도", "옹벽", "하천", "터널", "교량", "절토사면", "저수지", "기타"];   // 09-24 저수지(관계법령 관리시설) 추가
/** 시설물 대장의 구분(asset_gbn) → 시설구분. 대장 값이 이미 명세 코드와 같다(댐만 하천으로 모은다). */
export const facilityOf = (gbn: string) => (gbn === "댐" ? "하천" : FACILITY_TYPES.includes(gbn) ? gbn : "기타");

/* ── 대상 ─────────────────────────────────────────────────────────── */
export const HQ_ID = "HQ";
export const HQ_NAME = "용인시청 본청";  // 사용자 결정(09-24): 용인시의 「사업장」은 본청 청사 하나
export const HQ_ADDR = "경기도 용인시 처인구 중부대로 1199";
/** 본청(사업장)에 걸 관리대상 유형 — 사업장·종사자 + 청사에 있는 업무시설·승강기·전기설비·소방시설. // TODO: 확인 */
export const HQ_TARGETS = ["TG26", "TG13", "TG16", "TG17", "TG20"];

/** wp_id — 사업장 트랙의 사업장 번호(usb1_workplace). 본청 밖 사업장이면 wp_state(확인 상태)도 싣는다. */
export type Target = { id: string; name: string; addr: string; kind: string; dept_id: string; dept: string; owner: string; codes: string[]; laws?: string[]; wp_id?: string; wp_state?: string; verdict?: string; reason?: string; basis?: string };   // verdict·reason·basis = 원료·제조물 해당 판단(09-26)
/** 사업장 트랙에서 본청 밖 사업장인가(09-25 — 이행 과제가 아직 없다) */
export const isOtherWp = (t: Target) => !!t.wp_id && t.id !== HQ_ID;

/** 부서의 정담당(담당자 칸) */
async function ownerMap() {
  const [st, dl] = await Promise.all([staff(), depts()]);
  const dn = new Map(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const own = new Map<string, string>();
  for (const s of st) if (s.duty_role === "정담당" && !own.has(s.dept_id)) own.set(s.dept_id, String(s.display_name));
  return { dn, own };
}

/** 트랙별 대상 목록. role 이 현업 담당자(road·water)면 자기 부서 것만. */
export async function targetsOf(track: TrackKey, dept = ""): Promise<Target[]> {
  const { dn, own } = await ownerMap();
  if (track === "ws") {
    // 09-25 사용자: 용인시 사업장 20곳을 기준으로. 본청은 지금 그대로(대상 id "HQ" — 저장 기록 키를 바꾸지 않는다).
    //   나머지 19곳은 대상 id = wp_id · 부서 없음 · 관리대상 유형 없음(사업장 단위와 소속 부서는 용인시 확인 뒤 정한다).
    //   09-26 사용자: 「대상별 의무사항 › 사업장에 본청 하나밖에 없다 — 다른 사업장도 모두 올라와야」 → 역할과 상관없이 20곳 모두 보인다
    //   (전: 부서가 고정된 역할(담당자·관리자)은 본청만).
    const hq: Target = { id: HQ_ID, name: HQ_NAME, addr: HQ_ADDR, kind: "본청", dept_id: "D01", dept: String(dn.get("D01") || ""), owner: own.get("D01") || "", codes: HQ_TARGETS, wp_id: HQ_WP };
    const wps = await workplaces();
    if (!wps.length) return [hq];
    return wps.map((w) => w.wp_id === HQ_WP
      ? { ...hq, kind: String(w.wp_kind || "본청") }
      : { id: String(w.wp_id), name: String(w.wp_name || w.wp_id), addr: String(w.addr || ""), kind: String(w.wp_kind || "사업장"), dept_id: "", dept: "", owner: "", codes: [], wp_id: String(w.wp_id), wp_state: String(w.confirm_state || "확인필요") });
  }
  if (track === "mt") {
    const items = await readTable("material_item", "item_id");
    return items
      .filter((m) => !dept || m.dept_id === dept)
      .map((m) => ({
        id: m.item_id, name: m.item_name, addr: "", kind: "원료·제조물", dept_id: m.dept_id,
        dept: String(dn.get(m.dept_id) || ""), owner: own.get(m.dept_id) || "", codes: [],
        laws: String(m.related_law || "").split(/[·,;]/).map((x: string) => x.replace(/\(.*?\)/g, "").trim()).filter(Boolean),
        verdict: String(m.verdict || ""), reason: String(m.reason || ""), basis: String(m.basis_ref || ""),   // 09-26 사용자: 비해당 판단은 목록에서 따로
      }));
  }
  // 공중이용시설 — 시설물 대장. 중대재해처벌법 제2조제4호 단서 등으로 공중이용시설에서 빠진 시설(판단 「제외」)은 넣지 않는다.
  const al = (await assets({ limit: 100000 })).filter((a) => a.sapa_l2_result !== "제외" && (!dept || a.dept_id === dept));
  const codes = new Map<string, string[]>();
  for (const m of assetMapSeed()) codes.set(m.asset_id, [...(codes.get(m.asset_id) || []), m.target_code]);
  return al.map((a) => ({
    id: a.asset_id, name: a.asset_name, addr: a.addr || "", kind: facilityOf(a.asset_gbn), dept_id: a.dept_id,
    dept: String(dn.get(a.dept_id) || ""), owner: own.get(a.dept_id) || "", codes: codes.get(a.asset_id) || [],
  }));
}

/* ── 저장 기록 ────────────────────────────────────────────────────── */
export type Rec = { vals: Record<string, string>; laws: Record<string, { on?: boolean; when?: string; extra?: boolean }>; hidden: string[]; saved_at?: string; by?: string };
const parse = (s: any, d: any) => { try { return s ? JSON.parse(String(s)) : d; } catch { return d; } };

/** 대상별 최근 기록(appendRow 는 새 줄을 앞에 쌓는다 → 처음 만난 줄이 최근). */
export async function records(track: TrackKey): Promise<Map<string, Rec>> {
  const rows = await readTable("usb2_timing", "rec_id");
  const m = new Map<string, Rec>();
  for (const r of rows) {
    if (r.track !== track || m.has(r.target_id)) continue;
    m.set(r.target_id, {
      vals: parse(r.vals, {}), laws: parse(r.laws, {}),
      hidden: String(r.hidden || "").split(";").filter(Boolean), saved_at: r.saved_at, by: r.by,
    });
  }
  return m;
}
export const hasInput = (r?: Rec) => !!r && (Object.values(r.vals).some(Boolean) || Object.values(r.laws).some((x) => x && (x.on || x.when)));

/* ── 대상별 관계 법령(우리 의무 목록) ─────────────────────────────────── */
export const LAYER: Record<string, string> = {
  "법률": "법률", "대통령령(시행령)": "시행령", "시행령": "시행령", "부령(시행규칙)": "시행규칙", "시행규칙": "시행규칙",
  "고시": "고시", "훈령": "훈령", "대통령훈령": "훈령", "예규": "예규",
};
const LAYER_ORDER = ["법률", "시행령", "시행규칙", "고시", "훈령", "예규"];
export const kindOf = (layer: string) => LAYER[layer] || layer || "-";

export type LawGroup = { law: string; kinds: string[]; n: number; y: number; c: number; docs: string[]; rows: Row[] };

/** 의무 행들을 법령(법 가족)별로 묶는다 — 법령구분은 그 안의 문서 층(법률·시행령·시행규칙·고시…). */
export function groupByLaw(rows: Row[]): LawGroup[] {
  const m = new Map<string, LawGroup>();
  for (const r of rows) {
    const k = r.law || r.doc || "-";
    const g = m.get(k) || { law: k, kinds: [], n: 0, y: 0, c: 0, docs: [], rows: [] };
    g.n++;
    if (r.yongin_mark === "Y") g.y++; else g.c++;
    const kd = kindOf(r.layer);
    if (!g.kinds.includes(kd)) g.kinds.push(kd);
    if (r.doc && !g.docs.includes(r.doc)) g.docs.push(r.doc);
    g.rows.push(r);
    m.set(k, g);
  }
  for (const g of m.values()) g.kinds.sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
  return [...m.values()].sort((a, b) => b.y - a.y || b.n - a.n);
}

/** 대상 하나에 걸리는 의무(우리 의무 목록) — 관리대상 유형으로(원료·제조물은 관련 법령으로) 고른다. */
export async function dutiesForTarget(track: TrackKey, t: Target): Promise<Row[]> {
  const area = track === "ws" ? "I" : track === "fc" ? "F" : "M";
  const all = await duties({ area, limit: 1000000 });
  if (track === "mt") {
    const want = new Set(t.laws || []);
    return all.filter((d) => want.has(d.law));
  }
  const want = new Set(t.codes);
  return all.filter((d) => want.has(d.target_code));
}

export const areaOf = (t: TrackKey) => (t === "ws" ? "I" : t === "fc" ? "F" : "M");

/** 관리대상 유형 이름의 법령 약칭을 풀어 쓴다(사용자 규칙 — 법령 이름을 줄여 쓰지 않는다). 의무 목록 원본은 건드리지 않는다. */
export const tname = (s: string) => String(s || "").replace(/\(시설물안전법\)/g, "(시설물의 안전 및 유지관리에 관한 특별법)");
