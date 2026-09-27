// [400 · 교육자료 버전] 법령 개정 현황 · 이력 (2026-09-24 추가 화면 — 교육자료에는 없는 화면)
//  매일 「오늘 개정 확인」 → 관계법령 전체를 법제처에서 확인 → 바뀐 조문을 우리 기관 의무·관리대상과 맞대 반영한다.
//  이용자에게는 「개정 현황 · 우리 의무 영향 · 반영 상태」만 보인다(뒤에서 도는 작업의 기록은 관리자 「자동 확인 작업 기록」).
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { lawChanges } from "@/lib/data";
import { listRuns, runItems, decisions, appliedRuns } from "@/lib/lawsync";
import LawChangeSide from "./_parts/Side";
import AutoRefresh from "./_parts/AutoRefresh";
import { startCheck } from "./actions";
import { Count, Note } from "../../admin/_ui";
import { ACTION_LABEL } from "./_parts/labels";

export const dynamic = "force-dynamic";

const d10 = (s: string) => String(s || "").slice(0, 10);

export default async function LawChanges({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const can = role === "gm" || role === "mgr";
  const runs = listRuns().filter((r) => !r.run_id.includes("TEST"));
  const cur = runs.find((r) => r.run_id === sp.run) || runs[0];
  const running = runs.find((r) => r.state === "진행 중");
  const [lcs, dec, applied] = await Promise.all([lawChanges(), decisions(), appliedRuns()]);
  const openOf = new Map<string, number>();
  for (const r of runs.filter((x) => applied.has(x.run_id))) {
    for (const it of runItems(r.run_id)) {
      if (it.needs_human !== "Y" || dec.has(it.item_id)) continue;
      const k = `${r.run_id}|${it.title}`;
      openOf.set(k, (openOf.get(k) || 0) + 1);
    }
  }
  const stateOf = (c: any) => {
    if (!c.run_id) return { t: "반영됨", cls: "ok" };
    const n = openOf.get(`${c.run_id}|${c.doc}`) || 0;
    return n ? { t: `담당 확인 중 ${n}`, cls: "wait" } : { t: "반영됨", cls: "ok" };
  };
  const q = (sp.q || "").trim();
  const rows = lcs.filter((c: any) => !q || `${c.law} ${c.doc}`.includes(q));

  return (
    <UsLayout side={<LawChangeSide page="changes" role={role} />}>
      <AutoRefresh on={!!running} />
      <div className="us-head usb2-head">
        <h1 className="us-h1">법령 개정 현황 · 이력</h1>
      </div>
      {sp.ok === "start" && <Note>개정 확인을 시작했습니다. 끝나면 이 화면에 결과가 반영됩니다.</Note>}

      <div className="lsx-box">
        <div className="lsx-box-l">
          <div className="lsx-t">관계법령 개정 확인</div>
          <div className="us-muted">
            {cur ? <>마지막 확인 <b>{d10(cur.started_at)}</b> {cur.started_at.slice(11, 16)} · 기준일 {cur.asof} · 관계법령 {Number(cur.summary?.["관계법령"] || 0).toLocaleString()}건 ·
              {" "}{cur.state === "완료" ? <>개정 {Number(cur.summary?.["개정 법령"] || 0) + Number(cur.summary?.["개정 행정규칙"] || 0)}건 · 시행 판 겹침 {cur.summary?.["판 겹침"] || 0}건</> : cur.state}</> : "아직 확인한 적이 없습니다"}
          </div>
        </div>
        {can && (
          <form action={startCheck}>
            <input type="hidden" name="role" value={role} />
            <button className="usb2-obtn lsx-go" disabled={!!running}>{running ? "확인 중…" : "오늘 개정 확인"}</button>
          </form>
        )}
      </div>

      {running && (
        <div className="lsx-prog">
          {running.steps.map((s) => (
            <div key={s.key} className={`lsx-step ${s.state === "완료" ? "done" : s.state === "진행 중" ? "on" : ""}`}>
              <b>{s.name.replace(/^[①-⑤]\s*/, "")}</b>
              <span>{s.state === "진행 중" && s.total ? `${s.done}/${s.total}` : s.state}</span>
            </div>
          ))}
        </div>
      )}

      <form method="get" action="/law/changes" className="usb2-cntrow">
        <input type="hidden" name="role" value={role} />
        <Count n={rows.length} unit="건" />
        <div className="us-flex">
          <input type="text" name="q" defaultValue={q} placeholder="법령명" className="lsx-q" />
          <button className="usb2-sbtn us-search-btn" type="submit">검색</button>
        </div>
      </form>
      <table className="us-tbl usb2-click">
        <thead>
          <tr><th>법령</th><th>개정 문서</th><th style={{ width: 110 }}>구분</th><th style={{ width: 110 }}>공포</th><th style={{ width: 110 }}>시행</th>
            <th style={{ width: 110 }}>우리 의무 영향</th><th style={{ width: 140 }}>반영 상태</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((c: any) => {
            const s = stateOf(c);
            return (
              <tr key={c.change_id}>
                <td>{c.law}</td>
                <td><Link href={`/law/changes/${encodeURIComponent(c.change_id)}?role=${role}`}>{c.doc}</Link></td>
                <td className="c">{c.changed_kind}</td>
                <td className="c">{d10(c.promulgated_at) || "-"}</td>
                <td className="c">{d10(c.effective_at) || "-"}</td>
                <td className="c">{Number(c.affected_duty_cnt || 0).toLocaleString()}건</td>
                <td className="c"><span className={`lsx-st ${s.cls}`}>{s.t}</span></td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={7} className="c usb2-empty">개정 이력이 없습니다</td></tr>}
        </tbody>
      </table>

      <h2 className="lsx-h2">확인 이력</h2>
      <table className="us-tbl">
        <thead><tr><th style={{ width: 170 }}>확인 일시</th><th style={{ width: 110 }}>기준일</th><th>확인한 관계법령</th><th>개정 발견</th><th style={{ width: 110 }}>상태</th></tr></thead>
        <tbody>
          {runs.slice(0, 15).map((r) => (
            <tr key={r.run_id}>
              <td className="c">{r.started_at.slice(0, 16)}</td>
              <td className="c">{r.asof}</td>
              <td>법령 {r.summary?.["법령"] ?? "-"} · 행정규칙 {r.summary?.["행정규칙"] ?? "-"}</td>
              <td>개정 법령 {r.summary?.["개정 법령"] ?? 0} · 개정 행정규칙 {r.summary?.["개정 행정규칙"] ?? 0} · 바뀐 조문 {r.summary?.["변경 조항호목"] ?? 0}</td>
              <td className="c">{r.state}{applied.has(r.run_id) ? "·반영" : ""}</td>
            </tr>
          ))}
          {!runs.length && <tr><td colSpan={5} className="c usb2-empty">아직 확인한 적이 없습니다</td></tr>}
        </tbody>
      </table>
    </UsLayout>
  );
}
