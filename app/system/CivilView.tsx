// [캡처 v2] 중대시민재해(공중이용시설·공중교통수단) — 단계 막대 + 요약 칸 + 한 줄 표. 조문 설명·주기 비교표는 접기로(2026-09-22).
import Link from "next/link";
import { Bar } from "@/components/bits";
import Steps, { Facts } from "@/components/Steps";
import { civilStatus, planState, PLAN_TONE, type PlanGroup } from "@/lib/system";
import ClauseCards, { clauseSteps } from "./ClauseCards";
import { confirmPlan, addDrill, confirmRailDoc } from "./actions";
import SubstBox from "@/app/drills/SubstBox";
import { ceoConfirm } from "@/lib/roles";
import s from "./system.module.css";
import { ymd } from "@/lib/day";

const TODAY = ymd();
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** ① 체계 수립 — 중대시민재해(공중이용시설·공중교통수단) · 시행령 제10조 · 제11조. */
export default async function CivilView({ role, by }: { role: string; by: string }) {
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const c = await civilStatus(role);
  const groups: PlanGroup[] = by === "dept" ? c.byDept : c.byKind;
  const drillsTodo = c.drillRows.filter((r) => !r.last_drill || r.last_drill < c.yearAgo);
  const drillsDone = c.drillRows.filter((r) => r.last_drill && r.last_drill >= c.yearAgo);
  const records = [...c.docs, ...c.halfChecks, ...c.eduChecks];

  const steps = clauseSteps([
    { label: "인력·예산", nos: [1, 2], href: "#f1" },
    // [캡처 v2] K02 — 제4·5·7호 단계는 기록 입력 화면(/system/civil)으로 간다.
    { label: "안전계획", nos: [3, 4], href: q("/system/civil?clause=4") },
    { label: "절차·훈련", nos: [7, 8], href: q("/system/civil?clause=7") },
    { label: "반기 점검", nos: [5, 6], href: q("/system/civil?clause=5") },
    { label: "연 점검", nos: [11, 12, 13, 14], href: q("/inspections") },
  ], c.clauses, c.sts);

  return (
    <>
      <div className="chips"><span className="badge">법 제9조제2항</span><span className="badge">시행령 제10조·제11조</span></div>
      <Steps items={steps} />

      <Facts items={[
        { k: "갖춰짐", v: <b>{c.cnt("ok")}/{c.clauses.length}</b> },
        { k: "일부", v: c.cnt("part") },
        { k: "없음", v: <b className={c.cnt("none") ? "tone-bad" : ""}>{c.cnt("none")}</b> },
        { k: "확인 필요", v: c.unkN },
        { k: "훈련 미실시", v: <b className={drillsTodo.length ? "tone-bad" : ""}>{drillsTodo.length}/{c.drillRows.length}</b> },
      ]} />

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>점검 주기 — 중대산업재해와 비교</summary>
        <table className="v2t">
          <thead><tr><th>무엇을</th><th>중대산업재해</th><th>중대시민재해</th></tr></thead>
          <tbody>
            <tr><td>체계 점검</td><td>반기 1회</td><td title="시행령 제10조제5호">반기 1회</td></tr>
            <tr><td>관계 법령 의무이행</td><td>반기 1회</td><td title="시행령 제11조제2항제1호"><b>연 1회</b></td></tr>
            <tr><td>법정 교육</td><td>반기 1회</td><td title="시행령 제11조제2항제3호"><b>연 1회</b></td></tr>
            <tr><td>도급·용역·위탁</td><td>반기 1회</td><td title="시행령 제10조제8호"><b>연 1회</b></td></tr>
            <tr><td>안전계획</td><td>—</td><td title="시행령 제10조제4호"><b>연 1회 이상</b></td></tr>
          </tbody>
        </table>
      </details>

      <h2>각 호</h2>
      <ClauseCards clauses={c.clauses} sts={c.sts} />

      <h2 id="plan">시설별 안전계획 <span className="muted">{c.year}년 · {c.plans.length.toLocaleString()}곳</span></h2>
      <div className="chips">
        <Link className={`chip ${by !== "dept" ? "on" : ""}`} href={q("/system?area=F&by=kind") + "#plan"}>유형별</Link>
        <Link className={`chip ${by === "dept" ? "on" : ""}`} href={q("/system?area=F&by=dept") + "#plan"}>부서별</Link>
      </div>
      <table className="v2t">
        <thead>
          <tr>
            <th>{by === "dept" ? "부서" : "유형"}</th><th className="num">대상</th><th className="num">갖춰짐</th>
            <th className="num">살펴볼 곳</th><th className="num">미수립</th><th>이행률</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const look = g.noConfirm + g.mokMiss + g.draft;
            return (
              <tr key={g.key}>
                <td><a href={`#g-${g.key}`}><b>{g.label}</b></a></td>
                <td className="num">{g.n.toLocaleString()}</td>
                <td className="num">{(g.ok + g.replaced).toLocaleString()}</td>
                <td className="num" title={`갈음 확인 없음 ${g.noConfirm} · 목 누락 ${g.mokMiss} · 작성 중 ${g.draft}`}>{look || "—"}</td>
                <td className="num">{g.none ? <span className="badge bad">{g.none}</span> : "—"}</td>
                <td title={`${g.done}/${g.planned}항목`}><Bar pct={pct(g.done, g.planned)} /> {pct(g.done, g.planned)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {groups.map((g) => {
        const gaps = g.n - g.ok - g.replaced;
        return (
          <details key={g.key} id={`g-${g.key}`} className="card fold" style={{ marginTop: 8 }}>
            <summary>
              {g.label} {g.n.toLocaleString()}곳
              {gaps ? <span className="badge warn" style={{ marginLeft: 8 }}>살펴볼 곳 {gaps}</span> : <span className="badge ok" style={{ marginLeft: 8 }}>모두 갖춰짐</span>}
            </summary>
            <div className="tbl-wrap">
              <table className="v2t">
                <thead>
                  <tr>
                    <th>시설</th>{by === "dept" ? <th>유형</th> : <th>부서</th>}
                    <th>상태</th><th>경영책임자 확인</th><th>가·나·다</th><th className="num">이행</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const ps = planState(r);
                    const replace = r.plan_basis && r.plan_basis !== "자체 안전계획";
                    const verdict = r.facility_kind === "공중교통수단" ? "공중교통수단" : c.verdictOf(r) === "검토필요" ? "검토 중" : c.verdictOf(r) || "—";
                    const tip = [r.asset_id, r.asset_class, verdict, r.plan_basis, r.established_at, c.who(r.owner_staff_id)].filter(Boolean).join(" · ");
                    return (
                      <tr key={r.plan_id}>
                        <td title={tip}><Link href={q(`/system/civil?clause=4&asset=${encodeURIComponent(r.asset_id)}`) + "#planf"}><b>{r.facility_name}</b></Link></td>
                        <td>{by === "dept" ? r.asset_gbn : c.deptName.get(r.dept_id) || r.dept_id || "—"}</td>
                        <td><span className={`badge ${PLAN_TONE[ps]}`}>{ps}</span></td>
                        <td>
                          {!replace ? "—" : r.ceo_confirmed === "Y" ? <span className="badge ok" title={r.confirm_proxy === "Y" ? "대리 기록(총괄)" : ""}>{String(r.confirmed_at || "기록 있음").slice(5) || "기록 있음"}</span> : !ceoConfirm(role).ok ? (
                            <span className="badge warn">기록 없음</span>
                          ) : (
                            <form action={confirmPlan} className={s.inline}>
                              <input type="hidden" name="role" value={role} />
                              <input type="hidden" name="plan_id" value={r.plan_id} />
                              <button className="btn sm ghost" type="submit">{ceoConfirm(role).proxy ? "대리 기록" : "보고받음"}</button>
                            </form>
                          )}
                        </td>
                        <td>{r.plan_status === "미수립" ? "—" : (["ga", "na", "da"] as const).map((m, i) => (
                          <span key={m} className={`badge ${r[`mok_${m}`] === "Y" ? "ok" : "bad"}`} style={{ marginRight: 3 }}>{["가", "나", "다"][i]}</span>
                        ))}</td>
                        <td className="num">{r.plan_status === "수립" ? `${pct(Number(r.items_done), Number(r.items_planned))}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}

      <h2 id="drill">대피훈련 대상 <span className="muted">1종시설물 · 경전철 · 안 함 {drillsTodo.length}</span></h2>
      {c.lrtSubst && (
        <div id="subst">
          <SubstBox x={c.lrtSubst} role={role}>
            {c.lrtSubst.manual_id && ceoConfirm(role).ok && (
              <form action={confirmRailDoc} className={s.inline}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="manual_id" value={c.lrtSubst.manual_id} />
                <input type="date" name="reported_at" defaultValue={TODAY} />
                <button className="btn sm ghost" type="submit">{ceoConfirm(role).proxy ? "대리 기록" : "보고받음"}</button>
              </form>
            )}
          </SubstBox>
        </div>
      )}
      <table className="v2t">
        <thead><tr><th>시설</th><th>부서</th><th>판정</th><th className="dt">최근 훈련</th><th>훈련 등록</th></tr></thead>
        <tbody>
          {drillsTodo.map((r) => (
            <tr key={r.plan_id}>
              <td title={r.asset_gbn}><b>{r.facility_name}</b></td>
              <td>{c.deptName.get(r.dept_id) || r.dept_id || "—"}</td>
              <td>{r.facility_kind === "공중교통수단" ? "공중교통수단" : c.verdictOf(r) === "검토필요" ? <span className="badge none">검토 중</span> : c.verdictOf(r)}</td>
              <td className="dt">{r.last_drill ? <span className="badge warn">{String(r.last_drill).slice(5)}</span> : <span className="badge bad">없음</span>}</td>
              <td>
                <form action={addDrill} className={s.inline}>
                  <input type="hidden" name="role" value={role} />
                  <input type="hidden" name="asset_id" value={r.asset_id} />
                  <input type="hidden" name="facility_name" value={r.facility_name} />
                  <input type="hidden" name="dept_id" value={r.dept_id} />
                  <input type="date" name="done_at" defaultValue={TODAY} />
                  <button className="btn sm" type="submit">등록</button>
                </form>
              </td>
            </tr>
          ))}
          {!drillsTodo.length && <tr><td colSpan={5} className="muted">모두 1년 안 훈련함</td></tr>}
        </tbody>
      </table>
      <details className="card fold" style={{ marginTop: 8 }}>
        <summary>훈련한 {drillsDone.length}곳</summary>
        <table className="v2t">
          <thead><tr><th>시설</th><th>유형</th><th>부서</th><th className="dt">최근 훈련</th></tr></thead>
          <tbody>
            {drillsDone.map((r) => (
              <tr key={r.plan_id}><td>{r.facility_name}</td><td>{r.asset_gbn}</td><td>{c.deptName.get(r.dept_id) || r.dept_id}</td><td className="dt">{String(r.last_drill).slice(5)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>

      <h2 id="records">절차 · 점검 기록 <Link className="more" style={{ marginLeft: 8 }} href={q("/system/civil?clause=5")}>기록 입력 →</Link></h2>
      <table className="v2t">
        <thead><tr><th>조문</th><th>문서 · 기록</th><th>빠진 목</th><th className="dt">실시</th><th className="dt">보고</th><th>담당</th></tr></thead>
        <tbody>
          {records.map((m) => {
            const [a, h] = String(m.clause_ref).split("-");
            return (
              <tr key={m.manual_id}>
                <td>제{a}조{a === "11" ? "제2항" : ""}제{h}호</td>
                <td title={[m.record_kind, m.title, m.basis, m.covers && `담은 목 ${m.covers}`, m.last_check_at && `점검 ${m.last_check_at}`].filter(Boolean).join(" · ")}><b>{m.title}</b></td>
                <td>{m.missing ? <span className="badge bad">{m.missing}목</span> : <span className="muted">—</span>}</td>
                <td className="dt">{String(m.enacted_at || m.done_at || "").slice(5) || "—"}</td>
                <td className="dt">{m.reported_at ? String(m.reported_at).slice(5) : "—"}</td>
                <td>{c.who(m.owner_staff_id) || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
