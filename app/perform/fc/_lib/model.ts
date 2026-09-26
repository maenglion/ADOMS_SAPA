/**
 * [400 · 교육자료 버전] 묶음 D — 의무이행(실적증빙) 공중이용시설·공중교통수단 트랙의 데이터 한 곳.
 *
 * 저장 표는 하나다: `usd_record` — 화면 표의 한 줄 = 한 행.
 *   scope  = 대상(자산 id 또는 공중교통수단 id). 「담당 대상 일괄적용」 분은 `ALL:<부서 id>`
 *   step   = 단계 key(lib/us/steps_fc.ts) · block = 한 화면 안의 표 이름(people·org·budget …)
 *   data   = 칸 값 JSON · files = 증빙 파일 JSON {칸 이름: [{name,url,at}]}
 *   status = 이행완료(증빙 있음) · 보완필요(내용만) · 해당없음 · 미이행 — 이행점검(묶음 F)이 읽는다.
 * 예시 행은 us_v1.0 seed 의 usd_record.csv(생성기 _build_usd\build_usd_record_20260924.py).
 */
import { assignedIds } from "@/lib/us/links";
import "server-only";
import { readTable, assetSeed, assetMapSeed, depts, duties, foldByUnit, type Row } from "@/lib/data";
import { deptOf } from "@/lib/roles";

export const TABLE = "usd_record";
export const YEAR = "2026";
export const BASE = "/perform/fc";

export type Ev = { name: string; url: string; at?: string };
export type Rec = {
  rec_id: string; scope: string; dept_id: string; year: string; step: string; block: string;
  ord: number; status: string; data: Row; files: Record<string, Ev[]>; updated_at: string; updated_by: string;
};

const j = (s: any, d: any) => { try { return s ? (typeof s === "string" ? JSON.parse(s) : s) : d; } catch { return d; } };

/** 표 전체(지운 줄 뺌) — 판 + 화면에서 쓴 것. */
export async function records(): Promise<Rec[]> {
  const rows = await readTable(TABLE, "rec_id");
  return rows
    .filter((r) => r.deleted !== "Y")
    .map((r) => ({
      rec_id: r.rec_id, scope: r.scope, dept_id: r.dept_id, year: r.year || YEAR, step: r.step, block: r.block,
      ord: Number(r.ord) || 0, status: r.status || "", data: j(r.data, {}), files: j(r.files, {}),
      updated_at: r.updated_at || "", updated_by: r.updated_by || "",
    }))
    .sort((a, b) => a.ord - b.ord);
}

/** 한 표의 줄들. 대상 것이 없으면 그 부서의 「담당 대상 일괄적용」 분을 보인다(fallback=true). */
export function blockRows(all: Rec[], step: string, block: string, scope: string, dept: string) {
  const own = all.filter((r) => r.step === step && r.block === block && r.scope === scope);
  if (own.length) return { rows: own, fallback: false };
  const bulk = all.filter((r) => r.step === step && r.block === block && r.scope === `ALL:${dept}`);
  return { rows: bulk, fallback: bulk.length > 0 };
}

/* ── 대상(우상단 셀렉터) ───────────────────────────────────────── */

export type Target = {
  id: string; name: string; group: "공중이용시설" | "공중교통수단"; gbn: string; kind: string; cls: string;
  dept_id: string; dept_name: string; targets: string[];
};

/** 공중이용시설(시설물 대장) + 공중교통수단(usb1_transport). 역할의 부서 범위로 거른다. */
export async function targetOptions(role: string, seeded: Set<string>): Promise<{ list: Target[]; all: Target[] }> {
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, d.dept_name]));
  const tmap = new Map<string, string[]>();
  for (const m of assetMapSeed()) tmap.set(m.asset_id, [...(tmap.get(m.asset_id) || []), m.target_code]);
  const fac: Target[] = assetSeed()
    .filter((a) => a.sapa_l2_result !== "제외")
    .map((a) => ({
      id: a.asset_id, name: a.asset_name, group: "공중이용시설" as const, gbn: a.asset_gbn, kind: a.asset_kind, cls: a.asset_class,
      dept_id: a.dept_id, dept_name: dn.get(a.dept_id) || "", targets: tmap.get(a.asset_id) || [],
    }));
  let tr: Target[] = [];
  try {
    tr = (await readTable("usb1_transport", "tr_id")).filter((t) => t.tr_id && t.deleted !== "Y").map((t) => ({
      id: t.tr_id, name: t.tr_name, group: "공중교통수단" as const, gbn: "공중교통수단", kind: t.tr_kind || "", cls: "",
      dept_id: t.dept_id, dept_name: dn.get(t.dept_id) || "", targets: ["TG14"],
    }));
  } catch { tr = []; }
  const all = [...tr, ...fac];
  const d = deptOf(role);
  // 목록에 올리는 시설: 중대시민재해 「해당」 · 1종 · 기록이 있는 것(시설물 대장 1,000여 건을 다 올리면 고를 수 없다)
  const hot = new Set(assetSeed().filter((a) => a.sapa_l2_result === "해당" || a.asset_class === "1종").map((a) => a.asset_id));
  const keep = (t: Target) => t.group === "공중교통수단" || seeded.has(t.id) || hot.has(t.id);
  // 관리자 「담당자 관리대상 지정」이 있으면 그 대상만(공중교통수단은 늘 둔다) — lib/us/links
  const asg = await assignedIds(role, "civ");
  let list = asg ? all.filter((t) => asg.has(t.id) || t.group === "공중교통수단") : all.filter((t) => (!d || t.dept_id === d) && keep(t));
  if (!list.length) list = all.filter((t) => keep(t));
  const rank = (t: Target) => (seeded.has(t.id) ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b) || a.group.localeCompare(b.group) || a.gbn.localeCompare(b.gbn) || a.name.localeCompare(b.name));
  return { list, all };
}

/** 역할별 대표 대상 — 도로과 = 기흥터널 · 상수도사업소 = 용인시 지방상수도 · 그 밖 = 용인경전철. */
const DEFAULT: Record<string, string[]> = {
  road: ["TU2009-0000102"], water: ["WS2003-0000053"], gm: ["TR-01", "TU2013-0000001"],
  mgr: ["TR-01", "TU2013-0000001"], ceo: ["TR-01", "TU2013-0000001"],
};
export function pickTarget(list: Target[], all: Target[], role: string, want?: string): Target | null {
  if (want) { const w = all.find((t) => t.id === want); if (w) return w; }
  for (const id of DEFAULT[role] || DEFAULT.gm) { const t = list.find((x) => x.id === id); if (t) return t; }
  return list[0] || null;
}

/* ── 관계 법령 의무(④) — 우리 의무 목록 ─────────────────────────── */

/** 조·항 떼기 — 「제11조제1항제2호」 → { jo: "제11조", hang: "제1항" }. */
export function joHang(label: string) {
  const s = String(label || "");
  const jo = (s.match(/제\d+조(의\d+)?/) || [""])[0];
  const hang = (s.match(/제\d+항/) || [""])[0];
  return { jo: jo || s.replace(/\(.*?\)/g, "").slice(0, 20), hang };
}

/**
 * 대상에 걸리는 공중이용시설·공중교통수단(area F) 의무. commonToo = 기관 전체(TG24)도 넣을지.
 * 같은 의무가 겹치면 한 줄(foldByUnit). 용인 확정(Y) 먼저.
 */
export async function dutiesFor(t: Target | null, opt: { impl?: string; commonToo?: boolean; mark?: string } = {}) {
  const codes = new Set([...(t?.targets || []), ...(opt.commonToo ? ["TG24"] : [])]);
  let rows = (await duties({ area: "F", limit: 20000 })).filter((d) => codes.has(d.target_code));
  if (opt.impl) rows = rows.filter((d) => d.impl_type === opt.impl);
  if (opt.mark) rows = rows.filter((d) => d.yongin_mark === opt.mark);
  rows = foldByUnit(rows);
  const mk = (d: Row) => (d.yongin_mark === "Y" ? 0 : 1);
  return rows.sort((a, b) => mk(a) - mk(b) || String(a.doc).localeCompare(String(b.doc)) || String(a.duty_key).localeCompare(String(b.duty_key)));
}

/** 의무 한 줄의 화면 글자. */
export function dutyText(d: Row) {
  // 고시의 「조 번호 없는 본문」은 article_title 자리에 내부 경로(a901/n1/…)가 들어 있다 — 화면에 쓰지 않는다
  const title = /^[a-z0-9/_\-.]+$/i.test(String(d.article_title || "")) ? "" : String(d.article_title || "");
  d = { ...d, article_title: title };
  const name = d.duty_name || d.article_title || "";
  const art = d.unit_label_ko || "";
  return { art, name, content: `${art}${d.article_title && d.article_title !== name ? ` ${d.article_title}` : ""}${name ? ` — ${name}` : ""}` };
}
export const markLabel = (m: string) => (m === "Y" ? "용인 확정" : m ? "조건부" : "");

/* ── 상태 ─────────────────────────────────────────────────────── */
export function statusOf(data: Row, files: Record<string, Ev[]>) {
  if (data.na === "Y") return "해당없음";
  if (Object.values(files || {}).some((a) => (a || []).length)) return "이행완료";
  const filled = Object.entries(data || {}).some(([k, v]) => !["item", "duty_key", "mode"].includes(k) && String(v ?? "").trim() && String(v) !== "0");
  return filled ? "보완필요" : "미이행";
}
