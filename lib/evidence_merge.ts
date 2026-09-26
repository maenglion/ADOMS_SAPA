/**
 * 09-26 사용자: 증빙 대장 합치기 — 의무이행 단계(/perform/ws|fc|mt/[step])에서 올린 증빙을 읽어 모은다.
 *
 * 사용자 결정(09-26): 증빙 대장(증빙을 올린 사람이 보는 화면)에는 의무이행 단계 증빙도 보인다.
 *   결재하는 사람이 보는 증빙 등록·결재 화면에는 넣지 않는다 — 그래서 이 함수는 증빙 대장(와 그 엑셀)만 부른다.
 *
 * 읽기만 한다. 자료를 옮기거나 복사하지 않는다. 저장 경로·서버 동작은 각 단계 화면의 actions.ts 그대로다.
 *   사업장                     `usc_record` — files = [{name,url,at}]            · dept_id = 본청 부서 id 또는 사업장 번호(WP-02~)
 *   공중이용시설·공중교통수단  `usd_record` — files = {칸 이름: [{name,url,at}]} · scope = 자산 id · 공중교통수단 id · ALL:<부서 id>
 *   원료·제조물                `use_record` — files = [{name,url,slot,at}]       · site_id = 원료·제조물 사업장(use_site)
 * 지운 표시(deleted=Y)가 있는 줄은 뺀다(각 화면이 보이지 않는 줄).
 *
 * 이행일(보존 기준일) — 시행령 제13조 「이행한 날부터 5년」. 증빙 대장의 규칙(이행일 있으면 그 날, 없으면 올린 날)을 따른다.
 *   단계 줄의 날짜 칸 가운데 이행을 가르는 칸을 먼저 본다:
 *   to·dto(개선·시정 이행 기간 끝 — 사업장 화면이 「이행했다」를 가르는 칸) → adate(조치일) → r2date(재발방지 대책 이행일)
 *   → date(실시·지정·집행일) → wdate(작성일) → pdate(명령 접수일) → cdate(확인일).
 *   오늘보다 뒤의 날짜(아직 오지 않은 기한)는 이행일로 쓰지 않고 다음 칸을 본다. 날짜 칸이 없으면 파일을 올린 날(at).
 */
import "server-only";
import { readTable, depts, assetSeed, type Row } from "@/lib/data";
import { STEPS, TRACKS, type TrackKey } from "@/lib/us/tracks";
import { TABLE as WS_TABLE } from "@/app/perform/ws/_lib/meta";

const FC_TABLE = "usd_record";   // app/perform/fc/_lib/model.ts TABLE 과 같은 값
const MT_TABLE = "use_record";   // app/perform/mt/model.ts TABLE 과 같은 값
const HQ_WP = "WP-01";           // app/targets/_lib.ts HQ_WP 와 같은 값

export type StepEvidence = {
  id: string;            // <rec_id>·<순번>
  rec_id: string;
  track: TrackKey;
  trackLabel: string;    // 사업장 · 공중이용시설·공중교통수단 · 원료·제조물
  area: "I" | "F" | "M";
  step: string;
  stepLabel: string;     // 「3) 안전점검 계획 수립·수행」처럼 좌측 메뉴 글자
  code36: string;
  target: string;        // 대상 이름(사업장·부서 / 시설 / 원료·제조물 사업장)
  dept_id: string;
  name: string;          // 파일 이름
  url: string;
  at: string;            // 파일을 올린 날(YYYY-MM-DD)
  doneDate: string;      // 이행일(위 규칙)
  doneBasis: "기록한 날" | "올린 날";
  what: string;          // 그 줄의 내용(항목·내용·문서 이름 …)
  by: string;
  href: string;          // 그 단계 화면(대상 고정) — role 은 부르는 쪽이 붙인다
};

const js = (s: any, d: any) => {
  if (s && typeof s === "object") return s;
  try { return s ? JSON.parse(String(s)) : d; } catch { return d; }
};
const isDay = (v: any) => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DATE_KEYS = ["to", "dto", "adate", "r2date", "date", "wdate", "pdate", "cdate"];

function doneOf(data: Row, at: string): { doneDate: string; doneBasis: StepEvidence["doneBasis"] } {
  const t0 = today();
  for (const k of DATE_KEYS) {
    const v = String(data[k] || "").slice(0, 10);
    if (isDay(v) && v <= t0) return { doneDate: v, doneBasis: "기록한 날" };
  }
  return { doneDate: isDay(at) ? at.slice(0, 10) : "", doneBasis: "올린 날" };
}
const whatOf = (d: Row) =>
  String(d.content || d.text || d.desc || d.doc || d.item || d.edu_name || d.name || d.hz || d.act || d.rank || "").trim();

function stepInfo(track: TrackKey, key: string) {
  const s = STEPS[track].find((x) => x.key === key);
  return { label: s ? `${s.no ? `${s.no}) ` : ""}${s.label}` : key, code36: s?.code36 || "" };
}

/** 한 줄의 files 칸 → 파일 목록(모양이 트랙마다 다르다: 배열 또는 {칸: 배열}). */
function filesOf(v: any): { name: string; url: string; at: string }[] {
  const f = js(v, []);
  const list: any[] = Array.isArray(f) ? f : Object.values(f || {}).flat();
  return list.filter((x) => x && String(x.name || "").trim())
    .map((x) => ({ name: String(x.name).trim(), url: String(x.url || ""), at: String(x.at || "").slice(0, 10) }));
}

/** 의무이행 단계 증빙 전부 — 세 표를 읽을 때 합친다. */
export async function loadStepEvidence(): Promise<StepEvidence[]> {
  const [ws, fc, mt, dl, wps, trs, sites] = await Promise.all([
    readTable(WS_TABLE, "rec_id"), readTable(FC_TABLE, "rec_id"), readTable(MT_TABLE, "rec_id"), depts(),
    readTable("usb1_workplace", "wp_id").catch(() => [] as Row[]),
    readTable("usb1_transport", "tr_id").catch(() => [] as Row[]),
    readTable("use_site", "site_id").catch(() => [] as Row[]),
  ]);
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const wpName = new Map<string, string>(wps.map((w: Row) => [w.wp_id, w.wp_name]));
  const hqName = wpName.get(HQ_WP) || "용인시청 본청";
  const assetById = new Map<string, Row>(assetSeed(true).map((a) => [a.asset_id, a]));
  const trById = new Map<string, Row>(trs.map((t: Row) => [t.tr_id, t]));
  const siteById = new Map<string, Row>(sites.map((s: Row) => [s.site_id, s]));
  const label = (k: TrackKey) => TRACKS.find((t) => t.key === k)!;

  const out: StepEvidence[] = [];
  const push = (track: TrackKey, r: Row, block: string, target: string, dept: string, href: string) => {
    const fl = filesOf(r.files);
    if (!fl.length) return;
    const data = js(r.data, {});
    const si = stepInfo(track, String(r.step || ""));
    // 교육 줄은 의무조항이 따로 있다 — 사업장 관계 법령 단계의 교육 표(edu) · 원료·제조물 법정교육(edu:…)
    const code36 = track === "ws" && block === "edu" ? "I13" : track === "mt" && block.startsWith("edu") ? "M09" : si.code36;
    fl.forEach((f, i) => {
      const dn = doneOf(data, f.at);
      out.push({
        id: `${r.rec_id}·${i + 1}`, rec_id: String(r.rec_id), track, trackLabel: label(track).label, area: label(track).area,
        step: String(r.step || ""), stepLabel: si.label, code36, target, dept_id: dept,
        name: f.name, url: f.url, at: f.at, ...dn, what: whatOf(data), by: String(r.updated_by || ""), href,
      });
    });
  };

  for (const r of ws) {
    if (r.deleted === "Y") continue;
    const d = String(r.dept_id || "");
    const isWp = /^WP-/.test(d);
    const target = isWp ? wpName.get(d) || d : `${hqName} · ${deptName.get(d) || d}`;
    const q = isWp ? (d === HQ_WP ? "" : `wp=${d}`) : `dept=${d}`;
    push("ws", r, String(r.section || ""), target, isWp ? "" : d, `/perform/ws/${r.step}${q ? `?${q}` : ""}`);
  }
  for (const r of fc) {
    if (r.deleted === "Y") continue;
    const sc = String(r.scope || "");
    let target = sc, dept = String(r.dept_id || ""), q = `t=${encodeURIComponent(sc)}`;
    if (sc.startsWith("ALL:")) {
      dept = sc.slice(4);
      target = `${deptName.get(dept) || dept} 담당 대상 전체`;
      q = "";
    } else if (trById.has(sc)) {
      target = String(trById.get(sc)!.tr_name || sc); dept = dept || String(trById.get(sc)!.dept_id || "");
    } else if (assetById.has(sc)) {
      target = String(assetById.get(sc)!.asset_name || sc); dept = dept || String(assetById.get(sc)!.dept_id || "");
    }
    push("fc", r, String(r.block || ""), target, dept, `/perform/fc/${r.step}${q ? `?${q}` : ""}`);
  }
  for (const r of mt) {
    if (r.deleted === "Y") continue;
    const s = siteById.get(String(r.site_id || ""));
    push("mt", r, String(r.block || ""), String(s?.site_name || r.site_id || ""), String(r.dept_id || s?.dept_id || ""),
      `/perform/mt/${r.step}?site=${encodeURIComponent(String(r.site_id || ""))}`);
  }
  return out;
}

/** 두 곳에 있는 같은 파일인지 가르는 열쇠 — 주소가 있으면 주소, 없으면 재해 구분 + 파일 이름(띄어쓰기·대소문자 무시). */
export const fileKeys = (area: string, name: string, url: string) => {
  const keys: string[] = [];
  if (url) keys.push(`u:${url}`);
  const n = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (n) keys.push(`n:${area}:${n}`);
  return keys;
};
