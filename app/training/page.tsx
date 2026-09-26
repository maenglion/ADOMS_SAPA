// [캡처 v2] 교육 실시 점검 — 단계 막대(대상→이수→이행 지시→점검) + 한 줄 표. 조문 인용·범례 문단·출처 문단은 뺐고 과정×부서 표는 접었다(2026-09-22).
import Link from "next/link";
import Steps, { Facts, type Step } from "@/components/Steps";
import { BarGroup, Donut, ChartSwitch, type Slice } from "@/components/Chart";
import { readTable, type Row } from "@/lib/data";
import { ceoConfirm } from "@/lib/roles";
import {
  loadTraining, FRAMES, AREAS, areaOfParam, periodOf, checkArea, checkPeriod, ST_TONE, shortDept, type St, type Area,
} from "./model";
import { instruct, registerTraining, recordCheck } from "./actions";
import s from "./training.module.css";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

const CELL_TXT: Record<St, string> = {
  이수: "이수", 미이수: "미이수", "기한 초과": "초과", "기록 없음": "없음", "발생 시": "발생 시", "해당 없음": "─",
};
const md = (x?: string) => (x ? String(x).slice(5, 10) : "—");

/** 교육 실시 점검 — 재해 구분별 틀 3개. */
export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const area: Area = areaOfParam(sp.area);
  const f = FRAMES[area];
  const graph = sp.g || "";
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const tq = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role, area });
    Object.entries(o).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return `/training?${p.toString()}`;
  };

  const { courses: allCourses, recs: allRecs, dl, st, deptName, staffName, applies, cell, now } = await loadTraining();
  const period = periodOf(area, now);
  const allChecks = await readTable("training_check", "check_id");
  const checks = allChecks.filter((c) => checkArea(c) === area && checkPeriod(c) === period);
  const notifs = (await readTable("notification", "notif_id"))
    .filter((n) => n.notif_type === "교육 이행 지시" && String(n.note || "").includes(f.n4));

  const courses = allCourses.filter((c) => c.area === area);
  const recs = allRecs.filter((r) => r.area === area);

  const cellsOf = (cs: Row[]) => cs.flatMap((c) => dl.map((d: Row) => ({ c, d, ...cell(c, d.dept_id) })))
    .filter((x) => x.ap && x.st !== "발생 시");
  const counted = cellsOf(courses);
  const n = (k: St, list = counted) => list.filter((x) => x.st === k).length;
  const hz = counted.filter((x) => x.c.hazardous_work === "Y");
  const slices: Slice[] = (["이수", "미이수", "기한 초과", "기록 없음"] as St[]).map((k) => ({
    label: k, n: n(k), tone: ST_TONE[k] as Slice["tone"],
  }));

  const tabInfo = AREAS.map((a) => {
    const cs = cellsOf(allCourses.filter((c) => c.area === a));
    const bad = cs.filter((x) => x.st === "기한 초과" || x.st === "기록 없음" || x.st === "미이수").length;
    return { a, bad };
  });

  const todo = recs.filter((r) => r.st !== "이수")
    .sort((a, b) => (a.st === b.st ? String(a.due_date || "9").localeCompare(String(b.due_date || "9")) : a.st === "기한 초과" ? -1 : 1));
  const noRecord = counted.filter((x) => x.st === "기록 없음");
  const courseById = new Map<string, Row>(allCourses.map((c) => [c.course_id, c]));
  const done = recs.filter((r) => r.st === "이수").sort((a, b) => String(b.trained_at).localeCompare(String(a.trained_at)));
  const staffOpts = st.filter((x: Row) => x.dept_id && x.dept_id !== "D99");
  const canReport = ceoConfirm(role).ok;
  const notOrdered = todo.filter((r) => !r.instructed_at).length;
  const bad = n("기한 초과") + n("기록 없음");

  // 업무 절차: 대상 → 이수 → 이행 지시 → 점검 기록
  const steps: Step[] = [
    { label: "대상", n: counted.length, state: "done", href: "#matrix" },
    { label: "이수", n: `${n("이수")}/${counted.length}`, state: n("이수") === counted.length ? "done" : bad ? "warn" : "on", href: "#matrix" },
    { label: "이행 지시", n: notOrdered + noRecord.length, state: notOrdered + noRecord.length ? "on" : "done", href: "#todo" },
    { label: "점검", n: checks.length, state: checks.length ? "done" : "warn", href: "#check" },
  ];

  return (
    // 09-26 사용자: 메뉴 밖 화면 합치기 — 의무이행(실적증빙) › 분야별 이행 › 안전·보건 교육 이수로 올림(레이아웃 + 좌측)
    <UsLayout side={<PerformSide cur="/training" />}>
      <h1 className="v2h">안전·보건 교육 이수</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 제목 = 메뉴 이름(옛 제목 「교육 실시 점검」) */}
      <nav className="chips" aria-label="재해 구분">
        {tabInfo.map((t) => (
          <Link key={t.a} className={`chip ${t.a === area ? "on" : ""}`} href={`/training?role=${role}&area=${t.a}`}>
            {FRAMES[t.a].tab}{t.bad > 0 && <> <span className="badge warn">{t.bad}</span></>}
          </Link>
        ))}
      </nav>
      <div className="chips">
        <span className="badge" title={f.n3Text}>{f.n3}</span>
        <span className="badge" title={f.n4Text}>{f.n4}</span>
        <span className="badge none">{f.cycle === "연" ? "연 1회" : "반기 1회"}</span>
      </div>

      <Steps items={steps} />

      <Facts items={[
        { k: "이수", v: <b>{n("이수")}/{counted.length}</b> },
        { k: "미이수", v: n("미이수") },
        { k: "초과·없음", v: <b className={bad ? "tone-bad" : ""}>{bad}</b> },
        area === "I"
          ? { k: "특별교육 미완료", v: n("기한 초과", hz) + n("기록 없음", hz) + n("미이수", hz) }
          : { k: `${period} 점검`, v: checks.length ? <span className="badge ok">함</span> : <span className="badge bad">없음</span> },
      ]} />

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card" id="check">
          <h3>{period} 점검</h3>
          {checks.length ? (
            <ul className={s.checks}>
              {checks.map((c) => (
                <li key={c.check_id} title={c.summary || ""}><span className="badge ok">점검함</span> {md(c.checked_at)} · {c.method} · {staffName.get(c.checked_by) || c.checked_by}
                  {c.proxy === "Y" && <> <span className="badge warn">대리</span></>}</li>
              ))}
            </ul>
          ) : <p><span className="badge bad">점검 기록 없음</span></p>}
          {sp.err === "role" && <p><span className="badge bad">보고받음은 경영책임자만 적습니다</span></p>}
          <form action={recordCheck} className={s.inline}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="area" value={area} />
            <select name="method" defaultValue="직접 점검">
              <option>직접 점검</option>
              <option disabled={!canReport}>점검 결과 보고받음</option>
            </select>
            <input type="hidden" name="summary"
              value={`${f.tab} · 적용 ${counted.length}칸 · 이수 ${n("이수")} · 미이수 ${n("미이수")} · 기한 초과 ${n("기한 초과")} · 기록 없음 ${n("기록 없음")}`} />
            <button className="btn sm" type="submit">점검 기록</button>
          </form>
          {sp.done === "check" && <p className="muted">기록했습니다.</p>}
        </div>

        <div className="card">
          <div className={s.cardHead}>
            <h3 style={{ margin: 0 }}>이수 현황</h3>
            <ChartSwitch base="/training" sp={sp} cur={graph} />
          </div>
          {counted.length === 0
            ? <p className="muted">적용 칸 없음</p>
            : graph === "pie"
              ? <Donut slices={slices} center={`${Math.round((n("이수") / (counted.length || 1)) * 100)}%`} sub="이수율" />
              : <BarGroup slices={slices} unit="칸" />}
        </div>
      </div>

      <h2 id="todo">미이수 · 이행 지시 <span className="muted">{todo.length + noRecord.length}</span></h2>
      {sp.done === "order" && <p><span className="badge ok">지시를 남기고 알렸습니다</span></p>}
      <table className="v2t">
        <thead>
          <tr><th>부서</th><th>교육 과정</th><th>대상자</th><th className="dt">기한</th><th>상태</th><th>조치</th></tr>
        </thead>
        <tbody>
          {todo.slice(0, 15).map((r) => {
            const c = courseById.get(r.course_id) || {};
            return (
              <tr key={r.training_id} className={r.st === "기한 초과" ? s.hot : ""}>
                <td>{shortDept(deptName.get(r.dept_id) || r.dept_id)}</td>
                <td title={`${r.course_name} · ${c.basis || ""} · ${r.period || ""}`}><b>{r.course_name}</b>{c.hazardous_work === "Y" && <> <span className="badge warn">특별</span></>}</td>
                <td>{staffName.get(r.staff_id) || r.staff_id}</td>
                <td className="dt">{md(r.due_date)}</td>
                <td><span className={`badge ${ST_TONE[r.st as St]}`}>{r.st}</span></td>
                <td>
                  {r.instructed_at ? (
                    <span className="badge ok" title={`${staffName.get(r.instructed_by) || r.instructed_by}${r.instruct_due ? ` · ${r.instruct_due}까지` : ""} · ${r.instruct_basis || f.n4}`}>지시 {md(r.instructed_at)}</span>
                  ) : (
                    <form action={instruct} className={s.inline}>
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="training_id" value={r.training_id} />
                      <input type="date" name="due" defaultValue={r.st === "기한 초과" ? "" : r.due_date} aria-label="이수 기한" />
                      <button className="btn sm" type="submit">이행 지시</button>
                    </form>
                  )}
                  {" "}<Link href={tq({ reg: r.training_id }) + "#register"}>이수 등록</Link>
                  {f.budget && <> · <Link href={q(`/budget?dept=${r.dept_id}#form`)}>예산</Link></>}
                </td>
              </tr>
            );
          })}
          {noRecord.slice(0, 15).map((x) => (
            <tr key={`${x.c.course_id}-${x.d.dept_id}`} className={s.hot}>
              <td>{shortDept(x.d.dept_name)}</td>
              <td title={x.c.basis}><b>{x.c.course_name}</b></td>
              <td className="muted">—</td><td className="dt">—</td>
              <td><span className="badge bad">기록 없음</span></td>
              <td><Link href={tq({ course: x.c.course_id, dept: x.d.dept_id }) + "#register"}>이수 등록 →</Link></td>
            </tr>
          ))}
          {!todo.length && !noRecord.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
        </tbody>
      </table>
      {(todo.length > 15 || noRecord.length > 15) && <a className="more" href="#matrix">전체 {todo.length + noRecord.length}건 →</a>}

      <details className="card fold" id="matrix" style={{ marginTop: 12 }}>
        <summary>과정 × 부서 <span className="muted">과정 {courses.length}</span></summary>
        <div className="tbl-wrap">
          <table className={s.matrix}>
            <thead>
              <tr>
                <th className={s.courseCol}>교육 과정</th>
                {dl.map((d: Row) => <th key={d.dept_id} className={s.dcol}>{shortDept(d.dept_name)}</th>)}
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.course_id} className={c.hazardous_work === "Y" ? s.hz : ""}>
                  <td className={s.courseCol} title={`${c.basis} · 대상 ${c.target} · 주기 ${c.cycle} · ${c.required_hours}${c.note ? ` · ${c.note}` : ""}`}>
                    <b>{c.course_name}</b>{c.hazardous_work === "Y" && <> <span className="badge warn">특별</span></>}
                  </td>
                  {dl.map((d: Row) => {
                    const x = cell(c, d.dept_id);
                    const tip = x.rs.length
                      ? x.rs.map((r) => `${staffName.get(r.staff_id) || r.staff_id} · ${r.period || ""} · ${r.status === "이수" ? `이수 ${r.trained_at}` : `미실시${r.due_date ? ` (기한 ${r.due_date})` : ""}`}`).join("\n")
                      : applies(c, d.dept_id) ? "기록 없음" : "적용되지 않음";
                    return (
                      <td key={d.dept_id} className={s.cell} title={`${c.course_name} · ${d.dept_name}\n${tip}`}>
                        {x.st === "해당 없음" ? <span className={s.na}>─</span>
                          : <span className={`badge ${ST_TONE[x.st]}`}>{CELL_TXT[x.st]}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!courses.length && <tr><td colSpan={dl.length + 1} className="muted">과정 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card" id="register">
          <h3>이수 등록</h3>
          {sp.done === "reg" && <p><span className="badge ok">등록했습니다</span></p>}
          {sp.err === "file" && <p><span className="badge bad">이수증 필요</span></p>}
          {sp.err === "need" && <p><span className="badge bad">과정·부서·대상자 필요</span></p>}
          <form action={registerTraining} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="area" value={area} />
            <div className={s.full}>
              <label>미이수 기록</label>
              <select name="pending" defaultValue={sp.reg || ""}>
                <option value="">— 새 기록 —</option>
                {todo.map((r) => <option key={r.training_id} value={r.training_id}>{deptName.get(r.dept_id)} · {r.course_name} · {staffName.get(r.staff_id) || r.staff_id} ({r.st})</option>)}
              </select>
            </div>
            <div>
              <label>과정</label>
              <select name="course_id" defaultValue={sp.course || ""}>
                <option value="">—</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
              </select>
            </div>
            <div>
              <label>부서</label>
              <select name="dept_id" defaultValue={sp.dept || ""}>
                <option value="">—</option>
                {dl.map((d: Row) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
              </select>
            </div>
            <div>
              <label>대상자</label>
              <select name="staff_id" defaultValue="">
                <option value="">—</option>
                {staffOpts.map((x: Row) => <option key={x.staff_id} value={x.staff_id}>{x.display_name} · {shortDept(deptName.get(x.dept_id) || "")}</option>)}
              </select>
            </div>
            <div><label>이수일</label><input type="date" name="trained_at" defaultValue={now} /></div>
            <div><label>시간</label><input type="text" name="hours" inputMode="decimal" /></div>
            <FileAttach label="이수증 첨부" />
            <div><label>이수증 이름</label><input type="text" name="certificate_file" placeholder="파일 없으면 이름만" /></div>
            <div className={s.full}><button className="btn" type="submit">이수 등록</button></div>
          </form>
        </div>

        <div className="card">
          <details className="fold">
            <summary>보낸 이행 지시 <span className="muted">{notifs.length}</span></summary>
            {notifs.length ? (
              <table className="v2t">
                <tbody>
                  {notifs.slice(0, 10).map((x) => (
                    <tr key={x.notif_id}>
                      <td className="dt">{md(x.sent_at)}</td>
                      <td title={x.message}><b>{staffName.get(x.to_staff_id) || x.to_staff_id}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">없음</p>}
          </details>
          <details className="fold" style={{ marginTop: 10 }}>
            <summary>최근 이수 <span className="muted">{done.length}</span></summary>
            <table className="v2t">
              <thead><tr><th className="dt">이수일</th><th>과정</th><th>대상자</th><th>시간</th><th>이수증</th></tr></thead>
              <tbody>
                {done.slice(0, 8).map((r) => (
                  <tr key={r.training_id}>
                    <td className="dt">{md(r.trained_at)}</td>
                    <td title={`${r.course_name} · ${r.certificate_file || ""}`}>{r.course_name}</td>
                    <td>{staffName.get(r.staff_id) || r.staff_id}</td>
                    <td>{r.hours ? `${r.hours}h` : "—"}</td>
                    <td><FileLink name={r.certificate_file} url={r.evidence_url} max={10} /></td>
                  </tr>
                ))}
                {!done.length && <tr><td colSpan={5} className="muted">없음</td></tr>}
              </tbody>
            </table>
          </details>
        </div>
      </div>

      <div className={s.foot}>
        <a className="btn ghost sm" href={`/training/export?role=${role}`}>⬇ 엑셀</a>
        <Link className="btn ghost sm" href={q("/budget")}>예산 →</Link>
      </div>
    </UsLayout>
  );
}
