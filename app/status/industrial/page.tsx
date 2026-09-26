// [400 · 교육자료 버전] SCR-010 · 011 · 012 · 013 — 이행현황 › 중대산업재해(사업장): 취합 대상 설정 → 해당년도 이행 현황표 → 대상별 이행 현황표 → 조치 지시
import StatusPage from "../_parts/StatusPage";

export const dynamic = "force-dynamic";

export default async function Industrial({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StatusPage track="ws" sp={await searchParams} />;
}
