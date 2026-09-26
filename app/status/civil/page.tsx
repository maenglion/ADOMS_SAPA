// [400 · 교육자료 버전] SCR-014 · 015 · 016 · 017 — 이행현황 › 중대시민재해(공중이용시설·공중교통수단 t=fc · 원료·제조물 t=mt)
import StatusPage from "../_parts/StatusPage";

export const dynamic = "force-dynamic";

export default async function Civil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = sp.t === "mt" ? "mt" : "fc";
  return <StatusPage track={t} sp={sp} />;
}
