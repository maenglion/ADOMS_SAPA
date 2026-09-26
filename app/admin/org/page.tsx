// 09-26 사용자: 「부서역할과 결재선은 관리자 화면에 다시 두자」
//  옛 「설정」(/settings — 교육자료 버전 이전 메뉴의 「설정 › 조직·담당자」, 교육자료 버전에서는 메뉴 밖 화면)의 「조직 · 담당자」 표를
//  09-26 메뉴 밖 화면 합치기 때 옮기지 못해 볼 곳이 없어졌다 → 관리자 › 조직 › 부서 역할·결재선으로 되살린다(조회 화면 · 쓰기 없음).
//  표 내용은 옛 화면 그대로(부서 · 역할 · 실제 소속 · 맡는 일 · 유관 부서 · 부서장 · 실무자 · 과제 수). 권한은 lib/perm.ts /admin 규칙(총괄·관리자).
import { UsLayout } from "@/components/us/Parts";
import { depts, staff, tasks } from "@/lib/data";
import AdminSide from "../_side";

export const dynamic = "force-dynamic";

export default async function AdminOrg() {
  const [d, s, t] = await Promise.all([depts(), staff(), tasks({ limit: 5000 })]);
  const rows = d.filter((x: any) => x.dept_id !== "D99");
  return (
    <UsLayout side={<AdminSide page="org" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">조직</span> 부서 역할·결재선</h1>
      </div>
      <p className="admf-lead">
        결재선 — 실무자(주무관) 제출 → 부서장 확인 → 총괄(중대재해예방팀) 승인 → 경영책임자(시장) 보고 확인.
        관련 부서가 겹치면 책임이 큰 한 곳에 두고, 함께 보는 부서는 「유관 부서」 칸에 적었습니다.
      </p>
      <div className="tbl-wrap">
        <table className="admo-t">
          <thead><tr><th>부서</th><th>역할</th><th>실제 소속</th><th>맡는 일</th><th>유관 부서</th><th>부서장</th><th>실무자</th><th className="num">과제</th></tr></thead>
          <tbody>
            {rows.map((x: any) => {
              const mem = s.filter((p: any) => p.dept_id === x.dept_id);
              const heads = mem.filter((p: any) => p.approval_level === "2" || p.approval_level === "3");
              const doers = mem.filter((p: any) => !p.approval_level || p.approval_level === "1");
              const n = t.filter((r: any) => r.dept_id === x.dept_id).length;
              return (
                <tr key={x.dept_id}>
                  <td><b>{x.dept_name}</b>{x.web_checked === "N" && <div><span className="badge warn" title="누리집 부서 목록에서 확인하지 못했다">소속 확인 필요</span></div>}</td>
                  <td><span className="badge">{x.dept_role}</span></td>
                  <td className="admo-s">{x.org_path || "-"}</td>
                  <td className="admo-s admo-w">{x.duties || "-"}</td>
                  <td className="admo-s admo-w muted">{x.related_note || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{heads.map((p: any) => <div key={p.staff_id}>{p.display_name}</div>)}</td>
                  <td>{doers.map((p: any) => p.display_name).join(" · ")}</td>
                  <td className="num">{n.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </UsLayout>
  );
}
