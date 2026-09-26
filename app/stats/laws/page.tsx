// [400 · 교육자료 버전] SCR-102 — 안전·보건 관계 법령 · 중대산업재해·중대시민재해
import Link from "next/link";
import LawChangeNote from "@/app/law/changes/_parts/Note";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { StatsSide } from "../_parts/Side";
import ChartCard from "../_parts/ChartCard";
import { LAYERS, layerOf, CIVIL_TARGETS, civilOf, SUBS, subOf, titleOf } from "../_parts/data";
import { duties, distinctDuties, foldByUnit, type Row } from "@/lib/data";
import { articleOf, scheduleText, storeMeta, type LawUnit } from "@/lib/lawtext";
import { LawArticle, LawSchedule } from "@/components/us/LawText";

export const dynamic = "force-dynamic";

/**
 * 법령 건수·의무 수는 우리 의무 목록(duties())에서 센다 — 명세 숫자(50·35·15 / 150·37·54…)를 쓰지 않는다.
 *  · 「법령」 = 서로 다른 문서(법률·시행령·시행규칙·고시 등 문서 단위) 수 · 「의무」 = 서로 다른 의무 수(distinctDuties)
 *  · 중대산업재해 = 재해 구분 I(사업장) · 중대시민재해 = F(공중이용시설·공중교통수단) + M(원료·제조물)
 *  · 명세에는 법령명 목록이 없으나(08 §SCR-102 구현 메모), 사용자 지시로 법령별 의무 수와 조문을 아래에 보인다.
 */
type Agg = { doc: string; law: string; layer: string; duties: number; y: number; c: number; arts: number };

function aggregate(rows: Row[]): Agg[] {
  const m = new Map<string, Row[]>();
  rows.forEach((r) => { const k = r.doc || r.law; m.set(k, [...(m.get(k) || []), r]); });
  return [...m.entries()].map(([doc, rs]) => {
    const f = foldByUnit(rs);
    return {
      doc, law: rs[0].law, layer: layerOf(rs[0].layer),
      duties: distinctDuties(rs),
      y: f.filter((r) => r.yongin_mark === "Y").length,
      c: f.filter((r) => r.yongin_mark !== "Y").length,
      arts: new Set(rs.map((r) => r.unit_label_ko)).size,
    };
  }).sort((a, b) => LAYERS.indexOf(a.layer as any) - LAYERS.indexOf(b.layer as any) || b.duties - a.duties);
}
const docN = (rows: Row[]) => new Set(rows.map((r) => r.doc || r.law)).size;

/** 조문 정렬 — 제N조의M · 항 · 호 순 */
function artKey(s: string) {
  const n = (re: RegExp) => { const m = s.match(re); return m ? Number(m[1]) : 0; };
  const byeol = /^별표/.test(s) ? 1 : 0;
  return [byeol, n(/제(\d+)조/), n(/조의(\d+)/), n(/제(\d+)항/), n(/제(\d+)호/)];
}
const cmpArt = (a: string, b: string) => {
  const x = artKey(a), y = artKey(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return a.localeCompare(b, "ko");
};

export default async function LawsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const il = ["전체", ...LAYERS].includes(sp.il) ? sp.il : "전체";
  // 09-25 사용자: 하위 메뉴 4개로 나눔 — sec = i(중대산업재해) · f(공중이용시설) · t(공중교통수단) · m(원료·제조물)
  const SEC_CT: Record<string, string> = { f: "공중이용시설", t: "공중교통수단", m: "원료·제조물" };
  const sec = ["i", "f", "t", "m"].includes(sp.sec) ? sp.sec : "i";
  const ct = SEC_CT[sec] || "공중이용시설";
  const subs = SUBS[ct];
  const cs = subs.includes(sp.cs) ? sp.cs : "전체";

  const all = await duties({ limit: 50000 });

  /* ── 중대산업재해 ── */
  const ind = all.filter((r) => r.area === "I");
  const indSel = il === "전체" ? ind : ind.filter((r) => layerOf(r.layer) === il);
  const indAgg = aggregate(indSel);
  const indTbl = ["전체", ...LAYERS].map((k) => {
    const rs = k === "전체" ? ind : ind.filter((r) => layerOf(r.layer) === k);
    return { k, docs: docN(rs), duties: distinctDuties(rs) };
  });
  const indChart = il === "전체"
    ? { t: "중대산업재해", l: [...LAYERS] as string[], v: LAYERS.map((k) => indTbl.find((x) => x.k === k)!.docs), u: "건" }
    : { t: `중대산업재해 — ${il}(의무 수 상위 10)`, l: indAgg.slice().sort((a, b) => b.duties - a.duties).slice(0, 10).map((a) => a.doc), v: indAgg.slice().sort((a, b) => b.duties - a.duties).slice(0, 10).map((a) => a.duties), u: "의무" };

  /* ── 중대시민재해 ── */
  const civ = all.filter((r) => (r.area === "F" || r.area === "M") && civilOf(r) === ct);
  const civSel = cs === "전체" ? civ : civ.filter((r) => subOf(r, ct) === cs);
  const civAgg = aggregate(civSel);
  const civTbl = ["전체", ...subs].map((k) => {
    const rs = k === "전체" ? civ : civ.filter((r) => subOf(r, ct) === k);
    return { k, docs: docN(rs), duties: distinctDuties(rs) };
  });
  const civTop = civAgg.slice().sort((a, b) => b.duties - a.duties).slice(0, 10);
  const civChart = cs === "전체"
    ? { t: "중대시민재해", l: [...subs], v: subs.map((k) => civTbl.find((x) => x.k === k)!.docs), u: "건" }
    : { t: `중대시민재해 — ${ct} · ${cs}(의무 수 상위 10)`, l: civTop.map((a) => a.doc), v: civTop.map((a) => a.duties), u: "의무" };

  // 목록용 — 시민재해 세 구분 각각(고른 구분에만 세부 거르기)
  const CIV_DA: Record<string, "f" | "t" | "m"> = { 공중이용시설: "f", 공중교통수단: "t", "원료·제조물": "m" };
  const civLists = CIVIL_TARGETS.map((k) => {
    const rs = all.filter((r) => (r.area === "F" || r.area === "M") && civilOf(r) === k);
    const kcs = k === ct ? cs : "전체";
    const sel = kcs === "전체" ? rs : rs.filter((r) => subOf(r, k) === kcs);
    return { k, cs: kcs, da: CIV_DA[k], sel, agg: aggregate(sel) };
  });

  // 주소 — 한 카드의 선택을 바꿔도 다른 카드 선택은 유지(두 카드는 독립)
  const url = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    const m: Record<string, string | undefined> = { sec, il: sec === "i" ? il : undefined, cs: sec === "i" ? undefined : cs, ...o };
    Object.entries(m).forEach(([k, v]) => v && v !== "전체" && p.set(k, v));
    return `/stats/laws?${p.toString()}`;
  };

  // 조문 보기(드릴다운)
  const drillSrc = sp.da === "i" ? indSel : civLists.find((x) => x.da === sp.da)?.sel || civSel;
  const drill = sp.doc ? drillSrc.filter((r) => (r.doc || r.law) === sp.doc) : [];
  const drillCiv = civLists.find((x) => x.da === sp.da);
  const drillRows = foldByUnit(drill).sort((a, b) => cmpArt(String(a.unit_label_ko || ""), String(b.unit_label_ko || "")));
  const LIMIT = 400;

  // 조문 보기 — 의무를 조(또는 별표) 단위로 묶고, 조마다 법조문 원문을 붙인다(09-24 사용자: 원문이 없었다)
  type Grp = { key: string; label: string; title: string; units?: LawUnit[]; sch?: { title: string; x: string }; rows: Row[] };
  const groups: Grp[] = [];
  if (sp.doc) {
    const gm = new Map<string, Grp>();
    for (const r of drillRows.slice(0, LIMIT)) {
      let key = "", g: Grp | undefined;
      if (r.schedule_id) {
        const s = scheduleText(r.schedule_id);
        key = `S:${r.schedule_id}`;
        g = gm.get(key) || { key, label: s?.title || String(r.unit_label_ko || "별표"), title: "", sch: s ? { title: s.title, x: s.x } : undefined, rows: [] };
      } else {
        const a = r.unit_id ? await articleOf(r.doc_id || "", r.unit_id) : null;
        key = a ? `${a.doc.doc_id}|${a.art}` : `?:${r.unit_label_ko}`;
        const head = a?.units[0];
        g = gm.get(key) || { key, label: head?.l || String(r.unit_label_ko || ""), title: head?.ti && !/^[a-z]+\d/.test(head.ti) ? head.ti : titleOf(r), units: a?.units, rows: [] };
      }
      g.rows.push(r);
      gm.set(key, g);
    }
    groups.push(...gm.values());
  }
  const meta = storeMeta();

  const LawList = ({ rows, da, label }: { rows: Agg[]; da: string; label: string }) => (
    <section className="usg-lawsec" id={`law-${da}`}>
      <h2 className="us-h2">{label} <small className="us-muted">법령 {rows.length}건 · 의무 {rows.reduce((a, r) => a + r.duties, 0).toLocaleString()}건</small></h2>
      <div className="usg-lawscroll">
        <table className="us-tbl usg-lawtbl">
          <thead><tr><th>번호</th><th>법령명</th><th>구분</th><th>소관 법률</th><th>의무</th><th>용인 확정</th><th>조건부</th><th>조문</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="c usg-empty">해당 법령이 없습니다.</td></tr>}
            {rows.map((a, i) => (
              <tr key={a.doc} className={sp.doc === a.doc && sp.da === da ? "hl" : ""}>
                <td className="c">{i + 1}</td>
                <td>{a.doc}</td>
                <td className="c">{a.layer}</td>
                <td>{a.law === a.doc ? "" : a.law}</td>
                <td className="n">{a.duties.toLocaleString()}</td>
                <td className="n">{a.y.toLocaleString()}</td>
                <td className="n">{a.c.toLocaleString()}</td>
                <td className="n">{a.arts.toLocaleString()}</td>
                <td className="c"><Link className="us-btn-s" href={`${url({})}&doc=${encodeURIComponent(a.doc)}&da=${da}`}>조문 보기</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <UsLayout side={<StatsSide role={role} on="laws" sec={sec} />}>
      <PageHead sub="안전·보건 관계 법령" title={sec === "i" ? "중대산업재해 관계 법령" : `중대시민재해 관계 법령 — ${ct}`} />
      <LawChangeNote role={role} />

      <div className="usg-two usg-one">
        {/* [중대산업재해] */}
        {sec === "i" && <section className="usg-lcard">
          <div className="usg-lcard-h">중대산업재해</div>
          <div className="usg-radios">
            {/* TODO: 확인 — 명세 라디오는 전체·법률·시행규칙 3개. 우리 의무 목록에는 시행령·행정규칙(고시·훈령·예규)도 있어 함께 둔다 */}
            {["전체", ...LAYERS].map((k) => (
              <Link key={k} href={url({ il: k })} className={`usg-radio${il === k ? " on" : ""}`}><i />{k}</Link>
            ))}
          </div>
          <table className="usg-vtbl">
            <thead><tr><th></th><th>법령</th><th>의무</th></tr></thead>
            <tbody>
              {indTbl.map((x) => (
                <tr key={x.k} className={il === x.k ? "on" : ""}><th>{x.k}</th><td>{x.docs.toLocaleString()}</td><td>{x.duties.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
          <ChartCard key={`i-${il}`} title={indChart.t} labels={indChart.l} values={indChart.v} unit={indChart.u} innerTitle variant="plain" rotate={il !== "전체"} height={330} width={900} />
        </section>}

        {/* [중대시민재해] — 구분은 하위 메뉴로 고른다(라디오는 같은 하위 메뉴로 가는 바로가기) */}
        {sec !== "i" && <section className="usg-lcard">
          <div className="usg-lcard-h">중대시민재해</div>
          <div className="usg-radios">
            {CIVIL_TARGETS.map((k) => (
              <Link key={k} href={url({ sec: CIV_DA[k], cs: undefined })} className={`usg-radio${ct === k ? " on" : ""}`}><i />{k}</Link>
            ))}
          </div>
          <div className="usg-radios wrap">
            {["전체", ...subs].map((k) => (
              <Link key={k} href={url({ cs: k })} className={`usg-radio${cs === k ? " on" : ""}`}><i />{k}</Link>
            ))}
          </div>
          <div className="usg-htbl-wrap">
            <table className="usg-htbl">
              <thead><tr><th></th>{civTbl.map((x) => <th key={x.k} className={cs === x.k ? "on" : ""}>{x.k}</th>)}</tr></thead>
              <tbody>
                <tr><th>법령</th>{civTbl.map((x) => <td key={x.k} className={cs === x.k ? "on" : ""}>{x.docs.toLocaleString()}</td>)}</tr>
                <tr><th>의무</th>{civTbl.map((x) => <td key={x.k} className={cs === x.k ? "on" : ""}>{x.duties.toLocaleString()}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <ChartCard key={`c-${ct}-${cs}`} title={civChart.t} labels={civChart.l} values={civChart.v} unit={civChart.u} innerTitle variant="plain" rotate height={330} width={900} />
          {ct === "공중이용시설" && <p className="usg-note">※ 한 법령이 여러 시설구분에 걸리면 구분마다 셉니다(「전체」는 서로 다른 법령 수). 기타에는 모든 시설 공통 의무(소방·전기·승강기 등)와 도로·공원 등이 들어갑니다.</p>}
        </section>}
      </div>

      {/* 목록 — 고른 하위 메뉴의 목록 하나(09-25 사용자: 네 목록이 한 화면에 늘어져 너무 길었다) */}
      {sec === "i"
        ? <LawList rows={indAgg} da="i" label={`중대산업재해 관계 법령${il === "전체" ? "" : ` — ${il}`}`} />
        : civLists.filter((x) => x.da === sec).map((x) => (
          <LawList key={x.k} rows={x.agg} da={x.da} label={`중대시민재해 관계 법령 — ${x.k}${x.cs !== "전체" ? ` · ${x.cs}` : ""}`} />
        ))}

      {sp.doc && (
        <div className="us-modal-bg">
          <div className="us-modal usg-drill">
            <div className="us-modal-h">{sp.doc} — 조문별 의무<Link className="usg-x" href={url({})}>✕</Link></div>
            <div className="us-modal-b">
              <p className="us-muted">{drillCiv ? `중대시민재해 · ${drillCiv.k}${drillCiv.cs !== "전체" ? ` · ${drillCiv.cs}` : ""}` : `중대산업재해 · ${il}`} · 의무 {drillRows.length.toLocaleString()}건{drillRows.length > LIMIT ? ` (앞 ${LIMIT}건만 보임)` : ""}</p>
              <p className="lt-src">원문: 정본 {meta.canon_release || "-"} 판에서 불러온 법령 원문 · 법령 개정 자동 확인에서 반영한 개정 포함 · 녹색 띠 = 우리 의무가 걸린 조항호목</p>
              {groups.map((g) => {
                const mk = new Set(g.rows.map((r) => String(r.unit_id || "")));
                return (
                  <section key={g.key} className="lt-grp">
                    <h3 className="lt-h">{g.label}{g.title ? <span> {g.title}</span> : null}<small>의무 {g.rows.length}건</small></h3>
                    {g.units ? <LawArticle units={g.units} mark={mk} /> : g.sch ? <LawSchedule title={g.sch.title} text={g.sch.x} /> : <p className="us-muted">원문을 찾지 못했습니다.</p>}
                    <table className="us-tbl lt-duty">
                      <thead><tr><th>조문</th><th>의무</th><th>관리대상</th><th>용인</th></tr></thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.duty_key}>
                            <td className="c usg-nowrap">{r.unit_label_ko}</td>
                            <td>{String(r.duty_name || "").replace(`${r.doc} — `, "")}</td>
                            <td>{r.target_name}</td>
                            <td className="c">{r.yongin_mark === "Y" ? "확정" : "조건부"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </UsLayout>
  );
}
