// [400 · 교육자료 버전] SCR-024 중대산업재해 · SCR-025 중대시민재해 관련법령 등록/관리
//  등록 법령 = 우리 의무 목록(duties)의 법령 문서를 대상 구분(·대상 유형)별로 묶은 것 + 신규 등록 − 목록에서 제외.
//  「신규」 = 법령 검색 모달(의무 목록의 법령에서 찾는다). 행을 누르면 그 법령의 의무를 보고 제외·다시 등록할 수 있다.
import Link from "next/link";
import LawChangeNote from "@/app/law/changes/_parts/Note";
import { UsLayout } from "@/components/us/Parts";
import { duties } from "@/lib/data";
import AdminSide from "../_side";
import { disOf, DIS_LABEL, lawRegistry, AREA_LABEL, catOf, catLabel } from "../_lib";
import { FACILITY_TYPES, kindOf, tname } from "../../law/_lib";
import { AutoForm } from "../../stats/_parts/Client";
import { MT_TYPES, mtTypeOf } from "../../stats/_parts/data";
import { registerLaw, toggleLaw } from "../actions";
import { Pager, Count, Modal, Note, qs } from "../_ui";

export const dynamic = "force-dynamic";
const SIZE = 15;

export default async function AdminLaw({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const d = disOf(sp.d);
  const role = sp.role || "gm";
  const civ = d === "civ";
  const q = (sp.q || "").trim();
  // 09-25 사용자: 중대시민재해 대상 구분에 공중교통수단 추가(관리대상 TG14) · 「원료 및 제조물」 → 「원료·제조물」(다른 화면과 같게, 옛 주소도 받음)
  const TGTS = ["전체", "공중이용시설", "공중교통수단", "원료·제조물"];
  const tgt0 = sp.tgt === "원료 및 제조물" ? "원료·제조물" : sp.tgt;
  const tgt = civ ? (TGTS.includes(tgt0) ? tgt0 : "전체") : "사업장";       // 대상 구분(1차)
  const fac = sp.fac || "전체";                        // 시설 세분류(2차 — 공중이용시설일 때만)
  const mt = (MT_TYPES as readonly string[]).includes(sp.mt) ? sp.mt : "전체";   // 원료·제조물 세부(2차 — 09-25 사용자: 1차를 바꾸면 2차도 그에 맞게)
  const showOff = sp.off === "1";
  const isTransit = (r: { area: string; target_code: string }) => r.area === "F" && r.target_code === "TG14";

  let rows = await lawRegistry(d, q);
  if (civ && tgt === "공중이용시설") rows = rows.filter((r) => r.area === "F" && !isTransit(r));
  if (civ && tgt === "공중교통수단") rows = rows.filter((r) => isTransit(r));
  if (civ && tgt === "원료·제조물") rows = rows.filter((r) => r.area === "M" && (mt === "전체" || mtTypeOf(r) === mt));
  if (civ && (tgt === "전체" || tgt === "공중이용시설") && fac !== "전체") rows = rows.filter((r) => r.area === "F" && !isTransit(r) && (catOf(r.target_code).includes(fac) || catOf(r.target_code).includes("공통")));
  const offN = rows.filter((r) => !r.on).length;
  if (!showOff) rows = rows.filter((r) => r.on);
  const page = Math.max(1, Number(sp.p || 1));
  const keep = { d, q, tgt: civ && tgt !== "전체" ? tgt : "", fac: fac !== "전체" && (tgt === "전체" || tgt === "공중이용시설") ? fac : "", mt: mt !== "전체" && tgt === "원료·제조물" ? mt : "", off: showOff ? "1" : "", p: page };
  const self = qs("/admin/law", keep);
  const typeText = (r: { area: string; target_code: string; target_name: string }) =>
    r.area === "M" ? mtTypeOf(r)   // 09-25: 원료·제조물은 물질·제품 구분으로(관리대상 시설 이름 대신)
      : r.area === "F" && r.target_code !== "TG14" ? `${catLabel(r.target_code)}-${tname(r.target_name)}` : tname(r.target_name);

  return (
    <UsLayout side={<AdminSide d={d} page="law" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">{DIS_LABEL[d]}</span> 관계 법령 관리</h1>
      </div>
      <LawChangeNote role={role} />
      {sp.ok === "reg" && <Note>법령을 등록했습니다.</Note>}
      {sp.ok === "off" && <Note>목록에서 제외했습니다(「제외한 법령 보기」에서 다시 등록할 수 있습니다).</Note>}
      {sp.ok === "on" && <Note>다시 등록했습니다.</Note>}

      {/* 라디오를 누르면 곧바로 다시 조회 — 1차(대상 구분)를 바꾸면 2차 구분도 그에 맞게 바뀐다(09-25 사용자) */}
      <AutoForm action="/admin/law" className="usb2-lawbox">
        <input type="hidden" name="d" value={d} />
        <div className="usb2-lawbox-l">법령 목록</div>
        <div className="usb2-lawbox-r">
          <div className="usb2-lrow">
            <span className="usb2-llab">대상 구분</span>
            {civ ? (
              <div>
                <div className="usb2-radios">
                  {TGTS.map((x) => (
                    <label key={x}><input type="radio" name="tgt" value={x} defaultChecked={x === tgt} /> {x}</label>
                  ))}
                </div>
                {/* 2차 구분 — 공중이용시설: 시설 세분류 · 원료·제조물: 물질·제품 구분 · 공중교통수단: 없음 */}
                {(tgt === "전체" || tgt === "공중이용시설") && (
                  <div className="usb2-radios usb2-radios-s">
                    {FACILITY_TYPES.map((x) => (
                      <label key={x}><input type="radio" name="fac" value={x} defaultChecked={x === fac} /> {x}</label>
                    ))}
                  </div>
                )}
                {tgt === "원료·제조물" && (
                  <div className="usb2-radios usb2-radios-s">
                    {["전체", ...MT_TYPES].map((x) => (
                      <label key={x}><input type="radio" name="mt" value={x} defaultChecked={x === mt} /> {x}</label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="usb2-radios"><label><input type="checkbox" checked readOnly /> 사업장</label></div>
            )}
          </div>
          <div className="usb2-lrow">
            <span className="usb2-llab">법령 및 내용</span>
            <input type="text" name="q" defaultValue={q} placeholder="법령 및 내용을 입력하세요" className="usb2-wide" />
            <button className="usb2-sbtn us-search-btn" type="submit">검색</button>
          </div>
        </div>
      </AutoForm>

      <div className="usb2-cntrow">
        <Count n={rows.length} unit="건" />
        <div className="us-flex">
          {offN > 0 && <Link className="us-btn-s" href={qs("/admin/law", { ...keep, off: showOff ? "" : "1", p: 1 })}>{showOff ? "제외한 법령 숨기기" : `제외한 법령 보기(${offN})`}</Link>}
          <Link className="usb2-obtn" href={qs("/admin/law", { ...keep, modal: "new" })}>신규</Link>
        </div>
      </div>
      <table className="us-tbl usb2-click usb2-lawtbl">
        <thead>
          <tr><th style={{ width: "18%" }}>대상 구분</th><th style={{ width: "26%" }}>{civ ? "대상 유형" : "적용 구분"}</th><th>법령명</th><th style={{ width: 110 }}>법령구분</th></tr>
        </thead>
        <tbody>
          {rows.slice((page - 1) * SIZE, page * SIZE).map((r) => (
            <tr key={r.key} className={r.on ? "" : "usb2-off"}>
              <td className="c">{civ ? (isTransit(r) ? "공중교통수단" : r.area === "F" ? "공중이용시설" : AREA_LABEL[r.area]) : AREA_LABEL[r.area]}</td>
              <td className="c">{civ ? typeText(r) : r.apply}</td>
              <td>
                <Link href={qs("/admin/law", { ...keep, modal: "view", k: r.key })}>{r.doc}</Link>
                <span className="usb2-dn">의무 {r.n.toLocaleString()}건{r.y ? ` · 확정 ${r.y.toLocaleString()}` : ""}{r.auto ? "" : " · 신규 등록"}</span>
              </td>
              <td className="c">{kindOf(r.layer)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="c usb2-empty">등록된 법령이 없습니다</td></tr>}
        </tbody>
      </table>
      <Pager total={rows.length} size={SIZE} page={page} href={(p) => qs("/admin/law", { ...keep, p })} />

      {sp.modal === "view" && sp.k && <LawView d={d} k={sp.k} close={self} role={role} civ={civ} />}
      {sp.modal === "new" && <LawNew d={d} q={sp.mq || ""} close={self} role={role} keep={keep} />}
    </UsLayout>
  );
}

/** 행 상세 — 그 법령 문서의 의무(우리 의무 목록)와 제외·다시 등록 */
async function LawView({ d, k, close, role, civ }: { d: "ind" | "civ"; k: string; close: string; role: string; civ: boolean }) {
  const reg = (await lawRegistry(d)).find((r) => r.key === k);
  if (!reg) return null;
  const rows = (await duties({ area: reg.area, limit: 1000000 })).filter((r) => r.doc === reg.doc && (!reg.target_code || r.target_code === reg.target_code));
  return (
    <Modal title={`${reg.doc} — 의무 목록`} close={close} wide>
      <p className="usb2-small">
        {AREA_LABEL[reg.area]}{civ && reg.target_name ? ` · ${tname(reg.target_name)}` : ""} · {kindOf(reg.layer)} · 의무 {rows.length.toLocaleString()}건
        (확정 {rows.filter((r) => r.yongin_mark === "Y").length.toLocaleString()} · 조건부 {rows.filter((r) => r.yongin_mark !== "Y").length.toLocaleString()})
      </p>
      <table className="us-tbl">
        <thead><tr><th>조문</th><th>의무</th><th>구분</th></tr></thead>
        <tbody>
          {rows.slice(0, 50).map((r) => (
            <tr key={r.duty_key}>
              <td>{r.unit_label_ko}</td>
              <td><Link href={`/duties/${r.duty_key}`}>{r.duty_name}</Link></td>
              <td className="c">{r.yongin_mark === "Y" ? "확정" : "조건부"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="c usb2-empty">의무 목록에 이 조합의 의무가 없습니다(신규 등록한 법령)</td></tr>}
        </tbody>
      </table>
      {rows.length > 50 && <p className="us-muted usb2-small">… 외 {(rows.length - 50).toLocaleString()}건</p>}
      <form action={toggleLaw} className="usb2-actions">
        <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
        <input type="hidden" name="key" value={k} /><input type="hidden" name="back" value={close} />
        {!civ && (
          <label className="usb2-lv">적용 구분
            <select name="apply" defaultValue={reg.apply}>
              <option value="중대재해처벌법 의무사항">중대재해처벌법 의무사항</option>
              <option value="관계 법령 의무사항">관계 법령 의무사항</option>
            </select>
          </label>
        )}
        {reg.on
          ? <button className="usb2-redbtn" name="state" value="off">목록에서 제외</button>
          : <button className="usb2-bluebtn" name="state" value="on">다시 등록</button>}
        {!civ && reg.on && <button className="us-btn w" name="state" value="on">적용 구분 저장</button>}
      </form>
    </Modal>
  );
}

/** 신규 — 법령 검색(우리 의무 목록의 법령 문서에서) → 대상 구분·대상 유형을 골라 등록 */
async function LawNew({ d, q, close, role, keep }: { d: "ind" | "civ"; q: string; close: string; role: string; keep: Record<string, any> }) {
  const all = await duties({ q: q || undefined, limit: 1000000 });
  const docs = new Map<string, { doc: string; law: string; layer: string; n: number }>();
  for (const r of all) {
    const g = docs.get(r.doc) || { doc: r.doc, law: r.law, layer: r.layer, n: 0 };
    g.n++; docs.set(r.doc, g);
  }
  const list = [...docs.values()].sort((a, b) => b.n - a.n).slice(0, 25);
  // 대상 유형 고르기 — 의무 목록의 중대시민재해(공중이용시설·원료·제조물) 관리대상 유형
  const tgts = d === "civ"
    ? [...new Map((await duties({ limit: 1000000 })).filter((r) => r.area !== "I").map((r) => [`${r.area}|${r.target_code}`, r])).values()]
        .sort((a, b) => `${a.area}${a.target_code}`.localeCompare(`${b.area}${b.target_code}`))
    : [];
  return (
    <Modal title="법령 검색" close={close} wide>
      <form method="get" action="/admin/law" className="usb2-search">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={String(v)} /> : null))}
        <input type="hidden" name="modal" value="new" />
        <input type="text" name="mq" defaultValue={q} placeholder="법령 및 내용을 입력하세요" />
        <button className="usb2-sbtn us-search-btn" type="submit">검색</button>
      </form>
      <p className="us-muted usb2-small">의무 목록에 있는 법령 문서에서 찾습니다(의무 수가 많은 순 25건).</p>
      <table className="us-tbl">
        <thead><tr><th>법령명</th><th>법령구분</th><th>의무 수</th><th style={{ width: d === "civ" ? 360 : 90 }}>{d === "civ" ? "대상 구분 · 대상 유형" : ""}</th></tr></thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.doc}>
              <td>{x.doc}{x.law && x.law !== x.doc ? <div className="usb2-sub">{x.law}</div> : null}</td>
              <td className="c">{kindOf(x.layer)}</td>
              <td className="n">{x.n.toLocaleString()}</td>
              <td>
                <form action={registerLaw} className="us-flex">
                  <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
                  <input type="hidden" name="doc" value={x.doc} />
                  {d === "civ" ? (
                    <select name="tsel" defaultValue="" required
                      /* 대상 구분|대상 유형 코드를 한 칸으로 고른다 */>
                      <option value="" disabled>선택</option>
                      {tgts.map((r: any) => <option key={`${r.area}|${r.target_code}`} value={`${r.area}|${r.target_code}`}>{AREA_LABEL[r.area]} · {tname(r.target_name)}</option>)}
                    </select>
                  ) : <input type="hidden" name="area" value="I" />}
                  <button className="us-btn-s">등록</button>
                </form>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={4} className="c usb2-empty">찾은 법령이 없습니다</td></tr>}
        </tbody>
      </table>
    </Modal>
  );
}
