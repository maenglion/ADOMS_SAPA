/**
 * [400 · 교육자료 버전] 묶음 C — usc_record 읽기(서버). 쓰기는 ../actions.ts 한 곳.
 */
import "server-only";
import { readTable } from "@/lib/data";
import { TABLE, type FileRef } from "./meta";

export type Rec = {
  rec_id: string; dept_id: string; year: string; step: string; section: string; parent_id: string;
  ord: number; locked: boolean; deleted: boolean; status: string;
  data: Record<string, string>; files: FileRef[]; updated_at: string; updated_by: string;
};

function parse<T>(s: any, dflt: T): T {
  if (s && typeof s === "object") return s as T;
  try { return s ? (JSON.parse(String(s)) as T) : dflt; } catch { return dflt; }
}

export function toRec(r: Record<string, any>): Rec {
  return {
    rec_id: String(r.rec_id), dept_id: String(r.dept_id || ""), year: String(r.year || ""),
    step: String(r.step || ""), section: String(r.section || ""), parent_id: String(r.parent_id || ""),
    ord: Number(r.ord) || 0, locked: r.locked === "Y", deleted: r.deleted === "Y", status: String(r.status || ""),
    data: parse<Record<string, string>>(r.data, {}), files: parse<FileRef[]>(r.files, []).filter((f) => f && f.name),
    updated_at: String(r.updated_at || ""), updated_by: String(r.updated_by || ""),
  };
}

/** 전 행(지운 표시 포함) — 저장 쪽이 기존 값을 합칠 때 쓴다. */
export async function allRecs(): Promise<Rec[]> {
  return (await readTable(TABLE, "rec_id")).map(toRec);
}

/** 한 부서·연도·단계의 살아 있는 행 — ord 순. */
export async function stepRecs(dept: string, year: string, step: string): Promise<Rec[]> {
  return (await allRecs())
    .filter((r) => r.dept_id === dept && r.year === year && r.step === step && !r.deleted)
    .sort((a, b) => a.ord - b.ord);
}

/** 같은 구분 값끼리 모은다(첫 등장 순서 유지) — 표의 행 합치기(rowspan)용. */
export function groupRows<T extends Rec>(rows: T[], key: string): T[][] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r.data[key] ?? "") || `__${r.rec_id}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return [...m.values()];
}
