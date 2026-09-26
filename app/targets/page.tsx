// [400 · 교육자료 버전] 관리대상 현황 첫 화면 — 기본정보 › 사업장(SCR-027)으로 보낸다.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Targets({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(`/targets/basic?t=ws&role=${encodeURIComponent(sp.role || "gm")}`);
}
