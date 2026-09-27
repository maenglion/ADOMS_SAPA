// [400 · 교육자료 버전] SCR-021 [중대재해 담당부서(관리자)] 중대산업재해·중대시민재해 담당자 권한지정
//  좌 = 사용자 지정대기 목록(직원 명부) · 우 = 사용자 지정완료 목록. 권한 = 1000~4000 × 재해유형(명세 00 §4-1).
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import AdminSide from "../_side";
import { disOf, DIS_LABEL, LEVELS, LEVEL_GROUP, people, grants, kindLabel, defaultLevel } from "../_lib";
import { grantRole, revokeRole, handover } from "../actions";
import { Pager, Count, SearchBox, Modal, Note, qs } from "../_ui";

export const dynamic = "force-dynamic";
const SIZE = 10;

export default async function RolePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const d = disOf(sp.d);
  const role = sp.role || "gm";
  const [ps, gs] = await Promise.all([people(), grants(d)]);
  const done = new Set(gs.map((g) => g.staff_id));

  // 좌측 — 지정대기(아직 이 재해유형 권한이 없는 사람)
  const lq1 = (sp.o1 || "").trim(), lq2 = (sp.n1 || "").trim();
  const wait = ps.filter((p) => !done.has(p.staff_id) && (!lq1 || p.dept.includes(lq1)) && (!lq2 || p.name.includes(lq2)));
  const p1 = Math.max(1, Number(sp.p1 || 1));
  // 우측 — 지정완료
  const rq1 = (sp.o2 || "").trim(), rq2 = (sp.n2 || "").trim();
  const fin = gs.filter((g) => (!rq1 || g.p.dept.includes(rq1)) && (!rq2 || g.p.name.includes(rq2)));
  const p2 = Math.max(1, Number(sp.p2 || 1));

  const keep = { d, o1: lq1, n1: lq2, p1, o2: rq1, n2: rq2, p2 };
  const self = qs("/admin/role", keep);
  const lv = LEVELS[d];

  return (
    <UsLayout side={<AdminSide d={d} page="role" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">{DIS_LABEL[d]}</span> 담당자 권한지정</h1>
      </div>
      {sp.ok === "add" && <Note>담당자로 지정했습니다.</Note>}
      {sp.ok === "sub" && <Note>부담당자로 지정했습니다.</Note>}
      {sp.ok === "off" && <Note>지정에서 제외했습니다.</Note>}
      {sp.ok === "handover" && <Note>권한을 인계했습니다.</Note>}
      {sp.err === "handover" && <Note>넘기는 사람과 받는 사람을 다르게 고르세요.</Note>}

      <div className="usb2-two">
        {/* ── 사용자 지정대기 목록 ── */}
        <section>
          <h2 className="usb2-h2">사용자 지정대기 목록</h2>
          <SearchBox>
            <form method="get" action="/admin/role" className="usb2-sform">
              <input type="hidden" name="d" value={d} />
              <input type="hidden" name="o2" value={rq1} /><input type="hidden" name="n2" value={rq2} />
              <label>소속<input type="text" name="o1" defaultValue={lq1} placeholder="소속 부서 입력" /></label>
              <label>사용자명<input type="text" name="n1" defaultValue={lq2} /></label>
              <button className="usb2-ibtn us-search-btn" type="submit">검색</button>
              <Link className="usb2-obtn" href={qs("/admin/role", { ...keep, modal: "handover" })}>권한인계</Link>
            </form>
          </SearchBox>
          <form action={grantRole}>
            <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
            <input type="hidden" name="back" value={self} />
            <div className="usb2-cntrow">
              <Count n={wait.length} unit="명" />
              <label className="usb2-lv">부여 권한
                <select name="lv" defaultValue="">
                  <option value="">소속에 맞춤</option>
                  {Object.entries(lv).map(([k, v]) => <option key={k} value={k}>{k} {v}</option>)}
                </select>
              </label>
            </div>
            <table className="us-tbl usb2-tl">
              <thead><tr><th>사용자명</th><th>소속부서</th><th>연락처</th><th>실·국·본부<br />담당자 지정</th><th>부담당자<br />지정</th></tr></thead>
              <tbody>
                {wait.slice((p1 - 1) * SIZE, p1 * SIZE).map((p) => (
                  <tr key={p.staff_id}>
                    <td>{p.name}</td>
                    <td className="usb2-ell" title={p.dept}>{p.dept}</td>
                    <td className="c">{p.phone}</td>
                    <td className="c"><button className="usb2-cbtn" name="add" value={p.staff_id} title={`기본 권한 ${defaultLevel(p, p.dept_role)}`}>추가</button></td>
                    <td className="c"><button className="usb2-cbtn" name="sub" value={p.staff_id}>지정</button></td>
                  </tr>
                ))}
                {!wait.length && <tr><td colSpan={5} className="c usb2-empty">지정대기 사용자가 없습니다</td></tr>}
              </tbody>
            </table>
          </form>
          <Pager total={wait.length} size={SIZE} page={p1} href={(p) => qs("/admin/role", { ...keep, p1: p })} />
        </section>

        {/* ── 사용자 지정완료 목록 ── */}
        <section>
          <h2 className="usb2-h2">사용자 지정완료 목록</h2>
          <SearchBox>
            <form method="get" action="/admin/role" className="usb2-sform">
              <input type="hidden" name="d" value={d} />
              <input type="hidden" name="o1" value={lq1} /><input type="hidden" name="n1" value={lq2} />
              <label>소속<input type="text" name="o2" defaultValue={rq1} placeholder="소속 부서 입력" /></label>
              <label>사용자명<input type="text" name="n2" defaultValue={rq2} /></label>
              <button className="usb2-ibtn us-search-btn" type="submit">검색</button>
            </form>
          </SearchBox>
          <Count n={fin.length} unit="명" />
          <table className="us-tbl usb2-tl">
            <thead><tr><th>담당구분</th><th>이름</th><th>소속부서</th><th>연락처</th><th></th></tr></thead>
            <tbody>
              {fin.slice((p2 - 1) * SIZE, p2 * SIZE).map((g) => (
                <tr key={g.rid}>
                  <td><span className="usb2-lvtag" title={LEVEL_GROUP(g.level)}>{g.level}</span> {kindLabel(d, g)}</td>
                  <td>{g.p.name}</td>
                  <td className="usb2-ell" title={g.p.dept}>{g.p.dept}</td>
                  <td className="c">{g.p.phone}</td>
                  <td className="c">
                    <form action={revokeRole}>
                      <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
                      <input type="hidden" name="sid" value={g.staff_id} /><input type="hidden" name="back" value={self} />
                      <button className="usb2-cbtn">제외</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!fin.length && <tr><td colSpan={5} className="c usb2-empty">지정된 사용자가 없습니다</td></tr>}
            </tbody>
          </table>
          <Pager total={fin.length} size={SIZE} page={p2} href={(p) => qs("/admin/role", { ...keep, p2: p })} />

          <div className="usb2-legend">
            <b>권한 구분({DIS_LABEL[d]})</b>
            <ul>{Object.entries(lv).map(([k, v]) => <li key={k}><span className="usb2-lvtag">{k}</span> {v} <span className="us-muted">— {LEVEL_GROUP(Number(k))}</span></li>)}</ul>
          </div>
        </section>
      </div>

      {sp.modal === "handover" && (
        <Modal title="권한인계" close={self}>
          <form action={handover} className="usb2-form">
            <input type="hidden" name="d" value={d} /><input type="hidden" name="role" value={role} />
            <input type="hidden" name="back" value={self} />
            <label>넘기는 사람(지정완료)
              <select name="from" required defaultValue="">
                <option value="" disabled>선택하세요</option>
                {gs.map((g) => <option key={g.staff_id} value={g.staff_id}>{g.p.name} · {g.p.dept} · {kindLabel(d, g)}</option>)}
              </select>
            </label>
            <label>받는 사람
              <select name="to" required defaultValue="">
                <option value="" disabled>선택하세요</option>
                {ps.filter((p) => !done.has(p.staff_id)).map((p) => <option key={p.staff_id} value={p.staff_id}>{p.name} · {p.dept}</option>)}
              </select>
            </label>
            <p className="us-muted usb2-small">넘기는 사람의 권한과 관리대상이 받는 사람에게 그대로 옮겨지고, 넘기는 사람은 지정완료 목록에서 빠집니다.</p>
            <div className="usb2-actions"><Link className="us-btn w" href={self}>취소</Link><button className="us-btn g" type="submit">인계</button></div>
          </form>
        </Modal>
      )}
    </UsLayout>
  );
}
