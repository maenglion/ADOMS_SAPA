// [캡처 v2] 대피훈련 한 건 — 단계 막대(계획→준비→임무→실시→평가→결과) + 핵심 칸이 맨 위. 붙임 번호·안내 문장은 뺐다(2026-09-22).
import Link from "next/link";
import StaffPicker from "@/components/StaffPicker";
import Thumb from "@/components/Thumb";
import Steps, { Facts, type Step } from "@/components/Steps";
import { loadDrills } from "../load";
import { DFLOW, ROLES, LRT, did, scopeTone, stageTone } from "../codes";
import EvalForm from "../EvalForm";
import SubstBox from "../SubstBox";
import { ceoConfirm } from "@/lib/roles";
import { savePrep, saveRoles, saveRun, saveEval, saveResult, saveSubstitute } from "../actions";
import s from "../drills.module.css";
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

/** 대피훈련 한 건 — 계획 · 준비 · 임무카드 · 실시 · 평가 · 결과 · 갈음. */
export default async function DrillDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const { drills, substs, deptName, staffName, staff } = await loadDrills();
  const d = drills.find((x) => x.drill_id === decodeURIComponent(id));
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 상세도 의무이행 레이아웃 + 좌측(분야별 이행 › 비상 대피훈련) 안에서
  if (!d) return <UsLayout side={<PerformSide cur="/drills" />}><p>훈련을 찾지 못했습니다. <Link href={`/drills?role=${role}&v=list`}>목록으로</Link></p></UsLayout>;

  const who = (sid?: string) => (sid ? staffName.get(sid) || sid : "");
  const opts = staff.map((x: any) => ({ staff_id: x.staff_id, display_name: x.display_name, dept_name: deptName.get(x.dept_id) || x.dept_id, duty_role: x.duty_role }));
  const at = DFLOW.indexOf(d.stage);
  const same = drills.filter((x) => x.target_key === d.target_key && x.drill_id !== d.drill_id);
  const prev = same.filter((x) => String(x.planned_at) < String(d.planned_at) && x.improvements)[0];
  const next = [...same].reverse().find((x) => String(x.planned_at) > String(d.planned_at));
  const pics = String(d.photos || "").split(" | ").filter(Boolean).map((u, i) => ({ url: u, name: `훈련 사진 ${i + 1}`, type: "image/jpeg", meta: d.place }));
  const e = d.eval;
  const isRail = d.target_key === LRT.asset_id || d.target_kind === "공중교통수단";
  const roleGap = ROLES.filter((r) => !d[`r_${r.key}_main`] || !d[`r_${r.key}_sub`]);
  const over = d.actual_minutes && Number(d.actual_minutes) > Number(d.target_minutes);
  const Hid = () => (<><input type="hidden" name="role" value={role} /><input type="hidden" name="drill_id" value={d.drill_id} /></>);

  // 업무이행 단계 — 끝난 것 done · 빠진 것 warn · 첫 미완료 on
  const steps: Step[] = [
    { label: "계획", state: "done", href: "#plan" },
    { label: "준비", state: at >= 1 ? "done" : "", href: "#prep" },
    { label: "임무", n: roleGap.length ? `빈 ${roleGap.length}` : "", state: roleGap.length ? "warn" : "done", href: "#roles" },
    { label: "실시", n: d.done_at ? String(d.done_at).slice(5) : "", state: d.done_at ? "done" : "", href: "#run" },
    { label: "평가", n: e ? `${d.score}점` : "", state: e ? "done" : "", href: "#eval" },
    { label: "결과", state: d.improvements || d.shortfalls ? "done" : "", href: "#result" },
  ];
  const first = steps.find((x) => x.state === "");
  if (first) first.state = "on";

  return (
    <UsLayout side={<PerformSide cur="/drills" />}>
      <div className="crumb"><Link href={`/drills?role=${role}`}>비상 대피훈련</Link>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 메뉴 이름 */} › <Link href={`/drills?role=${role}&v=list`}>훈련 목록</Link> › {did(d.drill_id)}</div>
      <h1 className="v2h">{d.target_name} {d.drill_type} 대피훈련</h1>
      <div className="chips">
        <span className={`badge ${scopeTone(d.legal_scope)}`}>{d.legal_scope}</span>
        <span className={`badge ${stageTone(d.stage)}`}>{d.stage}</span>
        <span className="badge none">{d.year} {d.half}</span>
      </div>

      <Steps items={steps} />

      <Facts items={[
        { k: "일시", v: String(d.planned_at || "—").slice(5, 16) },
        { k: "부서", v: deptName.get(d.dept_id) || d.dept_id },
        { k: "방법", v: d.method || "—" },
        { k: "대피(목표/실제)", v: <>{d.target_minutes || "—"} / <b className={over ? "tone-bad" : ""}>{d.actual_minutes || "—"}</b>분</> },
        { k: "참여", v: d.participants ? `${d.participants}명` : "—" },
        { k: "점수", v: e ? <b>{d.score}점</b> : "—" },
      ]} />

      {d.carry_over && (
        <div className={s.carry} title={d.carry_over}><b>넘어온 과제</b>{prev ? <> (<Link href={`/drills/${prev.drill_id}?role=${role}`}>{did(prev.drill_id)}</Link>)</> : null} · {String(d.carry_over).slice(0, 40)}</div>
      )}

      <div className={s.two}>
        <details className="card fold" id="plan">
          <summary>훈련 계획</summary>
          <dl className={s.kv}>
            <dt>대상</dt><dd>{d.target_key === LRT.asset_id ? d.target_name : <Link href={`/targets/${encodeURIComponent(d.target_key)}?role=${role}`}>{d.target_name}</Link>}
              <span className="muted"> · {d.target_kind}{d.asset_class ? ` (${d.asset_class})` : ""}</span></dd>
            <dt>장소</dt><dd>{d.place}</dd>
            <dt>시나리오</dt><dd>{d.scenario}</dd>
          </dl>
        </details>

        <div className={`card ${s.sec}`} id="prep" style={{ marginTop: 0 }}>
          <h3>준비목록</h3>
          <form action={savePrep}>
            <Hid />
            <div className={s.checks}>
              <label><input type="checkbox" name="prep_coop" value="1" defaultChecked={d.prep_coop === "완료"} /> 사전협조</label>
              <label><input type="checkbox" name="prep_items" value="1" defaultChecked={d.prep_items === "완료"} /> 훈련준비</label>
              <label><input type="checkbox" name="prep_budget" value="1" defaultChecked={d.prep_budget === "완료"} /> 예산·행정</label>
            </div>
            <div className={s.row}><input type="text" name="prep_memo" defaultValue={d.prep_memo} placeholder="메모" />
              <button className="btn sm" type="submit">저장</button></div>
          </form>
        </div>
      </div>

      <div className={`card ${s.sec}`} id="roles">
        <h3>임무카드 {roleGap.length > 0 ? <span className="badge warn">빈 역할 {roleGap.length}</span> : <span className="badge ok">모두 지정</span>}</h3>
        <form action={saveRoles}>
          <Hid />
          <div className={s.cards}>
            {ROLES.map((r) => (
              <div key={r.key} className={s.mcard} title={r.duty}>
                <b>{r.name}</b>
                <div className={s.who}><span className="muted">정</span><StaffPicker name={`r_${r.key}_main`} staff={opts} defaultValue={d[`r_${r.key}_main`] || ""} label="정담당" allowEmpty /></div>
                <div className={s.who}><span className="muted">부</span><StaffPicker name={`r_${r.key}_sub`} staff={opts} defaultValue={d[`r_${r.key}_sub`] || ""} label="부담당" allowEmpty /></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><button className="btn sm" type="submit">임무카드 저장</button></div>
        </form>
      </div>

      <div className={`card ${s.sec}`} id="run">
        <h3>실시 기록 {d.done_at ? <span className="badge ok">실시 {String(d.done_at).slice(5)}</span> : <span className="badge none">아직</span>}</h3>
        {pics.length > 0 && <div style={{ margin: "6px 0" }}><Thumb pics={pics} size={70} /></div>}
        <form action={saveRun}>
          <Hid />
          <input type="hidden" name="photos_prev" value={d.photos || ""} />
          <div className={s.row}>
            <span className="muted">실시일</span><input type="date" name="done_at" defaultValue={d.done_at || ""} />
            <span className="muted">대피(분)</span><input type="text" name="actual_minutes" defaultValue={d.actual_minutes} style={{ width: 80, flex: "none", minWidth: 0 }} />
            <span className="muted">참여</span><input type="text" name="participants" defaultValue={d.participants} style={{ width: 80, flex: "none", minWidth: 0 }} />
            <span className="muted">불참</span><input type="text" name="absent" defaultValue={d.absent} style={{ width: 70, flex: "none", minWidth: 0 }} />
          </div>
          <div className={s.row} style={{ marginTop: 8 }}>
            <span className="muted">사진</span><input type="file" name="photos" accept="image/*" multiple />
            <button className="btn sm" type="submit">실시 기록 저장</button>
          </div>
        </form>
      </div>

      <details className={`card fold ${s.sec}`} id="eval" open={Boolean(d.done_at && !e)}>
        <summary>평가표 100점 {e && <span className={s.score}>{d.score}점</span>}</summary>
        {e && <p className="muted" title={e.comment || ""}>평가자 {who(e.evaluator)} · {e.evaluated_at}</p>}
        <form action={saveEval}>
          <Hid />
          <div className="tbl-wrap" style={{ maxHeight: "none" }}><EvalForm initial={e} /></div>
          <div className={s.row} style={{ marginTop: 8 }}>
            <span className="muted">평가자</span><StaffPicker name="evaluator" staff={opts} defaultValue={e?.evaluator || d.r_eval_main || "SM02-2"} label="평가자" />
            <input type="text" name="comment" placeholder="총평" />
            <button className="btn sm" type="submit">{e ? "다시 평가" : "평가 저장"}</button>
          </div>
        </form>
      </details>

      <div className={`card ${s.sec}`} id="result">
        <h3>결과 · 미흡사항</h3>
        <form action={saveResult}>
          <Hid />
          <div className={s.form}>
            <div><label>잘된 점</label><textarea className={s.area} name="good_points" defaultValue={d.good_points} /></div>
            <div><label>미흡사항</label><textarea className={s.area} name="shortfalls" defaultValue={d.shortfalls} /></div>
            <div><label>개선 → 다음 과제</label><textarea className={s.area} name="improvements" defaultValue={d.improvements} /></div>
          </div>
          <div className={s.row} style={{ marginTop: 8 }}>
            <button className="btn sm" type="submit">결과 저장</button>
            {d.improvements && (next
              ? <span className="muted">다음 <Link href={`/drills/${next.drill_id}?role=${role}`}>{did(next.drill_id)}</Link>{" "}
                  {String(next.carry_over || "").includes(String(d.improvements).slice(0, 8))
                    ? <span className="badge ok">넘겨받음</span> : <span className="badge warn">계획에 없음</span>}</span>
              : <Link className="btn ghost sm" href={`/drills?role=${role}&v=new&t=${encodeURIComponent(d.target_key)}`}>다음 계획 →</Link>)}
          </div>
        </form>
      </div>

      {isRail && (
        <details className={`card fold ${s.sec}`} id="subst">
          <summary>철도안전법 제7조 비상대응계획으로 갈음</summary>
          {substs.get(d.target_key)
            ? <SubstBox x={substs.get(d.target_key)!} role={role} />
            : <p className="muted">갈음 근거 계획 없음</p>}
          <form action={saveSubstitute}>
            <Hid />
            <div className={s.checks}>
              <label><input type="checkbox" name="substitute" value="Y" defaultChecked={d.substitute === "Y"} /> 철도안전관리체계로 갈음</label>
              <label><input type="checkbox" name="ceo_checked" value="Y" defaultChecked={d.ceo_checked === "Y"} disabled={!ceoConfirm(role).ok} /> <b>경영책임자 확인(필수)</b></label>
            </div>
            <div className={s.row}>
              <select name="ceo_check_mode" defaultValue={String(d.ceo_check_mode || "보고받음").replace(/\(.*\)$/, "")}><option>직접 점검</option><option>보고받음</option></select>
              <input type="date" name="ceo_checked_at" defaultValue={d.ceo_checked_at || ""} />
              <button className="btn sm" type="submit">저장</button>
            </div>
          </form>
        </details>
      )}

      {same.length > 0 && (
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>같은 시설 다른 훈련 <span className="muted">{same.length}</span></summary>
          <table className="v2t">
            <thead><tr><th className="dt">훈련</th><th>시기</th><th>유형</th><th className="cd">단계</th><th className="num">점수</th></tr></thead>
            <tbody>
              {same.map((x) => (
                <tr key={x.drill_id} title={x.improvements || ""}>
                  <td className="dt"><Link href={`/drills/${x.drill_id}?role=${role}`}>{did(x.drill_id)}</Link></td>
                  <td>{x.year} {x.half}</td>
                  <td>{x.drill_type}</td>
                  <td className="cd"><span className={`badge ${stageTone(x.stage)}`}>{x.stage}</span></td>
                  <td className="num">{x.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </UsLayout>
  );
}
