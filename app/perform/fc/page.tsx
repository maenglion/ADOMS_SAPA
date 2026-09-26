// [400 · 교육자료 버전] SCR-057 의무이행(실적증빙) 공중이용시설·공중교통수단 — 첫 단계(안전인력 확보)로 보낸다(묶음 D)
import { redirect } from "next/navigation";
import { STEPS } from "@/lib/us/tracks";

export const dynamic = "force-dynamic";

export default async function FcIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  redirect(`/perform/fc/${STEPS.fc[0].key}${q ? `?${q}` : ""}`);
}
