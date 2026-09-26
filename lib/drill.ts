import "server-only";
import { readTable, type Row } from "./data";
import { ymd } from "@/lib/day";

/**
 * 대피훈련 기록 — 한 곳에서 읽는다(2026-09-21).
 *
 * 훈련 기록이 두 표에 나뉘어 있었다.
 *   · civil_manual 의 record_kind=「대피훈련」 줄 — /system?area=F 가 읽던 것(실시일만 있는 짧은 기록)
 *   · drill_plan — /drills 가 읽던 것(계획·임무카드·실시·평가까지 한 건)
 * 두 화면이 서로 다른 숫자를 내지 않도록 둘을 합쳐 한 목록으로 돌려준다.
 * 같은 시설 · 같은 실시일은 하나로 센다. 실시일이 오늘보다 뒤인 기록은 실시로 세지 않는다.
 *
 * 근거: 중대재해처벌법 시행령 제10조제7호라목 — 공중교통수단·제1종시설물의 비상·위급상황 대피훈련.
 */

/** 용인경전철 — 관리대상 대장 밖이라 자산 번호가 없다. drill_plan 은 이 열쇠를, 다른 표는 이름을 쓴다. */
export const LRT_KEY = "LRT-EVERLINE";

export type DrillEvent = {
  key: string;              // 시설 열쇠(자산 번호, 경전철은 LRT_KEY)
  asset_id: string;
  facility_name: string;
  dept_id: string;
  done_at: string;          // 실시일(YYYY-MM-DD) — 비면 아직 안 함
  planned_at: string;       // 계획 일시(drill_plan)
  future: boolean;          // 실시일이 오늘보다 뒤(실시로 세지 않음)
  drill_id: string;         // drill_plan 번호(있으면)
  manual_id: string;        // civil_manual 번호(있으면)
  from: ("훈련 계획" | "절차 기록")[];
  participants: string;
};

/** 시설 열쇠 — 자산 번호가 있으면 그것, 없으면 이름(경전철은 LRT_KEY). */
export function drillKey(asset_id?: string, name?: string): string {
  const a = String(asset_id || "").trim();
  if (a) return a;
  const n = String(name || "").trim();
  if (n.includes("경전철") || n.includes("에버라인")) return LRT_KEY;
  return `이름:${n}`;
}

const day = (s?: string) => String(s || "").slice(0, 10);
const todayStr = () => ymd();

/** 두 표를 합친 훈련 기록 — 최근 것이 앞. */
export async function drillEvents(today = todayStr()): Promise<DrillEvent[]> {
  const [plans, manual] = await Promise.all([
    readTable("drill_plan", "drill_id"),
    readTable("civil_manual", "manual_id"),
  ]);
  const out = new Map<string, DrillEvent>();
  const put = (e: DrillEvent) => {
    // 실시일이 있으면 「시설 + 실시일」로 하나, 없으면(계획만) 각자 한 건.
    const id = e.done_at ? `${e.key}|${e.done_at}` : `${e.key}|계획|${e.drill_id || e.manual_id}`;
    const had = out.get(id);
    if (!had) { out.set(id, e); return; }
    out.set(id, {
      ...had,
      drill_id: had.drill_id || e.drill_id, manual_id: had.manual_id || e.manual_id,
      planned_at: had.planned_at || e.planned_at, participants: had.participants || e.participants,
      dept_id: had.dept_id || e.dept_id, facility_name: had.facility_name || e.facility_name,
      from: [...new Set([...had.from, ...e.from])],
    });
  };

  plans.forEach((d: Row) => {
    const key = d.target_key === LRT_KEY ? LRT_KEY : drillKey(d.target_key, d.target_name);
    const done = day(d.done_at);
    put({
      key, asset_id: key === LRT_KEY ? "" : String(d.target_key || ""), facility_name: String(d.target_name || ""),
      dept_id: String(d.dept_id || ""), done_at: done, planned_at: String(d.planned_at || ""),
      future: Boolean(done && done > today), drill_id: String(d.drill_id || ""), manual_id: "",
      from: ["훈련 계획"], participants: String(d.participants || ""),
    });
  });
  manual.filter((m: Row) => m.record_kind === "대피훈련").forEach((m: Row) => {
    const key = drillKey(m.asset_id, m.facility_name);
    const done = day(m.done_at);
    put({
      key, asset_id: String(m.asset_id || ""), facility_name: String(m.facility_name || ""),
      dept_id: "", done_at: done, planned_at: "",
      future: Boolean(done && done > today), drill_id: "", manual_id: String(m.manual_id || ""),
      from: ["절차 기록"], participants: String(m.participants || ""),
    });
  });
  return [...out.values()].sort((a, b) => (b.done_at || b.planned_at).localeCompare(a.done_at || a.planned_at));
}

/** 실시한 기록만(실시일이 있고 오늘 이전). */
export const doneEvents = (ev: DrillEvent[]) => ev.filter((e) => e.done_at && !e.future);

/** 한 시설의 가장 최근 실시일. */
export function lastDrillAt(ev: DrillEvent[], t: { asset_id?: string; facility_name?: string; key?: string }): string {
  const k = t.key || drillKey(t.asset_id, t.facility_name);
  return doneEvents(ev).filter((e) => e.key === k).map((e) => e.done_at).sort().pop() || "";
}

/** 「최근 1년 안」의 시작일 — 두 화면이 같은 날을 쓴다. */
export function drillYearAgo(now = new Date()): string {
  return ymd(new Date(now.getTime() - 365 * 86400000));
}

/** 대상 시설 목록에 대해 최근 1년 안 실시 여부를 센다. */
export function drillCoverage<T extends { asset_id?: string; facility_name?: string; key?: string }>(
  ev: DrillEvent[], targets: T[], now = new Date(),
) {
  const yearAgo = drillYearAgo(now);
  const rows = targets.map((t) => ({ ...t, last_drill: lastDrillAt(ev, t) }));
  const ok = rows.filter((r) => r.last_drill && r.last_drill >= yearAgo).length;
  return { rows, ok, n: rows.length, yearAgo };
}

/* ════════════════════════════════════════════════════════════════════
 * 대피훈련 갈음 — 한 함수로 판정한다(2026-09-21).
 *
 * 시행령 제10조제7호 단서: 철도운영자가 「철도안전법」 제7조에 따라 비상대응계획을 포함한
 * 철도안전관리체계를 수립하여 시행하고, 경영책임자등이 그 수립 여부 및 내용을 직접 점검하거나
 * 점검 결과를 보고받은 경우 업무처리절차(라목 대피훈련 포함)를 마련하여 이행한 것으로 본다.
 *
 * 규칙
 *   · 갈음 근거 계획 = 절차 기록의 철도안전관리체계 문서(철도안전법 제7조) 또는 훈련 계획의 「갈음」 표시
 *   · 경영책임자 확인 = 절차 기록의 「경영책임자 보고」 날짜 또는 훈련 계획의 「경영책임자 확인」
 *     — 어느 표에 적혀도 같은 확인으로 센다.
 *   · 체계 문서에 개정일이 있으면 개정일 이후의 확인만 센다(단서가 「내용」을 점검하라고 하므로).
 *   · 계획 + 확인 = 「갈음 인정」, 계획만 = 「갈음 확인 없음」, 계획 없음 = 해당 없음(null).
 *   · 안전계획(시행령 제10조제4호 단서 — 철도안전법 제6조 연차별 시행계획)의 확인은 다른 문서에 대한
 *     확인이라 제7호 갈음으로 세지 않는다. 화면에는 참고로만 보인다.
 * /drills · /system?area=F · /exec 가 모두 이 함수만 부른다.
 * ════════════════════════════════════════════════════════════════════ */

export type SubstState = "갈음 인정" | "갈음 확인 없음";

export type SubstCheck = {
  src: "절차 기록" | "훈련 계획";
  id: string;              // manual_id 또는 drill_id
  at: string;              // 확인·보고받은 날
  mode: string;            // 직접 점검 / 보고받음
  counted: boolean;        // 갈음 인정에 세는가(개정 전 확인은 세지 않음)
  why: string;             // 세지 않을 때 까닭
};

export type Substitute = {
  key: string;
  facility_name: string;
  state: SubstState;
  plan: { src: "절차 기록" | "훈련 계획"; id: string; title: string; revised_at: string };
  checks: SubstCheck[];            // 최근 것이 앞
  latest: SubstCheck | null;       // 세는 확인 중 가장 최근
  where: string;                   // 화면 표시용 한 줄 — 어디서 확인했는가
  planRef: { id: string; at: string } | null; // 참고: 제4호 안전계획 확인(세지 않음)
  manual_id: string;               // 체계 문서(있으면) — 보고받음 기록을 여기에 남긴다
  drill_ids: string[];             // 갈음으로 표시된 훈련
};

const isRailDoc = (m: Row) => String(m.basis || "").includes("철도안전법 제7조") || m.record_kind === "철도안전관리체계";

/** 시설별 갈음 판정 — 갈음 근거 계획이 없는 시설은 목록에 없다. */
export async function drillSubstitutes(): Promise<Map<string, Substitute>> {
  const [plans, manual, safety] = await Promise.all([
    readTable("drill_plan", "drill_id"),
    readTable("civil_manual", "manual_id"),
    readTable("civil_safety_plan", "plan_id"),
  ]);
  const keys = new Set<string>();
  const docOf = new Map<string, Row>();
  manual.filter(isRailDoc).forEach((m) => {
    const k = drillKey(m.asset_id, m.facility_name);
    keys.add(k);
    const had = docOf.get(k);
    if (!had || String(m.revised_at || m.enacted_at || "") > String(had.revised_at || had.enacted_at || "")) docOf.set(k, m);
  });
  const subDrills = plans.filter((d) => d.substitute === "Y");
  subDrills.forEach((d) => keys.add(d.target_key === LRT_KEY ? LRT_KEY : drillKey(d.target_key, d.target_name)));

  const out = new Map<string, Substitute>();
  for (const k of keys) {
    const doc = docOf.get(k);
    const ds = subDrills.filter((d) => (d.target_key === LRT_KEY ? LRT_KEY : drillKey(d.target_key, d.target_name)) === k);
    const revised = day(doc?.revised_at);
    const raw: Omit<SubstCheck, "counted" | "why">[] = [];
    manual.filter(isRailDoc).filter((m) => drillKey(m.asset_id, m.facility_name) === k && day(m.reported_at))
      .forEach((m) => raw.push({ src: "절차 기록", id: String(m.manual_id), at: day(m.reported_at), mode: "보고받음" }));
    ds.filter((d) => d.ceo_checked === "Y")
      .forEach((d) => raw.push({ src: "훈련 계획", id: String(d.drill_id), at: day(d.ceo_checked_at), mode: String(d.ceo_check_mode || "확인") }));
    const checks: SubstCheck[] = raw.map((c) => {
      const early = Boolean(revised && c.at && c.at < revised);
      return { ...c, counted: !early, why: early ? `체계 개정(${revised}) 전 확인` : "" };
    }).sort((a, b) => b.at.localeCompare(a.at));
    const latest = checks.find((c) => c.counted) || null;
    const d0 = ds[0];
    const plan = doc
      ? { src: "절차 기록" as const, id: String(doc.manual_id), title: String(doc.title || "철도안전관리체계"), revised_at: revised }
      : { src: "훈련 계획" as const, id: String(d0?.drill_id || ""), title: String(d0?.substitute_basis || "철도안전법 제7조 비상대응계획(철도안전관리체계)"), revised_at: "" };
    const sp = safety.filter((r) => r.facility_kind === "공중교통수단" && r.ceo_confirmed === "Y"
      && drillKey(r.asset_id, r.facility_name) === k).sort((a, b) => String(b.confirmed_at).localeCompare(String(a.confirmed_at)))[0];
    const where = latest
      ? `경영책임자 ${latest.mode} ${latest.at || "날짜 없음"} · ${latest.src === "절차 기록" ? "절차·기록(철도안전관리체계 문서)" : `${latest.id.replace(/^DRL-/, "훈련-")} 갈음 확인`}에 기록`
      : checks.length ? `확인 기록 ${checks.length}건 모두 ${checks[0].why}` : "경영책임자 확인 기록 없음";
    out.set(k, {
      key: k, facility_name: String(doc?.facility_name || d0?.target_name || ""),
      state: latest ? "갈음 인정" : "갈음 확인 없음", plan, checks, latest, where,
      planRef: sp ? { id: String(sp.plan_id), at: day(sp.confirmed_at) } : null,
      manual_id: doc ? String(doc.manual_id) : "", drill_ids: ds.map((d) => String(d.drill_id)),
    });
  }
  return out;
}

/** 한 시설의 갈음 판정(없으면 null). */
export async function drillSubstituteOf(key: string): Promise<Substitute | null> {
  return (await drillSubstitutes()).get(key) || null;
}
