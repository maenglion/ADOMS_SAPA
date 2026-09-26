// [400 · 교육자료 버전] 게시판 › 공지사항 — 글쓰기(첨부 파일 실제 저장)
import { BoardForm } from "../../_board";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <BoardForm kind="notice" sp={await searchParams} />;
}
