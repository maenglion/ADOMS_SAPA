// 이행점검 및 조치 화면의 숫자를 앱(3400) 계산 함수로 잰다(읽기 전용 — 쓰기 함수는 부르지 않는다).
// 사용: node --import ./ts_loader.mjs measure.mjs <이름>   (cwd = 앱 폴더, ADOMS_APP_DIR = 앱 폴더)
import fs from "node:fs";
import path from "node:path";

const APP = process.env.ADOMS_APP_DIR;
const OUT = path.join(import.meta.dirname, `measure_${process.argv[2] || "now"}.json`);
const imp = (p) => import("file:///" + path.join(APP, p).replace(/\\/g, "/"));

const chk = await imp("app/check/_lib.ts");
const merge = await imp("lib/check_merge.ts");
const cyc = await imp("lib/cycle.ts");
const hz = await imp("app/hazards/load.ts");
const hzc = await imp("app/hazards/codes.ts");
const rec = await imp("app/recurrence/model.ts");
const calc = await imp("app/status/_lib/calc.ts");
const links = await imp("lib/us/links.ts");
const data = await imp("lib/data.ts");

const R = { at: new Date().toISOString(), source: data.source() };

/* ── 이행점검 ── */
R.check = {};
for (const t of ["ws", "fc", "mt"]) {
  const rounds = await chk.roundsOf(t);
  const one = [];
  for (const r of rounds) {
    const { items, deptIds, cells, period } = await chk.cellsOfRound(t, r);
    const n = { 이행완료: 0, 보완필요: 0, 미이행: 0, 해당없음: 0 };
    const src = {};
    let inh = 0;
    for (const c of cells.values()) { n[c.status]++; src[c.src] = (src[c.src] || 0) + 1; if (c.inherited) inh++; }
    const tr = await chk.taskRatesOf(t, deptIds, period.year);
    one.push({
      round_id: r.round_id, title: r.title, status: r.status, created_at: r.created_at,
      depts: deptIds.length, items: items.length, cells: cells.size, ...n, src, inherited: inh,
      cellRate: chk.cellRateAll(cells, deptIds, items.map((i) => i.key)), taskRate: tr.total,
    });
  }
  const pcs = await chk.periodChecks(t, "2026", "하반기");
  const pcs1 = await chk.periodChecks(t, "2026", "상반기");
  R.check[t] = {
    rounds: one, default_round: rounds[0]?.round_id || "",
    period_H2: pcs.map((p) => `${p.item.key}:${p.state}`).join(" "),
    period_H1: pcs1.map((p) => `${p.item.key}:${p.state}`).join(" "),
  };
}

/* ── 미이행 조치·재점검 ── */
{
  const cy = await cyc.loadCycle();
  let rows = cy.rows.filter((t) => t.actionState || (t.state === "적합" && t.history.some((h) => cyc.FLAGGED(h.result))));
  rows.forEach((t) => { if (!t.actionState) t.actionState = "완료"; });
  const later = await merge.laterJudgeIndex();
  let closed = 0;
  rows.forEach((t) => {
    if (t.actionState === "완료" || !t.last) return;
    const j = later(t.dept_id, String(t.code36 || ""), String(t.last.insp_date || ""));
    if (j && j.status === "이행완료") { t.actionState = "완료"; closed++; }
  });
  const checks = (await merge.checkFlagged("2026", "gm")).map((f) => ({ ...f, actionState: f.notified ? "요구" : "요구 전" }));
  const st = {};
  for (const s of ["요구 전", "요구", "조치중", "조치 완료", "보완 제출", "완료"]) {
    st[s] = rows.filter((t) => t.actionState === s).length + checks.filter((f) => f.actionState === s).length;
  }
  // 물려받은 칸은 판정을 낸 원래 회차로 알림을 찾으면 몇 건이 「조치 요구 보냄」인가(앱 수정 요청의 효과 계산 — 앱 규칙 밖의 참고 숫자)
  const notif = (await data.readTable("notification", "notif_id")).filter((n) => n.note === "이행점검" && n.notif_type === "조치요구");
  const stf = await data.staff();
  const owner = (d) => (stf.find((s) => s.dept_id === d && s.duty_role === "정담당") || stf.find((s) => s.dept_id === d))?.staff_id || "";
  const notifiedIfOrigin = checks.filter((f) => {
    const rid = f.cell.inherited?.round_id || f.round.round_id;
    return notif.some((n) => n.batch_id === rid && n.to_staff_id === owner(f.dept_id) && String(n.message || "").includes(f.item.label));
  }).length;
  R.actions = {
    batch: cy.batch?.batch_id, taskRows: rows.length, checkRows: checks.length, closedByJudge: closed, steps: st,
    checkInherited: checks.filter((f) => f.cell.inherited).length, checkNotifiedNow: checks.filter((f) => f.notified).length, checkNotifiedIfOrigin: notifiedIfOrigin,
    checkByTrack: ["ws", "fc", "mt"].map((t) => `${t}:${checks.filter((c) => c.track === t).length}`).join(" "),
    count: cy.count,
  };
}

/* ── 유해·위험요인 개선 ── */
{
  const { rows } = await hz.loadHazards();
  const GROUP = { "접수": "방지", "피해방지": "판단", "1차 판단": "보고", "경영책임자 보고": "점검", "긴급안전점검": "개선", "개선 지시": "개선", "보수·보강 계획": "개선", "종결": "종결", "완료": "종결" };
  const groupOf = (r) => (r.severity === "경미" && r.stage === "1차 판단" ? "개선" : GROUP[r.stage] || "");
  const late = rows.filter((r) => r.deadline && (r.deadline.startLate || r.deadline.doneLate));
  const soon = rows.filter((r) => r.deadline && !r.deadline.startLate && !r.deadline.doneLate && ((r.deadline.startLeft ?? 999) <= 60 || (r.deadline.doneLeft ?? 999) <= 60));
  const serious = rows.filter((r) => r.severity === "심각");
  const repeat = rows.filter((r) => r.repeatN >= hz.REPEAT_N);
  R.hazards = {
    total: rows.length, open: rows.filter((r) => r.open).length, seriousOpen: serious.filter((r) => r.open).length,
    waitCeo: serious.filter((r) => !r.ceo_reported_at).length, reportLate: serious.filter((r) => r.reportLate).length,
    repeatGroups: new Set(repeat.map((r) => `${r.asset_id}|${r.accident_type}`)).size, repeatRows: repeat.length,
    late: late.length, soon: soon.length,
    groups: Object.fromEntries(["방지", "판단", "보고", "점검", "개선", "종결"].map((g) => [g, rows.filter((r) => groupOf(r) === g).length])),
    stages: rows.reduce((m, r) => ((m[r.stage] = (m[r.stage] || 0) + 1), m), {}),
    accTypesNotInList: [...new Set(rows.map((r) => r.accident_type).filter((a) => a && !hzc.ACCIDENT_TYPES.includes(a)))],
  };
}

/* ── 개선·시정명령 등 조치 ── */
{
  const X = await rec.loadRecurrence("");
  const curCells = X.nil.map((n) => n.cells[1]);
  R.recurrence = {
    incidents: X.incs.length, incOpen: X.incs.filter((i) => i.cur < 5).length, incLate: X.incs.filter((i) => i.cur < 5 && i.overdue).length,
    incRepeat: X.incs.filter((i) => i.repeat.length > 0).length,
    byStep: Object.fromEntries([1, 2, 3, 4, 5].map((k) => [k, X.incs.filter((i) => i.cur === k).length])),
    byClass: X.incs.reduce((m, i) => ((m[i.event_class] = (m[i.event_class] || 0) + 1), m), {}),
    serious: X.incs.filter((i) => i.serious === "해당").length,
    orders: X.ords.length, advice: X.advice.length, ordOpen: X.ords.filter((o) => o.cur < 5).length,
    ordLate: X.ords.filter((o) => o.overdue).length, ordSoon: X.ords.filter((o) => o.soon).length,
    ordByArea: X.ords.reduce((m, o) => ((m[o.order_area || "구분 전"] = (m[o.order_area || "구분 전"] || 0) + 1), m), {}),
    nilCur: `${curCells.filter((c) => c.state === "확인함").length}/${curCells.length}`,
    nilPrevBlank: X.nil.map((n) => n.cells[0]).filter((c) => c.state === "비어 있음").length,
    nilStates: X.nil.flatMap((n) => n.cells).reduce((m, c) => ((m[`${c.period} ${c.state}`] = (m[`${c.period} ${c.state}`] || 0) + 1), m), {}),
  };
}

/* ── 대시보드(총괄 · 전 기관) · 이행현황 ── */
{
  const year = "2026";
  const all = await calc.taskRows();
  const jm = new Map([...(await links.judgeMap("ws", year)), ...(await links.judgeMap("fc", year)), ...(await links.judgeMap("mt", year))]);
  const TRK = { I: "ws", F: "fc", M: "mt" };
  const dash = {};
  for (const tgt of ["I", "F", "M"]) {
    const recs = await calc.recordRows(TRK[tgt], year);
    const perf = links.withJudges([...all.filter((t) => t.year === year && t.area === tgt), ...recs], new Map([...jm].filter(([k]) => k.split("|")[1]?.startsWith(tgt))));
    const tally = (rows) => { const c = { O: 0, T: 0, X: 0, N: 0, W: 0 }; rows.forEach((r) => { const m = r.mark; if (m === "O") c.O++; else if (m === "△") c.T++; else if (m === "X") c.X++; else if (m === "-") c.N++; else c.W++; }); return c; };
    const f = (p) => (p === null ? "-" : (Math.floor(p * 10 + 1e-9) / 10).toFixed(1) + "%");
    const cA = tally(perf), c1 = tally(perf.filter((t) => t.half === "상반기")), c2 = tally(perf.filter((t) => t.half === "하반기"));
    dash[tgt] = { rows: perf.length, judgeRows: perf.filter((r) => r.from === "judge").length, all: f(calc.rateOf(cA)), H1: f(calc.rateOf(c1)), H2: f(calc.rateOf(c2)), cnt: cA };
  }
  R.dashboard = dash;
  const board = {};
  for (const t of ["ws", "fc", "mt"]) {
    const cols = await calc.deptList(null);
    const b = await calc.buildBoard(t, year, [1, 2, 3, 4], cols);
    board[t] = b.total === null ? "-" : (Math.floor(b.total * 10 + 1e-9) / 10).toFixed(1) + "%";
  }
  R.statusBoard = board;
  const ap = await data.approvals();
  R.itemApproved = ap.filter((a) => a.approved_via === merge.ITEM_APPROVAL_LABEL).length;
  R.judgeKeys = jm.size;
}

fs.writeFileSync(OUT, JSON.stringify(R, null, 1), "utf8");
console.log(JSON.stringify(R, null, 1));
