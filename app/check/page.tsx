// [400 · 교육자료 버전] 이행점검 첫 화면 — 사업장 트랙 취합 대상 설정(SCR-089)으로 보낸다.
import { redirect } from "next/navigation";

export default async function CheckHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(`/check/ws?role=${sp.role || "gm"}`);
}
