// [400 · 교육자료 버전] 관리자 — 첫 화면은 중대산업재해 담당자 권한지정(SCR-021)으로 보낸다.
// 09-25 사용자: 권한 제어 — 권한지정은 총괄만이라, 관리자(mgr)는 담당자 관리대상 지정으로 보낸다.
import { redirect } from "next/navigation";
import { canAccess } from "@/lib/perm";
import { currentRole } from "@/lib/perm_server";

export default async function AdminIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || (await currentRole());
  const first = canAccess(role, "/admin/role") ? "/admin/role?d=ind" : "/admin/assign?d=ind";
  redirect(sp.role ? `${first}&role=${sp.role}` : first);
}
