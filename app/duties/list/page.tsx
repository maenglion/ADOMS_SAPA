// [캡처 v2] 맨 위 단계 막대(이 목록 의무의 과제 단계) · 그래프는 접기 · 표 6칸 한 줄 · 기본 15행 + 「전체 N건 →」.
import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import Link from "next/link";
import ExportButton from "@/components/ExportButton";
import { duties, foldByUnit, tasks } from "@/lib/data";
import { AreaBadge, StatusBadge, Bar } from "@/components/bits";
import { ViewSwitch, ChartSwitch, Donut, BarGroup } from "@/components/Chart";
import { secureAxisOrUnset } from "@/lib/axes";
import Steps, { type Step } from "@/components/Steps";

export const dynamic = "force-dynamic";

/** 이행 유형 — 칩은 8자 이내 짧은 이름, 전체 이름은 title 로. */
const IMPL: [string, string, string][] = [
  ["T01", "체계·계획", "체계·규정·계획"], ["T02", "인력·선임", "인력·자격·선임"], ["T03", "교육·훈련", "교육·훈련"],
  ["T04", "점검·검사", "점검·검사·진단·측정"], ["T05", "시설 기준", "시설·설비·구조 기준"], ["T06", "작업 안전", "작업·운행 안전조치"],
  ["T07", "물질 관리", "물질·제품 관리"], ["T08", "위생·보건", "위생·보건"], ["T09", "비상대응", "비상대응·사고 처리"],
  ["T10", "기록·보고", "기록·보고·게시"],
];

export default async function DutyList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const view = sp.v || "";
  const graph = sp.g || "";
  const showAll = sp.n === "all";

  const raw = await duties({
    code36: sp.code, target: sp.target, law: sp.law, group: sp.group,
    area: sp.area, impl: sp.impl, mark: sp.mark, q: sp.q, limit: 100000,
  });
  const rows = foldByUnit(raw);
  // 이행 유형 칩 숫자 — 「관계법령 의무이행」 같은 우산 조항 안을 유형별로 몇 건씩 묶었는지(유형 필터는 뺀 기준)
  const base = sp.impl ? foldByUnit(await duties({
    code36: sp.code, target: sp.target, law: sp.law, group: sp.group,
    area: sp.area, mark: sp.mark, q: sp.q, limit: 100000,
  })) : rows;
  const implN = new Map<string, number>();
  base.forEach((r: any) => implN.set(r.impl_type, (implN.get(r.impl_type) || 0) + 1));
  const tk = await tasks({ limit: 5000 });
  const byDuty = new Map<string, any>();
  tk.forEach((t: any) => { if (!byDuty.has(t.duty_key)) byDuty.set(t.duty_key, t); });

  const title = sp.code ? `${sp.code} ${rows[0]?.code36_name || ""}`
    : sp.target ? `${rows[0]?.target_name || sp.target}`
    : sp.law ? sp.law : sp.group ? rows[0]?.law_group_name : "의무 목록";

  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ role, ...sp, ...extra }).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/duties/list?${p.toString()}`;
  };
  const spClean: Record<string, string> = Object.fromEntries(
    Object.entries({ role, ...sp }).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));

  // [캡처 v2] 단계 막대 — 이 목록 의무에 걸린 과제가 단계마다 몇 건인가
  const keys = new Set(raw.map((r: any) => r.duty_key));
  const my = tk.filter((t: any) => keys.has(t.duty_key));
  const c = (f: (t: any) => boolean) => my.filter(f).length;
  const nWait = c((t) => t.status === "이행대기" || t.status === "기간초과");
  const nDone = c((t) => t.status === "이행완료");
  const nChecked = c((t) => t.status === "점검완료");
  const nFix = c((t) => t.status === "조치필요");
  const nAppr = c((t) => t.approval_status === "승인");
  const steps: Step[] = [
    { label: "의무", n: rows.length, state: "done" },
    { label: "이행", n: nWait, state: nWait ? "on" : "done", href: `/tasks?role=${role}&status=이행대기` },
    { label: "증빙", n: nDone, state: nDone ? "on" : "", href: `/evidence?role=${role}` },
    { label: "판정", n: nChecked, state: nChecked ? "done" : "", href: `/review?role=${role}` },
    { label: "조치", n: nFix, state: nFix ? "warn" : "", href: `/actions?role=${role}` },
    { label: "결재", n: nAppr, state: nAppr ? "done" : "", href: `/inspections?role=${role}&view=approve` },
  ];

  // 그래프 자료 — 재해 구분과 확보의무 대분류(접기 안)
  const areaSlices = [
    { label: "중대산업재해", n: rows.filter((r) => r.area === "I").length, tone: "ok" as const },
    { label: "중대시민재해(공중이용시설·공중교통수단)", n: rows.filter((r) => r.area === "F").length, tone: "" as const },
    { label: "중대시민재해(원료·제조물)", n: rows.filter((r) => r.area === "M").length, tone: "warn" as const },
  ];
  const axisMap = new Map<string, number>();
  rows.forEach((r) => { const a = secureAxisOrUnset(r.code36); axisMap.set(a, (axisMap.get(a) || 0) + 1); });
  const axisSlices = [...axisMap.entries()].map(([label, n]) => ({ label, n }));

  const LIMIT = showAll ? (view === "card" ? 120 : 400) : 15;
  const shown = rows.slice(0, LIMIT);

  return (
    <UsLayout side={<MenuSide group="법 의무사항" />}>   {/* 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성 */}
      <div className="crumb"><Link href={`/duties?role=${role}&axis=${sp.axis || "code"}`}>의무</Link> › {title}</div>
      <h1 className="v2h">{title} <span className="muted">{rows.length.toLocaleString()}</span></h1>

      <Steps items={steps} />

      <div className="chips">
        {["", "I", "F", "M"].map((a) => (
          <Link key={a || "all"} className={`chip ${(sp.area || "") === a ? "on" : ""}`} href={q({ area: a || undefined })}>
            {a === "" ? "전체" : a === "I" ? "중대산업재해" : a === "F" ? "중대시민재해(공중이용시설·공중교통수단)" : "중대시민재해(원료·제조물)"}
          </Link>
        ))}
        <span style={{ width: 12 }} />
        <Link className={`chip ${sp.mark === "조건부" ? "on" : ""}`} href={q({ mark: sp.mark === "조건부" ? undefined : "조건부" })}>확인 대상</Link>
        <Link className={`chip ${sp.mark === "Y" ? "on" : ""}`} href={q({ mark: sp.mark === "Y" ? undefined : "Y" })}>확정만</Link>
        <span style={{ flex: 1 }} />
        <ViewSwitch base="/duties/list" sp={spClean} cur={view} />
        <ExportButton what="duties" />
      </div>
      <div className="chips">
        {IMPL.map(([code, short, full]) => (
          <Link key={code} title={`${code} ${full}`} className={`chip ${sp.impl === code ? "on" : ""}`} href={q({ impl: sp.impl === code ? undefined : code })}>{short} <span className="muted">{(implN.get(code) || 0).toLocaleString()}</span></Link>
        ))}
      </div>

      {view === "card" ? (
        <div className="grid g3" style={{ marginTop: 12 }}>
          {shown.map((r) => {
            const t = byDuty.get(r.duty_key);
            return (
              <div className="card" key={r.duty_key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <AreaBadge area={r.area} />
                  <span className="badge none">{r.code36}</span>
                  {t && <StatusBadge s={t.status} />}
                </div>
                <Link href={`/duties/${r.duty_key}?role=${role}`} title={r.duty_name || r.article_title}
                      style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--deep)" }}>
                  {r.duty_name || r.article_title || "(제목 없음)"}
                </Link>
                <div className="muted" title={`${r.law} ${r.unit_label_ko}`} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.law} {r.unit_label_ko}</div>
                {t && <Bar pct={t.status === "이행완료" || t.status === "점검완료" ? 100 : t.status === "기간초과" ? 0 : 45} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table className="v2t">
            <thead>
              <tr>
                <th className="cd">재해</th><th className="cd">조항</th><th>의무명</th>
                <th>조문</th><th>관리대상</th><th className="cd">이행</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={6} className="muted">없음</td></tr>}
              {shown.map((r) => (
                <tr key={r.duty_key}>
                  <td className="cd"><AreaBadge area={r.area} /></td>
                  <td className="cd" title={r.code36_name}>{r.code36}</td>
                  <td title={r.duty_name || r.article_title}>
                    <Link href={`/duties/${r.duty_key}?role=${role}`}>{r.duty_name || r.article_title || "(제목 없음)"}</Link>
                  </td>
                  <td title={`${r.law} ${r.unit_label_ko}`}>{r.law} {r.unit_label_ko}</td>
                  <td title={r.target_name}>{r.target_name}</td>
                  <td className="cd">{byDuty.has(r.duty_key) ? <StatusBadge s={byDuty.get(r.duty_key).status} /> : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!showAll && rows.length > LIMIT && <Link className="more" href={q({ n: "all" })}>전체 {rows.length.toLocaleString()}건 →</Link>}

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>그래프</summary>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><ChartSwitch base="/duties/list" sp={spClean} cur={graph} /></div>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <div>
            <h3>재해 구분</h3>
            {graph === "pie"
              ? <Donut slices={areaSlices} center={rows.length.toLocaleString()} sub="의무" />
              : <BarGroup slices={areaSlices} />}
          </div>
          <div>
            <h3>확보의무 대분류</h3>
            {graph === "pie" ? <Donut slices={axisSlices} /> : <BarGroup slices={axisSlices} />}
          </div>
        </div>
      </details>
    </UsLayout>
  );
}
