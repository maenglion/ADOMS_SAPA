import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** 보기 모드 전환 — 내부 검토 ↔ 시연(현장). 서버 액션으로 쿠키를 바꾼다. */
export default async function ModeSwitch() {
  const demo = (await cookies()).get("adoms-mode")?.value === "demo";

  async function toggle() {
    "use server";
    const c = await cookies();
    const now = c.get("adoms-mode")?.value === "demo";
    c.set("adoms-mode", now ? "internal" : "demo", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    revalidatePath("/", "layout");
  }

  return (
    <form action={toggle} className="fs-switch">
      <span>보기</span>
      <button type="submit" className={demo ? "on" : ""} title="현장 모드에서는 내부 검토용 표시를 감춥니다">
        {demo ? "현장" : "내부 검토"}
      </button>
    </form>
  );
}
