// [캡처 v2] 설명 문단·「다음에 할 일」 삭제 → 단계 막대 · 판정 대기 표 6칸 15행 · 현황·끝난 것은 접기(09-22)
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import { forms } from "@/lib/data";
import { judgeOne, judgeMany } from "./actions";
import { Stat, Bar } from "@/components/bits";
import { Donut, BarGroup, ChartSwitch } from "@/components/Chart";
import { loadCycle, lookups } from "@/lib/cycle";
import { idKo } from "@/lib/labels";
import { ACTION_TYPES, STATUTORY_TYPES } from "@/lib/remedy";
import Steps, { type Step } from "@/components/Steps";
import { UsLayout } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 레이아웃·좌측 안에서 연다
import MenuSide from "@/components/us/MenuSide";
import { OldTitle } from "@/app/check/_parts";
import { redirect } from "next/navigation";   // 09-26 사용자: 옛 점검 화면 합치기 — 새 자리로 넘기기
import { OLD_CHECK_MERGED, oldTarget } from "@/lib/check_merge";

export const dynamic = "force-dynamic";

/**
 * ⑤ 점검 판정 — 총괄이 부서 제출분에 적합·보완필요·부적합을 찍는 자리.
 * 셈은 `lib/cycle.ts` 한 곳(③⑥⑦ 과 같은 숫자). ⑥ 보완 제출분은 「재점검 N차」로 다시 올라온다.
 */
const RESULTS = ["적합", "보완필요", "부적합"] as const;

/** 보완·부적합일 때 필요한 조치(시행령 제5조·제9조·제11조 각 제2항제2호). 적합이면 쓰지 않는다. */
function NeedSelect() {
  return (
    <select name="need" defaultValue="" aria-label="필요한 조치" title="보완·부적합일 때 필요한 조치">
      <option value="">필요 조치</option>
      {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}{STATUTORY_TYPES.has(a) ? " (법정)" : ""}</option>)}
    </select>
  );
}

export default async function Review({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  // 09-26 사용자: 옛 점검 화면 합치기 — 점검 판정은 이행점검 › 항목별 점검(항목마다 과제별 판정 세부)으로 넘긴다.
  //   새 판정은 이행점검 표(usf_judge)에 쓴다. 이 파일은 지우지 않았다 — lib/check_merge.ts OLD_CHECK_MERGED = false 로 되돌린다.
  if (OLD_CHECK_MERGED) redirect(await oldTarget("review", sp));
  const role = sp.role || "mgr";
  const graph = sp.g || "";

  const cy = await loadCycle(sp.b);
  const { batches, batch, deptIds: scopeDepts, count } = cy;
  const { deptName, staffName, evByTask } = await lookups();
  const fs = await forms();

  let scope = cy.rows;
  if (sp.dept) scope = scope.filter((t) => t.dept_id === sp.dept);

  // 재점검을 앞에, 그다음 방금 올라온 것(제출 시각이 늦은 것)을 앞에.
  const 대기 = scope.filter((t) => t.state === "판정대기").sort((a, b) =>
    Number(b.recheck) - Number(a.recheck) || String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")));
  const 끝난것 = scope.filter((t) => t.state === "적합" || t.state === "조치중");
  const 미제출 = scope.filter((t) => t.state === "미제출");
  const 재점검 = 대기.filter((t) => t.recheck).length;
  const resultOf = (t: any) => t.last?.result || (t.state === "적합" ? "적합" : "보완필요");
  const cnt = (r: string) => 끝난것.filter((t) => resultOf(t) === r).length;
  const 조치필요 = cnt("보완필요") + cnt("부적합");

  const slices = [
    { label: "적합", n: cnt("적합"), tone: "ok" as const },
    { label: "보완필요", n: cnt("보완필요"), tone: "warn" as const },
    { label: "부적합", n: cnt("부적합"), tone: "bad" as const },
    { label: "판정 대기", n: 대기.length, tone: "" as const },
    { label: "미제출", n: 미제출.length, tone: "none" as const },
  ];

  const byDept = scopeDepts.map((d) => {
    const rows = cy.rows.filter((t) => t.dept_id === d);
    return {
      id: d, name: String(deptName.get(d) || d), n: rows.length,
      done: rows.filter((t) => t.state === "적합" || t.state === "조치중").length,
      wait: rows.filter((t) => t.state === "판정대기").length,
    };
  }).filter((x) => x.n > 0).sort((a, b) => b.wait - a.wait);

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    const m = { b: batch?.batch_id, dept: sp.dept, g: graph, all: sp.all, ...o };
    Object.entries(m).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/review?${p.toString()}`;
  };
  const bq = batch ? `&b=${batch.batch_id}` : "";
  const LIM = sp.all ? 80 : 15;

  // [캡처 v2] 판정 한 바퀴 단계
  const steps: Step[] = [
    { label: "제출", n: 미제출.length, state: 미제출.length ? "" : "done", href: `/evidence?role=road` },
    { label: "판정", n: 대기.length, state: 대기.length ? "on" : "done", href: "#wait" },
    { label: "조치", n: 조치필요, state: 조치필요 ? "warn" : "done", href: `/actions?role=gm${bq}` },
    { label: "결재", n: count.판정대기 === 0 && batch ? "가능" : "", state: count.판정대기 === 0 && batch ? "on" : "", href: `/inspections?role=gm&view=approve${bq}` },
  ];

  return (
    <UsLayout side={<MenuSide group="이행점검및 조치" />}>   {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 이행점검 레이아웃·좌측 */}
      <FlowBar step="review" role={role} carry={batch ? `b=${batch.batch_id}` : ""} />
      <OldTitle title="점검 판정" role={role} tk={sp.tk} />
      <div className="chips">
        {batches.map((b: any) => (
          <Link key={b.batch_id} className={`chip ${batch?.batch_id === b.batch_id ? "on" : ""}`}
                href={q({ b: b.batch_id, dept: undefined })} title={b.title}>
            {b.period_year} {b.half_year}{batches.filter((x: any) => x.period_year === b.period_year && x.half_year === b.half_year).length > 1 ? ` · ${idKo(b.batch_id)}` : ""}
          </Link>
        ))}
        {batch && <span className="badge none">{batch.status}</span>}
        <Link className="chip" href={`/inspections?role=${role}&view=plan#plan`}>+ 새 점검</Link>
      </div>

      <Steps items={steps} />

      <div className="grid g5">
        <Stat n={대기.length} l={재점검 ? `대기(재점검 ${재점검})` : "판정 대기"} tone="warn" />
        <Stat n={cnt("적합")} l="적합" tone="ok" />
        <Stat n={cnt("보완필요")} l="보완필요" tone="warn" href={`/actions?role=${role}${bq}`} />
        <Stat n={cnt("부적합")} l="부적합" tone="bad" href={`/actions?role=${role}${bq}`} />
        <Stat n={미제출.length} l="미제출" />
      </div>

      <h2 id="wait">판정 대기 <span className="muted">{대기.length.toLocaleString()}</span>
        {sp.dept && <Link className="chip on" href={q({ dept: undefined })} style={{ marginLeft: 8 }}>{deptName.get(sp.dept) || sp.dept} ✕</Link>}</h2>
      {대기.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>
          판정할 것 없음 ·{" "}
          {count.total === 0
            ? <Link href={`/inspections?role=gm&view=plan#plan`}>점검 범위 다시 잡기 →</Link>
            : count.판정대기 === 0
              ? <Link href={`/inspections?role=gm&view=approve${bq}`}>결재 상신 →</Link>
              : <Link href={`/evidence?role=road`}>부서 제출 →</Link>}
        </p></div>
      ) : (
        <>
          <form id="bulk" action={judgeMany}
                className="card"
                style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="role" value={role} />
            <b>고른 것</b>
            <input type="text" name="finding" placeholder="의견" style={{ minWidth: 220 }} />
            <NeedSelect />
            {RESULTS.map((r) => (
              <button key={r} className={`btn ${r === "적합" ? "" : "ghost"}`} name="result" value={r} type="submit">{r}</button>
            ))}
          </form>

          <table className="v2t">
            <thead><tr>
              <th style={{ width: 34 }} />
              <th>의무</th>
              <th>대상</th>
              <th>증빙</th>
              <th className="dt">기한</th>
              <th>판정</th>
            </tr></thead>
            <tbody>
              {대기.slice(0, LIM).map((t: any) => {
                const ev = evByTask.get(t.task_id) || [];
                const form = fs.find((f: any) => f.form_id === t.schedule_id);
                const tip = [
                  `${idKo(t.task_id)} · ${t.law} ${t.unit_label_ko} · ${t.code36} ${t.code36_name}`,
                  `${t.dept_name || deptName.get(t.dept_id) || ""} ${staffName.get(t.owner_staff_id) || ""}`,
                  t.recheck && t.last ? `앞 판정 ${t.last.round_no}차: ${t.last.result}${t.last.finding ? ` — ${t.last.finding}` : ""}` : "",
                ].filter(Boolean).join("\n");
                return (
                  <tr key={t.task_id} style={{ background: t.recheck ? "var(--blush)" : undefined }}>
                    <td><input type="checkbox" name="pick" value={t.task_id} form="bulk" /></td>
                    <td title={tip}>
                      {t.recheck && <span className="badge warn">재점검 {t.nextRound}차</span>}{" "}
                      <Link href={`/duties/${t.duty_key}?role=${role}`}>{t.duty_name || t.article_title || t.code36_name}</Link>
                    </td>
                    <td title={t.asset_name || t.target_name}>{t.asset_name || t.target_name}</td>
                    <td title={[...ev.map((e: any) => `${e.evidence_kind} · ${e.file_name}`), form ? `서식 ${form.title}` : ""].filter(Boolean).join("\n")}>
                      {ev.length === 0 ? <span className="badge bad">없음</span> : <span className="badge none">{ev.length}건</span>}
                    </td>
                    <td className="dt">{String(t.due_date || "").slice(5)}</td>
                    <td>
                      {/* 이 행만 보내는 따로 선 폼 — 묶음 폼과 겹치지 않는다. */}
                      <form action={judgeOne} style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="task_id" value={t.task_id} />
                        <input type="text" name="finding" placeholder="의견" style={{ width: 120 }} />
                        <NeedSelect />
                        {RESULTS.map((r) => (
                          <button key={r} className={`btn sm ${r === "적합" ? "" : "ghost"}`}
                                  name="result" value={r} type="submit">{r}</button>
                        ))}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {대기.length > LIM && <Link className="more" href={q({ all: "1" })}>전체 {대기.length.toLocaleString()}건 →</Link>}
        </>
      )}

      <details className="card fold" style={{ marginTop: 14 }}>
        <summary>판정 현황 · 부서별</summary>
        <ChartSwitch base="/review" sp={{ role, ...(batch ? { b: batch.batch_id } : {}), ...(sp.dept ? { dept: sp.dept } : {}) }} cur={graph} />
        <div className="grid g2">
          <div>
            {graph === "pie"
              ? <Donut slices={slices} center={`${끝난것.length + 대기.length ? Math.round((끝난것.length / (끝난것.length + 대기.length)) * 100) : 0}%`} sub="판정 진도" />
              : <BarGroup slices={slices} />}
          </div>
          <table className="v2t">
            <thead><tr><th>부서</th><th className="num">대상</th><th className="num">대기</th><th>진도</th></tr></thead>
            <tbody>
              {byDept.map((d) => (
                <tr key={d.id} style={{ background: sp.dept === d.id ? "var(--blush)" : undefined }}>
                  <td><Link href={q({ dept: sp.dept === d.id ? undefined : d.id })}>{d.name}</Link></td>
                  <td className="num">{d.n}</td>
                  <td className="num">{d.wait ? <span className="badge warn">{d.wait}</span> : <span className="muted">0</span>}</td>
                  <td title={`${d.done}/${d.n}`}><Bar pct={d.n ? Math.round((d.done / d.n) * 100) : 0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>판정 끝남 <span className="muted">{끝난것.length.toLocaleString()}</span></summary>
        <table className="v2t">
          <thead><tr>
            <th className="dt">점검일</th><th>의무</th><th>대상</th>
            <th className="cd">판정</th><th>의견</th><th>다음</th>
          </tr></thead>
          <tbody>
            {[...끝난것.filter((t) => t.state === "조치중"), ...끝난것.filter((t) => t.state === "적합")].slice(0, 15).map((t: any) => {
              const x = t.last;
              const r = resultOf(t);
              const note = x?.finding || (t.state === "조치중" ? t.reject_reason : "") || "-";
              return (
                <tr key={t.task_id}>
                  <td className="dt">{String(x?.insp_date || t.approved_at?.slice(0, 10) || "-").slice(5)}</td>
                  <td title={`${staffName.get(x?.inspector_staff_id) || ""} · ${t.dept_name || deptName.get(t.dept_id) || ""}`}>{t.duty_name || t.article_title || t.code36_name}</td>
                  <td title={t.asset_name || t.target_name}>{t.asset_name || t.target_name}</td>
                  <td className="cd"><span className={`badge ${r === "적합" ? "ok" : r === "부적합" ? "bad" : "warn"}`}>{r}{x?.round_no > 1 ? ` ${x.round_no}차` : ""}</span></td>
                  <td className="muted" title={note}>{note}</td>
                  <td>{t.state === "조치중"
                    ? <Link href={`/actions?role=gm${bq}#${t.task_id}`} title={x?.action_need ? `필요한 조치: ${x.action_need}` : ""}>{t.actionState}</Link>
                    : <span className="muted">끝남</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </UsLayout>
  );
}
