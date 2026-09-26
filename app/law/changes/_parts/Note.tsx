/** 법령 화면(안전·보건 관계 법령 · 관계 법령 관리) 위에 붙는 한 줄 — 최근 개정 확인 결과로 가는 길(09-24). */
import Link from "next/link";
import { lawChanges } from "@/lib/data";
import { listRuns } from "@/lib/lawsync";

export default async function LawChangeNote({ role }: { role: string }) {
  const r = listRuns().filter((x) => !x.run_id.includes("TEST"))[0];
  const n = (await lawChanges()).length;
  return (
    <div className="lsx-box" style={{ margin: "4px 0 10px", padding: "8px 14px" }}>
      <span>법령 개정 이력 <b>{n.toLocaleString()}</b>건{r ? <> · 마지막 확인 {r.started_at.slice(0, 16)}({r.state})</> : " · 아직 자동 확인 전"}</span>
      <Link className="us-btn-s" href={`/law/changes?role=${role}`}>법령 개정 현황 →</Link>
    </div>
  );
}
