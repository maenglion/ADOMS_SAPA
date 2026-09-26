// [400 · 교육자료 버전] SCR-091 — 「통계 및 사례」 첫 화면은 중대재해 발생통계로 보낸다
import { redirect } from "next/navigation";

export default async function StatsHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(`/stats/occur?role=${encodeURIComponent(sp.role || "gm")}`);
}
