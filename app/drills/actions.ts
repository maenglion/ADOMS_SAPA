"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable, assetById } from "@/lib/data";
import { saveFile } from "@/lib/storage";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { LRT, ROLES, RUBRIC_KEYS, RUBRIC, scopeOf } from "./codes";
import { ymd } from "@/lib/day";

/** 대피훈련 — 쓰기는 공용 경로(appendRow·patchRow)만 쓴다. */
const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const s = (f: FormData, k: string) => String(f.get(k) || "").trim();
const today = () => ymd();

function back(role: string, id: string, hash = "") {
  revalidatePath("/drills");
  revalidatePath(`/drills/${id}`);
  redirect(`/drills/${id}?role=${role}${hash}`);
}
const patch = (id: string, p: Record<string, any>, by: string, act: string) =>
  patchRow("drill_plan", "drill_id", id, p, by, `대피훈련 ${act}`);

/** 새 훈련 계획. 같은 시설의 지난 훈련 개선사항을 이번 계획의 과제로 넘겨받는다. */
export async function createPlan(form: FormData) {
  const role = s(form, "role") || "gm", by = who(role);
  const key = s(form, "asset_id");
  if (!key) return;
  const a: any = key === LRT.asset_id ? { ...LRT, sapa_l2_result: "해당" } : await assetById(key);
  if (!a) return;
  const { scope, kind } = scopeOf(a);
  let carry = s(form, "carry_over");
  if (!carry) {
    const prev = (await readTable("drill_plan", "drill_id"))
      .filter((d) => d.target_key === key && d.improvements)
      .sort((x, y) => String(y.planned_at).localeCompare(String(x.planned_at)))[0];
    carry = prev?.improvements || "";
  }
  const id = `DRL-${Date.now().toString(36).toUpperCase()}`;
  await appendRow("drill_plan", {
    drill_id: id, target_key: key, target_name: a.asset_name, target_kind: kind, asset_class: a.asset_class || "",
    legal_scope: scope, dept_id: a.dept_id, year: s(form, "year"), half: s(form, "half"),
    drill_type: s(form, "drill_type"), method: s(form, "method"), planned_at: s(form, "planned_at").replace("T", " "),
    place: s(form, "place"), scenario: s(form, "scenario"), target_minutes: s(form, "target_minutes"),
    prep_coop: "미완료", prep_items: "미완료", prep_budget: "미완료", prep_memo: "", carry_over: carry,
    status: "계획", note: "화면에서 계획",
  }, by, "대피훈련 계획");
  back(role, id);
}

/** 준비목록 3구분(사전협조 · 훈련준비 · 예산·행정). */
export async function savePrep(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  await patch(id, {
    prep_coop: s(form, "prep_coop") ? "완료" : "미완료",
    prep_items: s(form, "prep_items") ? "완료" : "미완료",
    prep_budget: s(form, "prep_budget") ? "완료" : "미완료",
    prep_memo: s(form, "prep_memo"),
  }, by, "준비목록");
  back(role, id, "#prep");
}

/** 임무카드 — 역할별 정·부 담당. */
export async function saveRoles(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  const p: Record<string, string> = {};
  ROLES.forEach((r) => { p[`r_${r.key}_main`] = s(form, `r_${r.key}_main`); p[`r_${r.key}_sub`] = s(form, `r_${r.key}_sub`); });
  await patch(id, p, by, "임무카드");
  back(role, id, "#roles");
}

/** 실시 기록 — 실제 대피시간·참여 인원·사진. */
export async function saveRun(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  const urls: string[] = s(form, "photos_prev").split(" | ").filter(Boolean);
  for (const f of form.getAll("photos")) {
    if (f instanceof File && f.size > 0) urls.push((await saveFile(f)).url);
  }
  await patch(id, {
    done_at: s(form, "done_at") || today(), actual_minutes: s(form, "actual_minutes"),
    participants: s(form, "participants"), absent: s(form, "absent"), photos: urls.join(" | "), status: "실시",
  }, by, "실시 기록");
  back(role, id, "#run");
}

/** 평가표 100점 — 세부 배점 합산. 배점을 넘는 값은 배점으로 자른다. */
export async function saveEval(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  const max = new Map(RUBRIC.flatMap((g) => g.items.map((i) => [i.k, i.max] as const)));
  const row: Record<string, string> = {
    eval_id: `DRE-${Date.now().toString(36).toUpperCase()}`, drill_id: id,
    evaluator: s(form, "evaluator") || by, evaluated_at: today(), comment: s(form, "comment"), note: "화면에서 평가",
  };
  let total = 0;
  RUBRIC_KEYS.forEach((k) => {
    const v = Math.max(0, Math.min(max.get(k) || 0, Math.round(Number(s(form, k)) || 0)));
    row[k] = String(v); total += v;
  });
  row.total = String(total);
  await appendRow("drill_eval", row, by, "대피훈련 평가");
  back(role, id, "#eval");
}

/** 결과·미흡사항·개선사항(→ 다음 훈련 과제). */
export async function saveResult(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  await patch(id, {
    good_points: s(form, "good_points"), shortfalls: s(form, "shortfalls"), improvements: s(form, "improvements"),
  }, by, "결과보고");
  back(role, id, "#result");
}

/** 철도안전법 제7조 비상대응계획으로 갈음 — 경영책임자 확인이 있어야 인정된다.
 *  판정은 lib/drill.ts drillSubstitutes 한 곳에서 한다(체계 문서의 보고받음 기록과 함께 읽음).
 *  경영책임자 확인 칸은 경영책임자 본인 또는 총괄의 대리 기록만 받는다 — 다른 역할이 저장하면 확인 칸은 그대로 둔다. */
export async function saveSubstitute(form: FormData) {
  const role = s(form, "role"), id = s(form, "drill_id"), by = who(role);
  if (!id) return;
  const sub = s(form, "substitute") === "Y";
  const ceo = s(form, "ceo_checked") === "Y";
  const c = ceoConfirm(role);
  const p: Record<string, string> = {
    substitute: sub ? "Y" : "N", substitute_basis: sub ? "철도안전법 제7조 비상대응계획(철도안전관리체계)" : "",
  };
  if (c.ok || !sub) Object.assign(p, {
    ceo_checked: sub && ceo ? "Y" : "N", ceo_checked_at: sub && ceo ? s(form, "ceo_checked_at") || today() : "",
    ceo_check_mode: sub && ceo ? s(form, "ceo_check_mode") + (c.proxy ? "(총괄 대리 기록)" : "") : "",
  });
  await patch(id, p, by, "갈음 확인");
  revalidatePath("/system");
  revalidatePath("/exec");
  back(role, id, "#subst");
}
