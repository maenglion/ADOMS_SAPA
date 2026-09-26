"use server";
import { revalidatePath } from "next/cache";
import { addEvidence, patchTask } from "@/lib/write";
import { saveFile } from "@/lib/storage";
import { ROLE_STAFF, ROLE_DEPT, canApprove, isHead } from "@/lib/roles";
import { approvals, tasks } from "@/lib/data";
import { judgeWithRound } from "@/app/review/actions";
import { redirect } from "next/navigation";   // 09-26 사용자(2차): 증빙 대장 합치기 — 나누기·다시 묶기
import { appendRow } from "@/lib/write";
import { guard } from "@/lib/perm_server";
import { SPLIT_TABLE, SPLIT_ROLES } from "./ledger";

const who = (role: string) => ROLE_STAFF[role] || "SD01-1";

/** 증빙 등록 — 등록하면 그 과제는 「이행완료·제출」로 올라간다. */
export async function registerEvidence(form: FormData) {
  const role = String(form.get("role") || "gm");
  const task_id = String(form.get("task_id") || "");
  const file_name = String(form.get("file_name") || "").trim();
  if (!task_id || !file_name) return;

  await addEvidence({
    task_id,
    evidence_kind: String(form.get("evidence_kind") || "기타"),
    file_name,
    form_id: String(form.get("form_id") || ""),
    note: String(form.get("note") || ""),
    by: who(role),
  });
  await saveAttachments(form, task_id, who(role));
  await patchTask(task_id, { status: "이행완료", approval_status: "제출" }, who(role), "증빙 등록·제출");
  revalidatePath("/evidence");
  revalidatePath("/tasks");
  revalidatePath("/");
}

/**
 * 결재 — 승인·반려. ★ 판정 경로를 하나로 합쳤다(2026-09-21).
 * 전에는 여기서 결재 상태만 바꿔 점검 기록(판정·차수)이 남지 않았고, ⑤ 점검 판정과 따로 놀았다.
 * 이제 승인 = 적합, 반려 = 보완필요 판정으로 ⑤ 와 같은 함수를 부른다(차수·조치 닫힘까지 같이 움직인다).
 * 결재할 수 없는 역할(담당자)은 받지 않는다.
 */
export async function decide(form: FormData) {
  const role = String(form.get("role") || "gm");
  if (!canApprove(role)) return;
  const task_id = String(form.get("task_id") || "");
  if (!task_id) return;
  // 결재선: 총괄 승인은 부서장 확인 뒤에만(09-24). 반려는 언제든 할 수 있다.
  const yes0 = String(form.get("decision")) === "승인";
  if (yes0) {
    const ap = (await approvals()).find((a: any) => a.task_id === task_id);
    if (!ap || ap.approval_status !== "제출" || !ap.head_ok_at) return;
  }
  const yes = String(form.get("decision")) === "승인";
  const reason = String(form.get("reason") || "").trim();
  await judgeWithRound(task_id, yes ? "적합" : "보완필요", yes ? "" : (reason || "보완 필요"), who(role));
  ["/evidence", "/tasks", "/review", "/actions", "/inspections", "/status", "/"].forEach((p) => revalidatePath(p));
}


/**
 * 붙임 파일 저장 — 폼에 실제 파일이 담겨 오면 저장하고 증빙으로 한 줄씩 남긴다.
 * 휴대폰에서는 `capture="environment"` 로 카메라가 바로 열린다.
 */
async function saveAttachments(form: FormData, task_id: string, by: string) {
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    const saved = await saveFile(f);
    await addEvidence({
      task_id,
      evidence_kind: f.type.startsWith("image/") ? "사진" : "붙임 파일",
      file_name: f.name,
      by,
      file_url: saved.url, file_size: saved.size, file_type: saved.type,
      note: "현장에서 올림",
    });
  }
  return files.length;
}

/** 휴대폰 화면에서 쓰는 등록 — 사진만 올려도 이행완료·제출로 올라간다. */
export async function uploadFromPhone(form: FormData) {
  const role = String(form.get("role") || "road");
  const task_id = String(form.get("task_id") || "");
  if (!task_id) return;
  const n = await saveAttachments(form, task_id, who(role));
  const memo = String(form.get("note") || "").trim();
  if (n === 0 && !memo) return;          // 아무것도 안 올렸으면 상태를 건드리지 않는다
  if (n === 0 && memo) {
    await addEvidence({
      task_id, evidence_kind: "현장 메모", file_name: memo.slice(0, 60),
      by: who(role), note: memo,
    });
  }
  await patchTask(task_id, { status: "이행완료", approval_status: "제출" }, who(role), "현장에서 증빙 등록");
  revalidatePath("/m");
  revalidatePath("/evidence");
  revalidatePath("/review");
  revalidatePath("/");
}


/**
 * 여러 줄 증빙 등록 — 줄마다 증빙 한 건(+ 그 줄의 파일들). 다 저장한 뒤 과제를 이행완료·제출로.
 * 제목이 빈 줄은 건너뛴다(빈 줄을 증빙으로 남기지 않는다).
 */
export async function registerMany(form: FormData) {
  const role = String(form.get("role") || "gm");
  const task_id = String(form.get("task_id") || "");
  if (!task_id) return;
  const by = who(role);
  const formId = String(form.get("form_id") || "");
  const keys = String(form.get("row_keys") || "").split(",").filter(Boolean);
  let saved = 0;

  for (const k of keys) {
    const title = String(form.get(`title_${k}`) || "").trim();
    const files = form.getAll(`files_${k}`).filter((f): f is File => f instanceof File && f.size > 0);
    if (!title && files.length === 0) continue;
    const kind = String(form.get(`kind_${k}`) || "기타");
    const note = String(form.get(`note_${k}`) || "");

    if (files.length === 0) {
      await addEvidence({ task_id, evidence_kind: kind, file_name: title, form_id: saved === 0 ? formId : "", note, by });
    } else {
      for (const f of files) {
        const s2 = await saveFile(f);
        await addEvidence({
          task_id, evidence_kind: kind, file_name: title ? `${title} — ${f.name}` : f.name,
          form_id: saved === 0 ? formId : "", note, by,
          file_url: s2.url, file_size: s2.size, file_type: s2.type,
        });
      }
    }
    saved++;
  }
  if (saved === 0) return;
  await patchTask(task_id, { status: "이행완료", approval_status: "제출" }, by, `증빙 ${saved}줄 등록·제출`);
  ["/evidence", "/tasks", "/review", "/"].forEach((p) => revalidatePath(p));
}


/**
 * 부서장 확인(결재선 2단계 · 09-24) — 부서장이 자기 부서 실무자가 제출한 과제를 확인하거나 돌려보낸다.
 * 확인하면 총괄(중대재해예방팀) 승인 대기로 넘어가고, 반려하면 실무자에게 돌아간다(반려 사유 · 부서장 반려).
 */
export async function headDecide(form: FormData) {
  const role = String(form.get("role") || "");
  if (!isHead(role)) return;
  const task_id = String(form.get("task_id") || "");
  if (!task_id) return;
  const t = (await tasks({ limit: 100000 })).find((x: any) => x.task_id === task_id);
  if (!t || t.dept_id !== ROLE_DEPT[role]) return;              // 다른 부서 과제는 확인하지 않는다
  const ap = (await approvals()).find((a: any) => a.task_id === task_id);
  if (!ap || ap.approval_status !== "제출") return;
  const by = who(role);
  if (String(form.get("decision")) === "확인") {
    await patchTask(task_id, { head_ok_at: new Date().toISOString(), head_ok_by: by }, by, "부서장 확인");
  } else {
    const reason = String(form.get("reason") || "").trim() || "부서장 보완 요청";
    await patchTask(task_id, { status: "조치필요", approval_status: "반려", reject_reason: `부서장 반려 — ${reason}` }, by, "부서장 반려");
  }
  ["/evidence", "/tasks", "/status", "/"].forEach((p) => revalidatePath(p));
}

/* ── 09-26 사용자(2차): 증빙 대장 합치기 — 「다른 파일로 나누기」·「다시 묶기」 ─────────────────
 * 사용자(09-26): 「파일 이름이 같을 때는 한 줄로 묶자. 근데, 나중에 파일이 다르다는 것이 확인되면 나눠야겠지.」
 * 묶음 키(대장 줄 | 단계 파일)마다 evidence_split 표에 한 줄을 붙인다(lib/write.ts appendRow · 지우지 않음).
 * 한 키에서 가장 최근 줄이 이긴다(ledger.ts splitKeys). 총괄·관리자만 — 화면에서도 그 역할에만 단추가 보인다.
 */
export async function splitBundle(form: FormData) {
  const role = await guard("/evidence", form);
  const back0 = String(form.get("back") || "");
  const back = back0.startsWith("/evidence") ? back0 : `/evidence?role=${role}&view=ledger`;
  if (!SPLIT_ROLES.has(role)) redirect(back);
  const act = String(form.get("act") || "") === "다시 묶기" ? "다시 묶기" : "나눔";
  const keys = [...new Set(form.getAll("key").map((v) => String(v).trim()).filter((k) => k.includes("|")))];
  const by = who(role);
  let i = 0;
  for (const k of keys) {
    await appendRow(SPLIT_TABLE, {
      split_id: `ESP-${Date.now().toString(36).toUpperCase()}${i++}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      pair_key: k, act, file_name: String(form.get("file_name") || ""), at: new Date().toISOString(), by,
    }, by, act === "나눔" ? "증빙 대장 — 다른 파일로 나누기" : "증빙 대장 — 다시 묶기");
  }
  revalidatePath("/evidence");
  redirect(back);
}
