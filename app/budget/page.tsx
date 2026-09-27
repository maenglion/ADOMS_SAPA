// [캡처 v2] 안전보건 예산 — 단계 막대(편성→집행→용도 확인) + 재해 구분 탭 + 한 줄 표. 조문 인용·안내 문단은 뺐다(2026-09-22).
// [캡처 v2] K08(2026-09-24) — 재해 구분마다 용도 틀(제4조제4호 · 제10조제2호 · 제8조제2호)을 따로 두고,
//   예산 줄마다 집행 기록(일자·내역·금액·증빙 이름)을 받아 줄별 집행률을 보인다. 입력 양식은 접기.
import Link from "next/link";
import { Bar } from "@/components/bits";
import Steps, { Facts, type Step } from "@/components/Steps";
import { BarGroup, Donut, ChartSwitch, type Slice } from "@/components/Chart";
import { readTable, type Row } from "@/lib/data";
import { deptOf } from "@/lib/roles";
import { idKo } from "@/lib/labels";
import { ymd } from "@/lib/day";
import { loadBudget, FRAMES, AREAS, isArea, useShort, sum, rate, rateTone, mil, chon, type Bud, type AreaKey } from "./model";
import { saveBudget, addExec } from "./actions";
import s from "./budget.module.css";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기
import TotalView from "./TotalView";   // 09-26 사용자: 두 재해 합계 보기

export const dynamic = "force-dynamic";

/** 행 메모에서 「예시 자료」 머리말을 걷고 내역만 보인다. */
const noteTail = (n?: string) => String(n || "").replace(/^예시 자료(\([^)]*\))?( · )?/, "");
const md = (d?: string) => String(d || "").slice(5);

/** 재해 구분 고르기 — 이미 있는 줄을 다른 재해 구분으로 옮길 때. */
function AreaSelect({ name, value }: { name: string; value: string }) {
  return (
    <select name={name} defaultValue={value} aria-label="재해 구분" className={s.memo}
            style={{ borderColor: !value ? "var(--bad)" : undefined }}>
      <option value="">재해 구분 전</option>
      {AREAS.map((a) => <option key={a} value={a}>{FRAMES[a].tab}</option>)}
    </select>
  );
}

/** 안전보건 예산 — 중대재해처벌법 시행령 제4조제4호 · 제8조제2호 · 제10조제2호. */
export default async function BudgetPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const graph = sp.g || "";
  const showAll = sp.area === "all";   // 09-26 사용자: 「경영책임자나 총괄 입장에서는 그 통계도 필요하지 않을까? 일단 넣어 보자.」 — 전체(두 재해 합계) 탭
  const area: AreaKey = isArea(sp.area || "") ? (sp.area as AreaKey) : "I";
  const f = FRAMES[area];
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const qa = (extra = "") => q(`/budget?area=${area}${extra}`);

  const { rows: allRows, execs, dl, deptName } = await loadBudget();
  const year = allRows[0]?.fiscal_year || "2026";
  const rows = allRows.filter((r) => r.tab === area);
  const execOf = (id: string) => execs.filter((x) => x.budget_id === id);

  const ras = await readTable("risk_assessment", "risk_id");
  const items = await readTable("risk_assessment_item", "risk_item_id");
  const raById = new Map<string, Row>(ras.map((r) => [r.risk_id, r]));
  const deptOfItem = (it: Row) => raById.get(it.risk_id)?.dept_id || "";

  const total = sum(rows);
  const byUse = (k: string) => rows.filter((r) => r.use === k);
  const byDept = (d: string) => rows.filter((r) => r.dept_id === d);
  const outRows = byUse("밖");
  const outSum = sum(outRows);
  const nExec = rows.reduce((a, r) => a + execOf(r.budget_id).length, 0);

  // 부서별 — 중대산업재해는 전 부서(나목 없는 부서를 봐야 한다), 시민재해는 그 재해 구분 줄이 있는 부서만
  const deptRows = dl.map((d: Row) => {
    const rs = byDept(d.dept_id);
    return {
      d, n: rs.length, all: sum(rs),
      ga: sum(rs.filter((r) => r.use === "가")), na: sum(rs.filter((r) => r.use === "나")),
      da: sum(rs.filter((r) => r.use === "다" || (area === "I" && r.use === "밖"))),
    };
  }).filter((x) => area === "I" || x.n > 0);
  const lowRate = deptRows.filter((x) => x.all.p > 0 && rate(x.all.p, x.all.e) < 60);

  // 중대산업재해만 — 「높음」 유해·위험요인 ↔ 나목(유해·위험요인의 개선) 예산
  const high = area === "I" ? items.filter((it) => it.risk_level === "높음") : [];
  const naFor = (riskItemId: string) => rows.filter((r) => r.use === "나" && r.risk_item_id === riskItemId);
  const noNaDepts = area !== "I" ? [] : deptRows.filter((x) => x.na.p === 0).map((x) => {
    const hs = high.filter((it) => deptOfItem(it) === x.d.dept_id);
    const open = hs.filter((it) => !it.measure_done_at);
    return { ...x, hs, open };
  }).sort((a, b) => b.open.length - a.open.length || b.hs.length - a.hs.length);

  const slices: Slice[] = f.uses.map((u) => ({ label: `${useShort(f, u.k)} ${u.name}`, n: Math.round(sum(byUse(u.k)).p / 1e6) }));

  // 부서 — 고른 부서 → 역할의 부서 → 이 재해 구분 줄이 있는 첫 부서
  const fdept = sp.dept || deptOf(role) || rows[0]?.dept_id || "D03";
  const frows = byDept(fdept);
  const fItems = high.filter((it) => deptOfItem(it) === fdept);
  const preRisk = sp.risk || "";
  const line = sp.line ? allRows.find((r) => r.budget_id === sp.line) : undefined;
  const lineX = line ? execOf(line.budget_id) : [];
  const lineXsum = lineX.reduce((a, x) => a + x.amt, 0);

  // 업무 절차: 편성 → 집행 → 용도 확인
  const steps: Step[] = [
    { label: "편성", n: `${rows.length}줄`, href: "#lines", state: rows.length ? "done" : "warn" },
    { label: "집행", n: `${rate(total.p, total.e)}%`, href: "#lines", state: !rows.length ? "" : lowRate.length ? "on" : "done" },
    { label: "용도 확인", n: outRows.length, href: "#use", state: outRows.length ? "warn" : rows.length ? "done" : "" },
  ];

  return (
    // 09-26 사용자: 메뉴 밖 화면 합치기 — 의무이행(실적증빙) › 분야별 이행 › 안전·보건 예산으로 올림(레이아웃 + 좌측)
    <UsLayout side={<PerformSide cur="/budget" />}>
      <h1 className="v2h">안전·보건 예산</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 제목 = 메뉴 이름(옛 제목 「안전보건 예산」) */}
      <div className="chips">
        {!showAll && <span className="badge" title={f.uses.filter((u) => u.k !== "밖").map((u) => `${u.label} ${u.text}`).join("\n")}>{f.basis}</span>}{showAll && <span className="badge">시행령 제4조제4호 · 제10조제2호 · 제8조제2호</span>}
        <span className="badge none">{year}년 · 백만원</span>
      </div>
      {!showAll && <Steps items={steps} />}{/* 09-26: 합계 보기에서는 중대산업재해 기준 단계 막대를 감춘다 */}

      <nav className={s.tabs} aria-label="재해 구분">
        {AREAS.map((a) => {
          const n = allRows.filter((r) => r.tab === a).length;
          const blank = a === "I" ? allRows.filter((r) => r.tab === a && !r.area).length : 0;
          return (
            <Link key={a} className={a === area ? s.on : ""} href={q(`/budget?area=${a}`)}
                  title={blank ? `재해 구분 전 ${blank}줄 포함 — 편성·집행 입력에서 고릅니다` : undefined}>
              {FRAMES[a].tab} <span className="muted">{n}</span>
            </Link>
          );
        })}
        <Link className={showAll ? s.on : ""} href={q("/budget?area=all")} title="중대재해 안전예산 = 중대산업재해 + 중대시민재해">
          전체(두 재해 합계) <span className="muted">{allRows.length}</span>
        </Link>
      </nav>
      {showAll ? <TotalView rows={allRows} dl={dl} deptName={deptName} q={q} /> : <>

      <Facts items={[
        { k: "편성", v: <b>{mil(total.p)}</b> },
        { k: "집행", v: mil(total.e) },
        { k: "집행률", v: <span className={`badge ${rateTone(total.p, total.e)}`}>{rate(total.p, total.e)}%</span> },
        { k: "집행 기록", v: `${nExec}건` },
        area === "I"
          ? { k: "나목 없는 부서", v: <b className={noNaDepts.length ? "tone-bad" : ""}>{noNaDepts.length}/{dl.length}</b> }
          : { k: "용도 미확인", v: mil(outSum.p) },
      ]} />

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card" id="use">
          <h3>용도별</h3>
          <table className="v2t">
            <thead><tr><th>용도</th><th className="num">편성</th><th className="num">집행</th><th>집행률</th></tr></thead>
            <tbody>
              {f.uses.map((u) => {
                const t = sum(byUse(u.k));
                return (
                  <tr key={u.k} title={`${u.label} · ${u.text}${u.note ? ` · ${u.note}` : ""}`}>
                    <td><b>{useShort(f, u.k)}</b> {u.name}</td>
                    <td className="num">{mil(t.p)}</td>
                    <td className="num">{mil(t.e)}</td>
                    <td>{u.k === "다" && !f.notice ? <span className="badge none">고시 없음</span>
                      : !t.p ? <span className="badge none">없음</span>
                      : u.k === "밖" ? <span className="badge warn">확인 필요</span>
                      : <span className={`badge ${rateTone(t.p, t.e)}`}>{rate(t.p, t.e)}%</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className={s.cardHead}>
            <h3 style={{ margin: 0 }}>편성 비중</h3>
            <ChartSwitch base="/budget" sp={sp} cur={graph} />
          </div>
          {graph === "pie"
            ? <Donut slices={slices} center={`${Math.round((sum(byUse("가")).p / (total.p || 1)) * 1000) / 10}%`} sub="가목 비중" />
            : <BarGroup slices={slices} unit="백만원" />}
        </div>
      </div>

      {/* ── 예산 줄 · 집행 기록 ─────────────────────────────── */}
      <h2 id="lines">예산 줄 <span className="muted">천원</span></h2>
      <div className="card">
        <form method="get" action="/budget" className={s.pick}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="area" value={area} />
          <label style={{ margin: 0 }}>부서</label>
          <select name="dept" defaultValue={fdept}>
            {dl.map((d: Row) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}{byDept(d.dept_id).length ? ` · ${byDept(d.dept_id).length}줄` : ""}</option>)}
          </select>
          <button className="btn sm ghost" type="submit">보기</button>
        </form>
        {frows.length ? (
          <table className="v2t">
            <thead><tr><th>항목</th><th>용도</th><th className="num">편성</th><th className="num">집행</th><th>집행률</th><th>기록</th></tr></thead>
            <tbody>
              {frows.map((b) => {
                const xs = execOf(b.budget_id);
                const on = line?.budget_id === b.budget_id;
                return (
                  <tr key={b.budget_id} className={on ? s.sel : ""}>
                    <td title={`${idKo(b.budget_id)}${noteTail(b.note) ? ` · ${noteTail(b.note)}` : ""}`}>
                      <Link href={qa(`&dept=${fdept}&line=${b.budget_id}#line`)}><b>{b.item}</b></Link>
                    </td>
                    <td><span className={`badge ${b.use === "밖" ? "warn" : ""}`}>{useShort(f, b.use)}</span></td>
                    <td className="num">{chon(b.p)}</td>
                    <td className="num">{chon(b.e)}</td>
                    <td><div className={s.rate}><Bar pct={Math.min(100, rate(b.p, b.e))} /><span className={`badge ${rateTone(b.p, b.e)}`}>{b.e > b.p ? "초과" : `${rate(b.p, b.e)}%`}</span></div></td>
                    <td><Link href={qa(`&dept=${fdept}&line=${b.budget_id}#line`)}>{xs.length ? `${xs.length}건` : <span className="badge none">없음</span>} →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="muted">이 부서의 {f.tab} 예산 줄이 없습니다.</p>}
      </div>

      {line && (
        <div className="card" id="line" style={{ marginTop: 12 }}>
          <div className={s.cardHead}>
            <h3 style={{ margin: 0 }}>{line.item} <span className="muted">{deptName.get(line.dept_id) || line.dept_id}</span></h3>
            <span className="badge">{useShort(FRAMES[line.tab], line.use)}</span>
          </div>
          {sp.xsaved && <span className="badge ok">집행 기록을 넣었습니다</span>}
          {sp.xerr && <span className="badge bad">저장 안 됨 — {sp.xerr}</span>}
          <Facts items={[
            { k: "편성", v: <b>{chon(line.p)}</b> },
            { k: "집행", v: chon(line.e) },
            { k: "집행률", v: <span className={`badge ${rateTone(line.p, line.e)}`}>{line.e > line.p ? "초과" : `${rate(line.p, line.e)}%`}</span> },
            { k: "기록 합", v: `${chon(lineXsum)} · ${lineX.length}건` },
            { k: "기록 없는 집행", v: <span className={line.e - lineXsum > 0 ? "tone-bad" : ""}>{chon(Math.max(0, line.e - lineXsum))}</span> },
          ]} />
          {lineX.length ? (
            <table className="v2t" style={{ marginTop: 10 }}>
              <thead><tr><th className="dt">집행 일자</th><th>내역</th><th className="num">금액</th><th>증빙</th></tr></thead>
              <tbody>
                {lineX.map((x) => (
                  <tr key={x.exec_id}>
                    <td className="dt" title={x.exec_date}>{md(x.exec_date)}</td>
                    <td title={x.exec_desc}>{x.exec_desc}</td>
                    <td className="num">{chon(x.amt)}</td>
                    <td title={x.evidence_name}><FileLink name={x.evidence_name} url={x.evidence_url} max={20} empty={<span className="badge warn">없음</span>} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <details className="fold" open={Boolean(sp.xerr) || !lineX.length} style={{ marginTop: 10 }}>
            <summary>집행 기록 추가</summary>
            <form action={addExec} className={s.execForm}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="area" value={area} />
              <input type="hidden" name="dept_id" value={fdept} />
              <input type="hidden" name="budget_id" value={line.budget_id} />
              <label>집행 일자<input type="date" name="exec_date" defaultValue={ymd()} required /></label>
              <label>내역<input type="text" name="exec_desc" placeholder="예: 정기안전점검 용역" required /></label>
              <label>금액(천원)<input className={s.amt} type="text" inputMode="numeric" name="amount" placeholder="0" required /></label>
              <FileAttach as="label" />
              <label>증빙 이름<input type="text" name="evidence_name" placeholder="파일 없으면 이름만" /></label>
              <button className="btn" type="submit">넣기</button>
            </form>
          </details>
        </div>
      )}

      {/* ── 할 일 ─────────────────────────────── */}
      <h2 id="todo">할 일</h2>
      <div className={area === "I" ? "grid g2" : ""}>
        {area === "I" && (
          <div className="card">
            <h3>나목 없는 부서 <span className="muted">{noNaDepts.length}</span></h3>
            <table className="v2t">
              <thead><tr><th>부서</th><th>「높음」 과제</th><th></th></tr></thead>
              <tbody>
                {noNaDepts.slice(0, 12).map((x) => (
                  <tr key={x.d.dept_id} className={x.open.length ? s.hot : ""}>
                    <td title={x.hs.map((it) => `${it.hazard_factor} · ${it.measure}`).join("\n")}><b>{x.d.dept_name}</b></td>
                    <td>{x.open.length ? <span className="badge bad">미완료 {x.open.length}</span>
                      : x.hs.length ? <span className="badge warn">완료 {x.hs.length}</span>
                      : <span className="badge none">없음</span>}</td>
                    <td><Link href={qa(`&dept=${x.d.dept_id}&edit=1${x.open[0] ? `&risk=${x.open[0].risk_item_id}` : ""}#form`)}>편성 →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <h3>집행률 60% 미만 <span className="muted">{lowRate.length}</span></h3>
          {lowRate.length ? (
            <table className="v2t">
              <thead><tr><th>부서</th><th className="num">편성</th><th className="num">집행</th><th>집행률</th></tr></thead>
              <tbody>
                {lowRate.map((x) => (
                  <tr key={x.d.dept_id}>
                    <td><Link href={qa(`&dept=${x.d.dept_id}#lines`)}>{x.d.dept_name}</Link></td>
                    <td className="num">{mil(x.all.p)}</td><td className="num">{mil(x.all.e)}</td>
                    <td><span className={`badge ${rateTone(x.all.p, x.all.e)}`}>{rate(x.all.p, x.all.e)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">없음</p>}
        </div>
      </div>

      {area === "I" && (
        <details className="card fold" id="high" style={{ marginTop: 14 }}>
          <summary>「높음」 과제 ↔ 나목 예산 <span className="muted">{high.length}</span></summary>
          <table className="v2t">
            <thead><tr><th>부서</th><th>위험요인</th><th className="dt">기한</th><th>조치</th><th>나목 예산</th></tr></thead>
            <tbody>
              {high.map((it) => {
                const bs = naFor(it.risk_item_id);
                const d = deptOfItem(it);
                return (
                  <tr key={it.risk_item_id} className={!bs.length && !it.measure_done_at ? s.hot : ""}>
                    <td>{deptName.get(d) || d}</td>
                    <td title={`${it.hazard_factor} · ${raById.get(it.risk_id)?.place || ""} · ${it.measure}`}><b>{it.hazard_factor}</b></td>
                    <td className="dt">{md(it.measure_due)}</td>
                    <td>{it.measure_done_at ? <span className="badge ok">완료</span> : <span className="badge warn">진행 중</span>}</td>
                    <td title={bs.map((b) => `${idKo(b.budget_id)} · 편성 ${mil(b.p)} · 집행 ${mil(b.e)}`).join("\n")}>
                      {bs.length ? <span className={`badge ${rateTone(bs[0].p, bs[0].e)}`}>{mil(sum(bs).p)} · {rate(sum(bs).p, sum(bs).e)}%</span>
                        : <Link href={qa(`&dept=${d}&edit=1&risk=${it.risk_item_id}#form`)}><span className="badge bad">연결 없음</span> →</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      <h2 id="dept">부서별 편성 <span className="muted">백만원</span></h2>
      {deptRows.length ? (
        <table className={`v2t ${s.money}`}>
          <thead><tr><th>부서</th><th className="num">가목</th><th className="num">나목</th>
            <th className="num">{area === "I" ? "가·나목 밖" : "다목"}</th><th className="num">합계</th><th>집행률</th></tr></thead>
          <tbody>
            {deptRows.map((x) => {
              const tone = rateTone(x.all.p, x.all.e);
              return (
                <tr key={x.d.dept_id} className={tone === "bad" || tone === "warn" ? s.low : ""}>
                  <td><Link href={qa(`&dept=${x.d.dept_id}#lines`)}><b>{x.d.dept_name}</b></Link></td>
                  <td className="num" title={`집행 ${mil(x.ga.e)}`}>{mil(x.ga.p)}</td>
                  <td className="num" title={`집행 ${mil(x.na.e)}`}>{x.na.p ? mil(x.na.p) : area === "I" ? <span className="badge bad">없음</span> : "0"}</td>
                  <td className="num" title={`집행 ${mil(x.da.e)}`}>{mil(x.da.p)}</td>
                  <td className="num" title={`집행 ${mil(x.all.e)}${area !== "I" ? ` · 가~다목 밖 포함` : ""}`}><b>{mil(x.all.p)}</b></td>
                  <td><div className={s.rate}><Bar pct={Math.min(100, rate(x.all.p, x.all.e))} /><span className={`badge ${tone}`}>{rate(x.all.p, x.all.e)}%</span></div></td>
                </tr>
              );
            })}
            <tr className={s.total}>
              <td>합계</td>
              <td className="num">{mil(sum(byUse("가")).p)}</td>
              <td className="num">{mil(sum(byUse("나")).p)}</td>
              <td className="num">{mil(sum(rows.filter((r) => r.use === "다" || (area === "I" && r.use === "밖"))).p)}</td>
              <td className="num">{mil(total.p)}</td>
              <td><span className={`badge ${rateTone(total.p, total.e)}`}>{rate(total.p, total.e)}%</span></td>
            </tr>
          </tbody>
        </table>
      ) : <div className="muted">{f.tab} 예산 줄이 아직 없습니다.</div>}

      {/* ── 편성·집행 입력(접기) ─────────────────────────────── */}
      <details className="card fold" id="form" style={{ marginTop: 18 }}
               open={sp.saved !== undefined || Boolean(sp.err) || Boolean(sp.edit)}>
        <summary>편성·집행 입력 <span className="muted">{deptName.get(fdept)} · 천원</span>
          {sp.saved !== undefined && <> <span className="badge ok">저장함 ({sp.saved}건)</span></>}
          {sp.err && <> <span className="badge bad">저장 안 됨 — {sp.err}</span></>}
        </summary>
        <form action={saveBudget}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="dept_id" value={fdept} />
          <input type="hidden" name="fiscal_year" value={year} />
          <table className={s.fixed}>
            <thead>
              <tr><th style={{ width: 180 }}>항목</th><th style={{ width: 100 }}>용도</th><th>내역</th>
                <th className="num" style={{ width: 150 }}>편성</th><th className="num" style={{ width: 150 }}>집행</th><th style={{ width: 80 }}>집행률</th></tr>
            </thead>
            <tbody>
              {[...f.items.map((it, i) => ({ it, i })), { it: null, i: -1 }].map(({ it, i }) => {
                // 틀에 없는 항목 이름의 줄(다른 재해 구분에서 옮겨 온 줄)은 맨 끝 「그 밖의 줄」로
                const mine = it ? frows.filter((r) => r.item === it.item) : frows.filter((r) => !f.items.some((x) => x.item === r.item));
                if (!it && !mine.length) return null;
                const use = it ? it.use : "밖";
                const useCell = <span className={`badge ${use === "밖" ? "warn" : ""}`} title={f.uses.find((u) => u.k === use)?.text}>{useShort(f, use)}</span>;
                return [
                  ...mine.map((b: Bud, j: number) => (
                    <tr key={b.budget_id}>
                      <td>{!it ? <b>{b.item}</b> : j === 0 ? <b>{it.item}</b> : <span className="muted">〃</span>}</td>
                      <td>{j === 0 || !it ? useCell : null}</td>
                      <td className="muted" title={`${idKo(b.budget_id)}${b.risk_item_id ? ` · ${idKo(b.risk_item_id)}` : ""}${noteTail(b.note) ? ` · ${noteTail(b.note)}` : ""}`}>
                        <input type="hidden" name={`oa_${b.budget_id}`} value={b.area || ""} />
                        <AreaSelect name={`a_${b.budget_id}`} value={b.area || ""} />
                        {noteTail(b.note).slice(0, 20)}</td>
                      <td className="num">
                        <input type="hidden" name={`o_${b.budget_id}`} value={`${b.p}|${b.e}`} />
                        <input className={s.amt} type="text" inputMode="numeric" name={`p_${b.budget_id}`} defaultValue={Math.round(b.p / 1000)} aria-label={`${b.item} 편성액`} />
                      </td>
                      <td className="num"><input className={s.amt} type="text" inputMode="numeric" name={`e_${b.budget_id}`} defaultValue={Math.round(b.e / 1000)} aria-label={`${b.item} 집행액`} /></td>
                      <td><span className={`badge ${rateTone(b.p, b.e)}`}>{b.e > b.p ? "초과" : `${rate(b.p, b.e)}%`}</span></td>
                    </tr>
                  )),
                  it ? (
                    <tr key={`n${i}`} className={mine.length ? s.addRow : s.emptyRow}>
                      <td>{mine.length ? <span className="muted">+ 추가</span> : <b>{it.item}</b>}</td>
                      <td>{mine.length ? null : useCell}</td>
                      <td>
                        {area === "I" && it.use === "나" ? (
                          <select name={`nr_${i}`} defaultValue={preRisk} className={s.memo}>
                            <option value="">— 개선할 위험요인 —</option>
                            {fItems.map((x) => <option key={x.risk_item_id} value={x.risk_item_id}>{x.hazard_factor} · {x.measure}</option>)}
                          </select>
                        ) : null}
                        <input className={s.memo} type="text" name={`nm_${i}`} placeholder="내역(선택)" />
                      </td>
                      <td className="num"><input className={s.amt} type="text" inputMode="numeric" name={`np_${i}`} placeholder="0" aria-label={`${it.item} 새 편성액`} /></td>
                      <td className="num"><input className={s.amt} type="text" inputMode="numeric" name={`ne_${i}`} placeholder="0" aria-label={`${it.item} 새 집행액`} /></td>
                      <td />
                    </tr>
                  ) : null,
                ];
              })}
              {(() => {
                const t = sum(frows);
                return (
                  <tr className={s.total}>
                    <td>합계</td><td /><td className="muted">{deptName.get(fdept)}</td>
                    <td className="num">{chon(t.p)}</td>
                    <td className="num">{chon(t.e)}</td>
                    <td><span className={`badge ${rateTone(t.p, t.e)}`}>{rate(t.p, t.e)}%</span></td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
          <div className={s.saveBar}>
            <span className="muted">바꾼 칸만 저장됩니다.</span>
            <button className="btn" type="submit">저장</button>
          </div>
        </form>
      </details>

      </>}
      <div className={s.foot}>
        <a className="btn ghost sm" href={`/budget/export?role=${role}`}>엑셀 다운로드</a>
        <Link className="btn ghost sm" href={q("/training")}>안전·보건 교육 이수 →</Link>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 메뉴 이름 */}
        <Link className="btn ghost sm" href={q("/hazards")}>유해·위험요인 →</Link>
      </div>
    </UsLayout>
  );
}
