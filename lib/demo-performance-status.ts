export type PerformanceStatus = "NORMAL" | "REWARM" | "CHECK";

export function classifyPerformanceRow(input: {
  screen: string;
  statuses: number[];
  hitCount: number;
  dbQueryCount: number | null;
  medianMs: number;
  cacheReady: boolean;
}): { status: PerformanceStatus; reasons: string[] } {
  const reasons: string[] = [];
  const limit = input.screen === "actions" ? 2500 : 2000;
  if (input.statuses.some((status) => status !== 200)) reasons.push(`${input.screen} HTTP ${Math.max(...input.statuses)}`);
  if (input.medianMs > limit) reasons.push(`${input.screen} median ${Math.round(input.medianMs * 100) / 100}ms > ${limit}ms`);
  if (input.hitCount === 3 && input.dbQueryCount == null) reasons.push(`${input.screen} DB query count 미측정`);
  if ((input.dbQueryCount || 0) > 0) reasons.push(`${input.screen} warm DB query ${input.dbQueryCount}`);
  if (reasons.length) return { status: "CHECK", reasons };
  if (!input.cacheReady) return { status: "REWARM", reasons: ["READ server cache가 READY가 아님"] };
  if (input.hitCount < 3) return { status: "REWARM", reasons: [`${input.screen} cache HIT ${input.hitCount}/3`] };
  return { status: "NORMAL", reasons: [] };
}

export function formatCacheState(values: string[]) {
  const hits = values.filter((value) => value === "HIT").length;
  const misses = values.length - hits;
  return misses ? `MISS ${misses} / HIT ${hits}` : `HIT ${hits}/${values.length}`;
}

export function overallPerformanceStatus(values: PerformanceStatus[]): PerformanceStatus {
  if (values.includes("CHECK")) return "CHECK";
  if (values.includes("REWARM")) return "REWARM";
  return "NORMAL";
}
