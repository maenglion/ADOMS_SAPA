"use server";
/**
 * [400 · 교육자료 버전] 묶음 B1 저장 — 관리대상 기본정보·세부정보(SCR-028·029) · 사업장 기본정보 관리(SCR-023)
 * · 도급·용역·위탁 등록·수정(SCR-031~033). 쓰기는 공통 경로 appendRow / patchRow 로만, 표 이름은 usb1_… .
 * 파일은 attachOf 로 실제 저장한다(지우지 않는다 — 시행령 제13조 5년 보관).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable, depts } from "@/lib/data";
import { attachOf } from "@/lib/attach";
import { ymd } from "@/lib/day";
import { EMP_TYPES, HC_ROWS, MGMT_ITEMS, byOf, trackKey, J, CDUTY, contractOne } from "./_lib";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const all = (f: FormData, k: string) => f.getAll(k).map((v) => String(v ?? "").trim());

/** 첨부 칸 묶음 읽기 — 남길 파일(JSON) + 새로 올린 파일(nf_0…). */
async function filesOf(f: FormData, prefix = "") {
  const keep = J<{ name: string; url: string }[]>(f.get(`${prefix}keep`), []);
  for (let i = 0; i < 30; i++) {
    const file = f.get(`${prefix}nf_${i}`);
    if (!(file instanceof File) || !file.size) continue;
    const a = await attachOf(f, `${prefix}nfn_${i}`, `${prefix}nf_${i}`);
    if (a.evidence_name) keep.push({ name: a.evidence_name, url: a.evidence_url });
  }
  return keep;
}

/** 표에 이미 있으면 patchRow, 없으면 appendRow. */
async function upsert(table: string, keyCol: string, row: Record<string, any>, by: string, action: string) {
  const rows = await readTable(table, keyCol);
  if (rows.some((r) => r[keyCol] === row[keyCol])) await patchRow(table, keyCol, row[keyCol], row, by, action);
  else await appendRow(table, row, by, action);
}

/* ── SCR-028·029 기본정보·세부정보 저장 ──────────────────────── */
export async function saveBasic(f: FormData) {
  const role = s(f, "role") || "gm";
  const t = trackKey(s(f, "t"));
  const id = s(f, "target_id");
  const date = s(f, "base_date") || ymd();
  const by = byOf(role);
  if (!id) return;

  const hc: Record<string, number[]> = {};
  HC_ROWS.forEach((r, ri) => { hc[r] = EMP_TYPES.map((_, ti) => Math.max(0, Number(s(f, `hc_${ri}_${ti}`) || 0))); });

  const wn = all(f, "w_name"), wo = all(f, "w_org"), wp = all(f, "w_phone");
  const workers = wn.map((name, i) => ({ name, org: wo[i] || "", phone: wp[i] || "" })).filter((w) => w.name || w.org || w.phone);
  const ss = all(f, "s_state"), sn = all(f, "s_name"), sph = all(f, "s_phone"), spo = all(f, "s_pos"), sf = all(f, "s_from"), st = all(f, "s_to");
  const sups = ss.map((state, i) => ({ state, name: sn[i] || "", phone: sph[i] || "", pos: spo[i] || "", from: sf[i] || "", to: st[i] || "" }))
    .filter((x) => x.name || x.phone || x.pos || x.from || x.to || x.state === "미지정");

  const spec: Record<string, string> = {};
  const extra: Record<string, string> = {};
  for (const [k, v] of f.entries()) {
    if (k.startsWith("spec_")) spec[k.slice(5)] = String(v).trim();
    if (k.startsWith("x_")) extra[k.slice(2)] = String(v).trim();
  }
  const files = await filesOf(f);

  const row = {
    basic_id: `${t}:${id}:${date}`, track: t, target_id: id, base_date: date,
    addr: s(f, "addr"), ind_class: s(f, "ind_class"), ind_code: s(f, "ind_code"),
    headcount: t === "ws" ? JSON.stringify(hc) : "{}",
    workers: JSON.stringify(workers), sups: JSON.stringify(t === "ws" ? sups : []), files: JSON.stringify(files),
    spec: JSON.stringify(spec), extra: JSON.stringify(extra), state: "입력", saved_at: ymd(), saved_by: by,
  };
  await upsert("usb1_basic", "basic_id", row, by, `관리대상 기본정보 저장(${t})`);
  revalidatePath("/targets");
  redirect(`/targets/basic/${encodeURIComponent(id)}?t=${t}&role=${role}&d=${date}&ok=1`);
}

/* ── SCR-023 사업장 기본정보 관리(관리자) ───────────────────── */
export async function saveWsMgmt(f: FormData) {
  const role = s(f, "role") || "gm";
  const dept = s(f, "dept_id");
  const by = byOf(role);
  if (!dept) return;
  const op = s(f, "op");
  if (op === "delete") {
    // 삭제처리 — 기록을 지우지 않고 「삭제」 표시만(되돌릴 수 있게)
    await upsert("usb1_ws_mgmt", "dept_id", { dept_id: dept, state: "삭제", updated_at: ymd(), updated_by: by }, by, "사업장 기본정보 삭제처리");
    revalidatePath("/targets");
    redirect(`/targets/workplace?role=${role}&dept=${dept}&ok=del`);
  }
  const row: Record<string, string> = {
    dept_id: dept, addr: s(f, "addr"), ind_class: s(f, "ind_class"), ind_code: s(f, "ind_code"),
    state: "입력", updated_at: ymd(), updated_by: by,
  };
  MGMT_ITEMS.forEach((_, i) => { row[`m${i}`] = s(f, `m${i}`); });
  await upsert("usb1_ws_mgmt", "dept_id", row, by, "사업장 기본정보 수정");
  revalidatePath("/targets");
  redirect(`/targets/workplace?role=${role}&dept=${dept}&ok=1`);
}

/* ── SCR-031~033 도급·용역·위탁 등록·수정 ───────────────────── */
const CFIELDS = [
  "contract_name", "order_dept", "manager_name", "manager_phone", "counterpart", "start_date", "end_date", "work_start_date",
  "contract_type", "amount", "main_task", "asset_id", "vendor_manager", "vendor_phone", "biz_no", "trade", "regular_workers", "worker_cnt",
  "work_place",
];

export async function saveContract(f: FormData) {
  const role = s(f, "role") || "gm";
  const by = byOf(role);
  let id = s(f, "contract_id");
  const isNew = !id || id === "new";
  if (isNew) id = `CTR-U${Date.now().toString(36).toUpperCase()}`;

  const row: Record<string, any> = { contract_id: id };
  CFIELDS.forEach((k) => { row[k] = s(f, k); });
  row.amount = row.amount.replace(/[^\d]/g, "");
  row.dept_id = s(f, "dept_id");
  if (!row.dept_id && row.order_dept) {
    // 발주부서 글자로 부서를 찾는다(총괄이 등록할 때)
    const d = (await depts()).find((x: any) => x.dept_name === row.order_dept || String(x.dept_name).startsWith(row.order_dept));
    row.dept_id = d?.dept_id || "";
  }
  row.place_codes = s(f, "place_codes");
  row.attach = JSON.stringify(await filesOf(f, "c_"));
  row.updated_at = ymd();
  row.updated_by = by;

  // 원 자료(contract) 에 있는 계약을 처음 고치면 원 줄 전체를 옮겨 적은 뒤 덮는다 — 다른 칸(평가 점수 등)이 사라지지 않게
  const mine = await readTable("usb1_contract", "contract_id");
  if (mine.some((r) => r.contract_id === id)) await patchRow("usb1_contract", "contract_id", id, row, by, "도급·용역·위탁 수정");
  else {
    const base = isNew ? {} : (await contractOne(id)) || {};
    await appendRow("usb1_contract", { ...base, ...row }, by, isNew ? "도급·용역·위탁 등록" : "도급·용역·위탁 수정");
  }

  // SCR-033 관리의무 이행정보 — 항목마다 한 줄
  for (const d of CDUTY) {
    const status = s(f, `cd_${d.code}`);
    const files = await filesOf(f, `cd_${d.code}_`);
    await upsert("usb1_contract_duty", "cd_id", {
      cd_id: `${id}:${d.code}`, contract_id: id, item_code: d.code, status, files: JSON.stringify(files),
      basis: d.basis, updated_at: ymd(), updated_by: by,
    }, by, "도급 관리의무 이행정보 저장");
  }
  revalidatePath("/targets");
  redirect(`/targets/contract/${encodeURIComponent(id)}?role=${role}&ok=1`);
}
