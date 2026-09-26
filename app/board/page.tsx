// [400 · 교육자료 버전] 게시판 첫 화면 — 공지사항으로 보낸다.
import { redirect } from "next/navigation";

export default async function BoardHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  redirect(`/board/notice?role=${sp.role || "gm"}`);
}
