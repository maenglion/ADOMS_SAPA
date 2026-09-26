// [400 · 교육자료 버전] SCR-090 「엑셀 다운로드」 — 총괄표를 화면과 같은 계산으로 엑셀(.xlsx)로 낸다.
// 09-25 사용자: CSV 대신 엑셀로(명세 「총괄표를 xlsx로」) — lib/xlsx.ts. 제목 두 줄 · 머리 줄 굵게 · 점검사항 칸과 머리 줄 틀 고정.
import { depts, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { xlsxResponse } from "@/lib/xlsx";
import { isTrack, NAME, roundOf, cellsOfRound, siteOf, SYM, rateOf, type St, taskRatesOf } from "../../../_lib";   // 09-26 사용자: 옛 점검 화면 합치기 2차 — taskRatesOf

export async function GET(req: Request, { params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) return new Response("없는 대상입니다", { status: 404 });
  const u = new URL(req.url);
  const round = await roundOf(track, u.searchParams.get("r") || undefined);
  if (!round) return new Response("취합한 점검이 없습니다", { status: 404 });
  const { items, deptIds, cells, period } = await cellsOfRound(track, round);
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, String(d.dept_name)]));
  const stOf = (it: string, d: string): St => cells.get(`${it}|${d}`)?.status || "해당없음";
  const cnt = (n: number) => (n ? n : "-");

  const head = ["점검사항", ...deptIds.map((d) => `${siteOf(d)}:${dn.get(d) || d}`), "전체항목", "이행완료(O)", "보완필요(△)", "미이행(X)", "해당없음(-)"];
  const body = items.map((it) => {
    const sts = deptIds.map((d) => stOf(it.key, d));
    const n = (s: St) => sts.filter((x) => x === s).length;
    return [`${it.no}. ${it.label}`, ...sts.map((s) => SYM[s]), deptIds.length, cnt(n("이행완료")), cnt(n("보완필요")), cnt(n("미이행")), cnt(n("해당없음"))];
  });
  // 이행률은 화면과 같은 글자(소수 첫째 자리 버림, 예: 27.2%) — rateOf
  const rate = ["이 행 률(칸 단위)", ...deptIds.map((d) => rateOf(items.map((it) => stOf(it.key, d)))), "", "", "", "", ""];
  // 09-26 사용자: 옛 점검 화면 합치기 2차 — 과제 단위 이행률(이행현황표와 같은 계산)도 한 줄
  const tr = await taskRatesOf(track, deptIds, period.year);
  const trate = ["이 행 률(과제 단위)", ...deptIds.map((d) => tr.byDept.get(d) || "-"), "", "", "", "", ""];
  const meta = [[`의무이행(${NAME[track]}) 점검 총괄표`], [`${round.title} · 상태 ${round.status} · 내려받은 날 ${ymd()}`], []];
  const rows = [...meta, head, ...body, rate, trate];
  return xlsxResponse(`이행점검_총괄표_${NAME[track]}_${ymd()}`, [{
    name: "점검 총괄표",
    rows,
    headRow: meta.length,
    boldRows: [0, rows.length - 2, rows.length - 1],
    freezeCol: 1,
  }]);
}
