// [캡처 v2] 설명 문단·법령 인용 삭제 · 단계 막대 · 표 6칸 · 조건 안내 한 줄씩(09-22)
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { idKo } from "@/lib/labels";
import { loadAllCycles, lookups, pickBatch, type Cycle } from "@/lib/cycle";
import Steps, { Facts, type Step } from "@/components/Steps";
import { submitBatch, approveBatch, returnBatch, saveMethod } from "./actions";
import st from "./inspections.module.css";
import { OldTitle } from "@/app/check/_parts";   // 09-26 사용자: 메뉴 밖 화면 합치기

/**
 * ⑦ 회차 결재.
 * 상신 조건: **판정 대기 0**. 조치 중·미제출은 상신을 막지 않고 결과에 그대로 적힌다.
 * 상신(총괄) → 결재요청 → 확정(경영책임자) → 결재완료 → ⑧ 보고.
 */

/** 조치 중인 건을 두고 상신하는 사유 유형 (2026-09-21 · 사용자 결정: 사유를 달면 상신 가능). */
const OPEN_KINDS = [
  "예산·인력 조치 필요(경영책임자 결정 사항)",
  "임시 안전조치 완료 · 항구 조치 진행 중",
  "공사·발주 기간 소요",
  "계절·공정상 착수 불가(동절기·우기 등)",
  "다른 기관·수급인 조치 대기",
  "긴급 사안 선보고",
  "그 밖",
];

/** 위탁 점검인데 보고받은 날이 없으면 상신을 막는다. */
const needReport = (b: Record<string, any>) => b.insp_method === "위탁 점검" && !b.report_received_at;

/** 점검 대상 의무조항의 재해 구분 → 점검·보고 근거 조문(각 제2항제1호). */
function reportBasis(codes: string[]): string[] {
  const has = (p: string) => codes.some((c) => c.startsWith(p));
  return [
    has("I") && "시행령 제5조제2항제1호",
    has("M") && "시행령 제9조제2항제1호",
    has("F") && "시행령 제11조제2항제1호",
  ].filter(Boolean) as string[];
}

const ERR_TXT: Record<string, string> = {
  report: "보고받은 날이 없습니다",
  org: "위탁 기관을 적으십시오",
  date: "보고받은 날을 적으십시오",
  role: "보고일은 경영책임자 입력",
};

/** ⑦ 점검 방식 — 직접 점검 / 위탁 점검 · 위탁 기관 · 결과 보고받은 날 · 보고받은 사람. */
function MethodBox({ cur, role, bid, codes, sp, nm }: {
  cur: Record<string, any>; role: string; bid: string; codes: string[]; sp: Record<string, any>; nm: (id?: string) => string;
}) {
  const outs = cur.insp_method === "위탁 점검";
  const basis = reportBasis(codes);
  const editable = cur.status !== "결재완료" && ["gm", "mgr", "ceo"].includes(role);
  const canReport = role === "ceo" || role === "gm";
  return (
    <div id="method" style={{ margin: "10px 0", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
      <b>점검 방식</b>{" "}
      <span className={`badge ${outs ? (cur.report_received_at ? "ok" : "bad") : "none"}`}>
        {outs ? (cur.report_received_at ? "위탁 · 보고받음" : "위탁 · 보고 없음") : "직접 점검"}
      </span>{" "}
      <span className="badge none" title={basis.join(" · ")}>{basis[0] || "시행령 제5조제2항제1호"}</span>
      {outs && (
        <span className="muted"> · {cur.outsource_org || "-"}
          {cur.report_received_at && <> · {cur.report_received_at} · {cur.report_received_by || "-"}
            {cur.report_proxy === "Y" && <> <span className="badge warn" title={nm(cur.report_recorded_by)}>대리 기록</span></>}</>}
        </span>
      )}
      {sp.err && ERR_TXT[sp.err] && <p style={{ margin: "6px 0 0" }}><span className="badge bad">{ERR_TXT[sp.err]}</span></p>}
      {sp.done === "method" && <p style={{ margin: "6px 0 0" }}><span className="badge ok">저장함</span></p>}
      {editable && (
        <form action={saveMethod} className={st.btns}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="b" value={bid} />
          <select name="insp_method" defaultValue={cur.insp_method || "직접 점검"} aria-label="점검 방식">
            <option>직접 점검</option><option>위탁 점검</option>
          </select>
          <input type="text" name="outsource_org" defaultValue={cur.outsource_org || ""} placeholder="위탁 기관" style={{ minWidth: 160 }} />
          {canReport ? (
            <>
              <label>보고일 <input type="date" name="report_received_at" defaultValue={cur.report_received_at || ""} /></label>
              <input type="text" name="report_received_by" defaultValue={cur.report_received_by || ""} placeholder="보고받은 사람" style={{ minWidth: 160 }} />
            </>
          ) : (
            <span className="muted">보고일: 경영책임자</span>
          )}
          <button className="btn sm" type="submit">저장</button>
        </form>
      )}
    </div>
  );
}

export default async function Approve({ sp, role }: { sp: Record<string, any>; role: string }) {
  const cycles = await loadAllCycles();
  const batches = cycles.map((c) => c.batch!).filter(Boolean);
  const cur = pickBatch(batches, sp.b);
  const cy: Cycle | undefined = cycles.find((c) => c.batch?.batch_id === cur?.batch_id);
  const { staffName } = await lookups();
  const hq = role === "gm" || role === "mgr";
  const bid = cur?.batch_id || "";
  const bq = bid ? `&b=${bid}` : "";
  const nm = (id?: string) => (id ? staffName.get(id) || id : "");

  // [캡처 v2] 결재 단계 막대
  const steps: Step[] = cur && cy ? [
    { label: "판정", n: cy.count.판정대기, state: cy.count.판정대기 ? "on" : "done", href: `/review?role=mgr${bq}` },
    { label: "조치", n: cy.count.조치중, state: cy.count.조치중 ? "warn" : "done", href: `/actions?role=gm${bq}` },
    { label: "상신", n: cur.requested_at ? String(cur.requested_at).slice(5, 10) : "", state: cur.status === "진행중" ? (cy.canSubmit ? "on" : "") : "done" },
    { label: "확정", n: cur.approved_at ? String(cur.approved_at).slice(5, 10) : "", state: cur.status === "결재완료" ? "done" : cur.status === "결재요청" ? "on" : "" },
    { label: "보고", state: cur.status === "결재완료" ? "on" : "",
      href: cur.status === "결재완료" ? `/report?role=ceo&year=${cur.period_year}&half=${cur.half_year}` : undefined },
  ] : [];

  return (
    <>
      <FlowBar step="approve" role={role} carry={bid ? `b=${bid}` : ""} />
      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 제목 줄에 「← 이행점검으로」(레이아웃은 page.tsx 의 UsLayout) */}
      <OldTitle title="회차 결재" role={role} tk={String(sp.tk || "")} />
      {cur && <div className="chips"><span className="badge">{cur.title}</span></div>}
      {steps.length > 0 && <Steps items={steps} />}

      <table className="v2t" style={{ marginTop: 10 }}>
        <thead><tr>
          <th>점검</th><th className="num">대상</th><th className="num">대기</th>
          <th className="num">조치 중</th><th className="num">진도</th><th className="cd">결재</th>
        </tr></thead>
        <tbody>
          {cycles.map((c) => {
            const b = c.batch!;
            const k = c.count;
            return (
              <tr key={b.batch_id} style={{ background: b.batch_id === bid ? "var(--blush)" : undefined }}>
                <td title={`${idKo(b.batch_id)} · ${b.period_year} ${b.half_year}${b.insp_method === "위탁 점검" ? " · 위탁" : ""}`}>
                  <Link href={`/inspections?role=${role}&view=approve&b=${b.batch_id}`}>{b.title}</Link>
                </td>
                <td className="num">{k.total.toLocaleString()}</td>
                <td className="num">{k.판정대기 ? <span className="badge warn">{k.판정대기.toLocaleString()}</span> : <span className="muted">0</span>}</td>
                <td className="num">{k.조치중 ? <span className="badge bad">{k.조치중}</span> : <span className="muted">0</span>}</td>
                <td className="num">{k.total ? Math.round((k.판정끝남 / k.total) * 100) : 0}%</td>
                <td className="cd"><span className={`badge ${b.status === "결재완료" ? "ok" : b.status === "결재요청" ? "warn" : "none"}`}>{b.status}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!cur || !cy ? (
        <div className="card" style={{ marginTop: 14 }}><p className="muted" style={{ margin: 0 }}>
          열린 점검 없음 · <Link href={`/inspections?role=gm&view=plan#plan`}>점검 만들기 →</Link>
        </p></div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          <Facts items={[
            { k: "대상", v: cy.count.total.toLocaleString() },
            { k: "적합", v: cy.count.적합.toLocaleString() },
            { k: "보완·부적합", v: `${cy.count.보완필요} · ${cy.count.부적합}` },
            { k: "판정 대기", v: cy.count.판정대기.toLocaleString() },
            { k: "조치 중", v: cy.count.조치중 },
            { k: "미제출", v: cy.count.미제출.toLocaleString() },
          ]} />

          <MethodBox cur={cur} role={role} bid={bid} codes={cy.codes} sp={sp} nm={nm} />

          <div className={st.sign}>
            <div><small>시행</small>{nm(cur.started_by) || "-"}<small>{cur.started_at || ""}</small></div>
            <div><small>상신(총괄)</small>{nm(cur.requested_by) || (cur.status === "결재완료" ? "—" : "대기")}<small>{String(cur.requested_at || "").slice(0, 10)}</small></div>
            <div><small>확정(경영책임자)</small>{cur.status === "결재완료" ? (nm(cur.approved_by) || "확정") : "대기"}<small>{String(cur.approved_at || "").slice(0, 10)}</small></div>
          </div>

          {cur.status === "진행중" && (
            <>
              {cur.return_reason && <p><span className="badge bad" title={cur.return_reason}>돌려받음</span></p>}
              {cy.canSubmit && needReport(cur) ? (
                <>
                  <div className={st.btns}>
                    <button className="btn" type="button" disabled style={{ opacity: .45, cursor: "not-allowed" }}>결재 상신</button>
                  </div>
                  <ul className={st.cond}>
                    <li><span className="badge bad">위탁 보고일 없음</span> <a href="#method">점검 방식</a></li>
                  </ul>
                </>
              ) : cy.canSubmit ? (
                <>
                  <p style={{ marginBottom: 6 }}><span className="badge ok">상신 가능</span></p>
                  {(cy.count.조치중 > 0 || cy.count.미제출 > 0) && (
                    <ul className={st.cond}>
                      {cy.count.조치중 > 0 && <li>조치 중 {cy.count.조치중} · 사유 필수 · <Link href={`/actions?role=gm${bq}`}>조치</Link></li>}
                      {cy.count.미제출 > 0 && <li>미제출 {cy.count.미제출.toLocaleString()} · <Link href={`/evidence?role=road`}>제출</Link></li>}
                    </ul>
                  )}
                  {hq ? (
                    <form action={submitBatch} className={st.btns}>
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="b" value={bid} />
                      {cy.count.조치중 > 0 && (
                        <>
                          <select name="open_kind" required defaultValue="">
                            <option value="" disabled>사유 유형</option>
                            {OPEN_KINDS.map((k) => <option key={k}>{k}</option>)}
                          </select>
                          <input type="text" name="open_reason" required style={{ minWidth: 260 }} placeholder="무엇을 언제까지" />
                        </>
                      )}
                      <button className="btn" type="submit">결재 상신</button>
                    </form>
                  ) : (
                    <p className="muted"><Link href={`/inspections?role=gm&view=approve${bq}`}>총괄 화면 →</Link></p>
                  )}
                </>
              ) : (
                <>
                  <div className={st.btns}>
                    <button className="btn" type="button" disabled style={{ opacity: .45, cursor: "not-allowed" }}>결재 상신</button>
                  </div>
                  <ul className={st.cond}>
                    {cy.count.total === 0 && <li>대상 과제 없음 · <Link href={`/inspections?role=gm&view=plan#plan`}>계획</Link></li>}
                    {cy.count.판정대기 > 0 && <li>판정 대기 {cy.count.판정대기.toLocaleString()} · <Link href={`/review?role=mgr${bq}`}>판정</Link></li>}
                    {needReport(cur) && <li>위탁 보고일 없음 · <a href="#method">점검 방식</a></li>}
                    {cy.count.조치중 > 0 && <li>조치 중 {cy.count.조치중} · <Link href={`/actions?role=gm${bq}`}>조치</Link></li>}
                    {cy.count.미제출 > 0 && <li>미제출 {cy.count.미제출.toLocaleString()} · <Link href={`/evidence?role=road`}>제출</Link></li>}
                  </ul>
                </>
              )}
            </>
          )}

          {cur.open_reason && cur.status !== "진행중" && (
            <p style={{ marginTop: 10 }}>
              <span className="badge warn" title={cur.open_reason}>조치 중 {cur.n_open} 상신</span>{cur.open_kind ? <b> {cur.open_kind}</b> : null}
            </p>
          )}

          {cur.status === "결재요청" && (
            role === "ceo" ? (
              <form className={st.btns} action={approveBatch}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="b" value={bid} />
                <input type="text" name="note" placeholder="의견·반려 사유" style={{ minWidth: 240 }} />
                <button className="btn" type="submit">결재 확정</button>
                <button className="btn ghost" type="submit" formAction={returnBatch}>돌려보내기</button>
              </form>
            ) : (
              <p style={{ marginTop: 10 }}>
                <span className="badge warn">확정 대기</span>{" "}
                <Link className="btn sm" href={`/inspections?role=ceo&view=approve${bq}`}>경영책임자 화면</Link>
              </p>
            )
          )}

          {cur.status === "결재완료" && (
            <p style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge ok">결재완료</span>
              {cur.approve_note && <span className="muted">{cur.approve_note}</span>}
              <Link className="btn sm" href={`/report?role=ceo&year=${cur.period_year}&half=${cur.half_year}`}>보고서 →</Link>
              <Link className="btn sm ghost" href={`/inspections?role=gm&view=plan#plan`}>다음 점검</Link>
            </p>
          )}
        </div>
      )}
    </>
  );
}
