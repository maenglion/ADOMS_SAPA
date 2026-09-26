import { codeCatalog, previewScope, lookups, allTasks, codeCycle, ruleBasisOf, codesByCycle, batchList, annualChecks, CYCLE_LABEL } from "@/lib/cycle";
import { createBatch } from "./actions";
import { idKo } from "@/lib/labels";
import st from "./inspections.module.css";

// [캡처 v2] 접기(기본 닫힘, 고르는 중이면 열림) · 안내문 삭제
/**
 * ③ 점검 계획 — 「2단 선택 패널」.
 * 왼쪽: 확보의무 대분류(법 제4조제1항 각 호 · 제5조) 또는 의무조항 36 · 오른쪽: 대상 부서 → 연도·반기.
 * 「대상 세어 보기」로 대상 과제 수를 먼저 보고, 「취합 시작」으로 점검을 연다.
 */
export default async function PlanPanel({ sp, role }: { sp: Record<string, any>; role: string }) {
  const arr = (k: string): string[] => (Array.isArray(sp[k]) ? sp[k] : sp[k] ? [sp[k]] : []).map(String);
  const cat = await codeCatalog();
  const { deptList } = await lookups();
  const tasks = await allTasks();
  const deptWithTasks = deptList.filter((d: any) => tasks.some((t) => t.dept_id === d.dept_id));
  const periods = [...new Set(tasks.map((t) => `${t.period_year}|${t.half_year}`).filter((p) => !p.includes("undefined")))].sort();

  const ax = arr("ax").map(Number);
  const cs = new Set(arr("c"));
  const ds = arr("d");
  const [year, half] = String(sp.p || periods[periods.length - 1] || "2026|하반기").split("|");
  const codes = new Set(cs);
  ax.forEach((i) => cat[i]?.codes.forEach((c) => codes.add(c.code)));
  const asked = sp.view === "plan" && (codes.size > 0 || ds.length > 0);
  const pv = asked && codes.size && ds.length ? await previewScope({ year, half, codes: [...codes], deptIds: ds }) : null;
  const dn = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
  // 근거 주기(09-21) — 고른 코드의 주기와, 연 1회 항목이 올해 이미 채워졌는지.
  const split = codesByCycle([...codes]);
  const annualDone = pv && split.연.length
    ? annualChecks(await batchList(), year, split.연).filter((a) => a.state === "충족") : [];

  return (
    <details className="card fold" id="plan" open={sp.view === "plan"} style={{ marginTop: 12 }}>
      <summary>+ 새 점검 만들기</summary>
      <form method="get" action="/inspections">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="view" value="plan" />
        <div className={st.two}>
          <div>
            <div className={st.colhead}>① 의무조항</div>
            <div className={st.pick}>
              {cat.map((g, i) => (
                <div key={g.axis} className={st.axis}>
                  <label className={st.ck}>
                    <input type="checkbox" name="ax" value={i} defaultChecked={ax.includes(i)} />
                    <b>{g.axis}</b> <span className="muted">{g.codes.length}</span>
                  </label>
                  <div className={st.codes}>
                    {g.codes.map((c) => (
                      <label key={c.code} className={st.ck} title={`과제 ${c.n}건 · ${codeCycle(c.code).basis}`}>
                        <input type="checkbox" name="c" value={c.code} defaultChecked={cs.has(c.code)} />
                        {c.code} {c.name}
                        <span className={st.cyc}>{codeCycle(c.code).cycle === "상시" ? "" : CYCLE_LABEL[codeCycle(c.code).cycle]}</span>
                      </label>
                    ))}
                    {g.codes.length === 0 && <span className="muted">없음</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className={st.colhead}>② 부서</div>
            <div className={st.pick}>
              {deptWithTasks.map((d: any) => (
                <label key={d.dept_id} className={st.ck}>
                  <input type="checkbox" name="d" value={d.dept_id} defaultChecked={ds.includes(d.dept_id)} />
                  {d.dept_name} <span className="muted">{tasks.filter((t) => t.dept_id === d.dept_id).length}</span>
                </label>
              ))}
            </div>
            <div className={st.colhead} style={{ marginTop: 12 }}>③ 반기</div>
            <select name="p" defaultValue={`${year}|${half}`}>
              {periods.map((p) => <option key={p} value={p}>{p.replace("|", "년 ")}</option>)}
            </select>
            <div style={{ marginTop: 12 }}>
              <button className="btn" type="submit">대상 세기</button>
            </div>
          </div>
        </div>
      </form>

      {asked && !pv && (
        <p className="muted" style={{ marginTop: 10 }}>
          {codes.size === 0 ? "의무조항을 고르십시오. " : ""}
          {ds.length === 0 ? "부서를 고르십시오." : ""}
        </p>
      )}

      {pv && (
        <div className={st.preview}>
          <div>
            <b>{year}년 {half}</b> · <span title={[...codes].sort().join(", ")}>의무조항 {codes.size}</span> · 부서 {ds.length} →
            대상 <b className={st.big}>{pv.total.toLocaleString()}</b>건
          </div>
          <div className="chips" style={{ margin: "6px 0" }}>
            <span className="badge none" title={ruleBasisOf([...codes])}>반기 {split.반기.length} · 연 {split.연.length} · 상시 {split.상시.length}</span>
            {annualDone.length > 0 && (
              <span className="badge none" title={annualDone.map((a) => `${a.code}(${a.approved.map((b) => idKo(b.batch_id)).join("·")})`).join(", ")}>연 1회 결재됨 {annualDone.length}</span>
            )}
          </div>
          <div className="chips">
            {pv.byDept.map((x) => <span key={x.id} className={`badge ${x.n ? "" : "none"}`}>{dn.get(x.id) || x.id} {x.n}</span>)}
          </div>
          {pv.total === 0 ? (
            <p className="muted">대상 과제 없음</p>
          ) : (
            <form action={createBatch} className={st.row}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="half" value={half} />
              {[...codes].map((c) => <input key={c} type="hidden" name="c" value={c} />)}
              {ds.map((d) => <input key={d} type="hidden" name="d" value={d} />)}
              <input type="text" name="title" placeholder={`${year}년 ${half} 안전보건 의무이행 점검`} style={{ minWidth: 320 }} />
              <button className="btn" type="submit">취합 시작</button>
            </form>
          )}
        </div>
      )}
    </details>
  );
}
