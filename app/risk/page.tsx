import Link from "next/link";
import { depts, staff, contracts, contractHazards } from "@/lib/data";
import { Donut, BarGroup, ChartSwitch } from "@/components/Chart";
import { Stat } from "@/components/bits";
// 09-26 사용자: 메뉴 밖 화면 합치기 — 위험성평가는 조회 전용. 관리대상 현황 레이아웃 + 좌측(사업장) 안에서 열린다.
//   머리·좌측 메뉴에는 넣지 않는다. 들어오는 길: 관리대상 현황 › 사업장 기본정보 상세의 「이 사업장 위험성평가(조회)」 칸 ·
//   의무이행 › 사업장 유해·위험요인 단계(몫 B)의 「사업장 위험성평가 결과 보기(조회)」 — 주소 /risk?wp=<사업장 id>&role=…
//   이 화면에는 입력·저장·삭제 단추와 폼이 없다(앞으로도 두지 않는다 — 입력은 위험성평가 지원 시스템).
//   사업장 연결 규칙은 ./_scope.ts 한 곳. 09-26 사용자 「사업장별 위험성평가 결과를 풍성하게」 — 예시 자료 us_v1.8(98건 · 296항목)을 보여 준다.
import { UsLayout, PageHead } from "@/components/us/Parts";
import { B1Side } from "../targets/_side";
import { riskScope, riskCounts, targetsOf, statusTone, levelTone, wpOfRisk } from "./_scope";

export const dynamic = "force-dynamic";

/** S13 — 위험성평가(조회). 중처법 시행령 제4조제3호 「유해·위험요인을 확인·개선하는 절차」의 결과를 관리대상 확인용으로 본다. */
export default async function Risk({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const graph = sp.g || "";

  const scope = await riskScope(sp.wp, sp.dept);
  const { ra, ri, wps, raAll, riAll } = scope;
  const deptList = await depts();
  const deptName = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map((await staff()).map((s: any) => [s.staff_id, s.display_name]));
  const wpName = new Map(wps.map((w: any) => [w.wp_id, w.wp_name]));

  // 주소 — 사업장·부서 범위를 이어 붙인다
  const base: Record<string, string> = { role };
  if (sp.wp) base.wp = sp.wp;
  if (sp.dept) base.dept = sp.dept;
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(base);
    Object.entries(o).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return `/risk?${p.toString()}`;
  };

  const cnt = riskCounts(ra, ri);
  const lvSlices = ["높음", "보통", "낮음"].map((l, i) => ({
    label: l, n: ri.filter((x: any) => x.risk_level === l).length,
    tone: (["bad", "warn", "none"] as const)[i],
  }));
  const kindMap = new Map<string, number>();
  ri.forEach((x: any) => kindMap.set(x.hazard_kind, (kindMap.get(x.hazard_kind) || 0) + 1));
  const kindSlices = [...kindMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));

  const sel = ra.some((x: any) => x.risk_id === sp.r) ? sp.r : ra[0]?.risk_id;
  const cur = ra.find((x: any) => x.risk_id === sel);
  const curItems = cur ? ri.filter((x: any) => x.risk_id === cur.risk_id)
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0)) : [];

  // 돌아가는 길 — 사업장을 골라 들어왔으면 그 사업장 기본정보 상세로 · 아니면 사업장 목록으로
  //   부서만 골라 들어왔으면(관리대상 현황 › 사업장 › 부서 보기의 상세) 그 부서 상세로
  const back = scope.wp
    ? { href: `/targets/basic/${encodeURIComponent(scope.wp.wp_id)}?t=ws&role=${role}`, label: `← ${scope.wp.wp_name} 기본정보로` }
    : scope.dept
      ? { href: `/targets/basic/${encodeURIComponent(scope.dept)}?t=ws&k=dept&role=${role}`, label: `← ${deptName.get(scope.dept) || scope.dept} 기본정보로` }
      : { href: `/targets/basic?t=ws&role=${role}`, label: "← 사업장 목록으로" };
  // 목록 보기 = 사업장 하나 또는 부서 하나 · 요약 보기 = 아무것도 고르지 않음(20곳 요약에서 고른다)
  const listMode = scope.kind === "wp" || (scope.kind === "all" && !!scope.dept);
  const sumMode = scope.kind === "all" && !scope.dept;
  const scopeName = scope.wp ? scope.wp.wp_name : scope.dept ? String(deptName.get(scope.dept) || scope.dept) : "";
  // 부서 좁히기 — 고른 사업장의 평가에 부서가 둘 이상일 때
  const wpRa = scope.kind === "wp" ? raAll.filter((a: any) => wpOfRisk(a) === scope.wp!.wp_id) : [];
  const deptsWithRa = [...new Set(wpRa.map((x: any) => x.dept_id).filter(Boolean))];

  // 도급 현장 위험요인 — 계약 표에는 사업장 칸이 없어 전체 보기에서만 보인다(부서로만 이어진다)
  const showCtr = scope.kind === "all";
  const ctr = showCtr ? await contracts() : [];
  const chz = showCtr
    ? (await contractHazards()).filter((h: any) => !scope.dept || ctr.find((c: any) => c.contract_id === h.contract_id)?.dept_id === scope.dept)
    : [];

  return (
    <UsLayout side={<B1Side role={role} on="ws" />}>
      <PageHead sub="사업장" title={scopeName ? `위험성평가(조회) — ${scopeName}` : "위험성평가(조회)"}
        right={<Link className="usb1-btn-o" href={back.href}>{back.label}</Link>} />
      <div className="d26-ro">
        <b>위험성평가는 지원 시스템에서 입력합니다 — 여기서는 관리대상 확인용으로 조회만 합니다.</b>
        <span>중대재해 처벌 등에 관한 법률 시행령 제4조제3호 — 유해·위험요인을 확인하고 개선하는 절차</span>
      </div>

      {scope.kind === "unknown" && (
        <div className="usb1-note">사업장을 찾지 못했습니다. <Link href={`/risk?role=${role}`}>사업장 20곳 위험성평가 보기</Link></div>
      )}

      {scope.kind !== "unknown" && (
        <div className="grid g5" style={{ marginTop: 12 }}>
          <Stat n={cnt.n} l="평가" />
          <Stat n={cnt.items} l="확인한 유해·위험요인" />
          <Stat n={cnt.high} l="위험 수준 높음" tone="bad" />
          <Stat n={cnt.open} l="개선조치 미완" tone="warn" />
          <Stat n={`${Math.round(((cnt.items - cnt.open) / (cnt.items || 1)) * 100)}%`} l="개선조치 완료율" tone="ok" />
        </div>
      )}

      {/* ── 사업장을 고르지 않았을 때: 20곳 요약에서 고른다 ── */}
      {sumMode && (
        <>
          <h2 className="usb1-sec">사업장별 위험성평가 <small className="d26-sm">사업장을 누르면 그 사업장의 평가가 열립니다</small></h2>
          <div className="d26-scroll">
            <table className="us-tbl usb1-list d26-rsum">
              <thead><tr>
                <th>구분</th><th>사업장</th><th>평가</th><th>최근 평가일</th>
                <th>높음</th><th>보통</th><th>낮음</th><th>조치 미완</th><th>진행 중 · 계획</th>
              </tr></thead>
              <tbody>
                {wps.map((w: any) => {
                  const wr = raAll.filter((a: any) => wpOfRisk(a) === w.wp_id);
                  const k = riskCounts(wr, riAll);
                  return (
                    <tr key={w.wp_id}>
                      <td className="c">{w.wp_kind || "-"}</td>
                      <td><Link href={`/risk?wp=${encodeURIComponent(w.wp_id)}&role=${role}`}>{w.wp_name}</Link></td>
                      <td className="c">{k.n ? `${k.n}건` : <span className="usb1-muted">자료 없음</span>}</td>
                      <td className="c">{k.last || "-"}</td>
                      <td className="c">{k.high ? <span className="badge bad">{k.high}</span> : "0"}</td>
                      <td className="c">{k.mid}</td>
                      <td className="c">{k.low}</td>
                      <td className="c">{k.open ? <b className="d26-open">{k.open}</b> : "0"}{k.openHigh ? <small className="d26-oh"> (높음 {k.openHigh})</small> : null}</td>
                      <td className="c">{k.ing || k.plan ? `${k.ing} · ${k.plan}` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 사업장 하나: 평가 목록 → 평가를 누르면 유해·위험요인 표 ── */}
      {listMode && (
        <>
          {deptsWithRa.length > 1 && (
            <div className="d26-scope">
              <span className="d26-scope-l">부서</span>
              <span className="d26-depts">
                <Link href={href({ dept: undefined, r: undefined })} className={!scope.dept ? "on" : ""}>전체</Link>
                {deptList.filter((d: any) => deptsWithRa.includes(d.dept_id)).map((d: any) => (
                  <Link key={d.dept_id} href={href({ dept: d.dept_id, r: undefined })} className={scope.dept === d.dept_id ? "on" : ""}>{d.dept_name}</Link>
                ))}
              </span>
            </div>
          )}

          {ra.length === 0 ? (
            <div className="usb1-note">이 {scope.wp ? "사업장" : "부서"}에 연결된 위험성평가 자료가 없습니다. <Link href={`/risk?role=${role}`}>사업장 20곳 요약 보기</Link></div>
          ) : (
            <>
              <h2 className="usb1-sec">평가 목록 <small className="d26-sm">{ra.length}건 · 평가를 누르면 유해·위험요인이 열립니다</small></h2>
              <div className="d26-scroll">
                <table className="us-tbl usb1-list d26-ralist">
                  <thead><tr><th>구분</th><th>평가</th><th>방법</th><th>평가일</th><th>상태</th><th>확인된 관리대상(설비·물질·장소)</th></tr></thead>
                  <tbody>
                    {ra.map((x: any) => (
                      <tr key={x.risk_id} className={x.risk_id === sel ? "d26-sel" : ""}>
                        <td className="c">{x.kind || "-"}</td>
                        <td><Link href={`${href({ r: x.risk_id, g: graph || undefined })}#rd`}>{x.title}</Link>
                          <div className="usb1-muted">{x.place}{!scope.wp ? ` · ${wpName.get(wpOfRisk(x)) || wpOfRisk(x)}` : ""}{x.dept_id ? ` · ${deptName.get(x.dept_id) || x.dept_id}` : ""}</div></td>
                        <td className="c">{x.method || "-"}</td>
                        <td className="c">{x.assessed_at || "-"}</td>
                        <td className="c"><span className={`badge ${statusTone(x.status)}`}>{x.status || "-"}</span></td>
                        <td>{targetsOf(x).length
                          ? <span className="d26-tgts">{targetsOf(x).map((t) => <span key={t}>{t}</span>)}</span>
                          : <span className="usb1-muted">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {cur && (
                <section id="rd" className="d26-rd">
                  <h2 className="usb1-sec">{cur.title}</h2>
                  <div className="chips" style={{ marginTop: 10 }}>
                    {cur.kind && <span className="badge">{cur.kind}</span>}
                    <span className="badge">{cur.method}</span>
                    <span className="badge">평가일 {cur.assessed_at}</span>
                    <span className={`badge ${statusTone(cur.status)}`}>{cur.status}</span>
                    <span className={`badge ${cur.worker_joined === "Y" ? "ok" : "bad"}`}>종사자 참여 {cur.worker_joined === "Y" ? "있음" : "없음"}</span>
                    {cur.review_cycle && <span className="badge none">{cur.review_cycle}{cur.next_due ? ` · 다음 ${cur.next_due}` : ""}</span>}
                  </div>
                  <table className="usb1-wpinfo d26-rinfo">
                    <tbody>
                      <tr><th>평가 장소</th><td>{cur.place || "-"}</td>
                        <th>담당 부서 · 평가자</th><td>{cur.dept_id ? deptName.get(cur.dept_id) || cur.dept_id : "-"}
                          {cur.assessor_staff_id ? ` · ${staffName.get(cur.assessor_staff_id) || cur.assessor_staff_id}` : ""}</td></tr>
                      <tr><th>확인된 관리대상</th><td colSpan={3}>{targetsOf(cur).length
                        ? <span className="d26-tgts">{targetsOf(cur).map((t) => <span key={t}>{t}</span>)}</span>
                        : <span className="usb1-muted">지원 시스템 자료에 적힌 관리대상이 없습니다</span>}</td></tr>
                      <tr><th>자료 출처</th><td colSpan={3}>{cur.source || "위험성평가 지원 시스템"}</td></tr>
                    </tbody>
                  </table>

                  <h3 className="usb1-h3">유해·위험요인과 개선 조치 <small className="d26-sm">{curItems.length}건 · 위험성(빈도×강도) 높은 순</small></h3>
                  <div className="d26-scroll">
                    <table className="us-tbl d26-hz">
                      <thead><tr>
                        <th>유해·위험요인</th><th>분류</th><th>빈도</th><th>강도</th><th>위험성</th><th>위험 수준</th>
                        <th>현재 안전조치</th><th>개선대책</th><th>기한</th><th>완료</th><th>잔여 위험</th>
                      </tr></thead>
                      <tbody>
                        {curItems.map((x: any) => (
                          <tr key={x.risk_item_id}>
                            <td><b>{x.hazard_factor}</b></td>
                            <td className="c">{x.hazard_kind || "-"}</td>
                            <td className="c">{x.freq || "-"}</td>
                            <td className="c">{x.sev || "-"}</td>
                            <td className="c">{x.score || "-"}</td>
                            <td className="c"><span className={`badge ${levelTone(x.risk_level)}`}>{x.risk_level || "-"}</span></td>
                            <td>{x.current_measure || "-"}</td>
                            <td>{x.measure || "-"}</td>
                            <td className="c">{x.measure_due || "-"}</td>
                            <td className="c">{x.measure_done_at
                              ? <span className="badge ok">{x.measure_done_at}</span>
                              : <span className="badge bad">미완</span>}</td>
                            <td className="c">{x.residual_level ? <span className={`badge ${levelTone(x.residual_level)}`}>{x.residual_level}</span> : "-"}</td>
                          </tr>
                        ))}
                        {!curItems.length && <tr><td className="c" colSpan={11}>이 평가에 적힌 유해·위험요인이 없습니다(평가 계획 단계).</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ── 분포(사업장 전체 또는 고른 사업장) ── */}
      {ri.length > 0 && (
        <>
          <h2 className="usb1-sec d26-dist">위험요인 분포
            <ChartSwitch base="/risk" sp={sp as Record<string, string>} cur={graph} />
          </h2>
          <div className="grid g2" style={{ marginTop: 10 }}>
            <div className="card">
              <h3>위험 수준별</h3>
              {graph === "pie" ? <Donut slices={lvSlices} center={String(ri.length)} sub="위험요인" /> : <BarGroup slices={lvSlices} />}
            </div>
            <div className="card">
              <h3>분류별</h3>
              {graph === "pie" ? <Donut slices={kindSlices} /> : <BarGroup slices={kindSlices} />}
            </div>
          </div>
        </>
      )}

      {chz.length > 0 && (
        <>
          <h2 className="usb1-sec">도급·용역·위탁 현장의 위험요인 <small className="d26-sm">중대재해처벌법 제5조 · 계약을 누르면 계약 상세가 열립니다</small></h2>
          <div className="d26-scroll" style={{ maxHeight: 420 }}>
            <table className="us-tbl usb1-list">
              <thead><tr><th>계약</th><th>장소</th><th>위험요인</th><th>위험 수준</th><th>조치</th></tr></thead>
              <tbody>
                {chz.slice(0, 60).map((h: any) => {
                  const c: any = ctr.find((x: any) => x.contract_id === h.contract_id);
                  return (
                    <tr key={h.hazard_id}>
                      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 /contracts?c= → 관리대상 현황 › 도급·용역·위탁 현황의 계약 상세 */}
                      <td><Link href={`/targets/contract/${encodeURIComponent(h.contract_id)}?role=${role}#s2`}>{c?.contract_name || h.contract_id}</Link>
                        <div className="usb1-muted">{c?.counterpart} · {c?.contract_type}</div></td>
                      <td>{h.hazard_place}</td><td>{h.hazard_factor}</td>
                      <td className="c"><span className={`badge ${levelTone(h.risk_level)}`}>{h.risk_level}</span></td>
                      <td>{h.measure}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </UsLayout>
  );
}
