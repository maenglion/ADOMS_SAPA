// [캡처 v2] 연간 일정 — 안내 문단 → 범례 칩 · 근거 줄은 title 로 · 긴 목록·주기 표는 접기(2026-09-22)
import { batchListWithRounds } from "@/lib/check_merge";
import Link from "next/link";
import { DUTY36, AREA36 } from "@/lib/duty36";
import { batchList, annualChecks, allTasks, codeCatalog, CODE_CYCLE, CYCLE_LABEL, type CycleKind } from "@/lib/cycle";
import { collectEvents, statusOf, ymd, type Ev } from "./events";
import { Facts } from "@/components/Steps";
import st from "./calendar.module.css";
// 09-26 사용자: 메뉴 밖 화면 합치기 — 이행현황 레이아웃 + 좌측(StatusSide 「메인」 판 · 연간 일정)
import { UsLayout } from "@/components/us/Parts";
import StatusSide from "../status/_parts/StatusSide";

export const dynamic = "force-dynamic";

/**
 * 연간 일정 — 법정 점검 기한 · 운영 예시(서울시 안내서) · 운영 자료의 날짜를 한 달력에. (2026-09-21)
 * 점검 주기는 lib/cycle.ts 의 CODE_CYCLE 한 곳에서 온다(③ 점검 계획 · ⑦ 결재와 같은 셈).
 */
const SRC_CLASS: Record<Ev["src"], string> = { 법정: st.law, "운영 예시": st.ex, 운영: st.op };
const SRC_SHORT: Record<Ev["src"], string> = { 법정: "법정", "운영 예시": "예시", 운영: "운영" };
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}.`;
const range = (e: Ev) => (e.end && e.end !== e.date ? `${md(e.date)}~${md(e.end)}` : md(e.date));
const LIST_N = 12;

function Row({ e, today, year = true }: { e: Ev; today: string; year?: boolean }) {
  const s = statusOf(e, today);
  return (
    <li className={`${st.item} ${s.tone === "bad" ? st.late : ""}`}>
      <div className={st.when} title={e.date}>{year && e.date.slice(0, 4) !== today.slice(0, 4) ? `${e.date.slice(2, 4)}. ` : ""}{range(e)}</div>
      <div className={st.what}>
        <span className={`${st.src} ${SRC_CLASS[e.src]}`}>{SRC_SHORT[e.src]}</span>{" "}
        <Link href={e.href} title={e.basis || e.title}>{e.title}</Link>
      </div>
      <span className={`badge ${s.tone}`}>{s.label}</span>
    </li>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const now = new Date();
  const today = ymd(now);
  const year = Number(sp.year) || now.getFullYear();

  const events = await collectEvents(role, [year]);
  const batches = await batchListWithRounds();   // 09-26 사용자: 옛 점검 화면 합치기 — 이행점검 회차도 함께
  const tasks = await allTasks();
  const active = [...new Set(tasks.map((t) => String(t.code36 || "").split(";")[0].trim()).filter(Boolean))];
  const annual = annualChecks(batches, year, active, now);
  const cat = await codeCatalog();
  const nameOf = new Map<string, string>(cat.flatMap((g) => g.codes.map((c) => [c.code, c.name] as [string, string])));

  // 지난 것 중 안 끝난 것(연도 무관) · 이번 달 · 다음 달
  const late = events.filter((e) => statusOf(e, today).tone === "bad" && (e.end || e.date) < today);
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const m2 = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const from = `${m0.getFullYear()}-${String(m0.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${m2.getFullYear()}-${String(m2.getMonth() + 1).padStart(2, "0")}-${String(m2.getDate()).padStart(2, "0")}`;
  const lateKeys = new Set(late.map((e) => e.key));
  const soon = events.filter((e) => !lateKeys.has(e.key) && e.date <= to && (e.end || e.date) >= from)
    .filter((e) => !(e.src === "운영" && e.done));

  // 12개월
  const months = Array.from({ length: 12 }, (_, i) => {
    const ms = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const me = `${year}-${String(i + 1).padStart(2, "0")}-${String(new Date(year, i + 1, 0).getDate()).padStart(2, "0")}`;
    const inM = events.filter((e) => e.date <= me && (e.end || e.date) >= ms);
    // 과제 기한은 부서별 줄이 많아 달 칸에서는 한 줄로 묶는다.
    const tk = inM.filter((e) => e.group === "task" && e.date >= ms);
    const rest = inM.filter((e) => e.group !== "task");
    return {
      i, ms, me, rest,
      task: tk.length ? { n: tk.reduce((s, e) => s + (e.n || 0), 0), left: tk.reduce((s, e) => s + (e.left || 0), 0), late: tk.some((e) => statusOf(e, today).tone === "bad") } : null,
    };
  });
  const curM = year === now.getFullYear() ? now.getMonth() : -1;

  const q = (extra: string) => `/calendar?role=${role}${extra}`;
  const byCycle = (k: CycleKind) => Object.entries(CODE_CYCLE).filter(([, v]) => v.cycle === k);
  const annualBad = annual.filter((a) => a.tone === "bad" || a.tone === "warn").length;

  return (
    <UsLayout side={<StatusSide on="cal" role={role} />}>{/* 09-26 사용자: 메뉴 밖 화면 합치기 */}
      <div className={st.head}>
        <h1 className="v2h">연간 일정 — {year}년</h1>
        <div className={st.nav}>
          <Link className="btn sm ghost" href={q(`&year=${year - 1}`)}>← {year - 1}년</Link>
          {year !== now.getFullYear() && <Link className="btn sm ghost" href={q("")}>올해</Link>}
          <Link className="btn sm ghost" href={q(`&year=${year + 1}`)}>{year + 1}년 →</Link>
        </div>
      </div>
      {/* [캡처 v2] 긴 안내 문단 → 범례 칩(설명은 title) */}
      <div className="chips">
        <span className={`${st.src} ${st.law}`} title="중대재해처벌법 시행령의 점검 주기(반기 1회 · 연 1회)로 계산한 날">법정 기한</span>
        <span className={`${st.src} ${st.ex}`} title="서울시 안내서(2023.8. 잠정)의 운영 예시 — 법정 기한 아님, 기관 날짜로 바꿔 씀">운영 예시</span>
        <span className={`${st.src} ${st.op}`} title="과제·점검·교육·훈련·보수·보강·명령(서면 처분만)·계약 자료의 날">운영</span>
      </div>

      <Facts items={[
        { k: "지난 미완", v: <b className={late.length ? "tone-bad" : ""}>{late.length}</b> },
        { k: "이번·다음 달", v: <b>{soon.length}</b> },
        { k: "연 1회 항목", v: <>{annual.length} {annualBad ? <span className="badge warn">확인 {annualBad}</span> : null}</> },
        { k: "올해 일정", v: events.length.toLocaleString() },
      ]} />

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>지난 것 중 미완 <span className="badge bad">{late.length}</span></h3>
          {late.length === 0 ? <p className="muted">없음</p> : (
            <ul className={st.list}>{late.slice(0, LIST_N).map((e) => <Row key={e.key} e={e} today={today} />)}</ul>
          )}
          {late.length > LIST_N && (
            <details className="fold">
              <summary>전체 {late.length}건</summary>
              <ul className={st.list}>{late.slice(LIST_N).map((e) => <Row key={e.key} e={e} today={today} />)}</ul>
            </details>
          )}
        </div>
        <div className="card">
          <h3>이번·다음 달 <span className="muted">{md(from)}~{md(to)}</span></h3>
          {soon.length === 0 ? <p className="muted">없음</p> : (
            <ul className={st.list}>{soon.slice(0, LIST_N).map((e) => <Row key={e.key} e={e} today={today} />)}</ul>
          )}
          {soon.length > LIST_N && (
            <details className="fold">
              <summary>전체 {soon.length}건</summary>
              <ul className={st.list}>{soon.slice(LIST_N).map((e) => <Row key={e.key} e={e} today={today} />)}</ul>
            </details>
          )}
        </div>
      </div>

      {/* 연 1회 항목 — 반기 점검과 따로 센다 */}
      <div className={`card ${st.annual}`} style={{ marginTop: 14 }}>
        <h3>연 1회 항목 <Link className="more" href={`/inspections?role=${role}#plan`} style={{ marginLeft: 8 }}>점검 계획 →</Link></h3>
        {annual.length === 0 ? <p className="muted">없음</p> : (
          <table className="v2t"><tbody>
            {annual.map((a) => (
              <tr key={a.code}>
                <td><b>{a.code}</b></td>
                <td title={`${a.message} · ${a.basis}`}>{nameOf.get(a.code) || ""}</td>
                <td className="cd"><span className={`badge ${a.tone}`}>{a.state}</span></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>

      <h2 style={{ marginTop: 18 }}>달별</h2>
      <div className={st.months}>
        {months.map((m) => (
          <div key={m.i} className={`card ${st.month} ${m.i === curM ? st.cur : ""}`}>
            <div className={st.mhead}>{m.i + 1}월{m.i === curM && <span className="badge warn">이번 달</span>}</div>
            <ul className={st.mlist}>
              {m.task && (
                <li className={m.task.late ? st.late : ""}>
                  <Link href={`/tasks?role=${role}`}>과제 {m.task.n.toLocaleString()}건</Link>{" "}
                  {m.task.left ? <span className={`badge ${m.task.late ? "bad" : "warn"}`}>남음 {m.task.left.toLocaleString()}</span> : <span className="badge ok">끝남</span>}
                </li>
              )}
              {m.rest.slice(0, 8).map((e) => {
                const s = statusOf(e, today);
                return (
                  <li key={e.key} className={s.tone === "bad" ? st.late : ""}>
                    <span className={st.day}>{range(e)}</span>{" "}
                    <span className={`${st.src} ${SRC_CLASS[e.src]}`}>{SRC_SHORT[e.src]}</span>{" "}
                    <Link href={e.href} title={`${e.title}${e.basis ? ` — ${e.basis}` : ""} · ${s.label}`}>{e.title}</Link>
                  </li>
                );
              })}
              {m.rest.length > 8 && <li className="muted">그 밖 {m.rest.length - 8}건</li>}
              {!m.task && m.rest.length === 0 && <li className="muted">없음</li>}
            </ul>
          </div>
        ))}
      </div>

      <details className="card fold" style={{ marginTop: 18 }}>
        <summary>점검 주기 표</summary>
        <div className="grid g3">
          {(["반기", "연", "상시"] as CycleKind[]).map((k) => (
            <div key={k}>
              <h3>{CYCLE_LABEL[k]} <span className="muted">{byCycle(k).length}</span></h3>
              <ul className={st.rules}>
                {byCycle(k).map(([code, v]) => (
                  <li key={code} title={`${AREA36[code.slice(0, 1)] || ""} · ${v.basis}`}><b>{code}</b> {nameOf.get(code) || DUTY36.find((x) => x.code === code)?.name || ""}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </UsLayout>
  );
}
