// [400 · 교육자료 버전] 묶음 E — ④ 관계 법령 의무이행 조치(SCR-086 관계 법령상 의무이행 · SCR-087 관계 법령상 법정교육 이수).
//   표는 우리 의무 목록(duties area=M)으로 채운다 — 관계법령 의무이행(M08)·관계법령 교육이수(M09).
//   이 사업장 관리대상(use_site.targets)에 걸린 「용인 확정」 의무는 기본으로 올라오고,
//   「조건부」 의무는 「계획수립 내용 검색 및 추가」 창에서 찾아 불러온다. 이행 여부·조치 일자·증빙을 줄마다 저장한다.
import { CheckAll } from "../../fc/_parts/client";   // 09-26 사용자: 불러오기 창 「전체 선택」(☐ 글자만 있고 동작하지 않았다)
import { EvHead } from "@/components/us/Parts";
import { act, loadPlan } from "../actions";
import { lawKo, markKo, dutyText, isLawDuty, isEduDuty, type Rec } from "../model";
import FilePick from "./FilePick";
import { type View, CtxHidden, RowMeta, ridOf, saveAct, addAct, delAct, EvCell, Tag, PlanBtn, Modal, CRUMB_MT, BtnRow, SaveBtn } from "./parts";

type Row = Record<string, any>;
const d = (r: Rec | undefined, k: string) => String(r?.data?.[k] ?? "");
const DefBtn = () => <button className="use-defbtn" formAction={saveAct} tabIndex={-1} aria-hidden="true">저장</button>;
const STATUS = ["이행완료", "보완필요", "미이행", "해당없음"];
const LAYERS = ["법률", "시행령", "시행규칙", "고시", "훈령·예규"];
/** 「제2조의2제4항제2호가목」 → [제2조의2, 제4항제2호가목] */
const splitArt = (s: string) => {
  const m = String(s || "").match(/^(제\d+조(?:의\d+)?)(.*)$/);
  return m ? [m[1], m[2]] : [s, ""];
};
const layerKo = (s: string) => ({ "대통령령(시행령)": "시행령", "부령(시행규칙)": "시행규칙" } as Record<string, string>)[s] || String(s || "");

function StatusSel({ rid, value }: { rid: string; value: string }) {
  return (
    <select name={`${rid}__status`} defaultValue={value} className={`use-stsel ${value ? `st-${value}` : ""}`}>
      <option value="">선택</option>
      {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

export async function LawStep({ v, recs, all }: { v: View; recs: Rec[]; all: Row[] }) {
  const byKey = new Map(all.map((x) => [x.duty_key, x]));
  const inSite = (x: Row) => v.site.targets.includes(x.target_name);

  // ── 블록 A — 관계 법령상 의무이행(M08) ──
  const lawAll = all.filter(isLawDuty);
  const lawDefault = lawAll.filter((x) => x.yongin_mark === "Y" && inSite(x));
  const recA = new Map(recs.filter((r) => r.block.startsWith("duty:")).map((r) => [r.block.slice(5), r]));
  const keysA = [...lawDefault.map((x) => x.duty_key), ...[...recA.keys()].filter((k) => !lawDefault.some((x) => x.duty_key === k))];
  const customA = recs.filter((r) => r.block === "lawx");
  const doneA = keysA.filter((k) => recA.get(k)?.data?.status === "이행완료").length + customA.filter((r) => r.data.status === "이행완료").length;

  // ── 블록 B — 관계 법령상 법정교육 이수(M09) ──
  const eduAll = all.filter(isEduDuty);
  const eduDefault = eduAll.filter((x) => x.yongin_mark === "Y" && inSite(x));
  const recB = new Map(recs.filter((r) => r.block.startsWith("edu:")).map((r) => [r.block.slice(4), r]));
  const keysB = [...eduDefault.map((x) => x.duty_key), ...[...recB.keys()].filter((k) => !eduDefault.some((x) => x.duty_key === k))];
  const customB = recs.filter((r) => r.block === "edux");

  const cnt = (xs: Row[]) => ({ n: xs.length, y: xs.filter((x) => x.yongin_mark === "Y").length, c: xs.filter((x) => x.yongin_mark === "조건부").length });
  const ca = cnt(lawAll), cb = cnt(eduAll);

  return (
    <>
      <p className="use-sum">
        원료·제조물 관계 법령 의무 <b>{ca.n.toLocaleString()}</b>건(용인 확정 {ca.y} · 조건부 {ca.c}) ·
        법정교육 의무 <b>{cb.n}</b>건(용인 확정 {cb.y} · 조건부 {cb.c}) 가운데 이 사업장 관리대상({v.site.targets.join(" · ")})의
        용인 확정 의무가 표에 먼저 올라옵니다. 조건부 의무는 「계획수립 내용 검색 및 추가」에서 불러옵니다.
      </p>

      {/* ── 관계 법령상 의무이행 — SCR-086 ── */}
      <div className="use-sec2" id="blockA">관계 법령상 의무이행 <small>표 {keysA.length + customA.length}건 · 이행완료 {doneA}건</small></div>
      <form action={saveAct} id="form">
        <DefBtn /><CtxHidden v={v} />
        <div className="use-wide"><table className="us-tbl use-tbl use-law">
          <colgroup><col style={{ width: "11%" }} /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} /><col style={{ width: "9%" }} /><col style={{ width: "11%" }} /><col style={{ width: "20%" }} /><col style={{ width: "13%" }} /><col style={{ width: "4%" }} /></colgroup>
          <thead><tr>
            <th>구분</th><th>조항</th><th>법령내용</th><th>이행 여부</th><th>조치 일자</th><th><EvHead /></th><th>비고</th><th className="use-x"></th>
          </tr></thead>
          <tbody>
            {keysA.map((k) => {
              const x = byKey.get(k);
              const r = recA.get(k);
              const rid = ridOf(r, `duty~${k}`);
              if (!x) return null;
              const pinned = d(r, "pinned") === "Y";
              return (
                <tr key={rid}>
                  <td>
                    <RowMeta rid={rid} block={`duty:${k}`} meta={{ duty_key: k }} />
                    <div className="use-stack"><Tag tone="blue">{lawKo(x.law)}</Tag><Tag>{layerKo(x.layer)}</Tag></div>
                  </td>
                  <td><div className="use-stack"><Tag>{x.unit_label_ko}</Tag><Tag>{lawKo(x.doc)}</Tag></div></td>
                  <td>
                    <div className="use-lawtext">{dutyText(x)}</div>
                    <Tag tone={x.yongin_mark === "Y" ? "mark" : "cond"}>{markKo(x.yongin_mark)}</Tag>
                    {x.cycle_text && <small className="use-mut"> · {x.cycle_text}</small>}
                  </td>
                  <td><StatusSel rid={rid} value={d(r, "status")} /></td>
                  <td><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                  <td><EvCell v={v} rid={rid} files={r?.files || []} /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  {/* 기본으로 올라온 용인 확정 의무는 지우지 않는다(해당 없으면 이행 여부 「해당없음」) — 불러온 조건부만 뺄 수 있다 */}
                  <td className="c">{r && pinned ? <button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button> : <span className="use-ico dim" title="의무 목록에서 온 줄">🗑</span>}</td>
                </tr>
              );
            })}
            {customA.map((r) => {
              const rid = r.rec_id;
              return (
                <tr key={rid}>
                  <td>
                    <RowMeta rid={rid} block="lawx" />
                    <div className="use-stack">
                      <input type="text" name={`${rid}__law`} defaultValue={d(r, "law")} placeholder="법령명" />
                      <select name={`${rid}__layer`} defaultValue={d(r, "layer")}><option value="">법령구분</option>{LAYERS.map((l) => <option key={l}>{l}</option>)}</select>
                    </div>
                  </td>
                  <td><div className="use-stack">
                    <input type="text" name={`${rid}__art1`} defaultValue={d(r, "art1")} placeholder="제○조" />
                    <input type="text" name={`${rid}__art2`} defaultValue={d(r, "art2")} placeholder="제○항" />
                  </div></td>
                  <td><input type="text" name={`${rid}__content`} defaultValue={d(r, "content")} placeholder="법령내용" /></td>
                  <td><StatusSel rid={rid} value={d(r, "status")} /></td>
                  <td><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                  <td><EvCell v={v} rid={rid} files={r.files} /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  <td className="c"><button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <BtnRow
          left={<><button className="use-bbtn" formAction={addAct("lawx", {}, "blockA")}>관계 법령 이행사항 추가</button><PlanBtn v={v} modal="law" /></>}
          right={<SaveBtn />}
        />
      </form>
      <div className="us-example">
        <div className="us-example-h">증빙자료 예시(필수항목)</div>
        <p className="use-p">관계 법령에 따른 의무이행 조치 계획서, 결과서 등</p>
      </div>

      {/* ── 관계 법령상 법정교육 이수 — SCR-087 ── */}
      <div className="use-sec2" id="blockB">관계 법령상 법정교육 이수 <small>표 {keysB.length + customB.length}건</small></div>
      <form action={saveAct}>
        <DefBtn /><CtxHidden v={v} />
        <div className="use-wide"><table className="us-tbl use-tbl use-edu">
          <colgroup><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "9%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} /><col style={{ width: "21%" }} /><col style={{ width: "9%" }} /><col style={{ width: "4%" }} /></colgroup>
          <thead><tr>
            {/* 명세 SCR-087 원문은 셋째 칸 머리도 「법령명」(조문 칸) — 09-25 사용자: 명세 오기는 고친다 → 「조문」 */}
            <th>법정교육명</th><th>법령명</th><th>조문</th><th>교육대상</th><th>교육기관</th><th>교육 일자</th><th><EvHead /></th><th>비고</th><th className="use-x"></th>
          </tr></thead>
          <tbody>
            {keysB.map((k) => {
              const x = byKey.get(k);
              const r = recB.get(k);
              if (!x) return null;
              const rid = ridOf(r, `edu~${k}`);
              const pinned = d(r, "pinned") === "Y";
              return (
                <tr key={rid}>
                  <td>
                    <RowMeta rid={rid} block={`edu:${k}`} meta={{ duty_key: k, edu_name: dutyText(x) }} />
                    <input type="text" name={`${rid}__edu_name`} defaultValue={d(r, "edu_name") || dutyText(x)} />
                    <Tag tone={x.yongin_mark === "Y" ? "mark" : "cond"}>{markKo(x.yongin_mark)}</Tag>
                  </td>
                  <td><div className="use-stack"><Tag>{lawKo(x.law)}</Tag><Tag>중대재해처벌법 의무사항</Tag></div></td>
                  <td><Tag>{x.unit_label_ko}</Tag></td>
                  <td><input type="text" name={`${rid}__target`} defaultValue={d(r, "target")} /></td>
                  <td><input type="text" name={`${rid}__org`} defaultValue={d(r, "org")} /></td>
                  <td><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                  <td><EduEv v={v} rid={rid} r={r} /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  <td className="c">{r && pinned ? <button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button> : <span className="use-ico dim">🗑</span>}</td>
                </tr>
              );
            })}
            {customB.map((r) => {
              const rid = r.rec_id;
              return (
                <tr key={rid}>
                  <td><RowMeta rid={rid} block="edux" /><input type="text" name={`${rid}__edu_name`} defaultValue={d(r, "edu_name")} /></td>
                  <td><div className="use-stack">
                    <input type="text" name={`${rid}__law`} defaultValue={d(r, "law")} placeholder="법령명" />
                    <span className="use-tag">중대재해처벌법 의무사항</span>
                  </div></td>
                  <td><input type="text" name={`${rid}__art`} defaultValue={d(r, "art")} placeholder="제○조" /></td>
                  <td><input type="text" name={`${rid}__target`} defaultValue={d(r, "target")} /></td>
                  <td><input type="text" name={`${rid}__org`} defaultValue={d(r, "org")} /></td>
                  <td><input type="date" name={`${rid}__date`} defaultValue={d(r, "date")} /></td>
                  <td><EduEv v={v} rid={rid} r={r} /></td>
                  <td><input type="text" name={`${rid}__note`} defaultValue={d(r, "note")} /></td>
                  <td className="c"><button className="use-ico" formAction={delAct(rid)} title="행 삭제">🗑</button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <BtnRow
          left={<><button className="use-bbtn" formAction={addAct("edux", {}, "blockB")}>관계 법령 이행사항 추가</button><PlanBtn v={v} modal="edu" /></>}
          right={<SaveBtn />}
        />
      </form>
      <div className="us-example">
        <div className="us-example-h">증빙자료 예시(필수항목)</div>
        <p className="use-p">관계 법령에 따른 의무이행 조치 계획서, 결과서 등</p>
      </div>

      {(v.sp.modal === "law" || v.sp.modal === "edu") && <DutyModal v={v} kind={v.sp.modal} pool={v.sp.modal === "law" ? lawAll : eduAll}
        have={new Set(v.sp.modal === "law" ? keysA : keysB)} />}
    </>
  );
}

/** 법정교육 증빙 칸 — 1행 명부(명부선택 · 샘플다운) · 2행 일반 증빙 · 3행 「+」(명세 SCR-087). */
function EduEv({ v, rid, r }: { v: View; rid: string; r?: Rec }) {
  const files = r?.files || [];
  const roster = files.filter((f) => f.slot === "roster");
  return (
    <div className="use-ev">
      {roster.map((f) => (
        <div className="use-ev-line" key={`${f.name}-${files.indexOf(f)}`}>
          <span className="us-ev-name">{f.name}</span>
          {f.url ? <a className="use-ico" href={f.url} download>⤓</a> : <span className="use-ico dim">⤓</span>}
          {r && <button className="use-ico" formAction={act.bind(null, "delfile", `${rid}|${files.indexOf(f)}`)} title="삭제">🗑</button>}
        </div>
      ))}
      <div className="use-ev-line">
        <FilePick name={`${rid}__file_roster`} label="명부선택" />
        <a className="us-btn-s" href="/perform/mt/sample" download>샘플다운</a>
      </div>
      <EvCell v={v} rid={rid} files={files} slot="" />
    </div>
  );
}

/**
 * 법령 검색 · 불러오기 창 — 우리 의무 목록에서 찾는다(명세 SCR-071 법령 검색 창의 칸 + SCR-072 불러오기의 체크·「불러오기」).
 * TODO: 확인 — 원료·제조물 트랙의 이 창은 명세에 화면이 없다(공중이용시설 트랙 SCR-071~074 모양으로 추정).
 */
function DutyModal({ v, kind, pool, have }: { v: View; kind: string; pool: Row[]; have: Set<string> }) {
  const sp = v.sp;
  const all = sp.ta === "1";
  let rows = pool.filter((x) => !have.has(x.duty_key));
  if (!all) rows = rows.filter((x) => v.site.targets.includes(x.target_name));
  if (sp.mk) rows = rows.filter((x) => x.yongin_mark === sp.mk);
  if (sp.lk) rows = rows.filter((x) => String(x.layer).includes(sp.lk));
  if (sp.ln) rows = rows.filter((x) => `${x.law} ${x.doc}`.includes(sp.ln));
  if (sp.ls) rows = rows.filter((x) => `${dutyText(x)} ${x.article_title}`.includes(sp.ls));
  const SHOW = 80;
  return (
    <Modal v={v} wide title={kind === "law" ? "관계 법령 의무이행 조치 - 불러오기" : "관계 법령상 법정교육 이수 - 불러오기"} crumb={CRUMB_MT}>
      <form method="get" className="us-filter">
        <input type="hidden" name="role" value={v.role} /><input type="hidden" name="site" value={v.site.site_id} /><input type="hidden" name="modal" value={kind} />
        <label>법령 구분 <input type="text" name="lk" defaultValue={sp.lk || ""} placeholder="법령 구분을 입력하세요" size={12} /></label>
        <label>법령명 <input type="text" name="ln" defaultValue={sp.ln || ""} placeholder="법령명을 입력하세요" size={14} /></label>
        <label>요약내용 <input type="text" name="ls" defaultValue={sp.ls || ""} placeholder="요약내용을 입력하세요" size={14} /></label>
        <label>용인 표시 <select name="mk" defaultValue={sp.mk || ""}><option value="">전체</option><option value="Y">용인 확정</option><option value="조건부">조건부</option></select></label>
        <label><input type="checkbox" name="ta" value="1" defaultChecked={all} /> 다른 관리대상 의무도 보기</label>
        <button className="use-bbtn">🔍 검색</button>
      </form>
      <form action={loadPlan.bind(null, kind)}>
        <CtxHidden v={v} />
        <div className="use-sec">의무 목록(원료·제조물) - {kind === "law" ? "관계법령 의무이행" : "관계법령 교육이수"}<span>총 {rows.length.toLocaleString()}건</span></div>
        <table className="us-tbl use-mtbl">
          <thead><tr><th className="use-chk"><CheckAll /></th><th>구분</th><th>법령구분</th><th>법령명</th><th>요약내용</th><th>조</th><th>항</th><th>용인 표시</th></tr></thead>
          <tbody>
            {rows.length ? rows.slice(0, SHOW).map((x) => {
              const [jo, hang] = splitArt(x.unit_label_ko);
              return (
                <tr key={x.duty_key}>
                  <td className="c"><input type="checkbox" name="pick" value={x.duty_key} /></td>
                  <td>{x.target_name}</td><td className="c">{layerKo(x.layer)}</td><td>{lawKo(x.doc)}</td>
                  <td>{dutyText(x)}</td><td className="c">{jo}</td><td className="c">{hang}</td>
                  <td className="c"><Tag tone={x.yongin_mark === "Y" ? "mark" : "cond"}>{markKo(x.yongin_mark)}</Tag></td>
                </tr>
              );
            }) : <tr><td colSpan={8}>검색결과가 없습니다.</td></tr>}
          </tbody>
        </table>
        {rows.length > SHOW && <p className="use-note">앞 {SHOW}건만 보입니다. 법령명·요약내용으로 좁혀 찾으세요.</p>}
        <div className="use-mfoot"><button className="use-bbtn">불러오기</button></div>
      </form>
    </Modal>
  );
}
