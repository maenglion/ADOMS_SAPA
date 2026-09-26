/**
 * [400 · 교육자료 버전] 묶음 A — 이행현황·대시보드 집계 한 곳(SCR-006~020).
 * 화면(/, /status/**)과 엑셀 내려받기(/status/export)가 **같은 함수**로 센다 — 숫자가 어긋나지 않게.
 *
 * 원천: 과제(tasks) × 결재·점검 층(approvals) · 부서(depts) · 자산(assets) · 원료·제조물(material_item) · 계약(contracts).
 * 명세의 숫자는 더미라 쓰지 않는다(명세 00 §10-4).
 */
import { pctFloor } from "@/lib/num";
import { judgeMap, withJudges } from "@/lib/us/links";
import "server-only";
import { tasks, approvals, depts, readTable, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { STEPS } from "@/lib/us/tracks";

/* ── 역할 → 볼 부서 범위(명세 00 §4-3) ─────────────────────────────── */
/** 경영책임자·총괄 = 전 기관 / 관리자(사업소·실/국 자리) = 안전총괄과 + 그 아래 부서 / 담당자 = 자기 부서. null = 전 기관. */
export async function scopeOf(role: string): Promise<Set<string> | null> {
  const r = role || "gm";
  if (r === "ceo" || r === "gm") return null;
  const dl = await depts();
  if (r === "mgr") return new Set(dl.filter((d: Row) => d.dept_id === "D02" || d.parent_dept_id === "D02").map((d: Row) => d.dept_id));
  if (r === "road") return new Set(["D03"]);
  if (r === "water") return new Set(["D04"]);
  return null;
}
export const inScope = (sc: Set<string> | null, deptId?: string) => !sc || sc.has(String(deptId || ""));

/** 대상(부서) 목록 — 미지정(D99) 은 뺀다. */
export async function deptList(sc: Set<string> | null): Promise<Row[]> {
  return (await depts()).filter((d: Row) => d.dept_id !== "D99" && inScope(sc, d.dept_id));
}

/* ── 과제 한 건의 이행 상태(명세 00 §6 COMPLIANCE_STATUS) ────────────── */
export type Mark = "O" | "△" | "X" | "-" | "wait";
export const MARK_NAME: Record<Mark, string> = { O: "이행완료", "△": "보완필요", X: "미이행", "-": "해당없음", wait: "예정" };

/**
 * 판정 순서: 해당없음(배정) → 이행점검 판정(check_result) → 과제 상태.
 * 이행대기인데 기한이 지났으면 미이행, 기한 전이면 「예정」(이행률 계산에서 뺀다 — 아직 할 때가 아니다).
 */
export function markOf(t: Row, today = ymd()): Mark {
  if (t.applicability === "해당없음") return "-";
  const c = t.check_result;
  if (c === "이행완료") return "O";
  if (c === "보완필요") return "△";
  if (c === "미이행") return "X";
  const s = t.status;
  if (s === "이행완료" || s === "점검완료") return "O";
  if (s === "조치필요") return "△";
  if (s === "기간초과") return "X";
  return String(t.due_date || "") < today ? "X" : "wait";
}

/** 연도·결재 층을 붙인 과제 목록. year 가 비면 전부. */
export async function taskRows(year?: string): Promise<Row[]> {
  const [all, ap] = await Promise.all([tasks({ limit: 20000 }), approvals()]);
  const am = new Map(ap.map((a: Row) => [a.task_id, a]));
  const today = ymd();
  return all
    .map((t: Row) => {
      const a: Row = am.get(t.task_id) || {};
      const r: Row = { ...t, ...a, applicability: t.applicability, dept_id: t.dept_id, code36: t.code36, area: t.area };
      r.year = String(a.period_year || String(t.period_label || "").slice(0, 4) || String(t.due_date || "").slice(0, 4));
      r.half = a.half_year || (String(t.due_date || "").slice(5, 7) <= "06" ? "상반기" : "하반기");
      r.code = String(t.code36 || "").split(";")[0].trim();
      r.mark = markOf(r, today);
      return r;
    })
    .filter((r) => !year || r.year === year);
}

/** 여러 과제를 한 칸(대상 × 점검사항)으로 — 하나라도 미이행이면 X, 보완필요면 △, 이행이 있으면 O, 과제가 없으면 해당없음. */
export function cellOf(rows: Row[]): Mark {
  if (!rows.length) return "-";
  const m = new Set(rows.map((r) => r.mark as Mark));
  if (m.has("X")) return "X";
  if (m.has("△")) return "△";
  if (m.has("O")) return "O";
  if (m.has("wait")) return "wait";
  return "-";
}

/** 이행률 = 이행완료 ÷ (전체 − 해당없음 − 예정). 분모 0 이면 null. (명세 SCR-011 표본: 2 O + 1 - → 100%) */
export function rateOf(c: { O: number; T: number; X: number }): number | null {
  const d = c.O + c.T + c.X;
  return d ? (c.O / d) * 100 : null;
}

/* ── 점검사항(행) 정의 — 명세 SCR-011 · 015 행 원문 ─────────────────── */
export type Item = { key: string; label: string; codes: string[] };
export type Grp = { g: 1 | 2 | 3 | 4; label: string; codes: string[]; items?: Item[] };

/** 중대산업재해(사업장) — SCR-011 원문. 우리 의무조항 36 코드로 잇는다. */
const WS: Grp[] = [
  { g: 1, label: "안전보건관리체계 구축·이행", codes: [], items: [
    { key: "I01", label: "안전·보건 목표 및 경영방침 설정", codes: ["I01"] },
    { key: "I02", label: "안전·보건·총괄·관리 전담 조직 설치", codes: ["I02"] },
    { key: "I06", label: "안전보건관계자 배치", codes: ["I06"] },
    { key: "I03", label: "유해·위험요인 확인 및 개선 절차 마련(위험성평가)", codes: ["I03"] },
    { key: "I04", label: "안전예산 편성·집행", codes: ["I04"] },
    { key: "I05", label: "안전보건관계자 업무수행", codes: ["I05"] },
    { key: "I07", label: "종사자 의견 청취 및 개선", codes: ["I07"] },
    { key: "I08", label: "비상조치계획 수립 및 이행", codes: ["I08"] },
  ] },
  { g: 2, label: "재해발생 시 재발방지대책 수립·이행", codes: ["I10"] },
  { g: 3, label: "행정기관이 개선·시정 명한 사항 이행", codes: ["I11"] },
  { g: 4, label: "안전·보건 관계 법령상 의무이행", codes: [], items: [
    { key: "I12", label: "관계 법령상 의무이행", codes: ["I12"] },
    { key: "I13", label: "법정교육 이수", codes: ["I13"] },
  ] },
];
/**
 * 중대시민재해(공중이용시설·공중교통수단) — SCR-015 원문.
 * 09-25 사용자: 원문 오기 「안전보건관리체계 구축·이행1」의 끝 「1」을 뺀다(명세 00 §10-3 에 적힌 오기 — 다른 두 표와 같은 이름으로).
 */
const FC: Grp[] = [
  { g: 1, label: "안전보건관리체계 구축·이행", codes: [], items: [
    { key: "F01", label: "안전인력 확보", codes: ["F01"] },
    { key: "F02", label: "안전예산 편성·집행", codes: ["F02"] },
    { key: "F03", label: "안전점검 계획 수립·수행", codes: ["F03"] },
    // 시행령 제10조제5호·제6호(이행점검·결과 조치)는 안전계획의 이행 점검이라 4)에 모은다 — 명세에 따로 줄이 없다.
    { key: "F04", label: "안전계획 수립·이행", codes: ["F04", "F05", "F06"] },
    { key: "F07", label: "재해예방업무처리절차", codes: ["F07"] },
  ] },
  { g: 2, label: "재해발생 시 재발방지대책 수립·이행", codes: ["F09"] },
  { g: 3, label: "행정기관이 개선·시정 명한 사항 이행", codes: ["F10"] },
  { g: 4, label: "안전·보건 관계 법령상 의무이행", codes: [], items: [
    { key: "F11", label: "관계 법령상 의무이행", codes: ["F11"] },
    { key: "F12", label: "법정교육 이수", codes: ["F12"] },
  ] },
];
/** 중대시민재해(원료·제조물) — 명세에 표가 없어 공중이용시설 표 모양 + 원료·제조물 단계(steps_mt) 이름으로 만든다. */
const MT: Grp[] = [
  { g: 1, label: "안전보건관리체계 구축·이행", codes: [], items: [
    { key: "M01", label: "안전인력 확보", codes: ["M01"] },
    // 09-25 사용자: 명세 오기 「예산·편성·집행」 → 「예산 편성·집행」(몫 Y · key 「M02」는 그대로)
    { key: "M02", label: "중대시민재해 예방 예산 편성·집행", codes: ["M02"] },
    // 시행령 제8조제3호(업무처리절차)에 별표 5 조치(M03)·결과 조치(M05)를 모은다.
    { key: "M04", label: "재해예방업무처리 절차 마련·이행", codes: ["M04", "M03", "M05"] },
  ] },
  { g: 2, label: "재해발생 시 재발방지대책 수립·이행", codes: ["M06"] },
  { g: 3, label: "행정기관이 개선·시정 명한 사항 이행", codes: ["M07"] },
  { g: 4, label: "안전·보건 관계 법령상 의무이행", codes: [], items: [
    { key: "M08", label: "관계 법령상 의무이행", codes: ["M08"] },
    { key: "M09", label: "법정교육 이수", codes: ["M09"] },
  ] },
];
export const ITEMS: Record<"ws" | "fc" | "mt", Grp[]> = { ws: WS, fc: FC, mt: MT };
export const AREA_OF: Record<"ws" | "fc" | "mt", "I" | "F" | "M"> = { ws: "I", fc: "F", mt: "M" };

/** 선택 화면 좌측 4개(명세 SCR-010 원문). */
export const PICK4 = [
  { g: 1, label: "안전보건관리체계 구축·이행" },
  { g: 2, label: "재해발생 시 재발방지대책 수립·이행" },
  { g: 3, label: "행정기관이 개선·시정 명한 사항 이행" },
  { g: 4, label: "안전·보건 관계 법령상 의무이행" },
];

/* ── 이행 현황표 계산 ─────────────────────────────────────────────── */
export type Cnt = { n: number; O: number; T: number; X: number; N: number; W: number };
export type Line = { kind: "grp" | "item"; g: number; label: string; codes: string[]; cnt?: Cnt; rate?: number | null; cells?: Mark[] };
export type Board = { lines: Line[]; cols: Row[]; colRate: (number | null)[]; total: number | null; tasks: Row[] };

const zero = (): Cnt => ({ n: 0, O: 0, T: 0, X: 0, N: 0, W: 0 });
function add(c: Cnt, m: Mark) {
  c.n++;
  if (m === "O") c.O++; else if (m === "△") c.T++; else if (m === "X") c.X++; else if (m === "-") c.N++; else c.W++;
}

/**
 * track · 연도 · 고른 대분류(gs) · 고른 대상(부서 id) → 행(점검사항) × 열(대상) 표.
 * 한 칸 = 그 부서의 그 점검사항 과제들의 상태(cellOf). 행 집계는 칸을 센다(명세: 전체항목 = 대상 수).
 */
/**
 * 의무이행(실적증빙) 화면에서 부서가 직접 적은 기록(묶음 C·D·E 의 usc_/usd_/use_record)을 과제와 같은 모양으로.
 * 단계(step) → 의무조항 36 코드는 steps 파일의 code36 을 쓰고, 관계 법령 단계의 교육 칸(section=edu)은 교육이수 코드로 보낸다.
 * 표가 아직 없거나 모양이 다르면 빈 목록이다(과제만으로 센다).
 */
const REC_TABLE: Record<"ws" | "fc" | "mt", string> = { ws: "usc_record", fc: "usd_record", mt: "use_record" };
const EDU_CODE: Record<"ws" | "fc" | "mt", string> = { ws: "I13", fc: "F12", mt: "M09" };
export async function recordRows(track: "ws" | "fc" | "mt", year: string): Promise<Row[]> {
  let rows: Row[] = [];
  try { rows = await readTable(REC_TABLE[track], "rec_id"); } catch { return []; }
  const code = new Map(STEPS[track].map((s) => [s.key, s.code36 || ""]));
  const M: Record<string, Mark> = { 이행완료: "O", 보완필요: "△", 미이행: "X", 해당없음: "-" };
  return rows
    .filter((r) => r.deleted !== "Y" && r.dept_id && (!year || String(r.year || "") === year) && M[String(r.status || "")])
    .map((r) => ({
      task_id: r.rec_id, dept_id: r.dept_id, area: AREA_OF[track], year: String(r.year || ""), from: "record",
      code: r.step === "law" && r.section === "edu" ? EDU_CODE[track] : code.get(r.step) || "",
      mark: M[String(r.status)],
      // 반기 — 기록을 고친 날(updated_at)의 달로 가른다(대시보드 반기 막대용)
      half: String(r.updated_at || "").slice(5, 7) && String(r.updated_at).slice(5, 7) > "06" ? "하반기" : "상반기",
    }))
    .filter((r) => r.code);
}

export async function buildBoard(track: "ws" | "fc" | "mt", year: string, gs: number[], cols: Row[]): Promise<Board> {
  const area = AREA_OF[track];
  // 이행점검에서 점검자가 내린 판정이 있으면 그 판정이 앞선다(lib/us/links — 화면 사이 연결)
  const jm = await judgeMap(track, year);
  const all = withJudges([...(await taskRows(year)).filter((r) => r.area === area), ...(await recordRows(track, year))], jm);
  const colIds = cols.map((c) => c.dept_id);
  const idx = new Map<string, Row[]>();
  for (const r of all) {
    const k = `${r.dept_id}|${r.code}`;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k)!.push(r);
  }
  const rowsFor = (dept: string, codes: string[]) => codes.flatMap((c) => idx.get(`${dept}|${c}`) || []);
  const lines: Line[] = [];
  const colCnt = colIds.map(() => zero());   // 칸 수(표의 O·△·X·- 칸 — 교육자료 규칙: 전체항목 = 대상 수)
  const tot = zero();
  // ★ 이행률은 대시보드와 같은 기준(09-24 사용자 지시) — 칸이 아니라 과제(의무) 하나하나의 상태를 센다.
  //   칸 표시는 「하나라도 미이행이면 X」 그대로 두되, 이행률 숫자는 과제 단위라 대시보드 숫자와 같은 뜻이 된다.
  const colTask = colIds.map(() => zero());
  const totTask = zero();
  const mk = (kind: "grp" | "item", g: number, label: string, codes: string[]): Line => {
    const cnt = zero(), taskCnt = zero();
    const cells = colIds.map((d, i) => {
      const rows = rowsFor(d, codes);
      rows.forEach((r) => { const m = r.mark as Mark; add(taskCnt, m); add(colTask[i], m); add(totTask, m); });
      // 칸 표시 — 점검자 판정이 있으면 그 판정(코드 하나인 점검사항). 여러 코드를 묶은 줄은 코드별로 판정을 먼저 본다.
      const judged = codes.map((c) => jm.get(`${d}|${c}`)).filter(Boolean) as Mark[];
      if (judged.length === codes.length && codes.length) return judged.includes("X") ? "X" : judged.includes("△") ? "△" : judged.includes("O") ? "O" : "-";
      return cellOf(rows);
    });
    cells.forEach((m, i) => { add(cnt, m); add(colCnt[i], m); add(tot, m); });
    // 줄의 숫자(전체항목·O·△·X·-)도 이행률과 같은 과제 단위로 — 한 줄 안에서 숫자가 서로 맞게(09-24 사용자 「숫자가 하나도 안 맞네」).
    // 「예정」(이행 시기 전)은 전체항목에서 빼고 따로 센다(W).
    const shown = { ...taskCnt, n: taskCnt.O + taskCnt.T + taskCnt.X + taskCnt.N };
    return { kind, g, label, codes, cnt: shown, rate: rateOf(taskCnt), cells };
  };
  for (const G of ITEMS[track].filter((x) => gs.includes(x.g))) {
    if (G.items) {
      lines.push({ kind: "grp", g: G.g, label: `${G.g}. ${G.label}`, codes: G.items.flatMap((i) => i.codes) });
      G.items.forEach((it, i) => lines.push(mk("item", G.g, `${i + 1}) ${it.label}`, it.codes)));
    } else lines.push(mk("grp", G.g, `${G.g}. ${G.label}`, G.codes));
  }
  const codesAll = new Set(lines.flatMap((l) => l.codes));
  return {
    lines, cols, colRate: colTask.map(rateOf), total: rateOf(totTask),
    tasks: all.filter((r) => colIds.includes(r.dept_id) && codesAll.has(r.code)),
  };
}

/* ── 표시 도움 ─────────────────────────────────────────────────────── */
export const GOOD = 80, MID = 70; // 명세 00 §6 — 80 이상 우수 · 70 이상 보통(추정). TODO: 확인
export const gradeClass = (p: number | null | undefined) => (p === null || p === undefined ? "" : p >= GOOD ? "usa-good" : p >= MID ? "usa-mid" : "usa-low");
// 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
export const pct0 = (p: number | null | undefined) => (p === null || p === undefined ? "-" : `${Math.floor(p + 1e-9)}%`);
// 09-24 사용자: 이행률·미이행률은 소수점 한 자리까지(이름은 그대로 둔다 — 쓰는 곳이 많다)
export const pct2 = pctFloor;
export const cntText = (n: number) => (n ? String(n) : "-");

/** 주소 쿼리의 배열값(체크박스 여러 개 · 쉼표 목록 모두 받는다). */
export function listParam(v: string | string[] | undefined): string[] {
  const a = Array.isArray(v) ? v : v ? [v] : [];
  return a.flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean);
}

/** 연도 선택지 — 과제에 있는 해 + 올해. */
export async function yearsOf(): Promise<string[]> {
  const ys = new Set((await taskRows()).map((r) => r.year).filter((y) => /^\d{4}$/.test(y)));
  ys.add(ymd().slice(0, 4));
  return [...ys].sort().reverse();
}
export const thisYear = () => ymd().slice(0, 4);

/** 조치 지시 발신 기록(usa_order). */
export async function orderLog(): Promise<Row[]> {
  return (await readTable("usa_order", "order_id")).sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
}
