// [캡처 v2] 대피훈련 목록 — 단계 막대(대상→계획→준비→실시→평가) + 요약 칸 + 한 줄 표. 조문 인용 상자·설명 문단은 뺐다(2026-09-22).
import Link from "next/link";
import Steps, { Facts, type Step } from "@/components/Steps";
import { deptOf } from "@/lib/roles";
import { loadDrills, type Drill } from "./load";
import { drillCoverage, doneEvents } from "@/lib/drill";
import { DRILL_TYPES, METHODS, HALVES, DFLOW, LRT, did, scopeTone, stageTone } from "./codes";
import { AssetPicker } from "../hazards/Pickers";
import { createPlan } from "./actions";
import SubstBox, { SubstBadge } from "./SubstBox";
import s from "./drills.module.css";
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

/** 대피훈련 — 중대재해처벌법 시행령 제10조제7호라목. 탭: 대상 시설 · 훈련 목록 · 새 훈련 계획. */
export default async function Drills({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const v = sp.v || "targets";
  const myDept = deptOf(role);
  const { drills: allD, targets: allT, events, substs, deptName, assetList } = await loadDrills();
  const mine = <T extends Record<string, any>>(xs: T[]) => (myDept && role !== "mgr" ? xs.filter((x) => x.dept_id === myDept) : xs);
  const drills = mine(allD);
  const targets = mine(allT);
  const year = String(new Date().getFullYear());
  const month = new Date().getMonth() + 1;

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    const m: Record<string, string | undefined> = { v, sc: sp.sc, g: sp.g, ...o };
    Object.entries(m).forEach(([k, x]) => x && p.set(k, x));
    return `/drills?${p.toString()}`;
  };

  const halfState = (ds: Drill[], half: string) => {
    const x = ds.filter((d) => d.year === year && d.half === half);
    if (!x.length) return null;
    return x.find((d) => d.stage === "평가 완료") || x.find((d) => d.stage === "실시") || x[0];
  };
  /** 훈련 계획 없이 절차 기록에만 실시일이 있는 것 — 그 반기의 실시로 함께 센다. */
  const recOnly = (key: string, half: string) => doneEvents(events).find((e) => e.key === key && !e.drill_id
    && e.done_at.slice(0, 4) === year && (Number(e.done_at.slice(5, 7)) <= 6) === (half === "상반기"));
  const legal = targets.filter((t) => t.scope.startsWith("법정"));
  const legalStrict = targets.filter((t) => t.scope === "법정 대상");
  const doneH1 = legal.filter((t) => { const d = halfState(t.drills, "상반기"); return (d && (d.stage === "실시" || d.stage === "평가 완료")) || (!d && recOnly(t.key, "상반기")); });
  // 최근 1년 안 실시 — /system?area=F 와 같은 함수·같은 대상으로 센다.
  const cov = drillCoverage(events, legal);
  const planH2 = legal.filter((t) => halfState(t.drills, "하반기"));
  const substOf = (key: string) => substs.get(key) || null;
  const subNoCeo = targets.map((t) => substOf(t.key)).filter((x) => x && x.state === "갈음 확인 없음");
  const subList = targets.map((t) => substOf(t.key)).filter(Boolean) as NonNullable<ReturnType<typeof substOf>>[];
  const withCarry = drills.filter((d) => d.carry_over && d.stage !== "평가 완료");

  let shownT = targets;
  if (sp.sc === "legal") shownT = legal;
  if (sp.sc === "self") shownT = targets.filter((t) => t.scope === "자체 확대");
  if (sp.sc === "none") shownT = legal.filter((t) => !t.drills.some((d) => d.year === year)
    && !doneEvents(events).some((e) => e.key === t.key && e.done_at.startsWith(year)));
  if (sp.g) shownT = shownT.filter((t) => t.gbn === sp.g);
  shownT = [...shownT].sort((a, b) => b.drills.length - a.drills.length || a.name.localeCompare(b.name));

  // 업무 절차 — 올해 훈련이 어느 단계에 몇 건 있는가
  const yd = drills.filter((d) => d.year === year);
  const stN = (sg: string) => yd.filter((d) => d.stage === sg).length;
  const steps: Step[] = [
    { label: "대상", n: legal.length, state: "done", href: q({ v: "targets", sc: "legal" }) },
    ...DFLOW.map((sg): Step => ({ label: sg === "평가 완료" ? "평가" : sg, n: stN(sg), href: q({ v: "list" }),
      state: sg === "평가 완료" ? (stN(sg) ? "done" : "") : stN(sg) ? "on" : "" })),
  ];
  if (cov.ok < cov.n) steps[0].state = "warn";

  const HalfCell = ({ d, half, k }: { d: Drill | null; half: string; k: string }) => {
    const r = !d ? recOnly(k, half) : undefined;
    if (r) return <span className="badge ok" title={`절차 기록${r.participants ? ` · ${r.participants}명` : ""}`}>실시 {r.done_at.slice(5, 10)}</span>;
    if (!d) {
      const past = half === "상반기" ? month > 6 : false;
      return <span className={`badge ${past ? "bad" : "none"}`}>{past ? "미실시" : "계획 없음"}</span>;
    }
    return (
      <Link href={`/drills/${d.drill_id}?role=${role}`} title={`${String(d.planned_at).slice(5, 10)} · ${d.drill_type}${d.score !== null ? ` · ${d.score}점` : ""}`}>
        <span className={`badge ${stageTone(d.stage)}`}>{d.stage}</span>
      </Link>
    );
  };

  const presetKey = sp.t || "";
  const pre = presetKey ? allT.find((t) => t.key === presetKey) : null;
  const preCarry = pre ? [...pre.drills].sort((a, b) => String(b.planned_at).localeCompare(String(a.planned_at))).find((d) => d.improvements)?.improvements || "" : "";
  const pickAssets = [
    { ...LRT, dept_name: deptName.get(LRT.dept_id) || LRT.dept_id },
    ...assetList.map((a: any) => ({ asset_id: a.asset_id, asset_name: a.asset_name, asset_gbn: a.asset_gbn || "", asset_class: a.asset_class || "", dept_id: a.dept_id || "", dept_name: deptName.get(a.dept_id) || a.dept_id || "" })),
  ].sort((a, b) => (a.asset_class === "1종" || a.asset_id === LRT.asset_id ? 0 : 1) - (b.asset_class === "1종" || b.asset_id === LRT.asset_id ? 0 : 1));

  return (
    // 09-26 사용자: 메뉴 밖 화면 합치기 — 의무이행(실적증빙) › 분야별 이행 › 비상 대피훈련으로 올림(레이아웃 + 좌측)
    <UsLayout side={<PerformSide cur="/drills" />}>
      <h1 className="v2h">비상 대피훈련</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 제목 = 메뉴 이름(옛 제목 「대피훈련」) */}
      <div className="chips">
        <span className="badge">시행령 제10조제7호라목</span>
        <span className="badge none">{myDept && role !== "mgr" ? deptName.get(myDept) : "전 부서"}</span>
      </div>

      <Steps items={steps} />

      <nav className={s.tabs}>
        <Link className={v === "targets" ? s.on : ""} href={q({ v: "targets" })}>대상 시설</Link>
        <Link className={v === "list" ? s.on : ""} href={q({ v: "list" })}>훈련 목록</Link>
        <Link className={v === "new" ? s.on : ""} href={q({ v: "new" })}>새 훈련 계획</Link>
      </nav>

      {v === "targets" && (
        <>
          <Facts items={[
            { k: "1년 안 실시", v: <b className={cov.ok < cov.n ? "tone-bad" : ""}>{cov.ok}/{cov.n}</b> },
            { k: "법정 대상", v: legalStrict.length },
            { k: "확인 필요", v: legal.length - legalStrict.length },
            { k: "상반기 실시", v: `${doneH1.length}/${legal.length}` },
            { k: "하반기 계획", v: `${planH2.length}/${legal.length}` },
            { k: "갈음 확인 없음", v: <b className={subNoCeo.length ? "tone-bad" : ""}>{subNoCeo.length}</b> },
          ]} />
          <div className="chips" style={{ marginTop: 10 }}>
            <Link className={`chip ${!sp.sc ? "on" : ""}`} href={q({ sc: undefined })}>전체 {targets.length}</Link>
            <Link className={`chip ${sp.sc === "legal" ? "on" : ""}`} href={q({ sc: "legal" })}>법정 {legal.length}</Link>
            <Link className={`chip ${sp.sc === "self" ? "on" : ""}`} href={q({ sc: "self" })}>자체 확대 {targets.filter((t) => t.scope === "자체 확대").length}</Link>
            <Link className={`chip ${sp.sc === "none" ? "on" : ""}`} href={q({ sc: "none" })}>올해 없음</Link>
            {[...new Set(targets.map((t) => t.gbn))].map((g) => (
              <Link key={g} className={`chip ${sp.g === g ? "on" : ""}`} href={q({ g: sp.g === g ? undefined : g })}>{g}</Link>
            ))}
          </div>
          <table className="v2t">
            <thead><tr>
              <th>시설</th><th className="cd">구분</th>
              <th>상반기</th><th>하반기</th><th className="dt">최근 실시</th><th />
            </tr></thead>
            <tbody>
              {/* [캡처 v2] 기본 15줄 + 전체 보기 */}
              {shownT.slice(0, sp.all ? undefined : 15).map((t) => {
                const last = t.drills.find((d) => d.score !== null);
                const sub = substOf(t.key);
                const tip = [t.gbn, t.cls || "종별 없음", deptName.get(t.dept_id) || t.dept_id, t.kind, last && `최근 ${last.score}점`, sub && `${sub.state} · ${sub.where}`].filter(Boolean).join(" · ");
                return (
                  <tr key={t.key}>
                    <td title={tip}><b>{t.name}</b>{sub && <> <SubstBadge x={sub} /></>}</td>
                    <td className="cd"><span className={`badge ${scopeTone(t.scope)}`}>{t.scope}</span></td>
                    <td><HalfCell d={halfState(t.drills, "상반기")} half="상반기" k={t.key} /></td>
                    <td><HalfCell d={halfState(t.drills, "하반기")} half="하반기" k={t.key} /></td>
                    <td className="dt">{t.last_done
                      ? <span className={`badge ${t.last_done >= cov.yearAgo ? "ok" : "bad"}`}>{String(t.last_done).slice(5)}</span>
                      : <span className="badge bad">없음</span>}</td>
                    <td><Link className="btn ghost sm" href={q({ v: "new", t: t.key })}>계획</Link></td>
                  </tr>
                );
              })}
              {!shownT.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
            </tbody>
          </table>
          {!sp.all && shownT.length > 15 && <Link className="more" href={q({ all: "1" })}>전체 {shownT.length}건 →</Link>}
        </>
      )}

      {v === "list" && (
        <>
          {withCarry.length > 0 && (
            <div className={s.carry}><b>넘어온 개선 과제 {withCarry.length}건</b></div>
          )}
          {subList.map((x) => <SubstBox key={x.key} x={x} role={role} />)}
          <table className="v2t">
            <thead><tr>
              <th className="dt">훈련</th><th>대상</th><th>유형</th>
              <th className="cd">단계</th><th>대피(목표/실제)</th><th className="num">점수</th>
            </tr></thead>
            <tbody>
              {drills.slice(0, sp.all ? undefined : 15).map((d) => {
                const tip = [d.year, d.half, String(d.planned_at).slice(0, 16), d.place, deptName.get(d.dept_id) || d.dept_id, d.method, d.legal_scope,
                  d.carry_over && `넘어온 과제: ${d.carry_over}`].filter(Boolean).join(" · ");
                return (
                  <tr key={d.drill_id}>
                    <td className="dt"><Link href={`/drills/${d.drill_id}?role=${role}`}>{did(d.drill_id)}</Link></td>
                    <td title={tip}><Link href={`/drills/${d.drill_id}?role=${role}`}>{d.target_name}</Link>
                      {d.substitute === "Y" && substOf(d.target_key) && <> <SubstBadge x={substOf(d.target_key)!} /></>}</td>
                    <td>{d.drill_type}</td>
                    <td className="cd"><span className={`badge ${stageTone(d.stage)}`}>{d.stage}</span></td>
                    <td>{d.target_minutes}분 / {d.actual_minutes
                      ? (Number(d.actual_minutes) > Number(d.target_minutes) ? <span className="badge warn">{d.actual_minutes}분</span> : <b>{d.actual_minutes}분</b>)
                      : "—"}</td>
                    <td className="num">{d.score !== null ? <b>{d.score}</b> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {v === "new" && (
        <form action={createPlan} className="card">
          <input type="hidden" name="role" value={role} />
          <h3>새 훈련 계획</h3>
          <div className={s.form}>
            <div className={s.wide}><label>대상 시설 *</label><AssetPicker assets={pickAssets} defaultId={presetKey} /></div>
            <div><label>연도</label><input type="text" name="year" defaultValue={year} /></div>
            <div><label>반기</label><select name="half" defaultValue={month <= 6 ? "상반기" : "하반기"}>{HALVES.map((h) => <option key={h}>{h}</option>)}</select></div>
            <div><label>일시</label><input type="datetime-local" name="planned_at" /></div>
            <div><label>위기 유형</label><select name="drill_type">{DRILL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label>방법</label><select name="method" defaultValue="실행기반">{METHODS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label>목표 대피(분)</label><input type="text" name="target_minutes" /></div>
            <div className={s.wide}><label>장소</label><input type="text" name="place" /></div>
            <div className={s.wide}><label>시나리오</label><textarea name="scenario" /></div>
            <div className={s.wide}><label>넘어온 개선 과제</label>
              <textarea name="carry_over" defaultValue={preCarry} />
              {pre && <div className={s.hint}>{pre.name} · 지난 훈련 {pre.drills.length}건</div>}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit">계획 저장</button>
          </div>
        </form>
      )}
    </UsLayout>
  );
}
