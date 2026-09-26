/**
 * 09-26 사용자: 증빙 대장 합치기 — 증빙 대장 엑셀(.xlsx). 의무이행 단계 증빙까지 담는다.
 *
 * 화면(/evidence?view=ledger)과 **같은 함수**(loadLedger({ steps: true }) · filterLedger)로 만든다 — 같은 숫자가 나온다.
 * 옛 /api/export?what=evidence(몫 밖 파일)는 지우지도 고치지도 않았다 — 그쪽은 의무이행 단계 증빙이 빠진 옛 대장이다.
 * 칸은 옛 엑셀과 같고, 「출처」 칸과 「묶음」 칸을 더했다(「과제 번호」 칸에는 이제 과제 번호만 적는다).
 * 09-26 사용자(2차): 걸러 보기 o = reg · step(입력 화면 기록 포함) · 「묶음」 칸에 두 곳/나눔을 적는다.
 */
import { idKo } from "@/lib/labels";
import { ymd } from "@/lib/day";
import { xlsxResponse } from "@/lib/xlsx";
import { loadLedger, filterLedger, originText } from "../ledger";

export const dynamic = "force-dynamic";

const AREA: Record<string, string> = { I: "중대산업재해", F: "중대시민재해(공중이용시설·공중교통수단)", M: "중대시민재해(원료·제조물)" };

export async function GET(req: Request) {
  const u = new URL(req.url);
  const g = (k: string) => u.searchParams.get(k) || "";
  const rows = filterLedger(await loadLedger({ steps: true }), { area: g("area"), f: g("f"), code: g("code"), o: g("o") });
  const name = `증빙대장_${ymd()}`;
  const head = ["증빙 번호", "증빙 종류", "서류 이름", "첨부", "재해 구분", "중대재해처벌법 자리", "의무조항", "법령", "조문", "의무",
    "출처", "묶음", "과제 번호", "부서", "대상", "이행일", "이행일 기준", "보존 만료일", "보존 상태", "올린 사람"];
  const body = rows.map((r) => [idKo(r.evidence_id), r.kind, r.file_name, r.hasFile ? "파일 있음" : "파일 없음(이름만)", AREA[r.area] || "",
    r.sapa, r.code36 ? `${r.code36} ${r.code36_name}` : "", r.law, r.unit, r.duty,
    // 09-26 사용자(2차): 「묶음」 칸 — 두 곳에 다 있어 한 줄로 묶음 / 이름만 같아 나눔(다른 파일 · 짝 출처)
    originText(r),
    [r.also && r.also.length ? "두 곳에 다 있음(한 줄로 묶음)" : "", ...(r.split || []).map((s) => `나눔(다른 파일) — 짝: ${s.label}`)].filter(Boolean).join(" / "),
    r.task_id ? idKo(r.task_id) : "",
    r.dept_name || r.dept_id, r.target, r.doneDate, r.doneBasis, r.expires, r.state, r.uploaded_by]);
  return xlsxResponse(name, [{ name: "증빙대장", rows: [head, ...body] }]);
}
