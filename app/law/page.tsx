// [400 · 교육자료 버전] SCR-034 법 의무사항 — 첫 화면은 사업장 트랙으로 보낸다.
import { redirect } from "next/navigation";

export default async function LawIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(sp.role ? `/law/ws?role=${sp.role}` : "/law/ws");
}
