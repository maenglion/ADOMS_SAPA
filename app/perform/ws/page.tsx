// [400 · 교육자료 버전] SCR-036 의무이행(실적증빙) — 사업장 트랙 첫 화면: 첫 단계(안전·보건 목표 및 경영방침 설정)로 보낸다.
import { redirect } from "next/navigation";
import { STEPS } from "@/lib/us/tracks";

export const dynamic = "force-dynamic";

export default async function PerformWs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => v && p.set(k, v));
  const qs = p.toString();
  redirect(`/perform/ws/${STEPS.ws[0].key}${qs ? `?${qs}` : ""}`);
}
