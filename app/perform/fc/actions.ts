"use server";
/**
 * [400 · 교육자료 버전] 묶음 D — 의무이행(실적증빙) 공중이용시설·공중교통수단 저장 한 곳.
 *
 * 표마다 폼이 하나고, 표 안의 모든 버튼(저장 · 항목 추가 · 행 삭제 · 파일 비우기 · 담당 대상 일괄적용 · 팝업 열기)이
 * 이 폼을 제출한다 → **먼저 표 전체를 저장하고** 버튼 뜻을 처리한다. 그래서 팝업을 열어도 입력한 값이 사라지지 않는다.
 *
 * 칸 이름 규칙
 *   rid            줄 id(여러 개). 기존 줄 = rec_id · 새 줄 = N:<n> · 의무 목록 줄 = D:<duty_key> · 일괄적용 분 = C:<rec_id>
 *   c.<rid>.<칸>   칸 값 · p.<rid>.<칸> 새 줄 기본값(비었는지 셀 때 빼고 본다)
 *   f.<rid>.<키>   증빙 파일(여러 개) — lib/storage saveFile 로 실제 저장
 *   na             해당없음 체크(Y) — 이 표에 해당없음 줄이 있으면 hasNa=Y
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appendRow, patchRow } from "@/lib/write";
import { saveFile } from "@/lib/storage";
import { ROLE_STAFF } from "@/lib/roles";
import { ymd } from "@/lib/day";
import { records, TABLE, YEAR, statusOf, type Ev, type Rec } from "./_lib/model";

const S = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const newId = (i = 0) => `USD-${Date.now().toString(36).toUpperCase()}${i}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const filled = (d: Record<string, any>) => Object.values(d).some((v) => String(v ?? "").trim() && String(v) !== "0");

function go(back: string, msg: string, extra = "", hash = "") {
  const b = back || "/perform/fc";
  revalidatePath("/perform/fc", "layout");
  const q = [msg ? `msg=${encodeURIComponent(msg)}` : "", extra.replace(/^&/, "")].filter(Boolean).join("&");
  redirect(`${b}${q ? `${b.includes("?") ? "&" : "?"}${q}` : ""}${hash ? `#${hash}` : ""}`);
}

async function files(f: FormData, key: string): Promise<Ev[]> {
  const out: Ev[] = [];
  for (const v of f.getAll(key)) {
    if (v instanceof File && v.size > 0) {
      if (v.size > 10 * 1024 * 1024) continue; // 개당 10MB 이하(명세)
      const sv = await saveFile(v);
      out.push({ name: v.name.slice(0, 120), url: sv.url, at: new Date().toISOString() });
    }
  }
  return out;
}

async function newRow(base: { scope: string; dept: string; step: string; block: string }, data: Record<string, any>, fl: Record<string, Ev[]>, by: string, i = 0) {
  const row = {
    rec_id: newId(i), scope: base.scope, dept_id: base.dept, year: YEAR, step: base.step, block: base.block,
    ord: String(Date.now() + i), deleted: "", status: statusOf(data, fl),
    data: JSON.stringify(data), files: JSON.stringify(fl), updated_at: ymd(), updated_by: by,
  };
  await appendRow(TABLE, row, by, `의무이행(공중이용시설·공중교통수단) ${base.step} 등록`);
  return row.rec_id;
}

/** 표 한 개 저장 + 버튼 뜻 처리. */
export async function saveBlock(f: FormData) {
  const role = S(f, "role") || "gm";
  const by = ROLE_STAFF[role] || "SM01-1";
  const base = { scope: S(f, "scope"), dept: S(f, "dept"), step: S(f, "step"), block: S(f, "block") };
  const back = S(f, "back");
  const intent = S(f, "intent") || "save";
  const hash = S(f, "hash") || base.block;
  if (!base.scope || !base.step || !base.block) go(back, "대상이 없습니다");

  const all = await records();
  const byId = new Map<string, Rec>(all.map((r) => [r.rec_id, r]));
  const delRid = intent.startsWith("del:") ? intent.slice(4) : "";
  let changed = 0;

  // ① 해당없음 체크
  if (S(f, "hasNa") === "Y") {
    const na = S(f, "na") === "Y" ? "Y" : "";
    const cur = all.find((r) => r.step === base.step && r.block === "na" && r.scope === base.scope);
    if (cur) {
      if ((cur.data.na || "") !== na) { await patchRow(TABLE, "rec_id", cur.rec_id, { data: JSON.stringify({ na }), status: na ? "해당없음" : "미이행", updated_at: ymd(), updated_by: by }, by, "해당없음 표시"); changed++; }
    } else if (na) { await newRow({ ...base, block: "na" }, { na }, {}, by); changed++; }
  }

  // ② 줄마다 저장
  const rids = f.getAll("rid").map(String);
  const fileKeys = new Map<string, Set<string>>();
  for (const k of f.keys()) {
    if (!k.startsWith("f.")) continue;
    const [, rid, key] = k.match(/^f\.(.+)\.([^.]+)$/) || [];
    if (rid) fileKeys.set(rid, (fileKeys.get(rid) || new Set()).add(key));
  }
  let i = 0;
  const created = new Map<string, string>();
  for (const rid of rids) {
    if (rid === delRid) continue;
    const data: Record<string, any> = {};
    const preset: Record<string, any> = {};
    for (const [k, v] of f.entries()) {
      if (typeof v !== "string") continue;
      if (k.startsWith(`c.${rid}.`)) data[k.slice(rid.length + 3)] = v.trim();
      else if (k.startsWith(`p.${rid}.`)) preset[k.slice(rid.length + 3)] = v.trim();
    }
    // 체크칸(조치 완료 등)은 꺼지면 값이 안 온다 — 목록에 적힌 체크칸은 빈 값으로 채운다
    for (const ck of f.getAll(`ck.${rid}`).map(String)) if (!(ck in data)) data[ck] = "";
    const up: Record<string, Ev[]> = {};
    for (const key of fileKeys.get(rid) || []) { const got = await files(f, `f.${rid}.${key}`); if (got.length) up[key] = got; }

    const old = byId.get(rid);
    if (old && old.scope === base.scope) {
      const nd = { ...old.data, ...data };
      const nf = { ...old.files };
      for (const [k, v] of Object.entries(up)) nf[k] = [...(nf[k] || []), ...v];
      if (JSON.stringify(nd) !== JSON.stringify(old.data) || JSON.stringify(nf) !== JSON.stringify(old.files)) {
        await patchRow(TABLE, "rec_id", rid, { data: JSON.stringify(nd), files: JSON.stringify(nf), status: statusOf(nd, nf), updated_at: ymd(), updated_by: by }, by, "의무이행 수정");
        changed++;
      }
    } else {
      // 새 줄(N:) · 의무 목록 줄(D:) · 일괄적용 분(C:) → 값이 있으면 이 대상의 줄로 새로 만든다
      const src = rid.startsWith("C:") ? byId.get(rid.slice(2)) : undefined;
      const d0 = { ...(src?.data || {}), ...preset, ...data };
      if (rid.startsWith("D:")) d0.duty_key = rid.slice(2);
      const f0: Record<string, Ev[]> = { ...(src?.files || {}) };
      for (const [k, v] of Object.entries(up)) f0[k] = [...(f0[k] || []), ...v];
      const keep = rid.startsWith("C:") || filled(data) || Object.keys(up).length > 0;
      if (keep) { created.set(rid, await newRow(base, d0, f0, by, i++)); changed++; }
    }
  }

  // ③ 버튼 뜻
  if (intent === "add" || intent.startsWith("add:")) {
    const preset: Record<string, any> = {};
    if (intent.startsWith("add:")) { const [k, v] = intent.slice(4).split("="); if (k) preset[k] = v || ""; }
    await newRow(base, preset, {}, by, 99);
    go(back, "", "", hash);
  }
  if (delRid) {
    const old = byId.get(delRid);
    if (old && old.scope === base.scope) await patchRow(TABLE, "rec_id", delRid, { deleted: "Y", updated_at: ymd(), updated_by: by }, by, "의무이행 행 삭제");
    go(back, "행을 삭제했습니다", "", hash);
  }
  if (intent.startsWith("clrf:")) {
    const [, rid, key] = intent.split(":");
    const old = byId.get(rid);
    if (old && old.scope === base.scope) {
      const nf = { ...old.files, [key]: [] };
      const nd = old.data;
      await patchRow(TABLE, "rec_id", rid, { files: JSON.stringify(nf), status: statusOf(nd, nf), updated_at: ymd(), updated_by: by }, by, "증빙 파일 비움");
    }
    go(back, "첨부 파일을 비웠습니다", "", hash);
  }
  if (intent === "bulk") {
    // 담당 대상 일괄적용 — 이 부서의 다른 대상에도 같은 내용이 보이게 ALL:<부서> 로 한 벌 둔다(대상에 자기 줄이 생기면 그것이 우선)
    const fresh = (await records()).filter((r) => r.step === base.step && r.block === base.block);
    for (const r of fresh.filter((x) => x.scope === `ALL:${base.dept}`)) await patchRow(TABLE, "rec_id", r.rec_id, { deleted: "Y" }, by, "일괄적용 교체");
    let k = 0;
    for (const r of fresh.filter((x) => x.scope === base.scope)) await newRow({ ...base, scope: `ALL:${base.dept}` }, r.data, r.files, by, k++);
    go(back, `담당 대상 일괄적용 — ${S(f, "bulkLabel") || "같은 부서 담당 대상"}에 적용했습니다`, "", hash);
  }
  if (intent.startsWith("modal:")) {
    // modal:<이름>|<줄 id> — 줄 id 에 「:」가 들어갈 수 있어 「|」로 나눈다
    const [name, rid0] = intent.slice(6).split("|");
    // 새 줄(N:)·일괄적용 분(C:)에서 직원 검색을 누르면 방금 만든 줄 id 로 넘긴다(비어 있어 안 만들어졌으면 그대로 — 고를 때 새 줄)
    const rid = created.get(rid0 || "") || rid0 || "";
    go(back, "", `&modal=${name}${rid ? `&rid=${encodeURIComponent(rid)}` : ""}`, "");
  }
  go(back, changed ? "저장했습니다" : "바뀐 내용이 없습니다", "", hash);
}

/** 팝업에서 고른 줄들을 표에 더한다(불러오기 · 법령 검색 · 계획수립 내용 검색). 값은 체크칸 value 의 JSON. */
export async function importRows(f: FormData) {
  const role = S(f, "role") || "gm";
  const by = ROLE_STAFF[role] || "SM01-1";
  const base = { scope: S(f, "scope"), dept: S(f, "dept"), step: S(f, "step"), block: S(f, "block") };
  const back = S(f, "back");
  const picks = [...f.getAll("pick"), ...(S(f, "one") ? [S(f, "one")] : [])].map(String).filter(Boolean);
  if (!picks.length) go(back, "고른 항목이 없습니다", "", base.block);
  const replace = S(f, "replace") === "Y";
  // 교체(절차도 카드처럼 한 벌만 두는 표) — 앞 줄은 지운 표시만 하고, 올려 둔 파일은 새 줄로 옮긴다
  let carry: Record<string, Ev[]> = {};
  let carryData: Record<string, any> = {};
  if (replace) {
    for (const r of (await records()).filter((x) => x.step === base.step && x.block === base.block && x.scope === base.scope)) {
      carry = { ...carry, ...r.files };
      carryData = { ...carryData, ...r.data };
      await patchRow(TABLE, "rec_id", r.rec_id, { deleted: "Y" }, by, "불러오기로 교체");
    }
  }
  const have = new Set((await records()).filter((x) => x.step === base.step && x.block === base.block && x.scope === base.scope).map((x) => x.data.duty_key).filter(Boolean));
  let k = 0;
  for (const p of picks) {
    let d: Record<string, any> = {};
    try { d = JSON.parse(p); } catch { continue; }
    if (d.duty_key && have.has(d.duty_key)) continue; // 같은 의무는 한 번만
    await newRow(base, replace ? { ...carryData, ...d } : d, replace ? carry : {}, by, k++);
  }
  go(back, `${k}건을 불러왔습니다`, "", base.block);
}

/** 직원 검색 팝업에서 고른 사람을 그 줄의 이름·소속에 넣는다. */
export async function pickStaff(f: FormData) {
  const role = S(f, "role") || "gm";
  const by = ROLE_STAFF[role] || "SM01-1";
  const base = { scope: S(f, "scope"), dept: S(f, "dept"), step: S(f, "step"), block: S(f, "block") };
  const back = S(f, "back");
  const rid = S(f, "rid");
  const [name, dept] = S(f, "who").split("|");
  if (!name) go(back, "고른 사람이 없습니다", "", base.block);
  const old = (await records()).find((r) => r.rec_id === rid && r.scope === base.scope);
  if (old) {
    const nd = { ...old.data, name, dept };
    await patchRow(TABLE, "rec_id", rid, { data: JSON.stringify(nd), status: statusOf(nd, old.files), updated_at: ymd(), updated_by: by }, by, "직원 검색으로 입력");
  } else {
    await newRow(base, { name, dept }, {}, by);
  }
  go(back, `${name} — 입력했습니다`, "", base.block);
}
