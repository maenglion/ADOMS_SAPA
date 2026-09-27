// [캡처 v2] 설명 문단·법령 인용 삭제 · 상태 카드 → 단계 막대 · 표 6칸 15행 · 알림은 접기(09-22)
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { readTable, fixNotifText, staff } from "@/lib/data";   // 09-26 사용자: 옛 점검 화면 합치기 — staff(알림 받는 부서)
import { deptOf } from "@/lib/roles";
import { idKo } from "@/lib/labels";
import { loadCycle, lookups, addDays, FLAGGED, type CycleRow, type ActionState } from "@/lib/cycle";
import { requestAction, requestMany, startAction, resubmit, changeActionType } from "./actions";
import { ACTION_TYPES, ACTION_HINT, STATUTORY_TYPES, actionTypeOf } from "@/lib/remedy";
import Steps, { type Step } from "@/components/Steps";
import st from "./actions.module.css";
import { UsLayout } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 레이아웃 + 좌측
import MenuSide from "@/components/us/MenuSide";
import { ymd } from "@/lib/day";
// 09-26 사용자: 옛 점검 화면 합치기 — 이행점검 판정(항목 단위)의 보완필요·미이행을 이 목록에 함께(읽을 때 합친다)
import { OLD_CHECK_MERGED, checkFlagged, laterJudgeIndex, reviewHrefOfCode, trackOfBatch, type CheckFlag } from "@/lib/check_merge";
import { NAME, fmtAt } from "@/app/check/_lib";
import { withDbReadTrace } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * ⑥ 조치·재점검 — ⑤ 에서 보완필요·부적합으로 판정한 과제.
 *   총괄: 조치 요구 → 부서: 조치 시작 → 보완 제출 → ⑤ 재점검 → 적합이면 끝, 아니면 다음 차수.
 */
const STATE_TONE: Record<ActionState, string> = {
  "요구 전": "bad", "요구": "warn", "조치중": "warn", "조치 완료": "", "보완 제출": "none", "완료": "ok",
};
const STATE_LABEL: Record<ActionState, string> = {
  "요구 전": "요구 전", "요구": "요구함", "조치중": "조치 중",
  "조치 완료": "조치 끝", "보완 제출": "보완 제출", "완료": "완료",
};
const ORDER: ActionState[] = ["요구 전", "요구", "조치중", "조치 완료", "보완 제출", "완료"];

/** 조치 구분 고르기 — 인력 배치·예산 추가 편성·집행 포함(lib/remedy.ts). */
function TypeSelect({ v }: { v: string }) {
  return (
    <select name="action_type" defaultValue={v} aria-label="조치 구분">
      {ACTION_TYPES.map((a) => <option key={a} value={a} title={ACTION_HINT[a]}>{a}</option>)}
    </select>
  );
}

export default async function Actions(props: { searchParams: Promise<Record<string, string>> }) {
  return withDbReadTrace("/actions", () => renderActions(props));
}

async function renderActions({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const myDept = deptOf(role);
  const hq = role === "gm" || role === "mgr";
  const isDept = Boolean(myDept) && role !== "mgr";

  const cy = await loadCycle(sp.b);
  const { batch, batches, count } = cy;
  const { deptName, staffName } = await lookups();
  const bid = batch?.batch_id || "";
  const bq = bid ? `&b=${bid}` : "";

  let rows: CycleRow[] = cy.rows.filter((t) => t.actionState || (t.state === "적합" && t.history.some((h) => FLAGGED(h.result))));
  rows.forEach((t) => { if (!t.actionState) t.actionState = "완료"; });
  // 09-26 사용자: 옛 점검 화면 합치기 — 과제 판정 뒤 같은 부서·같은 항목에 이행점검 판정 「이행완료」가 나왔으면 그 조치는 끝난 것으로 본다
  //   (재점검은 이제 이행점검 항목별 점검에서 한다 — 옛 과제 판정 표에는 새로 쓰지 않는다). 저장 값은 바꾸지 않고 읽을 때만.
  const closedBy = new Map<string, string>();
  if (OLD_CHECK_MERGED) {
    const later = await laterJudgeIndex();
    rows.forEach((t) => {
      if (t.actionState === "완료" || !t.last) return;
      const j = later(t.dept_id, String(t.code36 || ""), String(t.last.insp_date || ""));
      if (j && j.status === "이행완료") { t.actionState = "완료"; closedBy.set(t.task_id, `이행점검 판정 이행완료 · ${fmtAt(j.judged_at).slice(0, 10)}`); }
    });
  }
  if (isDept) rows = rows.filter((t) => t.dept_id === myDept);
  // 09-26 사용자: 옛 점검 화면 합치기 — 이행점검 판정의 보완필요·미이행(항목 단위). 조치 요구 알림이 나갔으면 「요구함」, 아니면 「요구 전」.
  const year = ymd().slice(0, 4);
  let checks: (CheckFlag & { actionState: ActionState })[] = OLD_CHECK_MERGED
    ? (await checkFlagged(year, role)).map((f) => ({ ...f, actionState: (f.notified ? "요구" : "요구 전") as ActionState }))
    : [];
  if (isDept) checks = checks.filter((f) => f.dept_id === myDept);
  const n = (s: ActionState) => rows.filter((t) => t.actionState === s).length + checks.filter((f) => f.actionState === s).length;
  const checkShown = sp.s ? checks.filter((f) => f.actionState === sp.s) : checks;
  let shown = rows;
  if (sp.s) shown = rows.filter((t) => t.actionState === sp.s);
  shown = [...shown].sort((a, b) => ORDER.indexOf(a.actionState!) - ORDER.indexOf(b.actionState!)
    || String(a.action?.due_date || "9").localeCompare(String(b.action?.due_date || "9")));

  const notReq = rows.filter((t) => t.actionState === "요구 전");
  // 09-25 사용자: 옛 단계 이름이 든 알림 글은 읽을 때만 새 이름으로(fixNotifText · 저장 값 그대로)
  // 09-26 사용자: 옛 점검 화면 합치기 — 이행점검(항목 단위)이 보낸 조치 요구 알림도 함께(올해 회차 · 부서 역할은 자기 부서 줄 것만)
  const chkRounds = new Set(checks.map((f) => f.round.round_id));
  const staffDept = new Map((await staff()).map((s: any) => [String(s.staff_id), String(s.dept_id || "")]));
  const cycleTaskIds = new Set(cy.rows.map((t) => String(t.task_id)));
  const shownTaskIds = new Set(rows.map((t) => String(t.task_id)));
  const isChkNotif = (x: any) => OLD_CHECK_MERGED && x.note === "이행점검" && x.notif_type === "조치요구" && chkRounds.has(x.batch_id);
  const sent = fixNotifText(await readTable("notification", "notif_id"))
    .filter((x) => isChkNotif(x) || ((x.notif_type === "조치요구" || x.notif_type === "재점검요청")
      && (x.batch_id ? x.batch_id === bid : cycleTaskIds.has(String(x.task_id)))))
    .filter((x) => !isDept || staffName.has(x.to_staff_id) && (isChkNotif(x) ? staffDept.get(x.to_staff_id) === myDept : shownTaskIds.has(String(x.task_id))))
    .sort((a, b) => String(b.sent_at || "").localeCompare(String(a.sent_at || "")));

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    const m = { b: bid, s: sp.s, all: sp.all, ...o };
    Object.entries(m).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/actions?${p.toString()}`;
  };
  const defDue = addDays(14);
  const LIM = sp.all ? 150 : 15;
  // 09-26 사용자: 옛 점검 화면 합치기 — 재판정·결재는 이행점검 화면으로(옛 /review·/inspections 로 가지 않는다)
  const reviewOf = (t: CycleRow) => (OLD_CHECK_MERGED ? reviewHrefOfCode(String(t.code36 || ""), "mgr") : `/review?role=mgr${bq}`);
  const btk = trackOfBatch(batch) || "ws";
  const approveHref = OLD_CHECK_MERGED ? `/check/${btk}/summary?role=gm${bid ? `&b=${bid}` : ""}#old` : `/inspections?role=gm&view=approve${bq}`;
  const reviewAny = OLD_CHECK_MERGED ? `/check/${btk}/review?role=mgr` : `/review?role=mgr${bq}`;

  // [캡처 v2] 조치 단계 — 누르면 그 상태만 본다
  const steps: Step[] = ORDER.map((s) => ({
    label: STATE_LABEL[s], n: n(s),
    state: sp.s === s ? "on" : s === "요구 전" && n(s) ? "warn" : s === "완료" && n(s) ? "done" : "",
    href: q({ s: sp.s === s ? undefined : s }),
  }));

  return (
    <UsLayout side={<MenuSide group="이행점검및 조치" />}>   {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 및 조치 › 개선 및 조치로 올림 */}
      <FlowBar step="action" role={role} carry={bid ? `b=${bid}` : ""} />
      <h1 className="v2h">미이행 조치·재점검</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 머리·좌측 메뉴 이름과 같게 */}
      <div className="chips">
        {batches.map((b: any) => (
          <Link key={b.batch_id} className={`chip ${bid === b.batch_id ? "on" : ""}`} href={q({ b: b.batch_id, s: undefined })} title={b.title}>
            {b.period_year} {b.half_year}{batches.filter((x: any) => x.period_year === b.period_year && x.half_year === b.half_year).length > 1 ? ` · ${idKo(b.batch_id)}` : ""}
          </Link>
        ))}
        {batch && <span className="badge none">{batch.status}</span>}
        {isDept && <span className="badge">{deptName.get(myDept) || myDept}</span>}
      </div>

      <Steps items={steps} />

      <div className="chips">
        {/* 09-26 사용자: 옛 점검 화면 합치기 — 재판정·결재 단추는 이행점검 화면으로 */}
        {n("보완 제출") > 0 && <Link className="btn sm" href={reviewAny}>재판정 {n("보완 제출")} →</Link>}
        <Link className={`btn sm ${count.판정대기 === 0 ? "" : "ghost"}`} href={approveHref}>
          결재{count.판정대기 === 0 ? " 가능 →" : ` · 대기 ${count.판정대기.toLocaleString()}`}
        </Link>
        {sp.s && <Link className="chip on" href={q({ s: undefined })}>{STATE_LABEL[sp.s as ActionState] || sp.s} ✕</Link>}
      </div>
      {OLD_CHECK_MERGED && (
        <p className="f26-rule">이행점검 판정(항목 단위)의 보완필요·미이행과 과제 결재 기록의 보완필요·부적합을 한 목록으로 봅니다. 과제 결재 뒤 같은 항목에 이행점검 「이행완료」 판정이 나오면 그 조치는 끝난 것으로 셉니다.</p>
      )}

      {rows.length === 0 && checks.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}><p className="muted" style={{ margin: 0 }}>
          조치할 것 없음 ·{" "}
          {count.total === 0
            ? <Link href={OLD_CHECK_MERGED ? `/check/${btk}?role=gm` : `/inspections?role=gm&view=plan#plan`}>점검 범위 다시 잡기 →</Link>
            : count.판정대기 > 0
              ? <Link href={reviewAny}>판정 대기 {count.판정대기.toLocaleString()} →</Link>
              : <Link href={approveHref}>결재 →</Link>}
        </p></div>
      ) : (
        <>
          {hq && notReq.length > 0 && (
            <form id="reqmany" action={requestMany} className={`card ${st.bulk}`}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="b" value={bid} />
              <b>고른 것</b>
              <label className={st.inl}>기한 <input type="date" name="due_date" defaultValue={defDue} /></label>
              <select name="action_type" defaultValue="" aria-label="조치 구분">
                <option value="">판정 때 고른 조치</option>
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <button className="btn" type="submit">조치 요구</button>
            </form>
          )}

          <table className="v2t" style={{ marginTop: 10 }}>
            <thead><tr>
              <th style={{ width: 34 }} />
              <th>의무</th>
              <th>부서</th>
              <th className="cd">판정</th>
              <th className="dt">기한</th>
              <th>처리</th>
            </tr></thead>
            <tbody>
              {/* 09-26 사용자: 옛 점검 화면 합치기 — 이행점검 판정(항목 단위) 줄. 조치 요구 알림은 판정 저장·결재 때 이미 나간다. 재점검은 항목별 점검에서. */}
              {checkShown.map((f) => {
                const s = f.actionState;
                return (
                  <tr key={`${f.track}|${f.item.key}|${f.dept_id}`} className="f26-chk">
                    <td />
                    <td title={`${f.round.title} · ${f.cell.basis}`}>
                      <span className="f26-tag">이행점검</span> {NAME[f.track]} · {f.item.no}. {f.item.label}
                    </td>
                    <td>{deptName.get(f.dept_id) || f.dept_id}</td>
                    <td className="cd" title={f.cell.comment || ""}>
                      <span className={`badge ${f.status === "미이행" ? "bad" : "warn"}`}>{f.status}</span>
                    </td>
                    <td className="dt"><span className="muted">—</span></td>
                    <td>
                      <span className={`badge ${STATE_TONE[s]}`}>{f.notified ? "조치 요구 보냄" : "조치 요구 전"}</span>{" "}
                      {f.cell.src !== "judge" && <span className="badge none">결재 때 확정</span>}{" "}
                      <Link className="btn sm" href={f.href}>재점검</Link>
                    </td>
                  </tr>
                );
              })}
              {shown.slice(0, LIM).map((t) => {
                const s = t.actionState!;
                const x = t.state === "적합" ? t.history.find((h) => FLAGGED(h.result)) : t.last;
                const late = t.action?.due_date && !t.action?.done_at && t.action.due_date < ymd();
                const canDept = (isDept && t.dept_id === myDept) || hq;
                const tip = [
                  `${idKo(t.task_id)} · ${t.law} ${t.unit_label_ko} · ${t.asset_name || t.target_name}`,
                  x?.finding ? `지적: ${x.finding}` : "",
                  t.action?.resubmit_note ? `보완: ${t.action.resubmit_note}` : "",
                  t.action?.action_basis || "",
                ].filter(Boolean).join("\n");
                return (
                  <tr key={t.task_id} id={t.task_id}>
                    <td>{hq && s === "요구 전" && <input type="checkbox" name="pick" value={t.task_id} form="reqmany" />}</td>
                    <td title={tip}>{t.duty_name || t.article_title || t.code36_name}</td>
                    <td title={staffName.get(t.owner_staff_id) || ""}>{t.dept_name || deptName.get(t.dept_id)}</td>
                    <td className="cd" title={`${x?.insp_date || ""} ${staffName.get(x?.inspector_staff_id) || ""}`}>
                      <span className={`badge ${x?.result === "부적합" ? "bad" : "warn"}`}>{x?.result} {x?.round_no}차</span>
                    </td>
                    <td className="dt">{t.action?.due_date ? String(t.action.due_date).slice(5) : <span className="muted">—</span>}
                      {late && <> <span className="badge bad">지남</span></>}
                    </td>
                    <td>
                      <span className={`badge ${STATE_TONE[s]}`}>{STATE_LABEL[s]}</span>{" "}
                      {t.action?.action_type && (
                        <span className={`badge ${STATUTORY_TYPES.has(t.action.action_type) ? "warn" : "none"}`}>{t.action.action_type}</span>
                      )}
                      {hq && t.action && s !== "완료" && s !== "보완 제출" && (
                        <form action={changeActionType} className={st.rowform}>
                          <input type="hidden" name="role" value={role} />
                          <input type="hidden" name="b" value={bid} />
                          <input type="hidden" name="task_id" value={t.task_id} />
                          <TypeSelect v={actionTypeOf(t.action.action_type, x?.result)} />
                          <button className="btn sm ghost" type="submit">구분 변경</button>
                        </form>
                      )}
                      {hq && s === "요구 전" && (
                        <form action={requestAction} className={st.rowform}>
                          <input type="hidden" name="role" value={role} />
                          <input type="hidden" name="b" value={bid} />
                          <input type="hidden" name="task_id" value={t.task_id} />
                          <input type="date" name="due_date" defaultValue={defDue} />
                          <TypeSelect v={actionTypeOf(x?.action_need, x?.result)} />
                          <button className="btn sm" type="submit">조치 요구</button>
                        </form>
                      )}
                      {isDept && canDept && s === "요구" && (
                        <form action={startAction} className={st.rowform}>
                          <input type="hidden" name="role" value={role} />
                          <input type="hidden" name="b" value={bid} />
                          <input type="hidden" name="task_id" value={t.task_id} />
                          <button className="btn sm ghost" type="submit">조치 시작</button>
                        </form>
                      )}
                      {canDept && (s === "요구" || s === "조치중" || s === "조치 완료" || (isDept && s === "요구 전")) && (
                        <form action={resubmit} className={st.rowform}>
                          <input type="hidden" name="role" value={role} />
                          <input type="hidden" name="b" value={bid} />
                          <input type="hidden" name="task_id" value={t.task_id} />
                          {hq && <input type="hidden" name="proxy" value="1" />}
                          <input type="text" name="note" placeholder="보완 내용" />
                          <button className={`btn sm ${hq ? "ghost" : ""}`} type="submit">{hq ? "대신 제출" : "보완 제출"}</button>
                          <Link className="muted" href={`/evidence?role=${isDept ? role : "road"}&t=${t.task_id}`}>증빙 +</Link>
                        </form>
                      )}
                      {/* 09-26 사용자: 옛 점검 화면 합치기 — 재판정은 그 과제가 속한 이행점검 항목에서 */}
                      {s === "보완 제출" && <Link className="btn sm" href={reviewOf(t)}>{OLD_CHECK_MERGED ? "재점검(항목)" : `재판정 ${t.nextRound}차`}</Link>}
                      {closedBy.has(t.task_id) && <span className="badge ok" title={closedBy.get(t.task_id)}>{closedBy.get(t.task_id)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length > LIM && <Link className="more" href={q({ all: "1" })}>전체 {shown.length.toLocaleString()}건 →</Link>}
        </>
      )}

      <details className="card fold" style={{ marginTop: 14 }}>
        <summary>보낸 알림 <span className="muted">{sent.length}</span></summary>
        {sent.length === 0 ? <p className="muted">없음</p> : (
          <table className="v2t">
            <thead><tr><th className="dt">보낸 날</th><th className="cd">종류</th>
              <th>받는 사람</th><th>내용</th><th className="dt">읽음</th></tr></thead>
            <tbody>
              {sent.slice(0, 15).map((x) => (
                <tr key={x.notif_id}>
                  <td className="dt">{String(x.sent_at || "").slice(5, 10)}</td>
                  <td className="cd"><span className={`badge ${x.notif_type === "조치요구" ? "warn" : "none"}`}>{x.notif_type === "조치요구" ? "조치 요구" : "재점검"}</span></td>
                  <td title={`보낸 사람 ${staffName.get(x.from_staff_id) || "-"}`}>{staffName.get(x.to_staff_id) || x.to_staff_id || "-"}</td>
                  <td title={`${x.message} · ${idKo(x.task_id)}`}>{x.message}</td>
                  <td className="dt">{x.read_at ? String(x.read_at).slice(5, 10) : <span className="muted">안 읽음</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </UsLayout>
  );
}
