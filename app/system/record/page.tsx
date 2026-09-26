// [캡처 v2] 체계 기록 — 호 이동을 단계 막대로, 조문·단서 설명은 접기로, 표는 한 줄로(2026-09-22).
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import Steps, { type Step } from "@/components/Steps";
import { readTable, riskAssessments, type Row } from "@/lib/data";
import { systemStatus, ST_LABEL, ST_TONE, halfOf, prevHalf, inHalf, stageOf, VOICE_STAGES, EVAL_ROLES } from "@/lib/system";
import { ceoConfirm } from "@/lib/roles";
import { idKo } from "@/lib/labels";
import {
  savePolicy, saveManual, saveHalfCheck, markRecord, saveGrant, saveCriteria, saveEval, addVoice, advanceVoice,
} from "../actions";
import s from "../system.module.css";
import { ymd } from "@/lib/day";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기
import { STEPS } from "@/lib/us/tracks";
import { MergedTitle, WS_REC_STEP } from "../../perform/_merge";

export const dynamic = "force-dynamic";

const CLAUSES = [1, 3, 5, 7, 8] as const;
const TODAY = ymd();
const METHODS = ["대면 보고", "전자 결재", "회의 보고", "서면 보고"];
const CHANNELS = ["현장 건의", "익명 신고함", "작업 전 안전점검 회의(TBM)", "간담회", "산업안전보건위원회", "안전 및 보건에 관한 협의체", "노사협의체"];
const STAGE_TONE: Record<string, string> = { 접수: "none", 검토: "warn", 개선방안: "warn", 이행: "warn", 종결: "ok" };
const md = (x?: string) => (x ? String(x).slice(5, 10) : "—");

/** 경영책임자 보고받음 — 모든 입력에 붙는다. */
function Report({ role }: { hint?: string; role: string }) {
  const c = ceoConfirm(role);
  if (!c.ok) return null;
  return (
    <div className={s.rep}>
      <label><input type="checkbox" name="ceo_reported" value="Y" /> <b>경영책임자 보고받음{c.proxy ? " (대리)" : ""}</b></label>
      <label>보고일 <input type="date" name="reported_at" defaultValue={TODAY} /></label>
      <label>방식 <select name="report_method" defaultValue="대면 보고">{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
    </div>
  );
}

/** 호별 기록 목록 — 보고받음 · 필요 조치 완료를 뒤늦게 남길 수 있다. */
function Records({ rows, role, who }: { rows: Row[]; role: string; who: (id?: string) => string }) {
  if (!rows.length) return <p className="muted">기록 없음</p>;
  return (
    <table className="v2t">
      <thead><tr><th className="dt">날짜</th><th>구분</th><th>내용</th><th>필요 조치</th><th>보고</th><th>증빙</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const tip = [r.half, r.substitute && `${r.substitute}로 갈음`, r.content, r.target_role, r.covers && `${r.covers}목`, r.score && `${r.score}점`,
            r.budget_amount && `예산 ${Number(r.budget_amount).toLocaleString()}원`, r.doc_name, r.checker_staff_id && `담당 ${who(r.checker_staff_id)}`].filter(Boolean).join(" · ");
          return (
            <tr key={r.record_id}>
              <td className="dt">{md(r.done_at)}</td>
              <td><span className="badge">{r.record_kind}</span></td>
              <td title={tip}><b>{r.title}</b></td>
              <td title={r.action_needed || ""}>
                {!r.action_needed ? <span className="muted">—</span> : r.action_done_at ? <span className="badge ok">완료 {md(r.action_done_at)}</span> : (
                  <form action={markRecord} className={s.inline}>
                    <input type="hidden" name="role" value={role} /><input type="hidden" name="record_id" value={r.record_id} /><input type="hidden" name="what" value="action" />
                    <span className="badge warn">남음</span>
                    <input type="date" name="action_done_at" defaultValue={TODAY} />
                    <button className="btn sm ghost" type="submit">완료</button>
                  </form>
                )}
              </td>
              <td>
                {r.ceo_reported === "Y" ? <span className="badge ok" title={`${r.report_method || ""}${r.report_proxy === "Y" ? " · 대리 기록" : ""}`}>보고 {md(r.reported_at)}</span>
                  : !ceoConfirm(role).ok ? <span className="badge bad">없음</span> : (
                  <form action={markRecord} className={s.inline}>
                    <input type="hidden" name="role" value={role} /><input type="hidden" name="record_id" value={r.record_id} /><input type="hidden" name="what" value="report" />
                    <input type="date" name="reported_at" defaultValue={TODAY} />
                    <select name="report_method" defaultValue="대면 보고">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                    <button className="btn sm ghost" type="submit">보고받음</button>
                  </form>
                )}
              </td>
              <td><FileLink name={r.doc_name} url={r.evidence_url} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 체계 기록 입력 — 시행령 제4조제1·3·5·7·8호. 입력은 모두 공통 쓰기 경로로 간다. */
export default async function SystemRecordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const no = CLAUSES.includes(Number(sp.clause) as any) ? Number(sp.clause) : 1;
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;

  const { clauses, sts, dl, deptName, st, policy, manual, who } = await systemStatus(role);
  const i = clauses.findIndex((c) => c.no === no);
  const c = clauses[i];
  const recs = (await readTable("system_record", "record_id"))
    .filter((r) => r.clause_no === String(no))
    .sort((a, b) => (a.done_at < b.done_at ? 1 : -1));
  const staffOpts = st.filter((x: any) => String(x.staff_id).startsWith("S"));
  const cur = halfOf(), prev = prevHalf();
  const Hidden = ({ extra }: { extra?: Record<string, string> }) => (
    <>
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="clause_no" value={String(no)} />
      {extra && Object.entries(extra).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
    </>
  );
  const Checker = () => (
    <div>
      <label>점검자</label>
      <select name="checker_staff_id" defaultValue="">
        <option value="">— 입력한 사람 —</option>
        {staffOpts.map((x: any) => <option key={x.staff_id} value={x.staff_id}>{x.display_name} · {deptName.get(x.dept_id) || x.dept_id}</option>)}
      </select>
    </div>
  );
  const man = (n: string) => manual.filter((m: any) => m.clause_no === n);
  const Rep = (_: { hint?: string }) => <Report role={role} />;

  let body: React.ReactNode = null;

  /* ── 제1호 ── */
  if (no === 1) {
    body = (
      <>
        <h2>경영방침 · 목표</h2>
        <table className="v2t">
          <thead><tr><th>구분</th><th>문서</th><th className="dt">제정</th><th className="dt">개정</th><th>게시</th></tr></thead>
          <tbody>
            {policy.map((p: any) => (
              <tr key={p.policy_id}>
                <td title={p.fiscal_year ? `${p.fiscal_year}년` : ""}><span className="badge">{p.policy_kind}</span></td>
                <td title={p.summary}><b>{p.title}</b></td>
                <td className="dt">{md(p.enacted_at)}</td><td className="dt">{md(p.revised_at)}</td>
                <td title={p.posted_where || ""}>{p.posted === "Y" ? <span className="badge ok">게시</span> : <span className="badge warn">미게시</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>등록 · 개정</summary>
          <form action={savePolicy} className={s.form}>
            <Hidden />
            <div><label>대상</label>
              <select name="policy_id" defaultValue="">
                <option value="">새 문서 등록</option>
                {policy.map((p: any) => <option key={p.policy_id} value={p.policy_id}>개정: {p.title}</option>)}
              </select></div>
            <div><label>구분</label><select name="policy_kind" defaultValue="안전보건 목표"><option>경영방침</option><option>안전보건 목표</option></select></div>
            <div><label>목표 연도</label><input type="text" name="fiscal_year" defaultValue={TODAY.slice(0, 4)} /></div>
            <div className={s.wide}><label>제목</label><input type="text" name="title" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>내용</label><textarea name="summary" /></div>
            <div><label>제정·개정일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <div><label>게시</label><select name="posted" defaultValue="Y"><option value="Y">게시함</option><option value="N">게시 안 함</option></select></div>
            <div><label>게시 장소</label><input type="text" name="posted_where" /></div>
            <div><label>결재</label><input type="text" name="approver_role" defaultValue="경영책임자(시장)" /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">저장</button></div>
          </form>
        </details>
      </>
    );
  }

  /* ── 제3호 ── */
  if (no === 3) {
    const ra = await riskAssessments();
    const raDone = ra.filter((x: any) => x.status === "완료");
    const raCur = ra.filter((x: any) => inHalf(x.assessed_at, cur));
    const proc = man("3");
    body = (
      <>
        <div className="facts" style={{ marginTop: 10 }}>
          <div className="fact"><div className="fk">절차</div><div className="fv" title={proc.map((m: any) => m.title).join(", ")}>{proc.length ? <span className="badge ok">있음</span> : <span className="badge bad">없음</span>}</div></div>
          <div className="fact"><div className="fk">평가 완료</div><div className="fv">{raDone.length}/{ra.length}</div></div>
          <div className="fact"><div className="fk">{cur.label} 실시</div><div className="fv">{raCur.length}건</div></div>
          <div className="fact"><div className="fk">결과 보고 갈음</div><div className="fv">{proc.length && raDone.length ? <span className="badge ok">가능</span> : <span className="badge warn">부족</span>}</div></div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>반기 점검 기록</h3>
          <form action={saveHalfCheck} className={s.form}>
            <Hidden extra={{ target_ref: proc[0]?.manual_id || "" }} />
            <div><label>구분</label>
              <select name="record_kind" defaultValue={proc.length ? "위험성평가 결과 보고" : "반기 점검"}>
                <option value="반기 점검">반기 점검(직접)</option>
                <option value="위험성평가 결과 보고" disabled={!proc.length}>결과 보고(갈음)</option>
              </select></div>
            <div><label>점검·보고일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <Checker />
            <div className={s.wide}><label>확인 내용</label><textarea name="content" /></div>
            <div className={s.wide}><label>필요 조치</label><input type="text" name="action_needed" style={{ width: "100%" }} /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">기록</button></div>
          </form>
        </div>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>절차 문서 등록 · 개정</summary>
          <form action={saveManual} className={s.form}>
            <Hidden />
            <div><label>대상</label><select name="manual_id" defaultValue=""><option value="">새 문서 등록</option>{proc.map((m: any) => <option key={m.manual_id} value={m.manual_id}>개정: {m.title}</option>)}</select></div>
            <div className={s.wide}><label>제목</label><input type="text" name="title" style={{ width: "100%" }} /></div>
            <div><label>제정·개정일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">저장</button></div>
          </form>
        </details>
      </>
    );
  }

  /* ── 제5호 ── */
  if (no === 5) {
    const orgRows = await readTable("safety_org_role", "role_id");
    const cell = new Map<string, Row>();
    for (const r of orgRows) { const k = `${r.role_item}|${r.dept_id || ""}`; if (!cell.has(k)) cell.set(k, r); }
    const on = (item: string, dept = "") => cell.get(`${item}|${dept}`)?.designated === "Y" ? cell.get(`${item}|${dept}`) : undefined;
    const allRecs = await readTable("system_record", "record_id");
    const evalR = allRecs.filter((r) => r.clause_no === "5" && r.record_kind === "반기 평가");
    const grantR = allRecs.filter((r) => r.clause_no === "5" && r.record_kind === "권한·예산 부여");
    const crit = await readTable("eval_criteria", "criteria_id");
    type T = { role: string; dept: string; name: string; row: Row };
    const targets: T[] = [
      ...(["안전보건관리책임자", "안전보건총괄책임자"]).filter((r) => on(r)).map((r) => ({ role: r, dept: "", name: r, row: on(r)! })),
      ...dl.filter((d: any) => on("관리감독자", d.dept_id)).map((d: any) => ({ role: "관리감독자", dept: d.dept_id, name: `관리감독자 · ${d.dept_name}`, row: on("관리감독자", d.dept_id)! })),
    ];
    const lastE = (t: T) => [t.row.last_eval_at, ...evalR.filter((r) => r.target_role === t.role && (r.dept_id || "") === t.dept).map((r) => r.done_at)].filter(Boolean).sort().pop();
    const lastScore = (t: T) => evalR.filter((r) => r.target_role === t.role && (r.dept_id || "") === t.dept).sort((a, b) => (a.done_at < b.done_at ? 1 : -1))[0]?.score;
    body = (
      <>
        <h2>대상자 <Link className="more" style={{ marginLeft: 8 }} href={q("/system#matrix")}>지정 현황 →</Link></h2>
        <table className="v2t">
          <thead><tr><th>대상</th><th>담당</th><th>권한·예산</th><th className="dt">최근 평가</th><th className="num">점수</th><th>{cur.label}</th></tr></thead>
          <tbody>
            {targets.map((t) => {
              const g = grantR.find((x) => x.target_role === t.role);
              const le = lastE(t);
              return (
                <tr key={`${t.role}|${t.dept}`}>
                  <td title={t.name}><b>{t.name}</b></td>
                  <td>{who(t.row.staff_id) || <span className="muted">—</span>}</td>
                  <td title={g ? `${g.doc_name || g.title} (${g.done_at})` : ""}>{g ? <span className="badge ok">있음</span> : <span className="badge bad">없음</span>}</td>
                  <td className="dt">{md(le)}</td>
                  <td className="num">{lastScore(t) || "—"}</td>
                  <td>{inHalf(le, cur) ? <span className="badge ok">평가함</span> : inHalf(le, prev) ? <span className="badge warn">지난 반기</span> : <span className="badge bad">없음</span>}</td>
                </tr>
              );
            })}
            {!on("안전보건총괄책임자") && (
              <tr><td><b>안전보건총괄책임자</b></td><td colSpan={5}><span className="badge none">지정 기록 없음 · 해당 확인</span></td></tr>
            )}
          </tbody>
        </table>

        <details className="card fold" open style={{ marginTop: 12 }}>
          <summary>반기 평가 입력</summary>
          {EVAL_ROLES.map((er) => {
            const items = crit.filter((c) => c.target_role === er && c.active !== "N");
            const ts = targets.filter((t) => t.role === er);
            return (
              <details key={er} className="fold" style={{ marginBottom: 6 }}>
                <summary>{er} <span className="muted">{ts.length}명 · {items.length}항목</span></summary>
                {!ts.length ? <p className="muted">지정된 사람 없음</p> : !items.length ? <p className="muted">평가 기준 없음</p> : (
                  <form action={saveEval} className={s.form}>
                    <Hidden extra={{ target_role: er }} />
                    <div><label>대상</label>
                      <select name="target" required>
                        {ts.map((t) => <option key={t.row.role_id} value={`${t.row.role_id}|${t.dept}|${t.row.staff_id || ""}`}>{t.name}{inHalf(lastE(t), cur) ? " (평가함)" : ""}</option>)}
                      </select></div>
                    <div><label>평가일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
                    <Checker />
                    {items.map((it) => (
                      <div key={it.criteria_id}>
                        <label title={it.item}>{it.item_no}. {it.item} <span className="small">({it.points})</span></label>
                        <input className={s.num} type="number" name={`s_${it.criteria_id}`} min={0} max={Number(it.points) || 100} />
                      </div>
                    ))}
                    <div className={s.wide}><label>평가 의견</label><textarea name="content" /></div>
                    <div className={s.wide}><label>필요 조치</label><input type="text" name="action_needed" style={{ width: "100%" }} /></div>
                    <FileAttach />
                    <Rep />
                    <div><button className="btn" type="submit">평가 저장</button></div>
                  </form>
                )}
              </details>
            );
          })}
        </details>

        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>가목 권한·예산 부여 등록</summary>
          <form action={saveGrant} className={s.form}>
            <Hidden />
            <div><label>대상</label><select name="target_role">{EVAL_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label>부여일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <div><label>예산(원)</label><input type="text" name="budget_amount" inputMode="numeric" /></div>
            <div className={s.wide}><label>근거 문서</label><input type="text" name="doc_name" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>준 권한</label><textarea name="content" /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">등록</button></div>
          </form>
        </details>

        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>나목 평가 기준표</summary>
          {EVAL_ROLES.map((er) => {
            const items = crit.filter((c) => c.target_role === er);
            const sum = items.filter((c) => c.active !== "N").reduce((a, c) => a + Number(c.points || 0), 0);
            return (
              <div key={er} style={{ marginBottom: 12 }}>
                <h3>{er} <span className={`badge ${sum === 100 ? "ok" : "warn"}`}>합계 {sum}점</span></h3>
                <table className="v2t">
                  <thead><tr><th>번호</th><th>항목 · 배점 · 사용</th></tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.criteria_id}>
                        <td title={it.law_basis}>{it.item_no}</td>
                        <td>
                          <form action={saveCriteria} className={s.row}>
                            <input type="hidden" name="role" value={role} /><input type="hidden" name="criteria_id" value={it.criteria_id} />
                            <input type="text" name="item" defaultValue={it.item} />
                            <input type="text" name="points" defaultValue={it.points} inputMode="numeric" style={{ width: "4.5rem" }} />
                            <select name="active" defaultValue={it.active === "N" ? "N" : "Y"}><option value="Y">사용</option><option value="N">빼기</option></select>
                            <button className="btn sm ghost" type="submit">고치기</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <form action={saveCriteria} className={s.row} style={{ marginTop: 6 }}>
                  <input type="hidden" name="role" value={role} /><input type="hidden" name="target_role" value={er} />
                  <input type="hidden" name="item_no" value={String(items.length + 1)} />
                  <input type="text" name="item" placeholder="항목" />
                  <input type="text" name="points" placeholder="배점" inputMode="numeric" style={{ width: "4.5rem" }} />
                  <input type="text" name="law_basis" placeholder="근거" />
                  <button className="btn sm ghost" type="submit">더하기</button>
                </form>
              </div>
            );
          })}
        </details>
      </>
    );
  }

  /* ── 제7호 ── */
  if (no === 7) {
    const vocs = (await readTable("worker_voice", "voice_id")).sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
    const proc = man("7");
    const stageSteps: Step[] = VOICE_STAGES.map((sg) => {
      const n = vocs.filter((v) => stageOf(v) === sg).length;
      return { label: sg, n, state: sg === "종결" ? (n ? "done" : "") : n ? "on" : "" };
    });
    body = (
      <>
        <h2>종사자 의견</h2>
        <Steps items={stageSteps} />
        <table className="v2t">
          <thead><tr><th className="dt">접수</th><th>경로</th><th>내용</th><th>단계</th><th className="dt">기한</th><th>처리</th></tr></thead>
          <tbody>
            {vocs.map((v) => {
              const sg = stageOf(v);
              const late = v.plan_due && v.plan_due < TODAY && sg !== "종결";
              const tip = [idKo(v.voice_id), deptName.get(v.dept_id) || v.dept_id, v.content, v.review_result && `검토: ${v.review_result}`, v.plan && `개선: ${v.plan}`, v.action_taken && `조치: ${v.action_taken}`].filter(Boolean).join(" · ");
              return (
                <tr key={v.voice_id}>
                  <td className="dt">{md(v.received_at)}</td>
                  <td title={v.substitute ? "의견 들은 것으로 봄" : ""}>{v.channel}</td>
                  <td title={tip}>{v.content}</td>
                  <td><span className={`badge ${STAGE_TONE[sg] || "none"}`}>{sg}</span></td>
                  <td className="dt">{v.plan_due ? (late ? <span className="badge bad">{md(v.plan_due)}</span> : md(v.plan_due)) : "—"}</td>
                  <td>
                    {sg !== "종결" && (
                      <details>
                        <summary className="btn sm ghost">다음 단계</summary>
                        <form action={advanceVoice} className={s.form} style={{ minWidth: "min(80vw, 640px)", marginTop: 8 }}>
                          <input type="hidden" name="role" value={role} /><input type="hidden" name="voice_id" value={v.voice_id} />
                          <div><label>단계</label><select name="stage" defaultValue={VOICE_STAGES[Math.min(VOICE_STAGES.indexOf(sg as any) + 1, 4)]}>{VOICE_STAGES.slice(1).map((x) => <option key={x}>{x}</option>)}</select></div>
                          <div><label>날짜</label><input type="date" name="at" defaultValue={TODAY} /></div>
                          <div><label>개선 필요?</label><select name="needs_improvement" defaultValue=""><option value="">—</option><option value="Y">필요</option><option value="N">불필요</option></select></div>
                          <div className={s.wide}><label>검토 결과</label><input type="text" name="review_result" style={{ width: "100%" }} /></div>
                          <div className={s.wide}><label>개선방안</label><input type="text" name="plan" style={{ width: "100%" }} /></div>
                          <div><label>이행 기한</label><input type="date" name="plan_due" /></div>
                          <div><label>이행 담당</label><select name="plan_owner_staff_id" defaultValue=""><option value="">—</option>{staffOpts.map((x: any) => <option key={x.staff_id} value={x.staff_id}>{x.display_name}</option>)}</select></div>
                          <div className={s.wide}><label>한 조치</label><input type="text" name="action_taken" style={{ width: "100%" }} /></div>
                          <Rep />
                          <div><button className="btn sm" type="submit">저장</button></div>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>의견 접수</summary>
          <form action={addVoice} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <div><label>접수일</label><input type="date" name="received_at" defaultValue={TODAY} /></div>
            <div><label>경로</label><select name="channel" defaultValue="현장 건의">{CHANNELS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>부서</label><select name="dept_id" defaultValue="">{[<option key="" value="">—</option>, ...dl.map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)]}</select></div>
            <div className={s.wide}><label>의견 내용</label><textarea name="content" required /></div>
            <Rep />
            <div><button className="btn" type="submit">접수</button></div>
          </form>
        </details>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>반기 점검 기록</summary>
          <form action={saveHalfCheck} className={s.form}>
            <Hidden extra={{ record_kind: "반기 점검", target_ref: proc[0]?.manual_id || "" }} />
            <div><label>점검일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <Checker />
            <div className={s.wide}><label>확인 내용</label><textarea name="content" /></div>
            <div className={s.wide}><label>필요 조치</label><input type="text" name="action_needed" style={{ width: "100%" }} /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">기록</button></div>
          </form>
        </details>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>위원회 · 협의체 논의 기록</summary>
          <form action={saveHalfCheck} className={s.form}>
            <Hidden extra={{ record_kind: "위원회 논의" }} />
            <div><label>회의</label><select name="substitute">{CHANNELS.slice(4).map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>회의일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <div><label>회의록</label><input type="text" name="doc_name" /></div>
            <div className={s.wide}><label>제목</label><input type="text" name="title" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>논의 내용</label><textarea name="content" /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">기록</button></div>
          </form>
        </details>
      </>
    );
  }

  /* ── 제8호 ── */
  if (no === 8) {
    const m8 = man("8");
    const recAll = await readTable("system_record", "record_id");
    const lastC = (m: Row) => [m.last_check_at, ...recAll.filter((r) => r.clause_no === "8" && r.target_ref === m.manual_id).map((r) => r.done_at)].filter(Boolean).sort().pop();
    const MOK = [["가", "가목 대응조치"], ["나", "나목 구호조치"], ["다", "다목 추가 피해방지"]];
    body = (
      <>
        <h2>매뉴얼과 점검(훈련)</h2>
        <table className="v2t">
          <thead><tr><th>매뉴얼</th><th>빠진 목</th><th className="dt">개정</th><th className="dt">최근 점검</th><th>{cur.label}</th></tr></thead>
          <tbody>
            {m8.map((m: any) => {
              const lc = lastC(m);
              return (
                <tr key={m.manual_id}>
                  <td title={`${m.manual_id} · 담은 목 ${m.covers || "—"}`}><b>{m.title}</b></td>
                  <td>{m.missing ? <span className="badge bad">{m.missing}목</span> : <span className="muted">—</span>}</td>
                  <td className="dt">{md(m.revised_at || m.enacted_at)}</td>
                  <td className="dt">{md(lc)}</td>
                  <td>{inHalf(lc, cur) ? <span className="badge ok">점검함</span> : <span className="badge bad">없음</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>반기 점검(훈련) 기록</h3>
          <form action={saveHalfCheck} className={s.form}>
            <Hidden extra={{ record_kind: "반기 점검" }} />
            <div><label>매뉴얼</label><select name="target_ref">{m8.map((m: any) => <option key={m.manual_id} value={m.manual_id}>{m.title}</option>)}</select></div>
            <div><label>점검일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <Checker />
            <div className={s.wide}><label>점검한 목</label>
              <div className={s.row}>{MOK.map(([k, l]) => <label key={k} className={s.small}><input type="checkbox" name={`cov_${k}`} value="Y" /> {l}</label>)}</div></div>
            <div className={s.wide}><label>확인 내용</label><textarea name="content" /></div>
            <div className={s.wide}><label>필요 조치</label><input type="text" name="action_needed" style={{ width: "100%" }} /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">기록</button></div>
          </form>
        </div>
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>매뉴얼 등록 · 개정</summary>
          <form action={saveManual} className={s.form}>
            <Hidden />
            <div><label>대상</label><select name="manual_id" defaultValue=""><option value="">새 매뉴얼</option>{m8.map((m: any) => <option key={m.manual_id} value={m.manual_id}>개정: {m.title} ({m.covers})</option>)}</select></div>
            <div className={s.wide}><label>제목</label><input type="text" name="title" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>담은 목</label>
              <div className={s.row}>{MOK.map(([k, l]) => <label key={k} className={s.small}><input type="checkbox" name={`cov_${k}`} value="Y" /> {l}</label>)}</div></div>
            <div><label>제정·개정일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <FileAttach />
            <Rep />
            <div><button className="btn" type="submit">저장</button></div>
          </form>
        </details>
      </>
    );
  }

  // 호 이동 = 단계 막대(지금 보는 호 on · 갖춰짐 done · 없음 warn)
  const navSteps: Step[] = CLAUSES.map((n) => {
    const k = clauses.findIndex((x) => x.no === n);
    const stt = sts[k];
    return { label: `제${n}호`, n: ST_LABEL[stt], href: q(`/system/record?clause=${n}`),
      state: n === no ? "on" : stt === "ok" ? "done" : stt === "none" ? "warn" : "" };
  });

  // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 기록(중대산업재해)은 의무이행(실적증빙) › 사업장의 같은 호 단계에서 연다.
  //   좌측 = 의무이행 좌측(사업장 묶음을 펼치고 그 단계를 켬) · 제목 줄에 「← 그 단계로」. 기록은 제 표(system_record)에 그대로 쌓인다.
  const stepKey = WS_REC_STEP[no] || STEPS.ws[0].key;
  const stepIdx = STEPS.ws.findIndex((x) => x.key === stepKey);
  return (
    <UsLayout side={<PerformSide track="ws" step={stepKey} />}>
      <FlowBar step="system" role={role} />
      <div className="crumb"><Link href={q("/system")}>체계 수립</Link> › 체계 기록</div>
      <MergedTitle title={c?.name} back={q(`/perform/ws/${stepKey}`)} backLabel={`사업장 ${stepIdx + 1}) ${STEPS.ws[stepIdx]?.label || ""} 단계로`} />
      <div className="chips">
        <span className="badge">시행령 제4조제{no}호</span>
        {c && <span className={`badge ${ST_TONE[sts[i]]}`}>{ST_LABEL[sts[i]]}</span>}
        <span className="badge none">{cur.label}</span>
      </div>
      <Steps items={navSteps} />
      {c && (
        <details className="card fold">
          <summary>조문 · 점검 항목</summary>
          <p className="muted">{c.text}</p>
          <ul className={s.checks}>
            {c.checks.map((k) => (
              <li key={k.label}>
                <span className={`badge ${ST_TONE[k.st]}`}>{ST_LABEL[k.st]}</span> <b>{k.label}</b> <span className="muted">· {k.basis}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {body}
      <h2>제{no}호 기록 <span className="muted">{recs.length}</span></h2>
      <Records rows={recs} role={role} who={who} />
    </UsLayout>
  );
}
