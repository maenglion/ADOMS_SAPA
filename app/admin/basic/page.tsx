// [400 · 교육자료 버전] SCR-023 [중대재해 담당부서(관리자)] 중대산업재해 사업장 기본정보 등록/관리
//  중대산업재해: 사업장(용인시청 본청) × 부서별 기본정보 + 안전보건관리체계 7항목(제정·지정·선임·위촉)
//  중대시민재해 「기본정보 관리」: 명세에 화면 컷이 없어 기관 기본정보(설정 › 기관 정보와 같은 표)를 이 모양으로 옮겼다.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { depts, type Row } from "@/lib/data";
import { ORG_FIELDS, orgProfile } from "@/lib/org";
import AdminSide from "../_side";
import { disOf, DIS_LABEL, basicOf, MGMT, IND_CLASS } from "../_lib";
import { HQ_NAME, HQ_ADDR } from "../../law/_lib";
import { saveBasic, saveOrgBasic } from "../actions";
import { workplaces, HQ_WP } from "../../targets/_lib";
import { Note } from "../_ui";
import { codeValues } from "@/lib/codes";

export const dynamic = "force-dynamic";

export default async function BasicPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const d = disOf(sp.d);
  const role = sp.role || "gm";
  return (
    <UsLayout side={<AdminSide d={d} page="basic" />}>
      {d === "ind" ? <IndBasic sp={sp} role={role} /> : <CivBasic sp={sp} role={role} />}
    </UsLayout>
  );
}

async function IndBasic({ sp, role }: { sp: Record<string, string>; role: string }) {
  // 09-24 사용자: 사업장 20곳 — 본청만 있던 것을 사업장 선택으로. 본청은 부서별(지금 부서가 모두 본청 소속), 나머지 19곳은 사업장 단위 한 장.
  const wps = await workplaces();
  const wp = wps.find((w: Row) => w.wp_id === sp.wp) || wps.find((w: Row) => w.wp_id === HQ_WP) || wps[0];
  const isHq = !wp || wp.wp_id === HQ_WP;
  const dl = (await depts()).filter((x: Row) => x.dept_id !== "D99");
  const dept = dl.find((x: Row) => x.dept_id === sp.dept) || dl[0];
  const key = isHq ? dept.dept_id : wp.wp_id;
  const b = (await basicOf(key)) || {};
  const cls = b.ind_class || wp?.ind_class || "공공행정";
  const code = b.ind_code || wp?.ind_code || IND_CLASS[cls] || "";
  const indClasses = await codeValues("IND_CLASS");
  const siteName = wp?.wp_name || HQ_NAME;
  const siteAddr = b.addr || wp?.addr || HQ_ADDR;
  return (
    <>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">중대산업재해</span> 사업장 기본정보 관리</h1>
        <form method="get" action="/admin/basic" className="usb2-deptpick">
          <input type="hidden" name="d" value="ind" />
          <input type="hidden" name="role" value={role} />
          <label>사업장
            <select name="wp" defaultValue={wp?.wp_id}>
              {wps.map((w: Row) => <option key={w.wp_id} value={w.wp_id}>{w.wp_name}</option>)}
            </select>
          </label>
          {isHq && (
            <label>부서 선택
              <select name="dept" defaultValue={dept.dept_id}>
                {dl.map((x: Row) => <option key={x.dept_id} value={x.dept_id}>{x.dept_name}</option>)}
              </select>
            </label>
          )}
          <button className="us-btn w" type="submit">조회</button>
        </form>
      </div>
      {!isHq && (
        <Note>{wp.wp_kind} · {wp.confirm_state || "확인필요"} — 이 사업장에 속한 부서와 이행 과제는 용인시 확인 뒤 정합니다. 지금은 사업장 단위로 기본정보만 적습니다.{wp.site_note ? ` (${wp.site_note})` : ""}</Note>
      )}
      {sp.ok === "save" && <Note>수정했습니다.</Note>}
      {sp.ok === "del" && <Note>삭제처리했습니다(입력값을 비웠습니다).</Note>}
      {b.at && <p className="us-muted usb2-small">마지막 수정 {b.at}</p>}

      <form action={saveBasic} className="usb2-basic">
        <input type="hidden" name="dept_id" value={key} /><input type="hidden" name="role" value={role} />
        <input type="hidden" name="wp_id" value={wp?.wp_id || HQ_WP} /><input type="hidden" name="site_name" value={siteName} /><input type="hidden" name="site_addr" value={wp?.addr || HQ_ADDR} />
        <div className="usb2-frow"><label>사업장명</label><input type="text" value={siteName} readOnly className="ro" /></div>
        <div className="usb2-frow"><label>부서명</label><input type="text" value={isHq ? dept.dept_name : (wp.org_note || "용인시 확인 필요")} readOnly className="ro" /></div>
        <div className="usb2-frow"><label>주소</label><input type="text" name="addr" defaultValue={siteAddr} placeholder="주소(누리집에 없음 — 용인시 확인 필요)" className="blue" /></div>
        <div className="usb2-frow usb2-frow2">
          <label>업종분류(안) (한국표준산업분류가분)</label>
          {/* 09-25 사용자: 코드 관리 — 업종 분류는 공통 코드 표(시스템 관리 › 코드 관리 IND_CLASS)에서 읽는다. 저장된 값이 목록에 없으면 그 값도 보인다 */}
          <select name="ind_class" defaultValue={cls} className="blue">
            {[...new Set([...indClasses, ...(cls ? [cls] : [])])].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label>업종분류 코드</label>
          <input type="text" name="ind_code" defaultValue={code} placeholder="업종분류 코드" />
        </div>

        <table className="usb2-mgmt">
          <tbody>
            {MGMT.map((m) => (
              <tr key={m.key}>
                <th>{m.label}</th>
                <td>
                  <select name={m.key} defaultValue={b[m.key] || ""} className="blue">
                    <option value=""></option>
                    {m.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usb2-actions usb2-right">
          <button className="usb2-redbtn" name="delete" value="Y" formNoValidate>삭제처리</button>
          <button className="usb2-bluebtn" type="submit">수정하기</button>
        </div>
      </form>
      <p className="us-muted usb2-small">업종분류 코드는 공공행정(84113)만 미리 채웁니다. 다른 업종은 한국표준산업분류에서 확인해 적어 주세요.</p>
    </>
  );
}

async function CivBasic({ sp, role }: { sp: Record<string, string>; role: string }) {
  const p = await orgProfile();
  const groups = [...new Set(ORG_FIELDS.map((f) => f.group))];
  return (
    <>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">중대시민재해</span> 기본정보 관리</h1>
      </div>
      {sp.ok === "save" && <Note>수정했습니다.</Note>}
      <form action={saveOrgBasic} className="usb2-basic">
        <input type="hidden" name="role" value={role} />
        {groups.map((g) => (
          <div key={g}>
            <h2 className="usb2-h2">{g}</h2>
            {ORG_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="usb2-frow">
                <label>{f.label}{f.unit ? ` (${f.unit})` : ""}</label>
                <input type="text" name={f.key} defaultValue={p[f.key] || ""} className={f.key === "org_name" ? "ro" : "blue"} readOnly={f.key === "org_name"} />
              </div>
            ))}
          </div>
        ))}
        <div className="usb2-actions usb2-right">
          <Link className="us-btn w" href="/targets/basic?t=fc">공중이용시설 기본정보</Link>
          <button className="usb2-bluebtn" type="submit">수정하기</button>
        </div>
      </form>
      {p.updated_at && <p className="us-muted usb2-small">마지막 수정 {p.updated_at}</p>}
    </>
  );
}
