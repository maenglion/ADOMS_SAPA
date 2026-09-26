// [400 · 교육자료 버전] 묶음 E — 원료·제조물 의무이행 ① 1)~3) · ② · ③ 화면 본문.
//   SCR-075·076(안전인력 확보) · SCR-077~079(예산 편성·집행) · SCR-080·081(재해예방업무처리 절차)
//   SCR-082·083(재발방지대책) · SCR-084·085(개선·시정 사항)
import { CheckAll } from "../../fc/_parts/client";   // 09-26 사용자: 불러오기 창 「전체 선택」(☐ 글자만 있고 동작하지 않았다)
import Link from "next/link";
import { EvHead, ExampleBox } from "@/components/us/Parts";
import { act, loadPlan, pickPerson } from "../actions";
import { BUDGET_ITEMS, budgetItemLabel, type Rec } from "../model";
import FilePick from "./FilePick";
import {
  type View, CtxHidden, RowMeta, ridOf, saveAct, addAct, delAct, EvCell, NilLine, PlanBtn, Modal, CRUMB_MT,
  BudgetGuide, Viewer, BtnRow, SaveBtn,
} from "./parts";

const d = (r: Rec | undefined, k: string) => String(r?.data?.[k] ?? "");
/** Enter 키가 첫 버튼(줄 추가 등)을 누르지 않게 — 폼 맨 앞의 보이지 않는 저장 버튼. */
const DefBtn = () => <button className="use-defbtn" formAction={saveAct} tabIndex={-1} aria-hidden="true">저장</button>;

/* ───────────── 1) 안전인력 확보 — SCR-075 · 076 ───────────── */
export async function StaffStep({ v, recs, people, plans }: {
  v: View; recs: Rec[]; people: any[]; plans: { plan_id: string; data: any }[];
}) {
  const rows = recs.filter((r) => r.block === "row");
  const list: (Rec | undefined)[] = rows.length ? rows : [undefined];
  const nameOf = (r?: Rec) => {
    const p = people.find((x) => x.staff_id === d(r, "staff_id"));
    return p ? p.display_name : d(r, "name");
  };
  return (
    <>
      <form action={saveAct} id="form">
        <DefBtn /><CtxHidden v={v} />
        <div className="use-wide"><table className="us-tbl use-tbl">
          <thead>
            <tr><th rowSpan={2}>직급</th><th rowSpan={2}>배치 일자</th><th colSpan={2}>인적사항</th><th rowSpan={2}>증빙자료</th><th rowSpan={2}>비고</th><th rowSpan={2} className="use-x"></th></tr>
            <tr><th>이름</th><th>소속(부서)</th></tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const rid = ridOf(r, `row~${i}`);
              return (
                <tr key={rid}>
                  <td>
                    <RowMeta rid={rid} block="row" />
                    <input type="text" name={`${rid}__rank`} defaultValue={d(r, "rank")} />
                    <button className="use-plus" formAction={addAct("row")} title="행 추가">+</button>
                  </td>
                  <td><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                  <td>
                    <div className="use-name">
                      <input type="text" name={`${rid}__name`} defaultValue={nameOf(r)} />
                      {r && <Link className="use-search" href={v.href(`&modal=person&row=${r.rec_id}`)} scroll={false}>🔍 검색</Link>}
                    </div>
                  </td>
                  <td><input type="text" name={`${rid}__dept`} defaultValue={d(r, "dept")} /></td>
                  <td><EvCell v={v} rid={rid} files={r?.files || []} variant="b" /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  <td className="c">{r ? <button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <BtnRow
          left={<><button className="use-bbtn" formAction={addAct("row")}>항목 추가</button><PlanBtn v={v} modal="plan" /></>}
          right={<SaveBtn />}
        />
      </form>
      <Viewer v={v} recs={recs} />
      <ExampleBox ordered items={[
        "해당 원료·제조물이 속한 시설의 안전관리 조직도",
        "해당 원료·제조물이 속한 시설의 공중이용시설 안전관리 인력현황표",
      ]} />

      {v.sp.modal === "plan" && (
        // 명세 SCR-076 원문은 원료·제조물 화면인데 브레드크럼·섹션 라벨이 「공중이용시설」로 적혀 있다.
        // 09-25 사용자: 명세 오기는 고친다 — 「원료·제조물」로.
        <Modal v={v} title="안전인력 확보 - 불러오기" crumb="계획·이행·점검   법 의무이행 조치   의무이행(원료·제조물)">
          <form action={loadPlan.bind(null, "staff")}>
            <CtxHidden v={v} />
            <div className="use-sec">예방계획(원료·제조물) - 안전인력 확보</div>
            <table className="us-tbl use-mtbl">
              <thead><tr><th className="use-chk"><CheckAll /></th><th>직급</th><th>이름</th><th>소속(부서)</th><th>연락처</th></tr></thead>
              <tbody>
                {plans.length ? plans.map((p) => {
                  const who = people.find((x) => x.staff_id === p.data.staff_id);
                  return (
                    <tr key={p.plan_id}>
                      <td className="c"><input type="checkbox" name="pick" value={p.plan_id} /></td>
                      <td>{p.data.rank}</td><td>{who?.display_name || p.data.name}</td><td>{who?.dept_name || p.data.dept}</td><td className="c">{p.data.tel}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={5}>검색결과가 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="use-mfoot"><button className="use-bbtn">불러오기</button></div>
          </form>
        </Modal>
      )}
      {v.sp.modal === "person" && v.sp.row && (
        // TODO: 확인 — 이름 칸 「검색」 창은 명세에 화면이 없다(SCR-075 「인사(직원) 검색 팝업 (추정)」)
        <Modal v={v} title="직원 검색" crumb={CRUMB_MT}>
          <form method="get" className="us-filter">
            <input type="hidden" name="role" value={v.role} /><input type="hidden" name="site" value={v.site.site_id} />
            <input type="hidden" name="modal" value="person" /><input type="hidden" name="row" value={v.sp.row} />
            <label>이름·부서 <input type="text" name="pq" defaultValue={v.sp.pq || ""} placeholder="이름 또는 부서명을 입력하세요" /></label>
            <button className="use-bbtn">🔍 검색</button>
          </form>
          <table className="us-tbl use-mtbl">
            <thead><tr><th>이름</th><th>소속(부서)</th><th>담당</th><th></th></tr></thead>
            <tbody>
              {people.filter((p) => !v.sp.pq || `${p.display_name} ${p.dept_name}`.includes(v.sp.pq)).map((p) => (
                <tr key={p.staff_id}>
                  <td>{p.display_name}</td><td>{p.dept_name}</td><td className="c">{p.duty_role}</td>
                  <td className="c">
                    <form action={pickPerson.bind(null, v.sp.row, p.staff_id)}><CtxHidden v={v} /><button className="us-btn-s">선택</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

/* ───────────── 2) 예산 편성·집행 — SCR-077 · 078 · 079 ───────────── */
export async function BudgetStep({ v, recs, plan }: {
  v: View; recs: Rec[]; plan: { out: Record<string, number>; rows: any[] };
}) {
  return (
    <>
      <form action={saveAct} id="form">
        <DefBtn /><CtxHidden v={v} />
        <div className="use-wide"><table className="us-tbl use-tbl use-budget">
          <thead>
            <tr>
              <th>예산 항목</th><th>편성액<br /><small>(천원)</small></th><th>집행 일자</th><th>집행 내역</th>
              <th><EvHead /></th><th>집행액</th><th>비고</th>
            </tr>
          </thead>
          {BUDGET_ITEMS.map((it) => {
            const item = recs.find((r) => r.block === "item" && r.data.item === it);
            const itemRid = ridOf(item, `item~${it}`);
            const execs = recs.filter((r) => r.block === "exec" && r.data.item === it);
            const lines: (Rec | undefined)[] = execs.length ? execs : [undefined];
            return (
              <tbody key={it} className="use-bgroup">
                {lines.map((r, i) => {
                  const rid = ridOf(r, `exec~${it}`);
                  return (
                    <tr key={rid}>
                      {i === 0 && (
                        <>
                          <td rowSpan={lines.length} className="use-bitem">
                            <RowMeta rid={itemRid} block="item" meta={{ item: it, plan: "0" }} />
                            <span className="use-box">{budgetItemLabel(it)}</span>
                            <button className="use-plus" formAction={addAct("exec", { item: it })} title="집행 내역 추가">+</button>
                          </td>
                          <td rowSpan={lines.length}>
                            <input type="number" min={0} name={`${itemRid}__plan`} defaultValue={d(item, "plan") || "0"} className="use-num" />
                          </td>
                        </>
                      )}
                      <td><RowMeta rid={rid} block="exec" meta={{ item: it, amount: "0" }} /><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                      <td><input type="text" name={`${rid}__text`} defaultValue={d(r, "text")} /></td>
                      <td><EvCell v={v} rid={rid} files={r?.files || []} variant="b" /></td>
                      <td><input type="number" min={0} name={`${rid}__amount`} defaultValue={d(r, "amount") || "0"} className="use-num" /></td>
                      {/* TODO: 확인 — 명세 SCR-077 비고 칸은 입력 위젯이 보이지 않는다(판독불확실). 적을 수 있게 두었다. */}
                      <td>
                        <div className="use-name">
                          <input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} />
                          {r && execs.length > 1 && <button className="use-ico" formAction={delAct(rid)} title="집행 줄 삭제">🗑</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table></div>
        <BtnRow left={<PlanBtn v={v} modal="plan" />} right={<SaveBtn />} />
      </form>
      <Viewer v={v} recs={recs} />
      <ExampleBox items={["필요한 예산에 대한 증빙자료(예산집행 결과를 알 수 있는 서류)"]} />
      <BudgetGuide />

      {v.sp.modal === "plan" && (
        // 09-25 사용자: 명세 오기 「예산·편성·집행」 → 「예산 편성·집행」
        <Modal v={v} title="중대시민재해 예방 예산 편성·집행 - 불러오기" crumb={CRUMB_MT}>
          <form action={loadPlan.bind(null, "budget")}>
            <CtxHidden v={v} />
            <div className="use-sec">안전보건관리체계(원료 및 제조물) - 안전예산 편성·집행<span>단위 : 천원</span></div>
            <table className="us-tbl use-mtbl">
              <thead><tr><th className="use-chk"><CheckAll /></th><th>안전점검비</th><th>보수·보강비</th><th>교육·훈련비</th><th>기타</th></tr></thead>
              <tbody>
                {plan.rows.length ? (
                  <tr>
                    <td className="c"><input type="checkbox" name="pick" value="plan" /></td>
                    {BUDGET_ITEMS.map((it) => <td key={it} className="n">{(plan.out[it] || 0).toLocaleString()}</td>)}
                  </tr>
                ) : <tr><td colSpan={5}>검색결과가 없습니다.</td></tr>}
              </tbody>
            </table>
            {plan.rows.length > 0 && (
              <p className="use-note">{v.site.dept_name} 2026년 원료·제조물 안전예산 편성 {plan.rows.length}건을 네 항목으로 모았다
                (점검 → 안전점검비 · 시설 → 보수·보강비 · 교육 → 교육·훈련비 · 그 밖 → 기타).</p>
            )}
            <div className="use-mfoot"><button className="use-bbtn">불러오기</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ───────────── 3) 재해예방업무처리 절차 — SCR-080 · 081 ───────────── */
function ProcCard({ v, rec, card, title }: { v: View; rec?: Rec; card: string; title: string }) {
  const rid = ridOf(rec, `card~${card}`);
  const pdf = (rec?.files || []).filter((f) => f.slot === "pdf").slice(-1)[0];
  const hwp = (rec?.files || []).filter((f) => f.slot === "hwp").slice(-1)[0];
  const all = rec?.files || [];
  const mode = d(rec, "mode");
  return (
    <form action={saveAct} className="use-pcard">
      <DefBtn /><CtxHidden v={v} />
      <RowMeta rid={rid} block={`card:${card}`} />
      <div className="use-pcard-h"><b>{title}</b><Link className="use-bbtn sm" href={v.href(`&modal=doc&card=${card}`)} scroll={false}>계획수립 내용 검색 및 추가</Link></div>
      <div className="use-pcard-sub">절차도</div>
      <div className="use-pline">
        <label className="use-radio"><input type="radio" name={`${rid}__mode`} value="작성일자" defaultChecked={mode === "작성일자"} /> 작성일자</label>
        <input type="date" name={`${rid}__wdate`} defaultValue={d(rec, "wdate")} className="use-date" />
      </div>
      <div className="use-pline">
        <label className="use-radio"><input type="radio" name={`${rid}__mode`} value="PDF" defaultChecked={mode === "PDF"} /> PDF</label>
        <span className={`us-ev-name${pdf ? "" : " empty"}`}>{pdf?.name || ""}</span>
        {pdf && rec ? <DelFile rid={rid} idx={all.indexOf(pdf)} /> : <span className="use-ico dim">🗑</span>}
        <FilePick name={`${rid}__file_pdf`} kind="btn" label="찾아보기" />
        <SaveBtn />
        {pdf?.url ? <a className="use-ico" href={pdf.url} download title="내려받기">⤓</a> : <span className="use-ico dim">⤓</span>}
      </div>
      <div className="use-pdfbox">
        <div className="use-pdfbox-h">PDF 뷰어</div>
        {pdf?.url ? <iframe className="use-pdf" src={pdf.url} title={pdf.name} />
          : <div className="use-pdfbox-b"><span className="us-ph">🖼</span>{pdf && <small>{pdf.name}</small>}</div>}
      </div>
      <div className="use-pline">
        <label className="use-radio"><input type="radio" name={`${rid}__mode`} value="HWP" defaultChecked={mode === "HWP"} /> HWP</label>
        <span className={`us-ev-name${hwp ? "" : " empty"}`}>{hwp?.name || ""}</span>
        <FilePick name={`${rid}__file_hwp`} kind="btn" label="찾아보기" />
        <SaveBtn />
      </div>
    </form>
  );
}
const DelFile = ({ rid, idx }: { rid: string; idx: number }) =>
  <button className="use-ico" formAction={act.bind(null, "delfile", `${rid}|${idx}`)} title="삭제">🗑</button>;

export async function ProcStep({ v, recs, plans, docs }: {
  v: View; recs: Rec[]; plans: { plan_id: string; data: any }[]; docs: { plan_id: string; data: any; card: string }[];
}) {
  const rows = recs.filter((r) => r.block === "row");
  const list: (Rec | undefined)[] = rows.length ? rows : [undefined];
  const card = v.sp.card === "response" ? "response" : "report";
  const CARD_T: Record<string, string> = { report: "유해 위험요인 발견 시 신고 및 개선", response: "중대시민재해 발생시 대응 조치" };
  return (
    <>
      <div className="use-sec2">유해 · 위험요인 확인 · 점검</div>
      <form action={saveAct} id="form">
        <DefBtn /><CtxHidden v={v} />
        <div className="use-wide"><table className="us-tbl use-tbl">
          <thead><tr><th>유해·위험 요인</th><th>확인사항</th><th>확인 일자</th><th>조치사항</th><th>조치일자</th><th><EvHead /></th><th>비고</th><th className="use-x"></th></tr></thead>
          <tbody>
            {list.map((r, i) => {
              const rid = ridOf(r, `row~${i}`);
              return (
                <tr key={rid}>
                  <td><RowMeta rid={rid} block="row" /><input type="text" name={`${rid}__hz`} defaultValue={d(r, "hz")} /></td>
                  <td><input type="text" name={`${rid}__check`} defaultValue={d(r, "check")} /></td>
                  <td><input type="date" name={`${rid}__cdate`} defaultValue={d(r, "cdate")} /></td>
                  <td><input type="text" name={`${rid}__act`} defaultValue={d(r, "act")} /></td>
                  <td><input type="date" name={`${rid}__adate`} defaultValue={d(r, "adate")} /></td>
                  <td><EvCell v={v} rid={rid} files={r?.files || []} /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  <td className="c">{r ? <button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <BtnRow
          left={<><button className="use-bbtn" formAction={addAct("row")}>점검 항목 추가</button><PlanBtn v={v} modal="plan" /></>}
          right={<SaveBtn />}
        />
      </form>
      <Viewer v={v} recs={recs.filter((r) => r.block === "row")} />
      {/* 명세 SCR-080 원문 — 예산 화면의 안내 문구가 그대로 들어가 있다(원문 그대로) */}
      <ExampleBox items={["필요한 예산에 대한 증빙자료(예산집행 결과를 알 수 있는 서류)"]} />

      <div className="use-pcards" id="cards">
        <ProcCard v={v} rec={recs.find((r) => r.block === "card:report")} card="report" title={CARD_T.report} />
        <ProcCard v={v} rec={recs.find((r) => r.block === "card:response")} card="response" title={CARD_T.response} />
      </div>

      {v.sp.modal === "plan" && (
        // TODO: 확인 — SCR-080 의 불러오기 창은 명세에 화면이 없다(SCR-072·078 과 같은 모양으로 추정)
        <Modal v={v} title="재해예방업무처리 절차 마련·이행 - 불러오기" crumb={CRUMB_MT}>
          <form action={loadPlan.bind(null, "hazard")}>
            <CtxHidden v={v} />
            <div className="use-sec">안전보건관리체계(원료 및 제조물) - 유해·위험요인 확인·점검</div>
            <table className="us-tbl use-mtbl">
              <thead><tr><th className="use-chk"><CheckAll /></th><th>유해·위험 요인</th><th>확인사항</th></tr></thead>
              <tbody>
                {plans.length ? plans.map((p) => (
                  <tr key={p.plan_id}><td className="c"><input type="checkbox" name="pick" value={p.plan_id} /></td><td>{p.data.hz}</td><td>{p.data.check}</td></tr>
                )) : <tr><td colSpan={3}>검색결과가 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="use-mfoot"><button className="use-bbtn">불러오기</button></div>
          </form>
        </Modal>
      )}
      {v.sp.modal === "doc" && (
        // TODO: 확인 — SCR-081 「계획수립 내용 검색 및 추가」 창은 명세에 화면이 없다(추정)
        <Modal v={v} title={`${CARD_T[card]} - 불러오기`} crumb={CRUMB_MT}>
          <form action={loadPlan.bind(null, `doc:${card}`)}>
            <CtxHidden v={v} />
            <div className="use-sec">안전보건관리체계(원료 및 제조물) - 재해예방업무처리 절차 · 절차도</div>
            <table className="us-tbl use-mtbl">
              <thead><tr><th className="use-chk"><CheckAll /></th><th>절차도</th><th>작성일자</th><th>파일</th></tr></thead>
              <tbody>
                {docs.filter((x) => x.card === card).length ? docs.filter((x) => x.card === card).map((p) => (
                  <tr key={p.plan_id}>
                    <td className="c"><input type="radio" name="pick" value={p.plan_id} /></td>
                    <td>{p.data.title}</td><td className="c">{p.data.wdate}</td><td>{p.data.file}</td>
                  </tr>
                )) : <tr><td colSpan={4}>검색결과가 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="use-mfoot"><button className="use-bbtn">불러오기</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ───────────── ② 재발방지대책 — SCR-082 · 083 ───────────── */
export async function RecurStep({ v, recs }: { v: View; recs: Rec[] }) {
  const nil = recs.find((r) => r.block === "nil");
  const nilRid = ridOf(nil, "nil");
  const cards = recs.filter((r) => r.block === "card");
  const list: (Rec | undefined)[] = cards.length ? cards : [undefined];
  return (
    <>
      <form action={saveAct} id="form" className="use-nilwrap">
        <DefBtn /><CtxHidden v={v} />
        {/* 09-25 사용자: 명세 오기(산업재해 문구) → 이 화면은 중대시민재해 */}
        <NilLine rid={nilRid} checked={d(nil, "nil") === "Y"} text="중대시민재해 발생 이력이 없을 경우 체크하여 저장" />
        <div className="use-hide">
          {list.map((r, i) => {
            const rid = ridOf(r, `card~${i}`);
            const fs = r?.files || [];
            return (
              <div className="use-dcard" key={rid}>
                <RowMeta rid={rid} block="card" />
                <div className="use-dcard-h">
                  <label>발생재해명 <input type="text" name={`${rid}__name`} defaultValue={d(r, "name")} /></label>
                  <label>재해발생일 <input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></label>
                </div>
                <table className="us-tbl use-tbl">
                  <thead><tr><th>구분</th><th>이행 일자</th><th>이행 내역</th><th><EvHead /></th><th>비고</th></tr></thead>
                  <tbody>
                    {([["1", "1. 상황보고서"], ["2", "2. 재발방지계획서"]] as const).map(([n, lab]) => (
                      <tr key={n}>
                        <td className="c">{lab}</td>
                        <td><input type="date" name={`${rid}__r${n}date`} defaultValue={d(r, `r${n}date`)} /></td>
                        <td><input type="text" name={`${rid}__r${n}text`} defaultValue={d(r, `r${n}text`)} /></td>
                        <td><EvCell v={v} rid={rid} files={fs} slot={`f${n}`} /></td>
                        <td><input type="text" name={`${rid}__r${n}note`} defaultValue={d(r, `r${n}note`)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="use-dcard-f">{r && <button className="use-del" formAction={delAct(rid)}>삭제</button>}</div>
              </div>
            );
          })}
        </div>
        <BtnRow left={<span className="use-hide"><button className="use-bbtn" formAction={addAct("card")}>재해 추가</button></span>} right={<SaveBtn />} />
      </form>
      <div className="us-example">
        <div className="us-example-h">필수 내역</div>
        {/* 09-25 사용자: 명세 오기 「재발방지보고서」 → 표 줄 이름 「재발방지계획서」와 맞춘다 */}
        <p className="use-p">1. 상황보고서, 2. 재발방지계획서</p>
        <div className="us-example-h">증빙자료 예시</div>
        <p className="use-p">발생한재해 재발방지계획서(사업장 개요, 재해발생 원인분석 및 재발방지 대책(단기적 대책, 장기적 대책))</p>
      </div>
    </>
  );
}

/* ───────────── ③ 개선·시정 사항 — SCR-084 · 085 ───────────── */
export async function OrderStep({ v, recs }: { v: View; recs: Rec[] }) {
  const nil = recs.find((r) => r.block === "nil");
  const nilRid = ridOf(nil, "nil");
  const rows = recs.filter((r) => r.block === "row");
  const list: (Rec | undefined)[] = rows.length ? rows : [undefined];
  return (
    <>
      <form action={saveAct} id="form" className="use-nilwrap">
        <DefBtn /><CtxHidden v={v} />
        <NilLine rid={nilRid} checked={d(nil, "nil") === "Y"} text="중앙행정기관, 지자체 개선·시정 사항이 없을 경우 체크하여 저장" />
        <div className="use-hide">
          <table className="us-tbl use-tbl">
            <thead><tr>
              <th>개선·시정 사항</th><th>개선·시정<br />요구기관</th><th>행정처분 일자</th><th>개선·시정 사항<br />이행 내역</th><th>조치기간</th><th><EvHead /></th><th>비고</th><th className="use-x"></th>
            </tr></thead>
            <tbody>
              {list.map((r, i) => {
                const rid = ridOf(r, `row~${i}`);
                return (
                  <tr key={rid}>
                    <td><RowMeta rid={rid} block="row" /><input type="text" name={`${rid}__item`} defaultValue={d(r, "item")} /></td>
                    <td><input type="text" name={`${rid}__org`} defaultValue={d(r, "org")} /></td>
                    <td><input type="date" name={`${rid}__pdate`} defaultValue={d(r, "pdate")} /></td>
                    <td><input type="text" name={`${rid}__text`} defaultValue={d(r, "text")} /></td>
                    <td className="use-period">
                      <input type="date" name={`${rid}__dfrom`} defaultValue={d(r, "dfrom")} />
                      <span>~</span>
                      <input type="date" name={`${rid}__dto`} defaultValue={d(r, "dto")} />
                    </td>
                    <td><EvCell v={v} rid={rid} files={r?.files || []} /></td>
                    <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                    <td className="c">{r ? <button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* TODO: 확인 — SCR-085 은 체크 시 「저장」까지 가리지만, 체크 상태를 저장하려면 저장 버튼이 있어야 한다(SCR-083 과 같게 둔다) */}
        <BtnRow left={<span className="use-hide"><button className="use-bbtn" formAction={addAct("row")}>개선 시정사항 추가</button></span>} right={<SaveBtn />} />
      </form>
      <ExampleBox ordered items={[
        "중앙행정기관, 지자체 개선·시정 사항 행정처분 공문",
        "중앙행정기관, 지자체 행정처분에 대한 조치계획서, 이행내역 결과서 등",
      ]} />
      <BudgetGuide />
    </>
  );
}
