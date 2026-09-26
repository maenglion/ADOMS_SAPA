// 09-25 사용자: 시스템 관리 — 첫 화면은 메뉴 관리로 보낸다.
import { redirect } from "next/navigation";

export default async function SystemIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(sp.role ? `/admin/system/menu?role=${sp.role}` : "/admin/system/menu");
}
