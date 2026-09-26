// [400 · 교육자료 버전] 게시판 › 자료실 — 상세
import { BoardView } from "../../_board";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  return <BoardView kind="files" id={decodeURIComponent(id)} sp={await searchParams} />;
}
