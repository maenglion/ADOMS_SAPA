// [400 · 교육자료 버전] SCR-090 이행점검 — 의무이행 점검 총괄표(O/△/X/- 매트릭스 · 이행률 자동 집계 · 결재하기 · 엑셀 다운로드)
import Link from "next/link";
import { redirect } from "next/navigation";
import { UsLayout } from "@/components/us/Parts";
import { canApprove, ROLE_STAFF } from "@/lib/roles";
import { depts, staff, readTable, type Row } from "@/lib/data";
import { appendRow } from "@/lib/write";
import { isTrack, NAME, roundOf, cellsOfRound, siteOf, SYM, SYM_CLS, rateOf, newId, fmtAt, type St, SRC_LABEL, RULE_TEXT, oldBatchesOf,
  taskRatesOf, cellRateAll, RATE_NOTE } from "../../_lib";   // 09-26 사용자: 옛 점검 화면 합치기(2차: 과제 단위 이행률)
import { CheckSide, CheckHead, Modal } from "../../_parts";
import { approveRound } from "../actions";

export const dynamic = "force-dynamic";

/** 경영책임자가 총괄표를 열면 활동기록(SCR-026)에 「이행률 조회(트랙)」을 남긴다 — 같은 조회는 10분에 한 번. */
async function logCeoView(track: string) {
  const act = `이행률 조회(${NAME[track as "ws"]})`;
  const rows = await readTable("usf_ceo_log", "log_id");
  const last = rows.filter((r) => r.activity === act).map((r) => String(r.at)).sort().pop() || "";
  if (last && Date.now() - +new Date(last) < 10 * 60 * 1000) return;
  await appendRow("usf_ceo_log", {
    log_id: newId("CLOG"), at: new Date().toISOString(), activity: act,
    detail: `이행점검 및 조치 › 이행점검(${NAME[track as "ws"]}) 점검 총괄표 조회`, by: ROLE_STAFF.ceo,
  }, ROLE_STAFF.ceo, "경영책임자 활동기록");
}

export default async function CheckSummary({ params, searchParams }: {
  params: Promise<{ track: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { track } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (!isTrack(track)) redirect(`/check/ws/summary?role=${role}`);
  if (role === "ceo") await logCeoView(track);

  const round = await roundOf(track, sp.r);
  if (!round) {
    return (
      <UsLayout side={<CheckSide track={track} role={role} page="summary" />}>
        <CheckHead track={track} sub={`의무이행(${NAME[track]}) 점검 총괄표`} />
        <div className="us-card w">아직 취합한 점검이 없습니다. <Link href={`/check/${track}?role=${role}`}>취합 대상 설정 →</Link></div>
      </UsLayout>
    );
  }
  const { items, deptIds, cells, period } = await cellsOfRound(track, round);
  const trate = await taskRatesOf(track, deptIds, period.year);   // 09-26 사용자: 옛 점검 화면 합치기 2차 — 과제 단위 이행률
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, String(d.dept_name)]));
  const nm = new Map((await staff()).map((s: Row) => [s.staff_id, String(s.display_name || "")]));
  const locked = round.status === "결재완료";
  const base = `/check/${track}/summary?role=${role}&r=${round.round_id}`;
  const stOf = (it: string, d: string): St => cells.get(`${it}|${d}`)?.status || "해당없음";
  // 09-26 사용자: 옛 점검 화면 합치기 — 칸의 근거(툴팁) · 옛 과제 단위 점검 회차(결재 기록)
  const srcOf = (it: string, d: string) => { const c = cells.get(`${it}|${d}`); return c ? `${SRC_LABEL[c.src]}${c.inherited ? `(지난 회차에서 물려받음 · ${c.inherited.title} · ${fmtAt(c.inherited.at).slice(0, 10)})` : ""}${c.basis ? ` · ${c.basis}` : ""}` : ""; };   // 09-26 2차: 물려받음 표시
  const olds = await oldBatchesOf(track);
  const cnt = (n: number) => (n ? String(n) : "-");

  return (
    <UsLayout side={<CheckSide track={track} role={role} page="summary" />}>
      <CheckHead track={track} sub={`의무이행(${NAME[track]}) 점검 총괄표`} right={
        <div className="usf-roundbar">
          {canApprove(role) && !locked
            ? <Link className="us-btn w" href={`${base}&modal=approve`}>결재하기</Link>
            : <span className="us-btn w usf-off" title={locked ? "결재 완료" : "결재 권한이 없습니다"}>결재하기</span>}
          <a className="us-btn w" href={`/check/${track}/summary/excel?r=${round.round_id}`}>엑셀 다운로드</a>
        </div>
      } />
      <p className="usf-meta">
        {round.title} · {fmtAt(round.created_at).slice(0, 10)} 취합 ·{" "}
        <Link href={`/check/${track}/review?role=${role}&r=${round.round_id}`}>항목별 점검</Link> ·{" "}
        {locked
          ? <b className="usf-okt">결재완료 — {nm.get(round.approved_by) || round.approved_by} · {fmtAt(round.approved_at)}{round.approve_note ? ` · ${round.approve_note}` : ""}</b>
          : <span>상태 {round.status}</span>}
        {/* 09-26 사용자: 옛 점검 화면 합치기 — 옛 회차 결재의 「점검 방식」(직접·위탁·보고받은 날)을 이 결재로 */}
        {round.insp_method && <span> · {round.insp_method === "위탁 점검" ? `위탁 점검(${round.outsource_org || "-"}) · 결과 보고받음 ${round.report_received_at || "-"}` : "직접 점검"}</span>}
      </p>
      {sp.done && <p className="usf-ok">결재했습니다. 보완필요·미이행 항목은 해당 부서에 조치 요구를 보냈습니다.</p>}

      <div className="usf-scroll">
        <table className="us-tbl usf-mx">
          <thead>
            <tr>
              <th rowSpan={2} className="usf-mx-l">점검사항</th>
              <th colSpan={deptIds.length}>사업장</th>
              <th rowSpan={2} className="usf-c">전체항목</th>
              <th rowSpan={2} className="usf-c">이행완료<br />(O)</th>
              <th rowSpan={2} className="usf-c">보완필요<br />(△)</th>
              <th rowSpan={2} className="usf-c">미이행<br />(X)</th>
              <th rowSpan={2} className="usf-c">해당없음<br />(-)</th>
            </tr>
            <tr>{deptIds.map((d) => <th key={d} className="usf-dh"><small>{siteOf(d)}:</small>{dn.get(d) || d}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const sts = deptIds.map((d) => stOf(it.key, d));
              const n = (s: St) => sts.filter((x) => x === s).length;
              return (
                <tr key={it.key}>
                  <td className="usf-mx-l">{it.no}. {it.label}</td>
                  {deptIds.map((d) => {
                    const s = stOf(it.key, d);
                    return (
                      <td key={d} className={`usf-sym ${SYM_CLS[s]}`}>
                        <Link href={`/check/${track}/review?role=${role}&r=${round.round_id}&open=${it.key}#${it.key}`} title={`${dn.get(d)} · ${s} — ${srcOf(it.key, d)}`}>{SYM[s]}</Link>
                      </td>
                    );
                  })}
                  <td className="c">{deptIds.length}</td>
                  <td className="c">{cnt(n("이행완료"))}</td>
                  <td className="c">{cnt(n("보완필요"))}</td>
                  <td className="c">{cnt(n("미이행"))}</td>
                  <td className="c">{cnt(n("해당없음"))}</td>
                </tr>
              );
            })}
            <tr className="usf-rate">
              <td>이 행 률<small className="f26-unit">칸 단위</small></td>
              {deptIds.map((d) => <td key={d}>{rateOf(items.map((it) => stOf(it.key, d)))}</td>)}
              <td className="c" title="이 회차 칸 전부">{cellRateAll(cells, deptIds, items.map((it) => it.key))}</td><td /><td /><td /><td />
            </tr>
            {/* 09-26 사용자: 옛 점검 화면 합치기 2차 — 「과제 단위 이행율까지 보여줘 보자」(이행현황표와 같은 계산) */}
            <tr className="usf-rate f26-trate">
              <td>이 행 률<small className="f26-unit">과제 단위</small></td>
              {deptIds.map((d) => <td key={d}>{trate.byDept.get(d) || "-"}</td>)}
              <td className="c" title="이 회차 부서 전체 과제">{trate.total}</td><td /><td /><td /><td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="us-muted usf-note">이행률 = 이행완료 ÷ (전체 − 해당없음). 칸을 누르면 그 항목의 점검 화면으로 갑니다.</p>
      <p className="us-muted usf-note">{RATE_NOTE} 과제 단위는 이행현황표와 같은 값({period.year}년 · 이 대상 점검사항 전체)입니다.</p>
      {/* 09-26 사용자: 옛 점검 화면 합치기 — 칸 판정 규칙(근거는 칸에 마우스를 올리면 보인다) */}
      <p className="f26-rule">{RULE_TEXT} 칸에 마우스를 올리면 근거가 보입니다.</p>

      {/* 09-26 사용자: 옛 점검 화면 합치기 — 옛 회차 결재(과제 단위 반기 점검)는 기록으로 여기 모은다. 새 결재는 위 「결재하기」 하나로 한다. */}
      {olds.length > 0 && (
        <details className="us-card w f26-fold" id="old" open={Boolean(sp.b)}>
          <summary>지난 반기 점검 회차 결재 기록(과제 단위) {olds.length}회</summary>
          <table className="us-tbl f26-tbl">
            <thead><tr><th>회차</th><th>반기</th><th>과제</th><th>적합</th><th>보완·부적합</th><th>판정 대기</th><th>조치 중</th><th>점검 방식</th><th>상신</th><th>확정</th><th>상태</th></tr></thead>
            <tbody>
              {olds.map((o) => {
                const b = o.batch;
                return (
                  <tr key={b.batch_id} className={sp.b === b.batch_id ? "f26-hit" : undefined}>
                    <td>{b.title}</td>
                    <td className="c">{b.period_year} {b.half_year}</td>
                    <td className="c">{o.n.total.toLocaleString()}</td>
                    <td className="c">{o.n.ok.toLocaleString()}</td>
                    <td className="c">{o.n.fix} · {o.n.bad}</td>
                    <td className="c">{o.n.wait.toLocaleString()}</td>
                    <td className="c">{o.n.open}</td>
                    <td className="c">{b.insp_method === "위탁 점검" ? `위탁 · ${b.outsource_org || "-"}${b.report_received_at ? ` · 보고받음 ${b.report_received_at}` : " · 보고 없음"}` : "직접 점검"}</td>
                    <td className="c">{String(b.requested_at || "").slice(0, 10) || "-"}</td>
                    <td className="c">{String(b.approved_at || "").slice(0, 10) || (b.status === "결재완료" ? "확정" : "-")}</td>
                    <td className="c"><span className={`us-st ${b.status === "결재완료" ? "ok" : "warn"}`}>{b.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="us-muted f26-note">이 대상에 드는 과제만 셉니다. 과제 결재는 항목별 점검의 「과제 결재 기록」에 보이고, 보완·부적합 조치는 미이행 조치·재점검에서 이어집니다.
            {olds.some((o) => o.batch.status !== "결재완료") && " 결재 전인 지난 회차는 따로 결재하지 않고, 이 점검의 결재로 갈음합니다."}</p>
        </details>
      )}

      {sp.modal === "approve" && canApprove(role) && !locked && (
        <Modal title="결재하기" close={base}>
          <form action={approveRound} className="usf-form">
            {/* 09-26 사용자: 옛 점검 화면 합치기 — 위탁 점검 입력이 빠지면 결재를 막고 여기 알린다 */}
            {sp.err && <p className="usf-err">{sp.err === "org" ? "위탁 점검이면 위탁 기관을 적으십시오." : sp.err === "report" ? "위탁 점검이면 점검 결과를 보고받은 날을 적어야 결재할 수 있습니다." : "결재하지 못했습니다."}</p>}
            <input type="hidden" name="track" value={track} />
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="r" value={round.round_id} />
            <table className="us-tbl">
              <tbody>
                <tr><th>점검명</th><td>{round.title}</td></tr>
                <tr><th>결재자</th><td>{nm.get(ROLE_STAFF[role]) || ROLE_STAFF[role]}</td></tr>
                {/* 09-26 사용자: 옛 점검 화면 합치기 2차 — 칸 단위 · 과제 단위 함께 */}
                <tr><th>이행률</th><td>{deptIds.map((d) => `${dn.get(d)} ${rateOf(items.map((it) => stOf(it.key, d)))}(과제 ${trate.byDept.get(d) || "-"})`).join(" · ")}</td></tr>
                {/* 09-26 사용자: 옛 점검 화면 합치기 — 점검 방식(옛 회차 결재에서 옮김). 위탁 점검이면 결과를 보고받은 날이 있어야 결재한다
                    (중대재해처벌법 시행령 제5조제2항제1호 · 제9조제2항제1호 · 제11조제2항제1호 「직접 점검하지 않은 경우에는 점검이 끝난 후 지체 없이 점검 결과를 보고받을 것」) */}
                <tr><th>점검 방식</th><td className="f26-method">
                  <select name="insp_method" defaultValue={round.insp_method || "직접 점검"} aria-label="점검 방식">
                    <option>직접 점검</option><option>위탁 점검</option>
                  </select>
                  <input type="text" name="outsource_org" defaultValue={round.outsource_org || ""} placeholder="위탁 기관(위탁 점검일 때)" />
                  <label>결과 보고받은 날 <input type="date" name="report_received_at" defaultValue={round.report_received_at || ""} /></label>
                </td></tr>
                <tr><th>결재 의견</th><td><textarea name="approve_note" rows={3} placeholder="결재 의견(선택)" /></td></tr>
              </tbody>
            </table>
            <p className="us-muted">결재하면 이 점검은 확정되고, 보완필요·미이행 항목은 해당 부서에 조치 요구가 갑니다.</p>
            <div className="usf-save"><Link className="us-btn w" href={base}>취소</Link><button className="us-btn g" type="submit">결재</button></div>
          </form>
        </Modal>
      )}
    </UsLayout>
  );
}
