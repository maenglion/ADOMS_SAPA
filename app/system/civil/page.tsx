// [캡처 v2] K02 — 중대시민재해(공중이용시설·공중교통수단) 체계 기록 입력(시행령 제10조제4·5·7호). 산업 쪽 /system/record 와 같은 결(2026-09-24).
//   호 이동 = 단계 막대 · 핵심 칸 · 입력은 접기 · 표 6칸 이하. 조문은 칩과 접기 안에만.
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import Steps, { Facts, type Step } from "@/components/Steps";
import { type Row } from "@/lib/data";
import {
  civilStatus, ST_LABEL, ST_TONE, halfOf, inHalf, planState, PLAN_TONE, type PlanState,
  CIV_RESULT_KEYS, CIV_RESULT_NAME, CIV_RESULTS, CIV_RESULT_TONE, CIV_ACTIONS, civWeak, FMS_PLAN, RAIL_PLAN, OWN_PLAN,
} from "@/lib/system";
import { ceoConfirm } from "@/lib/roles";
import { saveCivilHalf, markCivil, saveCivilProc, saveCivilPlan, saveCivilPlanItem } from "../civilActions";
import s from "../system.module.css";
import { ymd } from "@/lib/day";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기
import { STEPS } from "@/lib/us/tracks";
import { MergedTitle, FC_REC_STEP } from "../../perform/_merge";

export const dynamic = "force-dynamic";

const CLAUSES = [4, 5, 7] as const;
const TODAY = ymd();
const METHODS = ["대면 보고", "전자 결재", "회의 보고", "서면 보고"];
const MOK7 = [["가", "가목 확인·점검"], ["나", "나목 발견 시 조치"], ["다", "다목 발생 시 조치"], ["라", "라목 대피훈련"]] as const;
const MOK4 = [["ga", "가", "가목 인력 확보"], ["na", "나", "나목 점검·진단"], ["da", "다", "다목 보수·보강"]] as const;
const md = (x?: string) => (x ? String(x).slice(5, 10) : "—");
const ORDER: PlanState[] = ["미수립", "작성 중", "갈음 확인 없음", "목 누락", "갈음 인정", "수립"];

/** 경영책임자 보고받음 — 경영책임자 본인 또는 총괄(대리 기록)만 보인다. */
function Report({ role, label = "경영책임자 보고받음" }: { role: string; label?: string }) {
  const c = ceoConfirm(role);
  if (!c.ok) return null;
  return (
    <div className={s.rep}>
      <label><input type="checkbox" name="ceo_reported" value="Y" style={{ width: "auto" }} /> <b>{label}{c.proxy ? " (대리)" : ""}</b></label>
      <label>보고받은 날 <input type="date" name="reported_at" defaultValue={TODAY} /></label>
      <label>방식 <select name="report_method" defaultValue="대면 보고">{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
    </div>
  );
}

/** 보고 칸 — 있으면 날짜, 없으면(권한이 있을 때) 바로 남기는 작은 입력. */
function RepCell({ r, role, clause }: { r: Row; role: string; clause: number }) {
  if (r.ceo_reported === "Y") return <span className="badge ok" title={`${r.report_method || ""}${r.report_proxy === "Y" ? " · 대리 기록" : ""}`}>보고 {md(r.reported_at)}</span>;
  if (!ceoConfirm(role).ok) return <span className="badge bad">없음</span>;
  return (
    <form action={markCivil} className={s.inline}>
      <input type="hidden" name="role" value={role} /><input type="hidden" name="clause" value={String(clause)} />
      <input type="hidden" name="record_id" value={r.record_id} /><input type="hidden" name="what" value="report" />
      <input type="date" name="reported_at" defaultValue={TODAY} />
      <button className="btn sm ghost" type="submit">보고받음</button>
    </form>
  );
}

export default async function CivilRecordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const no = CLAUSES.includes(Number(sp.clause) as any) ? Number(sp.clause) : 5;
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const c = await civilStatus(role);
  const idx = (n: number) => c.clauses.findIndex((x) => x.no === n);
  const i = idx(no);
  const cl = c.clauses[i];
  const cur = halfOf();
  const staffOpts = c.st.filter((x: any) => String(x.staff_id).startsWith("S"));
  const recs = c.civRecs.filter((r) => r.clause_ref === `10-${no}`);
  const Checker = () => (
    <div><label>점검자</label>
      <select name="checker_staff_id" defaultValue="">
        <option value="">— 입력한 사람 —</option>
        {staffOpts.map((x: any) => <option key={x.staff_id} value={x.staff_id}>{x.display_name} · {c.deptName.get(x.dept_id) || x.dept_id}</option>)}
      </select></div>
  );
  // [캡처 v2] K03 — 파일 첨부 한 칸 + (파일이 없을 때) 이름 글자
  const Ev = () => <><FileAttach /><div><label>증빙 이름</label><input type="text" name="evidence_name" placeholder="파일 없으면 이름만" /></div></>;

  let body: React.ReactNode = null;

  /* ── 제5호 반기 이행점검 → 제6호 조치 ── */
  if (no === 5) {
    const half5 = recs;
    const curRecs = half5.filter((r) => inHalf(r.done_at, cur));
    const open = half5.filter((r) => r.action_needed && !r.action_done_at);
    const seedHalf = c.halfChecks.filter((m) => String(m.manual_id).startsWith("CMN"));
    body = (
      <>
        <Facts items={[
          { k: `${cur.label} 점검`, v: <b className={curRecs.length ? "" : "tone-bad"}>{curRecs.length}</b> },
          { k: "보고받음", v: `${half5.filter((r) => r.ceo_reported === "Y").length}/${half5.length}` },
          { k: "보완 필요·미흡", v: half5.filter((r) => civWeak(r).length).length },
          { k: "제6호 남은 조치", v: <b className={open.length ? "tone-bad" : ""}>{open.length}</b> },
        ]} />
        <details className="card fold" open={!curRecs.length || Boolean(sp.err)} style={{ marginTop: 12 }}>
          <summary>반기 점검 등록</summary>
          <form action={saveCivilHalf} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <div><label>점검일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <Checker />
            <Ev />
            {CIV_RESULT_KEYS.map((k) => (
              <div key={k}><label>{CIV_RESULT_NAME[k]}</label>
                <select name={k} defaultValue=""><option value="">— 점검 안 함 —</option>{CIV_RESULTS.map((x) => <option key={x}>{x}</option>)}</select></div>
            ))}
            <div className={s.wide}><label>확인 내용</label><textarea name="content" /></div>
            <div><label>제6호 조치</label><select name="action_kind" defaultValue="인력 배치">{CIV_ACTIONS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>조치 과제</label><input type="text" name="action_needed" placeholder="보완 필요·미흡이면 적습니다" /></div>
            <div><label>조치 기한</label><input type="date" name="action_due" /></div>
            <Report role={role} />
            <div><button className="btn" type="submit">등록</button></div>
          </form>
        </details>

        <h2 id="act">점검 기록 <span className="muted">{half5.length + seedHalf.length}</span></h2>
        <table className="v2t">
          <thead><tr><th className="dt">점검일</th><th>제1~4호 결과</th><th>제6호 조치</th><th>보고</th><th>증빙</th></tr></thead>
          <tbody>
            {half5.map((r) => (
              <tr key={r.record_id}>
                <td className="dt" title={`${r.half} · 점검자 ${c.who(r.checker_staff_id)}`}>{md(r.done_at)}</td>
                <td title={r.content || ""}>{CIV_RESULT_KEYS.map((k, n) => (
                  <span key={k} className={`badge ${r[k] ? CIV_RESULT_TONE[r[k]] : "none"}`} style={{ marginRight: 3 }} title={`${CIV_RESULT_NAME[k]} · ${r[k] || "점검 안 함"}`}>{n + 1}</span>
                ))}</td>
                <td title={[r.action_kind, r.action_needed, r.action_due && `기한 ${r.action_due}`].filter(Boolean).join(" · ")}>
                  {!r.action_needed ? <span className="muted">—</span> : r.action_done_at ? <span className="badge ok">완료 {md(r.action_done_at)}</span> : (
                    <form action={markCivil} className={s.inline}>
                      <input type="hidden" name="role" value={role} /><input type="hidden" name="clause" value="5" />
                      <input type="hidden" name="record_id" value={r.record_id} /><input type="hidden" name="what" value="action" />
                      <span className={`badge ${r.action_due && r.action_due < TODAY ? "bad" : "warn"}`}>{r.action_kind || "조치"}</span>
                      <input type="date" name="action_done_at" defaultValue={TODAY} />
                      <button className="btn sm ghost" type="submit">완료</button>
                    </form>
                  )}
                </td>
                <td><RepCell r={r} role={role} clause={5} /></td>
                <td><FileLink name={r.evidence_name} url={r.evidence_url} /></td>
              </tr>
            ))}
            {seedHalf.map((m) => (
              <tr key={m.manual_id}>
                <td className="dt">{md(m.done_at)}</td>
                <td title={m.title}><span className="muted">담은 호 {m.covers || "—"}</span></td>
                <td><span className="muted">—</span></td>
                <td>{m.reported_at ? <span className="badge ok">보고 {md(m.reported_at)}</span> : <span className="badge bad">없음</span>}</td>
                <td><span className="muted">—</span></td>
              </tr>
            ))}
            {!half5.length && !seedHalf.length && <tr><td colSpan={5} className="muted">기록 없음</td></tr>}
          </tbody>
        </table>
      </>
    );
  }

  /* ── 제7호 업무처리절차 ── */
  if (no === 7) {
    const docs = c.facDocs;
    const covers = new Set(docs.flatMap((m) => String(m.covers || "").split("·")));
    const edit = docs.find((m) => m.manual_id === sp.doc);
    const hist = recs;
    body = (
      <>
        <Facts items={MOK7.map(([k, l]) => ({ k: l.split(" ")[0], v: covers.has(k) ? <span className="badge ok">있음</span> : <span className="badge bad">없음</span> }))} />
        <h2>절차 문서 <span className="muted">{docs.length}</span></h2>
        <table className="v2t">
          <thead><tr><th>문서</th><th>담은 목</th><th className="dt">시행</th><th className="dt">개정</th><th>증빙</th><th></th></tr></thead>
          <tbody>
            {docs.map((m) => (
              <tr key={m.manual_id}>
                <td title={`${m.record_kind || ""} · 담당 ${c.who(m.owner_staff_id) || "—"}`}><b>{m.title}</b></td>
                <td>{MOK7.map(([k]) => <span key={k} className={`badge ${String(m.covers || "").includes(k) ? "ok" : "none"}`} style={{ marginRight: 3 }}>{k}</span>)}</td>
                <td className="dt">{md(m.enacted_at)}</td>
                <td className="dt">{md(m.revised_at)}</td>
                <td><FileLink name={m.evidence_name} url={m.evidence_url} /></td>
                <td><Link className="btn sm ghost" href={q(`/system/civil?clause=7&doc=${m.manual_id}`) + "#proc"}>개정</Link></td>
              </tr>
            ))}
            {c.railDoc && (
              <tr>
                <td title={c.railDoc.basis}><b>{c.railDoc.title}</b></td>
                <td><span className="badge none">단서</span></td>
                <td className="dt">{md(c.railDoc.enacted_at)}</td>
                <td className="dt">{md(c.railDoc.revised_at)}</td>
                <td><span className="muted">—</span></td>
                <td><Link className="more" href={q("/system?area=F") + "#subst"}>갈음 →</Link></td>
              </tr>
            )}
          </tbody>
        </table>

        <details className="card fold" id="proc" open={Boolean(edit || sp.add || sp.err)} style={{ marginTop: 12 }}>
          <summary>{edit ? `개정 — ${edit.title}` : "절차 등록 · 개정"}</summary>
          <form key={edit?.manual_id || "new"} action={saveCivilProc} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <div><label>대상</label>
              <select name="manual_id" defaultValue={edit?.manual_id || ""}>
                <option value="">새 문서 등록</option>
                {docs.map((m) => <option key={m.manual_id} value={m.manual_id}>개정: {m.title}</option>)}
              </select></div>
            <div><label>시행일</label><input type="date" name="enacted_at" defaultValue={TODAY} /></div>
            <Ev />
            <div className={s.wide}><label>문서 이름{edit ? "(바꿀 때만)" : ""}</label><input type="text" name="title" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>담은 목</label>
              <div className={s.row}>{MOK7.map(([k, l]) => (
                <label key={k} className={s.small}><input type="checkbox" name={`cov_${k}`} value="Y" defaultChecked={edit ? String(edit.covers || "").includes(k) : false} style={{ width: "auto" }} /> {l}</label>
              ))}</div></div>
            <div className={s.wide}><label>개정 사유</label><input type="text" name="content" style={{ width: "100%" }} /></div>
            <Report role={role} />
            <div><button className="btn" type="submit">저장</button></div>
          </form>
        </details>

        <h2>개정 이력 <span className="muted">{hist.length}</span></h2>
        <table className="v2t">
          <thead><tr><th className="dt">날짜</th><th>구분</th><th>문서</th><th>담은 목</th><th>보고</th></tr></thead>
          <tbody>
            {hist.map((r) => (
              <tr key={r.record_id}>
                <td className="dt">{md(r.done_at)}</td>
                <td><span className="badge">{r.record_kind}</span></td>
                <td title={[r.content, r.evidence_name && `증빙 ${r.evidence_name}`].filter(Boolean).join(" · ")}><b>{r.title}</b></td>
                <td>{r.covers || "—"}</td>
                <td>{r.ceo_reported === "Y" ? <span className="badge ok">보고 {md(r.reported_at)}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {!hist.length && <tr><td colSpan={5} className="muted">화면에서 남긴 이력 없음</td></tr>}
          </tbody>
        </table>
      </>
    );
  }

  /* ── 제4호 안전계획 ── */
  if (no === 4) {
    const plans = [...c.plans].sort((a, b) => ORDER.indexOf(planState(a)) - ORDER.indexOf(planState(b)) || String(a.facility_name).localeCompare(String(b.facility_name), "ko"));
    const cnt = (x: PlanState) => plans.filter((r) => planState(r) === x).length;
    const look = plans.filter((r) => !["수립", "갈음 인정"].includes(planState(r)));
    const sel = plans.find((r) => r.asset_id === sp.asset);
    const selState = sel ? planState(sel) : undefined;
    const yearOpts = [...new Set([...c.years, c.year, String(Number(c.year) + 1)])].sort();
    const facOpts = (rows: Row[]) => rows.map((r) => <option key={r.plan_id} value={r.asset_id}>{r.facility_name} · {planState(r)}</option>);
    const itemRecs = recs.filter((r) => r.record_kind === "계획 이행");
    body = (
      <>
        <Facts items={[
          { k: `${c.year}년 대상`, v: <b>{plans.length.toLocaleString()}</b> },
          { k: "갖춰짐", v: (cnt("수립") + cnt("갈음 인정")).toLocaleString() },
          { k: "갈음 확인 없음", v: cnt("갈음 확인 없음") },
          { k: "목 누락", v: cnt("목 누락") },
          { k: "작성 중·미수립", v: <b className={cnt("미수립") ? "tone-bad" : ""}>{cnt("작성 중") + cnt("미수립")}</b> },
          { k: "이행률", v: `${c.rate}%` },
        ]} />

        {sel && (
          <div className="card" style={{ marginTop: 12 }}>
            <b>{sel.facility_name}</b> <span className={`badge ${PLAN_TONE[selState!]}`}>{selState}</span>{" "}
            <span className="muted" title={sel.plan_basis}>{sel.plan_basis === OWN_PLAN ? "자체" : sel.plan_basis ? "갈음" : "—"}</span>{" "}
            {(["ga", "na", "da"] as const).map((m, n) => <span key={m} className={`badge ${sel[`mok_${m}`] === "Y" ? "ok" : "bad"}`} style={{ marginRight: 3 }}>{["가", "나", "다"][n]}</span>)}
            <span className="muted"> 이행 {sel.items_done || 0}/{sel.items_planned || 0}{sel.ceo_confirmed === "Y" ? ` · 확인 ${md(sel.confirmed_at)}` : ""}</span>
          </div>
        )}

        <details className="card fold" id="planf" open={Boolean(sel || sp.err)} style={{ marginTop: 12 }}>
          <summary>안전계획 등록</summary>
          <form key={sel?.asset_id || "new"} action={saveCivilPlan} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <div><label>대상 시설(관리대상)</label><select name="asset_id" required defaultValue={sel?.asset_id || ""}><option value="">— 고르기 —</option>{facOpts(plans)}</select></div>
            <div><label>연도</label><select name="plan_year" defaultValue={c.year}>{yearOpts.map((y) => <option key={y} value={y}>{y}년</option>)}</select></div>
            <div><label>수립일</label><input type="date" name="established_at" defaultValue={TODAY} /></div>
            <div><label>근거</label>
              <select name="plan_basis" defaultValue={sel?.plan_basis || OWN_PLAN}>
                <option value={OWN_PLAN}>자체 안전계획</option>
                <option value={FMS_PLAN}>갈음 — 시설물안전법 제6조</option>
                <option value={RAIL_PLAN}>갈음 — 철도안전법 제6조</option>
              </select></div>
            <div><label>상태</label><select name="plan_status" defaultValue="수립"><option value="수립">수립</option><option value="작성중">작성 중</option></select></div>
            <div><label>계획 항목 수</label><input type="text" name="items_planned" inputMode="numeric" defaultValue={sel?.items_planned || ""} /></div>
            <div className={s.wide}><label>담은 목</label>
              <div className={s.row}>{MOK4.map(([m, , l]) => (
                <label key={m} className={s.small}><input type="checkbox" name={`mok_${m}`} value="Y" defaultChecked={sel ? sel[`mok_${m}`] === "Y" : false} style={{ width: "auto" }} /> {l}</label>
              ))}</div></div>
            <Ev />
            <div className={s.wide}><label>메모</label><input type="text" name="content" style={{ width: "100%" }} /></div>
            <Report role={role} label="경영책임자 확인·보고받음(갈음)" />
            <div><button className="btn" type="submit">등록</button></div>
          </form>
        </details>

        <details className="card fold" style={{ marginTop: 8 }}>
          <summary>항목 이행 입력</summary>
          <form key={`i-${sel?.asset_id || "new"}`} action={saveCivilPlanItem} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="plan_year" value={c.year} />
            <div><label>대상 시설</label><select name="asset_id" required defaultValue={sel?.plan_status === "수립" ? sel.asset_id : ""}><option value="">— 고르기 —</option>{facOpts(plans.filter((r) => r.plan_status === "수립"))}</select></div>
            <div><label>목</label><select name="mok" defaultValue="나">{MOK4.map(([, k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label>이행일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <div className={s.wide}><label>계획 항목</label><input type="text" name="item" style={{ width: "100%" }} /></div>
            <div className={s.wide}><label>이행 내역</label><input type="text" name="content" style={{ width: "100%" }} /></div>
            <Ev />
            <div><button className="btn" type="submit">이행 기록</button></div>
          </form>
        </details>

        <h2>살펴볼 곳 <span className="muted">{look.length}</span></h2>
        <table className="v2t">
          <thead><tr><th>시설</th><th>부서</th><th>상태</th><th>근거</th><th>가·나·다</th><th></th></tr></thead>
          <tbody>
            {look.slice(0, 15).map((r) => {
              const ps = planState(r);
              return (
                <tr key={r.plan_id}>
                  <td title={[r.asset_gbn, r.asset_class, r.facility_kind].filter(Boolean).join(" · ")}><b>{r.facility_name}</b></td>
                  <td>{c.deptName.get(r.dept_id) || r.dept_id || "—"}</td>
                  <td><span className={`badge ${PLAN_TONE[ps]}`}>{ps}</span></td>
                  <td title={r.plan_basis}>{r.plan_basis === OWN_PLAN ? "자체" : r.plan_basis ? "갈음" : "—"}</td>
                  <td>{r.plan_status === "미수립" || !r.plan_status ? "—" : (["ga", "na", "da"] as const).map((m, n) => (
                    <span key={m} className={`badge ${r[`mok_${m}`] === "Y" ? "ok" : "bad"}`} style={{ marginRight: 3 }}>{["가", "나", "다"][n]}</span>
                  ))}</td>
                  <td><Link className="btn sm ghost" href={q(`/system/civil?clause=4&asset=${encodeURIComponent(r.asset_id)}`) + "#planf"}>등록</Link></td>
                </tr>
              );
            })}
            {!look.length && <tr><td colSpan={6} className="muted">모두 갖춰짐</td></tr>}
          </tbody>
        </table>
        {look.length > 15 && <Link className="more" href={q("/system?area=F") + "#plan"}>전체 {look.length}건 →</Link>}

        <h2>등록 기록 <span className="muted">{recs.length}</span></h2>
        <table className="v2t">
          <thead><tr><th className="dt">날짜</th><th>구분</th><th>내용</th><th>목</th><th>확인</th><th>증빙</th></tr></thead>
          <tbody>
            {recs.slice(0, 15).map((r) => (
              <tr key={r.record_id}>
                <td className="dt">{md(r.done_at)}</td>
                <td><span className="badge">{r.record_kind}</span></td>
                <td title={r.content || ""}><b>{r.title}</b></td>
                <td>{r.covers || "—"}</td>
                <td>{r.ceo_reported === "Y" ? <span className="badge ok" title={r.report_proxy === "Y" ? "대리 기록" : ""}>{md(r.reported_at)}</span> : <span className="muted">—</span>}</td>
                <td><FileLink name={r.evidence_name} url={r.evidence_url} /></td>
              </tr>
            ))}
            {!recs.length && <tr><td colSpan={6} className="muted">기록 없음</td></tr>}
          </tbody>
        </table>
        {itemRecs.length > 0 && <p className="muted">항목 이행 {itemRecs.length}건</p>}
      </>
    );
  }

  // 호 이동 = 단계 막대(지금 보는 호 on · 갖춰짐 done · 없음 warn). 제6호는 제5호 화면의 조치 칸으로 간다.
  const NAV = [[4, "안전계획", 4], [5, "반기 점검", 5], [6, "제6호 조치", 5], [7, "업무절차", 7]] as const;
  const navSteps: Step[] = NAV.map(([n, label, page]) => {
    const stt = c.sts[idx(n)];
    return { label, n: ST_LABEL[stt], href: q(`/system/civil?clause=${page}`) + (n === 6 ? "#act" : ""),
      state: n === no ? "on" : stt === "ok" ? "done" : stt === "none" ? "warn" : "" };
  });

  // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 기록(중대시민재해)은 의무이행(실적증빙) › 공중이용시설·공중교통수단의 같은 호 단계에서 연다.
  //   제4호 → 4) 안전계획 · 제5호(반기 점검)·제6호 조치 → 3) 안전점검 · 제7호 → 5) 재해예방업무처리절차.
  //   좌측 = 의무이행 좌측(공중이용시설 묶음을 펼치고 그 단계를 켬) · 제목 줄에 「← 그 단계로」. 기록은 제 표에 그대로 쌓인다.
  const stepKey = FC_REC_STEP[no] || STEPS.fc[0].key;
  const stepIdx = STEPS.fc.findIndex((x) => x.key === stepKey);
  return (
    <UsLayout side={<PerformSide track="fc" step={stepKey} />}>
      <FlowBar step="system" role={role} />
      <div className="crumb"><Link href={q("/system?area=F")}>체계 수립</Link> › 중대시민재해(공중이용시설·공중교통수단) 기록</div>
      <MergedTitle title={cl?.name} back={q(`/perform/fc/${stepKey}`)} backLabel={`공중이용시설·공중교통수단 ${stepIdx + 1}) ${STEPS.fc[stepIdx]?.label || ""} 단계로`} />
      <div className="chips">
        <span className="badge">시행령 제10조제{no}호{no === 5 ? "·제6호" : ""}</span>
        {cl && <span className={`badge ${ST_TONE[c.sts[i]]}`}>{ST_LABEL[c.sts[i]]}</span>}
        <span className="badge none">{no === 5 ? cur.label : no === 4 ? `${c.year}년 · 연 1회 이상` : "상시"}</span>
      </div>
      <Steps items={navSteps} />
      {sp.saved && <div className="card" style={{ borderColor: "#9cc1b3" }}>저장했습니다.</div>}
      {sp.err && <div className={`card ${s.fix}`}>저장 안 됨 — {sp.err}</div>}
      {cl && (
        <details className="card fold">
          <summary>조문 · 점검 항목</summary>
          <p className="muted">{cl.text}</p>
          <ul className={s.checks}>
            {[...cl.checks, ...(no === 5 ? c.clauses[idx(6)]?.checks || [] : [])].map((k) => (
              <li key={k.label}>
                <span className={`badge ${ST_TONE[k.st]}`}>{ST_LABEL[k.st]}</span> <b>{k.label}</b> <span className="muted">· {k.basis}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {body}
    </UsLayout>
  );
}
