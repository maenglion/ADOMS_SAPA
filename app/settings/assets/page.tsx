// [캡처 v2] 설정 › 관리대상 관리(2026-09-23) — 기관이 관리하는 시설물·설비 대장을 더하고 뺀다.
// 관리대상 유형을 고르면 그 유형에 걸린 의무가 저절로 모인다(의무 목록·관리대상 현황에 바로 보인다).
import Link from "next/link";
import { assetSeed, assetMapSeed, depts, duties } from "@/lib/data";
import { Facts } from "@/components/Steps";
import { addAsset, removeAsset } from "../org-actions";
// 09-26 사용자: 메뉴 밖 화면 합치기 — 관리대상 현황 › 공중이용시설·공중교통수단 화면의 「등록·수정」 단추로 들어오고, 그 레이아웃·좌측 안에서 열린다
import { UsLayout, PageHead } from "@/components/us/Parts";
import { B1Side } from "../../targets/_side";

export const dynamic = "force-dynamic";

export default async function AssetAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const all = assetSeed(true);
  const live = all.filter((a) => a.deleted !== "Y");
  const gone = all.filter((a) => a.deleted === "Y");
  const map = assetMapSeed();
  const [dl, du] = await Promise.all([depts(), duties({ limit: 100000 })]);
  const dname = new Map(dl.map((d: any) => [d.dept_id, d.dept_name]));
  const tname = new Map<string, string>();
  du.forEach((d: any) => { if (d.target_code && !tname.has(d.target_code)) tname.set(d.target_code, d.target_name || d.target_code); });
  const dutyN = new Map<string, number>();
  du.forEach((d: any) => dutyN.set(d.target_code, (dutyN.get(d.target_code) || 0) + 1));
  const tOf = new Map<string, string[]>();
  map.forEach((m) => tOf.set(m.asset_id, [...(tOf.get(m.asset_id) || []), m.target_code]));
  const gbns = [...new Set(live.map((a) => a.asset_gbn).filter(Boolean))].sort();

  let rows = live;
  if (sp.q) rows = rows.filter((a) => (a.asset_name || "").includes(sp.q) || (a.addr || "").includes(sp.q));
  if (sp.g) rows = rows.filter((a) => a.asset_gbn === sp.g);
  const shown = sp.all ? rows : rows.slice(0, 15);
  const q = (o: Record<string, string | undefined>) => {
    const m: Record<string, string | undefined> = { role, q: sp.q, g: sp.g, ...o };
    return "/settings/assets?" + Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
  };
  const added = live.filter((a) => String(a.asset_id).startsWith("NEW-")).length;
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 더하기·빼기·되살리기는 총괄·관리자만(담당자에게는 목록만 보인다)
  const canEdit = role === "gm" || role === "mgr";

  return (
    <UsLayout side={<B1Side role={role} on="fc" />}>{/* 09-26 사용자: 메뉴 밖 화면 합치기 */}
      <PageHead sub="기본정보" title="관리대상 등록·수정"
        right={<Link className="usb1-btn-o" href={`/targets/basic?t=fc&role=${role}`}>← 공중이용시설·공중교통수단으로</Link>} />
      <div className="chips">
        <span className="badge">시설물·설비 대장</span>
        <span className="badge none">유형을 고르면 의무가 저절로 걸립니다</span>
      </div>
      {sp.added && <p className="badge ok" style={{ marginTop: 8 }}>더했습니다 — {sp.added}</p>}
      {sp.removed && <p className="badge warn" style={{ marginTop: 8 }}>뺐습니다 — {sp.removed} (아래 「뺀 것」에서 되살릴 수 있습니다)</p>}
      {sp.err && <p className="badge bad" style={{ marginTop: 8 }}>이름을 적어 주세요</p>}

      <Facts items={[
        { k: "관리대상(자산)", v: <b>{live.length.toLocaleString()}</b> },
        { k: "관리대상 유형 연결", v: <b>{map.length.toLocaleString()}</b> },
        { k: "기관이 더한 것", v: <b>{added}</b> },
        { k: "뺀 것", v: <b>{gone.length}</b> },
      ]} />

      {!canEdit && <p className="muted" style={{ marginTop: 8 }}>관리대상을 더하거나 빼는 일은 총괄·관리자가 합니다. 여기서는 목록만 봅니다.</p>}
      {canEdit && <details className="card fold" style={{ marginTop: 12 }} open={!!sp.err}>
        <summary>＋ 관리대상 더하기</summary>
        <form action={addAsset} className="orgform">
          <input type="hidden" name="role" value={role} />
          <label className="wide"><span>이름</span><input type="text" name="asset_name" required placeholder="예: ○○교(상행)" /></label>
          <label><span>구분</span>
            <select name="asset_gbn" defaultValue="">
              <option value="">—</option>
              {gbns.map((g) => <option key={g}>{g}</option>)}
            </select></label>
          <label><span>종별</span>
            <select name="asset_class" defaultValue="">
              {["", "1종", "2종", "3종", "기타"].map((c) => <option key={c} value={c}>{c || "—"}</option>)}
            </select></label>
          <label><span>담당 부서</span>
            <select name="dept_id" defaultValue="">
              <option value="">—</option>
              {dl.map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select></label>
          <label><span>관리대상 유형</span>
            <select name="target_code" defaultValue="">
              <option value="">— 나중에 —</option>
              {[...tname.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => (
                <option key={c} value={c}>{n} · 의무 {dutyN.get(c) || 0}</option>
              ))}
            </select></label>
          <label><span>준공일</span><input type="date" name="completed_ymd" /></label>
          <label className="wide"><span>주소</span><input type="text" name="addr" placeholder="경기도 용인시 …" /></label>
          <div><button className="btn" type="submit">더하기</button></div>
        </form>
      </details>}

      <div className="chips" style={{ marginTop: 12 }}>
        <form method="get" action="/settings/assets" style={{ display: "flex", gap: 6 }}>
          <input type="hidden" name="role" value={role} />
          <input type="text" name="q" defaultValue={sp.q || ""} placeholder="이름·주소 찾기" />
          <button className="btn ghost sm" type="submit">찾기</button>
        </form>
        <Link className={`chip ${!sp.g ? "on" : ""}`} href={q({ g: undefined })}>전체</Link>
        {gbns.map((g) => <Link key={g} className={`chip ${sp.g === g ? "on" : ""}`} href={q({ g })}>{g}</Link>)}
      </div>

      <table className="v2t" style={{ marginTop: 8 }}>
        <thead><tr><th>이름</th><th>구분</th><th className="cd">종별</th><th>담당 부서</th><th>관리대상 유형</th><th /></tr></thead>
        <tbody>
          {shown.map((a) => {
            const ts = tOf.get(a.asset_id) || [];
            return (
              <tr key={a.asset_id}>
                <td title={`${a.asset_id} · ${a.addr || ""}`}>
                  <Link href={`/targets/${a.asset_id}?role=${role}`}>{a.asset_name}</Link>
                  {String(a.asset_id).startsWith("NEW-") && <> <span className="badge ok">새로</span></>}
                </td>
                <td>{a.asset_gbn || "—"}</td>
                <td className="cd">{a.asset_class || "—"}</td>
                <td>{dname.get(a.dept_id) || a.dept_id || "—"}</td>
                <td title={ts.map((t) => tname.get(t) || t).join(" · ")}>{ts.length ? ts.map((t) => tname.get(t) || t).join(" · ") : "—"}</td>
                <td>
                  {canEdit && <form action={removeAsset}>
                    <input type="hidden" name="role" value={role} /><input type="hidden" name="asset_id" value={a.asset_id} />
                    <button className="btn ghost sm" type="submit">빼기</button>
                  </form>}
                </td>
              </tr>
            );
          })}
          {!shown.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
        </tbody>
      </table>
      {!sp.all && rows.length > 15 && <Link className="more" href={q({ all: "1" })}>전체 {rows.length.toLocaleString()}건 →</Link>}

      {gone.length > 0 && (
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>뺀 것 <span className="badge none">{gone.length}</span></summary>
          <table className="v2t"><tbody>
            {gone.map((a) => (
              <tr key={a.asset_id}>
                <td>{a.asset_name}</td><td>{a.asset_gbn || "—"}</td><td>{dname.get(a.dept_id) || "—"}</td>
                <td>
                  {canEdit && <form action={removeAsset}>
                    <input type="hidden" name="role" value={role} /><input type="hidden" name="asset_id" value={a.asset_id} />
                    <input type="hidden" name="undo" value="1" />
                    <button className="btn ghost sm" type="submit">되살리기</button>
                  </form>}
                </td>
              </tr>
            ))}
          </tbody></table>
        </details>
      )}
    </UsLayout>
  );
}
