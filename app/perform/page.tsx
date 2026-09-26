// [400 · 교육자료 버전] SCR-036 의무이행(실적증빙) — 대메뉴 첫 화면: 사업장 트랙(/perform/ws)으로 보낸다.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PerformRoot({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => v && p.set(k, v));
  const qs = p.toString();
  redirect(`/perform/ws${qs ? `?${qs}` : ""}`);
}
