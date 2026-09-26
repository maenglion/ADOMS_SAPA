/**
 * [400 · 교육자료 버전] 묶음 D — ① 1)~4) 화면 본문.
 *  SCR-057·058 안전인력 확보 · SCR-059 예산 편성·집행 · SCR-060 안전점검 계획 수립·수행 · SCR-061·062 안전계획 수립·이행 수행
 */
import { ExampleBox, EvHead } from "@/components/us/Parts";
import { BlockForm, RowId, In, Ev, Del, Btn, AddBtn, Viewer, viewerPick, BudgetGuide, vrows, FallbackNote, type Ctx } from "./ui";
import { TargetSelect } from "./client";
import { pickTarget } from "../_lib/model";

const strip = (s: string) => String(s || "").replace(/\(.*?\)/g, "").trim();

/* ─────────── SCR-057 · 058 안전인력 확보 ─────────── */
export function StaffScreen({ ctx }: { ctx: Ctx }) {
  const bulk = `${ctx.deptName} 담당 대상 ${ctx.peers}개소`;
  const P = vrows(ctx, "people");
  const O = vrows(ctx, "org");
  const orgFile = O.rows.flatMap((r) => r.files.ev || [])[0];
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "staff" && r.scope === ctx.t.id));
  const show = ctx.sp.vn || ctx.sp.vu ? pick : { url: orgFile?.url || pick.url, name: orgFile?.name || pick.name };
  return (
    <>
      <h2 className="us-h2 usd-h2">인력</h2>
      <BlockForm ctx={ctx} block="people" bulkLabel={bulk}>
        <FallbackNote on={P.fallback} />
        <table className="us-tbl usd-tbl">
          <thead>
            <tr><th rowSpan={2}>직급</th><th rowSpan={2}>배치 일자</th><th colSpan={2}>인적사항</th><th rowSpan={2}><EvHead /></th><th rowSpan={2}>비고</th><th rowSpan={2} className="usd-del-h" /></tr>
            <tr><th>이름</th><th>소속(부서)</th></tr>
          </thead>
          <tbody>
            {P.rows.map((r) => (
              <tr key={r.rid}>
                <td><RowId rid={r.rid} /><In rid={r.rid} k="rank" v={r.data.rank} /></td>
                <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td>
                  <div className="usd-name">
                    <In rid={r.rid} k="name" v={r.data.name} />
                    <button className="usd-search" name="intent" value={`modal:staff|${r.rid}`}>🔍 검색</button>
                  </div>
                </td>
                <td><In rid={r.rid} k="dept" v={r.data.dept} /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot">
          <AddBtn>항목 추가</AddBtn>
          <span className="usd-foot-r"><Btn intent="bulk" kind="usd-b" title={`${bulk}에 같은 내용 적용`}>담당 대상 일괄적용</Btn><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>

      <h2 className="us-h2 usd-h2">조직</h2>
      <BlockForm ctx={ctx} block="org" bulkLabel={bulk}>
        <FallbackNote on={O.fallback} />
        <table className="us-tbl usd-tbl">
          <thead><tr><th style={{ width: "18%" }}>조직 구성 일자</th><th><EvHead /></th><th style={{ width: "22%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {O.rows.map((r) => (
              <tr key={r.rid}>
                <td className="c"><RowId rid={r.rid} /><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot">
          <AddBtn>항목 추가</AddBtn>
          <span className="usd-foot-r"><Btn intent="bulk" kind="usd-b">담당 대상 일괄적용</Btn><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>

      <ExampleBox items={[
        "(인력) 해당 공중이용시설 안전 및 유지관리 인력현황표",
        "(조직도) 해당 공중이용시설 안전 및 유지관리 조직도, 긴급상황 발생 시 조치체계도 등",
      ]} />
      {/* SCR-058 — 조직 표에 올린 조직도를 여기서 본다. 원본이 없으면 인력 표로 그린 조직도 */}
      <Viewer url={show.url} name={show.name}
        fallback={<OrgChart ctx={ctx} people={P.rows.map((r) => r.data)} caption={show.name} />} />
    </>
  );
}

/** 조직도(인력 표로 그림) — 명세 SCR-058 의 조직도 모양. 연락처는 공통 긴급전화만 적는다. */
function OrgChart({ ctx, people, caption }: { ctx: Ctx; people: Record<string, any>[]; caption?: string }) {
  const head = ctx.t.group === "공중교통수단" ? `${strip(ctx.deptName)}장` : `${strip(ctx.deptName)}장`;
  const lead = people.filter((p) => /과장|팀장|소장/.test(p.rank || "") && p.name);
  const staff = people.filter((p) => !/과장|팀장|소장/.test(p.rank || "") && p.name);
  return (
    <div className="usd-org">
      <div className="usd-org-node top">용인특례시장</div>
      <div className="usd-org-v" />
      <div className="usd-org-node">{head}</div>
      {lead.map((p, i) => (
        <div key={i}><div className="usd-org-v" /><div className="usd-org-node">{p.dept} {p.rank}<br /><b>{p.name}</b></div></div>
      ))}
      <div className="usd-org-v" />
      <div className="usd-org-row">
        <div className="usd-org-node">{strip(ctx.t.name)} 담당자<br />{staff.map((p) => p.name).join(" · ") || "—"}</div>
        <table className="usd-org-tel">
          <tbody>
            <tr><th>소방</th><td>119</td></tr>
            <tr><th>경찰</th><td>112</td></tr>
            <tr><th>한국전력(고장)</th><td>123</td></tr>
          </tbody>
        </table>
        <div className="usd-org-node">용인특례시<br />재난안전상황실<br />당직실</div>
      </div>
      {caption ? <div className="usd-org-cap">{caption}</div> : null}
    </div>
  );
}

/* ─────────── SCR-059 중대시민재해 예방 예산 편성·집행 ─────────── */
const ITEMS = ["안전점검비", "보수보강비", "안전조치비", "교육·훈련비", "기타"];
/** 09-25 사용자: 명세 오기 「보수보강비」는 화면에서 「보수·보강비」로 보인다.
 *  저장 값(usd_record data.item)은 「보수보강비」 그대로라 ITEMS 는 바꾸지 않고 표시만 바꾼다. */
const ITEM_LABEL: Record<string, string> = { 보수보강비: "보수·보강비" };
export function BudgetScreen({ ctx }: { ctx: Ctx }) {
  const all = vrows(ctx, "budget", { blank: false });
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "budget" && r.scope === ctx.t.id));
  const num = (v: any) => Number(String(v || "0").replace(/[^\d.-]/g, "")) || 0;
  return (
    <>
      <h2 className="us-h2 usd-h2">예산</h2>
      <BlockForm ctx={ctx} block="budget">
        <FallbackNote on={all.fallback} />
        <table className="us-tbl usd-tbl">
          <thead>
            <tr><th style={{ width: "12%" }}>예산 항목</th><th style={{ width: "9%" }}>편성액<br /><small>(천원)</small></th><th style={{ width: "13%" }}>집행 일자</th><th>집행 내역</th><th style={{ width: "24%" }}>증빙자료<br /><small>※ 개당 10MB 이하</small></th><th style={{ width: "9%" }}>집행액</th><th style={{ width: "12%" }}>비고</th></tr>
          </thead>
          <tbody>
            {ITEMS.map((item, ix) => {
              const rows = all.rows.filter((r) => (r.data.item || "") === item);
              const list = rows.length ? rows : [{ rid: `N:${ix}`, data: { item, plan: "0", exec: "0" }, files: {}, saved: false }];
              return list.map((r, i) => (
                <tr key={r.rid}>
                  {i === 0 && (
                    <td rowSpan={list.length} className="c usd-item">
                      <span className="usd-item-box">{ITEM_LABEL[item] || item}</span>
                      <AddBtn intent={`add:item=${item}`}>+</AddBtn>
                    </td>
                  )}
                  <td><RowId rid={r.rid} presets={{ item }} /><In rid={r.rid} k="plan" v={String(r.data.plan ?? "0")} type="number" /></td>
                  <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                  <td><In rid={r.rid} k="desc" v={r.data.desc} /></td>
                  <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                  <td><In rid={r.rid} k="exec" v={String(r.data.exec ?? "0")} type="number" /></td>
                  <td><div className="usd-name"><In rid={r.rid} k="note" v={r.data.note} />{i > 0 && <Del rid={r.rid} />}</div></td>
                </tr>
              ));
            })}
          </tbody>
        </table>
        <div className="usd-foot">
          <span className="usd-sum">편성 합계 {all.rows.reduce((a, r) => a + num(r.data.plan), 0).toLocaleString()}천원 · 집행 합계 {all.rows.reduce((a, r) => a + num(r.data.exec), 0).toLocaleString()}천원</span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      <Viewer url={pick.url} name={pick.name} />
      <ExampleBox items={["필요한 예산에 대한 증빙자료(예산집행 결과를 알 수 있는 서류)"]} />
      <BudgetGuide />
    </>
  );
}

/* ─────────── SCR-060 안전점검 계획 수립·수행 ─────────── */
export function InspectScreen({ ctx, opts }: { ctx: Ctx; opts: { id: string; text: string; group: string }[] }) {
  const S1 = vrows(ctx, "fsam");
  const t2 = pickTarget(ctx.list, ctx.all, ctx.role, ctx.sp.t2 || ctx.t.id) || ctx.t;
  const S2 = vrows(ctx, "other", { scope: t2.id, dept: t2.dept_id });
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "inspect" && (r.scope === ctx.t.id || r.scope === t2.id)));
  const head = (withOk: boolean) => (
    <thead>
      <tr>
        <th rowSpan={2}>점검종류</th>{withOk && <th rowSpan={2}>조치<br />완료</th>}<th rowSpan={2}>점검명</th>
        <th colSpan={2}>점검결과</th><th colSpan={3}>조치결과(건)</th>
        <th rowSpan={2}>증빙자료<br /><small>※ 개당 10MB 이하</small></th><th rowSpan={2}>비고</th>{withOk && <th rowSpan={2} className="usd-del-h" />}
      </tr>
      <tr><th>점검일</th><th>지적(건)</th><th>완료</th><th>단기<br /><small>(3개월내)</small></th><th>장기</th></tr>
    </thead>
  );
  return (
    <>
      <h2 className="us-h2 usd-h2">시설물안전법 상 안전점검 및 정밀안전진단</h2>
      <BlockForm ctx={ctx} block="fsam">
        <FallbackNote on={S1.fallback} />
        <table className="us-tbl usd-tbl usd-tight">
          {head(false)}
          <tbody>
            {S1.rows.map((r) => (
              <tr key={r.rid}>
                <td><RowId rid={r.rid} /><In rid={r.rid} k="kind" v={r.data.kind} /></td>
                <td><In rid={r.rid} k="name" v={r.data.name} /></td>
                <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td><In rid={r.rid} k="found" v={r.data.found} type="number" /></td>
                <td><In rid={r.rid} k="done" v={r.data.done} type="number" /></td>
                <td><In rid={r.rid} k="short" v={r.data.short} type="number" /></td>
                <td><In rid={r.rid} k="long" v={r.data.long} type="number" /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot"><span /><span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span></div>
      </BlockForm>
      <div className="us-example">
        <div className="us-example-h">점검 종류</div>
        <ul><li>정기안전점검, 정밀안전점검, 정밀안전진단</li></ul>
        <div className="us-example-h usd-mt">증빙자료 예시</div>
        <ul><li>시설물안전법상 안전점검 등 해당 용역 관련 계획서, 발주서, 결과서 등</li></ul>
      </div>

      <div className="usd-sechead">
        <h2 className="us-h2 usd-h2">그 외 안전 ·보건 관계 법령에 따른 안전점검</h2>
        <TargetSelect hrefBase={ctx.href({ t2: undefined })} value={t2.id} options={opts} param="t2" />
      </div>
      <BlockForm ctx={ctx} block="other" scope={t2.id} dept={t2.dept_id}>
        <FallbackNote on={S2.fallback} />
        <table className="us-tbl usd-tbl usd-tight">
          {head(true)}
          <tbody>
            {S2.rows.map((r) => (
              <tr key={r.rid}>
                <td>
                  <RowId rid={r.rid} checks={["ok"]} /><In rid={r.rid} k="kind" v={r.data.kind} />
                  <AddBtn intent={`add:kind=${r.data.kind || ""}`}>+</AddBtn>
                </td>
                <td className="c">
                  <label className="usd-okchk" title="조치 완료">
                    <input type="checkbox" name={`c.${r.rid}.ok`} value="Y" defaultChecked={r.data.ok === "Y"} /><span>✓</span>
                  </label>
                </td>
                <td><In rid={r.rid} k="name" v={r.data.name} /></td>
                <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td><In rid={r.rid} k="found" v={r.data.found} type="number" /></td>
                <td><In rid={r.rid} k="done" v={r.data.done} type="number" /></td>
                <td><In rid={r.rid} k="short" v={r.data.short} type="number" /></td>
                <td><In rid={r.rid} k="long" v={r.data.long} type="number" /></td>
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot"><AddBtn>점검 항목 추가</AddBtn><span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span></div>
      </BlockForm>
      <Viewer url={pick.url} name={pick.name} />
      <ExampleBox items={["시설물 안전법 외 관계 법령에 따른 안전점검 해당 용역 관련 계획서, 발주서, 결과서 등"]} />
    </>
  );
}

/* ─────────── SCR-061 · 062 안전계획 수립·이행 수행 ─────────── */
export function PlanScreen({ ctx }: { ctx: Ctx }) {
  const R = vrows(ctx, "plan");
  const pick = viewerPick(ctx, ctx.recs.filter((r) => r.step === "plan" && r.scope === ctx.t.id));
  return (
    <>
      <BlockForm ctx={ctx} block="plan">
        <FallbackNote on={R.fallback} />
        <table className="us-tbl usd-tbl">
          <thead><tr><th style={{ width: "20%" }}>안전계획항목</th><th style={{ width: "13%" }}>이행일자</th><th>이행내역</th><th style={{ width: "26%" }}>증빙자료<br /><small>※ 개당 10MB 이하</small></th><th style={{ width: "11%" }}>비고</th><th className="usd-del-h" /></tr></thead>
          <tbody>
            {R.rows.map((r) => (
              <tr key={r.rid}>
                <td><RowId rid={r.rid} /><In rid={r.rid} k="item" v={r.data.item} /></td>
                <td><In rid={r.rid} k="date" v={r.data.date} type="date" /></td>
                <td><In rid={r.rid} k="text" v={r.data.text} /></td>
                {/* 명세 SCR-061 은 이 칸에 「파일선택」 단추가 안 보인다(판독불확실) — 아래 「+」로 올린다 */}
                {/* TODO: 확인 — 파일선택 단추 유무 */}
                <td><Ev ctx={ctx} rid={r.rid} files={r.files.ev} showPick={false} /></td>
                <td><In rid={r.rid} k="note" v={r.data.note} /></td>
                <td className="c"><Del rid={r.rid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usd-foot">
          <span className="usd-foot-l"><AddBtn>계획 항목 추가</AddBtn><AddBtn intent="modal:plan">계획수립 내용 검색 및 추가</AddBtn></span>
          <span className="usd-foot-r"><Btn intent="save" kind="usd-b">저장</Btn></span>
        </div>
      </BlockForm>
      <Viewer url={pick.url} name={pick.name} />
      <ExampleBox items={["시설물안전법상 안전점검 등 해당 용역 관련 계획서, 발주서, 결과서 등"]} />
    </>
  );
}
