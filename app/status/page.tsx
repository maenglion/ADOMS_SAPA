// [400 · 교육자료 버전] SCR-010 — 「이행현황」 첫 화면은 중대산업재해(사업장) 취합 대상 설정으로 보낸다.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StatusIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(`/status/industrial${sp.role ? `?role=${sp.role}` : ""}`);
}
