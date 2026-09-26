"use server";
/**
 * [400 · 교육자료 버전] SCR-091 「업로드」 — 발생통계 원장 일괄 등록(엑셀에서 CSV 로 저장한 파일).
 * 화면의 20칸 머리(원문 그대로) 또는 내려받은 양식 머리를 읽어 한 줄씩 appendRow("usg_stat_occur").
 * 필수: 사고발생일 · 재해유형. 빠진 줄은 건너뛰고 몇 줄 건너뛰었는지 알린다.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appendRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { attachOf } from "@/lib/attach";
import { OCC_COLS, occurRows } from "../_parts/data";

function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const norm = (s: string) => s.replace(/\s+/g, "");

export async function uploadOccur(f: FormData) {
  const role = String(f.get("role") || "gm");
  const back = String(f.get("back") || "");
  const go = (msg: string) => redirect(`/stats/occur?${back}${back ? "&" : ""}${msg}`);
  const file = f.get("occ_file");
  if (!(file instanceof File) || file.size === 0) go(`modal=upload&err=${encodeURIComponent("올릴 파일을 고르세요.")}`);
  const fl = file as File;
  if (!/\.csv$/i.test(fl.name)) go(`modal=upload&err=${encodeURIComponent("CSV 파일(엑셀에서 「CSV UTF-8」로 저장)만 올릴 수 있습니다.")}`);
  if (fl.size > 10 * 1024 * 1024) go(`modal=upload&err=${encodeURIComponent("10MB 이하 파일만 올릴 수 있습니다.")}`);

  const rows = parseCsv(await fl.text());
  if (rows.length < 2) go(`modal=upload&err=${encodeURIComponent("머리 줄 아래에 자료가 없습니다.")}`);
  const head = rows[0].map(norm);
  const idx = OCC_COLS.map((c) => head.indexOf(norm(c.head)));
  if (idx[OCC_COLS.findIndex((c) => c.key === "occurred_at")] < 0 || idx[OCC_COLS.findIndex((c) => c.key === "acc_type")] < 0)
    go(`modal=upload&err=${encodeURIComponent("머리 줄에 「사고발생일」「재해유형」 칸이 있어야 합니다. 양식을 내려받아 쓰세요.")}`);

  // 원본 파일도 증빙처럼 보관(지우지 않는다)
  await attachOf(f, "occ_file_name", "occ_file");

  const by = ROLE_STAFF[role] || "SD01-1";
  const exist = await occurRows();
  let seq = exist.reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0);
  let ok = 0, skip = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  for (const [n, r] of rows.slice(1).entries()) {
    const o: Record<string, string> = {};
    OCC_COLS.forEach((c, i) => { o[c.key] = idx[i] >= 0 ? String(r[idx[i]] ?? "").trim() : ""; });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.occurred_at) || !o.acc_type) { skip++; continue; }
    seq += 1;
    await appendRow("usg_stat_occur", {
      occ_id: `OCC-U${stamp}-${n + 1}`,
      ...o,
      year: o.year || o.occurred_at.slice(0, 4),
      seq: o.seq || String(seq),
      uploaded_by: by,
      uploaded_file: fl.name,
    }, by, "발생통계 업로드");
    ok++;
  }
  revalidatePath("/stats/occur");
  go(`ok=${encodeURIComponent(`${ok}건 등록${skip ? ` · ${skip}줄 건너뜀(사고발생일·재해유형 확인)` : ""}`)}`);
}
