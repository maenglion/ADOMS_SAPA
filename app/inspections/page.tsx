// [캡처 v2] 글자 줄이기 — 설명 문단·법령 인용 삭제, 단계 막대 맨 위, 표 6칸 이하 한 줄, 보조 표는 접기(09-22)
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { tasks, approvals, depts, orders, incidents, inspections as inspRows, readTable } from "@/lib/data";
import { Bar } from "@/components/bits";
import { SECURE_AXES, secureAxisOrUnset, UNSET_AXIS, gradeOf } from "@/lib/axes";
import { Donut, BarGroup, ChartSwitch } from "@/components/Chart";
import { idKo } from "@/lib/labels";
import { loadAllCycles, annualChecks, halfChecks, CYCLE_LABEL } from "@/lib/cycle";
import Steps, { type Step } from "@/components/Steps";
import PlanPanel from "./PlanPanel";
import { UsLayout } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 레이아웃·좌측 안에서 연다
import MenuSide from "@/components/us/MenuSide";
import { OldTitle } from "@/app/check/_parts";
import Approve from "./Approve";
import { redirect } from "next/navigation";   // 09-26 사용자: 옛 점검 화면 합치기 — 새 자리로 넘기기
import { OLD_CHECK_MERGED, oldTarget } from "@/lib/check_merge";
import st from "./inspections.module.css";

export const dynamic = "force-dynamic";

/** ③ 점검 계획 · ⑦ 결재(`?view=approve`). 점검별 숫자는 `lib/cycle.ts` 한 곳에서 센다. */
export default async function Inspections({ searchParams }: { searchParams: Promise<Record<string, any>> }) {
  const sp = await searchParams;
  // 09-26 사용자: 옛 점검 화면 합치기 — 점검 계획은 이행점검 › 취합 대상 설정, 회차 결재는 이행점검 › 점검 총괄표로 넘긴다.
  //   이 파일은 지우지 않았다. lib/check_merge.ts OLD_CHECK_MERGED = false 로 두면 아래 옛 화면이 다시 열린다.
  if (OLD_CHECK_MERGED) redirect(await oldTarget("inspections", sp));
  const role = String(sp.role || "gm");
  const graph = String(sp.g || "");
  const tk = String(sp.tk || "");   // 09-26 사용자: 메뉴 밖 화면 합치기 — 돌아갈 이행점검 대상
  const side = <MenuSide group="이행점검및 조치" />;
  if (sp.view === "approve") return <UsLayout side={side}><Approve sp={sp} role={role} /></UsLayout>;

  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
  const deptList = await depts();
  const ords = (await orders()).filter((o: any) => o.doc_nature !== "지도·권고·조언"); // 지도·권고·조언은 참고 기록
  const incs = await incidents();
  const ins = await inspRows();
  const acts = await readTable("action", "action_id");
  const cycles = await loadAllCycles();
  const taskOf = new Map(rows.map((r: any) => [r.task_id, r]));
  const actByInsp = new Map<string, any>();
  acts.forEach((a: any) => actByInsp.set(a.insp_id, a));
  const 문제 = (r: string) => r === "보완필요" || r === "부적합";
  const flagged = ins.filter((x: any) => 문제(x.result));
  const made = sp.made ? cycles.find((c) => c.batch?.batch_id === sp.b) : undefined;

  const done = (r: any) => r.status === "이행완료" || r.status === "점검완료";
  const AXES = [...SECURE_AXES, UNSET_AXIS];
  const axisOf = (r: any) => secureAxisOrUnset(r.code36);

  const matrix = new Map<string, Map<string, { n: number; d: number }>>();
  rows.forEach((r: any) => {
    const a = axisOf(r);
    const m = matrix.get(a) || new Map();
    const cell = m.get(r.dept_id) || { n: 0, d: 0 };
    cell.n++;
    if (done(r)) cell.d++;
    m.set(r.dept_id, cell);
    matrix.set(a, m);
  });
  const allBatches = cycles[0]?.batches || [];
  const activeCodes = [...new Set(rows.map((r: any) => String(r.code36 || "").split(";")[0].trim()).filter(Boolean))];
  const nowY = new Date().getFullYear();
  const nowHalf = new Date().getMonth() < 6 ? "상반기" : "하반기";
  const annual = annualChecks(allBatches, nowY, activeCodes);
  const half = halfChecks(allBatches, nowY, nowHalf, activeCodes);
  const halfShort = half.filter((h) => h.state !== "충족");

  // 표 칸 6개 이하 — 과제가 많은 부서 4곳만
  const shownDepts = deptList
    .map((d: any) => ({ ...d, n: rows.filter((r: any) => r.dept_id === d.dept_id).length }))
    .filter((d: any) => d.n > 0).sort((a: any, b: any) => b.n - a.n).slice(0, 4);

  // [캡처 v2] 단계 막대 — 고른 점검(없으면 진행 중인 첫 점검)의 한 바퀴
  const curC = cycles.find((c) => c.batch?.batch_id === sp.b)
    || cycles.find((c) => c.batch?.status !== "결재완료") || cycles[0];
  const k = curC?.count;
  const bq = curC?.batch ? `&b=${curC.batch.batch_id}` : "";
  const steps: Step[] = [
    { label: "계획", n: cycles.length, state: "done", href: `/inspections?role=${role}&view=plan#plan` },
    { label: "제출", n: k?.미제출 ?? 0, state: k?.미제출 ? "on" : "done", href: `/evidence?role=road` },
    { label: "판정", n: k?.판정대기 ?? 0, state: k?.판정대기 ? "on" : "done", href: `/review?role=mgr${bq}` },
    { label: "조치", n: k?.조치중 ?? 0, state: k?.조치중 ? "warn" : "", href: `/actions?role=gm${bq}` },
    { label: "결재", n: curC?.batch?.status || "-", state: curC?.batch?.status === "결재완료" ? "done" : "", href: `/inspections?role=gm&view=approve${bq}` },
  ];

  const inspShown = [...flagged, ...ins.filter((x: any) => !문제(x.result))].slice(0, sp.all ? 80 : 15);

  return (
    <UsLayout side={side}>   {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 레이아웃·좌측 */}
      <FlowBar step="plan" role={role} carry={sp.b ? `b=${sp.b}` : ""} />
      <OldTitle title="점검 계획" role={role} tk={tk} />
      {curC?.batch && <div className="chips"><span className="badge">{curC.batch.title}</span></div>}
      <Steps items={steps} />

      {made && (
        <div className={`card ${st.made}`}>
          점검 열림 — <b>{made.batch!.title}</b> · 대상 {made.count.total.toLocaleString()}건
          <div className={st.btns}>
            <Link className="btn sm" href={`/review?role=mgr&b=${made.batch!.batch_id}`}>판정 →</Link>
            <Link className="btn sm ghost" href={`/evidence?role=road`}>부서 제출</Link>
          </div>
        </div>
      )}

      <PlanPanel sp={sp} role={role} />

      <h2>진행 중인 점검</h2>
      <div className="grid g3">
        {cycles.map((c) => {
          const b = c.batch!;
          const n = c.count;
          const pct = n.total ? Math.round((n.판정끝남 / n.total) * 100) : 0;
          return (
            <div className="card" key={b.batch_id} style={{ outline: sp.b === b.batch_id ? "2px solid var(--blue)" : undefined }}>
              <div style={{ fontWeight: 600, color: "var(--deep)" }} title={`${idKo(b.batch_id)} · ${c.ruleBasis}`}>{b.title}</div>
              <div className="chips" style={{ margin: "6px 0" }}>
                <span className={`badge ${b.status === "결재완료" ? "ok" : b.status === "결재요청" ? "warn" : "none"}`}>{b.status}</span>
                <span className="badge">대상 {n.total.toLocaleString()}</span>
                <span className="badge">판정 {pct}%</span>
              </div>
              <Bar pct={pct} />
              <div className={st.counts}>
                <span className="badge warn">대기 {n.판정대기.toLocaleString()}</span>
                <span className="badge bad">조치 {n.조치중}</span>
                <span className="badge ok">적합 {n.적합.toLocaleString()}</span>
                <span className="badge none">미제출 {n.미제출.toLocaleString()}</span>
              </div>
              <div className={st.btns}>
                <Link className="btn sm" href={`/review?role=mgr&b=${b.batch_id}`}>판정</Link>
                <Link className="btn sm ghost" href={`/actions?role=gm&b=${b.batch_id}`}>조치</Link>
                <Link className="btn sm ghost" href={`/inspections?role=gm&view=approve&b=${b.batch_id}`}>결재</Link>
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: 18 }}>점검 결과 <span className="muted">{ins.length.toLocaleString()} · 보완·부적합 {flagged.length}</span></h2>
      <table className="v2t">
        <thead><tr>
          <th className="dt">점검일</th><th>의무</th><th>대상</th>
          <th className="cd">결과</th><th>조치</th><th className="dt">기한</th>
        </tr></thead>
        <tbody>
          {inspShown.map((x: any) => {
            const t = taskOf.get(x.task_id);
            const a = actByInsp.get(x.insp_id);
            return (
              <tr key={x.insp_id}>
                <td className="dt">{String(x.insp_date || "").slice(5)}</td>
                <td title={`${t?.law || ""} ${t?.unit_label_ko || ""} · ${x.finding || ""}`}>{t?.duty_name || t?.code36_name || x.task_id}</td>
                <td title={t?.asset_name || t?.target_name}>{t?.asset_name || t?.target_name}</td>
                <td className="cd"><span className={`badge ${x.result === "부적합" ? "bad" : x.result === "보완필요" ? "warn" : "ok"}`}>{x.result}</span></td>
                <td>{a ? a.result || a.action_type : <span className="muted">—</span>}</td>
                <td className="dt">{a ? String(a.done_at || a.due_date || "").slice(5) : <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!sp.all && ins.length > 15 && <Link className="more" href={`/inspections?role=${role}&all=1`}>전체 {ins.length.toLocaleString()}건 →</Link>}

      <details className="card fold" style={{ marginTop: 14 }}>
        <summary>점검 주기 {nowY} <span className="badge warn">반기 남음 {halfShort.length}</span> <Link className="btn sm ghost" href={`/calendar?role=${role}`}>연간 일정</Link></summary>
        <div className="grid g2">
          <div>
            <h3>{CYCLE_LABEL.연}</h3>
            <ul className={st.rules}>
              {annual.length === 0 && <li className="muted">없음</li>}
              {annual.map((a) => <li key={a.code} title={a.basis}><span className={`badge ${a.tone}`}>{a.code} {a.state}</span></li>)}
            </ul>
          </div>
          <div>
            <h3>{CYCLE_LABEL.반기} <span className="muted">{nowHalf}</span></h3>
            <ul className={st.rules}>
              {halfShort.slice(0, 8).map((a) => <li key={a.code} title={a.basis}><span className={`badge ${a.tone}`}>{a.code} {a.state}</span></li>)}
            </ul>
          </div>
        </div>
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>대분류별 비중 · 부서별 이행</summary>
        <ChartSwitch base="/inspections" sp={{ role }} cur={graph} />
        {(() => {
          const slices = AXES.map((a) => ({ label: a, n: rows.filter((r: any) => axisOf(r) === a).length }));
          return graph === "pie" ? <Donut slices={slices} center={rows.length.toLocaleString()} sub="과제" /> : <BarGroup slices={slices} />;
        })()}
        <table className="v2t" style={{ marginTop: 12 }}>
          <thead><tr>
            <th>대분류</th>
            {shownDepts.map((d: any) => <th key={d.dept_id}>{d.dept_name}</th>)}
            <th>계</th>
          </tr></thead>
          <tbody>
            {AXES.map((a) => {
              const m = matrix.get(a) || new Map();
              const tot = [...m.values()].reduce((s: any, c: any) => ({ n: s.n + c.n, d: s.d + c.d }), { n: 0, d: 0 });
              return (
                <tr key={a}>
                  <td title={a}>{a}</td>
                  {shownDepts.map((d: any) => {
                    const c = m.get(d.dept_id);
                    if (!c) return <td key={d.dept_id} className="muted">-</td>;
                    const pct = Math.round((c.d / c.n) * 100);
                    return <td key={d.dept_id} title={`${c.d}/${c.n}`}><span className={`badge ${gradeOf(pct).tone}`}>{pct}%</span></td>;
                  })}
                  <td title={`${tot.d}/${tot.n}`}>{tot.n ? Math.round((tot.d / tot.n) * 100) : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>명령·지시 {ords.length} · 사고 {incs.length}</summary>
        <table className="v2t">
          <thead><tr><th className="dt">접수</th><th>발령</th><th>내용</th><th className="dt">기한</th><th>결과</th></tr></thead>
          <tbody>
            {ords.map((o: any) => (
              <tr key={o.order_id}>
                <td className="dt">{String(o.received_at || "").slice(5)}</td><td>{o.issuer}</td>
                <td title={`${o.content} · ${o.law}`}>{o.content}</td>
                <td className="dt">{String(o.due_date || "").slice(5)}</td>
                <td><span className={`badge ${o.done_at ? "ok" : "warn"}`}>{o.result || "조치 중"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="v2t" style={{ marginTop: 12 }}>
          <thead><tr><th className="dt">일자</th><th>구분</th><th>개요</th><th>재발방지</th><th className="dt">기한</th></tr></thead>
          <tbody>
            {incs.map((i: any) => (
              <tr key={i.incident_id}>
                <td className="dt">{String(i.occurred_at || "").slice(5)}</td>
                <td><span className="badge warn">{i.disaster_type}</span></td>
                <td title={`${i.summary} · ${i.cause} · ${i.casualties}`}>{i.summary}</td>
                <td title={i.recurrence_plan}>{i.recurrence_plan}</td>
                <td className="dt">{i.plan_done_at ? "완료" : String(i.plan_due || "").slice(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </UsLayout>
  );
}
