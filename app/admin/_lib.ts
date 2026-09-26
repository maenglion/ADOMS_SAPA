/**
 * [400 · 교육자료 버전] 묶음 B2 — 관리자(SCR-021~025) 공용 도우미.
 *  · 담당자 권한지정(usb2_role) — 재해유형(중대산업재해 ind / 중대시민재해 civ) × 권한 1000~4000(명세 00 §4-1)
 *  · 담당자 관리대상 지정(usb2_assign) — 담당자별 관리대상 목록
 *  · 기본정보(usb2_basic) · 관계 법령 등록(usb2_law)
 * 모든 표는 저장할 때마다 한 줄을 쌓고(appendRow) 키별 가장 최근 줄을 읽는다 — 지우지 않고 되돌릴 수 있다.
 */
import "server-only";
import { staff, depts, assets, duties, readTable, type Row } from "@/lib/data";
import { HQ_NAME, HQ_ADDR, facilityOf } from "../law/_lib";

export type Dis = "ind" | "civ";
export const disOf = (s?: string): Dis => (s === "civ" ? "civ" : "ind");
export const DIS_LABEL: Record<Dis, string> = { ind: "중대산업재해", civ: "중대시민재해" };

/** 권한 레벨(명세 00 §4-1 · SCR-004) — 같은 코드가 재해 유형에 따라 다른 조직 단위를 뜻한다. */
export const LEVELS: Record<Dis, Record<number, string>> = {
  ind: { 1000: "중대재해예방팀 총괄", 2000: "사업장 총괄", 3000: "하위 사업장 총괄(또는 부서담당자)", 4000: "부서 담당자" },
  civ: { 1000: "중대재해예방팀 총괄", 2000: "실·국·본부 총괄", 3000: "부서 총괄", 4000: "시설물 담당자" },
};
export const LEVEL_GROUP = (lv: number) => (lv <= 3000 ? "총괄 권한" : "대상별 담당자 권한");

/** 연락처 — 직원 명부에 전화가 비어 있어 내선 번호 모양으로 보인다(가상). */
export function phoneOf(s: Row) {
  if (s.phone) return String(s.phone);
  const m = String(s.staff_id || "").match(/^S([DM])(\d\d)-(\d)$/);
  return m ? `내선 ${m[1] === "M" ? 5 : 3}${m[2]}${m[3]}` : "-";
}

/** 소속에 맞춘 기본 권한(추가할 때 권한을 고르지 않으면) */
export function defaultLevel(s: Row, dRole: string) {
  if (s.dept_id === "D01") return 1000;
  if (s.dept_id === "D02") return 2000;
  return s.duty_role === "부담당" ? 4000 : dRole === "현업" ? 3000 : 4000;
}

export type People = Row & { name: string; dept: string; phone: string; dept_role: string };
export async function people(): Promise<People[]> {
  const [st, dl] = await Promise.all([staff(), depts()]);
  const dm = new Map(dl.map((d: Row) => [d.dept_id, d]));
  return st
    .filter((s: Row) => s.staff_id !== "CEO-1")
    .map((s: Row) => ({ ...s, name: String(s.display_name || ""), dept: String(dm.get(s.dept_id)?.dept_name || ""), dept_role: String(dm.get(s.dept_id)?.dept_role || ""), phone: phoneOf(s) }));
}

/** 가장 최근 줄만(키별) */
function latest(rows: Row[], key: (r: Row) => string) {
  const m = new Map<string, Row>();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, r); }
  return m;
}

export type Grant = { rid: string; disaster: Dis; staff_id: string; level: number; kind: string; at: string; p: People };
/** 재해유형별 지정 현황(지정완료 목록) */
export async function grants(d: Dis): Promise<Grant[]> {
  const [rows, ps] = await Promise.all([readTable("usb2_role", "rid"), people()]);
  const pm = new Map(ps.map((p) => [p.staff_id, p]));
  return [...latest(rows, (r) => `${r.disaster}|${r.staff_id}`).values()]
    .filter((r) => r.disaster === d && r.state === "on" && pm.has(r.staff_id))
    .map((r) => ({ rid: `${r.disaster}|${r.staff_id}`, disaster: d, staff_id: r.staff_id, level: Number(r.level) || 4000, kind: r.kind || "정", at: r.at, p: pm.get(r.staff_id)! }))
    .sort((a, b) => a.level - b.level || a.staff_id.localeCompare(b.staff_id));
}
export const kindLabel = (d: Dis, g: { level: number; kind: string }) => `${LEVELS[d][g.level] || g.level}${g.kind === "부" ? "(부)" : ""}`;

/* ── 관리대상(지정 대상) ─────────────────────────────────────────── */
export type Obj = { id: string; site: string; name: string; addr: string; dept_id: string; kind?: string };
/** 중대산업재해 = 사업장(용인시청 본청 하나 — 사용자 결정 09-24) 안의 부서 · 중대시민재해 = 시설물 대장 */
export async function objects(d: Dis): Promise<Obj[]> {
  if (d === "ind") {
    const dl = await depts();
    return dl.filter((x: Row) => x.dept_id !== "D99").map((x: Row) => ({ id: x.dept_id, site: HQ_NAME, name: x.dept_name, addr: HQ_ADDR, dept_id: x.dept_id }));
  }
  const al = await assets({ limit: 100000 });
  return al.map((a: Row) => ({ id: a.asset_id, site: facilityOf(a.asset_gbn), name: a.asset_name, addr: a.addr || "", dept_id: a.dept_id, kind: a.asset_kind }));
}

/** 담당자의 관리대상 — 저장한 것이 없으면 권한에 맞춘 기본값(총괄 1000·2000 = 전부 · 그 밖 = 자기 부서 것). */
export async function assignedOf(d: Dis, g: Grant, objs: Obj[]): Promise<{ ids: Set<string>; saved: boolean }> {
  const rows = await readTable("usb2_assign", "map_id");
  const hit = rows.find((r) => r.map_id === `${d}|${g.staff_id}`);
  if (hit) return { ids: new Set(String(hit.targets || "").split(";").filter(Boolean)), saved: true };
  const ids = g.level <= 2000 ? objs.map((o) => o.id) : objs.filter((o) => o.dept_id === g.p.dept_id).map((o) => o.id);
  return { ids: new Set(ids), saved: false };
}

/* ── 기본정보(SCR-023) ─────────────────────────────────────────── */
export const IND_CLASS: Record<string, string> = { 공공행정: "84113", 서비스업: "", 하수처리업: "", 보건업: "" }; // TODO: 확인(공공행정 외 업종분류 코드)
export const MGMT: { key: string; label: string; opts: string[] }[] = [
  { key: "rule", label: "안전보건관리규정 작성", opts: ["제정", "미제정"] },
  { key: "chief", label: "안전보건관리책임자", opts: ["지정", "미지정"] },
  { key: "safety_mgr", label: "안전관리자", opts: ["선임", "미선임"] },
  { key: "health_mgr", label: "보건관리자 (안전감독자)", opts: ["선임", "미선임"] },
  { key: "doctor", label: "산업보건의", opts: ["위촉", "미위촉"] },
  { key: "committee", label: "산업안전보건위원회", opts: ["구성", "미구성"] }, // TODO: 확인(명세 선택지 판독불확실)
  { key: "supervisor", label: "관리감독자", opts: ["지정", "미지정"] },
];
export async function basicOf(dept_id: string): Promise<Row | null> {
  const rows = await readTable("usb2_basic", "dept_id");
  return rows.find((r) => r.dept_id === dept_id) || null;
}

/* ── 관계 법령 등록(SCR-024·025) — 우리 의무 목록에서 ───────────────────── */
export const AREA_LABEL: Record<string, string> = { I: "사업장", F: "공중이용시설·공중교통수단", M: "원료·제조물" };
/** 관리대상 유형 → 시설 세분류(SCR-025 2차 라디오). 제1·2종 시설물·기관 전체는 모든 세분류에 걸친다(공통). */
const CAT: Record<string, string[]> = {
  TG01: ["상하수도"], TG02: ["상하수도"], TG03: ["교량", "터널"], TG04: ["하천"], TG05: ["옹벽", "절토사면"],
  TG07: ["건축물"], TG08: ["건축물"], TG09: ["건축물"], TG10: ["건축물"], TG11: ["건축물"], TG13: ["건축물"], TG15: ["건축물"],
  TG16: ["건축물"], TG20: ["건축물"], TG30: ["건축물"], TG34: ["건축물"], TG27: ["하천"], TG35: ["하천"],
};
export const catOf = (code: string) => (code === "TG24" || code === "TG25" ? ["공통"] : CAT[code] || ["기타"]);
export const catLabel = (code: string) => {
  const c = catOf(code);
  return c.length === 2 && c.includes("교량") ? "교량/터널" : c.join("/");
};

export type LawReg = { key: string; area: string; target_code: string; target_name: string; doc: string; law: string; layer: string; n: number; y: number; auto: boolean; on: boolean; apply: string };

/** 등록 법령 = 의무 목록에서 묶은 것(자동) + 신규 등록한 것 − 목록에서 뺀 것. 키 = 재해구분 영역|관리대상 유형|문서 */
export async function lawRegistry(d: Dis, q = ""): Promise<LawReg[]> {
  const areas = d === "ind" ? ["I"] : ["F", "M"];
  const m = new Map<string, LawReg>();
  for (const a of areas) {
    const rows = await duties({ area: a, q: q || undefined, limit: 1000000 });
    for (const r of rows) {
      const tc = d === "ind" ? "" : r.target_code;
      const key = `${a}|${tc}|${r.doc}`;
      const g = m.get(key) || { key, area: a, target_code: tc, target_name: d === "ind" ? "" : r.target_name, doc: r.doc, law: r.law, layer: r.layer, n: 0, y: 0, auto: true, on: true, apply: "중대재해처벌법 의무사항" };
      g.n++; if (r.yongin_mark === "Y") g.y++;
      m.set(key, g);
    }
  }
  // 화면에서 등록·제외한 것(가장 최근 줄)
  const saved = latest((await readTable("usb2_law", "law_rid")).filter((r) => r.disaster === d), (r) => r.law_rid);
  for (const [k, r] of saved) {
    const hit = m.get(k);
    if (hit) { hit.on = r.state !== "off"; if (r.apply) hit.apply = r.apply; continue; }
    if (q && ![r.doc, r.law, r.target_name].join(" ").includes(q)) continue;
    m.set(k, { key: k, area: r.area, target_code: r.target_code || "", target_name: r.target_name || "", doc: r.doc, law: r.law, layer: r.layer, n: Number(r.n || 0), y: Number(r.y || 0), auto: false, on: r.state !== "off", apply: r.apply || "중대재해처벌법 의무사항" });
  }
  return [...m.values()].sort((a, b) => a.area.localeCompare(b.area) || a.target_code.localeCompare(b.target_code) || b.y - a.y || b.n - a.n);
}
