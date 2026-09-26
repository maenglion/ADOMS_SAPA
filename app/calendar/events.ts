/**
 * 연간 일정 — 일정 한 줄(Ev)을 세 원천에서 모은다. (2026-09-21)
 *
 *   법정       — 점검 주기 표(lib/cycle.ts CODE_CYCLE)로 계산: 반기 1회는 6.30.·12.31., 연 1회는 12.31.
 *   운영 예시  — 서울시 안내서 연간 일정·계절 점검(annual_schedule 표). 법정 기한이 아니고 기관이 날짜를 바꿀 수 있다.
 *   운영       — 운영 자료에서 나오는 날짜: 과제 기한 · 점검 시작·결재 · 조치 기한 · 교육 기한 · 대피훈련 ·
 *                보수·보강 기한 · 개선·시정명령 기한 · 계약 종료 · 안전계획 미수립
 *
 * 표가 아직 없으면(다른 화면이 만드는 중) 조용히 건너뛴다. 모든 표는 readTable 로 읽는다.
 */
import { batchListWithRounds } from "@/lib/check_merge";
import "server-only";
import { readTable, depts, type Row } from "@/lib/data";
import { idKo } from "@/lib/labels";
import { allTasks, batchList, halfChecks, annualChecks, halfEnd, CYCLE_LABEL } from "@/lib/cycle";
import { ORD_AREAS, ORD_AREA_BASIS, ORD_AREA_LABEL, isAdvice } from "@/app/recurrence/model";
import { ymd as localYmd } from "@/lib/day";

export type Src = "법정" | "운영 예시" | "운영";
export type Ev = {
  key: string;
  date: string;          // 시작(또는 그날) YYYY-MM-DD
  end?: string;          // 기간이면 끝날
  title: string;
  src: Src;
  basis?: string;        // 근거 조문·출처
  href: string;
  done: boolean;
  group?: "task";        // 달력 칸에서 한 줄로 묶을 것
  n?: number; left?: number;
};

export type Status = { label: string; tone: "ok" | "warn" | "bad" | "none" };

export const ymd = (d: Date) => localYmd(d);   // 한국 시각 날짜(lib/day)
const d10 = (s?: string) => String(s || "").slice(0, 10);
const okDate = (s?: string) => /^\d{4}-\d{2}-\d{2}$/.test(d10(s));
const pad = (n: number | string) => String(n).padStart(2, "0");

function addYears(s: string, n: number) {
  const d = new Date(`${s}T00:00:00`);
  d.setFullYear(d.getFullYear() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 일정 한 줄의 상태 — 끝남 · 지남(안 끝남) · 진행 중 · 다가옴(30일 안) · 예정. */
export function statusOf(e: Ev, today: string): Status {
  const last = e.end || e.date;
  if (e.done) return { label: "끝남", tone: "ok" };
  // 운영 예시는 한 일을 따로 적지 않는다 — 지났으면 「지난 일정」일 뿐 경고하지 않는다.
  if (e.src === "운영 예시" && last < today) return { label: "지난 일정", tone: "none" };
  if (last < today) return { label: "지남 · 안 끝남", tone: "bad" };
  if (e.date <= today) return { label: "진행 중", tone: "warn" };
  const days = Math.round((+new Date(`${e.date}T00:00:00`) - +new Date(`${today}T00:00:00`)) / 86400000);
  if (days <= 30) return { label: `${days}일 남음`, tone: "warn" };
  return { label: "예정", tone: "none" };
}

async function safe(table: string, key?: string): Promise<Row[]> {
  try { return await readTable(table, key); } catch { return []; }
}

/** 모든 일정(연도 구분 없이) — 화면이 연도·달로 거른다. */
export async function collectEvents(role: string, years: number[]): Promise<Ev[]> {
  const q = (href: string, extra = "") => `${href}${href.includes("?") ? "&" : "?"}role=${role}${extra}`;
  const ev: Ev[] = [];
  // 09-26 사용자: 옛 점검 화면 합치기 — 이행점검 회차도 함께(lib/check_merge.ts)
  const [tasks, batches, deptList] = await Promise.all([allTasks(), batchListWithRounds(), depts()]);
  const dn = new Map<string, string>(deptList.map((d: any) => [d.dept_id, d.dept_name]));
  const active = [...new Set(tasks.map((t) => String(t.code36 || "").split(";")[0].trim()).filter(Boolean))];

  /* ── 법정: 반기 1회 · 연 1회 ─────────────────────────── */
  for (const y of years) {
    for (const h of ["상반기", "하반기"]) {
      const hc = halfChecks(batches, y, h, active);
      if (!hc.length) continue;
      const short = hc.filter((c) => c.state !== "충족");
      ev.push({
        key: `law-half-${y}-${h}`, date: halfEnd(y, h), src: "법정", done: short.length === 0,
        title: `${CYCLE_LABEL.반기} 점검 — ${y}년 ${h} 끝(${h === "상반기" ? "6.30." : "12.31."})` +
          (short.length ? ` · 결재 전 의무조항 ${short.length}개(${short.map((c) => c.code).join(", ")})` : " · 모두 결재완료"),
        basis: "시행령 제4조·제5조제2항·제8조제5호·제9조제2항·제10조제5호 — 반기 1회 이상 점검",
        href: q("/inspections", "#plan"), n: hc.length, left: short.length,
      });
    }
    for (const a of annualChecks(batches, y, active)) {
      ev.push({
        key: `law-year-${y}-${a.code}`, date: `${y}-12-31`, src: "법정", done: a.state === "충족",
        title: `${CYCLE_LABEL.연} 점검 — ${a.code} · ${y}년 안 결재된 점검 ${a.state === "충족" ? a.approved.map((b) => idKo(b.batch_id)).join("·") : "없음"}`,
        basis: a.basis, href: q("/inspections", "&view=approve"),
      });
    }
  }

  /* ── 운영 예시: 서울시 연간 일정 ─────────────────────── */
  const sched = await safe("annual_schedule", "sched_id");
  for (const y of years) {
    for (const s of sched) {
      const mf = Number(s.month_from), mt = Number(s.month_to || s.month_from);
      if (!mf) continue;
      const df = Number(s.day_from || 1), dt = Number(s.day_to || new Date(y, mt, 0).getDate());
      ev.push({
        key: `sch-${y}-${s.sched_id}`, date: `${y}-${pad(mf)}-${pad(df)}`, end: `${y}-${pad(mt)}-${pad(dt)}`,
        title: s.title, src: "운영 예시", done: false,
        basis: [s.basis, s.source].filter(Boolean).join(" · "), href: q(s.href || "/report"),
      });
    }
  }

  /* ── 운영: 과제 기한(부서 × 달로 묶음) ───────────────── */
  const DONE = new Set(["이행완료", "점검완료"]);
  const byDM = new Map<string, Row[]>();
  tasks.forEach((t) => {
    if (!okDate(t.due_date) || t.applicability === "비해당") return;
    const k = `${t.dept_id}|${d10(t.due_date).slice(0, 7)}`;
    byDM.set(k, [...(byDM.get(k) || []), t]);
  });
  const todayStr = ymd(new Date());
  for (const [k, list] of byDM) {
    const [dept, ym] = k.split("|");
    const nm = dn.get(dept) || dept;
    const open = list.filter((t) => !DONE.has(t.status));
    const late = open.filter((t) => d10(t.due_date) < todayStr).map((t) => d10(t.due_date)).sort();
    const rest = list.filter((t) => DONE.has(t.status) || d10(t.due_date) >= todayStr);
    const restOpen = rest.filter((t) => !DONE.has(t.status)).map((t) => d10(t.due_date)).sort();
    const basis = `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월 기한 · 담당 의무의 주기(상시·수시·반기·연 1회)에 따름`;
    // 기한이 지났는데 안 끝난 것은 따로 한 줄로 뺀다(「지난 것 중 안 끝난 것」에 잡히게).
    if (late.length) ev.push({
      key: `task-late-${k}`, group: "task", src: "운영", n: late.length, left: late.length, done: false,
      date: late[0], end: late[late.length - 1],
      title: `${nm} 기한 지난 과제 ${late.length}건`, basis,
      href: q("/tasks", `&dept=${dept}`),
    });
    if (rest.length) {
      const ds = (restOpen.length ? restOpen : rest.map((t) => d10(t.due_date)).sort());
      ev.push({
        key: `task-${k}`, group: "task", src: "운영", n: rest.length, left: restOpen.length, done: restOpen.length === 0,
        date: ds[0], end: ds[ds.length - 1],
        title: `${nm} 과제 기한 ${rest.length}건${restOpen.length ? ` · 남음 ${restOpen.length}` : " · 모두 끝남"}`,
        basis, href: q("/tasks", `&dept=${dept}`),
      });
    }
  }

  /* ── 운영: 점검 시작·결재 ─────────────────────────────── */
  for (const b of batches) {
    if (okDate(b.started_at)) ev.push({
      key: `bat-s-${b.batch_id}`, date: d10(b.started_at), src: "운영", done: true,
      title: `점검 시작 — ${b.title} (${idKo(b.batch_id)})`, basis: b.rule_basis || "", href: b.from === "이행점검" ? q(`/check/${b.track}/review`, "") : q("/inspections", `&b=${b.batch_id}`),
    });
    if (b.status === "결재완료") {
      if (okDate(b.approved_at)) ev.push({
        key: `bat-a-${b.batch_id}`, date: d10(b.approved_at), src: "운영", done: true,
        title: `점검 결재 확정 — ${b.title} (${idKo(b.batch_id)})`, href: b.from === "이행점검" ? q(`/check/${b.track}/summary`, "") : q("/inspections", `&view=approve&b=${b.batch_id}`),
      });
    } else if (b.period_year && b.half_year) {
      ev.push({
        key: `bat-due-${b.batch_id}`, date: halfEnd(b.period_year, b.half_year), src: "운영", done: false,
        title: `점검 결재 — ${b.title} (${idKo(b.batch_id)} · ${b.status})`,
        basis: "반기 끝까지 결재해야 그 반기 점검으로 셉니다", href: b.from === "이행점검" ? q(`/check/${b.track}/summary`, "") : q("/inspections", `&view=approve&b=${b.batch_id}`),
      });
    }
  }

  /* ── 운영: 점검 결과 조치 기한(달로 묶음) ───────────────── */
  const acts = await safe("action", "action_id");
  const actM = new Map<string, Row[]>();
  acts.forEach((a) => { if (okDate(a.due_date)) { const k = d10(a.due_date).slice(0, 7); actM.set(k, [...(actM.get(k) || []), a]); } });
  for (const [ym, list] of actM) {
    const open = list.filter((a) => !a.done_at && a.result !== "완료");
    const late = open.filter((a) => d10(a.due_date) < todayStr).map((a) => d10(a.due_date)).sort();
    const rest = list.filter((a) => !open.includes(a) || d10(a.due_date) >= todayStr);
    const restOpen = rest.filter((a) => open.includes(a)).map((a) => d10(a.due_date)).sort();
    const basis = "보완필요·부적합 판정에 따른 조치";
    if (late.length) ev.push({
      key: `act-late-${ym}`, src: "운영", date: late[0], end: late[late.length - 1], done: false, n: late.length, left: late.length,
      title: `기한 지난 점검 결과 조치 ${late.length}건`, basis, href: q("/actions"),
    });
    if (rest.length) {
      const ds = restOpen.length ? restOpen : rest.map((a) => d10(a.due_date)).sort();
      ev.push({
        key: `act-${ym}`, src: "운영", date: ds[0], end: ds[ds.length - 1], done: restOpen.length === 0, n: rest.length, left: restOpen.length,
        title: `점검 결과 조치 기한 ${rest.length}건${restOpen.length ? ` · 남음 ${restOpen.length}` : " · 모두 끝남"}`,
        basis, href: q("/actions"),
      });
    }
  }

  /* ── 운영: 교육 기한 ───────────────────────────────────── */
  const [trs, courses] = await Promise.all([safe("training_record", "training_id"), safe("training_course", "course_id")]);
  const cBasis = new Map<string, string>(courses.map((c) => [c.course_id, c.basis]));
  const trG = new Map<string, Row[]>();
  trs.forEach((t) => {
    if (!okDate(t.due_date) || t.status === "이수") return;
    const k = `${d10(t.due_date)}|${t.course_id || t.course_name}`;
    trG.set(k, [...(trG.get(k) || []), t]);
  });
  for (const [k, list] of trG) {
    const t = list[0];
    ev.push({
      key: `trn-${k}`, date: d10(t.due_date), src: "운영", done: false, n: list.length, left: list.length,
      title: `교육 기한 — ${t.course_name} 미이수 ${list.length}명`,
      basis: cBasis.get(t.course_id) || t.law || "", href: q("/training"),
    });
  }

  /* ── 운영: 대피훈련 ─────────────────────────────────────── */
  for (const d of await safe("drill_plan", "drill_id")) {
    if (!okDate(d.planned_at)) continue;
    ev.push({
      key: `drl-${d.drill_id}`, date: d10(d.planned_at), src: "운영",
      done: Boolean(d.done_at) || String(d.status || "").includes("완료"),
      title: `대피훈련 — ${d.target_name} (${d.drill_type || ""} · ${d.status || "계획"})`,
      basis: d.legal_scope === "법정 대상" ? "시행령 제10조제7호라목 — 대피훈련에 관한 사항" : "기관 자체 훈련",
      href: q("/drills"),
    });
  }

  /* ── 운영: 유해·위험요인 보수·보강 기한 ─────────────────── */
  // 시설물안전법 적용 건: 기준일부터 1년 안 착수, 착수일부터 2년 안 완료(유해·위험요인 화면과 같은 규칙).
  for (const h of await safe("hazard_report", "hz_id")) {
    if (h.fsam_applies !== "Y" || !okDate(h.basis_date)) continue;
    const startBy = addYears(d10(h.basis_date), 1);
    const doneBy = addYears(d10(h.fix_started_at) || startBy, 2);
    const nm = `${h.asset_name || ""} ${h.location || ""}`.trim();
    const basis = "시행령 제10조제7호나목 보수·보강 · 시설물안전법 기한(기준일부터 1년 안 착수 · 착수 뒤 2년 안 완료)";
    ev.push({ key: `hz-s-${h.hz_id}`, date: startBy, src: "운영", done: Boolean(h.fix_started_at),
      title: `보수·보강 착수 기한 — ${nm} (${idKo(h.hz_id)})`, basis, href: q("/hazards") });
    ev.push({ key: `hz-d-${h.hz_id}`, date: doneBy, src: "운영", done: Boolean(h.fix_done_at),
      title: `보수·보강 완료 기한 — ${nm} (${idKo(h.hz_id)})`, basis, href: q("/hazards") });
  }

  /* ── 운영: 개선·시정명령 기한 ───────────────────────────── */
  // (09-21) 기한 일정에는 **서면 행정처분**만 올린다 — 지도·권고·조언은 「명한 사항」이 아니라 참고 기록이다(재발방지 화면과 같은 규칙).
  //   성격 칸이 빈 옛 행은 넘겨짚어 빼지 않고 올리되 「성격 확인 전」을 붙인다.
  //   근거 조문은 재해 구분(order_area)에 맞춰 하나만 — 구분 전이면 세 조문을 함께 적는다.
  for (const o of await safe("order_received", "order_id")) {
    if (isAdvice(o)) continue;
    const due = d10(o.extended_due) || d10(o.due_date);
    if (!okDate(due)) continue;
    const area = String(o.order_area || "").trim();
    const clause = ORD_AREA_BASIS[area]
      ? `${ORD_AREA_BASIS[area]}(${ORD_AREA_LABEL[area]})`
      : `재해 구분 전 — ${ORD_AREAS.map((a) => `${ORD_AREA_BASIS[a]}(${ORD_AREA_LABEL[a]})`).join(" · ")}`;
    const law = o.law_article && o.law && String(o.law_article).startsWith(o.law) ? o.law_article : [o.law, o.law_article].filter(Boolean).join(" ");
    ev.push({
      key: `ord-${o.order_id}`, date: due, src: "운영",
      done: Boolean(o.done_at || o.closed_at) || String(o.result || "").includes("완료"),
      title: `개선·시정명령 기한 — ${o.content} (${o.issuer || ""}${o.extended_due ? " · 기한 연장" : ""}${o.doc_nature ? "" : " · 문서 성격 확인 전"})`,
      basis: `${clause} 명한 사항의 이행${law ? ` · ${law}` : ""}`,
      href: q("/recurrence"),
    });
  }

  /* ── 운영: 계약 종료 ───────────────────────────────────── */
  const today = todayStr;
  for (const c of await safe("contract", "contract_id")) {
    if (!okDate(c.end_date)) continue;
    ev.push({
      key: `ctr-${c.contract_id}`, date: d10(c.end_date), src: "운영", done: d10(c.end_date) < today,
      title: `계약 종료 — ${c.contract_name} (${c.counterpart || ""})`,
      basis: "도급·용역·위탁 관리(법 제5조 · 시행령 제10조제8호) — 준공 때 안전보건 관리비 정산",
      href: q("/contracts", c.dept_id ? `&dept=${c.dept_id}` : ""),
    });
  }

  /* ── 운영: 안전계획 미수립(연 1회) ─────────────────────── */
  const plans = await safe("civil_safety_plan", "plan_id");
  for (const y of years) {
    const mine = plans.filter((p) => String(p.plan_year) === String(y));
    if (!mine.length) continue;
    const notYet = mine.filter((p) => p.plan_status !== "수립");
    ev.push({
      key: `csp-${y}`, date: `${y}-12-31`, src: "운영", done: notYet.length === 0, n: mine.length, left: notYet.length,
      title: `안전계획 — ${y}년 대상 ${mine.length}곳 중 ${notYet.length ? `미수립·작성 중 ${notYet.length}곳` : "모두 수립"}`,
      basis: "시행령 제10조제4호 — 연 1회 이상 안전계획 수립", href: q("/system"),
    });
  }

  return ev.filter((e) => okDate(e.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.src < b.src ? -1 : 1));
}
