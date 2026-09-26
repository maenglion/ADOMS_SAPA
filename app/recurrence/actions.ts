"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { ORD_AREAS, ORD_AREA_BASIS, ORD_NATURES } from "./model";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";

/**
 * 재발방지·개선명령의 쓰기 — 공용 appendRow·patchRow 로만 한다.
 * 표 이름: incident · order_received · incident_nil_check.
 * 필수 칸이 비면 저장하지 않고 화면으로 돌려보내 무엇이 빠졌는지 보여 준다.
 */
const who = (role: string) => ROLE_STAFF[role] || "SM01-1";
const today = () => ymd();
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function back(f: FormData, anchor: string, msg?: { err?: string; ok?: string }): never {
  const p = new URLSearchParams();
  p.set("role", v(f, "role") || "gm");
  for (const k of ["ic", "is", "os", "oa", "on"]) if (v(f, k)) p.set(k, v(f, k));
  if (msg?.err) p.set("err", msg.err);
  if (msg?.ok) p.set("ok", msg.ok);
  redirect(`/recurrence?${p.toString()}#${anchor}`);
}
function need(f: FormData, anchor: string, fields: Record<string, string>) {
  const miss = Object.entries(fields).filter(([k]) => !v(f, k)).map(([, label]) => label);
  if (miss.length) back(f, anchor, { err: `빠진 칸: ${miss.join(" · ")}` });
}
function refresh() {
  ["/recurrence", "/exec", "/report", "/inspections"].forEach((p) => revalidatePath(p));
}

/* ── 재해 ─────────────────────────────────────────────────────── */

const DISASTER_TYPE = (cls: string, serious: string) =>
  cls === "아차사고" ? "아차사고"
    : cls === "산업재해" ? (serious === "해당" ? "중대산업재해" : "산업재해")
      : (serious === "해당" ? "중대시민재해" : "시민 피해 사고");

export async function addIncident(f: FormData) {
  const role = v(f, "role") || "gm";
  need(f, "inc-new", {
    event_class: "구분", event_area: "피해 대상", occurred_at: "발생일", dept_id: "부서",
    accident_type: "사고 유형", summary: "무슨 일이 있었나", casualties: "피해", owner_staff_id: "담당", cause_due: "원인 조사 기한",
  });
  if (!v(f, "asset_id") && !v(f, "place")) back(f, "inc-new", { err: "빠진 칸: 시설 번호 또는 장소 중 하나" });
  if (v(f, "occurred_at") > today()) back(f, "inc-new", { err: "발생일이 오늘보다 늦습니다" });
  const cls = v(f, "event_class");
  const serious = cls === "아차사고" ? "해당 안 됨" : v(f, "serious") || "판단 전";
  const area = v(f, "event_area");
  const basis = cls === "아차사고" ? "법정 대상 아님 — 예방 기록(위험성평가 반영)"
    : area === "산업" ? "법 제4조제1항제2호"
      : v(f, "civil_basis") === "원료·제조물" ? "법 제9조제1항제2호" : "법 제9조제2항제2호";
  const id = newId("INC");
  await appendRow("incident", {
    incident_id: id, occurred_at: v(f, "occurred_at"), disaster_type: DISASTER_TYPE(cls, serious),
    asset_id: v(f, "asset_id").split(" ")[0], dept_id: v(f, "dept_id"), summary: v(f, "summary"), cause: "",
    casualties: v(f, "casualties"), recurrence_plan: "", plan_due: "", plan_done_at: "",
    event_class: cls, event_area: area, serious, accident_type: v(f, "accident_type"), place: v(f, "place"),
    basis_clause: basis, reported_by: who(role), owner_staff_id: v(f, "owner_staff_id"),
    cause_due: v(f, "cause_due"), note: "화면에서 등록",
  }, who(role), `사고 등록 — ${cls}`);
  refresh();
  back(f, "inc-list", { ok: "사고를 등록했습니다 — 원인 조사 단계로 넘어갑니다" });
}

/** 재해 한 건을 다음 단계로. step = cause | plan | done | effect */
export async function advanceIncident(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "incident_id");
  const step = v(f, "step");
  const by = who(role);
  const anchor = id;
  const cur = (await readTable("incident", "incident_id")).find((r) => r.incident_id === id);
  if (!cur) back(f, "inc-list", { err: "사고를 찾지 못했습니다" });

  // [캡처 v2] K03 — 단계마다 파일 첨부 칸 하나(evidence_file). 올리면 이름 칸을 파일 이름으로 채우고 주소를 *_url 칸에 남긴다.
  if (step === "cause") {
    const ev = await attachOf(f, "cause_evidence");
    need(f, anchor, { cause: "원인", cause_evidence: "조사 기록", plan_set_due: "대책 수립 기한" });
    await patchRow("incident", "incident_id", id, {
      cause: v(f, "cause"), cause_evidence: v(f, "cause_evidence"), cause_evidence_url: ev.evidence_url,
      investigated_at: today(), investigated_by: by, plan_set_due: v(f, "plan_set_due"),
    }, by, "원인 조사 기록");
  } else if (step === "plan") {
    const ev = await attachOf(f, "plan_evidence");
    need(f, anchor, { recurrence_plan: "재발방지 대책", plan_due: "이행 기한" });
    await patchRow("incident", "incident_id", id, {
      recurrence_plan: v(f, "recurrence_plan"), plan_due: v(f, "plan_due"), plan_evidence: v(f, "plan_evidence"), plan_evidence_url: ev.evidence_url,
      plan_set_at: today(), plan_set_by: by,
    }, by, "재발방지 대책 수립");
  } else if (step === "done") {
    const ev = await attachOf(f, "done_evidence");
    need(f, anchor, { done_note: "이행 내용", done_evidence: "이행 증빙", effect_due: "효과 확인 예정일" });
    await patchRow("incident", "incident_id", id, {
      done_note: v(f, "done_note"), done_evidence: v(f, "done_evidence"), done_evidence_url: ev.evidence_url, effect_due: v(f, "effect_due"),
      plan_done_at: today(), done_by: by,
    }, by, "재발방지 대책 이행 완료");
  } else if (step === "effect") {
    const ev = await attachOf(f, "effect_evidence");
    need(f, anchor, { effect_result: "효과 판단", effect_note: "판단 근거" });
    const ok = v(f, "effect_result") === "유효";
    const hist = `${cur!.history ? cur!.history + " | " : ""}${today()} 효과 확인 「${v(f, "effect_result")}」 — ${v(f, "effect_note")}`;
    await patchRow("incident", "incident_id", id, ok
      ? { effect_result: "유효", effect_note: v(f, "effect_note"), effect_evidence: v(f, "effect_evidence"), effect_evidence_url: ev.evidence_url,
          effect_checked_at: today(), effect_checked_by: by, history: hist }
      : { // 효과가 없으면 대책 수립으로 되돌린다. 앞 기록은 history 에 남는다.
          effect_result: "재검토 필요", effect_note: v(f, "effect_note"), history: hist,
          reopen_count: String((+cur!.reopen_count || 0) + 1),
          plan_set_at: "", plan_done_at: "", effect_checked_at: "", plan_set_due: plus(14) },
      by, ok ? "재발방지 효과 확인 — 유효" : "재발방지 효과 확인 — 재검토");
  } else back(f, anchor, { err: "알 수 없는 단계" });

  refresh();
  back(f, anchor, { ok: "단계를 기록했습니다" });
}

/** 반기 「재해 발생 이력 없음」 확인. */
export async function confirmNil(f: FormData) {
  const role = v(f, "role") || "gm";
  need(f, "nil", { period: "반기", dept_id: "부서", confirmed_by: "확인한 사람" });
  const period = v(f, "period");
  const dept = v(f, "dept_id");
  const hit = (await readTable("incident", "incident_id")).some((r) =>
    r.dept_id === dept && r.event_class !== "아차사고" && r.occurred_at
    && `${r.occurred_at.slice(0, 4)}-H${+r.occurred_at.slice(5, 7) <= 6 ? 1 : 2}` === period);
  if (hit) back(f, "nil", { err: "그 반기에 등록된 재해가 있어 「발생 이력 없음」으로 확인할 수 없습니다" });
  await appendRow("incident_nil_check", {
    nil_id: newId("NIL"), period, dept_id: dept, confirmed_by: v(f, "confirmed_by"),
    confirmed_at: today(), memo: v(f, "memo") || "확인 시점까지 부서 내 재해 발생 없음", note: "화면에서 확인",
  }, who(role), `재해 발생 이력 없음 확인 — ${period}`);
  refresh();
  back(f, "nil", { ok: "「발생 이력 없음」 확인을 기록했습니다" });
}

/* ── 개선·시정명령 ────────────────────────────────────────────── */

export async function addOrder(f: FormData) {
  const role = v(f, "role") || "gm";
  need(f, "ord-new", {
    received_at: "접수일", doc_nature: "문서 성격", issuer: "발령기관", issuer_kind: "기관 구분", order_area: "재해 구분", law: "근거 법",
    content: "명령 내용", dept_id: "부서",
  });
  if (!(ORD_NATURES as readonly string[]).includes(v(f, "doc_nature"))) back(f, "ord-new", { err: "문서 성격을 고르십시오" });
  const advice = v(f, "doc_nature") === "지도·권고·조언";
  // 서면 행정처분은 이행 기한이 있어야 한다. 지도·권고·조언은 참고 기록이라 기한이 없어도 받는다.
  if (!advice) need(f, "ord-new", { due_date: "이행 기한" });
  if (!(ORD_AREAS as readonly string[]).includes(v(f, "order_area"))) back(f, "ord-new", { err: "재해 구분을 고르십시오" });
  if (v(f, "due_date") && v(f, "due_date") < v(f, "received_at")) back(f, "ord-new", { err: "이행 기한이 접수일보다 빠릅니다" });
  if (v(f, "received_at") > today()) back(f, "ord-new", { err: "접수일이 오늘보다 늦습니다" });
  const owner = v(f, "owner_staff_id");
  await appendRow("order_received", {
    order_id: newId("ORD"), received_at: v(f, "received_at"), issuer: v(f, "issuer"), law: v(f, "law"),
    content: v(f, "content"), due_date: v(f, "due_date"), dept_id: v(f, "dept_id"),
    asset_id: v(f, "asset_id").split(" ")[0], done_at: "", result: "접수", evidence_file: "",
    issuer_kind: v(f, "issuer_kind"), law_article: v(f, "law_article"), order_no: v(f, "order_no"),
    place: v(f, "place"), owner_staff_id: owner, assigned_at: owner ? today() : "",
    order_area: v(f, "order_area"), basis_clause: ORD_AREA_BASIS[v(f, "order_area")],
    doc_nature: v(f, "doc_nature"), note: "화면에서 등록",
  }, who(role), advice ? "행정지도·권고 참고 기록 접수" : "개선·시정명령 접수");
  refresh();
  if (advice) {
    const p = new URLSearchParams({ role, on: "advice" });
    redirect(`/recurrence?${p.toString()}&ok=${encodeURIComponent("지도·권고·조언을 참고 기록으로 접수했습니다 — 명령 대장의 수에는 들어가지 않습니다")}#ord-list`);
  }
  back(f, "ord-list", { ok: owner ? "명령을 접수하고 담당을 지정했습니다" : "명령을 접수했습니다 — 담당을 지정하십시오" });
}

/** 명령 한 건을 다음 단계로. step = assign | start | done | extend | report | close */
export async function advanceOrder(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "order_id");
  const step = v(f, "step");
  const by = who(role);
  const anchor = id;
  let patch: Record<string, string> = {};
  let action = "";
  if (step === "nature") {
    need(f, anchor, { doc_nature: "문서 성격" });
    if (!(ORD_NATURES as readonly string[]).includes(v(f, "doc_nature"))) back(f, anchor, { err: "문서 성격을 고르십시오" });
    patch = { doc_nature: v(f, "doc_nature") }; action = `명령 문서 성격 — ${v(f, "doc_nature")}`;
  } else if (step === "area") {
    need(f, anchor, { order_area: "재해 구분" });
    if (!(ORD_AREAS as readonly string[]).includes(v(f, "order_area"))) back(f, anchor, { err: "재해 구분을 고르십시오" });
    patch = { order_area: v(f, "order_area"), basis_clause: ORD_AREA_BASIS[v(f, "order_area")] }; action = "명령 재해 구분 지정";
  } else if (step === "assign") {
    need(f, anchor, { owner_staff_id: "담당" });
    patch = { owner_staff_id: v(f, "owner_staff_id"), assigned_at: today() }; action = "명령 담당 지정";
  } else if (step === "start") {
    need(f, anchor, { action_plan: "이행 계획" });
    patch = { action_plan: v(f, "action_plan"), started_at: today(), result: "조치 중" }; action = "명령 이행 착수";
  } else if (step === "done") {
    const ev = await attachOf(f, "evidence_file", "evidence_upload"); // [캡처 v2] K03 — 파일 칸은 evidence_upload(이름 칸 evidence_file 과 겹치지 않게)
    need(f, anchor, { done_note: "이행 내용", evidence_file: "이행 증빙" });
    patch = { done_note: v(f, "done_note"), evidence_file: v(f, "evidence_file"), evidence_url: ev.evidence_url, done_at: today(), done_by: by, result: "조치 완료" };
    action = "명령 이행 완료";
  } else if (step === "extend") {
    need(f, anchor, { extended_due: "연장된 기한", extend_reason: "연장 근거" });
    patch = { extended_due: v(f, "extended_due"), extend_reason: v(f, "extend_reason") }; action = "명령 이행 기한 연장 기록";
  } else if (step === "report") {
    const ev = await attachOf(f, "report_evidence", "evidence_upload");
    need(f, anchor, { reported_at: "보고일", report_evidence: "보고 문서" });
    patch = { reported_at: v(f, "reported_at"), report_evidence: v(f, "report_evidence"), report_evidence_url: ev.evidence_url }; action = "명령 이행 결과 보고";
  } else if (step === "close") {
    need(f, anchor, { closed_at: "종결일", closed_note: "발령기관 확인 방법" });
    patch = { closed_at: v(f, "closed_at"), closed_note: v(f, "closed_note"), result: "종결" }; action = "명령 종결";
  } else back(f, anchor, { err: "알 수 없는 단계" });

  await patchRow("order_received", "order_id", id, patch, by, action);
  refresh();
  back(f, anchor, { ok: `${action} — 기록했습니다` });
}
