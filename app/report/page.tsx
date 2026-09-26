import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import {
  tasks, approvals, duties, depts,
  contracts, contractHazards, riskAssessments, riskItems, ceoActivities, budgets, incidents, orders,
} from "@/lib/data";
import { SECURE_AXES, secureAxisOrUnset, UNSET_AXIS, gradeOf } from "@/lib/axes";
import PrintButton from "./PrintButton";
import { systemStatus, ST_LABEL } from "@/lib/system";
import { batchList, loadCycle } from "@/lib/cycle";
import { idKo } from "@/lib/labels";
import { ymd } from "@/lib/day";

export const dynamic = "force-dynamic";

// [캡처 v2] 보고서 — 인쇄 안내·법령 괄호 주석·분포 막대(부서표)·상신 사유 줄 제거 · 조치 문장 → 짧은 항목(2026-09-22)
/**
 * S17 — 인쇄용 한 장 보고서.
 * 공무원이 결재 올릴 때 그대로 쓸 수 있는 형태로 만든다.
 * 화면에서는 읽기 좋게, 인쇄하면 A4 세로 한 장에 맞게 줄어든다(@media print).
 * 브라우저 인쇄 → 「PDF로 저장」이면 파일도 된다.
 */
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const 억 = (n: number) => (n / 100000000).toFixed(1);

export default async function Report({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const half = sp.half || "하반기";
  const year = sp.year || "2026";

  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }))
    .filter((t: any) => !t.half_year || t.half_year === half);

  const du = await duties({ limit: 100000 });
  const deptList = await depts();
  // 점검 회차 — 화면에서 새로 연 회차까지 읽는다(batchList). ?batch= 로 고르고, 없으면 이 반기의
  // 결재완료 회차 중 마지막 것, 그것도 없으면 이 반기의 마지막 회차.
  const batches = (await batchList()).filter((b: any) => String(b.period_year) === year && b.half_year === half);
  const batch = batches.find((b: any) => b.batch_id === sp.batch)
    || [...batches].reverse().find((b: any) => b.status === "결재완료")
    || batches[batches.length - 1];
  const cyc = batch ? await loadCycle(batch.batch_id) : null;
  const ctr = await contracts();
  const hz = await contractHazards();
  const ra = await riskAssessments();
  const ri = await riskItems();
  const acts = (await ceoActivities()).filter((a: any) => a.deleted !== "Y"); // 기관장 예방활동 삭제 표시분은 뺀다(09-24)
  const buds = await budgets();
  const incs = await incidents();
  const ords = (await orders()).filter((o: any) => o.doc_nature !== "지도·권고·조언"); // 지도·권고·조언은 법 제4조제1항제3호 대상 아님(참고 기록)

  const done = (r: any) => r.status === "이행완료" || r.status === "점검완료";
  const mark = (r: any): "O" | "T" | "X" => {
    const c = r.check_result;
    if (c === "이행완료") return "O";
    if (c === "보완필요") return "T";
    if (c === "미이행") return "X";
    if (done(r)) return "O";
    if (r.status === "조치필요") return "T";
    return "X";
  };

  const total = rows.length;
  const okN = rows.filter(done).length;
  const over = rows.filter((r: any) => r.status === "기간초과");
  const plan = buds.reduce((s: number, b: any) => s + Number(b.planned_amount || 0), 0);
  const exec = buds.reduce((s: number, b: any) => s + Number(b.executed_amount || 0), 0);

  const byArea = [
    { k: "I", label: "중대산업재해" },
    { k: "F", label: "중대시민재해(공중이용시설·공중교통수단)" },
    { k: "M", label: "중대시민재해(원료·제조물)" },
  ].map((a) => {
    const r = rows.filter((x: any) => x.area === a.k);
    return { ...a, n: r.length, d: r.filter(done).length };
  });

  const byAxis = [...SECURE_AXES, UNSET_AXIS].map((ax) => {
    const r = rows.filter((x: any) => secureAxisOrUnset(x.code36) === ax);
    return { ax, n: r.length, d: r.filter(done).length };
  }).filter((x) => x.n > 0);

  const byDept = deptList.map((d: any) => {
    const r = rows.filter((x: any) => x.dept_id === d.dept_id);
    return {
      name: d.dept_name, n: r.length,
      O: r.filter((x: any) => mark(x) === "O").length,
      T: r.filter((x: any) => mark(x) === "T").length,
      X: r.filter((x: any) => mark(x) === "X").length,
      over: r.filter((x: any) => x.status === "기간초과").length,
    };
  }).filter((d: any) => d.n > 0).sort((a: any, b: any) => pct(a.O, a.n) - pct(b.O, b.n));

  const sum = byDept.reduce((s: any, d: any) => ({
    n: s.n + d.n, O: s.O + d.O, T: s.T + d.T, X: s.X + d.X, over: s.over + d.over,
  }), { n: 0, O: 0, T: 0, X: 0, over: 0 });

  const noClause = ctr.filter((c: any) => c.safety_clause?.includes("없음")).length;
  const noEval = ctr.filter((c: any) => c.evaluation_done !== "Y").length;
  const highHz = new Set(hz.filter((h: any) => h.risk_level === "높음").map((h: any) => h.contract_id)).size;
  const openHigh = ri.filter((x: any) => x.risk_level === "높음" && !x.measure_done_at).length;
  const today = ymd();
  const sys = await systemStatus("gm");
  const MARK: Record<string, string> = { ok: "O", part: "△", none: "X", unk: "?" };

  return (
    <div className="report">
      <div className="noprint"><FlowBar step="report" role="gm" /></div>
      <div className="noprint" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 경영책임자 보고 요약의 「한 장 보고서 인쇄」 단추로 들어온다. 인쇄 화면 모양은 그대로 둔다 */}
        <Link className="c26-back" href={`/exec?role=${sp.role || "gm"}`}>← 경영책임자 보고 요약으로</Link>
        <PrintButton />
        <span style={{ flex: 1 }} />
        {["상반기", "하반기"].map((h) => (
          <Link key={h} className={`chip ${half === h ? "on" : ""}`} href={`/report?half=${h}&year=${year}`}>{h}</Link>
        ))}
      </div>

      <div className="sheet">
        <div className="rhead">
          <div>
            <div className="rtitle">{year}년 {half} 안전보건 확보의무 이행 현황</div>
            <div className="rsub">용인특례시 · 기준일 {today}</div>
          </div>
          <table className="sign">
            <tbody>
              <tr><th>담당</th><th>팀장</th><th>과장</th><th>부시장</th><th>시장</th></tr>
              <tr><td /><td /><td /><td /><td /></tr>
            </tbody>
          </table>
        </div>

        <div className="kpis">
          <div><b>{pct(okN, total)}%</b><span>이행률</span></div>
          <div><b>{total.toLocaleString()}</b><span>점검 대상 과제</span></div>
          <div className="bad"><b>{over.length.toLocaleString()}</b><span>기한 초과</span></div>
          <div><b>{pct(exec, plan)}%</b><span>안전예산 집행</span></div>
          <div><b>{ctr.length}</b><span>도급·용역·위탁</span></div>
        </div>


        <div className="rsys">
          <b>안전보건관리체계</b> 갖춰짐 {sys.cnt("ok")} · 일부 {sys.cnt("part")} · 없음 {sys.cnt("none")} —{" "}
          {sys.clauses.map((c, i) => (
            <span key={c.no} title={`${c.name} — ${ST_LABEL[sys.sts[i]]}`}>제{c.no}호 {MARK[sys.sts[i]]}{i < 8 ? " · " : ""}</span>
          ))}
        </div>

        <h3>1. 재해 구분별</h3>
        <table className="r">
          <thead><tr><th style={{ width: "44%" }}>구분</th><th>대상</th><th>완료</th><th>이행률</th><th style={{ width: "22%" }}>분포</th></tr></thead>
          <tbody>
            {byArea.map((a) => (
              <tr key={a.k}>
                <td>{a.label}</td><td className="num">{a.n.toLocaleString()}</td><td className="num">{a.d.toLocaleString()}</td>
                <td className="num"><b>{pct(a.d, a.n)}%</b></td>
                <td><i className="gauge"><u style={{ width: `${pct(a.d, a.n)}%` }} /></i></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>2. 확보의무별</h3>
        <table className="r">
          <thead><tr><th style={{ width: "44%" }}>확보의무</th><th>대상</th><th>완료</th><th>이행률</th><th style={{ width: "22%" }}>분포</th></tr></thead>
          <tbody>
            {byAxis.map((x) => (
              <tr key={x.ax}>
                <td>{x.ax}</td><td className="num">{x.n.toLocaleString()}</td><td className="num">{x.d.toLocaleString()}</td>
                <td className="num"><b>{pct(x.d, x.n)}%</b></td>
                <td><i className="gauge"><u style={{ width: `${pct(x.d, x.n)}%` }} /></i></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>3. 부서별</h3>
        <table className="r">
          <thead><tr>
            <th style={{ width: "34%" }}>부서</th><th>대상</th><th>O</th><th>△·X</th>
            <th>기한초과</th><th>이행률</th>
          </tr></thead>
          <tbody>
            {byDept.map((d: any) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td className="num">{d.n.toLocaleString()}</td>
                <td className="num">{d.O.toLocaleString()}</td>
                <td className="num">{(d.T || 0).toLocaleString()} · {d.X.toLocaleString()}</td>
                <td className="num">{(d.over || 0).toLocaleString()}</td>
                <td className="num"><b className={gradeOf(pct(d.O, d.n)).tone}>{pct(d.O, d.n)}%</b></td>
              </tr>
            ))}
            <tr className="sumrow">
              <td>합계</td>
              <td className="num">{sum.n.toLocaleString()}</td>
              <td className="num">{sum.O.toLocaleString()}</td>
              <td className="num">{sum.T.toLocaleString()} · {sum.X.toLocaleString()}</td>
              <td className="num">{sum.over.toLocaleString()}</td>
              <td className="num">{pct(sum.O, sum.n)}%</td>
            </tr>
          </tbody>
        </table>

        <div className="two">
          <div>
            <h3>4. 점검 결과</h3>
            <table className="r">
              <tbody>
                {cyc && batch ? <>
                  <tr><td>점검 회차</td><td className="num">{idKo(batch.batch_id)} · {batch.status}</td></tr>
                  <tr><td>점검 대상</td><td className="num">{cyc.count.total.toLocaleString()}건</td></tr>
                  <tr><td>적합</td><td className="num">{cyc.count.적합.toLocaleString()}건</td></tr>
                  <tr className={cyc.count.조치중 ? "warnrow" : ""}><td>조치 중</td><td className="num">{cyc.count.조치중.toLocaleString()}건</td></tr>
                  <tr><td>판정 대기</td><td className="num">{cyc.count.판정대기.toLocaleString()}건</td></tr>
                  <tr><td>미제출</td><td className="num">{cyc.count.미제출.toLocaleString()}건</td></tr>
                </> : <tr><td colSpan={2} className="muted">이 반기에 연 점검 회차가 없습니다.</td></tr>}
              </tbody>
            </table>

            <h3>5. 위험성평가</h3>
            <table className="r">
              <tbody>
                <tr><td>평가 실시 현장</td><td className="num">{ra.length}곳</td></tr>
                <tr><td>확인한 위험요인</td><td className="num">{ri.length}건</td></tr>
                <tr><td>개선조치 완료</td><td className="num">{ri.filter((x: any) => x.measure_done_at).length}건</td></tr>
                <tr className={openHigh ? "warnrow" : ""}><td>미조치 「높음」</td><td className="num">{openHigh}건</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3>6. 도급·용역·위탁</h3>
            <table className="r">
              <tbody>
                <tr><td>계약 건수 · 금액</td><td className="num">{ctr.length}건 · {억(ctr.reduce((s: number, c: any) => s + Number(c.amount || 0), 0))}억원</td></tr>
                <tr className={noClause ? "warnrow" : ""}><td>안전보건 조항 없음</td><td className="num">{noClause}건</td></tr>
                <tr className={noEval ? "warnrow" : ""}><td>수급인 평가 미실시</td><td className="num">{noEval}건</td></tr>
                <tr><td>위험도 「높음」 현장</td><td className="num">{highHz}건</td></tr>
              </tbody>
            </table>

            <h3>7. 경영책임자 활동 · 예산</h3>
            <table className="r">
              <tbody>
                <tr><td>예방활동 기록</td><td className="num">{acts.length}건</td></tr>
                <tr><td>안전보건 예산</td><td className="num">편성 {억(plan)}억 · 집행 {억(exec)}억</td></tr>
                <tr><td>행정기관 명령 미종결</td><td className="num">{ords.filter((o: any) => !o.closed_at).length}건</td></tr>
                <tr className={ords.some((o: any) => !o.done_at && (o.extended_due || o.due_date) && (o.extended_due || o.due_date) < today) ? "warnrow" : ""}><td>그중 기한 넘김</td><td className="num">{ords.filter((o: any) => !o.done_at && (o.extended_due || o.due_date) && (o.extended_due || o.due_date) < today).length}건</td></tr>
                <tr><td>재해 발생</td><td className="num">{incs.filter((i: any) => i.event_class !== "아차사고").length}건</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3>8. 조치 필요</h3>
        <ol className="todo">
          {byDept.slice(0, 3).map((d: any) => (
            <li key={d.name}>
              <b>{d.name}</b> {pct(d.O, d.n)}% · 미이행 {d.X} · 기한초과 {d.over}
            </li>
          ))}
          {noClause > 0 && <li>안전보건 조항 없는 계약 <b>{noClause}건</b></li>}
          {noEval > 0 && <li>수급인 평가 미실시 <b>{noEval}건</b></li>}
          {openHigh > 0 && <li>미조치 「높음」 위험요인 <b>{openHigh}건</b></li>}
          {cyc && cyc.count.조치중 > 0 && <li>점검 조치 중 <b>{cyc.count.조치중}건</b></li>}
        </ol>

        <div className="foot2">
          {du.length.toLocaleString()}개 의무 · {deptList.length}개 부서 기준
        </div>
      </div>
    </div>
  );
}
