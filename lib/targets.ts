import "server-only";
import { duties, assets, assetMapSeed, foldByUnit } from "./data";
export { duties, assets };

/**
 * 관리대상 카드 — 유형별 의무 수와 자산 수.
 *
 * ★ 자산 수는 두 가지가 다르다(09-21 정정).
 *   · 카드의 `assets` = 그 유형에 **걸린 자산 연결 수**. 한 자산이 여러 유형에 걸리므로 합치면 실제보다 많다.
 *   · `distinctAssets` = **실물 자산 수**(중복 제거). 머리 통계에는 이 값을 쓴다.
 */
export async function seedTargets(target?: string, q?: string) {
  const rows = foldByUnit(await duties({ limit: 100000 }));   // 의무 수를 다른 화면과 같은 기준(11,015)으로(09-24)
  const byTarget = new Map<string, { code: string; name: string; duties: number; assets: number }>();
  rows.forEach((r) => {
    const k = r.target_code || "TG99";
    const o = byTarget.get(k) || { code: k, name: r.target_name || k, duties: 0, assets: 0 };
    o.duties++;
    byTarget.set(k, o);
  });

  const map = assetMapSeed();
  const seen = new Set<string>();
  map.forEach((m) => {
    const o = byTarget.get(m.target_code);
    if (o) o.assets++;
    seen.add(m.asset_id);
  });

  const cards = [...byTarget.values()].sort((a, b) => b.duties - a.duties);
  const list = q ? await assets({ q, limit: 500 })
    : target ? await assets({ target, limit: 500 }) : [];
  return { cards, list, distinctAssets: seen.size, links: map.length };
}
