// [400 · 교육자료 버전] SCR-023 관리대상 현황(중대재해 담당부서·관리자) — 중대산업재해 사업장 기본정보 관리
// 명세 이미지 023: 사업장명·부서명(읽기전용) · 주소 · 업종분류(안)·업종분류 코드 → 안전보건관리체계 7항목 표 → 삭제처리 / 수정하기.
// 사업장은 용인시청 본청 하나(2026-09-24 사용자 지시), 부서는 그 소속. 7항목 처음 값은 안전보건 선임 현황(safety_org_role)에서 읽는다.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { readTable } from "@/lib/data";
import { AdminSide } from "../_side";
import { workplace, wsDepts, IND_CLASS, MGMT_ITEMS, MGMT_OPTS, MGMT_SOR } from "../_lib";
import { IndustryPick } from "../_client";
import { saveWsMgmt } from "../actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 09-26 사용자: 메뉴 밖 화면 합치기 — 뺌. 같은 화면(SCR-023)이 관리자 › 중대산업재해 › 사업장 기본정보 관리(/admin/basic?d=ind)에 있다.
//   이 주소는 그리로 보낸다 — 역할과 사업장(wp)·부서(dept) 쿼리를 그대로 넘긴다. 되돌리려면 WORKPLACE_MERGED 를 false 로.
const WORKPLACE_MERGED = true;

export default async function WorkplaceAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (WORKPLACE_MERGED) {   // 09-26 사용자: 메뉴 밖 화면 합치기 — 뺌
    const p = new URLSearchParams({ d: "ind", role });
    if (sp.wp) p.set("wp", sp.wp);
    if (sp.dept) p.set("dept", sp.dept);
    redirect(`/admin/basic?${p.toString()}`);
  }
  const wp = await workplace();
  const ds = await wsDepts(role === "ceo" ? "gm" : role);
  const dept = ds.find((d) => d.dept_id === sp.dept) || ds[0];
  if (!dept) return <p>관리할 부서가 없습니다.</p>;

  const saved = (await readTable("usb1_ws_mgmt", "dept_id")).find((r) => r.dept_id === dept.dept_id);
  const live = saved && saved.state !== "삭제" ? saved : undefined;
  const sor = await readTable("safety_org_role", "role_id");
  // 7항목 처음 값 — 기관 단위(규정·책임자·산업보건의·위원회)는 기관 줄, 부서 단위(안전·보건관리자·관리감독자)는 그 부서 줄
  const fromSor = (i: number) => {
    const name = MGMT_SOR[i];
    const r = sor.find((x) => x.role_item === name && x.dept_id === dept.dept_id) || sor.find((x) => x.role_item === name && x.scope === "기관");
    return r?.status || "";
  };
  const val = (i: number) => (live ? live[`m${i}`] ?? "" : fromSor(i));
  const self = (o: string) => `/targets/workplace?role=${role}&dept=${dept.dept_id}${o}`;

  return (
    <UsLayout side={<AdminSide role={role} />}>
      <div className="usb1-atitle">중대산업재해 <b>사업장 기본정보 관리</b></div>

      <form className="usb1-deptpick" action="/targets/workplace">
        <input type="hidden" name="role" value={role} />
        <label>부서 선택</label>
        <select name="dept" defaultValue={dept.dept_id}>
          {ds.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
        </select>
        <button className="usb1-btn-o" type="submit">보기</button>
        {sp.ok === "1" && <span className="usb1-ok-i">수정했습니다</span>}
        {sp.ok === "del" && <span className="usb1-ok-i">삭제처리했습니다</span>}
      </form>
      {saved?.state === "삭제" && <p className="usb1-note">이 부서의 기본정보는 삭제처리된 상태입니다. 「수정하기」로 다시 등록할 수 있습니다(기록은 지우지 않고 표시만 바꿉니다).</p>}

      <form action={saveWsMgmt} className="usb1-aform" key={`${dept.dept_id}:${saved?.updated_at || ""}:${saved?.state || ""}`}>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="dept_id" value={dept.dept_id} />
        <div className="usb1-f"><label className="usb1-lab">사업장명</label><div className="usb1-fv"><input type="text" readOnly value={wp.wp_name} className="usb1-ro" /></div></div>
        <div className="usb1-f"><label className="usb1-lab">부서명</label><div className="usb1-fv"><input type="text" readOnly value={dept.dept_name} className="usb1-ro" /></div></div>
        <div className="usb1-f"><label className="usb1-lab">주소</label><div className="usb1-fv"><input type="text" name="addr" defaultValue={live?.addr || wp.addr} className="usb1-blue" /></div></div>
        <IndustryPick options={IND_CLASS} cls={live?.ind_class ?? wp.ind_class ?? ""} code={live?.ind_code ?? wp.ind_code ?? ""} />

        <table className="usb1-mgmt">
          <tbody>
            {MGMT_ITEMS.map((label, i) => (
              <tr key={label}>
                <th>{label.replace(" (안전감독자)", "")}{label.includes("(안전감독자)") && <><br />(안전감독자)</>}</th>
                <td>
                  {/* TODO: 확인 — 명세는 현재값만 보여 선택지는 추정(판독불확실). 산업안전보건위원회는 명세에서 빈칸 */}
                  <select name={`m${i}`} defaultValue={val(i)} className="usb1-blue">
                    <option value=""></option>
                    {MGMT_OPTS[i].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="usb1-abtns">
          <Link href={self("&modal=del")} className="usb1-btn-red">삭제처리</Link>
          <button type="submit" className="usb1-btn-save">수정하기</button>
        </div>
      </form>

      {sp.modal === "del" && (
        <div className="us-modal-bg">
          <div className="us-modal">
            <div className="us-modal-h">삭제처리<Link href={self("")} style={{ color: "#fff" }}>✕</Link></div>
            <div className="us-modal-b">
              <p>「{dept.dept_name}」의 사업장 기본정보를 삭제처리합니까? 기록은 남고 「삭제」 표시만 붙습니다.</p>
              <form action={saveWsMgmt} className="usb1-abtns">
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="dept_id" value={dept.dept_id} />
                <input type="hidden" name="op" value="delete" />
                <Link href={self("")} className="usb1-btn-back">취소</Link>
                <button type="submit" className="usb1-btn-red">삭제처리</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </UsLayout>
  );
}
