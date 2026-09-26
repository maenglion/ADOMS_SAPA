// [캡처 v2] 설정 › 기관 정보(2026-09-23) — 기관 기본 정보 + 규모 숫자. 값은 고칠 수 있다.
import Link from "next/link";
import { ORG_FIELDS, ORG_SOURCE, orgProfile } from "@/lib/org";
import { depts, staff, assets, duties } from "@/lib/data";
import { Facts } from "@/components/Steps";
import { saveOrg } from "../org-actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 09-26 사용자: 메뉴 밖 화면 합치기 — 뺌. 같은 기관 정보(표 org_profile)를 관리자 › 중대시민재해 › 기본정보 관리가 보여 주고 고친다.
//   이 주소는 그리로 보낸다(역할 유지). 되돌리려면 ORG_MERGED 를 false 로.
const ORG_MERGED = true;

export default async function OrgPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (ORG_MERGED) redirect(`/admin/basic?d=civ&role=${encodeURIComponent(role)}`);   // 09-26 사용자: 메뉴 밖 화면 합치기 — 뺌
  const [p, dl, st, al, du] = await Promise.all([orgProfile(), depts(), staff(), assets({ limit: 100000 }), duties({ limit: 100000 })]);
  const edit = sp.edit === "1";
  const groups = [...new Set(ORG_FIELDS.map((f) => f.group))];
  const show = (k: string, unit?: string) => (p[k] ? `${p[k]}${unit ? " " + unit : ""}` : "—");

  return (
    <>
      <h1 className="v2h">기관 정보</h1>
      <div className="chips">
        <span className="badge">{p.org_name}</span>
        <span className="badge none">데모 — 공개 자료로 채움</span>
        {p.updated_at && <span className="badge none">고친 때 {p.updated_at}</span>}
        <span style={{ flex: 1 }} />
        {!edit && <Link className="btn" href={`/settings/org?role=${role}&edit=1`}>고치기</Link>}
      </div>
      {sp.saved && <p className="badge ok" style={{ marginTop: 8 }}>저장했습니다</p>}

      <Facts items={[
        { k: "부서", v: <b>{dl.length}</b> },
        { k: "직원 명부", v: <b>{st.length}</b> },
        { k: "관리대상(자산)", v: <Link href={`/settings/assets?role=${role}`}><b>{al.length.toLocaleString()}</b></Link> },
        { k: "걸리는 의무", v: <b>{du.length.toLocaleString()}</b> },
      ]} />

      {!edit ? (
        <div className="grid g3" style={{ marginTop: 12 }}>
          {groups.map((g) => (
            <div key={g} className="card">
              <h3>{g}</h3>
              <table className="v2t kv"><tbody>
                {ORG_FIELDS.filter((f) => f.group === g).map((f) => (
                  <tr key={f.key}>
                    <th style={{ width: "34%" }}>{f.label}</th>
                    <td title={ORG_SOURCE[f.key] ? `출처: ${ORG_SOURCE[f.key]}` : ""} style={{ whiteSpace: "normal" }}>{show(f.key, f.unit)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      ) : (
        <form action={saveOrg} className="card" style={{ marginTop: 12 }}>
          <input type="hidden" name="role" value={role} />
          {groups.map((g) => (
            <div key={g} style={{ marginBottom: 12 }}>
              <h3>{g}</h3>
              <div className="orgform">
                {ORG_FIELDS.filter((f) => f.group === g).map((f) => (
                  <label key={f.key} className={f.wide ? "wide" : ""}>
                    <span>{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
                    <input type="text" name={f.key} defaultValue={p[f.key] || ""} placeholder={ORG_SOURCE[f.key] || ""} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit">저장</button>
            <Link className="btn ghost" href={`/settings/org?role=${role}`}>취소</Link>
          </div>
        </form>
      )}
      <p className="muted" style={{ marginTop: 10, fontSize: ".85rem" }}>값에 마우스를 올리면 출처가 보입니다.</p>
    </>
  );
}
