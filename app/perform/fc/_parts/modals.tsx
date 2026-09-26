/**
 * [400 · 교육자료 버전] 묶음 D — 팝업(주소 쿼리 ?modal=… 로 여닫는 서버 화면).
 *  staff    직원 검색(SCR-057 🔍 검색 — 추정)
 *  plan     안전계획 수립·이행 수행 - 불러오기(SCR-062) ← 우리 안전계획(civil_safety_plan)
 *  hazard   재해예방업무처리 절차 마련 · 이행 - 불러오기(SCR-063) ← 유해·위험요인 신고·조치 대장(hazard_report)
 *  drill    재해예방업무처리 절차 마련 · 이행 - 불러오기(SCR-064) ← 비상대피훈련 계획(drill_plan)
 *  flow     절차도 불러오기(SCR-065 — 추정) ← 업무처리절차·매뉴얼 대장(civil_manual)
 *  lawsearch 법령 검색(SCR-071·073) ← 우리 의무 목록(duties area F)
 *  lawload  관계 법령 의무이행 조치 - 불러오기(SCR-072·074) ← 이 대상의 점검(블록A)·교육(블록B) 의무
 */
import Link from "next/link";
import { readTable, staff, duties, foldByUnit, assetMapSeed, type Row } from "@/lib/data";
import { importRows, pickStaff, saveBlock } from "../actions";
import { CheckAll } from "./client";
import { Modal, type Ctx } from "./ui";
import { dutiesFor, dutyText, joHang, markLabel } from "../_lib/model";
import { LawContent } from "./s3";

/** 팝업 폼 공통 숨은 칸. */
function Hidden({ ctx, block, replace }: { ctx: Ctx; block: string; replace?: boolean }) {
  return (
    <>
      <input type="hidden" name="role" value={ctx.role} />
      <input type="hidden" name="scope" value={ctx.t.id} />
      <input type="hidden" name="dept" value={ctx.dept} />
      <input type="hidden" name="step" value={ctx.step} />
      <input type="hidden" name="block" value={block} />
      <input type="hidden" name="back" value={ctx.back} />
      {replace && <input type="hidden" name="replace" value="Y" />}
    </>
  );
}
const J = (o: Record<string, any>) => JSON.stringify(o);
const day = (s: string) => String(s || "").slice(0, 10);
const Empty = ({ n }: { n: number }) => <tr><td colSpan={n} className="usd-empty">검색결과가 없습니다.</td></tr>;

/** 불러오기 공통 틀 — 제목 · 패널 제목 · 표 · 우하단 「불러오기」. */
function LoadModal({ ctx, title, panel, block, head, children, replace, wide }: {
  ctx: Ctx; title: string; panel: string; block: string; head: React.ReactNode; children: React.ReactNode; replace?: boolean; wide?: boolean;
}) {
  return (
    <Modal ctx={ctx} title={title} wide={wide}>
      <div className="usd-mtitle">{title}</div>
      <form action={importRows}>
        <Hidden ctx={ctx} block={block} replace={replace} />
        <div className="usd-mpanel">
          <div className="usd-mpanel-h">{panel}</div>
          <table className="us-tbl usd-mtbl">{head}<tbody>{children}</tbody></table>
        </div>
        <div className="usd-mfoot"><button className="usd-b us-btn">불러오기</button></div>
      </form>
    </Modal>
  );
}

export async function Modals({ ctx }: { ctx: Ctx }) {
  const m = ctx.sp.modal;
  if (!m) return null;
  const P = "예방계획(공중이용시설·공중교통수단)";

  if (m === "staff") {
    const q = (ctx.sp.q || "").trim();
    const deps = new Map((await readTable("org_dept", "dept_id")).map((d) => [d.dept_id, d.dept_name]));
    const list = (await staff()).filter((s: Row) => s.staff_id !== "CEO-1")
      .map((s: Row) => ({ ...s, dept_name: deps.get(s.dept_id) || "" }))
      .filter((s: Row) => !q || `${s.display_name} ${s.dept_name} ${s.duty_role}`.includes(q))
      .sort((a: Row, b: Row) => (a.dept_id === ctx.dept ? 0 : 1) - (b.dept_id === ctx.dept ? 0 : 1));
    return (
      <Modal ctx={ctx} title="직원 검색" crumb={false}>
        <form method="get" action={ctx.href({})} className="usd-msearch">
          {Object.entries({ ...ctx.sp, q: undefined, msg: undefined }).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          <label>이름·부서 <input name="q" defaultValue={q} placeholder="이름 또는 부서를 입력하세요" /></label>
          <button className="usd-sbtn">🔍 검색</button>
        </form>
        <form action={pickStaff}>
          <Hidden ctx={ctx} block="people" />
          <input type="hidden" name="rid" value={ctx.sp.rid || ""} />
          <table className="us-tbl usd-mtbl">
            <thead><tr><th>이름</th><th>소속(부서)</th><th>역할</th><th /></tr></thead>
            <tbody>
              {list.length === 0 && <Empty n={4} />}
              {list.map((s: Row) => {
                const name = String(s.display_name || "").split(" ")[0];
                return (
                  <tr key={s.staff_id}>
                    <td>{s.display_name}</td><td>{s.dept_name}</td><td>{s.duty_role}</td>
                    <td className="c"><button className="us-btn-s" name="who" value={`${name}|${s.dept_name}`}>선택</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </form>
      </Modal>
    );
  }

  if (m === "plan") {
    const all = await readTable("civil_safety_plan", "plan_id");
    let rows = all.filter((r) => r.asset_id === ctx.t.id);
    if (!rows.length) rows = all.filter((r) => r.dept_id === ctx.dept).slice(0, 40);
    rows.sort((a, b) => String(b.plan_year).localeCompare(String(a.plan_year)));
    return (
      <LoadModal ctx={ctx} title="안전계획 수립·이행 수행 - 불러오기" panel={`${P} - 안전계획 수립·이행 수행`} block="plan"
        head={<thead><tr><th className="usd-ck"><CheckAll /></th><th>구분</th><th>수립시기</th><th>비고</th></tr></thead>}>
        {rows.length === 0 && <Empty n={4} />}
        {rows.map((r) => {
          const item = `${r.plan_year}년 ${r.facility_name} 안전계획(${r.plan_basis})`;
          const note = `계획 ${r.items_planned || 0}건 · 이행 ${r.items_done || 0}건${r.ceo_confirmed === "Y" ? " · 경영책임자 확인" : ""}`;
          return (
            <tr key={r.plan_id}>
              <td className="c"><input type="checkbox" name="pick" value={J({ item, date: "", text: note, note: "" })} /></td>
              <td>{item}</td><td className="c">{day(r.established_at)}</td><td>{note}</td>
            </tr>
          );
        })}
      </LoadModal>
    );
  }

  if (m === "hazard") {
    const all = await readTable("hazard_report", "hz_id");
    let rows = all.filter((r) => r.asset_id === ctx.t.id);
    if (!rows.length) rows = all.filter((r) => r.dept_id === ctx.dept);
    return (
      <LoadModal ctx={ctx} title="재해예방업무처리 절차 마련 · 이행 - 불러오기" panel={`${P} - 유해·위험요인 확인·점검`} block="hazard"
        head={<thead><tr><th className="usd-ck"><CheckAll /></th><th>구분</th><th>수립시기</th><th>비고</th></tr></thead>}>
        {rows.length === 0 && <Empty n={4} />}
        {rows.map((r) => {
          const act = r.minor_action || r.protect_action || "";
          return (
            <tr key={r.hz_id}>
              <td className="c"><input type="checkbox" name="pick" value={J({ hz: r.description, check: `${r.location} — ${r.channel}`, cdate: day(r.received_at), act, adate: day(r.closed_at || r.done_at), note: r.hz_id })} /></td>
              <td>{r.asset_name} · {r.location} — {r.description}</td><td className="c">{day(r.received_at)}</td><td>{act}</td>
            </tr>
          );
        })}
      </LoadModal>
    );
  }

  if (m === "drill") {
    const all = await readTable("drill_plan", "drill_id");
    let rows = all.filter((r) => r.target_key === ctx.t.id);
    if (!rows.length) rows = all.filter((r) => r.dept_id === ctx.dept);
    return (
      <LoadModal ctx={ctx} title="재해예방업무처리 절차 마련 · 이행 - 불러오기" panel={`${P} - 재해예방업무처리 절차 마련 · 이행`} block="drill"
        head={<thead>
          <tr><th rowSpan={2} className="usd-ck"><CheckAll /></th><th rowSpan={2}>훈련대상</th><th colSpan={2}>훈련시기</th><th rowSpan={2}>훈련방법</th></tr>
          <tr><th>주기</th><th>추진시기</th></tr>
        </thead>}>
        {rows.length === 0 && <Empty n={5} />}
        {rows.map((r) => {
          const text = r.status === "평가 완료" || r.done_at
            ? `${r.method || ""} 훈련 · 참가 ${r.participants || "-"}명 · 목표 ${r.target_minutes || "-"}분 / 실제 ${r.actual_minutes || "-"}분`
            : `${r.status || "계획"} — ${r.scenario || ""}`;
          return (
            <tr key={r.drill_id}>
              <td className="c"><input type="checkbox" name="pick" value={J({ name: `${r.target_name} ${r.drill_type} 대피훈련`, date: day(r.done_at), text, note: r.drill_id })} /></td>
              <td>{r.target_name}</td><td className="c">{r.year}년 {r.half}(반기 1회)</td><td className="c">{r.planned_at}</td><td>{r.drill_type} · {r.method}</td>
            </tr>
          );
        })}
      </LoadModal>
    );
  }

  if (m === "flow") {
    const block = ctx.sp.rid === "flow2" ? "flow2" : "flow1";
    const title = block === "flow1" ? "유해 위험요인 발견 시 신고 및 개선" : "중대시민재해 발생시 대응 조치";
    const rows = (await readTable("civil_manual", "manual_id")).filter((r) => ["업무처리절차", "매뉴얼"].includes(r.record_kind));
    // TODO: 확인 — 명세 SCR-065 는 「계획수립 내용 검색 및 추가」가 무엇을 불러오는지 적혀 있지 않다(추정: 절차도 마스터)
    return (
      <Modal ctx={ctx} title={`${title} — 절차도 불러오기`}>
        <div className="usd-mtitle">{title} — 절차도 불러오기</div>
        <form action={importRows}>
          <Hidden ctx={ctx} block={block} replace />
          <div className="usd-mpanel">
            <div className="usd-mpanel-h">{P} - 재해예방업무처리 절차 마련 · 이행</div>
            <table className="us-tbl usd-mtbl">
              <thead><tr><th className="usd-ck">선택</th><th>구분</th><th>제목</th><th>제정일</th><th>개정일</th></tr></thead>
              <tbody>
                {rows.length === 0 && <Empty n={5} />}
                {rows.map((r) => (
                  <tr key={r.manual_id}>
                    <td className="c"><input type="radio" name="pick" value={J({ date: r.revised_at || r.enacted_at, doc: r.title })} /></td>
                    <td className="c">{r.record_kind}</td><td>{r.title}</td><td className="c">{r.enacted_at}</td><td className="c">{r.revised_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="usd-mfoot"><button className="usd-b us-btn">불러오기</button></div>
        </form>
      </Modal>
    );
  }

  if (m === "lawsearch") {
    const blk = ctx.sp.rid === "B" ? "B" : "A";
    const block = blk === "B" ? "lawB" : "lawA";
    const lk = (ctx.sp.lk || "").trim(), ln = (ctx.sp.ln || "").trim(), lq = (ctx.sp.lq || "").trim();
    const wide = ctx.sp.lw === "1";
    const codes = new Set(ctx.t.targets);
    let rows = await duties({ area: "F", limit: 20000 });
    if (!wide) rows = rows.filter((d) => codes.has(d.target_code) || d.target_code === "TG24");
    if (blk === "B" && !lq) rows = rows.filter((d) => d.impl_type === "T03");
    if (lk) rows = rows.filter((d) => `${d.layer} ${d.target_name}`.includes(lk));
    if (ln) rows = rows.filter((d) => `${d.law} ${d.doc}`.includes(ln));
    if (lq) rows = rows.filter((d) => `${d.duty_name} ${d.article_title} ${d.source_text}`.includes(lq));
    rows = foldByUnit(rows);
    const shown = rows.slice(0, 100);
    const keep = { ...ctx.sp, lk: undefined, ln: undefined, lq: undefined, lw: undefined, msg: undefined };
    return (
      <Modal ctx={ctx} title="법령 검색" crumb={false} wide>
        <form method="get" action={ctx.href({})} className="usd-msearch">
          {Object.entries(keep).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          <label>법령 구분 <input name="lk" defaultValue={lk} placeholder="법령 구분을 입력하세요" /></label>
          <label>법령명 <input name="ln" defaultValue={ln} placeholder="법령명을 입력하세요" /></label>
          <label>요약내용 <input name="lq" defaultValue={lq} placeholder="요약내용을 입력하세요" /></label>
          <label className="usd-mini"><input type="checkbox" name="lw" value="1" defaultChecked={wide} /> 다른 관리대상 포함</label>
          <button className="usd-sbtn">🔍 검색</button>
        </form>
        <div className="usd-mcount">총 {rows.length.toLocaleString()}건{rows.length > shown.length ? ` (앞 ${shown.length}건 표시 — 검색어로 좁히세요)` : ""}</div>
        <form action={importRows}>
          <Hidden ctx={ctx} block={block} />
          <table className="us-tbl usd-mtbl usd-rowpick">
            <thead><tr><th>구분</th><th>법령구분</th><th>법령명</th><th>요약내용</th><th>조</th><th>항</th></tr></thead>
            <tbody>
              {shown.length === 0 && <Empty n={6} />}
              {shown.map((d) => {
                const { jo, hang } = joHang(d.unit_label_ko);
                const t = dutyText(d);
                return (
                  <tr key={d.duty_key}>
                    <td>{d.target_name}<br /><span className={`usd-mark ${d.yongin_mark === "Y" ? "y" : "c"}`}>{markLabel(d.yongin_mark)}</span></td>
                    <td className="c">{d.layer}</td>
                    <td>{d.doc || d.law}</td>
                    <td><button className="usd-linkbtn" name="one" value={J({ duty_key: d.duty_key })} title="이 의무를 표에 더합니다">{t.name || t.art}</button></td>
                    <td className="c">{jo}</td><td className="c">{hang}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </form>
        <form action={saveBlock} className="usd-mfoot">
          <Hidden ctx={ctx} block={block} />
          <span className="usd-muted">요약내용을 누르면 표에 더해집니다. 목록에 없는 법령은</span>
          <button className="usd-b us-btn" name="intent" value="add">직접 입력(빈 행 추가)</button>
        </form>
      </Modal>
    );
  }

  if (m === "lawload") {
    const blk = ctx.sp.rid === "B" ? "B" : "A";
    const block = blk === "B" ? "lawB" : "lawA";
    const list = await dutiesFor(ctx.t, { impl: blk === "B" ? "T03" : "T04", commonToo: blk === "B" });
    // 점검대상(개소) — 이 부서 시설 중 그 관리대상 유형에 걸리는 수(우리 자산 대장에서 센다)
    const deptIds = new Set(ctx.all.filter((t) => t.dept_id === ctx.dept).map((t) => t.id));
    const cnt = new Map<string, number>();
    for (const mm of assetMapSeed()) if (deptIds.has(mm.asset_id)) cnt.set(mm.target_code, (cnt.get(mm.target_code) || 0) + 1);
    const insp = ctx.recs.filter((r) => r.step === "inspect" && r.scope === ctx.t.id).map((r) => r.data.date).filter(Boolean).sort();
    // 블록B 는 명세 원문도 「안전점검 계획 수립·수행」이지만 여기서 불러오는 것은 교육 의무라 이름을 맞췄다(결과 문서에 기록)
    return (
      <LoadModal ctx={ctx} wide title="관계 법령 의무이행 조치 - 불러오기"
        panel={`${P} - ${blk === "B" ? "관계 법령상 법정교육 이수" : "안전점검 계획 수립·수행"}`} block={block}
        head={<thead>
          <tr><th rowSpan={2} className="usd-ck"><CheckAll /></th><th rowSpan={2}>구분</th><th rowSpan={2}>법령명/법조항/법령 내용<br /><small className="usd-blue">※내용을 클릭하시면 자세히 볼 수 있습니다.</small></th>
            <th colSpan={2}>{blk === "B" ? "교육주기" : "점검주기"}</th><th rowSpan={2}>{blk === "B" ? "교육대상" : "점검대상"}<br /><small>(개소)</small></th><th rowSpan={2}>{blk === "B" ? "교육시기" : "점검시기"}</th><th rowSpan={2}>{blk === "B" ? "교육비용" : "점검비용"}<br /><small>(천원)</small></th><th rowSpan={2}>{blk === "B" ? "교육기관" : "점검기관"}</th></tr>
          <tr><th>주기</th><th>횟수</th></tr>
        </thead>}>
        {list.length === 0 && <Empty n={9} />}
        {list.slice(0, 150).map((d) => (
          <tr key={d.duty_key}>
            <td className="c"><input type="checkbox" name="pick" value={J({ duty_key: d.duty_key })} /></td>
            <td>{d.target_name}<br /><span className={`usd-mark ${d.yongin_mark === "Y" ? "y" : "c"}`}>{markLabel(d.yongin_mark)}</span></td>
            <td><b>{d.doc || d.law}</b><LawContent d={d} /></td>
            <td className="c">{d.cycle_text || "-"}</td>
            <td className="c">{/매월/.test(d.cycle_text) ? "연 12회" : /반기/.test(d.cycle_text) ? "연 2회" : /분기/.test(d.cycle_text) ? "연 4회" : /연\s*1회|매년/.test(d.cycle_text) ? "연 1회" : "-"}</td>
            <td className="c">{d.target_code === "TG24" ? "기관 전체" : (cnt.get(d.target_code) || 0).toLocaleString()}</td>
            <td className="c">{blk === "A" && insp.length ? insp[insp.length - 1] : "-"}</td>
            <td className="c">-</td>
            <td className="c">{ctx.deptName}</td>
          </tr>
        ))}
      </LoadModal>
    );
  }
  return null;
}
