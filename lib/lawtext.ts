/**
 * 법령 원문 — 「조문 보기」에서 법조문 원문을 보인다(2026-09-24 사용자 지시).
 *
 * 원천(한 번 구축): 데이터 폴더 `lawtext_v*` — 정본 발행 판(unit·doc·schedule)에서 우리 의무 문서 674개의 전문을 뽑은 것.
 *   만드는 코드 `_build\build_lawtext_v10.py`(정본 읽기만 · 판 덮어쓰기 금지). 정본이 새로 발행되면 새 판을 만든다.
 * 현행화(매번): 법령 개정 자동 확인(CoCo)이 찾고 앱이 「반영」한 실행의 items.csv(새 본문 · 시행일)를 판 위에 얹는다.
 *   · 시행일이 오늘 이전 → 현행 본문을 새 본문으로 바꾸고 「개정 반영」 표시(옛 본문은 곁에 보관)
 *   · 시행일이 오늘 이후 → 현행 본문은 그대로, 「시행 예정」 새 본문을 따로 보인다(기준일 원칙)
 *   · 총괄이 「반영 안 함」으로 정한 항목은 얹지 않는다
 * 원문은 사실층이라 화면에서 고치지 않는다(읽기만).
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, appliedRuns, decisions, runItems } from "@/lib/lawsync";
import { ymd } from "@/lib/day";

export type LawUnit = {
  u: string; p: string; l: string; t: string; d: string; ti: string; x: string; e: string; del: string;
  /** 현행화로 얹은 것 */
  old?: string; next?: string; nextFrom?: string; run?: string; added?: boolean;
};
export type LawDoc = { doc_id: string; title: string; norm_form: string; effective_from: string; last_amended_at: string; nlic_mst: string; units: LawUnit[] };

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

/** 가장 새 원문 판(이름순) */
function storeDir(): string | null {
  const ds = safe(() => fs.readdirSync(DATA_ROOT).filter((d) => /^lawtext_v[\d.]+_\d{8}$/.test(d)).sort(), [] as string[]);
  return ds.length ? path.join(DATA_ROOT, ds[ds.length - 1]) : null;
}
export function storeMeta(): Record<string, any> {
  const d = storeDir();
  return d ? safe(() => JSON.parse(fs.readFileSync(path.join(d, "_meta.json"), "utf8")), {}) : {};
}

const docCache = new Map<string, LawDoc | null>();
function rawDoc(docId: string): LawDoc | null {
  if (!/^DOC-\d+$/.test(docId)) return null;
  if (docCache.has(docId)) return docCache.get(docId)!;
  const d = storeDir();
  const v = d ? safe(() => JSON.parse(fs.readFileSync(path.join(d, "doc", `${docId}.json`), "utf8")) as LawDoc, null) : null;
  docCache.set(docId, v);
  return v;
}
let unitDoc: Record<string, string> | null = null;
/** 의무 행에 doc_id 가 비었을 때 조항호목 번호로 문서를 찾는다 */
export function docOfUnit(unitId: string): string {
  if (!unitDoc) { const d = storeDir(); unitDoc = d ? safe(() => JSON.parse(fs.readFileSync(path.join(d, "unit_doc.json"), "utf8")), {}) : {}; }
  return unitDoc![unitId] || "";
}
let sched: Record<string, { doc_id: string; path: string; kind: string; title: string; x: string }> | null = null;
export function scheduleText(id: string) {
  if (!sched) { const d = storeDir(); sched = d ? safe(() => JSON.parse(fs.readFileSync(path.join(d, "schedule.json"), "utf8")), {}) : {}; }
  return sched![id] || null;
}

/** 반영한 개정 — 문서별 { 경로 → 항목 } (실행 순서대로 뒤의 것이 이긴다) */
let pCache: { at: number; v: Promise<Map<string, Map<string, Record<string, string>>>> } | null = null;
function patches() {
  // 한 화면이 조마다 부르므로 잠깐(10초) 모아 둔다 — 새 반영은 10초 안에 보인다
  if (!pCache || Date.now() - pCache.at > 10_000) pCache = { at: Date.now(), v: loadPatches() };
  return pCache.v;
}
async function loadPatches(): Promise<Map<string, Map<string, Record<string, string>>>> {
  const [runs, dec] = await Promise.all([appliedRuns(), decisions()]);
  const out = new Map<string, Map<string, Record<string, string>>>();
  for (const id of [...runs].sort()) {
    for (const it of runItems(id)) {
      if (!it.doc_id || !it.unit_path || !it.new_text) continue;
      if (dec.get(it.item_id)?.decision === "반영 안 함") continue;
      if (!out.has(it.doc_id)) out.set(it.doc_id, new Map());
      out.get(it.doc_id)!.set(it.unit_path, it);
    }
  }
  return out;
}

const dash = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);

/** 문서 하나 — 판 원문 + 반영한 개정 */
export async function lawDoc(docId: string): Promise<LawDoc | null> {
  const base = rawDoc(docId);
  if (!base) return null;
  const pm = (await patches()).get(docId);
  if (!pm) return base;
  const today = ymd();
  const seen = new Set<string>();
  const units = base.units.map((u) => {
    const it = pm.get(u.p);
    if (!it) return u;
    seen.add(u.p);
    const eff = dash(it.effective || "");
    return eff && eff > today
      ? { ...u, next: it.new_text, nextFrom: eff, run: it.run_id }
      : { ...u, x: it.new_text, old: u.x, run: it.run_id };
  });
  // 판에 없던 조항호목(개정으로 신설) — 같은 조 끝에 붙인다
  for (const [p, it] of pm) {
    if (seen.has(p)) continue;
    const eff = dash(it.effective || "");
    const art = p.split("/")[0];
    const nu: LawUnit = { u: it.unit_id || "", p, l: it.label || "", t: "", d: "", ti: "", x: eff && eff > today ? "" : it.new_text, e: eff, del: "", added: true, run: it.run_id,
      ...(eff && eff > today ? { next: it.new_text, nextFrom: eff } : {}) };
    let at = -1;
    units.forEach((u, i) => { if (u.p === art || u.p.startsWith(art + "/")) at = i; });
    if (at >= 0) units.splice(at + 1, 0, nu); else units.push(nu);
  }
  return { ...base, units };
}

/** 조항호목 하나가 속한 조의 전문(조 + 그 아래 항·호·목) */
export async function articleOf(docId: string, unitId: string): Promise<{ doc: LawDoc; art: string; units: LawUnit[] } | null> {
  const id = docId || docOfUnit(unitId);
  const doc = await lawDoc(id);
  if (!doc) return null;
  const me = doc.units.find((u) => u.u === unitId);
  if (!me) return null;
  const art = me.p.split("/")[0];
  return { doc, art, units: doc.units.filter((u) => u.p === art || u.p.startsWith(art + "/")) };
}
