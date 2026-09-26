"use server";
// [400 · 교육자료 버전] 묶음 B2 — 법 의무사항(SCR-035) 저장. 저장할 때마다 대상별 기록 한 줄을 쌓는다(usb2_timing).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { ITEMS, records } from "./_lib";
import type { TrackKey } from "@/lib/us/tracks";

const by = (f: FormData) => ROLE_STAFF[String(f.get("role") || "gm")] || "SD01-1";
const now = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const trackOf = (f: FormData) => (["ws", "fc", "mt"].includes(String(f.get("track"))) ? String(f.get("track")) : "fc") as TrackKey;

/** 폼에서 지금 값(이행 시기 + 관계 법령 지정·시기)을 읽는다. */
function readForm(f: FormData, track: TrackKey, prevLaws: Record<string, any>) {
  const vals: Record<string, string> = {};
  for (const it of ITEMS[track]) {
    const v = String(f.get(`v_${it.id}`) || "").trim();
    if (v) vals[it.id] = v;
  }
  const laws: Record<string, { on?: boolean; when?: string; extra?: boolean }> = {};
  const n = Number(f.get("law_n") || 0);
  for (let i = 0; i < n; i++) {
    const name = String(f.get(`law_name_${i}`) || "");
    if (!name) continue;
    laws[name] = {
      on: f.get(`law_on_${i}`) === "Y",
      when: String(f.get(`law_when_${i}`) || "").trim(),
      extra: prevLaws[name]?.extra || f.get(`law_extra_${i}`) === "Y" || undefined,
    };
  }
  // 폼에 없던 추가 법령(다른 쪽에서 더한 것)은 그대로 둔다
  for (const [k, v] of Object.entries(prevLaws)) if (!(k in laws)) laws[k] = v;
  return { vals, laws };
}

async function push(f: FormData, track: TrackKey, target: string, vals: any, laws: any, hidden: string[], action: string) {
  await appendRow("usb2_timing", {
    rec_id: `T-${track}-${target}-${Date.now().toString(36)}`, track, target_id: target, saved_at: now(), by: by(f),
    vals: JSON.stringify(vals), laws: JSON.stringify(laws), hidden: hidden.join(";"),
  }, by(f), action);
  revalidatePath(`/law/${track}`);
}

/** 저장 — 같은 폼의 🗑(del)·항목 초기화(op=reset)·되살리기(op=restore) 단추도 여기로 온다
 *  (formAction 에 함수를 주면 React 가 단추의 name 을 덮어써 값이 사라지므로 한 액션에서 가른다). */
export async function saveTiming(f: FormData) {
  if (f.get("del")) return delItem(f);
  if (f.get("op") === "reset") return resetTiming(f);
  if (f.get("op") === "restore") return restoreItems(f);
  const track = trackOf(f), target = String(f.get("target") || "");
  const prev = (await records(track)).get(target);
  const { vals, laws } = readForm(f, track, prev?.laws || {});
  await push(f, track, target, vals, laws, prev?.hidden || [], "법 의무사항 이행 시기 저장");
  redirect(`/law/${track}?target=${encodeURIComponent(target)}&saved=1`);
}

/** 항목 초기화 — 값·뺀 항목·법령 지정을 모두 처음으로(기록은 지우지 않고 빈 줄을 쌓는다). */
async function resetTiming(f: FormData) {
  const track = trackOf(f), target = String(f.get("target") || "");
  await push(f, track, target, {}, {}, [], "법 의무사항 항목 초기화");
  redirect(`/law/${track}?target=${encodeURIComponent(target)}&reset=1`);
}

/** 🗑 항목 빼기 — 입력 중이던 값은 함께 저장한다. */
async function delItem(f: FormData) {
  const track = trackOf(f), target = String(f.get("target") || ""), id = String(f.get("del") || "");
  const prev = (await records(track)).get(target);
  const { vals, laws } = readForm(f, track, prev?.laws || {});
  delete vals[id];
  const hidden = [...new Set([...(prev?.hidden || []), id])];
  await push(f, track, target, vals, laws, hidden, "법 의무사항 항목 삭제");
  redirect(`/law/${track}?target=${encodeURIComponent(target)}`);
}

/** 뺀 항목 되살리기 */
async function restoreItems(f: FormData) {
  const track = trackOf(f), target = String(f.get("target") || "");
  const prev = (await records(track)).get(target);
  const { vals, laws } = readForm(f, track, prev?.laws || {});   // 화면에 입력 중이던 값도 함께 저장
  await push(f, track, target, { ...(prev?.vals || {}), ...vals }, laws, [], "법 의무사항 항목 되살림");
  redirect(`/law/${track}?target=${encodeURIComponent(target)}`);
}

/** 법령 검색 모달에서 관계 법령 하나를 이 대상에 더한다(우리 의무 목록의 법령만). */
export async function addLaw(f: FormData) {
  const track = trackOf(f), target = String(f.get("target") || ""), law = String(f.get("law") || "");
  const prev = (await records(track)).get(target);
  const laws = { ...(prev?.laws || {}), [law]: { on: true, when: "", extra: true } };
  await push(f, track, target, prev?.vals || {}, laws, prev?.hidden || [], "관계 법령 추가");
  redirect(`/law/${track}?target=${encodeURIComponent(target)}&added=1#laws`);
}
