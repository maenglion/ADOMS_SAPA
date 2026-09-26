"use server";
/**
 * [400 · 교육자료 버전] 묶음 F — 이행점검 쓰기(SCR-089 취합 시작 · SCR-088 판정 저장 · SCR-090 결재).
 * 쓰기는 공용 appendRow·patchRow 로만 한다. 표: usf_round(취합 회차) · usf_judge(항목별 판정) · notification(조치 요구 알림).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { staff, type Row } from "@/lib/data";
import { ROLE_STAFF, canApprove } from "@/lib/roles";
import { ymd } from "@/lib/day";
import { isTrack, itemsOf, NAME, roundOf, cellsOfRound, splitIds, newId, deptsOf, SYM, halfOf } from "../_lib";

const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const nowIso = () => new Date().toISOString();

/** 부서 정담당(없으면 부담당) — 조치 요구 알림을 받는 사람. */
async function ownerOf(deptId: string) {
  const st = await staff();
  const p = st.find((s: Row) => s.dept_id === deptId && s.duty_role === "정담당") || st.find((s: Row) => s.dept_id === deptId);
  return p?.staff_id || "";
}

/** SCR-089 취합 시작 — 고른 (사업장·부서 × 항목)으로 회차를 만들고 항목별 점검(SCR-088)으로 간다. */
export async function startRound(f: FormData) {
  const track = String(f.get("track") || "ws");
  const role = String(f.get("role") || "gm");
  if (!isTrack(track)) return;
  const valid = new Set((await deptsOf(track)).map((d) => d.dept_id));
  const deptIds = f.getAll("dept").map(String).filter((d) => valid.has(d));
  const keys = new Set(itemsOf(track).map((i) => i.key));
  const itemKeys = f.getAll("item").map(String).filter((k) => keys.has(k));
  if (!deptIds.length || !itemKeys.length) {
    redirect(`/check/${track}?role=${role}&err=${!deptIds.length ? "dept" : "item"}`);
  }
  const round_id = newId(`R${track.toUpperCase()}`);
  await appendRow("usf_round", {
    round_id, track, title: `${ymd().slice(0, 4)}년 ${halfOf()} 이행점검(${NAME[track]})`,
    dept_ids: deptIds.join(";"), item_keys: itemKeys.join(";"),
    status: "점검중", created_by: who(role), created_at: nowIso(),
    approved_by: "", approved_at: "", approve_note: "",
  }, who(role), `이행점검 취합 시작 — ${NAME[track]}`);
  revalidatePath(`/check/${track}`);
  redirect(`/check/${track}/review?role=${role}&r=${round_id}`);
}

/**
 * SCR-088 판정 저장 — 한 항목(아코디언 하나)의 부서별 상태·점검내용.
 * 바뀐 줄만 usf_judge 에 새로 더한다. 보완필요·미이행으로 바뀌면(또는 점검내용이 바뀌면) 부서 담당자에게 조치 요구 알림을 남긴다.
 */
export async function saveItem(f: FormData) {
  const track = String(f.get("track") || "ws");
  const role = String(f.get("role") || "gm");
  const r = String(f.get("r") || "");
  const item = String(f.get("item") || "");
  if (!isTrack(track) || !canApprove(role)) return;
  const round = await roundOf(track, r);
  if (!round || round.round_id !== r || round.status === "결재완료") return;
  const it = itemsOf(track).find((i) => i.key === item);
  if (!it) return;
  const { cells } = await cellsOfRound(track, round);
  const by = who(role);
  const at = nowIso();
  let n = 0;
  for (const d of splitIds(round.dept_ids)) {
    const c = cells.get(`${item}|${d}`);
    if (!c) continue;
    const st = String(f.get(`st_${d}`) || c.status);
    const cm = String(f.get(`cm_${d}`) || "").trim().slice(0, 300);
    const same = c.judged && c.judged.status === st && String(c.judged.comment || "") === cm;
    if (same) continue;
    // 판정 전 칸이 제안값 그대로·점검내용 없음이면 판정으로 남기지 않는다(자료 기준 제안 유지)
    if (!c.judged && st === c.proposed && !cm) continue;
    await appendRow("usf_judge", {
      judge_id: newId("JDG"), round_id: r, track, item_key: item, dept_id: d,
      status: st, comment: cm, proposed: c.proposed, basis: c.basis,
      judged_by: by, judged_at: at,
    }, by, `이행점검 판정 — ${st}`);
    n++;
    if (st === "보완필요" || st === "미이행") {
      const to = await ownerOf(d);
      await appendRow("notification", {
        notif_id: newId("NTF"), task_id: "", notif_type: "조치요구",
        to_staff_id: to, from_staff_id: by, sent_at: ymd(),
        message: `[이행점검 조치요구 · ${NAME[track]}] ${it.no}. ${it.label} — ${st}${cm ? `: ${cm}` : ""}`,
        read_at: "", action_id: "", batch_id: r, note: "이행점검",
      }, by, "알림 보냄 — 이행점검 조치요구");
    }
    await new Promise((res) => setTimeout(res, 2));
  }
  revalidatePath(`/check/${track}/review`);
  revalidatePath(`/check/${track}/summary`);
  redirect(`/check/${track}/review?role=${role}&r=${r}&open=${item}&saved=${n}#${item}`);
}

/**
 * SCR-090 결재하기 — 회차를 확정한다. 결재 뒤에는 판정을 고칠 수 없다.
 * 판정 없이 자료 기준으로 △·X 가 된 칸은 알림이 나간 적이 없으므로 부서별로 한 번 묶어 조치 요구를 보낸다.
 */
export async function approveRound(f: FormData) {
  const track = String(f.get("track") || "ws");
  const role = String(f.get("role") || "gm");
  const r = String(f.get("r") || "");
  if (!isTrack(track) || !canApprove(role)) return;
  const round = await roundOf(track, r);
  if (!round || round.round_id !== r || round.status === "결재완료") return;
  const by = who(role);
  const note = String(f.get("approve_note") || "").trim().slice(0, 300);
  // 09-26 사용자: 옛 점검 화면 합치기 — 점검 방식(옛 회차 결재에서 옮김). 위탁이면 기관·보고받은 날이 있어야 결재한다
  //   (중대재해처벌법 시행령 제5조제2항제1호 · 제9조제2항제1호 · 제11조제2항제1호). 값은 이행점검 회차 표(usf_round)에 함께 적는다.
  const method = String(f.get("insp_method") || "직접 점검") === "위탁 점검" ? "위탁 점검" : "직접 점검";
  const org = String(f.get("outsource_org") || "").trim().slice(0, 100);
  const reportAt = String(f.get("report_received_at") || "").trim().slice(0, 10);
  if (method === "위탁 점검" && (!org || !reportAt)) {
    redirect(`/check/${track}/summary?role=${role}&r=${r}&modal=approve&err=${!org ? "org" : "report"}`);
  }
  const { items, cells } = await cellsOfRound(track, round);
  const byDept = new Map<string, string[]>();
  for (const c of cells.values()) {
    if (c.judged || (c.status !== "보완필요" && c.status !== "미이행")) continue;
    const it = items.find((i) => i.key === c.item);
    const a = byDept.get(c.dept) || [];
    a.push(`${it?.no}. ${it?.label}(${SYM[c.status]})`);
    byDept.set(c.dept, a);
  }
  await patchRow("usf_round", "round_id", r, {
    status: "결재완료", approved_by: by, approved_at: nowIso(), approve_note: note,
    insp_method: method, outsource_org: method === "위탁 점검" ? org : "", report_received_at: method === "위탁 점검" ? reportAt : "",   // 09-26 사용자: 옛 점검 화면 합치기
  }, by, `이행점검 결재 — ${NAME[track]}`);
  for (const [d, list] of byDept) {
    await appendRow("notification", {
      notif_id: newId("NTF"), task_id: "", notif_type: "조치요구",
      to_staff_id: await ownerOf(d), from_staff_id: by, sent_at: ymd(),
      message: `[이행점검 결재완료 · ${NAME[track]}] 조치 필요 ${list.length}건 — ${list.join(", ")}`,
      read_at: "", action_id: "", batch_id: r, note: "이행점검",
    }, by, "알림 보냄 — 이행점검 결재 조치요구");
    await new Promise((res) => setTimeout(res, 2));
  }
  revalidatePath(`/check/${track}/summary`);
  redirect(`/check/${track}/summary?role=${role}&r=${r}&done=1`);
}
