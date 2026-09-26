"use server";
/**
 * [400 · 교육자료 버전] 묶음 E — 의무이행(실적증빙) 원료·제조물 저장.
 *
 * 화면의 입력 표 하나 = 폼 하나. 칸 이름은 `<행id>__<칸>`, 파일 칸은 `<행id>__file[_<자리>]`.
 * 모든 버튼(저장 · 항목 추가 · 행 삭제 · 파일 삭제)은 같은 act 를 부르고, **먼저 표 전체를 저장한 뒤** 제 일을 한다
 * (추가·삭제를 누를 때 적어 둔 값이 사라지지 않게).
 * 아직 기록이 없는 줄(의무 목록에서 온 줄 · 빈 예산 항목 등)은 행id 가 `NEW~<block>` 이고, 값이 들어왔을 때만 새로 만든다.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow, type Row } from "@/lib/write";
import { attachOf } from "@/lib/attach";
import { ROLE_STAFF } from "@/lib/roles";
import { ymd } from "@/lib/day";
import { TABLE, YEAR, allRecs, recsOf, plansOf, budgetPlan, people, mDuties, dutyText, BUDGET_ITEMS, type Ev } from "./model";

const S = (v: FormDataEntryValue | null | undefined) => String(v ?? "").trim();
const js = (s: any, d: any) => {
  if (s && typeof s === "object") return s;
  try { return s ? JSON.parse(String(s)) : d; } catch { return d; }
};
const newId = () => `USE-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
/** 표에서 아래로 쌓이게 — 시드 순번(작은 수)보다 크다. */
const newSeq = () => String(Date.now());

type Ctx = { role: string; site: string; dept: string; step: string; by: string };
const ctxOf = (f: FormData): Ctx => {
  const role = S(f.get("role")) || "gm";
  return { role, site: S(f.get("site")), dept: S(f.get("dept")), step: S(f.get("step")), by: ROLE_STAFF[role] || "SM01-1" };
};
const back = (c: Ctx, hash = "") => `/perform/mt/${c.step}?role=${c.role}&site=${c.site}${hash ? `#${hash}` : ""}`;

/** 행 상태 — 이행점검(묶음 F)이 읽는다. */
function statusOf(block: string, data: Row, files: Ev[]): string {
  if (block === "nil") return data.nil === "Y" ? "해당없음" : "";
  if (block.startsWith("duty:") || block === "lawx") return data.status || (files.length ? "이행완료" : "미이행");
  if (block === "item") return "";
  const filled = Object.entries(data).some(([k, v]) => !["item", "duty_key", "pinned", "staff_id", "order_id"].includes(k) && String(v || "").trim());
  return files.length ? "이행완료" : filled ? "보완필요" : "미이행";
}

/** 표 전체 저장. 돌려주는 값 = 저장 뒤 행id → 실제 rec_id(새로 만든 것 포함). */
async function saveAll(f: FormData, c: Ctx): Promise<Record<string, string>> {
  const rows = await allRecs();
  const byId = new Map<string, Row>(rows.map((r) => [r.rec_id, r]));
  const out: Record<string, string> = {};
  const rids = [...new Set(f.getAll("rid").map(S).filter(Boolean))];

  for (const rid of rids) {
    const pre = `${rid}__`;
    const block = S(f.get(`${pre}@block`));
    const meta = js(S(f.get(`${pre}@meta`)), {});
    const cbs = f.getAll(`${pre}@cb`).map(S);
    const fields: Row = {};
    const files: { key: string; slot: string }[] = [];
    for (const [k, v] of f.entries()) {
      if (!k.startsWith(pre)) continue;
      const name = k.slice(pre.length);
      if (name.startsWith("@") || name.endsWith("__nm")) continue;
      if (typeof v !== "string") {
        // file · file_<자리> · file~2(같은 자리의 「+」 칸)
        const m = name.match(/^file(?:_([A-Za-z0-9]+))?(?:~\d+)?$/);
        if (v.size > 0 && m) files.push({ key: k, slot: m[1] || "" });
        continue;
      }
      fields[name] = v.trim();
    }
    for (const cb of cbs) fields[cb] = f.has(`${pre}${cb}`) ? "Y" : "";

    const attached: Ev[] = [];
    for (const x of files) {
      const a = await attachOf(f, `${x.key}__nm`, x.key);
      if (a.evidence_name) attached.push({ name: a.evidence_name, url: a.evidence_url, slot: x.slot, at: ymd() });
    }

    const old = rid.startsWith("NEW~") ? null : byId.get(rid);
    // 미리 채워 보인 값(@meta — 의무 목록에서 온 교육명 등)과 같으면 사람이 적은 것이 아니다
    const userFilled = Object.entries(fields).some(([k, v]) => v && v !== String(meta[k] ?? "")) || attached.length > 0;
    if (!old) {
      if (!userFilled) continue;                     // 빈 줄은 만들지 않는다
      const data = { ...meta, ...fields };
      const id = newId();
      const row: Row = {
        rec_id: id, site_id: c.site, dept_id: c.dept, year: YEAR, step: c.step, block: block || "row",
        seq: newSeq(), deleted: "", status: statusOf(block, data, attached),
        data: JSON.stringify(data), files: JSON.stringify(attached), updated_at: ymd(), updated_by: c.by,
      };
      await appendRow(TABLE, row, c.by, "의무이행(원료·제조물) 등록");
      byId.set(id, row);
      out[rid] = id;
      continue;
    }
    const oldData = js(old.data, {});
    let oldFiles: Ev[] = js(old.files, []);
    const data = { ...oldData, ...fields };
    // 절차도 카드의 PDF·HWP 는 한 자리에 한 파일 — 새로 올리면 바꾼다
    if (String(old.block || "").startsWith("card:")) {
      const slots = new Set(attached.map((a) => a.slot));
      oldFiles = oldFiles.filter((x) => !slots.has(x.slot || ""));
    }
    const allFiles = [...oldFiles, ...attached];
    const changed = JSON.stringify(data) !== JSON.stringify(oldData) || attached.length > 0;
    out[rid] = old.rec_id;
    if (!changed) continue;
    await patchRow(TABLE, "rec_id", old.rec_id, {
      data: JSON.stringify(data), files: JSON.stringify(allFiles),
      status: statusOf(String(old.block || ""), data, allFiles), updated_at: ymd(), updated_by: c.by,
    }, c.by, "의무이행(원료·제조물) 수정");
  }
  return out;
}

function refresh() {
  ["/perform/mt", "/check", "/status", "/"].forEach((p) => revalidatePath(p, "layout"));
}

/**
 * 모든 버튼이 부르는 곳. op:
 *  save — 저장만 · add — 저장 뒤 빈 줄 하나(arg = {"block":…, "data":{…}}) · del — 저장 뒤 줄 지움(arg = 행id)
 *  delfile — 저장 뒤 증빙 하나 빼기(arg = 행id|순번)
 */
export async function act(op: string, arg: string, f: FormData) {
  const c = ctxOf(f);
  if (!c.site || !c.step) return;
  const map = await saveAll(f, c);
  let hash = "form";

  if (op === "add") {
    const a = js(arg, {});
    await appendRow(TABLE, {
      rec_id: newId(), site_id: c.site, dept_id: c.dept, year: YEAR, step: c.step, block: a.block || "row",
      seq: newSeq(), deleted: "", status: "미이행", data: JSON.stringify(a.data || {}), files: "[]",
      updated_at: ymd(), updated_by: c.by,
    }, c.by, "의무이행(원료·제조물) 줄 추가");
    hash = a.hash || hash;
  }
  if (op === "del") {
    const id = map[arg] || arg;
    if (id && !id.startsWith("NEW~")) await patchRow(TABLE, "rec_id", id, { deleted: "Y", updated_at: ymd(), updated_by: c.by }, c.by, "의무이행(원료·제조물) 줄 삭제");
  }
  if (op === "delfile") {
    const [rid, idx] = arg.split("|");
    const id = map[rid] || rid;
    const r = (await allRecs()).find((x) => x.rec_id === id);
    if (r) {
      const fs: Ev[] = js(r.files, []);
      fs.splice(Number(idx), 1);
      const data = js(r.data, {});
      // 파일은 저장소에 그대로 남긴다(시행령 제13조 5년 보관) — 이 줄의 목록에서만 뺀다
      await patchRow(TABLE, "rec_id", id, { files: JSON.stringify(fs), status: statusOf(String(r.block || ""), data, fs), updated_at: ymd(), updated_by: c.by }, c.by, "증빙 목록에서 빼기");
    }
  }
  refresh();
  redirect(back(c, hash));
}

/** 없으면 만들고 있으면 고친다 — 같은 사업장·단계·블록의 한 줄(nil · item · card · duty 등). */
async function upsertBlock(c: Ctx, block: string, patch: Row, files?: Ev[], find?: (r: { block: string; data: Row }) => boolean) {
  const ex = (await recsOf(c.site, c.step)).find(find || ((r) => r.block === block));
  if (ex) {
    const data = { ...ex.data, ...patch };
    const fs = files ?? ex.files;
    await patchRow(TABLE, "rec_id", ex.rec_id, {
      data: JSON.stringify(data), files: JSON.stringify(fs), status: statusOf(block, data, fs), updated_at: ymd(), updated_by: c.by,
    }, c.by, "불러오기");
    return;
  }
  const fs = files || [];
  await appendRow(TABLE, {
    rec_id: newId(), site_id: c.site, dept_id: c.dept, year: YEAR, step: c.step, block, seq: newSeq(), deleted: "",
    status: statusOf(block, patch, fs), data: JSON.stringify(patch), files: JSON.stringify(fs), updated_at: ymd(), updated_by: c.by,
  }, c.by, "불러오기");
}

/**
 * 「계획수립 내용 검색 및 추가」 → 불러오기. kind:
 *  staff(안전인력 계획) · budget(예산 편성) · hazard(유해·위험요인 계획) · doc:report|doc:response(절차도) · law(관계 법령 의무) · edu(법정교육)
 */
export async function loadPlan(kind: string, f: FormData) {
  const c = ctxOf(f);
  const picks = f.getAll("pick").map(S).filter(Boolean);
  let hash = "form";
  if (picks.length) {
    if (kind === "staff") {
      const ps = await plansOf(c.site, "staff", "row");
      for (const p of ps.filter((x) => picks.includes(x.plan_id))) {
        const d = p.data;   // 연락처는 실적 표에 칸이 없어 옮기지 않는다(명세 SCR-076 메모)
        await appendRow(TABLE, {
          rec_id: newId(), site_id: c.site, dept_id: c.dept, year: YEAR, step: c.step, block: "row", seq: newSeq(), deleted: "",
          status: "보완필요", data: JSON.stringify({ rank: d.rank, date: "", staff_id: d.staff_id, name: d.name, dept: d.dept, note: "", plan_id: p.plan_id }),
          files: "[]", updated_at: ymd(), updated_by: c.by,
        }, c.by, "안전인력 불러오기");
      }
    }
    if (kind === "budget") {
      // 가로(항목이 칸)인 계획을 세로(항목이 줄)인 실적 표의 편성액으로 옮긴다(명세 SCR-078 메모 — 전치)
      const { out } = await budgetPlan(c.dept);
      for (const it of BUDGET_ITEMS) {
        await upsertBlock(c, "item", { item: it, plan: String(out[it] || 0) }, undefined, (r) => r.block === "item" && r.data.item === it);
      }
    }
    if (kind === "hazard") {
      const ps = await plansOf(c.site, "proc", "row");
      for (const p of ps.filter((x) => picks.includes(x.plan_id))) {
        await appendRow(TABLE, {
          rec_id: newId(), site_id: c.site, dept_id: c.dept, year: YEAR, step: c.step, block: "row", seq: newSeq(), deleted: "",
          status: "보완필요", data: JSON.stringify({ hz: p.data.hz, check: p.data.check, cdate: "", act: "", adate: "", note: "", plan_id: p.plan_id }),
          files: "[]", updated_at: ymd(), updated_by: c.by,
        }, c.by, "유해·위험요인 불러오기");
      }
    }
    if (kind.startsWith("doc:")) {
      const card = kind.slice(4);
      const p = (await plansOf(c.site, "proc", `card:${card}`)).find((x) => picks.includes(x.plan_id));
      if (p) {
        const ex = (await recsOf(c.site, c.step)).find((r) => r.block === `card:${card}`);
        const keep = (ex?.files || []).filter((x) => x.slot !== "pdf");
        await upsertBlock(c, `card:${card}`, { mode: "PDF", wdate: p.data.wdate, plan_id: p.plan_id },
          [...keep, { name: p.data.file, url: "", slot: "pdf", at: ymd() }]);
      }
      hash = "cards";
    }
    if (kind === "law" || kind === "edu") {
      const ds = new Map((await mDuties()).map((d) => [d.duty_key, d]));
      for (const k of picks) {
        const d = ds.get(k);
        if (!d) continue;
        const block = `${kind === "law" ? "duty" : "edu"}:${k}`;
        const ex = (await recsOf(c.site, c.step)).find((r) => r.block === block);
        if (ex) continue;
        await upsertBlock(c, block, kind === "law"
          ? { duty_key: k, pinned: "Y", status: "", date: "", note: "" }
          : { duty_key: k, pinned: "Y", edu_name: dutyText(d), target: "", org: "", date: "", note: "" });
      }
      hash = kind === "law" ? "blockA" : "blockB";
    }
  }
  refresh();
  redirect(back(c, hash));
}

/** 이름 칸의 「검색」 → 직원 선택. 이름·소속을 명부 값으로 채운다. */
export async function pickPerson(rid: string, sid: string, f: FormData) {
  const c = ctxOf(f);
  const p = (await people()).find((x) => x.staff_id === sid);
  const r = (await allRecs()).find((x) => x.rec_id === rid);
  if (p && r) {
    const data = { ...js(r.data, {}), staff_id: p.staff_id, name: p.display_name, dept: p.dept_name };
    await patchRow(TABLE, "rec_id", rid, { data: JSON.stringify(data), updated_at: ymd(), updated_by: c.by }, c.by, "직원 선택");
  }
  refresh();
  redirect(back(c));
}
