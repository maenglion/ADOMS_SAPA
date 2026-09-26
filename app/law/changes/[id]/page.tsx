// [400 · 교육자료 버전] 법령 개정 한 건 — 바뀐 조문(옛/새 본문) · 우리 의무 영향 · 반영 상태 (2026-09-24)
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { lawChanges, depts } from "@/lib/data";
import { runItems, decisions } from "@/lib/lawsync";
import LawChangeSide from "../_parts/Side";
import { ACTION_LABEL } from "../_parts/labels";

export const dynamic = "force-dynamic";

export default async function LawChangeOne({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const c: any = (await lawChanges()).find((x: any) => x.change_id === decodeURIComponent(id));
  const dn = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  if (!c) return <UsLayout side={<LawChangeSide page="changes" role={role} />}><p>개정 기록을 찾지 못했습니다. <Link href="/law/changes">목록</Link></p></UsLayout>;
  const dec = await decisions();
  const items = c.run_id ? runItems(c.run_id).filter((x) => x.title === c.doc) : [];
  const main = items.filter((x) => x.action !== "참고");
  const ref = items.filter((x) => x.action === "참고");
  const deptText = (s: string) => String(s || "").split(";").filter(Boolean).map((d) => dn.get(d) || d).join(" · ");

  return (
    <UsLayout side={<LawChangeSide page="changes" role={role} />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">{c.law}</span> {c.doc}</h1>
      </div>
      <table className="us-tbl lsx-info">
        <tbody>
          <tr><th>구분</th><td>{c.changed_kind}</td><th>공포</th><td>{String(c.promulgated_at || "-").slice(0, 10)}</td><th>시행</th><td>{String(c.effective_at || "-").slice(0, 10)}</td></tr>
          <tr><th>우리 의무 영향</th><td>{Number(c.affected_duty_cnt || 0).toLocaleString()}건</td><th>바뀐 조문</th>
            <td>{c.run_id ? `본문 변경 ${c.changed_units || 0} · 새 조문 ${c.new_units || 0} · 삭제 ${c.removed_units || 0}` : "-"}</td><th>확인</th><td>{c.note || "-"}</td></tr>
        </tbody>
      </table>

      {!c.run_id && <p className="us-muted">이 개정은 자동 확인 이전에 등록된 기록입니다(조문별 대조 없음).</p>}
      {main.length > 0 && <h2 className="lsx-h2">확인할 조문 {main.length}곳</h2>}
      {main.map((x) => {
        const d = dec.get(x.item_id);
        return (
          <div key={x.item_id} className="lsx-item">
            <div className="lsx-item-h">
              <b>{x.label || x.unit_path || "문서 전체"}</b>
              <span className="lsx-tag">{ACTION_LABEL[x.action] || x.action}</span>
              {x.effective && <span className="us-muted">시행 {x.effective}</span>}
              <span className={`lsx-st ${d ? "ok" : x.needs_human === "Y" ? "wait" : "ok"}`}>{d ? `${d.decision}(${String(d.at).slice(0, 10)})` : x.needs_human === "Y" ? "담당 확인 중" : "반영됨"}</span>
            </div>
            {x.duty_keys && <div className="lsx-duty">우리 의무: {String(x.duty_keys).split(";").map((k: string) => <Link key={k} href={`/duties/${k}`}>{k}</Link>)} {x.depts && <>· 담당 {deptText(x.depts)}</>}{x.task_n ? ` · 과제 ${x.task_n}` : ""}</div>}
            {!x.duty_keys && x.prop_depts && <div className="lsx-duty">검토 부서: {deptText(x.prop_depts)}{x.prop_assets ? ` · 관련 관리대상 ${x.prop_assets}곳` : ""}</div>}
            {x.note && x.kind !== "법령" && <div className="us-muted">{x.note}</div>}
            {(x.old_text || x.new_text) && (
              <div className="lsx-diff">
                <div><div className="lsx-dh">개정 전</div><div className="lsx-dt">{x.old_text || "(없던 조문)"}</div></div>
                <div><div className="lsx-dh">개정 후</div><div className="lsx-dt">{x.new_text || "(현행 원문에 없음)"}</div></div>
              </div>
            )}
          </div>
        );
      })}
      {ref.length > 0 && (
        <details className="lsx-ref"><summary>참고 — 의무 문장이 아닌 변경 {ref.length}곳</summary>
          <ul>{ref.map((x) => <li key={x.item_id}><b>{x.label || x.unit_path}</b> {String(x.new_text || x.old_text || x.note).slice(0, 120)}</li>)}</ul>
        </details>
      )}
      <p><Link className="us-btn-s" href={`/law/changes?role=${role}`}>목록</Link></p>
    </UsLayout>
  );
}
