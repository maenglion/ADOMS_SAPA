// [캡처 v2] 경영책임자 보고 요약 — 단계 막대 맨 위 · 설명·법령 인용 제거 · 표는 한 칸 한 줄(2026-09-22)
import Link from "next/link";
import { planState } from "@/lib/system";
import { batchList } from "@/lib/cycle";
import { idKo } from "@/lib/labels";
import { systemStatus, civilStatus, materialStatus, ST_LABEL, ST_TONE } from "@/lib/system";
import { tasks, approvals, duties, depts, ceoActivities, budgets, lawChanges, incidents, orders, assets } from "@/lib/data";
import { loadHazards } from "@/app/hazards/load";
import { REPORT_LIMIT_H, hid, ddayLabel } from "@/app/hazards/codes";

/** 보수·보강 착수·완료 기한이 이 날수 안으로 들어오면 「임박」으로 올린다. */
const FIX_SOON_D = 90;
import { SECURE_AXES, secureAxisOrUnset, UNSET_AXIS, AREA_NAME } from "@/lib/axes";
import { Bar, Stat } from "@/components/bits";
import { Donut, BarGroup, ChartSwitch } from "@/components/Chart";
import { isDemoMode } from "@/lib/mode";
import { drillSubstitutes } from "@/lib/drill";
import { loadResponses, fmtMin } from "@/app/recurrence/response";
import { ymd } from "@/lib/day";
import Steps, { type Step } from "@/components/Steps";
import { UsLayout } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 기관장 예방활동 레이아웃 + 좌측
import { CeoSide } from "@/app/ceo/_parts";

export const dynamic = "force-dynamic";

const done = (r: any) => r.status === "이행완료" || r.status === "점검완료";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const mmdd = (d?: string) => String(d || "").slice(5, 10);

/** S12 — 경영책임자 대시보드. 「내가 무엇을 책임지고, 지금 어디가 비었는가」 한 장. */
export default async function Exec({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 좌측·보고서 단추에 역할을 이어 준다
  const graph = sp.g || "";
  const demo = await isDemoMode();
  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
  const du = await duties({ limit: 100000 });
  const deptList = await depts();
  const deptName = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
  const acts = (await ceoActivities()).filter((a: any) => a.deleted !== "Y"); // 기관장 예방활동 삭제 표시분은 뺀다(09-24)
  const buds = await budgets();
  const lcs = await lawChanges();
  const incs = await incidents();
  const ords = (await orders()).filter((o: any) => o.doc_nature !== "지도·권고·조언"); // 지도·권고·조언은 법 제4조제1항제3호 대상 아님(참고 기록)
  const ast = await assets({ limit: 3000 });

  const total = rows.length;
  const okN = rows.filter(done).length;
  const over = rows.filter((r: any) => r.status === "기간초과");
  const need = rows.filter((r: any) => r.status === "조치필요").length;
  const waitApproval = rows.filter((r: any) => r.approval_status === "제출").length;
  const plan = buds.reduce((s: number, b: any) => s + Number(b.planned_amount || 0), 0);
  const exec = buds.reduce((s: number, b: any) => s + Number(b.executed_amount || 0), 0);

  const byArea = ["I", "F", "M"].map((a) => {
    const r = rows.filter((x: any) => x.area === a);
    return { a, n: r.length, d: r.filter(done).length, duties: du.filter((x: any) => x.area === a).length };
  });

  const byAxis = [...SECURE_AXES, UNSET_AXIS].map((ax) => {
    const r = rows.filter((x: any) => secureAxisOrUnset(x.code36) === ax);
    return { ax, n: r.length, d: r.filter(done).length, over: r.filter((x: any) => x.status === "기간초과").length };
  });

  const byDept = deptList
    .map((d: any) => {
      const r = rows.filter((x: any) => x.dept_id === d.dept_id);
      return { ...d, n: r.length, d: r.filter(done).length, over: r.filter((x: any) => x.status === "기간초과").length };
    })
    .filter((d: any) => d.n > 0)
    .sort((a: any, b: any) => pct(a.d, a.n) - pct(b.d, b.n));

  const overTop = [...over].sort((a: any, b: any) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 8);
  const soon = lcs.filter((c: any) => c.effective_at >= "2026-09-01");
  const condN = du.filter((d: any) => (d.badge || "").includes("조건부")).length;
  const noAsset = du.filter((d: any) => (d.badge || "").includes("자산 대장 없음")).length;

  const sys = await systemStatus("ceo");
  const civ = await civilStatus("ceo");
  const mat = await materialStatus("ceo");

  // 내 결재·확인 대기 — 유해·위험요인(심각) 보고 · 보수보강 착수 기한 · 대피훈련 갈음 확인
  const { rows: hz } = await loadHazards();
  const hzReport = hz.filter((r) => r.severity === "심각" && !r.ceo_reported_at && r.open)
    .sort((a, b) => (b.reportH || 0) - (a.reportH || 0));
  const hzFix = hz.filter((r) => r.deadline && !r.fix_started_at && (r.deadline.startLate || (r.deadline.startLeft ?? 999) <= FIX_SOON_D))
    .sort((a, b) => (a.deadline!.startLeft ?? 0) - (b.deadline!.startLeft ?? 0));
  const hzDone = hz.filter((r) => r.deadline && r.fix_started_at && !r.fix_done_at && (r.deadline.doneLate || (r.deadline.doneLeft ?? 999) <= FIX_SOON_D));
  // 대피훈련 갈음 — /drills · /system?area=F 와 같은 함수(lib/drill.ts). 시설 단위로 센다.
  const drillAsk = [...(await drillSubstitutes()).values()].filter((x) => x.state === "갈음 확인 없음");
  // ★ 경영책임자가 직접 결재·확인할 것만 센다(2026-09-21). 과제 증빙 결재(부서 관리자 몫)는 참고로만 보인다.
  //   ⑦ 점검 회차 결재요청 · 안전계획 갈음 확인(시행령 제10조제4호 단서) · 위험요인 보고 · 보수보강 기한 · 훈련 갈음 확인.
  const batchAsk = (await batchList()).filter((b: any) => b.status === "결재요청");
  const planAsk = (civ.plans || []).filter((r: any) => planState(r) === "갈음 확인 없음");
  // 진행 중 재해 대응(시행령 제10조제7호다목 · 제4조제8호) — /recurrence 와 같은 함수
  const { resp: respMap, setting: respSet } = await loadResponses(incs, ymd());
  const respOn = [...respMap.values()].filter((x) => x.active);
  const askN = batchAsk.length + planAsk.length + hzReport.length + hzFix.length + hzDone.length + drillAsk.length + mat.ceoWait.length;

  // [캡처 v2] 경영책임자 업무 단계 — 체계 → 이행 → 결재·확인 → 조치 → 재해 대응
  const steps: Step[] = [
    { label: "체계", n: `${sys.cnt("ok")}/${sys.clauses.length}`, state: sys.cnt("none") ? "warn" : "done", href: "/system?role=ceo" },
    { label: "이행", n: `${pct(okN, total)}%`, state: "done", href: "/tasks?role=ceo" },
    { label: "결재·확인", n: askN, state: askN ? "on" : "done", href: "#ask" },
    { label: "조치", n: need + over.length, state: need + over.length ? "warn" : "", href: "/tasks?role=ceo&status=기간초과" },
    { label: "재해대응", n: respOn.length, state: respOn.length ? "warn" : "", href: "/recurrence?role=ceo#inc-list" },
  ];

  const today = ymd();
  const real = incs.filter((i: any) => i.event_class !== "아차사고");
  const near = incs.length - real.length;
  const openInc = real.filter((i: any) => !(i.effect_checked_at || i.plan_done_at));
  const openOrd = ords.filter((o: any) => !o.closed_at);   // 미종결 — /recurrence 와 같은 규칙
  const lateOrd = openOrd.filter((o: any) => !o.done_at && (o.extended_due || o.due_date) && (o.extended_due || o.due_date) < today);

  // 체계 세 줄 — 같은 모양으로
  const sysRows = [
    { name: "중대산업재해", ref: "시행령 제4조", c: sys, href: "/system?role=ceo",
      badges: sys.clauses.map((c, i) => ({ key: String(c.no), href: `/system?role=ceo#c${c.no}`, t: `제${c.no}호 ${c.name} — ${ST_LABEL[sys.sts[i]]}`, tone: ST_TONE[sys.sts[i]], l: `제${c.no}호` })) },
    { name: "중대시민재해(공중이용시설·공중교통수단)", ref: "시행령 제10조·제11조", c: civ, href: "/system?role=ceo&area=F",
      badges: civ.clauses.map((c: any, i: number) => ({ key: c.anchor || String(c.no), href: `/system?role=ceo&area=F#${c.anchor || ""}`, t: `${c.ref} ${c.name} — ${ST_LABEL[civ.sts[i]]}`, tone: ST_TONE[civ.sts[i]], l: String(c.ref || "").replace("시행령 ", "").replace("제2항", "②") })) },
    { name: "중대시민재해(원료·제조물)", ref: "시행령 제8조·제9조", c: mat, href: "/system?role=ceo&area=M",
      badges: mat.clauses.map((c, i) => ({ key: c.anchor || String(c.no), href: `/system?role=ceo&area=M#${c.no === 0 ? "mat" : c.anchor || ""}`, t: `${c.ref} ${c.name} — ${mat.na[i] ? "해당 없음" : ST_LABEL[mat.sts[i]]}`, tone: mat.na[i] ? "none" : ST_TONE[mat.sts[i]], l: c.no === 0 ? "해당 여부" : String(c.ref || "").replace("시행령 ", "").replace("제2항", "②") })) },
  ];

  return (
    <UsLayout side={<CeoSide on="exec" role={role} />}>   {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 기관장 예방활동 레이아웃·좌측(맨 앞) */}
      <h1 className="v2h">경영책임자 보고 요약</h1>{/* 09-26 사용자: 메뉴 밖 화면 합치기 — 머리·좌측 메뉴 이름과 같게 */}
      <div className="chips">
        <span className="badge">법 제4조·제5조</span>
        <span className="badge none">기준 {mmdd(today)}</span>
        <span style={{ flex: 1 }} />
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 한 장 보고서(/report)는 이 단추로 연다(인쇄 화면은 인쇄용 모양 그대로) */}
        <Link className="btn sm" href={`/report?role=${role}`}>한 장 보고서 인쇄</Link>
      </div>

      <Steps items={steps} />

      <div className="grid g4">
        <Stat n={`${pct(okN, total)}%`} l="이행률" tone="ok" href="/tasks?role=ceo" />
        <Stat n={over.length} l="기간 초과" tone="bad" href="/tasks?role=ceo&status=기간초과" />
        <Stat n={askN} l="결재·확인" tone="warn" href="#ask" />
        <Stat n={`${pct(exec, plan)}%`} l="예산 집행" tone="ok" />
      </div>

      {/* 체계 — 세 재해 구분을 한 표로 */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>체계 수립</h3>
        <table className="v2t">
          <thead><tr><th>구분</th><th className="num">갖춰짐</th><th className="num">일부</th><th className="num">없음</th><th>항목</th><th /></tr></thead>
          <tbody>
            {sysRows.map((s) => (
              <tr key={s.name}>
                <td title={`${s.name} · ${s.ref}`}><b>{s.name}</b></td>
                <td className="num">{s.c.cnt("ok")}</td>
                <td className="num">{s.c.cnt("part")}</td>
                <td className="num">{s.c.cnt("none")}</td>
                <td style={{ maxWidth: "none", whiteSpace: "normal" }}>
                  <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                    {s.badges.map((b) => <Link key={b.key} href={b.href} title={b.t} className={`badge ${b.tone}`}>{b.l}</Link>)}
                  </span>
                </td>
                <td><Link className="btn sm ghost" href={s.href}>보기</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(mat.ceoWait.length > 0 || mat.allNo) && (
          <div style={{ marginTop: 6 }}>
            {mat.ceoWait.length > 0 && <Link className="badge warn" href="/system?role=ceo&area=M#mat"
              title={mat.ceoWait.map((r: any) => `${r.item_name}(${r.verdict})`).join(" · ")}>원료·제조물 확인 대기 {mat.ceoWait.length}</Link>}
            {mat.allNo && <span className="badge none" title={`품목 ${mat.items.length}개 모두 비해당 · 사유 ${mat.noN}건`}>원료·제조물 해당 없음</span>}
          </div>
        )}
      </div>

      {/* 진행 중 재해 대응 한 줄 */}
      <div className="card" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderLeft: `5px solid var(--${respOn.length ? "bad" : "ok"})` }}>
        <b>재해 대응</b>
        {respOn.length ? respOn.map((x) => (
          <span key={x.incident_id} title={x.first ? `최초보고 ${fmtMin(x.firstMin)} 만에` : "최초보고 전"}>
            {x.incident_id.replace(/^INC-/, "사고-")} · 미완 {x.missing.length}
            {x.firstLate && <span className="badge bad" style={{ marginLeft: 4 }}>{fmtMin(respSet.limitMin)} 넘김</span>}
          </span>
        )) : <span className="muted">없음</span>}
        <span style={{ flex: 1 }} />
        <Link className="btn sm ghost" href="/recurrence?role=ceo#inc-list">보기</Link>
      </div>

      {/* 내 결재·확인 대기 */}
      <h2 id="ask">결재·확인 대기 <span className="muted" style={{ fontWeight: 400 }}>{askN.toLocaleString()}</span></h2>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>점검 회차 <span className="muted">{batchAsk.length}</span></h3>
          <table className="v2t"><tbody>
            {batchAsk.length === 0 && <tr><td className="muted">없음</td></tr>}
            {batchAsk.map((b: any) => (
              <tr key={b.batch_id}>
                <td title={`${idKo(b.batch_id)} · ${b.title}`}><Link href={`/inspections?role=ceo&view=approve&b=${b.batch_id}`}>{b.title}</Link></td>
                <td className="dt">{mmdd(b.requested_at)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>

        <div className="card">
          <h3>위험요인 보고 <span className="muted">{hzReport.length}</span></h3>
          <table className="v2t"><tbody>
            {hzReport.length === 0 && <tr><td className="muted">없음</td></tr>}
            {hzReport.slice(0, 6).map((r) => (
              <tr key={r.hz_id}>
                <td title={`${r.description} · 기준 ${REPORT_LIMIT_H}시간`}><Link href={`/hazards/${r.hz_id}?role=ceo`}>{hid(r.hz_id)} · {r.asset_name}</Link></td>
                <td className="cd"><span className={`badge ${r.reportLate ? "bad" : "warn"}`}>{r.reportH ?? "-"}시간</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>

        <div className="card">
          <h3>보수·보강 기한 <span className="muted">{hzFix.length + hzDone.length}</span></h3>
          <table className="v2t"><tbody>
            {hzFix.length + hzDone.length === 0 && <tr><td className="muted">없음</td></tr>}
            {hzFix.slice(0, 5).map((r) => (
              <tr key={`s${r.hz_id}`}>
                <td title={`착수 기한 ${r.deadline!.startBy}`}><Link href={`/hazards/${r.hz_id}?role=ceo`}>{hid(r.hz_id)} · {r.asset_name}</Link></td>
                <td className="cd"><span className={`badge ${r.deadline!.startLate ? "bad" : "warn"}`}>착수 {ddayLabel(r.deadline!.startLeft ?? 0)}</span></td>
              </tr>
            ))}
            {hzDone.slice(0, 3).map((r) => (
              <tr key={`d${r.hz_id}`}>
                <td title={`완료 기한 ${r.deadline!.doneBy}`}><Link href={`/hazards/${r.hz_id}?role=ceo`}>{hid(r.hz_id)} · {r.asset_name}</Link></td>
                <td className="cd"><span className={`badge ${r.deadline!.doneLate ? "bad" : "warn"}`}>완료 {ddayLabel(r.deadline!.doneLeft ?? 0)}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>

        <div className="card">
          <h3>안전계획 갈음 <span className="muted">{planAsk.length}</span></h3>
          <Link className="btn sm ghost" href="/system?role=ceo&area=F#f4">확인</Link>
        </div>

        <div className="card">
          <h3>대피훈련 갈음 <span className="muted">{drillAsk.length}</span></h3>
          <table className="v2t"><tbody>
            {drillAsk.length === 0 && <tr><td className="muted">없음</td></tr>}
            {drillAsk.slice(0, 5).map((x) => (
              <tr key={x.key}>
                <td title={`${x.plan.title} · ${x.where}`}><Link href="/system?area=F&role=ceo#subst">{x.facility_name}</Link></td>
              </tr>
            ))}
          </tbody></table>
        </div>

        <div className="card">
          <h3>증빙 결재 <span className="muted">{waitApproval.toLocaleString()}</span></h3>
          <div className="muted" style={{ marginBottom: 6 }}>조치 필요 {need.toLocaleString()}</div>
          <Link className="btn sm ghost" href="/evidence?role=ceo">결재</Link>
        </div>
      </div>

      {/* 재해 구분 */}
      <h2>재해 구분별</h2>
      <div className="grid g3">
        {byArea.map((x) => (
          <div className="card" key={x.a}>
            <div style={{ fontWeight: 700, color: "var(--deep)", minHeight: 48 }}>{AREA_NAME[x.a]}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div className="kpi" style={{ fontSize: "2.2rem" }}>{pct(x.d, x.n)}%</div>
              <div className="muted">{x.d.toLocaleString()} / {x.n.toLocaleString()}</div>
            </div>
            <Bar pct={pct(x.d, x.n)} />
            <Link className="more" href={`/duties/list?role=ceo&area=${x.a}`}>의무 {x.duties.toLocaleString()}건 →</Link>
          </div>
        ))}
      </div>

      {/* 확보의무 대분류 */}
      <h2>확보의무별</h2>
      <div className="tbl-wrap">
        <table className="v2t">
          <thead><tr><th>확보의무</th><th className="num">과제</th><th className="num">완료</th><th className="num">초과</th><th style={{ width: "30%" }}>이행률</th></tr></thead>
          <tbody>
            {byAxis.map((x) => (
              <tr key={x.ax}>
                <td title={x.ax}><b>{x.ax}</b></td>
                <td className="num">{x.n.toLocaleString()}</td>
                <td className="num">{x.d.toLocaleString()}</td>
                <td className="num">{x.over ? <span className="badge bad">{x.over}</span> : <span className="muted">0</span>}</td>
                <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}><Bar pct={pct(x.d, x.n)} /></div>
                  <b style={{ width: 52, textAlign: "right" }}>{pct(x.d, x.n)}%</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="fillcol">
          <h2>부서별</h2>
          <div className="tbl-wrap fill" style={{ maxHeight: 420, ["--minh" as any]: "420px" }}>
            <table className="v2t">
              <thead><tr><th>부서</th><th className="num">과제</th><th className="num">초과</th><th style={{ width: 200 }}>이행률</th></tr></thead>
              <tbody>
                {byDept.map((d: any) => (
                  <tr key={d.dept_id}>
                    <td><Link href={`/tasks?role=gm&dept=${d.dept_id}`}>{d.dept_name}</Link></td>
                    <td className="num">{d.n.toLocaleString()}</td>
                    <td className="num">{d.over ? <span className="badge bad">{d.over}</span> : <span className="muted">0</span>}</td>
                    <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><Bar pct={pct(d.d, d.n)} /></div>
                      <b style={{ width: 48, textAlign: "right" }}>{pct(d.d, d.n)}%</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2>지금 손댈 것</h2>
          <div className="card">
            <h3>기한 지난 과제</h3>
            <table className="v2t">
              <tbody>
                {overTop.map((r: any) => (
                  <tr key={r.task_id}>
                    <td className="dt"><span className="badge bad">{mmdd(r.due_date)}</span></td>
                    <td title={`${deptName.get(r.dept_id) || r.dept_id} · ${r.asset_name || r.target_name}`}>
                      <Link href={`/duties/${r.duty_key}?role=ceo`}>{r.duty_name || r.article_title || r.code36_name}</Link>
                    </td>
                    <td className="muted">{deptName.get(r.dept_id) || r.dept_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {over.length > overTop.length && <Link className="more" href="/tasks?role=ceo&status=기간초과">전체 {over.length.toLocaleString()}건 →</Link>}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>법령 개정</h3>
            <table className="v2t">
              <tbody>
                {soon.map((c: any) => (
                  <tr key={c.change_id}>
                    <td className="dt"><span className="badge warn">{mmdd(c.effective_at)}</span></td>
                    <td title={`${c.law} · ${c.changed_kind}`}>{c.law}</td>
                    <td className="num">{Number(c.affected_duty_cnt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>재해 · 명령</h3>
            <table className="v2t">
              <tbody>
                <tr><td>재해</td><td className="num">{real.length}</td><td className="muted">진행 {openInc.length} · 아차 {near}</td></tr>
                <tr><td>명령 미종결</td><td className="num">{openOrd.length}</td>
                  <td>{lateOrd.length ? <span className="badge bad">기한 넘김 {lateOrd.length}</span> : <span className="muted">-</span>}</td></tr>
                {lateOrd.slice(0, 3).map((o: any) => (
                  <tr key={o.order_id}>
                    <td className="dt"><span className="badge bad">{mmdd(o.extended_due || o.due_date)}</span></td>
                    <td colSpan={2} title={`${o.issuer} · ${o.content}`}>{o.issuer} · {o.content}</td>
                  </tr>
                ))}
                {openInc.slice(0, 3).map((i: any) => (
                  <tr key={i.incident_id}>
                    <td className="dt"><span className="badge warn">{mmdd(i.occurred_at)}</span></td>
                    <td colSpan={2} title={i.summary}>{i.event_class ? `${i.event_class} · ` : ""}{i.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a className="more" href="/recurrence?role=ceo">재발방지·개선명령 →</a>
          </div>
        </div>
      </div>

      {/* 이행 상태 그래프 — 접어 둔다 */}
      <details className="card fold" style={{ marginTop: 16 }} open={!!graph}>
        <summary>이행 상태 그래프</summary>
        <div style={{ marginBottom: 8 }}><ChartSwitch base="/exec" sp={sp as Record<string, string>} cur={graph} /></div>
        <div className="grid g2">
          <div>
            <h3>이행 상태</h3>
            {(() => {
              const slices = [
                { label: "이행완료·점검완료", n: okN, tone: "ok" as const },
                { label: "이행대기", n: rows.filter((r: any) => r.status === "이행대기").length, tone: "none" as const },
                { label: "조치필요", n: need, tone: "warn" as const },
                { label: "기간초과", n: over.length, tone: "bad" as const },
              ];
              return graph === "pie"
                ? <Donut slices={slices} center={`${pct(okN, total)}%`} sub="이행률" />
                : <BarGroup slices={slices} />;
            })()}
          </div>
          <div>
            <h3>결재 상태</h3>
            {(() => {
              const slices = ["작성중", "제출", "승인", "반려"].map((a, i) => ({
                label: a,
                n: rows.filter((r: any) => (r.approval_status || "작성중") === a).length,
                tone: (["none", "", "ok", "bad"] as const)[i],
              }));
              return graph === "pie" ? <Donut slices={slices} /> : <BarGroup slices={slices} />;
            })()}
          </div>
        </div>
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>점검·지시 기록 <span className="muted">{acts.length}</span></summary>
        <table className="v2t">
          <tbody>
            {acts.slice(0, 6).map((a: any) => (
              <tr key={a.activity_id}>
                <td className="dt muted">{mmdd(a.activity_date)}</td>
                <td><span className="badge">{a.activity_type}</span></td>
                <td title={`${a.title}${a.instruction ? ` — 지시: ${a.instruction}` : ""}`}>{a.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {!demo && (
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>미확정 항목</summary>
          <table className="v2t">
            <tbody>
              <tr><td>조건부 의무</td><td className="num">{condN.toLocaleString()}</td></tr>
              <tr><td>자산 대장 없음</td><td className="num">{noAsset.toLocaleString()}</td></tr>
              <tr><td>분류 자동 판단</td><td className="num">{du.filter((d: any) => /추론|자동 판단/.test(d.badge || "")).length.toLocaleString()}</td></tr>
              <tr><td>법령DB 반영 대기</td><td className="num">{du.filter((d: any) => /미반영|반영 대기/.test(d.badge || "")).length.toLocaleString()}</td></tr>
              <tr><td>관리 자산</td><td className="num">{ast.length.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </details>
      )}
    </UsLayout>
  );
}
