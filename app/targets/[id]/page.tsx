import Link from "next/link";
import { redirect } from "next/navigation";
import { assetById, assetTargets, duties, tasks, foldByUnit, depts } from "@/lib/data";
import { AreaBadge, Bar } from "@/components/bits";
import Steps, { Facts, type Step } from "@/components/Steps";

export const dynamic = "force-dynamic";

const ASSET_DETAIL_HIDDEN = true;

export default async function AssetDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  // 09-26 사용자: 「관리대상에도 시설 정보가 있는데 중복되는 내용이면 일단 노출을 하지 말자」 — 시설 정보는 관리대상 현황 › 기본정보 상세,
  //   시설의 의무는 법 의무사항 › 공중이용시설과 겹친다. 그래서 관리대상 현황 기본정보 상세로 보낸다. 되돌리려면 ASSET_DETAIL_HIDDEN = false.
  if (ASSET_DETAIL_HIDDEN) redirect(`/targets/basic/${encodeURIComponent(decodeURIComponent(id))}?t=fc&role=${role}`);
  const a = await assetById(decodeURIComponent(id));
  if (!a) return <p>자산을 찾지 못했습니다.</p>;

  const codes = await assetTargets(a.asset_id);
  const all = await duties({ limit: 100000 });
  // 09-24: 그 시설 유형의 의무를 먼저(시설물안전법 공통 TG25 는 그다음), 기관 공통(TG24)은 뒤로 — 시설 상세에서 기관 공통 의무가 앞을 가리던 것
  const rank = (d: any) => (d.target_code === "TG24" ? 2 : d.target_code === "TG25" ? 1 : 0);
  const mine = foldByUnit(all.filter((d) => codes.includes(d.target_code) || d.target_code === "TG24")).sort((x: any, y: any) => rank(x) - rank(y));
  const allTasks = await tasks({ limit: 5000 });
  const deptName = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));

  // 법령 그룹별 묶음 — 이슈 ②(터널에 재난안전법이 안 나온다)를 여기서 보여 준다
  const groups = new Map<string, { name: string; laws: Map<string, number>; n: number; done: number }>();
  mine.forEach((d) => {
    const g = groups.get(d.law_group) || { name: d.law_group_name, laws: new Map(), n: 0, done: 0 };
    g.n++;
    g.laws.set(d.law, (g.laws.get(d.law) || 0) + 1);
    const t = allTasks.find((t: any) => t.duty_key === d.duty_key);
    if (t && (t.status === "이행완료" || t.status === "점검완료")) g.done++;
    groups.set(d.law_group, g);
  });
  const sorted = [...groups.entries()].sort((x, y) => y[1].n - x[1].n);

  // [캡처 v2] 이 자산의 과제 단계 막대 · 핵심 값 칸 · 설명 문단과 「표시」 칸 뺌 · 의무 표 15행
  const myTasks = allTasks.filter((t: any) => t.asset_id === a.asset_id);
  const cnt = (f: (t: any) => boolean) => myTasks.filter(f).length;
  const nWait = cnt((t) => t.status === "이행대기" || t.status === "기간초과");
  const nDone = cnt((t) => t.status === "이행완료");
  const nChecked = cnt((t) => t.status === "점검완료");
  const nFix = cnt((t) => t.status === "조치필요");
  const nAppr = cnt((t) => t.approval_status === "승인");
  const steps: Step[] = [
    { label: "의무", n: mine.length, state: "done" },
    { label: "이행", n: nWait, state: nWait ? "on" : "done", href: `/tasks?role=${role}&status=이행대기` },
    { label: "증빙", n: nDone, state: nDone ? "on" : "", href: `/evidence?role=${role}` },
    { label: "판정", n: nChecked, state: nChecked ? "done" : "", href: `/review?role=${role}` },
    { label: "조치", n: nFix, state: nFix ? "warn" : "", href: `/actions?role=${role}` },
    { label: "결재", n: nAppr, state: nAppr ? "done" : "", href: `/inspections?role=${role}&view=approve` },
  ];
  const pct = myTasks.length ? Math.round(((nDone + nChecked) / myTasks.length) * 100) : null;

  return (
    <>
      <div className="crumb"><Link href={`/targets?role=${role}`}>관리대상</Link> › {a.asset_gbn}</div>
      <h1 className="v2h">{a.asset_name}</h1>
      <div className="chips">
        <span className="badge" title={a.addr}>{a.asset_kind}</span>
        {a.asset_class && <span className="badge">{a.asset_class}</span>}
      </div>

      <Steps items={steps} />

      <Facts items={[
        { k: "이행률", v: pct === null ? "-" : <><b>{pct}%</b> <span className="muted">{myTasks.length}건</span></> },
        { k: "안전등급", v: a.safety_grade || "-" },
        { k: "관리 구분", v: a.mgmt_class || (a.sapa_l2_result === "제외" ? "관계법령 관리시설" : "중처법 공중이용시설") },
        { k: "관리 근거 법령", v: a.mgmt_laws || "-" },
        ...(a.consign ? [{ k: "위탁", v: `${a.consign} — ${a.consign_note}` }] : []),
        { k: "중처법 판정", v: a.sapa_l2_result === "제외" && a.mgmt_class === "관계법령 관리시설" ? "대상 아님" : a.sapa_l2_result || "-" },
        ...(a.res_storage_k ? [{ k: "저수량 · 제방", v: `${a.res_storage_k}천㎥ · 높이 ${a.res_dam_height}m${a.res_emergency_plan ? ` · 비상대처계획 ${a.res_emergency_plan}` : ""}` }] : []),
        { k: "담당", v: deptName.get(a.dept_id) || a.dept_id || "-" },
        { k: "준공", v: a.completed_ymd || "-" },
      ]} />

      <h2 style={{ marginTop: 14 }}>법령 그룹 <span className="muted">{mine.length.toLocaleString()}</span></h2>
      <div className="tbl-wrap">
        <table className="v2t">
          <thead><tr><th>법령 그룹</th><th>법률</th><th className="num">의무</th><th>이행률</th></tr></thead>
          <tbody>
            {sorted.map(([g, v]) => (
              <tr key={g}>
                <td title={g}><b>{v.name}</b></td>
                <td title={[...v.laws.keys()].join(" · ")}>
                  {[...v.laws.entries()].sort((x, y) => y[1] - x[1]).map(([law, n]) => (
                    <Link key={law} href={`/duties/list?role=${role}&law=${encodeURIComponent(law)}`}
                          style={{ marginRight: 10 }}>{law} <span className="muted">{n}</span></Link>
                  ))}
                </td>
                <td className="num">{v.n}</td>
                <td><Bar pct={v.n ? Math.round((v.done / v.n) * 100) : 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 14 }}>의무 <span className="muted">{mine.length.toLocaleString()}</span></h2>
      <div className="tbl-wrap">
        <table className="v2t">
          <thead><tr><th className="cd">재해</th><th className="cd">조항</th><th>의무명</th><th>조문</th></tr></thead>
          <tbody>
            {mine.slice(0, 15).map((d) => (
              <tr key={d.duty_key}>
                <td className="cd"><AreaBadge area={d.area} /></td>
                <td className="cd" title={d.code36_name}>{d.code36}</td>
                <td title={d.duty_name || d.article_title}><Link href={`/duties/${d.duty_key}?role=${role}&asset=${encodeURIComponent(a.asset_id)}`}>{d.duty_name || d.article_title}</Link></td>
                <td title={`${d.law} ${d.unit_label_ko}`}>{d.law} {d.unit_label_ko}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mine.length > 15 && <Link className="more" href={`/duties/list?role=${role}&target=${codes[0] || "TG24"}`}>전체 {mine.length.toLocaleString()}건 →</Link>}
    </>
  );
}
