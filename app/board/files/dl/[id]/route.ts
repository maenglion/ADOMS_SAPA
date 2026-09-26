// [400 · 교육자료 버전] 자료실 기본 서식 내려받기 — 예시 자료의 gen_content 를 파일로 만들어 준다(.csv 는 UTF-8 BOM · 엑셀에서 바로 열림).
import { readTable } from "@/lib/data";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await readTable("usf_file", "file_id")).find((x) => x.file_id === decodeURIComponent(id));
  if (!r) return new Response("없는 자료입니다", { status: 404 });
  if (r.evidence_url) return Response.redirect(new URL(String(r.evidence_url), req.url), 302);
  if (!r.gen_content) return new Response("내려받을 파일이 없습니다", { status: 404 });
  const name = String(r.evidence_name || `${r.title}.txt`);
  const csv = /\.csv$/i.test(name);
  const body = (csv ? "﻿" : "") + String(r.gen_content).replace(/\r?\n/g, "\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": csv ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
