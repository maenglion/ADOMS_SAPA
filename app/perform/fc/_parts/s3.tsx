/**
 * [400 · 교육자료 버전] 묶음 D — ④ 관계 법령 의무이행 조치(SCR-070~074 기본 상태).
 * 표는 **우리 의무 목록**(duties area F — 이 대상의 관리대상 유형에 걸리는 것)으로 채운다.
 *   블록A 관계 법령상 의무이행 = 관리대상 유형의 의무(용인 확정 · 조건부 표시)
 *   블록B 관계 법령상 법정교육 이수 = 그중 이행 유형 「교육·훈련」(T03) + 기관 전체(모든 시설 공통)의 교육 의무
 * 조치 일자·증빙·비고를 적으면 그 의무의 기록(usd_record, data.duty_key)이 생긴다.
 */
import Link from "next/link";
import { ExampleBox, EvHead } from "@/components/us/Parts";
import { duties, type Row } from "@/lib/data";
import { BlockForm, RowId, In, Ev, Del, Btn, AddBtn, Viewer, viewerPick, type Ctx } from "./ui";
import { dutiesFor, dutyText, markLabel, type Rec } from "../_lib/model";

const PER_A = 20;
const PER_B = 10;

/** 의무 줄과 기록 줄을 겹친다 — 기록 있는 줄이 위로. 목록에 없는 기록(법령 검색으로 더한 것·직접 입력)도 보인다. */
function merge(list: Row[], recs: Rec[], byKey: Map<string, Row>) {
  const recOf = new Map<string, Rec>();
  const extra: Rec[] = [];
  const keys = new Set(list.map((d) => d.duty_key));
  for (const r of recs) {
    const k = r.data.duty_key;
    if (k && keys.has(k) && !recOf.has(k)) recOf.set(k, r);
    else extra.push(r);
  }
  const lines = list.map((d) => ({ d, rec: recOf.get(d.duty_key) || null }));
  lines.sort((a, b) => (a.rec ? 0 : 1) - (b.rec ? 0 : 1));
  const ex = extra.map((r) => ({ d: r.data.duty_key ? byKey.get(r.data.duty_key) || null : null, rec: r as Rec | null }));
  return [...ex, ...lines];
}

function Pager({ ctx, n, per, param, cur }: { ctx: Ctx; n: number; per: number; param: string; cur: number }) {
  const pages = Math.max(1, Math.ceil(n / per));
  if (pages <= 1) return null;
  const win = [...Array(pages).keys()].map((i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 3);
  return (
    <div className="usd-pager">
      {win.map((p, i) => (
        <span key={p}>
          {i > 0 && win[i - 1] !== p - 1 ? <span className="usd-gap">…</span> : null}
          <Link href={`${ctx.href({ [param]: String(p) })}#${param === "pa" ? "lawA" : "lawB"}`} className={p === cur ? "on" : ""}>{p}</Link>
        </span>
      ))}
    </div>
  );
}

export async function LawScreen({ ctx }: { ctx: Ctx }) {
  const mk = ctx.sp.mk || "";
  const common = ctx.sp.all === "1";
  const allF = await duties({ area: "F", limit: 20000 });
  const byKey = new Map(allF.map((d) => [d.duty_key, d]));
  const listA = await dutiesFor(ctx.t, { commonToo: common, mark: mk === "Y" ? "Y" : mk === "C" ? "조건부" : undefined });
  const fullA = mk || common ? await dutiesFor(ctx.t) : listA;
  const listB = await dutiesFor(ctx.t, { impl: "T03", commonToo: true });
  const recA = ctx.recs.filter((r) => r.step === "law" && r.block === "lawA" && r.scope === ctx.t.id);
  const recB = ctx.recs.filter((r) => r.step === "law" && r.block === "lawB" && r.scope === ctx.t.id);
  const linesA = merge(listA, recA, byKey);
  const linesB = merge(listB, recB, byKey);
  const pa = Math.max(1, Number(ctx.sp.pa) || 1);
  const pb = Math.max(1, Number(ctx.sp.pb) || 1);
  const showA = linesA.slice((pa - 1) * PER_A, pa * PER_A);
  const showB = linesB.slice((pb - 1) * PER_B, pb * PER_B);
  const nY = fullA.filter((d) => d.yongin_mark === "Y").length;
  const done = (recs: Rec[]) => recs.filter((r) => r.status === "이행완료").length;
  const pick = viewerPick(ctx, [...recA, ...recB]);
  const tgName = [...new Set(fullA.map((d) => d.target_name))].join(" · ");
  const chip = (label: string, o: Record<string, string | undefined>, on: boolean) =>
    <Link href={`${ctx.href({ ...o, pa: undefined })}#lawA`} className={`usd-chip${on ? " on" : ""}`}>{label}</Link>;

  return (
    <>
      <h3 className="usd-h3">관계 법령상 의무이행</h3>
      <div className="usd-lawbar">
        <span>
          이 대상({tgName || "관리대상 유형 없음"})에 걸리는 관계 법령 의무 <b>{fullA.length.toLocaleString()}</b>건
          (용인 확정 {nY.toLocaleString()} · 조건부 {(fullA.length - nY).toLocaleString()}) · 조치 기록 <b>{recA.length}</b>건(증빙 첨부 {done(recA)})
        </span>
        <span className="usd-chips">
          {chip("전체", { mk: undefined }, !mk)}{chip("용인 확정", { mk: "Y" }, mk === "Y")}{chip("조건부", { mk: "C" }, mk === "C")}
          {chip(common ? "✓ 기관 전체(모든 시설 공통) 포함" : "기관 전체(모든 시설 공통) 포함", { all: common ? undefined : "1" }, common)}
        </span>
      </div>
      <BlockForm ctx={ctx} block="lawA">
        <table className="us-tbl usd-tbl usd-fixed">
          <thead><tr><th style={{ width: "13%" }}>구분</th><th style={{ width: "17%" }}>법령명</th><th>법령내용</th><th style={{ width: "13%" }}>조치 일자</th><th style={{ width: "20%" }}><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {showA.length === 0 && <tr><td colSpan={7} className="c usd-muted">검색결과가 없습니다.</td></tr>}
            {showA.map(({ d, rec }, i) => {
              const rid = rec ? rec.rec_id : d ? `D:${d.duty_key}` : `N:${i}`;
              const data = rec?.data || {};
              return (
                <tr key={rid} className={rec ? "hl" : ""}>
                  {d ? (
                    <>
                      <td><RowId rid={rid} />{d.target_name}<br /><span className={`usd-mark ${d.yongin_mark === "Y" ? "y" : "c"}`}>{markLabel(d.yongin_mark)}</span></td>
                      <td>{d.doc || d.law}</td>
                      <td><LawContent d={d} /></td>
                    </>
                  ) : (
                    <>
                      <td><RowId rid={rid} /><In rid={rid} k="gbn" v={data.gbn} /></td>
                      <td><In rid={rid} k="law" v={data.law} /></td>
                      <td><In rid={rid} k="content" v={data.content} /></td>
                    </>
                  )}
                  <td><In rid={rid} k="date" v={data.date} type="date" /></td>
                  <td><Ev ctx={ctx} rid={rid} files={rec?.files.ev} /></td>
                  <td><In rid={rid} k="note" v={data.note} /></td>
                  <td className="c">{rec ? <Del rid={rid} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager ctx={ctx} n={linesA.length} per={PER_A} param="pa" cur={pa} />
        <div className="usd-foot">
          <span className="usd-foot-l"><AddBtn intent="modal:lawsearch|A">관계 법령 이행사항 추가</AddBtn><AddBtn intent="modal:lawload|A">계획수립 내용 검색 및 추가</AddBtn></span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      <ExampleBox items={["관계 법령에 따른 의무이행 조치 계획서, 결과서 등"]} />

      <h3 className="usd-h3 usd-mt2">관계 법령상 법정교육 이수</h3>
      <div className="usd-lawbar"><span>이 대상과 기관 전체(모든 시설 공통)에 걸리는 교육·훈련 의무 <b>{listB.length}</b>건 · 이수 기록 <b>{recB.length}</b>건(증빙 첨부 {done(recB)})</span></div>
      <BlockForm ctx={ctx} block="lawB">
        <table className="us-tbl usd-tbl usd-fixed">
          <thead><tr><th style={{ width: "20%" }}>법정교육명</th><th style={{ width: "18%" }}>법령명</th><th style={{ width: "14%" }}>조항</th><th style={{ width: "13%" }}>조치 일자</th><th style={{ width: "20%" }}><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {showB.length === 0 && <tr><td colSpan={7} className="c usd-muted">검색결과가 없습니다.</td></tr>}
            {showB.map(({ d, rec }, i) => {
              const rid = rec ? rec.rec_id : d ? `D:${d.duty_key}` : `N:${i}`;
              const data = rec?.data || {};
              return (
                <tr key={rid} className={rec ? "hl" : ""}>
                  {d ? (
                    <>
                      <td><RowId rid={rid} />{dutyText(d).name || dutyText(d).art}<br /><span className={`usd-mark ${d.yongin_mark === "Y" ? "y" : "c"}`}>{markLabel(d.yongin_mark)}</span></td>
                      <td>{d.doc || d.law}</td>
                      <td><LawContent d={d} short /></td>
                    </>
                  ) : (
                    <>
                      <td><RowId rid={rid} /><In rid={rid} k="edu" v={data.edu} /></td>
                      <td><In rid={rid} k="law" v={data.law} /></td>
                      <td><In rid={rid} k="art" v={data.art} /></td>
                    </>
                  )}
                  <td><In rid={rid} k="date" v={data.date} type="date" /></td>
                  <td><Ev ctx={ctx} rid={rid} files={rec?.files.ev} /></td>
                  <td><In rid={rid} k="note" v={data.note} /></td>
                  <td className="c">{rec ? <Del rid={rid} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager ctx={ctx} n={linesB.length} per={PER_B} param="pb" cur={pb} />
        <div className="usd-foot">
          <span className="usd-foot-l"><AddBtn intent="modal:lawsearch|B">관계 법령 이행사항 추가</AddBtn><AddBtn intent="modal:lawload|B">계획수립 내용 검색 및 추가</AddBtn></span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      <ExampleBox title="증빙자료 예시(필수항목)" items={["관계 법령에 따른 법정교육 계획서, 결과서, 교육일지, 교육이수 수료증 등"]} />
      <Viewer url={pick.url} name={pick.name} />
    </>
  );
}

/** 법령내용 — 조항 + 의무 이름, 누르면 원문. */
export function LawContent({ d, short }: { d: Row; short?: boolean }) {
  const t = dutyText(d);
  const src = String(d.source_text || "").trim();
  const text = short ? t.art : t.content;
  if (!src) return <span>{text}</span>;
  return (
    <details className="usd-src">
      <summary>{text}</summary>
      <div>{src}</div>
    </details>
  );
}
