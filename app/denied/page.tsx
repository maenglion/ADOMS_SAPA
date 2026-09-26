// 09-25 사용자: 권한 제어 — 권한이 없는 메뉴에 주소로 들어오면 미들웨어가 이 화면을 보여 준다(주소는 그대로).
//  쓰기(서버 액션)가 막혀도 여기로 온다(w=1). 규칙은 lib/perm.ts 한 곳.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { ruleFor, needText, normRole, USER_KIND } from "@/lib/perm";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function Denied({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const path = sp.path || "";
  const rule = ruleFor(path);
  const role = normRole(sp.role);
  return (
    <UsLayout>
      <div className="us-head"><h1 className="us-h1">접근 권한 안내</h1></div>
      <div className="perm-deny">
        <div className="perm-deny-ico" aria-hidden="true">🔒</div>
        {rule ? (
          <p className="perm-deny-t">이 메뉴(<b>{rule.menu}</b>)는 <b>{needText(rule)}</b> 권한이 필요합니다.</p>
        ) : (
          <p className="perm-deny-t">이 메뉴는 권한이 필요합니다.</p>
        )}
        {sp.w === "1" && <p className="perm-deny-s">저장하지 않았습니다.</p>}
        <p className="perm-deny-s">지금 이용자: {ROLE_LABEL[role] || role} ({USER_KIND[role]})</p>
        <div className="perm-deny-b">
          <Link href={`/?role=${role}`} className="usb2-obtn">대시보드로</Link>
        </div>
      </div>
    </UsLayout>
  );
}
