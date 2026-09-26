// [400 · 교육자료 버전] 게시판 › 자료실 — 목록(참고 명세에 화면 없음 · 교육자료 톤으로 새로 설계)
import { BoardList } from "../_board";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <BoardList kind="files" sp={await searchParams} />;
}
