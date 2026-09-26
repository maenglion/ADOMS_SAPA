// [캡처 v2] 설명 문단 삭제 · 상태 카드 → 단계 막대 · 등록 대기 표 4칸 15행 · 과제 요약은 Facts · 처리 내역은 접기(09-22)
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { tasks, approvals, evidences, forms, activityLog, depts, staff } from "@/lib/data";
import { deptOf, canApprove, isHead } from "@/lib/roles";
import { registerMany, decide, headDecide } from "./actions";
import EvidenceRows from "@/components/EvidenceRows";
import Thumb from "@/components/Thumb";
import { AreaBadge, StatusBadge } from "@/components/bits";
import { idKo } from "@/lib/labels";
import Steps, { Facts, type Step } from "@/components/Steps";
import LedgerView from "./LedgerView";
import SlotsView from "./SlotsView";
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

const KINDS = ["점검표", "일지·대장", "계획서", "결과보고서", "교육일지", "사진", "계약서", "기타"];

/** S6 — 증빙 등록 · 결재. */
export default async function Evidence({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const dept = deptOf(role);

  const view = sp.view === "ledger" || sp.view === "slots" ? sp.view : "";
  const Tabs = () => (
    <div className="chips" style={{ marginTop: 8 }}>
      <Link className={`chip ${!view ? "on" : ""}`} href={`/evidence?role=${role}`}>등록 · 결재</Link>
      <Link className={`chip ${view === "ledger" ? "on" : ""}`} href={`/evidence?role=${role}&view=ledger`}>증빙 대장</Link>
      <Link className={`chip ${view === "slots" ? "on" : ""}`} href={`/evidence?role=${role}&view=slots`}>호별 증빙</Link>
    </div>
  );
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 의무이행(실적증빙) › 증빙(증빙 등록·결재 · 증빙 대장)으로 올림(레이아웃 + 좌측).
  //   호별 증빙(view=slots)은 좌측 항목이 없어 「증빙 등록·결재」를 켠다(같은 화면의 탭).
  const side = <PerformSide cur={view === "ledger" ? "/evidence?view=ledger" : "/evidence"} />;
  if (view) {
    return (
      <UsLayout side={side}>
        <FlowBar step="submit" role={role} />
        <h1 className="v2h">{view === "ledger" ? "증빙 대장" : "호별 필수 증빙"}</h1>
        <Tabs />
        {view === "ledger" ? <LedgerView sp={sp} role={role} /> : <SlotsView sp={sp} role={role} />}
      </UsLayout>
    );
  }

  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  const evs = await evidences();
  const fs = await forms();
  const logs = await activityLog();
  const deptName = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map((await staff()).map((p: any) => [p.staff_id, p.display_name]));
  const head = isHead(role);

  const approver = canApprove(role);
  let rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
  // 결재하는 역할은 전 기관의 제출분을 본다.
  if (dept && !approver) rows = rows.filter((r: any) => r.dept_id === dept);
  if (sp.duty) rows = rows.filter((r: any) => r.duty_key === sp.duty);

  const evByTask = new Map<string, any[]>();
  evs.forEach((e: any) => evByTask.set(e.task_id, [...(evByTask.get(e.task_id) || []), e]));

  const waiting = rows.filter((r: any) => !evByTask.has(r.task_id) && (r.approval_status || "작성중") === "작성중");
  const submitted = rows.filter((r: any) => r.approval_status === "제출");
  // 결재선(09-24): 실무자 제출 → 부서장 확인 → 총괄 승인 → 경영책임자 보고 확인
  const headWait = submitted.filter((r: any) => !r.head_ok_at);
  const chiefWait = submitted.filter((r: any) => r.head_ok_at);
  const decided = rows.filter((r: any) => r.approval_status === "승인" || r.approval_status === "반려");
  const nOk = decided.filter((r: any) => r.approval_status === "승인").length;
  const nNo = decided.filter((r: any) => r.approval_status === "반려").length;

  const sel = sp.t || waiting[0]?.task_id;
  const cur = rows.find((r: any) => r.task_id === sel);
  const curForms = cur ? fs.filter((f: any) => f.doc_id === cur.doc_id).slice(0, 8) : [];
  const LIM = sp.all ? 120 : 15;
  const allHref = `/evidence?role=${role}${sp.duty ? `&duty=${sp.duty}` : ""}${sel ? `&t=${sel}` : ""}&all=1`;

  // [캡처 v2] 증빙 단계
  const steps: Step[] = [
    { label: "등록", n: waiting.length, state: waiting.length ? "on" : "done", href: "#wait" },
    { label: "부서장 확인 대기", n: headWait.length, state: headWait.length ? "on" : "", href: "#head" },
    { label: "총괄 승인 대기", n: chiefWait.length, state: chiefWait.length ? "on" : "", href: "#submitted" },
    { label: "승인", n: nOk, state: nOk ? "done" : "" },
    { label: "반려", n: nNo, state: nNo ? "warn" : "" },
  ];

  return (
    <UsLayout side={side}>
      <FlowBar step="submit" role={role} />
      <h1 className="v2h">증빙 등록·결재</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 제목 = 메뉴 이름 */}
      <div className="chips"><span className="badge">{dept ? deptName.get(dept) || dept : "전 기관"}</span></div>
      {/* 09-26 사용자: 증빙 대장 합치기 — 결재하는 사람이 보는 화면에는 의무이행 단계 증빙을 넣지 않는다(지금대로). 안내 한 줄만 */}
      <div className="ev26-note">
        의무이행 단계에서 올린 증빙은 증빙 대장에서 봅니다. <Link href={`/evidence?role=${role}&view=ledger&o=step`}>증빙 대장 › 의무이행 단계 →</Link>
      </div>
      <Tabs />
      <Steps items={steps} />

      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 좌측 메뉴(290px)가 붙어 본문이 좁아졌다. 두 칸 최소 폭을 줄여 가로로 넘치지 않게(옛 값 360px · 620px) */}
      <div className="grid" style={{ gridTemplateColumns: "minmax(320px,0.85fr) minmax(460px,1.15fr)", marginTop: 12 }}>
        <div className="fillcol">
          <h2 id="wait">등록 대기 <span className="muted">{waiting.length.toLocaleString()}</span></h2>
          <table className="v2t">
            <thead><tr><th>의무</th><th>대상</th><th className="dt">기한</th><th className="cd">상태</th></tr></thead>
            <tbody>
              {waiting.slice(0, LIM).map((r: any) => (
                <tr key={r.task_id} style={{ background: r.task_id === sel ? "var(--blush)" : undefined }}>
                  <td title={`${r.law} ${r.unit_label_ko}`}>
                    <Link href={`/evidence?role=${role}&t=${r.task_id}${sp.all ? "&all=1" : ""}`}>{r.duty_name || r.article_title || r.code36_name}</Link>
                  </td>
                  <td title={r.asset_name || r.target_name}>{r.asset_name || r.target_name}</td>
                  <td className="dt">{String(r.due_date || "").slice(5)}</td>
                  <td className="cd"><StatusBadge s={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sp.all && waiting.length > LIM && <Link className="more" href={allHref}>전체 {waiting.length.toLocaleString()}건 →</Link>}

          <h2 id="head">부서장 확인 대기 <span className="muted">{headWait.length.toLocaleString()}</span></h2>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: ".85rem" }}>결재선 — 실무자 제출 → <b>부서장 확인</b> → 총괄(중대재해예방팀) 승인 → 경영책임자 보고 확인</p>
          <table className="v2t">
            <thead><tr><th>의무</th><th>증빙</th><th>부서장</th></tr></thead>
            <tbody>
              {headWait.length === 0 && <tr><td colSpan={3} className="muted">없음</td></tr>}
              {headWait.slice(0, 15).map((r: any) => (
                <tr key={r.task_id}>
                  <td title={`${r.law} ${r.unit_label_ko} · ${deptName.get(r.dept_id) || r.dept_id}`}>{r.duty_name || r.article_title || r.code36_name}<div className="muted" style={{ fontSize: ".8rem" }}>{deptName.get(r.dept_id) || r.dept_id} · 제출 {staffName.get(r.submitted_by) || r.submitted_by || "-"}</div></td>
                  <td>
                    <Thumb size={38} pics={(evByTask.get(r.task_id) || [])
                      .filter((x: any) => x.file_url && (x.file_type || "").startsWith("image/"))
                      .map((x: any) => ({ url: x.file_url, name: x.file_name, type: x.file_type,
                                          meta: `${x.evidence_kind} · ${x.uploaded_at}` }))} />
                    {(evByTask.get(r.task_id) || [])
                      .filter((x: any) => !(x.file_url && (x.file_type || "").startsWith("image/")))
                      .slice(0, 2)
                      .map((e: any) => (
                        <div key={e.evidence_id} title={`${e.evidence_kind} · ${e.uploaded_at}`} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "16em" }}>
                          {e.file_url
                            ? <a href={e.file_url} target="_blank" rel="noreferrer">{e.file_name}</a>
                            : e.file_name}
                        </div>
                      ))}
                  </td>
                  <td>
                    {head ? (
                      <form action={headDecide} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="task_id" value={r.task_id} />
                        <input type="hidden" name="reason" value="부서장 보완 요청" />
                        <button className="btn sm" name="decision" value="확인">확인</button>
                        <button className="btn sm ghost" name="decision" value="반려">반려</button>
                      </form>
                    ) : <span className="muted">부서장 확인 전</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {headWait.length > 15 && <span className="more muted">전체 {headWait.length.toLocaleString()}건 중 15건</span>}

          <h2 id="submitted">총괄 승인 대기 <span className="muted">{chiefWait.length.toLocaleString()}</span></h2>
          <table className="v2t">
            <thead><tr><th>의무</th><th>증빙</th><th>결재</th></tr></thead>
            <tbody>
              {chiefWait.length === 0 && <tr><td colSpan={3} className="muted">없음</td></tr>}
              {chiefWait.slice(0, 15).map((r: any) => (
                <tr key={r.task_id}>
                  <td title={`${r.law} ${r.unit_label_ko} · ${deptName.get(r.dept_id) || r.dept_id}`}>{r.duty_name || r.article_title || r.code36_name}<div className="muted" style={{ fontSize: ".8rem" }}>{deptName.get(r.dept_id) || r.dept_id} · 부서장 확인 {staffName.get(r.head_ok_by) || r.head_ok_by} {String(r.head_ok_at || "").slice(5, 10)}</div></td>
                  <td>
                    <Thumb size={38} pics={(evByTask.get(r.task_id) || [])
                      .filter((x: any) => x.file_url && (x.file_type || "").startsWith("image/"))
                      .map((x: any) => ({ url: x.file_url, name: x.file_name, type: x.file_type,
                                          meta: `${x.evidence_kind} · ${x.uploaded_at}` }))} />
                    {(evByTask.get(r.task_id) || [])
                      .filter((x: any) => !(x.file_url && (x.file_type || "").startsWith("image/")))
                      .slice(0, 2)
                      .map((e: any) => (
                        <div key={e.evidence_id} title={`${e.evidence_kind} · ${e.uploaded_at}`} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "16em" }}>
                          {e.file_url
                            ? <a href={e.file_url} target="_blank" rel="noreferrer">{e.file_name}</a>
                            : e.file_name}
                        </div>
                      ))}
                  </td>
                  <td>
                    {approver ? (
                      <form action={decide} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="task_id" value={r.task_id} />
                        <input type="hidden" name="reason" value="증빙 보완 필요" />
                        <button className="btn sm" name="decision" value="승인">승인</button>
                        <button className="btn sm ghost" name="decision" value="반려">반려</button>
                      </form>
                    ) : <span className="muted">총괄 승인 전</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {chiefWait.length > 15 && <span className="more muted">전체 {chiefWait.length.toLocaleString()}건 중 15건</span>}
        </div>

        <div>
          <div className="card">
            <h3>증빙 등록</h3>
            {!cur && <p className="muted">과제를 고르세요.</p>}
            {cur && (
              <form action={registerMany}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="task_id" value={cur.task_id} />

                <div style={{ fontWeight: 700, color: "var(--deep)" }}>{cur.duty_name || cur.article_title || cur.code36_name}</div>
                <div className="chips" style={{ margin: "6px 0" }}>
                  <AreaBadge area={cur.area} />
                  <span className="badge" title={`${cur.law} ${cur.unit_label_ko}`}>{cur.code36} {cur.code36_name}</span>
                </div>
                <Facts items={[
                  { k: "대상", v: <span title={cur.asset_name || cur.target_name}>{cur.asset_name || cur.target_name}</span> },
                  { k: "기한", v: String(cur.due_date || "-").slice(5) },
                  { k: "주기", v: cur.period_label || "-" },
                  { k: "증빙", v: <span title={cur.evidence_kind}>{(cur.evidence_kind || "-").split(/[,·(]/)[0]}</span> },
                  { k: "상태", v: <StatusBadge s={cur.status} /> },
                ]} />

                <label style={{ marginTop: 10, display: "block" }}>법정 서식</label>
                <select name="form_id" style={{ width: "100%", marginBottom: 10 }}>
                  <option value="">— 없음 —</option>
                  {curForms.map((f: any) => (
                    <option key={f.form_id} value={f.form_id}>
                      {f.schedule_kind === "table" ? `별표 ${f.schedule_no}` : `서식 ${f.schedule_no}`} · {f.title}
                    </option>
                  ))}
                </select>

                <EvidenceRows defaultKind={KINDS.find((k) => (cur.evidence_kind || "").includes(k)) || "점검표"} />
              </form>
            )}
          </div>

          <details className="card fold" style={{ marginTop: 14 }}>
            <summary>최근 처리 <span className="muted">{logs.length}</span></summary>
            <table className="v2t">
              <tbody>
                {logs.length === 0 && <tr><td className="muted">없음</td></tr>}
                {logs.slice(0, 12).map((l: any, i: number) => (
                  <tr key={i}>
                    <td className="dt muted">{String(l.at).slice(5, 16).replace("T", " ")}</td>
                    <td title={`${idKo(l.target)} ${l.note || ""}`}><b>{l.action}</b> <span className="muted">{idKo(l.target)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </div>
    </UsLayout>
  );
}
