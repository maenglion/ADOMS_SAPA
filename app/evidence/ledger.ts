/**
 * 증빙 대장 · 호별 필수 증빙 — 읽기 모형 (2026-09-21)
 *
 * 근거: 중대재해처벌법 시행령 제13조(법령DB DOC-000005 a13 원문 확인)
 *   「제4조, 제5조 및 제8조부터 제11조까지의 규정에 따른 조치 등의 이행에 관한 사항을 서면(전자문서 포함)으로
 *    작성하여 그 조치 등을 이행한 날부터 5년간 보관해야 한다.」
 *
 * 이행일 = 과제를 이행한 날(done_at)이 있으면 그 날, 없으면 증빙을 올린 날.
 * 보존 만료일 = 이행일 + 5년. 만료가 지나도 **자동으로 지우지 않는다**(폐기는 사람이 정한다).
 *
 * 호별 필수 증빙
 *   · 시행령 제10조 각 호 · 법 제9조제2항 각 호 — 서울시 「시민재해 안전보건업무 안내서」 붙임 4-5 문서관리 항목(p.136~138)
 *   · 시행령 제4조 각 호 — 안내서에 목록이 없어 **시행령 원문에서 서류를 뽑은 초안**이다(기관이 확정한다).
 *   대조는 증빙 종류·파일 이름으로 자동으로 맞춘 것이라 사람이 열어 보고 확인해야 한다.
 */
import "server-only";
import { tasks, evidences, readTable, depts, type Row } from "@/lib/data";
import { materialStatus, ST_LABEL } from "@/lib/system";
import { DUTY36 } from "@/lib/duty36";
import { loadStepEvidence, fileKeys } from "@/lib/evidence_merge";   // 09-26 사용자: 증빙 대장 합치기 — 의무이행 단계 증빙 읽기

export const KEEP_YEARS = 5;
export const SOON_DAYS = 180;

const firstCode = (c?: string) => String(c || "").split(";")[0].trim();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayStr = () => ymd(new Date());
export function plusYears(s: string, n: number) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y) return "";
  const dt = new Date(y + n, (m || 1) - 1, d || 1);
  return ymd(dt);
}
export const daysTo = (s: string, from = todayStr()) =>
  Math.round((+new Date(s + "T00:00:00") - +new Date(from + "T00:00:00")) / 86400000);

/** 의무조항 코드 → 중대재해처벌법의 자리(조문). 서류 보관 의무는 이 조치들에 걸린다. */
export function sapaClause(code?: string): string {
  const c = firstCode(code);
  const n = Number(c.slice(1));
  if (!c) return "";
  if (c[0] === "I") {
    if (n <= 9) return `시행령 제4조제${n}호`;
    return ({ 10: "법 제4조제1항제2호", 11: "법 제4조제1항제3호", 12: "시행령 제5조제2항제1·2호", 13: "시행령 제5조제2항제3·4호", 14: "법 제5조" } as Record<number, string>)[n] || "";
  }
  if (c[0] === "F") {
    if (n <= 8) return `시행령 제10조제${n}호`;
    return ({ 9: "법 제9조제2항제2호", 10: "법 제9조제2항제3호", 11: "시행령 제11조제2항제1·2호", 12: "시행령 제11조제2항제3·4호", 13: "법 제9조제3항" } as Record<number, string>)[n] || "";
  }
  if (c[0] === "M") {
    if (n <= 5) return `시행령 제8조제${n}호`;
    return ({ 6: "법 제9조제1항제2호", 7: "법 제9조제1항제3호", 8: "시행령 제9조제2항제1·2호", 9: "시행령 제9조제2항제3·4호" } as Record<number, string>)[n] || "";
  }
  return "";
}

export type LedgerRow = {
  evidence_id: string; task_id: string; area: string; code36: string; code36_name: string;
  sapa: string; law: string; unit: string; duty: string; target: string; dept_id: string; dept_name: string;
  kind: string; file_name: string; file_url: string; hasFile: boolean;
  uploaded_at: string; done_at: string; doneDate: string; doneBasis: "과제 이행일" | "올린 날" | "기록한 날";
  expires: string; left: number; state: "보존 중" | "만료 임박" | "보존 기간 지남";
  uploaded_by: string;
  /** [캡처 v2] K03 — 과제 증빙이 아닌 입력 화면 기록이면 그 화면 이름과 주소(과제 증빙은 빈칸). */
  src?: string; href?: string;
  // 09-26 사용자: 증빙 대장 합치기 — 출처(증빙 등록·결재 / 입력 화면 기록 / 의무이행 단계)와 두 곳에 같은 파일이 있을 때의 짝
  origin?: Origin;
  /** 의무이행 단계에도 같은 파일이 있으면 그 단계(대상 · 단계 이름)와 주소 — 한 줄로 묶고 「두 곳」으로 표시한다.
   *  key = 묶음 키(나누기·다시 묶기에 쓴다). */
  also?: { label: string; href: string; key: string }[];
  /** 09-26 사용자(2차): 이름이 같아 묶였다가 「다른 파일로 나누기」로 나눈 짝 — 두 줄 모두에 붙는다(「나눔」 표시 · 다시 묶기). */
  split?: { label: string; key: string }[];
};

// 09-26 사용자: 증빙 대장 합치기 — 출처 값. reg = 증빙 등록·결재(과제 증빙) · screen = 입력 화면 기록(K03) · step = 의무이행 단계
//   09-26 사용자(2차): 「입력화면 기록 의무이행단계로 합치자」 — 걸러 보기·출처 갈래는 둘(증빙 등록·결재 / 의무이행 단계).
//   screen 은 의무이행 단계 갈래 안의 세부 출처(「입력 화면 · 체계 기록」 등)로만 남는다.
export type Origin = "reg" | "screen" | "step";
export const ORIGIN_LABEL: Record<Origin, string> = { reg: "증빙 등록·결재", screen: "의무이행 단계", step: "의무이행 단계" };
/** 09-26 사용자(2차): 출처 갈래 — reg 는 증빙 등록·결재, 나머지는 의무이행 단계. */
export const originGroup = (r: LedgerRow): "reg" | "step" => ((r.origin || (r.task_id ? "reg" : "screen")) === "reg" ? "reg" : "step");

/** 09-26 사용자(2차): 「다른 파일로 나누기」·「다시 묶기」 기록 표. 지우지 않고 쌓는다 — 한 묶음 키에서 가장 최근 줄이 이긴다. */
export const SPLIT_TABLE = "evidence_split";
export const SPLIT_ROLES = new Set(["gm", "mgr", "road_head", "water_head"]);   // 총괄 · 관리자 · 부서장(09-26 사용자: 「부서장에게도 열자」)
export async function splitKeys(): Promise<Set<string>> {
  const rows = await readTable(SPLIT_TABLE, "split_id");
  // 덮개에 붙인 줄은 앞쪽이 최신(appendRow 가 맨 앞에 넣는다) — 같은 시각이면 앞 줄이 이긴다
  const ord = rows.map((r, i) => ({ r, i })).sort((a, b) => (String(a.r.at) < String(b.r.at) ? 1 : String(a.r.at) > String(b.r.at) ? -1 : a.i - b.i));
  const seen = new Set<string>(), out = new Set<string>();
  for (const { r } of ord) {
    const k = String(r.pair_key || "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (r.act === "나눔") out.add(k);
  }
  return out;
}

/* ── [캡처 v2] K03 입력 화면의 증빙 모으기 (2026-09-24) ─────────────────────────
 * 체계 기록 · 공중이용시설 체계 기록 · 원료·제조물 점검 · 예산 집행 · 교육 이수증 · 재발방지 4단계 ·
 * 개선·시정명령 이행·보고 · 도급 관리의무 · 선임·지정 문서. 각 화면이 lib/attach.ts 로 남긴
 * 이름 칸 + 주소 칸(evidence_url 등)을 그대로 읽는다. 파일이 없고 이름만 있는 기록도 「이름만」으로 싣는다.
 * 이행일 = 그 기록의 날짜(점검일·집행일·이수일 …). 보존 만료 = 이행일 + 5년(시행령 제13조) — 과제 증빙과 같은 셈.
 */
type Src = { src: string; href: string; id: string; kind: string; name: string; url: string; date: string;
  area: string; code: string; duty: string; dept: string; by?: string };

const nameOf36 = (code: string) => DUTY36.find((d) => d.code === code)?.name || "";
const ORD_AREA_CODE: Record<string, [string, string]> = { 산업: ["I", "I11"], 시민: ["F", "F10"], "원료·제조물": ["M", "M07"] };

async function screenSources(): Promise<Src[]> {
  const [sys, org, civ, bex, bud, trn, crs, inc, ord, cc, ctr] = await Promise.all([
    readTable("system_record", "record_id"), readTable("safety_org_role", "role_id"), readTable("civil_record", "record_id"),
    readTable("budget_exec", "exec_id"), readTable("safety_budget", "budget_id"), readTable("training_record", "training_id"),
    readTable("training_course", "course_id"), readTable("incident", "incident_id"), readTable("order_received", "order_id"),
    readTable("contract_compliance", "cc_id"), readTable("contract", "contract_id"),
  ]);
  const out: Src[] = [];
  const has = (n?: string, u?: string) => Boolean(String(n || "").trim() || String(u || "").trim());

  for (const r of sys) {
    if (!has(r.doc_name, r.evidence_url)) continue;
    const mat = r.clause_no === "M8-5";
    const code = mat ? "M05" : /^[1-9]$/.test(String(r.clause_no)) ? `I0${r.clause_no}` : "";
    out.push({ src: mat ? "원료·제조물 점검" : "체계 기록", href: mat ? "/system?area=M#m5rec" : `/system/record?clause=${r.clause_no}`,
      id: r.record_id, kind: r.record_kind || "기록", name: r.doc_name, url: r.evidence_url || "", date: r.done_at,
      area: mat ? "M" : "I", code, duty: r.title || "", dept: r.dept_id || "", by: r.created_by });
  }
  for (const r of org) {
    if (!has(r.doc_name, r.evidence_url)) continue;
    const code = /^[1-9]$/.test(String(r.clause_no || "")) ? `I0${r.clause_no}` : "";
    out.push({ src: "선임·지정", href: "/system#matrix", id: r.role_id, kind: `${r.role_item} ${r.status || ""}`.trim(), name: r.doc_name,
      url: r.evidence_url || "", date: r.designated_at, area: "I", code, duty: `${r.role_item} ${r.status || ""}`.trim(), dept: r.dept_id || "" });
  }
  for (const r of civ) {
    if (!has(r.evidence_name, r.evidence_url)) continue;
    const no = String(r.clause_ref || "").split("-")[1] || "";
    out.push({ src: "공중이용시설 체계 기록", href: `/system/civil?clause=${no}`, id: r.record_id, kind: r.record_kind || "기록",
      name: r.evidence_name, url: r.evidence_url || "", date: r.done_at, area: "F", code: /^[1-9]$/.test(no) ? `F0${no}` : "",
      duty: r.title || "", dept: "", by: r.created_by });
  }
  const budById = new Map(bud.map((b) => [b.budget_id, b]));
  for (const r of bex) {
    if (!has(r.evidence_name, r.evidence_url)) continue;
    const b = budById.get(r.budget_id) || {};
    const a = ["F", "M"].includes(String(b.area || "")) ? String(b.area) : "I";
    out.push({ src: "예산 집행", href: `/budget?area=${a}&line=${r.budget_id}#line`, id: r.exec_id, kind: "집행 증빙",
      name: r.evidence_name, url: r.evidence_url || "", date: r.exec_date, area: a, code: a === "I" ? "I04" : `${a}02`,
      duty: `${b.budget_item || ""} ${r.exec_desc || ""}`.trim(), dept: b.dept_id || "", by: r.created_by });
  }
  const crsById = new Map(crs.map((c) => [c.course_id, c]));
  const TRN_CODE: Record<string, string> = { I: "I13", F: "F12", M: "M09" };
  for (const r of trn) {
    if (r.status !== "이수" || !has(r.certificate_file, r.evidence_url)) continue;
    const c = crsById.get(r.course_id) || { course_id: r.course_id };
    const a = String(c.area || "").trim();
    const area = a === "F" || a === "M" ? a : "I";
    out.push({ src: "교육 이수", href: `/training?area=${area}`, id: r.training_id, kind: "이수증", name: r.certificate_file,
      url: r.evidence_url || "", date: r.trained_at, area, code: TRN_CODE[area], duty: r.course_name || "", dept: r.dept_id || "", by: r.done_by });
  }
  for (const r of inc) {
    if (r.event_class === "아차사고") continue;
    const area = r.event_area === "산업" ? "I" : String(r.basis_clause || "").includes("제9조제1항") ? "M" : "F";
    const code = area === "I" ? "I10" : area === "M" ? "M06" : "F09";
    const steps: [string, string, string, string][] = [
      ["조사 기록", r.cause_evidence, r.cause_evidence_url, r.investigated_at],
      ["대책 문서", r.plan_evidence, r.plan_evidence_url, r.plan_set_at],
      ["이행 증빙", r.done_evidence, r.done_evidence_url, r.plan_done_at],
      ["효과 확인 기록", r.effect_evidence, r.effect_evidence_url, r.effect_checked_at],
    ];
    for (const [k, n, u, d] of steps) {
      if (!has(n, u)) continue;
      out.push({ src: "재발방지", href: `/recurrence#${r.incident_id}`, id: `${r.incident_id}·${k}`, kind: k, name: n, url: u || "",
        date: d, area, code, duty: r.summary || "", dept: r.dept_id || "" });
    }
  }
  for (const r of ord) {
    if (r.doc_nature === "지도·권고·조언") continue;
    const [area, code] = ORD_AREA_CODE[String(r.order_area || "")] || ["I", "I11"];
    const pairs: [string, string, string, string][] = [
      ["이행 증빙", r.evidence_file, r.evidence_url, r.done_at],
      ["이행 결과 보고", r.report_evidence, r.report_evidence_url, r.reported_at],
    ];
    for (const [k, n, u, d] of pairs) {
      if (!has(n, u)) continue;
      out.push({ src: "개선·시정명령", href: `/recurrence#${r.order_id}`, id: `${r.order_id}·${k}`, kind: k, name: n, url: u || "",
        date: d, area, code, duty: r.content || "", dept: r.dept_id || "" });
    }
  }
  const ctrById = new Map(ctr.map((c) => [c.contract_id, c]));
  for (const r of cc) {
    if (r.status === "해당없음" || !has(r.evidence_name, r.evidence_url)) continue;
    const c = ctrById.get(r.contract_id) || {};
    const civil = c.apply_frame === "시민";
    out.push({ src: "도급·용역·위탁", href: `/contracts?c=${r.contract_id}#cc`, id: r.cc_id, kind: "관리의무 증빙", name: r.evidence_name,
      url: r.evidence_url || "", date: r.checked_at, area: civil ? "F" : "I", code: civil ? "F08" : "I09",
      duty: c.contract_name || "", dept: c.dept_id || "" });
  }
  return out;
}

/**
 * 09-26 사용자: 증빙 대장 합치기 — `steps: true` 면 의무이행 단계 증빙(lib/evidence_merge)을 읽을 때 합친다.
 *   증빙 대장 화면과 그 엑셀, 호별 증빙(loadSlots — 09-26 사용자 2차)이 true 로 부른다. /api/export 는 지금대로(false).
 *   같은 파일이 이미 대장에 있으면(주소가 같거나, 재해 구분이 같고 파일 이름이 같으면) 새 줄을 만들지 않고
 *   그 줄의 `also` 에 단계를 적는다 — 한 줄로 묶고 「두 곳」으로 보인다.
 *   09-26 사용자(2차): 「나중에 파일이 다르다는 것이 확인되면 나눠야겠지」 — 묶음 키가 evidence_split 에서 「나눔」이면
 *   묶지 않고 두 줄로 보인다(두 줄 모두 `split` 에 짝을 적는다 → 「나눔」 표시 · 다시 묶기).
 */
export async function loadLedger(opt: { steps?: boolean } = {}): Promise<LedgerRow[]> {
  const base = await loadLedgerBase();
  if (!opt.steps) return base;
  const [st, cut] = await Promise.all([loadStepEvidence(), splitKeys()]);
  const t0 = todayStr();
  const byKey = new Map<string, LedgerRow>();
  for (const r of base) for (const k of fileKeys(r.area, r.file_name, r.file_url)) if (!byKey.has(k)) byKey.set(k, r);
  const extra: LedgerRow[] = [];
  for (const x of st) {
    const place = `${x.trackLabel} · ${x.target} · ${x.stepLabel}`;
    const hit = fileKeys(x.area, x.name, x.url).map((k) => byKey.get(k)).find(Boolean);
    // 묶음 키 = 대장 줄(출처:번호) | 단계 파일(행 번호·순번) — 한 짝을 가리킨다
    const pair = hit ? pairKey(hit, x.id) : "";
    if (hit && !cut.has(pair)) { hit.also = [...(hit.also || []), { label: place, href: x.href, key: pair }]; continue; }
    const expires = x.doneDate ? plusYears(x.doneDate, KEEP_YEARS) : "";
    const left = expires ? daysTo(expires, t0) : 99999;
    if (hit) hit.split = [...(hit.split || []), { label: `${ORIGIN_LABEL.step} — ${place}`, key: pair }];
    extra.push({
      evidence_id: x.id, task_id: "", area: x.area, code36: x.code36, code36_name: nameOf36(x.code36), sapa: sapaClause(x.code36),
      law: "", unit: "", duty: x.what || x.stepLabel, target: x.target, dept_id: x.dept_id, dept_name: "",
      // 09-26 사용자(2차): 종류 글자는 호별 증빙 대조(kw 정규식 「의무이행|점검」 등)에 걸리지 않는 말로 — 「단계 증빙」
      kind: "단계 증빙", file_name: x.name, file_url: x.url, hasFile: Boolean(x.url),
      uploaded_at: x.at, done_at: x.doneBasis === "기록한 날" ? x.doneDate : "", doneDate: x.doneDate, doneBasis: x.doneBasis,
      expires, left, state: left < 0 ? "보존 기간 지남" : left <= SOON_DAYS ? "만료 임박" : "보존 중",
      uploaded_by: x.by, src: place, href: x.href, origin: "step",
      ...(hit ? { split: [{ label: originText({ ...hit, also: [] }), key: pair }] } : {}),
    });
  }
  if (extra.length) {
    const dn = new Map<string, string>((await depts()).map((d: Row) => [d.dept_id, d.dept_name]));
    extra.forEach((r) => (r.dept_name = dn.get(r.dept_id) || ""));
  }
  return [...base, ...extra].filter((r) => !FILES_ONLY || r.hasFile)
    .sort((a, b) => (a.expires < b.expires ? -1 : a.expires > b.expires ? 1 : 0));
}

/**
 * 09-26 사용자: 증빙 대장 합치기 — 화면과 엑셀이 같은 걸러 보기를 쓴다(같은 숫자가 나오게).
 *   o = reg(증빙 등록·결재 — 의무이행 단계에도 있어 묶인 줄 포함) · step(의무이행 단계 — 입력 화면 기록 포함, 09-26 사용자 2차)
 *   두 곳에 다 있어 묶인 줄은 양쪽 갈래에 다 나온다(한 파일이 두 곳에 있다는 뜻 그대로).
 */
export function filterLedger(all: LedgerRow[], p: { area?: string; f?: string; code?: string; o?: string }): LedgerRow[] {
  let rows = all;
  if (p.area) rows = rows.filter((r) => r.area === p.area);
  if (p.f === "nofile") rows = rows.filter((r) => !r.hasFile);
  if (p.f === "file") rows = rows.filter((r) => r.hasFile);
  if (p.f === "soon") rows = rows.filter((r) => r.state !== "보존 중");
  if (p.code) rows = rows.filter((r) => r.code36 === p.code);
  if (p.o === "reg") rows = rows.filter((r) => originGroup(r) === "reg");
  if (p.o === "step") rows = rows.filter((r) => originGroup(r) === "step" || (r.also && r.also.length));
  return rows;
}

/** 09-26 사용자(2차): 묶음 키 — 대장 줄(출처:번호)과 단계 파일(행 번호·순번) 한 짝. */
export const pairKey = (r: LedgerRow, stepId: string) => `${r.origin || "reg"}:${r.evidence_id}|${stepId}`;

/** 09-26 사용자: 증빙 대장 합치기 — 「출처」 칸 글자(화면·엑셀 공통). 2차: 입력 화면 기록은 의무이행 단계 갈래의 세부 출처. */
export function originText(r: LedgerRow): string {
  const o = r.origin || (r.task_id ? "reg" : "screen");
  const main = o === "step" ? `${ORIGIN_LABEL.step} — ${r.src || ""}` : o === "screen" ? `${ORIGIN_LABEL.step} — 입력 화면 · ${r.src || ""}` : ORIGIN_LABEL.reg;
  const also = (r.also || []).map((a) => `${ORIGIN_LABEL.step} — ${a.label}`);
  return [main, ...also].join(" / ");
}

async function loadLedgerBase(): Promise<LedgerRow[]> {
  const [ts, evs, scr, dl] = await Promise.all([tasks({ limit: 100000 }), evidences(), screenSources(), depts()]);
  const tById = new Map<string, Row>(ts.map((t) => [t.task_id, t]));
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const t0 = todayStr();
  const fromScreens = scr.map((x): LedgerRow => {
    const doneDate = String(x.date || "").slice(0, 10);
    const expires = doneDate ? plusYears(doneDate, KEEP_YEARS) : "";
    const left = expires ? daysTo(expires, t0) : 99999;
    return {
      evidence_id: x.id, task_id: "", area: x.area, code36: x.code, code36_name: nameOf36(x.code), sapa: sapaClause(x.code),
      law: "", unit: "", duty: x.duty, target: "", dept_id: x.dept, dept_name: deptName.get(x.dept) || "",
      kind: x.kind, file_name: String(x.name || "").trim() || "파일", file_url: x.url, hasFile: Boolean(x.url),
      uploaded_at: doneDate, done_at: doneDate, doneDate, doneBasis: "기록한 날",
      expires, left, state: left < 0 ? "보존 기간 지남" : left <= SOON_DAYS ? "만료 임박" : "보존 중",
      uploaded_by: x.by || "", src: x.src, href: x.href,
      origin: "screen",   // 09-26 사용자: 증빙 대장 합치기 — 출처
    };
  });
  return [...fromScreens, ...evs.map((e: Row): LedgerRow => {
    const t = tById.get(e.task_id) || {};
    const done = String(t.done_at || "").slice(0, 10);
    const up = String(e.uploaded_at || "").slice(0, 10);
    const doneDate = done || up;
    const expires = doneDate ? plusYears(doneDate, KEEP_YEARS) : "";
    const left = expires ? daysTo(expires, t0) : 99999;
    return {
      evidence_id: e.evidence_id, task_id: e.task_id, area: t.area || "", code36: firstCode(t.code36), code36_name: t.code36_name || "",
      sapa: sapaClause(t.code36), law: t.law || "", unit: t.unit_label_ko || "",
      duty: t.duty_name || t.article_title || t.code36_name || "", target: t.asset_name || t.target_name || "",
      dept_id: t.dept_id || "", dept_name: t.dept_name || "",
      kind: e.evidence_kind || "", file_name: e.file_name || "", file_url: e.file_url || "", hasFile: Boolean(e.file_url),
      uploaded_at: up, done_at: done, doneDate, doneBasis: done ? "과제 이행일" : "올린 날",
      expires, left, state: left < 0 ? "보존 기간 지남" : left <= SOON_DAYS ? "만료 임박" : "보존 중",
      uploaded_by: e.uploaded_by || "",
      origin: "reg",   // 09-26 사용자: 증빙 대장 합치기 — 출처
    };
  })].filter((r) => !FILES_ONLY || r.hasFile)
    .sort((a, b) => (a.expires < b.expires ? -1 : a.expires > b.expires ? 1 : 0));
}

/** [캡처 v2] 증빙 대장에 실제 파일이 붙은 것만 싣는다(09-24 첫 지시 · 같은 날 정정으로 false — 이름만 있는 기록도 싣는다).
 *  false 로 바꾸면 파일 없이 문서 이름만 적힌 기록(예시 자료 1,264건 · 입력 화면 기록)도 「이름만」으로 싣는다. */
export const FILES_ONLY = false;   // 09-24 사용자 정정 — 「이름만」 기록도 일단 다 보인다

/* ── 호별 필수 증빙 ─────────────────────────────────────────── */

export type SlotDoc = {
  name: string;
  need: "필수" | "선택";
  kinds?: string[];          // 이 증빙 종류면 맞는 것으로 본다
  kw?: string;               // 파일 이름·종류에 이 말이 있으면 맞는 것으로 본다(정규식)
  rec?: RecKey;              // 화면에 남은 기록으로도 확인되는 것
};
type RecKey = "budget_I" | "budget_F" | "budget_M" |"civil_plan" | "half_check" | "manual_7" | "manual_8ga" | "manual_8na"
  | "hazard" | "drill" | "risk" | "voice" | "contract_eval" | "incident" | "order" | "edu_check";

export type SlotGroup = {
  key: string; ref: string; name: string; codes: string[]; docs: SlotDoc[]; cond?: string;
};

export const SLOT_SOURCE_F =
  "서울시 「시민재해 안전보건업무 안내서」 붙임 4-5 중대시민재해 문서관리 항목(공중이용시설·공중교통수단)";
export const SLOT_SOURCE_I =
  "시행령 제4조 각 호 원문에서 뽑은 서류 — 안내서에 중대산업재해 쪽 목록이 없어 만든 초안입니다. 기관이 목록을 확정합니다.";

export const SLOTS_F: SlotGroup[] = [
  { key: "f1", ref: "시행령 제10조제1호", name: "인력", codes: ["F01"], docs: [
    { name: "조직도·업무분장표", need: "필수", kinds: ["임명·선임 문서"], kw: "조직도|업무분장|선임|지정|인력배치" },
  ] },
  { key: "f2", ref: "시행령 제10조제2호", name: "예산", codes: ["F02"], docs: [
    { name: "안전보건 관련 예산 편성내역서", need: "필수", kw: "예산|편성", rec: "budget_F" },
    { name: "예산 집행내역서 · 결산보고서(기성청구·기성집행 내역)", need: "필수", kw: "집행|결산|기성" },
  ] },
  { key: "f3", ref: "시행령 제10조제3호", name: "안전점검", codes: ["F03"], docs: [
    { name: "안전보건관계기관 컨설팅·안전진단·점검보고서(시설물안전법상 안전점검·정밀안전진단 등)", need: "필수", kinds: ["점검표", "측정결과표"], kw: "점검|진단|컨설팅" },
    { name: "유형별 안전점검 체크리스트", need: "필수", kinds: ["점검표"], kw: "체크리스트|점검표" },
  ] },
  { key: "f4", ref: "시행령 제10조제4호", name: "안전계획", codes: ["F04"], docs: [
    { name: "안전·진단·점검 계획서(공중이용시설) · 안전점검·정비 계획서(공중교통수단)", need: "필수", kinds: ["계획서"], kw: "계획", rec: "civil_plan" },
    { name: "보수·보강 계획서", need: "필수", kw: "보수|보강" },
  ] },
  { key: "f5", ref: "시행령 제10조제5호", name: "반기 점검", codes: ["F05"], docs: [
    { name: "상·하반기 인력·예산·안전점검·안전계획 점검보고서", need: "필수", kinds: ["점검표"], kw: "반기|점검", rec: "half_check" },
  ] },
  { key: "f6", ref: "시행령 제10조제6호", name: "점검 결과 조치", codes: ["F06"], docs: [
    { name: "점검·조치 보고서", need: "필수", kw: "조치|보고" },
  ] },
  { key: "f7", ref: "시행령 제10조제7호", name: "업무처리절차", codes: ["F07"], docs: [
    { name: "위기관리대책 절차서(유해·위험요인 확인·점검 · 발견 시 대응 · 재해 발생 시 비상대응 매뉴얼 · 원인조사·개선)", need: "필수", kw: "절차|매뉴얼", rec: "manual_7" },
    { name: "유해·위험요인 확인·점검 대장", need: "필수", kinds: ["관리대장"], kw: "대장", rec: "hazard" },
    { name: "사고 발생 개요(원인·피해 포함) 및 대응 조치서", need: "필수", kw: "사고|대응" },
    { name: "비상대피훈련 계획 및 SOP", need: "필수", kinds: ["훈련 결과보고서"], kw: "훈련|대피", rec: "drill" },
  ] },
  { key: "f8", ref: "시행령 제10조제8호", name: "도급·용역·위탁", codes: ["F08"], docs: [
    { name: "도급계약서(원·하청)", need: "필수", kw: "계약" },
    { name: "도급업체 선정기준 및 평가자료", need: "필수", kw: "선정|평가", rec: "manual_8ga" },
    { name: "안전보건관리비 계상 및 사용내역 · 관리비용 산정기준", need: "필수", kw: "관리비|비용", rec: "manual_8na" },
    { name: "사업자등록증 · 법인등기부등본(원·하청)", need: "선택", kw: "사업자등록|등기" },
  ] },
  { key: "f9-2", ref: "법 제9조제2항제2호", name: "재해 재발방지", codes: ["F09"], cond: "재해가 났을 때만 — 법 시행 뒤 재해가 없으면 해당 없음", docs: [
    { name: "사고현장 사진·CCTV 자료 · 재발방지대책 · 발생기록·조사보고서", need: "필수", kw: "사고|재발|조사", rec: "incident" },
  ] },
  { key: "f9-3", ref: "법 제9조제2항제3호", name: "개선·시정명령", codes: ["F10"], cond: "명령을 받았을 때만", docs: [
    { name: "중앙부처·지자체 등 공문서 접수 및 처리대장", need: "필수", kw: "공문|명령|처리", rec: "order" },
  ] },
  { key: "f9-4", ref: "법 제9조제2항제4호", name: "관계 법령 의무이행", codes: ["F11", "F12"], docs: [
    { name: "상·하반기 의무이행 점검·조치표", need: "필수", kinds: ["점검표"], kw: "의무이행|점검" },
    { name: "의무교육 실시 점검·조치표 · 교육대장", need: "필수", kinds: ["교육일지"], kw: "교육", rec: "edu_check" },
  ] },
];

export const SLOTS_I: SlotGroup[] = [
  { key: "i1", ref: "시행령 제4조제1호", name: "안전·보건 목표와 경영방침", codes: ["I01"], docs: [
    { name: "안전·보건 목표와 경영방침 문서", need: "필수", kw: "목표|방침" },
  ] },
  { key: "i2", ref: "시행령 제4조제2호", name: "전담 조직", codes: ["I02"], cond: "산업안전보건법상 인력 3명 이상 + 상시근로자 500명 이상 등(제2호 각 목)일 때", docs: [
    { name: "전담 조직 조직도·업무분장", need: "필수", kinds: ["임명·선임 문서"], kw: "조직|업무분장|전담" },
  ] },
  { key: "i3", ref: "시행령 제4조제3호", name: "유해·위험요인 확인·개선", codes: ["I03"], docs: [
    { name: "유해·위험요인 확인·개선 업무절차서(또는 위험성평가 절차)", need: "필수", kw: "절차|위험성평가" },
    { name: "반기 점검 결과(또는 위험성평가 실시 결과 보고)", need: "필수", kinds: ["점검표"], kw: "점검|위험성평가", rec: "risk" },
  ] },
  { key: "i4", ref: "시행령 제4조제4호", name: "예산", codes: ["I04"], docs: [
    { name: "예산 편성 내역(가목 인력·시설·장비 / 나목 유해·위험요인 개선)", need: "필수", kw: "예산|편성", rec: "budget_I" },
    { name: "예산 집행 내역", need: "필수", kw: "집행|결산" },
  ] },
  { key: "i5", ref: "시행령 제4조제5호", name: "안전보건관리책임자등 업무수행 지원", codes: ["I05"], docs: [
    { name: "권한·예산 부여 문서(가목)", need: "필수", kinds: ["임명·선임 문서"], kw: "권한|위임|선임" },
    { name: "업무수행 평가 기준(나목)", need: "필수", kw: "평가.?기준" },
    { name: "반기 평가·관리 결과(나목)", need: "필수", kw: "평가" },
  ] },
  { key: "i6", ref: "시행령 제4조제6호", name: "전문인력 배치", codes: ["I06"], docs: [
    { name: "안전관리자·보건관리자 등 선임(배치) 문서", need: "필수", kinds: ["임명·선임 문서"], kw: "선임|배치" },
  ] },
  { key: "i7", ref: "시행령 제4조제7호", name: "종사자 의견 청취", codes: ["I07"], docs: [
    { name: "의견 청취 절차", need: "필수", kw: "의견|절차" },
    { name: "의견 청취·개선방안 이행 반기 점검 기록(산업안전보건위원회 회의록 등)", need: "필수", kw: "의견|회의록|위원회|협의체", rec: "voice" },
  ] },
  { key: "i8", ref: "시행령 제4조제8호", name: "중대산업재해 대비 매뉴얼", codes: ["I08"], docs: [
    { name: "작업중지·대피·구호·추가 피해방지 매뉴얼", need: "필수", kw: "매뉴얼" },
    { name: "매뉴얼대로 조치하는지 반기 점검 기록", need: "필수", kinds: ["훈련 결과보고서", "점검표"], kw: "점검|훈련" },
  ] },
  { key: "i9", ref: "시행령 제4조제9호", name: "도급·용역·위탁 기준·절차", codes: ["I09"], docs: [
    { name: "수급인 평가기준·절차(가목) · 관리비용 기준(나목)", need: "필수", kw: "기준|평가" },
    { name: "기준대로 이루어지는지 반기 점검 기록", need: "필수", kw: "점검", rec: "contract_eval" },
  ] },
];

/**
 * 원료·제조물 (09-21) — 서울시 안내서 붙임 4-5 「원료·제조물 관련 안전·보건 확보의무」 문서항목(p.136, 인쇄 138쪽)을 그대로 옮겼다.
 *   안내서 표의 네 칸 중 제1칸(시행령 제8조 제1~5호)과 제4칸(법 제9조제1항제4호 = 시행령 제9조제2항)만 둔다.
 *   「선택」은 안내서 문구에 「발생시」가 붙은 서류뿐이다(재해가 나야 생기는 서류).
 *   용인시가 원료·제조물을 생산·제조·판매·유통하는지는 아직 판단 전 — loadSlots 가 묶음 머리에 적는다.
 */
export const SLOT_SOURCE_M =
  "서울시 「시민재해 안전보건업무 안내서」 붙임 4-5 원료·제조물 관련 안전·보건 확보의무 문서항목(시행령 제8조 · 법 제9조제1항제4호)";

export const SLOTS_M: SlotGroup[] = [
  { key: "m1", ref: "시행령 제8조제1호", name: "인력", codes: ["M01"], docs: [
    { name: "조직도·업무분장표", need: "필수", kinds: ["임명·선임 문서"], kw: "조직도|업무분장|선임|지정|인력배치" },
  ] },
  { key: "m2", ref: "시행령 제8조제2호", name: "예산", codes: ["M02"], docs: [
    { name: "안전보건 관련 예산 편성내역서", need: "필수", kw: "예산|편성", rec: "budget_M" },
    { name: "예산 집행내역서 · 결산보고서(기성청구내역·기성집행 내역)", need: "필수", kw: "집행|결산|기성" },
  ] },
  { key: "m3", ref: "시행령 제8조제3호", name: "유해·위험요인의 점검 등", codes: ["M03"], docs: [
    { name: "안전보건관계기관의 컨설팅·진단·점검보고서", need: "필수", kinds: ["점검표", "측정결과표"], kw: "컨설팅|진단|점검보고" },
    { name: "안전보건계획수립 및 이사회 보고/승인내역", need: "필수", kinds: ["계획서"], kw: "안전보건계획|이사회" },
    { name: "본사 점검보고서(안전점검·교육점검·현장점검 등)", need: "필수", kinds: ["점검표"], kw: "점검보고|현장점검|교육점검" },
    { name: "유해·위험요인점검규정", need: "필수", kw: "점검규정|규정" },
    { name: "원료·제조에 대한 유해·위험요인 점검 대장", need: "필수", kinds: ["관리대장"], kw: "대장" },
    { name: "순회 합동점검 일지 등 위험요인 개선사항 확인서류", need: "필수", kw: "순회|합동점검|개선사항" },
    { name: "중대시민재해 발생 우려 위험요인 조사서/조치서", need: "필수", kw: "우려|위험요인 조사|조사서" },
    { name: "중대시민재해 발생시 현황 보고서/조치서", need: "선택", kw: "현황 보고|발생.*조치" },
    { name: "중대시민재해 발생시 원인조사서/개선 조치서", need: "선택", kw: "원인조사|개선 조치" },
    { name: "중대시민재해 사고기인물 관련 유해·위험요인 개선 비용", need: "필수", kw: "기인물|개선 비용" },
  ] },
  { key: "m4", ref: "시행령 제8조제4호", name: "업무처리절차", codes: ["M04"], cond: "소상공인은 제외", docs: [
    { name: "유해·위험요인의 점검 등을 포함한 업무처리절차서(시행령 제8조제3호 항목 포함)", need: "필수", kw: "절차|매뉴얼" },
  ] },
  { key: "m5", ref: "시행령 제8조제5호", name: "점검·조치", codes: ["M05"], docs: [
    { name: "상·하반기 중대시민재해 예방 점검·조치서", need: "필수", kinds: ["점검표"], kw: "반기|점검" },
    { name: "공통 안전보건관리체계 구축·점검(중대시민재해 의무이행 기준 및 점검)", need: "필수", kw: "관리체계|의무이행 기준" },
  ] },
  { key: "m9-2", ref: "시행령 제9조제2항(법 제9조제1항제4호)", name: "관계 법령상 의무이행을 위한 관리상의 조치", codes: ["M08", "M09"], docs: [
    { name: "상·하반기 의무이행 점검·조치표", need: "필수", kinds: ["점검표"], kw: "의무이행|점검" },
    { name: "상·하반기 의무교육 실시 점검·조치표", need: "필수", kw: "의무교육|교육.*점검" },
    { name: "연간 안전보건교육계획, 자체교육관련 규정, 교육대장(일지) 및 교육자료", need: "필수", kinds: ["교육일지"], kw: "교육계획|교육대장|교육자료|교육일지" },
    { name: "특별교육, MSDS 교육 등 교육실시자료(원·하청)", need: "필수", kw: "특별교육|MSDS" },
    { name: "교육실시여부 점검자료 및 결과보고 자료(본사)", need: "필수", kw: "교육실시|결과보고" },
  ] },
];

export type SlotHit ={ doc: SlotDoc; files: LedgerRow[]; withFile: number; rec: string; state: "있음" | "이름만" | "없음" };

/** 호마다 필요한 서류와 지금 올라온 것을 맞춘다. */
// 09-26 사용자(2차): 「호별 증빙 탭에도 단계 증빙을 세자」 — 기본 steps:true(의무이행 단계 증빙 + 입력 화면 기록).
//   steps:false 는 합치기 전 셈(건수 비교용)이다.
export async function loadSlots(opt: { steps?: boolean } = { steps: true }) {
  const led = await loadLedger({ steps: opt.steps !== false });
  const year = todayStr().slice(0, 4);
  const [buds, plans, manual, hz, drills, risks, voices, ctr, incs, ords] = await Promise.all([
    readTable("safety_budget", "budget_id"), readTable("civil_safety_plan", "plan_id"), readTable("civil_manual", "manual_id"),
    readTable("hazard_report", "hz_id"), readTable("drill_plan", "drill_id"), readTable("risk_assessment", "risk_id"),
    readTable("worker_voice"), readTable("contract", "contract_id"), readTable("incident", "incident_id"), readTable("order_received", "order_id"),
  ]);
  const yr = (r: Row, ...cols: string[]) => cols.some((c) => String(r[c] || "").startsWith(year));
  const recText: Record<RecKey, () => string> = {
    budget_I: () => { const n = buds.filter((b) => String(b.fiscal_year) === year && b.area !== "F" && b.area !== "M").length; return n ? `예산 화면 ${year}년 편성 ${n}행(중대산업재해 또는 구분 전)` : ""; },
    budget_F: () => { const n = buds.filter((b) => String(b.fiscal_year) === year && b.area === "F").length; return n ? `예산 화면 ${year}년 중대시민재해(공중이용시설·공중교통수단) 몫 ${n}행` : ""; },
    budget_M: () => { const n = buds.filter((b) => String(b.fiscal_year) === year && b.area === "M").length; return n ? `예산 화면 ${year}년 중대시민재해(원료·제조물) 몫 ${n}행` : ""; },
    civil_plan: () => { const n = plans.filter((p) => String(p.plan_year) === year && p.plan_status === "수립").length; return n ? `시설별 안전계획 ${year}년 수립 ${n}건` : ""; },
    half_check: () => { const n = manual.filter((m) => m.record_kind === "반기 점검" && yr(m, "done_at")).length; return n ? `반기 점검 기록 ${year}년 ${n}건` : ""; },
    manual_7: () => { const ms = manual.filter((m) => m.clause_ref === "10-7" && !["대피훈련", "반기 점검", "교육 이수 점검"].includes(m.record_kind)); return ms.length ? `절차·매뉴얼 ${ms.length}건(${ms.slice(0, 2).map((m) => m.title).join(" · ")}${ms.length > 2 ? " 등" : ""})` : ""; },
    manual_8ga: () => { const ms = manual.filter((m) => m.clause_ref === "10-8" && String(m.covers || "").includes("가")); return ms.length ? `평가기준 문서 ${ms.map((m) => m.title).join(" · ")}` : ""; },
    manual_8na: () => { const ms = manual.filter((m) => m.clause_ref === "10-8" && String(m.covers || "").includes("나")); return ms.length ? `비용 기준 문서 ${ms.map((m) => m.title).join(" · ")}` : ""; },
    hazard: () => (hz.length ? `유해·위험요인 신고·조치 대장 ${hz.length}건` : ""),
    drill: () => { const n = drills.filter((d) => String(d.year) === year).length; return n ? `대피훈련 ${year}년 ${n}건` : ""; },
    risk: () => (risks.length ? `위험성평가 ${risks.length}건` : ""),
    voice: () => (voices.length ? `종사자 의견 ${voices.length}건` : ""),
    contract_eval: () => { const n = ctr.filter((c) => c.evaluation_done === "Y").length; return n ? `수급인 평가 실시 계약 ${n}건` : ""; },
    incident: () => { const n = incs.filter((i) => i.event_class === "시민재해").length; return n ? `이용자 피해 사고 기록 ${n}건(재발방지 단계 기록)` : ""; },
    order: () => { const n = ords.filter((o) => o.doc_nature !== "지도·권고·조언").length; return n ? `개선·시정명령 대장 ${n}건` : ""; },
    edu_check: () => { const n = manual.filter((m) => m.record_kind === "교육 이수 점검").length; return n ? `교육 이수 점검 기록 ${n}건` : ""; },
  };

  const match = (d: SlotDoc, r: LedgerRow) =>
    Boolean((d.kinds && d.kinds.includes(r.kind)) || (d.kw && new RegExp(d.kw).test(`${r.file_name} ${r.kind}`)));

  const run = (groups: SlotGroup[]) => groups.map((g) => {
    const mine = led.filter((r) => g.codes.includes(r.code36));
    const hits: SlotHit[] = g.docs.map((d) => {
      const files = mine.filter((r) => match(d, r)).sort((a, b) => (a.doneDate < b.doneDate ? 1 : -1));
      const withFile = files.filter((f) => f.hasFile).length;
      const rec = d.rec ? recText[d.rec]() : "";
      return { doc: d, files, withFile, rec, state: withFile ? "있음" : files.length || rec ? "이름만" : "없음" };
    });
    return { ...g, evN: mine.length, hits };
  });
  // 원료·제조물 해당 여부 — 체계 수립 화면(lib/system.ts materialStatus)의 「먼저 — 해당 여부 판단」과 같은 판정을 쓴다.
  //   (09-22) 판단 전 품목이 하나라도 남으면 확인 필요 — materialStatus 가 sts[0] 에 그렇게 둔다. 모두 비해당이면 해당 없음.
  const mat = await materialStatus();
  const gate = mat.sts[0];
  const mGate = mat.allNo ? `용인시 해당 여부: 해당 없음 — 품목 ${mat.items.length}개 모두 비해당(사유 ${mat.noN}건)`
    : gate === "unk" ? `용인시 해당 여부: ${ST_LABEL.unk}${mat.yesN ? ` — 해당 품목 ${mat.yesN}개 · 판단 전 ${mat.pendingN}개` : " — 원료·제조물을 생산·제조·판매·유통하는지부터 판단합니다"}`
    : "";
  const M = run(SLOTS_M).map((g) => ({ ...g, cond: [mGate, g.cond].filter(Boolean).join(" · ") || undefined }));
  return { F: run(SLOTS_F), I: run(SLOTS_I), M, mGate };
}
