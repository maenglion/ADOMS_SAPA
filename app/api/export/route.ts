import { tasks, approvals, duties, depts, contracts, readTable } from "@/lib/data";
import { secureAxisOrUnset } from "@/lib/axes";
import { idKo } from "@/lib/labels";
import { loadLedger } from "@/app/evidence/ledger";
import { ymd } from "@/lib/day";
import { HIER, AREA_LABEL, markOf } from "@/lib/clause";
import { xlsxResponse, type XSheet } from "@/lib/xlsx";

/**
 * 엑셀 내려받기 — 참고 명세의 「엑셀 다운로드」. (2026-09-21)
 *
 * 09-25 사용자: CSV 대신 진짜 엑셀(.xlsx)로 낸다 — lib/xlsx.ts(머리 줄 굵게 · 칸 너비 · 틀 고정, 숫자는 숫자 칸).
 * 화면에 보이는 것과 **같은 숫자**가 나와야 한다 — 화면과 같은 함수로 집계한다.
 * 열 이름은 우리말, 식별자는 화면처럼 한글 접두어(`idKo`).
 */
function csv(head: string[], rows: any[][], opt: Partial<XSheet> = {}): XSheet {
  return { name: "", ...opt, rows: [head, ...rows] };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const what = u.searchParams.get("what") || "tasks";
  const half = u.searchParams.get("half") || "";
  const today = ymd();
  // 09-26 사용자: 증빙 대장 합치기 — 옛 주소의 증빙 대장은 의무이행 단계 증빙이 빠지므로 합친 대장 내려받기로 보낸다
  if (what === "evidence") return new Response(null, { status: 307, headers: { Location: `/evidence/export${u.search}` } });   // 상대 주소(서버 주소가 0.0.0.0 으로 잡히는 것 피함)

  let name = "내보내기";
  let body: XSheet | null = null;

  if (what === "tasks") {
    // 이행 과제 목록 — 내 업무 화면과 같은 칸
    const all = await tasks({ limit: 5000 });
    const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
    const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }))
      .filter((t: any) => !half || !t.half_year || t.half_year === half);
    name = `이행과제_${half || "전체"}_${today}`;
    body = csv(
      ["과제 번호", "재해 구분", "확보의무", "의무조항", "의무", "법령", "조문", "대상", "부서", "기한", "이행 상태", "결재 상태", "점검 판정"],
      rows.map((r: any) => [
        idKo(r.task_id), r.area === "I" ? "중대산업재해" : r.area === "F" ? "중대시민재해(공중이용시설·공중교통수단)" : "중대시민재해(원료·제조물)",
        secureAxisOrUnset(r.code36), `${r.code36} ${r.code36_name}`, r.duty_name || r.article_title,
        r.law, r.unit_label_ko, r.asset_name || r.target_name, r.dept_name, r.due_date,
        r.status, r.approval_status || "작성중", r.check_result || "",
      ]),
    );
  } else if (what === "status" && (u.searchParams.get("by") || "clause") === "clause") {
    // [캡처 v2] 조항별 이행 현황표 — 화면(/status 조항별)과 같은 정의·같은 규칙(lib/clause.ts, 09-24)
    const area = u.searchParams.get("area") || "F";
    const year = u.searchParams.get("year") || "2026";
    const all = await tasks({ limit: 5000 });
    const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
    const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }))
      .filter((t: any) => !half || !t.half_year || t.half_year === half)
      .filter((t: any) => !/^\d{4}/.test(String(t.period_label || "")) || String(t.period_label).startsWith(year))
      .filter((t: any) => area === "all" || t.area === area);
    type C = { O: number; T: number; X: number; N: number; n: number };
    const zero = (): C => ({ O: 0, T: 0, X: 0, N: 0, n: 0 });
    const byCode = new Map<string, C>();
    rows.forEach((r: any) => { const k = String(r.code36 || "").split(";")[0].trim(); const c = byCode.get(k) || zero(); c[markOf(r)]++; c.n++; byCode.set(k, c); });
    const codeC = (codes: string[]) => codes.reduce((s0: C, k) => { const c = byCode.get(k) || zero(); return { O: s0.O + c.O, T: s0.T + c.T, X: s0.X + c.X, N: s0.N + c.N, n: s0.n + c.n }; }, zero());
    const line = (label: string, c: C) => {
      const d = c.n - c.N;
      return [label, d ? Math.round((c.O / d) * 100) + "%" : "-", c.n, c.O, c.T, c.X, c.N];
    };
    const out: any[][] = [];
    const boldRows: number[] = []; // 재해 구분 머리 줄(머리 줄이 0번이라 out 순번 + 1)
    for (const a of area === "all" ? ["I", "F", "M"] : [area]) {
      boldRows.push(out.length + 1);
      out.push([AREA_LABEL[a], "", "", "", "", "", ""]);
      for (const nd of HIER[a] || []) {
        const codes = nd.kids ? nd.kids.map((k) => k.code) : nd.codes;
        out.push(line(nd.t, codeC(codes)));
        for (const k of nd.kids || []) out.push(line("   " + k.t + " (" + k.code + ")", codeC([k.code])));
      }
    }
    name = `이행현황표_조항별_${year}_${half || "전체"}_${area === "all" ? "전체" : AREA_LABEL[area]}_${today}`;
    body = csv(["점검사항", "이행률", "전체", "이행완료(O)", "보완필요(△)", "미이행(X)", "해당없음(-)"], out, { boldRows });
  } else if (what === "status") {
    // 이행 현황표 — 부서별 O/△/X (이행 현황표 화면과 같은 규칙)
    const all = await tasks({ limit: 5000 });
    const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
    const rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }))
      .filter((t: any) => !half || !t.half_year || t.half_year === half);
    const mark = (r: any) => r.check_result === "이행완료" || r.status === "이행완료" || r.status === "점검완료" ? "O"
      : r.check_result === "보완필요" || r.status === "조치필요" ? "T" : "X";
    const ds = await depts();
    const out = ds.map((d: any) => {
      const r = rows.filter((x: any) => x.dept_id === d.dept_id);
      const O = r.filter((x: any) => mark(x) === "O").length;
      const T = r.filter((x: any) => mark(x) === "T").length;
      const X = r.filter((x: any) => mark(x) === "X").length;
      return [d.dept_name, r.length, O, T, X, r.length ? Math.round((O / r.length) * 100) + "%" : "-"];
    }).filter((x: any) => x[1] > 0);
    const sum = out.reduce((s: any, x: any) => [s[0], s[1] + x[1], s[2] + x[2], s[3] + x[3], s[4] + x[4]], ["합계", 0, 0, 0, 0]);
    out.push([...sum, sum[1] ? Math.round((sum[2] / sum[1]) * 100) + "%" : "-"]);
    name = `이행현황표_${half || "전체"}_${today}`;
    body = csv(["부서", "대상", "O 이행완료", "△ 보완필요", "X 미이행", "이행률"], out);
  } else if (what === "duties") {
    const rows = await duties({ limit: 100000 });
    name = `의무목록_${today}`;
    body = csv(["의무 번호", "재해 구분", "확보의무", "의무조항", "의무", "법령", "하위 문서", "조문", "관리대상", "주기"],
      rows.map((r: any) => [idKo(r.duty_key), r.area, secureAxisOrUnset(r.code36), `${r.code36} ${r.code36_name}`,
        r.duty_name || r.article_title, r.law, r.doc, r.unit_label_ko, r.target_name, r.cycle_text]));
  } else if (what === "contracts") {
    const rows = await readTable("contract", "contract_id");
    const ds = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
    name = `도급용역위탁_${today}`;
    body = csv(["계약 번호", "계약명", "수급인", "구분", "소관 부서", "계약 시작", "계약 종료", "금액(원)", "안전보건 조항", "수급인 평가", "평가 점수", "재하도급"],
      rows.map((c: any) => [idKo(c.contract_id), c.contract_name, c.counterpart, c.contract_type, ds.get(c.dept_id) || c.dept_id,
        c.start_date, c.end_date, c.amount, c.safety_clause, c.evaluation_done === "Y" ? "실시" : "미실시", c.eval_score, c.subcontract === "Y" ? "있음" : "없음"]), { commaCols: [7] });
  } else if (what === "evidence") {
    // 증빙 대장 — 시행령 제13조 이행한 날부터 5년 보관. 화면(/evidence?view=ledger)과 같은 함수로 만든다.
    const area = u.searchParams.get("area") || "", f = u.searchParams.get("f") || "", code = u.searchParams.get("code") || "";
    let rows = await loadLedger();
    if (area) rows = rows.filter((r) => r.area === area);
    if (f === "nofile") rows = rows.filter((r) => !r.hasFile);
    if (f === "file") rows = rows.filter((r) => r.hasFile);
    if (f === "soon") rows = rows.filter((r) => r.state !== "보존 중");
    if (code) rows = rows.filter((r) => r.code36 === code);
    const AREA: Record<string, string> = { I: "중대산업재해", F: "중대시민재해(공중이용시설·공중교통수단)", M: "중대시민재해(원료·제조물)" };
    name = `증빙대장_${today}`;
    body = csv(
      ["증빙 번호", "증빙 종류", "서류 이름", "첨부", "재해 구분", "중대재해처벌법 자리", "의무조항", "법령", "조문", "의무",
        "과제 번호", "부서", "대상", "이행일", "이행일 기준", "보존 만료일", "보존 상태", "올린 사람"],
      rows.map((r) => [idKo(r.evidence_id), r.kind, r.file_name, r.hasFile ? "파일 있음" : "파일 없음(이름만)", AREA[r.area] || "",
        r.sapa, r.code36 ? `${r.code36} ${r.code36_name}` : "", r.law, r.unit, r.duty,
        r.task_id ? idKo(r.task_id) : r.src || "", r.dept_name || r.dept_id, r.target, r.doneDate, r.doneBasis, r.expires, r.state, r.uploaded_by]),
    );
  } else {
    return new Response("내보낼 항목이 없습니다", { status: 400 });
  }

  // 시트 이름 = 파일 이름의 앞 토막(예: 「이행과제」「증빙대장」)
  return xlsxResponse(name, [{ ...body!, name: name.split("_")[0] || "내보내기" }]);
}
