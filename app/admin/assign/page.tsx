// [400 · 교육자료 버전] SCR-022 [중대재해 담당부서(관리자)] 담당자 관리대상 지정
//  좌 = 사업장(총괄) 사용자 목록(권한 1000~3000) · 우 = 담당자별 사업장(중대산업재해: 용인시청 본청 안의 부서) / 담당자별 시설물(중대시민재해)
//  체크를 누르면 바로 저장된다(명세: 저장 단추 없음 — 체크 즉시 반영으로 추정).
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import AdminSide from "../_side";
import { disOf, DIS_LABEL, grants, kindLabel, objects, assignedOf } from "../_lib";
import { FACILITY_TYPES } from "../../law/_lib";
import { toggleAssign } from "../actions";
import { Pager, Count, SearchBox, Note, qs } from "../_ui";

export const dynamic = "force-dynamic";

export default async function AssignPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const d = disOf(sp.d);
  const role = sp.role || "gm";
  const civ = d === "civ";

  // 좌측 — 총괄 권한(1000~3000) 사용자
  const lq1 = (sp.o1 || "").trim(), lq2 = (sp.n1 || "").trim();
  const heads = (await grants(d)).filter((g) => g.level <= 3000 || civ);
  const users = heads.filter((g) => (!lq1 || g.p.dept.includes(lq1)) && (!lq2 || g.p.name.includes(lq2)));
  const cur = users.find((g) => g.staff_id === sp.u) || users[0];

  // 우측 — 관리대상
  const objs = await objects(d);
  const site = sp.site || "전체";
  const q = (sp.q || "").trim();
  const sites = civ ? FACILITY_TYPES.slice(1) : [...new Set(objs.map((o) => o.site))];
  const vis = objs.filter((o) => (site === "전체" || o.site === site) && (!q || o.name.includes(q)));
  const { ids, saved } = cur ? await assignedOf(d, cur, objs) : { ids: new Set<string>(), saved: false };
  const allOn = vis.length > 0 && vis.every((o) => ids.has(o.id));
  const onCnt = objs.filter((o) => ids.has(o.id)).length;

  const keep = { d, o1: lq1, n1: lq2, u: cur?.staff_id, site: site === "전체" ? "" : site, q };
  const self = qs("/admin/assign", keep);
  const unit = civ ? "개소" : "개소";

  return (
    <UsLayout side={<AdminSide d={d} page="assign" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">{DIS_LABEL[d]}</span> 담당자 관리대상 지정</h1>
      </div>
      {sp.ok && <Note>저장했습니다.</Note>}
      <div className="usb2-two usb2-two-a">
        <section>
          <h2 className="usb2-h2">{civ ? "시설물(총괄·담당) 사용자 목록" : "사업장(총괄) 사용자 목록"}</h2>
          <SearchBox>
            <form method="get" action="/admin/assign" className="usb2-sform">
              <input type="hidden" name="d" value={d} />
              <label>소속<input type="text" name="o1" defaultValue={lq1} placeholder="소속 부서 입력" /></label>
              <label>사용자명<input type="text" name="n1" defaultValue={lq2} /></label>
              <button className="usb2-ibtn" type="submit" title="검색">🔍</button>
            </form>
          </SearchBox>
          <Count n={users.length} unit="명" />
          <table className="us-tbl usb2-tl usb2-click">
            <thead><tr><th>사용자명</th><th>소속부서</th><th>연락처</th></tr></thead>
            <tbody>
              {users.map((g) => (
                <tr key={g.staff_id} className={g.staff_id === cur?.staff_id ? "usb2-sel" : ""}>
                  <td><Link href={qs("/admin/assign", { ...keep, u: g.staff_id })}>{g.p.name}</Link><div className="usb2-sub">{kindLabel(d, g)}</div></td>
                  <td>{g.p.dept}</td>
                  <td className="c">{g.p.phone}</td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={3} className="c usb2-empty">권한이 지정된 사용자가 없습니다 — 「담당자 권한지정」에서 먼저 지정하세요</td></tr>}
            </tbody>
          </table>
          <Pager total={users.length} size={50} page={1} href={() => self} />
        </section>

        <section>
          <h2 className="usb2-h2">{civ ? "담당자별 시설물" : "담당자별 사업장"}{cur && <span className="usb2-who"> — {cur.p.name}</span>}</h2>
          <SearchBox>
            <form method="get" action="/admin/assign" className="usb2-sform">
              <input type="hidden" name="d" value={d} /><input type="hidden" name="u" value={cur?.staff_id || ""} />
              <input type="hidden" name="o1" value={lq1} /><input type="hidden" name="n1" value={lq2} />
              <label>{civ ? "시설구분" : "사업장명"}
                <select name="site" defaultValue={site}>
                  <option value="전체">전체</option>
                  {sites.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label>{civ ? "시설물명" : "부서명"}<input type="text" name="q" defaultValue={q} placeholder={civ ? "시설물명을 입력하세요" : "부서명을 입력하세요"} /></label>
              <button className="usb2-ibtn" type="submit" title="검색">🔍</button>
            </form>
          </SearchBox>
          <div className="usb2-cntrow">
            <Count n={vis.length} unit={unit} />
            {cur && <span className="us-muted">지정 {onCnt.toLocaleString()}{unit}{saved ? "" : " · 권한에 맞춘 기본값"}</span>}
          </div>
          <form action={toggleAssign}>
            <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
            <input type="hidden" name="sid" value={cur?.staff_id || ""} /><input type="hidden" name="back" value={self} />
            <input type="hidden" name="ids" value={vis.map((o) => o.id).join(";")} />
            <div className="usb2-scroll">
              <table className="us-tbl usb2-tl">
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>
                      <button className={`usb2-ck${allOn ? " on" : ""}`} name="all" value={allOn ? "off" : "on"} disabled={!cur} title="전체선택">✔</button>
                    </th>
                    {civ ? <><th>시설구분</th><th>시설물명</th><th>주소</th></> : <><th>사업장명</th><th>부서명</th><th>주소</th></>}
                  </tr>
                </thead>
                <tbody>
                  {vis.map((o) => {
                    const on = ids.has(o.id);
                    return (
                      <tr key={o.id} className={on ? "usb2-onrow" : ""}>
                        <td className="c"><button className={`usb2-ck${on ? " on" : ""}`} name="k" value={o.id} disabled={!cur}>✔</button></td>
                        <td className="c">{o.site}</td>
                        <td>{o.name}</td>
                        <td>{o.addr}</td>
                      </tr>
                    );
                  })}
                  {!vis.length && <tr><td colSpan={4} className="c usb2-empty">조회된 대상이 없습니다</td></tr>}
                </tbody>
              </table>
            </div>
          </form>
        </section>
      </div>
    </UsLayout>
  );
}
