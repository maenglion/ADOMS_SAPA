// 09-25 사용자: 시스템 관리 › 코드 관리 — 화면에서 쓰는 공통 코드를 보고 추가 · 수정 · 사용 중지한다.
//  기준 = 명세 00 §6 공통 코드값 + 중대재해 발생통계 원장의 값(lib/codes.ts). 변경은 표 sys_code 에 한 줄씩 쌓는다(지우지 않음).
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import AdminSide from "../../_side";
import { Note } from "../../_ui";
import { CODE_SETS, codesOf } from "@/lib/codes";
import { staff } from "@/lib/data";
import { saveCode } from "../actions";

export const dynamic = "force-dynamic";

/** 지금 이 표를 읽는 화면(나머지 화면은 아직 자기 목록 — 옮기는 중) */
const USED_BY: Record<string, string> = { IND_CLASS: "관리자 › 사업장 기본정보 관리(업종분류)" };

export default async function CodeAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const cs = CODE_SETS.find((x) => x.id === sp.set) || CODE_SETS[0];
  const [list, st] = await Promise.all([codesOf(cs.id), staff()]);
  const nm = new Map(st.map((x: any) => [x.staff_id, x.display_name]));
  const counts = await Promise.all(CODE_SETS.map(async (x) => (await codesOf(x.id)).filter((c) => c.state === "on").length));

  return (
    <UsLayout side={<AdminSide page="system/code" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">시스템 관리</span> 코드 관리</h1>
      </div>
      {sp.ok === "add" && <Note>코드를 추가했습니다.</Note>}
      {sp.ok === "save" && <Note>수정했습니다.</Note>}
      {sp.ok === "off" && <Note>사용 중지했습니다. 목록에서 빠지고, 이미 저장된 자료의 값은 그대로 남습니다.</Note>}
      {sp.ok === "on" && <Note>다시 사용합니다.</Note>}
      {sp.err === "dup" && <Note>같은 값이 이미 있습니다.</Note>}
      {sp.err === "empty" && <Note>코드값을 입력하세요.</Note>}

      <div className="sysc-wrap">
        <nav className="sysc-sets">
          {CODE_SETS.map((x, i) => (
            <Link key={x.id} href={`/admin/system/code?set=${x.id}`} className={x.id === cs.id ? "on" : ""}>
              <span>{x.label}</span><small>{counts[i]}</small>
            </Link>
          ))}
        </nav>
        <section className="sysc-main">
          <h2 className="usb2-h2">{cs.label} <small className="us-muted">({cs.id} · 기준 {cs.basis})</small></h2>
          <p className="us-muted sysm-note">
            {USED_BY[cs.id] ? <>이 코드를 읽는 화면: {USED_BY[cs.id]}.</> : <>이 코드를 읽도록 옮기는 중인 화면이 있습니다 — 지금은 화면마다 목록을 따로 둡니다.</>}
            {" "}사용 중지한 값은 선택 목록에서 빠지고, 이미 저장된 자료의 값은 바뀌지 않습니다.
          </p>
          <table className="us-tbl sysm-tbl">
            <thead><tr><th>순서</th><th>코드값</th><th>설명</th><th>상태</th><th>마지막 변경</th><th>처리</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const fid = `c-${c.code_id}`;
                return (
                  <tr key={c.code_id} className={c.state === "off" ? "sysc-off" : ""}>
                    <td><input form={fid} type="number" name="sort" defaultValue={c.sort} className="sysm-num" /></td>
                    <td><input form={fid} type="text" name="value" defaultValue={c.value} /></td>
                    <td><input form={fid} type="text" name="note" defaultValue={c.note} placeholder={c.base ? "기본 코드" : ""} /></td>
                    <td className="c">{c.state === "on" ? <span className="sysm-ok">사용</span> : <span className="sysm-no">사용 중지</span>}</td>
                    <td className="us-muted">{c.at ? `${c.at} · ${nm.get(c.by) || c.by}` : "기본값"}</td>
                    <td className="c">
                      <form id={fid} action={saveCode} className="sysc-ops">
                        <input type="hidden" name="role" value={role} /><input type="hidden" name="set" value={cs.id} />
                        <input type="hidden" name="code_id" value={c.code_id} />
                        <button className="usb2-cbtn" name="op" value="save">수정</button>
                        {c.state === "on"
                          ? <button className="usb2-cbtn" name="op" value="off">사용 중지</button>
                          : <button className="usb2-cbtn" name="op" value="on">다시 사용</button>}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <form action={saveCode} className="sysc-add">
            <input type="hidden" name="role" value={role} /><input type="hidden" name="set" value={cs.id} /><input type="hidden" name="op" value="add" />
            <b>코드 추가</b>
            <label>코드값 <input type="text" name="value" required /></label>
            <label>순서 <input type="number" name="sort" className="sysm-num" placeholder="맨 뒤" /></label>
            <label>설명 <input type="text" name="note" /></label>
            <button className="us-btn" type="submit">추가</button>
          </form>
        </section>
      </div>
    </UsLayout>
  );
}
