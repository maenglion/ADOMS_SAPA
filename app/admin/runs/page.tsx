// [400 · 교육자료 버전] 관리자 — 자동 확인 작업 기록 (체크리스트 생성 작업 CoCo · 2026-09-24 추가 화면)
//  실행마다: 단계(① 개정 감시 ② 원문 대조 ③ 의무 판단 ④ 관리대상 연결 ⑤ 결과 정리) · 작업 기록 · 오류교훈 대조 · 사람 확인 항목.
//  확인 항목은 총괄·관리자가 「반영 / 반영 안 함」으로 닫는다(자동으로 의무를 만들거나 지우지 않는다 — 원칙 4).
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { depts } from "@/lib/data";
import { listRuns, runStatus, runLog, runItems, decisions, appliedRuns } from "@/lib/lawsync";
import AdminSide from "../_side";
import AutoRefresh from "../../law/changes/_parts/AutoRefresh";
import { ACTION_LABEL } from "../../law/changes/_parts/labels";
import { applyNow, decide, startCheck } from "../../law/changes/actions";
import { Note, qs } from "../_ui";

export const dynamic = "force-dynamic";

const LV_CLS: Record<string, string> = { 오류: "bad", 경고: "warn", 발견: "find", 완료: "ok", 실행: "run" };

export default async function Runs({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const can = role === "gm" || role === "mgr";
  const runs = listRuns();
  const id = sp.run || runs[0]?.run_id || "";
  const st = id ? runStatus(id) : null;
  const [dec, applied] = await Promise.all([decisions(), appliedRuns()]);
  const dn = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  const log = id ? runLog(id) : [];
  const agents = [...new Set(log.map((l) => l.name))];
  const ag = sp.ag || "";
  const lv = sp.lv || "";
  const shown = log.filter((l) => (!ag || l.name === ag) && (!lv || l.level === lv));
  const items = id ? runItems(id) : [];
  const tab = sp.tab || "human";
  const list = items.filter((x) => (tab === "human" ? x.needs_human === "Y" : tab === "done" ? dec.has(x.item_id) : true));
  const keep = { role, run: id, ag, lv, tab };
  const self = qs("/admin/runs", keep);
  const deptText = (s: string) => String(s || "").split(";").filter(Boolean).map((d) => dn.get(d) || d).join(" · ");

  return (
    <UsLayout side={<AdminSide page="runs" />}>
      <AutoRefresh on={st?.state === "진행 중"} />
      <div className="us-head usb2-head">
        <h1 className="us-h1">자동 확인 작업 기록 <span className="usb2-pre">체크리스트 생성 작업(CoCo)</span></h1>
      </div>
      {sp.ok === "apply" && <Note>반영했습니다.</Note>}

      <div className="lsx-runs">
        <div className="lsx-runlist">
          <div className="lsx-sub">실행 목록</div>
          {can && (
            <form action={startCheck}>
              <input type="hidden" name="role" value={role} />
              <button className="usb2-obtn" disabled={runs.some((r) => r.state === "진행 중")}>지금 확인 실행</button>
            </form>
          )}
          {runs.map((r) => (
            <Link key={r.run_id} href={qs("/admin/runs", { role, run: r.run_id })} className={`lsx-run ${r.run_id === id ? "on" : ""}`}>
              <b>{r.started_at.slice(0, 16)}</b>
              <span>{r.trigger}{r.run_id.includes("TEST") ? "(시험)" : ""} · {r.state}{applied.has(r.run_id) ? " · 반영" : ""}</span>
            </Link>
          ))}
          {!runs.length && <p className="us-muted">기록 없음</p>}
        </div>

        <div className="lsx-runbody">
          {!st && <p className="us-muted">실행을 고르세요.</p>}
          {st && (
            <>
              <table className="us-tbl lsx-info">
                <tbody>
                  <tr><th>실행</th><td>{st.run_id}</td><th>기준일</th><td>{st.asof}</td><th>상태</th><td>{st.state}{applied.has(st.run_id) ? " · 앱 반영 끝" : ""}</td></tr>
                  <tr><th>시작 · 끝</th><td>{st.started_at} ~ {st.ended_at || "…"}</td><th>누가</th><td>{st.by || "-"} · {st.trigger}</td><th>정본 발행판</th><td>{st.canon_release} (읽기만)</td></tr>
                </tbody>
              </table>
              {can && st.state === "완료" && !applied.has(st.run_id) && (
                <form action={applyNow} className="usb2-actions">
                  <input type="hidden" name="role" value={role} /><input type="hidden" name="run" value={st.run_id} />
                  <button className="usb2-obtn">앱에 반영</button>
                  <span className="us-muted"> 확인 작업이 끝날 때 앱이 꺼져 있었으면 여기서 반영합니다(여러 번 눌러도 한 번만 반영).</span>
                </form>
              )}

              <div className="lsx-sub">단계</div>
              <div className="lsx-prog">
                {st.steps.map((s) => (
                  <div key={s.key} className={`lsx-step ${s.state === "완료" ? "done" : s.state === "진행 중" ? "on" : s.state === "실패" ? "bad" : ""}`}>
                    <b>{s.name}</b>
                    <span>{s.state}{s.state === "진행 중" && s.total ? ` ${s.done}/${s.total}` : ""}</span>
                    <small>{s.note}</small>
                    <small className="us-muted">{s.started_at.slice(11)}{s.ended_at ? ` ~ ${s.ended_at.slice(11)}` : ""}</small>
                  </div>
                ))}
              </div>

              {st.lessons && (
                <div className="lsx-lesson">
                  <div className="lsx-sub">오류교훈 대조</div>
                  <div>{st.lessons.요약}</div>
                  <ul>{st.lessons.적용.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}

              <div className="lsx-sub">판단 항목 — {items.length}건 (사람 확인 {items.filter((x) => x.needs_human === "Y").length} · 처리 {items.filter((x) => dec.has(x.item_id)).length})</div>
              <div className="lsx-tabs">
                {[["human", "확인 필요"], ["done", "처리함"], ["all", "전체"]].map(([k, l]) => (
                  <Link key={k} href={qs("/admin/runs", { ...keep, tab: k })} className={tab === k ? "on" : ""}>{l}</Link>
                ))}
              </div>
              <table className="us-tbl lsx-items">
                <thead><tr><th style={{ width: "18%" }}>법령 · 조문</th><th style={{ width: "14%" }}>갈래</th><th>바뀐 내용</th><th style={{ width: "18%" }}>우리 기관</th><th style={{ width: "16%" }}>처리</th></tr></thead>
                <tbody>
                  {list.slice(0, 150).map((x) => {
                    const d = dec.get(x.item_id);
                    return (
                      <tr key={x.item_id}>
                        <td><b>{x.title}</b><div>{x.label || x.unit_path || "-"}</div>{x.effective && <small className="us-muted">시행 {x.effective}</small>}</td>
                        <td>{ACTION_LABEL[x.action] || x.action}{x.role && <div className="us-muted">정본 역할 {x.role}</div>}{x.predicate === "Y" && <div className="us-muted">의무 문장</div>}</td>
                        <td>
                          {x.kind === "법령" ? (
                            <details><summary>{String(x.new_text || x.old_text || "").slice(0, 70)}…</summary>
                              <div className="lsx-diff"><div><div className="lsx-dh">개정 전</div><div className="lsx-dt">{x.old_text || "(없던 조문)"}</div></div>
                                <div><div className="lsx-dh">개정 후</div><div className="lsx-dt">{x.new_text || "(현행 원문에 없음)"}</div></div></div>
                            </details>
                          ) : <span className="us-muted">{String(x.note).slice(0, 160)}</span>}
                        </td>
                        <td>
                          {x.duty_keys ? <>의무 {String(x.duty_keys).split(";").map((k: string) => <Link key={k} href={`/duties/${k}`}>{k} </Link>)}<div className="us-muted">{deptText(x.depts)} · 배정 {x.assign_n} · 과제 {x.task_n}</div></>
                            : x.prop_depts ? <span className="us-muted">검토 부서 {deptText(x.prop_depts)}{x.prop_assets ? ` · 관리대상 ${x.prop_assets}` : ""}</span> : <span className="us-muted">-</span>}
                        </td>
                        <td>
                          {d ? <span className="lsx-st ok">{d.decision}<br /><small>{String(d.at).slice(0, 10)} {d.duty_keys}</small></span>
                            : x.needs_human !== "Y" ? <span className="us-muted">참고</span>
                            : can && applied.has(id) ? (
                              <form action={decide} className="lsx-dec">
                                <input type="hidden" name="role" value={role} /><input type="hidden" name="run" value={id} />
                                <input type="hidden" name="item" value={x.item_id} /><input type="hidden" name="back" value={self} />
                                <input type="text" name="note" placeholder="메모" />
                                <button name="decision" value="반영" className="usb2-obtn">반영</button>
                                <button name="decision" value="반영 안 함" className="us-btn-s">반영 안 함</button>
                              </form>
                            ) : <span className="lsx-st wait">담당 확인 중</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!list.length && <tr><td colSpan={5} className="c usb2-empty">항목이 없습니다</td></tr>}
                </tbody>
              </table>

              <div className="lsx-sub">작업 기록 {shown.length}/{log.length}줄</div>
              <form method="get" action="/admin/runs" className="lsx-filter">
                <input type="hidden" name="role" value={role} /><input type="hidden" name="run" value={id} /><input type="hidden" name="tab" value={tab} />
                <select name="ag" defaultValue={ag}><option value="">작업자 전체</option>{agents.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                <select name="lv" defaultValue={lv}><option value="">수준 전체</option>{["정보", "실행", "도구 출력", "발견", "경고", "오류", "완료"].map((x) => <option key={x}>{x}</option>)}</select>
                <button className="usb2-sbtn">보기</button>
              </form>
              <div className="lsx-log">
                {shown.slice(-400).map((l, i) => (
                  <div key={i} className={`lsx-l ${LV_CLS[l.level] || ""}`}>
                    <span className="t">{String(l.at).slice(11)}</span><span className="a">{l.name}</span><span className="v">{l.level}</span><span className="m">{l.msg}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </UsLayout>
  );
}
