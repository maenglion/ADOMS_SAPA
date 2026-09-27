// [400 · 교육자료 버전] SCR-088 이행점검 — 의무이행 점검(항목별 아코디언 · 증빙 뷰어/다운로드 · 상태 판정 · 점검내용 보완 지시)
import Link from "next/link";
import { redirect } from "next/navigation";
import { UsLayout, EvidenceViewer } from "@/components/us/Parts";
import { canApprove, deptOf } from "@/lib/roles";
import { depts, type Row } from "@/lib/data";
import { isTrack, NAME, roundOf, cellsOfRound, siteOf, ST_LIST, fmtAt, SRC_LABEL, RULE_TEXT, oldOutside, oldResultSt, SYM_CLS, type OldRow,
  rateOf, taskRatesOf, cellRateAll, RATE_NOTE } from "../../_lib";   // 09-26 사용자: 옛 점검 화면 합치기(2차: 이행률 두 가지)
import { itemApprovedByDept } from "@/lib/check_merge";   // 09-26 사용자: 옛 점검 화면 합치기 2차 — 항목 판정으로 승인
import { CheckSide, CheckHead, Modal } from "../../_parts";
import { saveItem } from "../actions";

export const dynamic = "force-dynamic";

// 09-26 사용자: 옛 점검 화면 합치기 — 옛 과제 단위 판정(적합·보완필요·부적합)을 항목 아래 「과제별 판정 세부」로 보인다(읽기만).
const OLD_TONE: Record<string, string> = { 적합: "O", 보완필요: "T", 부적합: "X" };
const OLD_MAX = 30;
function OldTable({ rows, dn, max = OLD_MAX }: { rows: OldRow[]; dn: Map<string, string>; max?: number }) {
  return (
    <>
      <table className="us-tbl f26-old">
        <thead><tr><th>부서</th><th>의무</th><th>관리대상</th><th>과제 결재</th><th>판정일</th><th>의견</th><th>조치</th></tr></thead>
        <tbody>
          {rows.slice(0, max).map((r) => (
            <tr key={r.task_id}>
              <td className="c">{dn.get(r.dept_id) || r.dept_id}</td>
              <td title={`${r.code} · ${r.task_id}`}>{r.duty}</td>
              <td>{r.target || "-"}</td>
              <td className="c"><span className={`f26-res ${OLD_TONE[r.result] || ""}`}>{r.result}{r.round_no > 1 ? ` ${r.round_no}차` : ""}</span></td>
              <td className="c">{r.date || "-"}</td>
              <td>{r.finding || "-"}</td>
              <td className="c">{r.state === "판정대기" ? "보완 제출 · 재점검 대기" : r.actionState || (r.result === "적합" ? "-" : "조치 전")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && <p className="us-muted f26-note">외 {(rows.length - max).toLocaleString()}건 — 최근 판정 {max}건만 보입니다.</p>}
    </>
  );
}

export default async function CheckReview({ params, searchParams }: {
  params: Promise<{ track: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { track } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (!isTrack(track)) redirect(`/check/ws/review?role=${role}`);

  const round = await roundOf(track, sp.r);
  if (!round) {
    return (
      <UsLayout side={<CheckSide track={track} role={role} page="review" />}>
        <CheckHead track={track} sub={`의무이행(${NAME[track]}) 점검`} />
        <div className="us-card w">아직 취합한 점검이 없습니다. <Link href={`/check/${track}?role=${role}`}>취합 대상 설정 →</Link></div>
      </UsLayout>
    );
  }
  const { items, deptIds, cells, period } = await cellsOfRound(track, round);
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, String(d.dept_name)]));
  const judge = canApprove(role);
  const locked = round.status === "결재완료";
  const editable = judge && !locked;
  // 담당자 역할은 자기 부서 줄만 본다(받은 보완 지시 확인용)
  const mine = deptOf(role);
  const rows = !judge && mine && deptIds.includes(mine) ? [mine] : deptIds;
  const open = sp.open || items[0]?.key;
  const base = `/check/${track}/review?role=${role}&r=${round.round_id}`;
  const vk = sp.modal === "view" ? cells.get(String(sp.k || "")) : undefined;
  // 09-26 사용자: 옛 점검 화면 합치기 — 이 회차 부서·기간의 과제 판정 중 어느 항목에도 들지 않는 것
  const outside = (await oldOutside(track, round)).filter((r) => rows.includes(r.dept_id));
  // 09-26 사용자: 옛 점검 화면 합치기 2차 — 과제 단위 이행률 · 항목 판정으로 승인한 과제(이 회차 기간 · 부서별)
  const trate = await taskRatesOf(track, rows, period.year);
  const approvedBy = await itemApprovedByDept(track, rows, period.year, period.half);
  const approvedN = [...approvedBy.values()].reduce((s, n) => s + n, 0);

  return (
    <UsLayout side={<CheckSide track={track} role={role} page="review" />}>
      <CheckHead track={track} sub={`의무이행(${NAME[track]}) 점검`} right={
        <div className="usf-roundbar">
          <span className="us-muted">{round.title} · {fmtAt(round.created_at).slice(0, 10)} 취합 · 사업장 {deptIds.length} · 항목 {items.length}</span>
          <span className={`us-st ${locked ? "ok" : "warn"}`}>{round.status}</span>
          <Link className="us-btn w" href={`/check/${track}?role=${role}`}>취합 대상 설정</Link>
          <Link className="us-btn g" href={`/check/${track}/summary?role=${role}&r=${round.round_id}`}>점검 총괄표</Link>
        </div>
      } />
      {sp.saved !== undefined && <p className="usf-ok">점검 결과를 저장했습니다({sp.saved}건).</p>}
      {locked && <p className="usf-ok">결재가 끝난 점검입니다 — 판정을 고칠 수 없습니다.</p>}
      {/* 09-26 사용자: 옛 점검 화면 합치기 — 판정 규칙 한 줄(규칙 본문은 app/check/_lib.ts) */}
      <p className="f26-rule">{RULE_TEXT}</p>
      {/* 09-26 사용자: 옛 점검 화면 합치기 2차 — 부서별 이행률(칸 단위 · 과제 단위) · 항목 판정으로 승인한 과제 수 */}
      <details className="us-card w f26-fold f26-rates">
        <summary>부서별 이행률 — 칸 단위 {cellRateAll(cells, rows, items.map((i) => i.key))} · 과제 단위 {trate.total}{approvedN ? <span className="us-st ok">항목 판정으로 승인 {approvedN}건</span> : null}</summary>
        <table className="us-tbl f26-tbl">
          <thead><tr><th>사업장</th><th>부서</th><th>칸 단위</th><th>과제 단위</th><th>항목 판정으로 승인</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d}>
                <td className="c">{siteOf(d)}</td><td className="c">{dn.get(d) || d}</td>
                <td className="c">{rateOf(items.map((it) => cells.get(`${it.key}|${d}`)?.status || "해당없음"))}</td>
                <td className="c">{trate.byDept.get(d) || "-"}</td>
                <td className="c">{approvedBy.get(d) || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="us-muted f26-note">{RATE_NOTE} 부서장 확인까지 거쳤지만 총괄 결재 전인 과제는 그 항목 판정이 「이행완료」면 승인된 것으로 읽습니다(항목 판정으로 승인).</p>
      </details>

      {items.map((it) => {
        // 09-26 사용자: 옛 점검 화면 합치기 — 이 항목에 속한 과제들의 과제 판정(보이는 부서만)
        const oldRows = rows.flatMap((d) => cells.get(`${it.key}|${d}`)?.old?.rows || []).sort((a, b) => b.date.localeCompare(a.date));
        return (
        <details key={it.key} id={it.key} className="usf-acc" open={it.key === open}>
          <summary>
            <span>{it.no}. {it.label}</span>
            <span className="usf-chev" aria-hidden>⌄</span>
          </summary>
          <form action={saveItem}>
            <input type="hidden" name="track" value={track} />
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="r" value={round.round_id} />
            <input type="hidden" name="item" value={it.key} />
            <table className="us-tbl usf-rtbl">
              <thead>
                <tr><th style={{ width: "11%" }}>상태</th><th style={{ width: "19%" }}>점검내용</th><th style={{ width: "10%" }}>사업장</th>
                  <th style={{ width: "12%" }}>부서</th><th style={{ width: "11%" }}>의무이행 일자</th><th>증빙자료</th><th style={{ width: "14%" }}>비고</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const c = cells.get(`${it.key}|${d}`);
                  if (!c) return null;
                  const k = `${it.key}|${d}`;
                  return (
                    <tr key={d}>
                      <td className="c">
                        {/* 해당없음 노출 — 명세 총괄표 범례 기준(추정). TODO: 확인 */}
                        <select name={`st_${d}`} defaultValue={c.status} disabled={!editable}>
                          {ST_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {/* 09-26 사용자: 옛 점검 화면 합치기 — 이 칸 판정의 근거 + 과제 판정 참고 값 */}
                        <small className="usf-auto">{c.judged ? "이행점검 판정" : `판정 전 · ${SRC_LABEL[c.src]}`}</small>
                        {/* 09-26 사용자: 옛 점검 화면 합치기 2차 — 지난 회차 판정을 초깃값으로 물려받은 칸(여기서 저장하면 이 회차 판정이 이긴다) */}
                        {c.inherited && <small className="f26-inh" title={c.inherited.round_id}>지난 회차에서 물려받음({c.inherited.title} · {fmtAt(c.inherited.at).slice(0, 10)})</small>}
                        {c.old && c.src !== "old" && (
                          <small className="f26-ref" title={c.old.text}>
                            과제 결재 기록 참고: {c.old.value
                              ? <b className={`f26-res ${SYM_CLS[c.old.value]}`}>{c.old.value}</b>
                              : "적합만(판정 전 과제 남음)"}
                          </small>
                        )}
                      </td>
                      <td>
                        <textarea name={`cm_${d}`} rows={2} defaultValue={c.comment} disabled={!editable}
                          placeholder={c.status === "이행완료" ? "특이사항 없음" : "보완 지시 내용을 적으세요"} />
                      </td>
                      <td className="c">{siteOf(d)}</td>
                      <td className="c">{dn.get(d) || d}</td>
                      <td className="c"><input type="text" className="usf-ro" value={c.date} readOnly disabled aria-label="의무이행 일자" /></td>
                      <td>
                        <div className="usf-evc">
                          <input type="text" className="usf-ro" value={c.evName} readOnly disabled aria-label="증빙자료" />
                          {c.evUrl
                            ? <a className="usf-dl" href={c.evUrl} download>다운로드</a>
                            : <span className="usf-dl dim">-</span>}
                          <Link className="usf-view" href={`${base}&open=${it.key}&modal=view&k=${encodeURIComponent(k)}#${it.key}`}>뷰어</Link>
                        </div>
                      </td>
                      <td><input type="text" className="usf-ro" value={c.basis} readOnly disabled aria-label="비고" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editable && <div className="usf-save"><button className="us-btn g" type="submit">점검 결과 저장</button></div>}
          </form>
          {/* 09-26 사용자: 옛 점검 화면 합치기 — 이 항목에 속한 과제들의 과제 판정 세부(읽기만 · 새 판정은 위 표에서 항목 단위로) */}
          {oldRows.length > 0 && (
            <details className="f26-sub">
              <summary>
                과제 결재 기록 {oldRows.length.toLocaleString()}건
                <span className="f26-cnt">
                  {(["적합", "보완필요", "부적합"] as const).map((r) => {
                    const n = oldRows.filter((x) => x.result === r).length;
                    return n ? <span key={r} className={`f26-res ${OLD_TONE[r]}`}>{r} {n}</span> : null;
                  })}
                </span>
              </summary>
              <OldTable rows={oldRows} dn={dn} />
            </details>
          )}
        </details>
        );
      })}
      <div className="usf-more" aria-hidden>︾</div>

      {/* 09-26 사용자: 옛 점검 화면 합치기 — 어느 항목에도 들지 않는 의무조항의 과제 판정(빠뜨리지 않고 따로 보인다) */}
      {outside.length > 0 && (
        <details className="us-card w f26-fold">
          <summary>점검 항목 밖 과제 결재 기록 {outside.length.toLocaleString()}건 <span className="us-muted">({[...new Set(outside.map((r) => r.code))].sort().join(" · ")})</span></summary>
          <p className="us-muted f26-note">이 의무조항은 이행점검 항목에 들지 않아 위 칸 판정에 넣지 않았습니다. 보완필요·부적합 {outside.map((r) => oldResultSt(r.result)).filter((s) => s !== "이행완료").length}건은 미이행 조치·재점검에서 이어 처리합니다.</p>
          <OldTable rows={outside} dn={dn} />
        </details>
      )}

      {vk && (
        <Modal title="증빙자료 뷰어" close={`${base}&open=${vk.item}#${vk.item}`}>
          <p><b>{dn.get(vk.dept) || vk.dept}</b> · {items.find((i) => i.key === vk.item)?.label}</p>
          <p>파일: {vk.evName || "등록된 증빙 없음"}{vk.evName && !vk.evUrl ? " (원본 파일은 부서 보관)" : ""}</p>
          <EvidenceViewer url={vk.evUrl || undefined} name={vk.evName} />
        </Modal>
      )}
    </UsLayout>
  );
}
