// [400 · 교육자료 버전] SCR-075 의무이행(실적증빙) — 원료·제조물 트랙 첫 화면: 첫 단계(안전인력 확보)로 보낸다.
import { redirect } from "next/navigation";
import { STEPS } from "@/lib/us/tracks";

export const dynamic = "force-dynamic";

export default async function PerformMt({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  Object.entries(sp).forEach(([k, v]) => v && p.set(k, v));
  const qs = p.toString();
  redirect(`/perform/mt/${STEPS.mt[0].key}${qs ? `?${qs}` : ""}`);
}
