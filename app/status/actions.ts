"use server";
/**
 * [400 · 교육자료 버전] 묶음 A — 이행현황 조치 지시 「발신」(명세 SCR-013 · 017).
 * 쓰기는 공용 appendRow 로만 한다.
 *   usa_order     — 발신 기록 한 줄(메시지 발신 목록이 읽는다). 09-24 칸 추가: channels(고른 수단 「app,sms」) · results(수단별 결과 JSON)
 *   notification  — 받는 부서 정담당에게 알림 한 줄씩(대시보드 「알림」·내 업무 알림에 뜬다) — lib/channels.ts 의 앱 알림이 쓴다
 * 문자·전자우편·카카오톡은 lib/channels.ts 가 「미발송(연결 준비 중)」만 돌려준다 — 밖으로는 아무것도 보내지 않는다.
 * ★ 이행률 계산(_lib/calc.ts)은 건드리지 않는다 — 발신은 기록과 알림만 더한다.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { staff, depts, readTable } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { sendAll, isChannel, type Channel, type Recipient } from "@/lib/channels";

const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export async function sendOrder(fd: FormData) {
  const role = String(fd.get("role") || "gm");
  const track = String(fd.get("track") || "ws");
  const back = String(fd.get("back") || "/status/industrial");
  const pick = String(fd.get("pick") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const message = String(fd.get("message") || "").trim();
  if (!pick.length || !message) redirect(back);
  // 앱 알림은 늘 보낸다 — 문자·전자우편·카카오톡은 고른 것만 더한다.
  const channels = [...new Set(["app", ...fd.getAll("channel").map(String)])].filter(isChannel) as Channel[];

  const by = ROLE_STAFF[role] || "SD01-1";
  const st = await staff();
  const dn = new Map((await depts()).map((d: any) => [d.dept_id, String(d.dept_name)]));
  const from = st.find((s: any) => s.staff_id === by)?.display_name || by;
  const order_id = newId("USAO");

  // 받는 부서마다 정담당(없으면 그 부서 첫 사람) 한 명
  const to: Recipient[] = [];
  for (const dept of pick) {
    const p: any = st.find((s: any) => s.dept_id === dept && s.duty_role === "정담당") || st.find((s: any) => s.dept_id === dept);
    if (!p) continue;
    to.push({ staff_id: p.staff_id, name: p.display_name, dept_id: dept, dept_name: dn.get(dept) || dept, email: p.email || "", phone: p.phone || "" });
  }

  const results = await sendAll({ msg_id: order_id, notif_type: "조치 지시", from_staff_id: by, from_name: from, body: message, to }, channels);

  await appendRow("usa_order", {
    order_id, sent_at: new Date().toISOString(), from_staff_id: by, from_name: from, track,
    to_dept_ids: pick.join(","), to_names: String(fd.get("names") || ""), to_owners: String(fd.get("owners") || ""),
    rates: String(fd.get("rates") || ""), message,
    channels: channels.join(","),
    results: JSON.stringify(Object.fromEntries(results.map((r) => [r.channel, r.status]))),
  }, by, "조치 지시 발신");

  ["/", "/status/industrial", "/status/civil", "/tasks"].forEach((p) => revalidatePath(p));
  const u = new URL(back, "http://x");
  u.searchParams.set("modal", "sent");
  u.searchParams.set("ok", String(to.length));
  const pend = results.filter((r) => !r.ok && r.channel !== "app").map((r) => r.label);
  if (pend.length) u.searchParams.set("pend", pend.join("·"));
  redirect(`${u.pathname}?${u.searchParams.toString()}`);
}

/**
 * 받은 조치 지시 「읽음 확인」 — notification.read_at 을 채운다(공용 patchRow). 자기에게 온 알림만.
 * 발신 쪽 「메시지 발신 목록」의 읽음 수가 이것으로 오른다.
 */
export async function markRead(fd: FormData) {
  const role = String(fd.get("role") || "gm");
  const id = String(fd.get("notif_id") || "");
  const back = String(fd.get("back") || `/tasks?role=${role}`);
  const me = ROLE_STAFF[role] || "";
  const n = (await readTable("notification", "notif_id")).find((r) => r.notif_id === id);
  if (n && me && n.to_staff_id === me && !n.read_at) {
    await patchRow("notification", "notif_id", id, { read_at: new Date().toISOString() }, me, "조치 지시 읽음 확인");
  }
  ["/", "/tasks", "/status/industrial", "/status/civil"].forEach((p) => revalidatePath(p));
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : `/tasks?role=${role}`);
}
