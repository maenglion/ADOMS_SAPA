import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 09-26 사용자: 메뉴 밖 화면 합치기 — /qr(휴대폰 접속 안내)은 처리 현황의 「휴대폰으로 열기」 칸으로 옮겼다.
//   옛 주소로 들어오면 그 칸으로 보낸다(role 유지 · ?big=1 은 크게 띄우기로).
//   옛 화면 코드 = 04_앱\_백업_메뉴밖화면합치기_20260926\app\qr\page.tsx · 새 자리 = app\tasks\_parts\PhoneBox.tsx
export default async function QrPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  // 09-26 사용자: 「ADOMS는 점검을 실제로 하는 앱이 아니니 휴대폰 현장 등록 기능은 다 빼자」 — 옛 주소는 처리 현황으로만 보낸다
  redirect(`/tasks?role=${sp.role || "gm"}`);
}
