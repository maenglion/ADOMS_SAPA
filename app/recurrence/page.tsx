import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import { Stat } from "@/components/bits";
import StaffPicker from "@/components/StaffPicker";
import { ROLE_STAFF, deptOf } from "@/lib/roles";
import {
  loadRecurrence, halfLabel, addDays, INC_CLASSES, ACCIDENT_TYPES,
  ORD_AREAS, ORD_AREA_LABEL, ORD_NATURES, isAdvice, incClassLabel,
  type IncView, type OrdView, type NilCell,
} from "./model";
import { addIncident, advanceIncident, confirmNil, addOrder, advanceOrder } from "./actions";
import s from "./recurrence.module.css";
import { loadResponses, fmtMin } from "./response";
import { saveResponseSetting } from "./response-actions";
import ResponsePanel, { PriorHazards } from "./ResponsePanel";
import Steps, { type Step } from "@/components/Steps";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03

export const dynamic = "force-dynamic";

// [캡처 v2] 법령 인용 상자·경영책임자 한 줄·설명 문단·입력 안내 제거, 맨 위 단계 막대, 명령 표 6칸 한 줄, 알림은 접기(09-22)

/** 사고·명령 번호를 우리말 접두어로(INC → 사고, ORD → 명령). */
const incNo = (id?: string) => String(id || "").replace(/^INC-/, "사고-");
const ordNo = (id?: string) => String(id || "").replace(/^ORD-/, "명령-");
const md = (d?: string) => String(d || "").slice(5, 10);

const CLASS_TONE: Record<string, string> = { 산업재해: "warn", 시민재해: "warn", 아차사고: "none" };
const NIL_TONE: Record<NilCell["state"], string> = {
  "확인함": "ok", "재해 있음": "warn", "비어 있음": "bad", "확인 뒤 발생": "warn", "확인과 맞지 않음": "bad",
};

export default async function Recurrence({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const myDept = role === "mgr" ? "" : deptOf(role);
  const canWrite = role !== "ceo";
  const me = ROLE_STAFF[role] || "";

  const R = await loadRecurrence(myDept);
  const { t, incs, ords, advice, nil, periods, curHalf, deptName, staffName, assetName, staffOpts } = R;
  const nm = (id?: string) => (id ? staffName.get(id) || id : "");
  const { resp, setting } = await loadResponses(incs, t);
  const respActive = [...resp.values()].filter((x) => x.active);
  const respLateFirst = respActive.filter((x) => x.firstLate);
  const respLateAll = [...resp.values()].filter((x) => x.applies && x.firstLate);
  const respHidden = { role, ic: sp.ic, is: sp.is, os: sp.os, oa: sp.oa, on: sp.on };
  const assetLabel = (id?: string) => (id ? assetName.get(id) || id : "");

  /* ── 숫자 ── */
  const incOpen = incs.filter((i) => i.cur < 5);
  const incLate = incOpen.filter((i) => i.overdue);
  const incRepeat = incs.filter((i) => i.repeat.length > 0);
  const ordOpen = ords.filter((o) => o.cur < 5);
  const ordLate = ords.filter((o) => o.overdue);
  const ordSoon = ords.filter((o) => o.soon);
  const ordToReport = ords.filter((o) => o.done_at && !o.reported_at);
  const curCells = nil.map((n) => n.cells[1]);
  const nilOk = curCells.filter((c) => c.state === "확인함").length;
  const nilBlank = curCells.filter((c) => c.state === "비어 있음").length;
  const prevBlank = nil.map((n) => n.cells[0]).filter((c) => c.state === "비어 있음").length;
  const nilBad = nil.flatMap((n) => n.cells).filter((c) => c.state === "확인과 맞지 않음").length;

  /* ── 거르기 ── */
  let incShown = incs;
  if (sp.ic) incShown = incShown.filter((i) => i.event_class === sp.ic);
  if (sp.is === "open") incShown = incShown.filter((i) => i.cur < 5);
  if (sp.is === "late") incShown = incShown.filter((i) => i.overdue);
  if (sp.is === "done") incShown = incShown.filter((i) => i.cur === 5);
  if (sp.is === "repeat") incShown = incShown.filter((i) => i.repeat.length > 0);
  if (sp.st) incShown = incShown.filter((i) => String(i.cur) === sp.st);
  incShown = [...incShown].sort((a, b) =>
    Number(a.cur === 5) - Number(b.cur === 5) || Number(b.overdue) - Number(a.overdue)
    || String(b.occurred_at).localeCompare(String(a.occurred_at)));

  let ordShown = ords;
  const os = sp.os || "open";
  if (os === "open") ordShown = ords.filter((o) => o.cur < 5);
  if (os === "late") ordShown = ordLate;
  if (os === "soon") ordShown = ordSoon;
  if (os === "done") ordShown = ords.filter((o) => o.cur === 5);
  const oa = sp.oa || "";
  const areaOf = (o: OrdView) => String(o.order_area || "");
  if (oa === "none") ordShown = ordShown.filter((o) => !areaOf(o));
  else if (oa) ordShown = ordShown.filter((o) => areaOf(o) === oa);
  const on = sp.on || "";
  const natureUnknown = ords.filter((o) => !o.doc_nature);
  if (on === "unknown") ordShown = ordShown.filter((o) => !o.doc_nature);
  if (on === "advice") ordShown = [...advice];
  ordShown = [...ordShown].sort((a, b) =>
    Number(b.overdue) - Number(a.overdue) || Number(a.cur === 5) - Number(b.cur === 5)
    || String(a.effDue).localeCompare(String(b.effDue)));
  const LIMIT = 15;
  const ordPage = sp.oall ? ordShown : ordShown.slice(0, LIMIT);

  const q = (o: Record<string, string | undefined>, anchor = "") => {
    const p = new URLSearchParams({ role });
    const m: Record<string, string | undefined> = { ic: sp.ic, is: sp.is, st: sp.st, os: sp.os, oa: sp.oa, on: sp.on, ...o };
    Object.entries(m).forEach(([k, v]) => v && p.set(k, v));
    return `/recurrence?${p.toString()}${anchor ? `#${anchor}` : ""}`;
  };
  const Hidden = () => (
    <>
      <input type="hidden" name="role" value={role} />
      {sp.ic && <input type="hidden" name="ic" value={sp.ic} />}
      {sp.is && <input type="hidden" name="is" value={sp.is} />}
      {sp.os && <input type="hidden" name="os" value={sp.os} />}
      {sp.oa && <input type="hidden" name="oa" value={sp.oa} />}
      {sp.on && <input type="hidden" name="on" value={sp.on} />}
    </>
  );
  const defOwner = me && staffOpts.some((x) => x.staff_id === me) ? me : "";

  // [캡처 v2] 업무이행 단계 — 대응 → 조사 → 대책 → 이행 → 효과 → 명령
  const atCur = (k: number) => incs.filter((i) => i.cur === k);
  const stepOf = (label: string, k: number): Step => {
    const xs = atCur(k);
    return { label, n: xs.length, href: q({ st: sp.st === String(k) ? undefined : String(k), is: undefined }, "inc-list"),
      state: xs.some((i) => i.overdue) ? "warn" : sp.st === String(k) ? "on" : "" };
  };
  const bar: Step[] = [
    { label: "대응", n: respActive.length, href: "#inc-list", state: respLateFirst.length ? "warn" : respActive.length ? "on" : "done" },
    stepOf("조사", 1), stepOf("대책", 2), stepOf("이행", 3), stepOf("효과", 4),
    { label: "명령", n: ordOpen.length, href: q({ os: "open" }, "ord-list"), state: ordLate.length ? "warn" : "" },
  ];

  const alerts: React.ReactNode[] = [];
  if (incLate.length) alerts.push(<Link key="il" href={q({ is: "late" }, "inc-list")}>재발방지 기한 넘김 {incLate.length}</Link>);
  if (ordLate.length) alerts.push(<Link key="ol" href={q({ os: "late" }, "ord-list")}>명령 기한 넘김 {ordLate.length}</Link>);
  if (ordSoon.length) alerts.push(<Link key="os" href={q({ os: "soon" }, "ord-list")}>명령 7일 안 {ordSoon.length}</Link>);
  if (ordToReport.length) alerts.push(<span key="or">결과 보고 전 {ordToReport.length}</span>);
  if (prevBlank) alerts.push(<Link key="pb" href="#nil">{halfLabel(periods[0])} 미확인 {prevBlank}</Link>);
  if (nilBad) alerts.push(<span key="nb" className={s.warnText}>확인 불일치 {nilBad}</span>);
  if (respLateFirst.length) alerts.push(<span key="rl" className={s.warnText}>최초보고 늦음 {respLateFirst.length}</span>);
  respActive.forEach((x) => x.missing.length > 0 && alerts.push(
    <Link key={`m-${x.incident_id}`} href={`#resp-${x.incident_id}`}>{incNo(x.incident_id)} 미완 {x.missing.length}</Link>));
  respActive.filter((x) => x.first && !x.ceoAck).forEach((x) => alerts.push(
    <span key={`a-${x.incident_id}`}>{incNo(x.incident_id)} 받음 기록 없음</span>));

  return (
    <UsLayout side={<MenuSide group="이행점검및 조치" />}>   {/* 09-25: 좌측 = 머리 메뉴 이행점검 및 조치 */}
      <h1 className="v2h">재발방지 · 개선명령</h1>
      <div className="chips">
        <span className="badge">법 제4조제1항제2호·제3호</span>
        <span className="badge none">{myDept ? deptName.get(myDept) || myDept : "전 부서"}</span>
      </div>

      <Steps items={bar} />

      {sp.err && <div className={`card ${s.msgErr}`}>저장 안 함 — {sp.err}</div>}
      {sp.ok && <div className={`card ${s.msgOk}`}>{sp.ok}</div>}

      <div className={`grid g6 ${s.stats}`}>
        <Stat n={incOpen.length} l="재발방지" href={q({ is: "open" }, "inc-list")} />
        <Stat n={incLate.length} l="기한 넘김" tone={incLate.length ? "bad" : "ok"} href={q({ is: "late" }, "inc-list")} />
        <Stat n={incRepeat.length} l="재발" tone={incRepeat.length ? "warn" : ""} href={q({ is: "repeat" }, "inc-list")} />
        <Stat n={ordOpen.length} l="명령 미종결" href={q({ os: "open" }, "ord-list")} />
        <Stat n={ordLate.length} l="명령 넘김" tone={ordLate.length ? "bad" : "ok"} href={q({ os: "late" }, "ord-list")} />
        <Stat n={`${nilOk}/${curCells.length}`} l="무재해 확인" tone={nilBlank ? "warn" : "ok"} href="#nil" />
      </div>

      {alerts.length > 0 && (
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>할 일 <span className="badge warn">{alerts.length}</span></summary>
          <div className="chips">{alerts}</div>
        </details>
      )}

      {/* ── 1. 재발방지 ─────────────────────────────────── */}
      <h2 id="inc-list">재해 재발방지</h2>
      <div className="chips">
        <Link className={`chip ${!sp.ic ? "on" : ""}`} href={q({ ic: undefined }, "inc-list")}>전체 {incs.length}</Link>
        {INC_CLASSES.map((c) => (
          <Link key={c} className={`chip ${sp.ic === c ? "on" : ""}`} href={q({ ic: c }, "inc-list")}>
            {incClassLabel(c)} {incs.filter((i) => i.event_class === c).length}
          </Link>
        ))}
        <span className="muted" style={{ marginLeft: 10 }}>상태</span>
        {[["", "모두"], ["open", "진행 중"], ["late", "기한 넘김"], ["repeat", "재발"], ["done", "끝남"]].map(([k, l]) => (
          <Link key={k} className={`chip ${(sp.is || "") === k ? "on" : ""}`} href={q({ is: k || undefined, st: undefined }, "inc-list")}>{l}</Link>
        ))}
      </div>

      <details className="card fold" id="resp-setting" style={{ margin: "8px 0" }}>
        <summary>최초보고 기한 {fmtMin(setting.limitMin)} {setting.isDefault && <span className="badge none">기본값</span>}
          {respLateAll.length > 0 && <span className="badge bad">넘김 {respLateAll.length}</span>}</summary>
        {(role === "gm" || role === "mgr") ? (
          <form action={saveResponseSetting} className={s.inlineForm}>
            <Hidden />
            <select name="first_report_limit_min" defaultValue={String(setting.limitMin)} aria-label="최초보고 기한">
              {[15, 30, 60, 120, 180].map((m) => <option key={m} value={m}>{fmtMin(m)}</option>)}
            </select>
            <input type="text" name="memo" placeholder="정한 근거" />
            <button className="btn sm ghost" type="submit">기한 저장</button>
          </form>
        ) : <span className="muted">{setting.isDefault ? "" : `${setting.set_at} · ${nm(setting.set_by)}`}</span>}
      </details>

      <div className={s.cards}>
        {incShown.map((i) => <IncCard key={i.incident_id} i={i} />)}
        {!incShown.length && <div className="card muted">없음</div>}
      </div>

      {canWrite && (
        <details className={`card ${s.newbox}`} id="inc-new">
          <summary><b>새 사고 등록</b></summary>
          <form action={addIncident} className={s.form}>
            <Hidden />
            <div><label>구분 *</label>
              <select name="event_class" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                {INC_CLASSES.map((c) => <option key={c} value={c}>{incClassLabel(c)}</option>)}
              </select></div>
            <div><label>피해 대상 *</label>
              <select name="event_area" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                <option value="산업">종사자(중대산업재해)</option>
                <option value="시민">이용자 등(중대시민재해)</option>
              </select></div>
            <div><label>중대재해</label>
              <select name="serious" defaultValue="판단 전">
                <option>판단 전</option><option>해당</option><option>해당 안 됨</option>
              </select></div>
            <div><label>시민재해 대상</label>
              <select name="civil_basis" defaultValue="공중이용시설·공중교통수단">
                <option>공중이용시설·공중교통수단</option><option>원료·제조물</option>
              </select></div>
            <div><label>발생일 *</label><input type="date" name="occurred_at" required max={t} defaultValue={t} /></div>
            <div><label>부서 *</label>
              <select name="dept_id" required defaultValue={myDept || ""}>
                <option value="" disabled>고르십시오</option>
                {R.depts.map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
              </select></div>
            <div><label>시설 번호</label>
              <input type="text" name="asset_id" list="rec-assets" /></div>
            <div><label>장소</label><input type="text" name="place" /></div>
            <div><label>사고 유형 *</label>
              <select name="accident_type" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                {ACCIDENT_TYPES.map((a) => <option key={a}>{a}</option>)}
              </select></div>
            <div className={s.span2}><label>내용 *</label><input type="text" name="summary" required /></div>
            <div><label>피해 *</label><input type="text" name="casualties" required placeholder="예: 부상 1명 / 없음" /></div>
            <div><label>담당 *</label><StaffPicker name="owner_staff_id" staff={staffOpts} defaultValue={defOwner} /></div>
            <div><label>조사 기한 *</label><input type="date" name="cause_due" required defaultValue={addDays(7, t)} /></div>
            <div><button className="btn" type="submit">사고 등록</button></div>
          </form>
        </details>
      )}
      <datalist id="rec-assets">
        {R.assetList.filter((a) => !myDept || a.dept === myDept).map((a) => <option key={a.id} value={`${a.id} ${a.name}`} />)}
      </datalist>

      {/* ── 2. 반기 무재해 확인 ───────────────────────────── */}
      <h2 id="nil">반기 무재해 확인</h2>
      <table className="v2t">
        <thead><tr>
          <th>부서</th>
          {periods.map((p, k) => <th key={p}>{halfLabel(p)}{k === 1 && " (진행)"}</th>)}
        </tr></thead>
        <tbody>
          {nil.map(({ dept, cells }) => (
            <tr key={dept.dept_id}>
              <td>{dept.dept_name}</td>
              {cells.map((c) => (
                <td key={c.period} title={c.check ? `${nm(c.check.confirmed_by)} · ${c.check.confirmed_at}` : ""}>
                  <span className={`badge ${NIL_TONE[c.state]}`}>
                    {c.state === "비어 있음" ? "미확인" : c.state === "재해 있음" ? `재해 ${c.incs.length}` : c.state === "확인과 맞지 않음" ? "불일치" : c.state}
                  </span>
                  {c.incs.length > 0 && c.incs.slice(0, 2).map((i) => (
                    <Link key={i.incident_id} href={`#${i.incident_id}`} style={{ marginLeft: 6 }}>{incNo(i.incident_id)}</Link>))}
                  {canWrite && c.state === "비어 있음" && (
                    <form action={confirmNil} className={s.nilForm}>
                      <Hidden />
                      <input type="hidden" name="period" value={c.period} />
                      <input type="hidden" name="dept_id" value={dept.dept_id} />
                      <select name="confirmed_by" required defaultValue={staffOpts.find((x) => x.dept_id === dept.dept_id)?.staff_id || ""}>
                        <option value="" disabled>확인자</option>
                        {staffOpts.filter((x) => x.dept_id === dept.dept_id || x.dept_id === "D01").map((x) =>
                          <option key={x.staff_id} value={x.staff_id}>{x.display_name}</option>)}
                      </select>
                      <button className="btn sm ghost" type="submit">없음 확인</button>
                    </form>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 3. 개선·시정명령 대장 ───────────────────────── */}
      <h2 id="ord-list">개선 · 시정명령</h2>
      <div className="chips">
        <Link className={`chip ${!on ? "on" : ""}`} href={q({ on: undefined }, "ord-list")}>행정처분 {ords.length - natureUnknown.length}</Link>
        {natureUnknown.length > 0 && (
          <Link className={`chip ${on === "unknown" ? "on" : ""}`} href={q({ on: "unknown" }, "ord-list")}>성격 미정 {natureUnknown.length}</Link>
        )}
        <Link className={`chip ${on === "advice" ? "on" : ""}`} href={q({ on: "advice" }, "ord-list")}>권고(참고) {advice.length}</Link>
        {on !== "advice" && <>
          <span className="muted" style={{ marginLeft: 10 }}>|</span>
          {[["open", `미종결 ${ordOpen.length}`], ["late", `넘김 ${ordLate.length}`], ["soon", `7일 안 ${ordSoon.length}`],
            ["done", `종결 ${ords.length - ordOpen.length}`], ["all", `전체 ${ords.length}`]].map(([k, l]) => (
            <Link key={k} className={`chip ${os === k ? "on" : ""}`} href={q({ os: k }, "ord-list")}>{l}</Link>
          ))}
          <span className="muted" style={{ marginLeft: 10 }}>|</span>
          <Link className={`chip ${!oa ? "on" : ""}`} href={q({ oa: undefined }, "ord-list")}>모두</Link>
          {ORD_AREAS.map((a) => (
            <Link key={a} className={`chip ${oa === a ? "on" : ""}`} href={q({ oa: a }, "ord-list")}>
              {ORD_AREA_LABEL[a]} {ords.filter((o) => areaOf(o) === a).length}
            </Link>
          ))}
          <Link className={`chip ${oa === "none" ? "on" : ""}`} href={q({ oa: "none" }, "ord-list")}>
            구분 전 {ords.filter((o) => !areaOf(o)).length}
          </Link>
        </>}
      </div>
      <table className="v2t">
        <thead><tr>
          <th>명령</th>
          <th>내용</th>
          <th>부서</th>
          <th className="dt">기한</th>
          <th>단계</th>
          <th>할 일</th>
        </tr></thead>
        <tbody>
          {ordPage.map((o) => <OrdRow key={o.order_id} o={o} />)}
          {!ordPage.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
        </tbody>
      </table>
      {!sp.oall && ordShown.length > LIMIT && <Link className="more" href={q({ oall: "1" }, "ord-list")}>전체 {ordShown.length}건 →</Link>}

      {canWrite && (
        <details className={`card ${s.newbox}`} id="ord-new">
          <summary><b>새 명령 접수</b></summary>
          <form action={addOrder} className={s.form}>
            <Hidden />
            <div><label>접수일 *</label><input type="date" name="received_at" required defaultValue={t} max={t} /></div>
            <div><label>문서 성격 *</label>
              <select name="doc_nature" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                {ORD_NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div><label>발령기관 *</label><input type="text" name="issuer" required placeholder="예: 용인소방서" /></div>
            <div><label>기관 구분 *</label>
              <select name="issuer_kind" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                <option>중앙행정기관</option><option>지방자치단체</option>
              </select></div>
            <div><label>재해 구분 *</label>
              <select name="order_area" required defaultValue="">
                <option value="" disabled>고르십시오</option>
                {ORD_AREAS.map((a) => <option key={a} value={a}>{ORD_AREA_LABEL[a]}</option>)}
              </select></div>
            <div><label>근거 법 *</label><input type="text" name="law" required /></div>
            <div><label>근거 조문</label><input type="text" name="law_article" placeholder="예: 제14조제1항" /></div>
            <div><label>공문 번호</label><input type="text" name="order_no" /></div>
            <div className={s.span2}><label>명령 내용 *</label><input type="text" name="content" required /></div>
            <div><label>이행 기한</label><input type="date" name="due_date" defaultValue={addDays(30, t)} /></div>
            <div><label>부서 *</label>
              <select name="dept_id" required defaultValue={myDept || ""}>
                <option value="" disabled>고르십시오</option>
                {R.depts.map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
              </select></div>
            <div><label>시설 번호</label><input type="text" name="asset_id" list="rec-assets" /></div>
            <div><label>장소</label><input type="text" name="place" /></div>
            <div><label>담당</label><StaffPicker name="owner_staff_id" staff={staffOpts} allowEmpty /></div>
            <div><button className="btn" type="submit">명령 접수</button></div>
          </form>
        </details>
      )}
    </UsLayout>
  );

  /* ── 사고 카드 ── */
  function IncCard({ i }: { i: IncView }) {
    const step = i.cur;
    return (
      <div className={`card ${s.inc} ${i.overdue ? s.incLate : ""}`} id={i.incident_id}>
        <div className={s.incHead}>
          <div className={s.badges}>
            <span className={s.no}>{incNo(i.incident_id)}</span>
            <span className={`badge ${CLASS_TONE[i.event_class] || ""}`}>{incClassLabel(i.event_class) || i.disaster_type}</span>
            {i.serious === "해당" && <span className="badge bad">중대재해</span>}
            {i.serious === "확인 필요" && <span className="badge warn">확인 필요</span>}
            {i.repeat.length > 0 && <span className="badge bad">재발 {i.repeat.length}회</span>}
          </div>
          <span className={`badge ${step === 5 ? "ok" : i.overdue ? "bad" : "none"}`}>
            {step === 5 ? "끝남" : `${i.curLabel}${i.due ? (i.overdue ? ` · D+${-i.daysLeft!}` : ` · D-${i.daysLeft}`) : ""}`}
          </span>
        </div>
        <div className={s.incTitle} title={i.summary}>{i.summary}</div>
        <div className="muted">
          {md(i.occurred_at)} · {deptName.get(i.dept_id) || i.dept_id}{i.asset_id ? ` · ${assetLabel(i.asset_id)}` : i.place ? ` · ${i.place}` : ""} · {nm(i.owner_staff_id) || "담당 없음"}
        </div>

        <ol className={s.steps}>
          {i.steps.map((st, k) => (
            <li key={st.label} className={`${st.done ? s.done : ""} ${k === step ? (i.overdue ? s.curLate : s.cur) : ""}`}
              title={[st.by && nm(st.by), st.evidence && `증빙 ${st.evidence}`, st.late && "기한 넘겨 끝냄"].filter(Boolean).join(" · ")}>
              <b>{st.label}</b>
              <span>{st.done ? md(st.date) : st.due ? md(st.due) : "—"}</span>
            </li>
          ))}
        </ol>

        {resp.get(i.incident_id)?.applies && (
          <ResponsePanel i={i} r={resp.get(i.incident_id)!} role={role} canWrite={canWrite} t={t}
            staffOpts={staffOpts} nm={nm} limitMin={setting.limitMin} hidden={respHidden} />
        )}

        {(i.cause || i.recurrence_plan || i.done_note || i.effect_note || i.repeat.length > 0 || i.asset_id) && (
          <details className={s.act}>
            <summary>기록 보기</summary>
            <dl className={s.dl}>
              {i.cause && <><dt>원인</dt><dd>{i.cause}</dd></>}
              {i.recurrence_plan && <><dt>대책</dt><dd>{i.recurrence_plan}</dd></>}
              {i.done_note && <><dt>이행</dt><dd>{i.done_note}</dd></>}
              {i.effect_note && <><dt>효과</dt><dd><span className={`badge ${i.effect_result === "유효" ? "ok" : "warn"}`}>{i.effect_result}</span> {i.effect_note}</dd></>}
              {i.steps.some((st) => st.evidence) && <><dt>증빙</dt><dd>{i.steps.filter((st) => st.evidence).map((st) => (
                <span key={st.label} style={{ marginRight: 10 }}>{st.label} <FileLink name={st.evidence} url={st.url} max={18} /></span>))}</dd></>}
              {i.repeat.length > 0 && <><dt>앞 사고</dt><dd>{i.repeat.map((x) => <Link key={x.incident_id} href={`#${x.incident_id}`} style={{ marginRight: 6 }}>{incNo(x.incident_id)}</Link>)}
                {i.repeatAfterEffect && <span className="badge bad">유효 판단 뒤 재발</span>}</dd></>}
              {i.related_order_id && <><dt>관련 명령</dt><dd><Link href={`#${i.related_order_id}`}>{ordNo(i.related_order_id)}</Link></dd></>}
            </dl>
            <PriorHazards i={i} r={resp.get(i.incident_id)} role={role} />
          </details>
        )}

        {canWrite && step < 5 && (
          <details className={s.act}>
            <summary>{step === 1 ? "원인 조사 기록" : step === 2 ? "대책 수립" : step === 3 ? "이행 완료" : "효과 확인"} →</summary>
            <form action={advanceIncident} className={s.stepForm}>
              <Hidden />
              <input type="hidden" name="incident_id" value={i.incident_id} />
              {step === 1 && <>
                <input type="hidden" name="step" value="cause" />
                <label>원인 *<input type="text" name="cause" required /></label>
                <FileAttach as="label" label="조사 기록 첨부 *" />
                <label>조사 기록 이름<input type="text" name="cause_evidence" placeholder="파일 없으면 이름만" /></label>
                <label>대책 기한 *<input type="date" name="plan_set_due" required defaultValue={addDays(14, t)} /></label>
              </>}
              {step === 2 && <>
                <input type="hidden" name="step" value="plan" />
                <label>대책 *<input type="text" name="recurrence_plan" required defaultValue={i.recurrence_plan || ""} /></label>
                <label>이행 기한 *<input type="date" name="plan_due" required defaultValue={i.plan_due || addDays(30, t)} /></label>
                <FileAttach as="label" label="대책 문서 첨부" />
                <label>대책 문서 이름<input type="text" name="plan_evidence" /></label>
              </>}
              {step === 3 && <>
                <input type="hidden" name="step" value="done" />
                <label>이행 내용 *<input type="text" name="done_note" required /></label>
                <FileAttach as="label" label="이행 증빙 첨부 *" />
                <label>이행 증빙 이름<input type="text" name="done_evidence" placeholder="파일 없으면 이름만" /></label>
                <label>효과 확인일 *<input type="date" name="effect_due" required defaultValue={addDays(60, t)} /></label>
              </>}
              {step === 4 && <>
                <input type="hidden" name="step" value="effect" />
                <label>효과 판단 *
                  <select name="effect_result" required defaultValue="">
                    <option value="" disabled>고르십시오</option>
                    <option>유효</option><option>재검토 필요</option>
                  </select></label>
                <label>판단 근거 *<input type="text" name="effect_note" required /></label>
                <FileAttach as="label" label="확인 기록 첨부" />
                <label>확인 기록 이름<input type="text" name="effect_evidence" /></label>
              </>}
              <button className="btn sm" type="submit">기록</button>
            </form>
          </details>
        )}
      </div>
    );
  }

  /* ── 명령 한 줄 ── */
  function OrdRow({ o }: { o: OrdView }) {
    const step = o.cur;
    const F = ({ st, children }: { st: string; children: React.ReactNode }) => (
      <form action={advanceOrder} className={s.stepForm}>
        <Hidden /><input type="hidden" name="order_id" value={o.order_id} /><input type="hidden" name="step" value={st} />
        {children}
      </form>
    );
    return (
      <tr id={o.order_id} className={o.overdue ? s.rowLate : undefined}>
        <td title={`${o.issuer} · ${o.issuer_kind || ""} · ${o.order_no || ""}`}><b>{ordNo(o.order_id)}</b> {o.issuer}</td>
        <td title={`${o.content} — ${o.law_article || o.law}`}>{o.content}</td>
        <td title={nm(o.owner_staff_id)}>{deptName.get(o.dept_id) || o.dept_id}</td>
        <td className="dt">{md(o.effDue)}
          {o.overdue && <> <span className="badge bad">D+{-o.daysLeft}</span></>}
          {o.soon && <> <span className="badge warn">D-{o.daysLeft}</span></>}</td>
        <td>{isAdvice(o) ? <span className="badge none">참고</span> : step === 5 ? "종결" : o.curLabel}</td>
        <td>
          {/* [캡처 v2] 처리 양식은 접기 — 줄 높이를 한 줄로 */}
          {!canWrite ? <span className="muted">—</span> : step === 5 ? <span className="badge ok">종결</span> : (
          <details className="fold"><summary>처리</summary>
                    {canWrite && !o.doc_nature && (
            <F st="nature">
              <select name="doc_nature" required defaultValue="" aria-label="문서 성격">
                <option value="" disabled>문서 성격</option>
                {ORD_NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="btn sm ghost" type="submit">저장</button>
            </F>
          )}
          {canWrite && o.doc_nature && !o.order_area && !isAdvice(o) && (
            <F st="area">
              <select name="order_area" required defaultValue="" aria-label="재해 구분">
                <option value="" disabled>재해 구분</option>
                {ORD_AREAS.map((a) => <option key={a} value={a}>{ORD_AREA_LABEL[a]}</option>)}
              </select>
              <button className="btn sm ghost" type="submit">저장</button>
            </F>
          )}
          {canWrite && !isAdvice(o) && step === 1 && (
            <F st="assign">
              <StaffPicker name="owner_staff_id" staff={staffOpts} />
              <button className="btn sm" type="submit">담당 지정</button>
            </F>
          )}
          {canWrite && !isAdvice(o) && step === 2 && !o.started_at && (
            <F st="start">
              <input type="text" name="action_plan" required placeholder="이행 계획 *" />
              <button className="btn sm" type="submit">착수</button>
            </F>
          )}
          {canWrite && !isAdvice(o) && step === 2 && o.started_at && (
            <>
              <F st="done">
                <input type="text" name="done_note" required placeholder="이행 내용 *" />
                <FileAttach as="bare" name="evidence_upload" label="증빙 파일 첨부" />
                <input type="text" name="evidence_file" placeholder="증빙 이름(파일 없을 때)" />
                <button className="btn sm" type="submit">이행 완료</button>
              </F>
              <details className={s.act}>
                <summary>기한 연장</summary>
                <F st="extend">
                  <input type="date" name="extended_due" required defaultValue={addDays(14, o.effDue || t)} />
                  <input type="text" name="extend_reason" required placeholder="연장 근거 *" />
                  <button className="btn sm ghost" type="submit">연장 기록</button>
                </F>
              </details>
            </>
          )}
          {canWrite && !isAdvice(o) && step === 3 && (
            <F st="report">
              <input type="date" name="reported_at" required defaultValue={t} max={t} />
              <FileAttach as="bare" name="evidence_upload" label="보고 문서 첨부" />
              <input type="text" name="report_evidence" placeholder="보고 문서 이름(파일 없을 때)" />
              <button className="btn sm" type="submit">보고 기록</button>
            </F>
          )}
          {canWrite && !isAdvice(o) && step === 4 && (
            <F st="close">
              <input type="date" name="closed_at" required defaultValue={t} max={t} />
              <input type="text" name="closed_note" required placeholder="확인 방법 *" />
              <button className="btn sm" type="submit">종결</button>
            </F>
          )}
          {canWrite && o.doc_nature && (
            <details className={s.act}>
              <summary>성격 바꾸기</summary>
              <F st="nature">
                <select name="doc_nature" required defaultValue={o.doc_nature || ""} aria-label="문서 성격">
                  {ORD_NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button className="btn sm ghost" type="submit">저장</button>
              </F>
            </details>
          )}
          </details>)}
        </td>
      </tr>
    );
  }
}
