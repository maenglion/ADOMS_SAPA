import "server-only";
import { readTable, depts, staff, assets, type Row } from "@/lib/data";
import { dstageOf, scopeOf, LRT, RUBRIC_KEYS, type DStage } from "./codes";
import { drillEvents, lastDrillAt, drillSubstitutes } from "@/lib/drill";

export type Drill = Row & { stage: DStage; eval: Row | null; score: number | null };

export async function loadDrills() {
  const [plans, evals, dl, st, al] = await Promise.all([
    readTable("drill_plan", "drill_id"), readTable("drill_eval", "eval_id"), depts(), staff(), assets({ limit: 5000 }),
  ]);
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const staffName = new Map<string, string>(st.map((x: Row) => [x.staff_id, x.display_name]));
  // 평가는 가장 최근 것 하나를 쓴다(덮개에 새로 쌓인 것이 앞에 온다).
  const evalOf = new Map<string, Row>();
  evals.forEach((e) => { if (!evalOf.has(e.drill_id)) evalOf.set(e.drill_id, e); });

  const drills: Drill[] = plans.map((d): Drill => {
    const e = evalOf.get(d.drill_id) || null;
    const score = e ? RUBRIC_KEYS.reduce((a, k) => a + (Number(e[k]) || 0), 0) : null;
    return { ...d, eval: e, score, stage: dstageOf(d, Boolean(e)) };
  }).sort((a, b) => String(b.planned_at).localeCompare(String(a.planned_at)));

  // 대상 시설 — 경전철 + 제1종시설물 전부 + 훈련 계획이 있는 시설(자체 확대)
  const assetMap = new Map<string, Row>(al.map((a: Row) => [a.asset_id, a]));
  const keys = new Set<string>([LRT.asset_id, ...al.filter((a: Row) => a.asset_class === "1종").map((a: Row) => a.asset_id),
    ...drills.map((d) => d.target_key)]);
  const targets = [...keys].map((k) => {
    const a = k === LRT.asset_id ? { ...LRT, sapa_l2_result: "해당" } : assetMap.get(k);
    if (!a) return null;
    const { scope, kind } = scopeOf(a as any);
    return {
      key: k, name: a.asset_name, gbn: a.asset_gbn, cls: a.asset_class || "", dept_id: a.dept_id,
      scope, kind, drills: drills.filter((d) => d.target_key === k),
    };
  }).filter(Boolean) as {
    key: string; name: string; gbn: string; cls: string; dept_id: string; scope: string; kind: string; drills: Drill[];
  }[];

  // 두 표(drill_plan · civil_manual 「대피훈련」)를 합친 실시 기록 — /system?area=F 와 같은 함수(lib/drill.ts).
  const events = await drillEvents();
  const withLast = targets.map((t) => ({ ...t, last_done: lastDrillAt(events, { key: t.key }) }));

  // 갈음 판정(시행령 제10조제7호 단서) — /system?area=F · /exec 와 같은 함수(lib/drill.ts).
  const substs = await drillSubstitutes();

  return { drills, targets: withLast, events, substs, deptName, staffName, staff: st, assetList: al, assetMap };
}
