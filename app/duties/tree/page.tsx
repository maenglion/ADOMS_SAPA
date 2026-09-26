import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import Link from "next/link";
import { Fragment } from "react";
import { duties, foldByUnit } from "@/lib/data";
import { AreaBadge } from "@/components/bits";

export const dynamic = "force-dynamic";

/**
 * S15 — 법령 계층표. 법률 → 하위법령(시행령·시행규칙·고시) → 조문 → 의무를 한 표로 병합해 보여 준다.
 * 참고 명세의 4단 계층 표에 해당한다. 공무원이 「이 법 아래 뭐가 몇 개 있나」를 통째로 보는 자리다.
 *
 * 계층은 정본의 `layer` 를 그대로 쓴다(법률·대통령령·부령·고시). 없는 것은 「그 밖」으로 둔다.
 */
/**
 * 계층표의 순서 — 재난안전과의 관련성으로 층을 나눈다(사용자 지시 09-21).
 * 감으로 줄 세우지 않고 **법령 그룹(law_group, 데이터에 이미 있는 분류)** 으로 층을 정한다.
 * 층 안에서는 의무 건수 순. 화면에 층 이름을 밝혀 「왜 이 순서냐」에 답한다.
 */
/** 맨 위에 고정하는 법 — 순서가 곧 위계다. 중처법이 우산, 산안법·시설물안전법이 두 기둥. */
const PINNED = ["중대재해 처벌 등에 관한 법률", "산업안전보건법", "시설물의 안전 및 유지관리에 관한 특별법"];

/** 층 — 앞일수록 재난안전과 가깝다. */
const TIERS: { name: string; groups: string[] }[] = [
  { name: "기본",               groups: [] },                        // PINNED
  { name: "재난·방재",          groups: ["LF04", "LF03"] },          // 재난관리 뼈대 · 소방
  { name: "시설·설비·교통 안전", groups: ["LF02", "LF05", "LF07", "LF08"] },
  { name: "산업안전 관련",       groups: ["LF01"] },
  { name: "생활안전·보건",       groups: ["LF06", "LF10", "LF13"] },
  { name: "이용시설·복지",       groups: ["LF12"] },
  { name: "그 밖",              groups: [] },
];

/**
 * 분류가 틀린 법의 보정 — 법령 그룹이 잘못 붙은 것을 정렬에서만 바로잡는다.
 * ★ 「재난관리자원의 관리 등에 관한 법률」이 「기타 제도(LF99)」로 들어가 있다. 이름부터 재난법이다.
 *   데이터는 고치지 않고(정본 쪽 판단) 여기서만 올린다 — 요청서로 정본DB 채팅에 넘긴다.
 */
const GROUP_FIX: Record<string, string> = { "재난관리자원의 관리 등에 관한 법률": "LF04" };

/** 층 안에서 맨 앞에 두는 법 — 그 층의 기본법. */
const TIER_HEAD = ["재난 및 안전관리 기본법"];

function tierOf(law: string, group: string): number {
  if (PINNED.includes(law)) return 0;
  const g = GROUP_FIX[law] || group;
  const i = TIERS.findIndex((t, k) => k > 0 && t.groups.includes(g));
  return i === -1 ? TIERS.length - 1 : i;
}

const LAYER_ORDER = ["법률", "대통령령", "총리령", "부령", "규칙", "고시", "훈령", "예규", "지침"];
const layerRank = (l: string) => {
  const i = LAYER_ORDER.findIndex((x) => (l || "").includes(x));
  return i < 0 ? 99 : i;
};

export default async function DutyTree({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const showAll = sp.n === "all";
  const rows = foldByUnit(await duties({ limit: 100000 }));

  // 법률 → 문서(계층) → 조문
  const byLaw = new Map<string, Map<string, any[]>>();
  rows.forEach((r) => {
    const law = r.law || "(법령 미상)";
    const doc = `${r.doc}||${r.layer}`;
    const m = byLaw.get(law) || new Map<string, any[]>();
    m.set(doc, [...(m.get(doc) || []), r]);
    byLaw.set(law, m);
  });

  const laws = [...byLaw.entries()]
    .map(([law, docs]) => {
      const first = [...docs.values()][0]?.[0];
      return {
        law, docs,
        n: [...docs.values()].reduce((s, v) => s + v.length, 0),
        // 한 법률이 여러 재해 구분에 걸리면(중대재해 처벌 등에 관한 법률 등) 모두 표시한다
        areas: ["I", "F", "M"].filter((a) => [...docs.values()].some((v) => v.some((r) => String(r.areas || r.area || "").includes(a)))),
        tier: tierOf(law, first?.law_group || ""),
      };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tier === 0) return PINNED.indexOf(a.law) - PINNED.indexOf(b.law);
      const ha = TIER_HEAD.includes(a.law) ? 0 : 1, hb = TIER_HEAD.includes(b.law) ? 0 : 1;
      if (ha !== hb) return ha - hb;
      return b.n - a.n;
    });

  const sel = sp.law || laws[0]?.law;
  const cur = laws.find((l) => l.law === sel);
  const curDocs = cur ? [...cur.docs.entries()]
    .map(([k, v]) => {
      const [doc, layer] = k.split("||");
      return { doc, layer, rows: v };
    })
    .sort((a, b) => layerRank(a.layer) - layerRank(b.layer) || a.doc.localeCompare(b.doc)) : [];

  return (
    <UsLayout side={<MenuSide group="법 의무사항" />}>   {/* 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성 */}
      {/* [캡처 v2] 설명 문단 2개(계층·순서 안내)를 뺐다 — 층 이름은 표 안 머리줄로 충분 */}
      <h1 className="v2h">법령 계층표</h1>

      <div className="grid" style={{ gridTemplateColumns: "minmax(320px,400px) 1fr", marginTop: 12 }}>
        <div className="tbl-wrap fillself" style={{ ["--minh" as any]: "700px" }}>
          <table>
            <thead><tr><th>법률 {laws.length}건</th><th className="num" style={{ width: 70 }}>의무</th></tr></thead>
            <tbody>
              {laws.map((l, k) => (
                <Fragment key={l.law}>
                  {(k === 0 || laws[k - 1].tier !== l.tier) && (
                    <tr><td colSpan={2} style={{ background: "#eef3f9", fontWeight: 700, color: "var(--navy)",
                                                  fontSize: ".85rem", padding: "6px 12px" }}>
                      {TIERS[l.tier].name}
                    </td></tr>
                  )}
                  <tr style={{ background: l.law === sel ? "var(--blush)" : undefined }}>
                    <td title={l.law}>
                      <Link href={`/duties/tree?role=${role}&law=${encodeURIComponent(l.law)}`}>{l.law}</Link>
                    </td>
                    <td className="num">{l.n.toLocaleString()}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          {cur && (
            <>
              <div className="card">
                <h3 style={{ marginBottom: 4 }}>{cur.law}</h3>
                <div className="chips" style={{ margin: 0 }}>
                  {cur.areas.map((a) => <AreaBadge key={a} area={a} />)}
                  <span className="badge">의무 {cur.n.toLocaleString()}건</span>
                  <span className="badge none">문서 {cur.docs.size}</span>
                  <Link className="chip" href={`/duties/list?role=${role}&law=${encodeURIComponent(cur.law)}`}>목록 보기</Link>
                </div>
              </div>

              {curDocs.map((d) => (
                <div className="card" key={d.doc + d.layer} style={{ marginTop: 12 }}>
                  <h3 style={{ marginBottom: 2 }}>
                    <span className="badge none" style={{ marginRight: 8 }}>{d.layer || "그 밖"}</span>
                    {d.doc}
                    <span className="muted"> {d.rows.length.toLocaleString()}</span>
                  </h3>
                  <div className="tbl-wrap" style={{ maxHeight: 360, marginTop: 8 }}>
                    <table className="v2t">
                      <thead><tr>
                        <th className="cd">조문</th>
                        <th>의무</th>
                        <th className="cd">조항</th>
                        <th>관리대상</th>
                      </tr></thead>
                      <tbody>
                        {d.rows.slice(0, showAll ? 60 : 15).map((r: any) => (
                          <tr key={r.duty_key}>
                            <td className="cd">{r.unit_label_ko}</td>
                            <td title={r.duty_name || r.article_title}><Link href={`/duties/${r.duty_key}?role=${role}`}>{r.duty_name || r.article_title}</Link></td>
                            <td className="cd" title={r.code36_name}>{r.code36}</td>
                            <td className="muted" title={r.target_name}>{r.target_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!showAll && d.rows.length > 15 && <Link className="more" href={`/duties/tree?role=${role}&law=${encodeURIComponent(cur.law)}&n=all`}>전체 {d.rows.length.toLocaleString()}건 →</Link>}
                  {showAll && d.rows.length > 60 && <Link className="more" href={`/duties/list?role=${role}&law=${encodeURIComponent(cur.law)}`}>목록에서 전체 {d.rows.length.toLocaleString()}건 →</Link>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </UsLayout>
  );
}
