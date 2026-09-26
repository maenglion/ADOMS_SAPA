"use server";
/**
 * [400 · 교육자료 버전] 묶음 C — 의무이행(실적증빙) 사업장 트랙 저장 한 곳.
 * 모든 입력은 공용 쓰기(appendRow/patchRow)로 표 `usc_record` 에 쌓인다(판 파일은 건드리지 않는다).
 *
 * 폼 약속(화면 [step]/page.tsx 와 짝)
 *   id        = "rec_id~section~mode~parent"   mode: e(있는 행) · n(새 빈 행) · x(고정 번호, 아직 없음)
 *   f~rid~key = 칸 값(같은 이름이 여러 번 오면 마지막 값 — 체크 칸은 빈 값 숨김 칸 + 체크 칸)
 *   file~rid  = 증빙 파일(여러 개) · roster~rid = 교육 명부 파일
 *   op        = 누른 단추(add:섹션 · dup:rid · del:rid · rmfile:rid:순번 · addinc · delinc:rid)
 */
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { saveFile } from "@/lib/storage";
import { ROLE_STAFF } from "@/lib/roles";
import { duties, budgets, trainings, staff as staffList, depts } from "@/lib/data";
import { readTable } from "@/lib/data";
import { TABLE, statusOf, fixedId, BUDGET_ITEMS, GROUP_KEY, type FileRef } from "./_lib/meta";
import { allRecs, type Rec } from "./_lib/usc";
import { ymd } from "@/lib/day";

const s = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const newId = () => `USC-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const stamp = () => new Date().toISOString().slice(0, 19);

type Ctx = { role: string; dept: string; year: string; step: string; back: string; by: string };
function ctxOf(f: FormData): Ctx {
  const role = s(f.get("role")) || "gm";
  return {
    role, dept: s(f.get("dept")), year: s(f.get("year")), step: s(f.get("step")),
    back: s(f.get("back")) || "/perform/ws", by: ROLE_STAFF[role] || role,
  };
}

function row(c: Ctx, section: string, data: Record<string, string>, files: FileRef[] = [], extra: Record<string, string> = {}) {
  return {
    rec_id: extra.rec_id || newId(), dept_id: c.dept, year: c.year, step: c.step, section,
    parent_id: extra.parent_id || "", ord: extra.ord || String(Math.floor(Date.now() / 1000)),
    locked: "", deleted: "", status: statusOf(c.step, section, data, files),
    data: JSON.stringify(data), files: JSON.stringify(files), updated_at: ymd(), updated_by: c.by,
  };
}

async function patch(c: Ctx, r: Rec, data: Record<string, string>, files: FileRef[], action = "의무이행 실적 수정") {
  await patchRow(TABLE, "rec_id", r.rec_id, {
    data: JSON.stringify(data), files: JSON.stringify(files),
    status: statusOf(r.step, r.section, data, files), updated_at: ymd(), updated_by: c.by,
  }, c.by, action);
}

/** 파일 칸의 파일들을 저장해 {name,url,at} 로 돌려준다. */
async function upload(f: FormData, field: string): Promise<FileRef[]> {
  const out: FileRef[] = [];
  for (const v of f.getAll(field)) {
    if (v instanceof File && v.size > 0) {
      if (v.size > 10 * 1024 * 1024) continue; // ※개당 10MB 이하
      const sv = await saveFile(v);
      out.push({ name: v.name.slice(0, 120), url: sv.url, at: stamp() });
    }
  }
  return out;
}

/** 다음 정렬 번호 — 같은 구분 묶음 바로 뒤에 끼운다. */
function ordAfter(rows: Rec[], src: Rec) {
  const base = Math.floor(src.ord);
  const inGroup = rows.filter((r) => r.ord >= src.ord && r.ord < base + 1).map((r) => r.ord);
  const mx = Math.max(src.ord, ...inGroup);
  return String((mx + base + 1) / 2);
}

/** 표 저장 — 화면의 모든 「저장」·행 단추가 여기로 온다. */
export async function saveStep(f: FormData) {
  const c = ctxOf(f);
  const all = await allRecs();
  const byId = new Map(all.map((r) => [r.rec_id, r]));
  const live = all.filter((r) => r.dept_id === c.dept && r.year === c.year && r.step === c.step && !r.deleted);
  const op = s(f.get("op"));

  for (const ent of new Set(f.getAll("id").map(String))) {
    const [rid, section, mode, parent] = String(ent).split("~");
    const prefix = `f~${rid}~`;
    const vals: Record<string, string> = {};
    for (const k of new Set([...f.keys()].filter((k) => k.startsWith(prefix)))) {
      const all_ = f.getAll(k).map((v) => String(v));
      vals[k.slice(prefix.length)] = (all_.filter((v) => v !== "").pop() ?? "").trim();
    }
    const nf = await upload(f, `file~${rid}`);
    const roster = await upload(f, `roster~${rid}`);
    if (roster.length) { vals.roster_name = roster[0].name; vals.roster_url = roster[0].url; }

    const cur = byId.get(rid);
    if (mode === "e" && cur) {
      const data = { ...cur.data, ...vals };
      const files = [...cur.files, ...nf];
      const changed = JSON.stringify(data) !== JSON.stringify(cur.data) || nf.length > 0;
      if (changed) await patch(c, cur, data, files);
    } else {
      // 새 행 · 아직 없는 고정 행 — 무엇이든 적었거나 파일을 올렸을 때만 만든다
      const preset = new Set(["item", "fixed", "nil", "kind", ...(vals.fixed === "Y" ? ["gbn"] : [])]);
      const filled = Object.entries(vals).some(([k, v]) => !preset.has(k) && v !== "" && v !== "N") || nf.length > 0 || section === "nil";
      if (!filled) continue;
      await appendRow(TABLE, row(c, section, vals, nf, {
        rec_id: mode === "x" ? rid : newId(), parent_id: parent || "",
        ord: mode === "x" ? String(live.length + 1) : undefined as any,
      }), c.by, "의무이행 실적 등록");
    }
  }

  // 행 단추
  const [kind, a1, a2] = op.split(":");
  if (kind === "add" && a1) {
    await appendRow(TABLE, row(c, a1, a1 === "main" && c.step === "risk" ? { gbn: "" } : {}), c.by, "행 추가");
  } else if (kind === "dup" && a1) {
    const src = byId.get(a1);
    if (src) {
      const gk = GROUP_KEY[c.step] || "gbn";
      const data: Record<string, string> = { [gk]: src.data[gk] || "" };
      if (src.data.fixed) data.fixed = src.data.fixed;
      await appendRow(TABLE, row(c, src.section, data, [], { ord: ordAfter(live, src) }), c.by, "같은 구분 행 추가");
    }
  } else if (kind === "del" && a1) {
    const r = byId.get(a1);
    if (r) await patchRow(TABLE, "rec_id", a1, { deleted: "Y", updated_at: ymd(), updated_by: c.by }, c.by, "행 삭제");
  } else if (kind === "rmfile" && a1) {
    const r = (await allRecs()).find((x) => x.rec_id === a1);
    if (r) {
      const files = r.files.filter((_, i) => String(i) !== a2);
      await patch(c, r, r.data, files, "증빙 파일 빼기");
    }
  } else if (kind === "addinc") {
    await appendRow(TABLE, row(c, "inc", { name: "", date: "" }), c.by, "재해 추가");
  } else if (kind === "delinc" && a1) {
    await patchRow(TABLE, "rec_id", a1, { deleted: "Y", updated_at: ymd(), updated_by: c.by }, c.by, "재해 삭제");
    for (const r of all.filter((x) => x.parent_id === a1)) {
      await patchRow(TABLE, "rec_id", r.rec_id, { deleted: "Y" }, c.by, "재해 삭제");
    }
  }
  redirect(c.back);
}

/** 직원 검색 모달 — 이름·소속(부서)을 채운다. row 가 새 행이면 새 행을 만든다. */
export async function pickStaff(f: FormData) {
  const c = ctxOf(f);
  const sid = s(f.get("staff_id"));
  const who = (await staffList()).find((x: any) => x.staff_id === sid);
  const dn = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  if (who) {
    const name = who.display_name, org = dn.get(who.dept_id) || "";
    const rid = s(f.get("row"));
    const cur = (await allRecs()).find((r) => r.rec_id === rid);
    if (cur) await patch(c, cur, { ...cur.data, name, org }, cur.files, "직원 선택");
    else await appendRow(TABLE, row(c, s(f.get("section")) || "main", { [GROUP_KEY[c.step] || "rank"]: "", name, org }), c.by, "직원 선택");
  }
  redirect(c.back);
}

/**
 * 불러오기 모달 — 우리 자료에서 골라 표에 행을 더한다.
 *   law      : 우리 의무 목록(duty_class, 중대산업재해) → 관계 법령상 의무이행 표
 *   edu-duty : 우리 의무 목록 중 관계법령 교육이수(I13) → 법정교육 이수 표
 *   edu-train: 교육 이수 기록(training_record) → 법정교육 이수 표
 *   budget   : 안전예산 편성 자료(safety_budget) → 예산 6항목(편성액·집행액 천원)
 *   work     : 3단계 안전보건관계자 배치 내역 → 업무수행 평가 표
 *   drill    : 비상대응훈련 계획(drill_plan) → 비상조치훈련 실시 행
 */
export async function importRows(f: FormData) {
  const c = ctxOf(f);
  const kind = s(f.get("kind"));
  const keys = f.getAll("keys").map((v) => String(v));
  const all = await allRecs();
  const live = all.filter((r) => r.dept_id === c.dept && r.year === c.year && r.step === c.step && !r.deleted);
  let ord = Math.floor(Date.now() / 1000);
  const add = (section: string, data: Record<string, string>, files: FileRef[] = []) =>
    appendRow(TABLE, row(c, section, data, files, { ord: String(ord++) }), c.by, "불러오기");

  if (kind === "law" || kind === "edu-duty") {
    const rows = await duties({ area: "I", limit: 20000 });
    const m = new Map(rows.map((d: any) => [d.duty_key, d]));
    const have = new Set(live.map((r) => r.data.duty_key).filter(Boolean));
    for (const k of keys) {
      const d: any = m.get(k);
      if (!d || have.has(k)) continue;
      if (kind === "law") await add("law", { duty_key: k, date: "", st: "미이행", note: "" });
      else await add("edu", { duty_key: k, name: d.duty_name || d.article_title || "", law: d.law, article: d.unit_label_ko || "", target: "", agency: "", date: "", note: "" });
    }
  } else if (kind === "edu-train") {
    const tr = await trainings();
    const st = new Map((await staffList()).map((x: any) => [x.staff_id, x.display_name]));
    const have = new Set(live.map((r) => r.data.src).filter(Boolean));
    for (const k of keys) {
      const t: any = tr.find((x: any) => x.training_id === k);
      if (!t || have.has(k)) continue;
      await add("edu", { src: k, name: t.course_name, law: t.law, article: "", target: st.get(t.staff_id) || "", agency: "", date: t.trained_at || "", note: "" },
        t.certificate_file ? [{ name: t.certificate_file, url: "", at: stamp() }] : []);
    }
  } else if (kind === "budget") {
    const bs = (await budgets()).filter((b: any) => keys.includes(b.budget_id));
    const acc = new Map<string, { plan: number; exec: number; memo: string[] }>();
    for (const b of bs as any[]) {
      const item = BUDGET_ITEMS.includes(b.budget_item) ? b.budget_item : "기타";
      const x = acc.get(item) || { plan: 0, exec: 0, memo: [] };
      x.plan += Math.round(Number(b.planned_amount || 0) / 1000);
      x.exec += Math.round(Number(b.executed_amount || 0) / 1000);
      const memo = String(b.note || "").split("·").slice(1).join("·").trim() || b.budget_use || "";
      if (memo) x.memo.push(memo);
      acc.set(item, x);
    }
    for (const [item, x] of acc) {
      const rid = fixedId(c.dept, c.year, "budget", String(BUDGET_ITEMS.indexOf(item) + 1));
      const cur = all.find((r) => r.rec_id === rid);
      const data = { item, plan: String(x.plan), exec: String(x.exec), content: x.memo.join(" · ") };
      if (cur) await patch(c, cur, { ...cur.data, ...data }, cur.files, "예산 계획 불러오기");
      else await appendRow(TABLE, row(c, "main", { ...data, date: "", note: "" }, [], { rec_id: rid, ord: String(BUDGET_ITEMS.indexOf(item) + 1) }), c.by, "예산 계획 불러오기");
    }
  } else if (kind === "work") {
    const staffRows = all.filter((r) => r.dept_id === c.dept && r.year === c.year && r.step === "staff" && !r.deleted && keys.includes(r.rec_id));
    const have = new Set(live.map((r) => `${r.data.rel}|${r.data.name}`));
    for (const r of staffRows) {
      if (have.has(`${r.data.rank}|${r.data.name}`)) continue;
      await appendRow(TABLE, { ...row(c, "main", { rel: r.data.rank || "", trust: r.data.trust || "", date: "", name: r.data.name || "", org: r.data.org || "", note: "" }, [], { ord: String(ord++) }), locked: r.locked ? "Y" : "" }, c.by, "배치 내역 불러오기");
    }
  } else if (kind === "drill") {
    const dp = await readTable("drill_plan", "drill_id");
    const have = new Set(live.map((r) => r.data.src).filter(Boolean));
    for (const k of keys) {
      const x: any = dp.find((d: any) => d.drill_id === k);
      if (!x || have.has(k)) continue;
      await add("main", { src: k, rank: "비상조치훈련 실시", date: String(x.done_at || x.planned_at || "").slice(0, 10), content: `${x.drill_type} 대응 훈련 — ${x.scenario}`, note: x.status || "" });
    }
  }
  redirect(c.back);
}
