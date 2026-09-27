// [400 · 교육자료 버전] SCR-027 관리대상 현황 › 기본정보 — 관리대상 선택(사업장 · 공중이용시설·공중교통수단 · 원료·제조물)
// 명세 이미지 027: 소제목 「기본정보」 + 큰 제목 → 회색 검색 패널(대상구분 · 검색조건 · 입력현황) → 목록 표.
// 공중이용시설·공중교통수단 · 원료·제조물 목록은 명세에 그림이 없어 「같은 구조」(명세 구현 메모)로 만들었다.
import Link from "next/link";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { B1Side } from "../_side";
import {
  trackKey, TRACK_LABEL, workplace, wsDepts, staffMap, basics, J, fcTargets, mtTargets, FACILITY_TYPES, TRANSPORT, deptNames,
  workplaces, workSites, WP_KINDS,
} from "../_lib";
import { tasks } from "@/lib/data";
import { canAccess } from "@/lib/perm";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";
const PAGE = 20;

export default async function BasicList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const t = trackKey(sp.t);
  const q = (sp.q || "").trim();
  const st = sp.st || "";   // "" 전체 · "0" 미입력 · "1" 입력
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ t, role });
    const m: Record<string, string | undefined> = { k: sp.k, f: sp.f, qs: sp.qs, q: sp.q, st: sp.st, v: sp.v, wk: sp.wk, ...o };
    Object.entries(m).forEach(([k, v]) => v && p.set(k, v));
    return `/targets/basic?${p.toString()}`;
  };

  const recs = (await basics()).filter((r) => r.track === t);
  const latest = new Map<string, any>();
  [...recs].sort((a, b) => (a.base_date < b.base_date ? -1 : 1)).forEach((r) => latest.set(r.target_id, r));
  const dn = await deptNames();
  const { ownerOf } = await staffMap();

  let head: string[] = [];
  let rows: { id: string; cells: React.ReactNode[]; done: boolean }[] = [];
  let unit = "";
  let radioLabel = "대상구분";
  let radios: { v: string; label: string }[] = [];
  let cur = "";
  let qsOpts: string[] = [];
  let ph = "";
  let extraFilter: React.ReactNode = null;

  let wsSites: React.ReactNode = null;
  if (t === "ws") {
    const wp = await workplace();
    // 09-24 사용자: 사업장 20곳을 먼저 보인다(부서 보기는 라디오로)
    const k = sp.k === "dept" ? "dept" : "wp";
    cur = k;
    radios = [{ v: "wp", label: "사업장" }, { v: "dept", label: "부서(용인시청 본청)" }];
    qsOpts = k === "dept" ? ["전체", "부서명", "담당자"] : ["전체", "사업장명", "주소"];
    ph = k === "dept" ? "부서명을 입력하세요" : "사업장명을 입력하세요";
    const ds = await wsDepts(role);
    if (k === "dept") {
      unit = "부서";
      head = ["사업장명", "부서명", "주소", "담당자"];
      rows = ds.map((d) => {
        const r = latest.get(d.dept_id);
        const w0 = J<{ name: string }[]>(r?.workers, [])[0];
        return {
          id: d.dept_id, done: !!r,
          cells: [wp.wp_name, d.dept_name, r?.addr || wp.addr, w0?.name || ownerOf(d.dept_id)],
          _q: { 부서명: d.dept_name, 담당자: w0?.name || ownerOf(d.dept_id) },
        } as any;
      });
    } else {
      unit = "사업장";
      // 사업장 20곳(전부 확인필요). 이행 과제는 본청(부서 단위)에만 있다 — 나머지 19곳은 「과제 없음」
      head = ["구분", "사업장명", "주소", "같은 부지 · 묶임", "현업 여부", "이행 과제", "확인 상태"];
      const wk = sp.wk || "";
      extraFilter = (
        <select name="wk" defaultValue={wk} className="usb1-sel" title="사업장 구분">
          <option value="">구분 전체</option>
          {WP_KINDS.map((x) => <option key={x}>{x}</option>)}
        </select>
      );
      const wps = (await workplaces()).filter((w) => !wk || w.wp_kind === wk);
      const dsIds = new Set(ds.map((d) => d.dept_id));
      const iTasks = (await tasks({ limit: 100000 })).filter((x) => x.area === "I" && dsIds.has(x.dept_id)).length;
      rows = wps.map((w) => {
        const r = latest.get(w.wp_id);
        const hq = w.wp_id === wp.wp_id;
        return {
          id: w.wp_id, done: !!r,
          cells: [
            w.wp_kind || "-", w.wp_name,
            r?.addr || w.addr || <span key="a" className="usb1-muted" title={w.addr_note || ""}>확인 필요</span>,
            <span key="s" className="usb1-wp-note">{w.site_note || "-"}</span>,
            <span key="f" className="usb1-wp-field" title={w.field_basis || ""}>{w.field_work || "-"}{w.field_basis === "추정" || String(w.field_basis).startsWith("추정") ? <small> (추정)</small> : null}</span>,
            hq ? <span key="t">{ds.length}개 부서 · {iTasks.toLocaleString()}건</span> : <span key="t" className="usb1-muted">과제 없음</span>,
            <span key="c" className="usb1-sapa q">{w.confirm_state === "확인필요" ? "확인 필요" : w.confirm_state || "확인 필요"}</span>,
          ],
          _q: { 사업장명: w.wp_name, 주소: w.addr },
        } as any;
      });
      // 소속 근무 장소 76곳 — 사업장별로 묶은 목록(의무·과제 없음)
      const sites = await workSites();
      const allWp = await workplaces();
      const groupsWs: { wp: string; kind: string; list: any[] }[] = [];
      for (const s of sites) {
        const g = groupsWs.find((x) => x.wp === s.wp_id && x.kind === s.site_kind);
        if (g) g.list.push(s); else groupsWs.push({ wp: s.wp_id, kind: s.site_kind, list: [s] });
      }
      const wpName = new Map(allWp.map((w) => [w.wp_id, w.wp_name]));
      wsSites = sites.length ? (
        <section className="usb1-sites">
          <h2 className="usb1-sec">소속 근무 장소 <b>{sites.length}</b>곳</h2>
          <p className="usb1-note">
            도서관 · 보건지소 · 보건진료소 · 읍·면·동 행정복지센터처럼 작은 근무 장소는 그곳을 맡는 사업장 아래에 목록으로만 둡니다.
            의무와 이행 과제는 붙이지 않았습니다. 어느 사업장에 넣을지는 용인시 확인이 필요합니다.
          </p>
          <table className="us-tbl usb1-sites-t">
            <thead><tr><th>사업장</th><th>근무 장소 구분</th><th>곳</th><th>근무 장소</th></tr></thead>
            <tbody>
              {groupsWs.map((g) => (
                <tr key={`${g.wp}:${g.kind}`}>
                  <td className="c"><Link href={`/targets/basic/${encodeURIComponent(g.wp)}?t=ws&role=${role}`}>{wpName.get(g.wp) || g.wp}</Link></td>
                  <td className="c">{g.kind}</td>
                  <td className="c">{g.list.length}</td>
                  <td className="usb1-sites-l">
                    {g.list.map((s) => (
                      <span key={s.site_id} title={[s.addr, s.org_note].filter(Boolean).join(" · ")}>
                        {s.src_url ? <a href={s.src_url} target="_blank" rel="noreferrer">{s.site_name}</a> : s.site_name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null;
    }
  } else if (t === "fc") {
    radioLabel = "시설구분";
    cur = sp.k || "전체";
    radios = [...FACILITY_TYPES.map((x) => ({ v: x, label: x })), { v: TRANSPORT, label: TRANSPORT }];
    qsOpts = ["시설물명", "주소"];
    ph = "시설물명을 입력하세요";
    unit = "개소";
    head = ["시설구분", "시설물명", "부서명", "주소", "담당자", "관리주체", "관리 근거 법령", "중대시민재해"];
    const v = sp.v || "";
    const sj = sp.sj || "전체";   // 09-24 다른 기관·관리주체 미확인 시설은 데이터에서 뺐다(ops_v1.9) — 남은 것은 용인시 · 용인도시공사
    // 명세에 없는 추가 — 중대시민재해 판정(자산 대장 sapa_l2_result)으로 거르기
    extraFilter = (
      <>
        <select name="sj" defaultValue={sj} className="usb1-sel" title="관리주체">
          <option value="전체">관리주체 전체</option><option value="용인시">용인시</option><option value="용인도시공사">용인도시공사</option>
        </select>
        <select name="v" defaultValue={v} className="usb1-sel" title="중대시민재해 판정">
          <option value="">판정 전체</option><option>해당</option><option>검토필요</option><option>제외</option>
        </select>
      </>
    );
    let all = await fcTargets(role);
    if (cur !== "전체") all = all.filter((a) => a.bucket === cur);
    if (v) all = all.filter((a) => a.sapa === v);
    if (sj !== "전체") all = all.filter((a) => (a.subj || "용인시") === sj);
    rows = all.map((a) => ({
      id: a.id, done: latest.has(a.id),
      cells: [a.gbn, a.name, dn.get(a.dept_id) || "", a.addr, J<{ name: string }[]>(latest.get(a.id)?.workers, [])[0]?.name || ownerOf(a.dept_id),
        <span key="j" title={a.subj_name || ""}>{a.subj === "타기관" ? (a.subj_name || "다른 기관") : a.subj || "용인시"}{a.consign ? <small className="usb1-cons"> 위탁</small> : null}</span>,
        <span key="l" className="usb1-laws" title={a.mlaws || ""}>{a.mlaws ? a.mlaws.split(" · ")[0] : "-"}{a.mlaws && a.mlaws.includes(" · ") ? <small> 외</small> : null}</span>,
        a.mclass === "관계법령 관리시설" ? <span key="s" className="usb1-sapa r" title={a.sapa_basis || ""}>관계법령 관리시설</span> :
        a.consign ? <span key="s" className="usb1-sapa c" title="소유·위탁 관계 확인 필요">위탁 시설 · 확인 필요</span> :
        <span key="s" className={`usb1-sapa ${a.sapa === "해당" ? "y" : a.sapa === "제외" ? "n" : "q"}`}>{a.sapa || "-"}</span>],
      _q: { 시설물명: a.name, 주소: a.addr },
    } as any));
  } else {
    radioLabel = "해당 여부";
    cur = sp.k || "전체";
    radios = ["전체", "해당", "확인 필요", "비해당"].map((x) => ({ v: x, label: x }));
    qsOpts = ["품목명", "관계 법령"];
    ph = "품목명을 입력하세요";
    unit = "품목";
    head = ["품목명", "부서명", "관계 법령", "담당자", "해당 여부"];
    let all = await mtTargets(role);
    if (cur !== "전체") all = all.filter((m) => (m.verdict || "확인 필요") === cur);
    rows = all.map((m) => ({
      id: m.item_id, done: latest.has(m.item_id),
      cells: [m.item_name, dn.get(m.dept_id) || "", m.related_law || "-", J<{ name: string }[]>(latest.get(m.item_id)?.workers, [])[0]?.name || ownerOf(m.dept_id),
        <span key="v" className={`usb1-sapa ${m.verdict === "해당" ? "y" : m.verdict === "비해당" ? "n" : "q"}`}>{m.verdict || "확인 필요"}</span>],
      _q: { 품목명: m.item_name, "관계 법령": m.related_law },
    } as any));
  }

  // 검색 — 검색조건(필드) + 낱말
  const qs = sp.qs || qsOpts[0];
  if (q) {
    rows = rows.filter((r: any) => {
      const src = qs === "전체" ? Object.values(r._q || {}) : [r._q?.[qs]];
      return src.some((x: any) => String(x || "").includes(q));
    });
  }
  const nDone = rows.filter((r) => r.done).length;
  const nTodo = rows.length - nDone;
  const shown = st === "0" ? rows.filter((r) => !r.done) : st === "1" ? rows.filter((r) => r.done) : rows;
  const pg = Math.max(1, Number(sp.p || 1));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const view = shown.slice((pg - 1) * PAGE, pg * PAGE);
  const detail = (id: string) => `/targets/basic/${encodeURIComponent(id)}?t=${t}&role=${role}`;
  const canAdmin = role === "gm" || role === "mgr" || role === "ceo";
  const canEditAssets = role === "gm" || role === "mgr";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 관리대상 등록·수정 단추

  return (
    <UsLayout side={<B1Side role={role} on={t} />}>
      <PageHead sub="기본정보" title={TRACK_LABEL[t]} />

      <form className="usb1-search" action="/targets/basic">
        <input type="hidden" name="t" value={t} />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="k" value={cur} />
        <div className="usb1-srow-l">{radioLabel}</div>
        <div className="usb1-sbox usb1-radios">
          {radios.map((r) => (
            <Link key={r.v} href={href({ k: r.v, st: undefined, p: undefined })} className={`usb1-radio${cur === r.v ? " on" : ""}`}>
              <span className="usb1-rdot">{cur === r.v ? "✔" : ""}</span>{r.label}
            </Link>
          ))}
        </div>
        <div className="usb1-srow-l">검색조건</div>
        <div className="usb1-sbox">
          <select name="qs" defaultValue={qs} className="usb1-sel">{qsOpts.map((o) => <option key={o}>{o}</option>)}</select>
          <input type="text" name="q" defaultValue={q} placeholder={ph} className="usb1-q" />
          {extraFilter}
          <button className="usb1-btn-o us-search-btn" type="submit">검색</button>
        </div>
        <div className="usb1-srow-l">입력현황</div>
        <div className="usb1-sbox usb1-split">
          <Link href={href({ st: st === "0" ? undefined : "0", p: undefined })} className={st === "0" ? "on" : ""}>
            <span>미입력</span><b>{nTodo.toLocaleString()}</b><small>{unit}</small>
          </Link>
          <Link href={href({ st: st === "1" ? undefined : "1", p: undefined })} className={st === "1" ? "on" : ""}>
            <span>입력</span><b>{nDone.toLocaleString()}</b><small>{unit}</small>
          </Link>
        </div>
      </form>

      <div className="usb1-cnt">
        <span>총 <b>{shown.length.toLocaleString()}</b>{unit === "개소" ? "개소" : unit === "품목" ? "품목" : unit === "부서" ? "부서" : unit === "사업장" ? "곳" : "개소"}</span>
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 /targets/workplace 는 뺌 · 관리자 › 사업장 기본정보 관리로(권한은 lib/perm.ts /admin 규칙) */}
        {t === "ws" && canAdmin && canAccess(role, "/admin/basic") && <Link className="usb1-btn-o" href={`/admin/basic?d=ind&role=${role}`}>사업장 기본정보 관리</Link>}
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 「관리대상 등록·수정」(/settings/assets)으로 가는 단추. 더하기·빼기는 총괄·관리자만 */}
        {t === "fc" && canEditAssets && <Link className="usb1-btn-o" href={`/settings/assets?role=${role}`}>등록·수정</Link>}
      </div>
      <table className={`us-tbl usb1-list${wsSites ? " usb1-wplist" : ""}`}>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {view.map((r) => (
            <tr key={r.id}>
              {r.cells.map((c, i) => (
                <td key={i} className="c">{i === (t === "fc" ? 1 : t === "ws" ? 1 : 0) ? <Link href={detail(r.id)}>{c}</Link> : c}</td>
              ))}
            </tr>
          ))}
          {!view.length && <tr><td className="c" colSpan={head.length}>조회된 관리대상이 없습니다.</td></tr>}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="usb1-pager">
          {pg > 1 && <Link href={href({ p: String(pg - 1) })}>〈</Link>}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - pg) <= 4)
            .map((n, i, a) => (
              <span key={n}>
                {i > 0 && n - a[i - 1] > 1 && <em>…</em>}
                <Link href={href({ p: String(n) })} className={n === pg ? "on" : ""}>{n}</Link>
              </span>
            ))}
          {pg < pages && <Link href={href({ p: String(pg + 1) })}>〉</Link>}
        </div>
      )}
      {wsSites}
    </UsLayout>
  );
}
