/**
 * [400 · 교육자료 버전] 묶음 D — ① 5) · ② · ③ 화면 본문.
 *  SCR-063~065 재해예방업무처리 절차 마련·이행 · SCR-066·067 재발방지대책 · SCR-068·069 개선·시정 사항 이행
 */
import { ExampleBox, EvHead } from "@/components/us/Parts";
import { BlockForm, RowId, In, Ev, Del, Btn, AddBtn, Viewer, viewerPick, BudgetGuide, vrows, FallbackNote, NaLine, type Ctx, type VRow } from "./ui";

/* ─────────── SCR-063 · 064 · 065 재해예방업무처리 절차 마련·이행 ─────────── */
export function ProcScreen({ ctx }: { ctx: Ctx }) {
  const H = vrows(ctx, "hazard");
  const D = vrows(ctx, "drill");
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "proc" && (r.block === "hazard" || r.block === "drill") && r.scope === ctx.t.id));
  return (
    <>
      <h3 className="usd-h3">유해 · 위험요인 확인 · 점검</h3>
      <BlockForm ctx={ctx} block="hazard">
        <FallbackNote on={H.fallback} />
        <table className="us-tbl usd-tbl">
          <thead><tr><th>유해·위험 요인</th><th>확인사항</th><th style={{ width: "12%" }}>확인 일자</th><th>조치사항</th><th style={{ width: "12%" }}>조치일자</th><th style={{ width: "22%" }}><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {H.rows.map((r) => (
              <tr key={r.rid}>
                <td><RowId rid={r.rid} /><In rid={r.rid} k="hz" v={r.data.hz} /></td>
                <td><In rid={r.rid} k="check" v={r.data.check} /></td>
                <td><In rid={r.rid} k="cdate" v={r.data.cdate} type="date" /></td>
                <td><In rid={r.rid} k="act" v={r.data.act} /></td>
                <td><In rid={r.rid} k="adate" v={r.data.adate} type="date" /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot">
          <span className="usd-foot-l"><AddBtn>점검 항목 추가</AddBtn><AddBtn intent="modal:hazard">계획수립 내용 검색 및 추가</AddBtn></span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      {/* 명세 SCR-063 은 이 화면만 「이미지뷰어」(붙여 씀) — 원문 그대로 */}
      <Viewer title="이미지뷰어" url={pick.url} name={pick.name} />
      <ExampleBox items={["유해·위험요인 신고·접수대장, 조치계획서, 조치결과서, 보수·보강계획서 등", "유해위험요인 확인 점검, 발견 시 신고·조치 자료를 포함"]} />

      <h3 className="usd-h3 usd-mt2">비상대피훈련</h3>
      <BlockForm ctx={ctx} block="drill">
        <FallbackNote on={D.fallback} />
        <table className="us-tbl usd-tbl">
          <thead><tr><th style={{ width: "16%" }}>비상대피훈련</th><th style={{ width: "14%" }}>이행 일자</th><th>이행 내역</th><th style={{ width: "22%" }}><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {D.rows.map((r) => (
              <tr key={r.rid}>
                <td><RowId rid={r.rid} /><In rid={r.rid} k="name" v={r.data.name} /></td>
                <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td><In rid={r.rid} k="text" v={r.data.text} /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot">
          <span className="usd-foot-l"><AddBtn>비상대피훈련 추가</AddBtn><AddBtn intent="modal:drill">계획수립 내용 검색 및 추가</AddBtn></span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      <ExampleBox items={["비상대피훈련 계획서, 결과서 등"]} />

      {/* SCR-065 절차도 2종 — 좌우 카드, 저장 단위 각각 */}
      <div className="usd-flows">
        <FlowCard ctx={ctx} block="flow1" title="유해 위험요인 발견 시 신고 및 개선" />
        <FlowCard ctx={ctx} block="flow2" title="중대시민재해 발생시 대응 조치" />
      </div>
    </>
  );
}

/** 절차도 카드 — 라디오(작성일자 / PDF / HWP) 택1 + PDF 뷰어. */
function FlowCard({ ctx, block, title }: { ctx: Ctx; block: string; title: string }) {
  const R = vrows(ctx, block);
  const r = R.rows[0];
  const mode = r.data.mode || (r.files.pdf?.length ? "pdf" : r.files.hwp?.length ? "hwp" : "date");
  const pdf = (r.files.pdf || []).slice(-1)[0];
  const save = <Btn intent="save" kind="usd-b usd-b-s">저장</Btn>;
  return (
    <BlockForm ctx={ctx} block={block} className="usd-flow">
      <RowId rid={r.rid} presets={{ mode }} />
      <div className="usd-flow-h">
        <b>{title}</b>
        <AddBtn intent={`modal:flow|${block}`}>계획수립 내용 검색 및 추가</AddBtn>
      </div>
      <FallbackNote on={R.fallback} />
      <div className="usd-flow-sub">절차도{r.data.doc ? <span className="usd-flow-doc"> — {r.data.doc}</span> : null}</div>
      <div className="usd-flow-line">
        <label><input type="radio" name={`c.${r.rid}.mode`} value="date" defaultChecked={mode === "date"} /> 작성일자</label>
        <In rid={r.rid} k="date" v={r.data.date} type="date" />
      </div>
      <div className="usd-flow-line">
        <label><input type="radio" name={`c.${r.rid}.mode`} value="pdf" defaultChecked={mode === "pdf"} /> PDF</label>
        <Ev ctx={ctx} rid={r.rid} evkey="pdf" files={r.files.pdf} accept=".pdf" pickLabel="찾아보기" plus={false} extra={save} />
      </div>
      <div className="usd-flow-view">
        <div className="usd-flow-vh">PDF 뷰어</div>
        {pdf?.url ? <iframe className="usd-pdf" src={pdf.url} title={pdf.name} />
          : <div className="usd-flow-ph"><span className="us-ph">🖼</span>{pdf ? <small>{pdf.name}</small> : null}</div>}
      </div>
      <div className="usd-flow-line">
        {/* HWP 는 뷰어로 볼 수 없어 내려받기만 한다(추정) — TODO: 확인 */}
        <label><input type="radio" name={`c.${r.rid}.mode`} value="hwp" defaultChecked={mode === "hwp"} /> HWP</label>
        <Ev ctx={ctx} rid={r.rid} evkey="hwp" files={r.files.hwp} accept=".hwp,.hwpx" pickLabel="찾아보기" plus={false} extra={save} />
      </div>
    </BlockForm>
  );
}

/* ─────────── SCR-066 · 067 재해 발생시 재발방지대책 수립 및 이행 ─────────── */
export function RecurScreen({ ctx }: { ctx: Ctx }) {
  const na = ctx.recs.find((r) => r.step === "recur" && r.block === "na" && r.scope === ctx.t.id)?.data.na === "Y";
  const C = vrows(ctx, "card");
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "recur" && r.scope === ctx.t.id));
  return (
    <>
      <BlockForm ctx={ctx} block="card" hasNa className="usd-na">
        {/* 명세 원문은 중대시민재해 화면인데 「산업재해, 중대산업재해」로 적혀 있다(명세 부록 B-2).
            09-25 사용자: 명세 오기는 고친다 — 「중대시민재해」로. */}
        <NaLine checked={na} label="중대시민재해 발생 이력이 없을 경우 체크하여 저장" />
        <div className="usd-na-body">
          <FallbackNote on={C.fallback} />
          {C.rows.map((r) => <IncidentCard key={r.rid} ctx={ctx} r={r} />)}
          <div className="usd-foot"><AddBtn>재해 추가</AddBtn><span /></div>
        </div>
        <div className="usd-foot usd-foot-save"><span /><span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span></div>
      </BlockForm>
      <Viewer url={pick.url} name={pick.name} />
      <div className="us-example">
        <div className="us-example-h">필수 내역</div>
        {/* 명세 원문은 표 줄 이름 「재발방지계획서」, 안내 「재발방지보고서」로 갈려 있다.
            09-25 사용자: 명세 오기는 고친다 — 표 쪽 「재발방지계획서」로 맞춘다. */}
        <p className="usd-p">1. 상황보고서, 2. 재발방지계획서</p>
        <div className="us-example-h usd-mt">증빙자료 예시</div>
        <p className="usd-p">발생한재해 재발방지계획서(사업장 개요, 재해발생 원인분석 및 재발방지 대책(단기적 대책, 장기적 대책))</p>
      </div>
    </>
  );
}

function IncidentCard({ ctx, r }: { ctx: Ctx; r: VRow }) {
  const rows: [string, string][] = [["1. 상황보고서", "1"], ["2. 재발방지계획서", "2"]];
  return (
    <div className="usd-card">
      <RowId rid={r.rid} />
      <div className="usd-card-h">
        <label>발생재해명 <In rid={r.rid} k="name" v={r.data.name} /></label>
        <label>재해발생일 <In rid={r.rid} k="date" v={r.data.date} type="date" /></label>
      </div>
      <table className="us-tbl usd-tbl">
        <thead><tr><th style={{ width: "18%" }}>구분</th><th style={{ width: "15%" }}>이행 일자</th><th>이행 내역</th><th style={{ width: "28%" }}><EvHead /></th><th style={{ width: "12%" }}>비고</th></tr></thead>
        <tbody>
          {rows.map(([label, n]) => (
            <tr key={n}>
              <td className="c">{label}</td>
              <td><In rid={r.rid} k={`r${n}date`} v={r.data[`r${n}date`]} type="date" /></td>
              <td><In rid={r.rid} k={`r${n}text`} v={r.data[`r${n}text`]} /></td>
              <td><Ev ctx={ctx} rid={r.rid} evkey={`ev${n}`} files={r.files[`ev${n}`]} /></td>
              <td><In rid={r.rid} k={`r${n}note`} v={r.data[`r${n}note`]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="usd-card-f"><button className="usd-delcard" name="intent" value={`del:${r.rid}`}>삭제</button></div>
    </div>
  );
}

/* ─────────── SCR-068 · 069 중앙행정기관, 지자체 개선·시정 사항 이행 ─────────── */
export function OrderScreen({ ctx }: { ctx: Ctx }) {
  const na = ctx.recs.find((r) => r.step === "order" && r.block === "na" && r.scope === ctx.t.id)?.data.na === "Y";
  const R = vrows(ctx, "order");
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "order" && r.scope === ctx.t.id));
  return (
    <>
      <BlockForm ctx={ctx} block="order" hasNa className="usd-na">
        <NaLine checked={na} label="중앙행정기관, 지자체 개선·시정 사항이 없을 경우 체크하여 저장" />
        <div className="usd-na-body">
          <FallbackNote on={R.fallback} />
          <table className="us-tbl usd-tbl usd-tight">
            <thead><tr><th>개선·시정 사항</th><th style={{ width: "10%" }}>개선·시정<br />요구기관</th><th style={{ width: "12%" }}>행정처분 일자</th><th>개선·시정 사항<br />이행 내역</th><th style={{ width: "13%" }}>조치기간</th><th style={{ width: "20%" }}><EvHead /></th><th style={{ width: "8%" }}>비고</th><th className="usd-del-h" /></tr></thead>
            <tbody>
              {R.rows.map((r) => (
                <tr key={r.rid}>
                  <td><RowId rid={r.rid} /><In rid={r.rid} k="item" v={r.data.item} /></td>
                  <td><In rid={r.rid} k="org" v={r.data.org} /></td>
                  <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                  <td><In rid={r.rid} k="text" v={r.data.text} /></td>
                  <td className="usd-range"><In rid={r.rid} k="from" v={r.data.from} type="date" /><span>~</span><In rid={r.rid} k="to" v={r.data.to} type="date" /></td>
                  <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                  <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                  <td className="c"><Del rid={r.rid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="usd-foot"><AddBtn>개선 시정사항 추가</AddBtn><span /></div>
        </div>
        <div className="usd-foot usd-foot-save"><span /><span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span></div>
      </BlockForm>
      <Viewer url={pick.url} name={pick.name} />
      <ExampleBox ordered items={["중앙행정기관, 지자체 개선·시정 사항 행정처분 공문", "중앙행정기관, 지자체 행정처분에 대한 조치계획서, 이행내역 결과서 등"]} />
      {/* 명세 SCR-068 — 예산 화면이 아닌데 예산 항목 안내표가 붙어 있다. 원문대로 둔다 */}
      <BudgetGuide />
    </>
  );
}
