// [400 · 교육자료 버전] SCR-006 · 007 · 008 · 009 — 메인(대시보드). 위젯 5종 배치는 네 화면 모두 같고, 역할에 따라 데이터 범위만 다르다(명세 01 공통 구현 메모 3).
/**
 *   담당 중대재해 대상 / 시기도래 + 기한 초과 / 알림 / 의무이행(실적증빙) 이행률·등급·반기 막대·표 / 안전·보건 확보의무(잔여/전체) 2×2
 * 범위: 경영책임자·총괄 = 전 기관 · 관리자(사업소·실/국 자리) = 안전총괄과와 그 아래 부서 · 담당자(사업장·부서 자리) = 자기 부서.
 * 숫자는 모두 우리 데이터(과제·자산·원료·제조물·알림)에서 센다 — 명세 숫자는 더미라 쓰지 않는다.
 */
import { canAccess } from "@/lib/perm";
import { floor1 } from "@/lib/num";   // 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
import { judgeMap, withJudges, openDues } from "@/lib/us/links";
import Link from "next/link";
import { assetSeed, readTable, notifications, staff, type Row } from "@/lib/data";
import ScrollBox from "@/components/us/ScrollBox";
import StatusSide from "./status/_parts/StatusSide";
import FoldGroup from "@/components/us/FoldGroup";
import { cookies } from "next/headers";
import { ymd } from "@/lib/day";
import { GradeBar } from "@/components/us/Parts";
import ParamSelect from "./status/_parts/ParamSelect";
import { scopeOf, inScope, taskRows, recordRows, yearsOf, thisYear, gradeClass, pct2, rateOf, type Mark } from "./status/_lib/calc";
import { withDbReadTrace } from "@/lib/db";

// 09-25 사용자: 좁은 칸에서는 법제처 공식 약칭으로(마우스를 올리면 정식 이름). 약칭은 법제처 법령약칭명 그대로만 쓴다.
const LAW_ABBR: Record<string, string> = {
  "저수지ㆍ댐의 안전관리 및 재해예방에 관한 법률": "저수지댐법",
  "저수지·댐의 안전관리 및 재해예방에 관한 법률": "저수지댐법",
};
const lawAbbr = (s: string) => LAW_ABBR[s.trim()] || s;

export const dynamic = "force-dynamic";

/** 안전·보건 확보의무 4묶음 — 우리 의무조항 36 코드(지침 5장). 도급인 안전보건 확보(I14·F13)는 ①에 둔다. */
const SECURE: { n: number; title: string[]; codes: string[]; g: number }[] = [
  { n: 1, g: 1, title: ["안전보건관리체계", "구축·이행"], codes: ["I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "I09", "I14", "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F13", "M01", "M02", "M03", "M04", "M05"] },
  { n: 2, g: 2, title: ["재해발생 시", "재발방지대책", "수립·이행"], codes: ["I10", "F09", "M06"] },
  { n: 3, g: 3, title: ["행정기관이", "개선 ·시정", "명한 사항 이행"], codes: ["I11", "F10", "M07"] },
  { n: 4, g: 4, title: ["안전 · 보건", "관계 법령상", "의무이행"], codes: ["I12", "I13", "F11", "F12", "M08", "M09"] },
];
// 안전·보건 확보의무 제목 — 의미 단위 2줄(09-24 사용자: 제목·건수 각 2줄)
const TITLE2: Record<number, string[]> = {
  1: ["안전보건관리체계", "구축·이행"],
  2: ["재해발생 시 재발방지대책", "수립·이행"],
  3: ["행정기관이 개선·시정", "명한 사항 이행"],
  4: ["안전·보건 관계 법령상", "의무이행"],
};
const TGT = [
  { v: "F", label: "공중이용시설·공중교통수단" },
  { v: "I", label: "사업장" },
  { v: "M", label: "원료·제조물" },
];
const dot = (d?: string) => String(d || "").slice(0, 10).replace(/-/g, ".");
const plusDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + n); return ymd(x); };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return withDbReadTrace("/", () => renderDashboard({ searchParams }));
}

async function renderDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const year = sp.year || thisYear();
  const tgt = TGT.some((t) => t.v === sp.tgt) ? sp.tgt : "F";
  const today = ymd();
  const sc = await scopeOf(role);
  const TRK: Record<string, "ws" | "fc" | "mt"> = { I: "ws", F: "fc", M: "mt" };

  const [allTasks, years, mats, st, notes, transports, workplaces, judgeMaps] = await Promise.all([
    taskRows(), yearsOf(), readTable("material_item", "item_id"), staff(), notifications(),
    readTable("usb1_transport", "tr_id").catch(() => [] as Row[]),
    readTable("usb1_workplace", "wp_id").catch(() => [] as Row[]),
    Promise.all([judgeMap("ws", year), judgeMap("fc", year), judgeMap("mt", year)]),
  ]);
  // 화면 사이 연결(lib/us/links): 점검 판정은 의무이행 기록·이행률에 반영(과제는 과제 상태 그대로), 이행 시기는 시기도래·기한 초과에
  // 세 트랙 판정을 한데(의무조항 코드가 트랙마다 달라 겹치지 않는다)
  const jm = new Map([...judgeMaps[0], ...judgeMaps[1], ...judgeMaps[2]]);
  const mine = allTasks.filter((t) => inScope(sc, t.dept_id));

  /* ── 중대재해 관리대상 ── */
  // 사업장 — 용인시청 본청 하나(09-24 사용자 지시). 공중이용시설·공중교통수단 — 자산 대장에서 중처법 제외로 판정된 것은 뺀다(검토 필요는 남긴다).
  // 09-24 사용자 「교량 459개소 — 저렇게 많아?」 → 관리주체(축1)가 용인시로 확인된 시설만 센다. 관리주체 확인이 필요한 시설은 따로 한 줄.
  //   (FMS 는 관할 구역 목록이라 한국도로공사·국토관리사무소·경기도 등 다른 기관 시설이 섞여 있다 — 메모리 adoms-subject-vs-target-2axis)
  const facAll = assetSeed().filter((a) => inScope(sc, a.dept_id) && a.sapa_l2_result !== "제외");
  const facs = facAll.filter((a) => !a.subject_tier || a.subject_tier === "용인시");
  const facPend = facAll.filter((a) => a.subject_tier === "확인필요").length;
  // 관계법령 관리시설 — 중대재해처벌법 관리대상은 아니나 관계법령(예: 저수지ㆍ댐의 안전관리 및 재해예방에 관한 법률) 의무가 걸리는 용인시 시설(09-24)
  const relFacs = assetSeed().filter((a) => inScope(sc, a.dept_id) && a.mgmt_class === "관계법령 관리시설" && (!a.subject_tier || a.subject_tier === "용인시"));
  // 위탁 시설(용인도시공사 운영) — 별도 경영책임자(지방공기업의 장)이나 용인시 소유·위탁이면 용인시장 의무도 걸린다(확인 전 · 09-24)
  const consFacs = assetSeed().filter((a) => inScope(sc, a.dept_id) && a.consign);
  const relRows = [...relFacs.reduce((m, a) => { const k = `${a.asset_gbn}|${String(a.mgmt_laws || "").split(" · ")[0]}`; return m.set(k, (m.get(k) || 0) + 1); }, new Map<string, number>()).entries()]
    .sort((x, y) => y[1] - x[1]);
  const byGbn = new Map<string, number>();
  facs.forEach((a) => byGbn.set(a.asset_gbn || "기타", (byGbn.get(a.asset_gbn || "기타") || 0) + 1));
  const facRows = [...byGbn.entries()].sort((a, b) => b[1] - a[1]);
  const trIn = transports.filter((t: Row) => inScope(sc, t.dept_id) && t.deleted !== "Y");
  const matIn = mats.filter((m) => inScope(sc, m.dept_id) && m.verdict !== "비해당" && m.deleted !== "Y");
  const byMat = new Map<string, number>();
  matIn.forEach((m) => { const k = String(m.item_name || "").split("(")[0].trim(); byMat.set(k, (byMat.get(k) || 0) + 1); });
  // 사업장 — 20곳(09-24 사용자 지시 · 전부 확인 필요)을 구분별로 센다. 부서 범위가 있는 역할은 자기 부서가 속한 본청 한 곳.
  const wpAll = workplaces.filter((w: Row) => w.deleted !== "Y");
  const wpIn = sc ? wpAll.filter((w: Row) => w.wp_id === "WP-01") : wpAll;
  const wpByKind = new Map<string, number>();
  wpIn.forEach((w: Row) => wpByKind.set(w.wp_kind || "사업장", (wpByKind.get(w.wp_kind || "사업장") || 0) + 1));
  const wpRows: [string, number][] = wpIn.length === 1 ? [[String(wpIn[0].wp_name), 1]] : [...wpByKind.entries()];
  const groups = [
    { label: "사업장", n: wpIn.length || 1, rows: wpIn.length ? wpRows : [["용인시청 본청", 1]] as [string, number][] },
    // 09-24: 공중교통수단(용인경전철 — 교육자료 버전 표 usb1_transport)을 함께 센다(전에는 시설 대장만 세어 빠져 있었다)
    { label: "공중이용시설·공중교통수단", n: facs.length + trIn.length, rows: [...facRows, ...(trIn.length ? [["경전철", trIn.length] as [string, number]] : [])] },
    { label: "원료·제조물", n: matIn.length, rows: [...byMat.entries()] },
  ].filter((g) => g.n > 0);
  const totalN = groups.reduce((s, g) => s + g.n, 0);
  const matN = groups.find((g) => g.label === "원료·제조물")?.n || 0;
  // 접은 묶음(09-24 사용자: 한번 접으면 다음에 열어도 접힌 채) — 쿠키 adoms_fold
  const fold = new Set(decodeURIComponent((await cookies()).get("adoms_fold")?.value || "").split(",").filter(Boolean));


  /* ── 시기도래 · 기한 초과 ── */
  // 법 의무사항에서 정한 이행 시기 중 아직 이행 기록이 없는 것도 함께 센다
  const deptOfAsset = new Map(assetSeed().map((a) => [a.asset_id, a.dept_id]));
  const deptOfMat = new Map(mats.map((m: Row) => [m.item_id, m.dept_id]));
  const deptOfTr = new Map(transports.map((t: Row) => [t.tr_id, t.dept_id]));
  const [dueRows, recordResult] = await Promise.all([
    openDues(year, (t, id) => t === "ws" ? (id === "HQ" ? "D01" : "") :   // 09-25: 사업장 20곳 — 본청(HQ)만 안전총괄과 몫, 나머지 사업장은 사업장 단위 확정 전이라 세지 않음
 t === "mt" ? String(deptOfMat.get(id) || "") : String(deptOfAsset.get(id) || deptOfTr.get(id) || ""))
      .then((rows) => rows.filter((d) => inScope(sc, d.dept_id))),
    recordRows(TRK[tgt] || "fc", year),
  ]);
  const dues = dueRows;
  const duesUp = dues.filter((d) => d.due >= today);
  const pending = mine.filter((t) => t.status === "이행대기" || t.status === "조치필요");
  const upcoming = pending.filter((t) => String(t.due_date) >= today);
  const within = (n: number) => upcoming.filter((t) => String(t.due_date) <= plusDays(today, n)).length + duesUp.filter((d) => d.due <= plusDays(today, n)).length;
  const overdue = mine.filter((t) => (t.status === "기간초과" || ((t.status === "이행대기" || t.status === "조치필요") && String(t.due_date) < today))).length
    + dues.filter((d) => d.due < today).length;

  /* ── 알림 ── 총괄·경영책임자는 전 기관, 그 밖은 범위 안 사람에게 온 것 */
  const who = new Map(st.map((s: Row) => [s.staff_id, s]));
  const myNotes = notes.filter((n: Row) => !sc || inScope(sc, who.get(n.to_staff_id)?.dept_id));
  const showAll = sp.alarm === "all";
  const noteList = myNotes.slice(0, showAll ? 30 : 3);   // 09-24 사용자: 기본 3건(얇은 선 칸)

  /* ── 의무이행(실적증빙) ── 년도 × 대상 × 반기 */
  // 이행현황 표와 같은 원천 — 과제 + 의무이행(실적증빙) 화면에 직접 적은 기록(09-24 사용자: 이행률은 대시보드 기준으로 하나)
  const recs = recordResult.filter((r) => inScope(sc, r.dept_id));
  const perf = withJudges([...mine.filter((t) => t.year === year && t.area === tgt), ...recs], new Map([...jm].filter(([k]) => k.split("|")[1]?.startsWith(tgt)))).filter((r) => inScope(sc, r.dept_id));
  type C = { O: number; T: number; X: number; N: number; W: number };
  const tally = (rows: Row[]): C => {
    const c: C = { O: 0, T: 0, X: 0, N: 0, W: 0 };
    rows.forEach((r) => { const m = r.mark as Mark; if (m === "O") c.O++; else if (m === "△") c.T++; else if (m === "X") c.X++; else if (m === "-") c.N++; else c.W++; });
    return c;
  };
  const cAll = tally(perf), cH1 = tally(perf.filter((t) => t.half === "상반기")), cH2 = tally(perf.filter((t) => t.half === "하반기"));
  const rAll = rateOf(cAll), rH1 = rateOf(cH1), rH2 = rateOf(cH2);
  const sum = (c: C) => c.O + c.T + c.X + c.N;
  // 09-24 사용자: 진행률 = 이행완료 ÷ (그 반기 전체 과제 — 이행 시기 전 과제 포함). 이행률은 기한이 지난 과제만 센다.
  const prog = (c: C) => { const d = c.O + c.T + c.X + c.W; return d ? (c.O / d) * 100 : null; };

  /* ── 안전·보건 확보의무(잔여/전체) ── 올해 과제, 해당없음은 뺀다 */
  const yearTasks = mine.filter((t) => t.year === year && t.mark !== "-");
  const secure = SECURE.map((s) => {
    const rows = yearTasks.filter((t) => s.codes.includes(t.code));
    return { ...s, total: rows.length, left: rows.filter((t) => t.mark !== "O").length };
  });
  // 09-25 사용자(권한 제어): 이행현황 상세는 경영책임자·총괄·관리자만 — 사업장·부서에게는 상세로 가는 길을 두지 않는다(lib/perm.ts)
  const canStatus = canAccess(role, "/status/industrial");
  const trackOfArea = tgt === "I" ? `/status/industrial?role=${role}` : `/status/civil?role=${role}&t=${tgt === "M" ? "mt" : "fc"}`;

  return (
    <div className="usa-dash">
      {/* 중대재해 관리대상(09-24 이름 바꿈 — 전: 담당 중대재해 대상) */}
      {/* 09-25 사용자(가안): 대시보드에도 이행현황 좌측 메뉴를 두고, 「중대재해 관리대상」 칸은 그 아래로 — 모든 화면에서 좌측 메뉴가 같게 */}
      <div className="usa-d-left">
      <StatusSide on="main" role={role} className="us-side usa-d-menu" />
      <section className="usa-d-target">
        <h2 className="usa-d-h">중대재해 관리대상</h2>
        {/* 09-24 사용자: 꺽쇠는 고정이 아니라 내용이 잘릴 때만 맨 아래에 */}
        <ScrollBox className="usa-d-tbox scroll">
          {/* 09-25 사용자: 장소(개소)와 원료·제조물(종)은 단위가 달라 — 총계는 「개」로 두고 아래에 구성을 한 줄 */}
          <div className="usa-d-total">총 <b>{totalN.toLocaleString()}</b>개</div>
          <div className="usa-d-comp">시설·장소 {(totalN - matN).toLocaleString()}개소 · 원료·제조물 {matN.toLocaleString()}종</div>
          {groups.map((g) => {
            const u = g.label === "원료·제조물" ? "종" : "개소";   // 원료·제조물은 품목 종류
            return (
            <FoldGroup key={g.label} id={g.label} folded={fold.has(g.label)} className="usa-d-grp"
              label={g.label} right={<><b>{g.n.toLocaleString()}</b>{u}</>}>
              {g.rows.map(([k, n]) => (
                <div key={k} className="usa-d-row"><span>- {k}</span><span><b>{n.toLocaleString()}</b>{u}</span></div>
              ))}
              {g.label === "사업장" && g.n > 1 && (
                <div className="usa-d-row" title="사업장 단위(안전보건관리책임자 선임 단위)는 용인시 확인 뒤 정합니다. 이행 과제는 용인시청 본청에만 있습니다.">
                  <span style={{ color: "var(--us-mut)" }}>※ 사업장 단위 확인 필요</span><span style={{ color: "var(--us-mut)" }}>{g.n.toLocaleString()}개소</span>
                </div>
              )}
              {g.label === "공중이용시설·공중교통수단" && facPend > 0 && (
                <div className="usa-d-row" title="관할 구역 안에 있으나 관리주체(용인시·다른 기관)를 아직 확인하지 못한 시설 — 총계에 넣지 않음">
                  <span style={{ color: "var(--us-mut)" }}>※ 관리주체 확인 필요</span><span style={{ color: "var(--us-mut)" }}>{facPend.toLocaleString()}개소</span>
                </div>
              )}
            </FoldGroup>
            );
          })}
          {relFacs.length > 0 && (
            <FoldGroup id="관계법령 관리시설" folded={fold.has("관계법령 관리시설")} className="usa-d-grp usa-d-rel"
              label={<>관계법령 관리시설<small className="usa-d-sub">중처법 대상 아님</small></>} right={<><b>{relFacs.length.toLocaleString()}</b>개소</>}>
              {relRows.map(([k, n]) => {
                const [g, law] = k.split("|");
                return <div key={k} className="usa-d-row" title={law}><span>- {g} <small className="usa-d-law">{lawAbbr(law)}</small></span><span><b>{n.toLocaleString()}</b>개소</span></div>;
              })}
            </FoldGroup>
          )}
          {consFacs.length > 0 && (
            <FoldGroup id="위탁 시설" folded={fold.has("위탁 시설")} className="usa-d-grp usa-d-rel" title="소유·위탁 관계 확인 전 — 용인시 소유·위탁이면 중대재해처벌법 제9조제3항으로 용인시장 의무도 걸림"
              label={<>위탁 시설<small className="usa-d-sub">용인도시공사 운영 · 확인 필요</small></>} right={<><b>{consFacs.length.toLocaleString()}</b>개소</>}>
              {[...consFacs.reduce((m, a) => m.set(a.asset_gbn, (m.get(a.asset_gbn) || 0) + 1), new Map<string, number>()).entries()].map(([g, n]) => (
                <div key={g} className="usa-d-row"><span>- {g}</span><span><b>{n.toLocaleString()}</b>개소</span></div>
              ))}
            </FoldGroup>
          )}
        </ScrollBox>
      </section>
      </div>

      {/* 09-24 사용자: 기관장 예방활동 칸은 뺌 — 대시보드에 올릴 내용이 아니고 메뉴(기관장 예방활동)에 있다 */}

      <div className="usa-d-right">
        <div className="usa-d-top">
          {/* 시기도래 */}
          <section className="usa-d-due">
            <h2 className="usa-d-h">시기도래</h2>
            <Link href={`/tasks?role=${role}`} className="usa-d-duebox">
              <div className="usa-d-total">총 <b>{(upcoming.length + duesUp.length).toLocaleString()}</b>건</div>
              <div className="usa-d-row"><span>1개월 이내</span><span><b>{within(30)}</b>건</span></div>
              <div className="usa-d-row"><span>1주일 이내</span><span><b>{within(7)}</b>건</span></div>
              <div className="usa-d-row today"><span>오늘 마감</span><span><b>{within(0)}</b>건</span></div>
            </Link>
          </section>
          {/* 기한 초과 */}
          <section className="usa-d-over">
            <h2 className="usa-d-h">기한 초과</h2>
            <Link href={`/tasks?role=${role}&status=기간초과`} className="usa-d-overbox">
              <span className="usa-d-overcap">이행 기한이 지난 과제</span>
              <span className="usa-d-overn"><b>{overdue.toLocaleString()}</b> 건</span>
            </Link>
          </section>
          {/* 알림 */}
          <section className="usa-d-alarm">
            <h2 className="usa-d-h">알림 <Link className="usa-plus" href={showAll ? `/?role=${role}` : `/?role=${role}&alarm=all`} title={showAll ? "접기" : "더 보기"}>{showAll ? "−" : "+"}</Link></h2>
            <ul className={`usa-d-notes usa-d-notebox${showAll ? " all" : ""}`}>
              {noteList.map((n: Row) => (
                <li key={n.notif_id} title={n.message}><span className="usa-d-msg">{n.message}</span><span className="usa-d-date">{dot(n.sent_at)}</span></li>
              ))}
              {!noteList.length && <li className="usa-mut">새 알림이 없습니다.</li>}
            </ul>
          </section>
        </div>

        <div className="usa-d-bottom">
          {/* 의무이행(실적증빙) */}
          <section className="usa-d-perf">
            <h2 className="usa-d-h">의무이행 <small>(실적증빙)</small></h2>
            <div className="usa-d-perfbox">
              <div className="usa-d-rate">
                <div className="usa-d-rateh"><span>전체 이행률</span><b className="usa-d-ratev">{rAll === null ? "-" : <>{floor1(rAll).toFixed(1)}<small>%</small></>}</b></div>
                {/* 09-24 사용자: 더 중요한 지표는 미이행률(= 100 − 이행률, 기한이 지났는데 이행 못 한 비율) */}
                <div className="usa-d-miss"><span>미이행률</span><b>{rAll === null ? "-" : <>{(100 - floor1(rAll)).toFixed(1)}<small>%</small></>}</b></div>
                <GradeBar pct={rAll ?? 0} />
                <div className="usa-d-bars">
                  {[["상반기", rH1], ["하반기", rH2]].map(([h, r]) => (
                    <div key={h as string} className="usa-d-barc">
                      <div className="usa-d-bart">
                        <div className={`usa-d-bar ${gradeClass(r as number | null)}b`} style={{ height: `${Math.max(4, (r as number | null) ?? 0)}%` }}>
                          <span>{pct2(r as number | null)}</span>
                        </div>
                      </div>
                      <div className="usa-d-barl">{h}<small className="usa-d-prog">진행 {pct2(prog(h === "상반기" ? cH1 : cH2))}</small></div>
                    </div>
                  ))}
                </div>
                {/* 09-24 사용자: 박스 아래 빈 곳에 지표의 뜻을 짧게 */}
                <dl className="usa-d-def">
                  <div><dt>이행률</dt><dd>기한이 지난 과제 중 이행 완료 비율</dd></div>
                  <div className="m"><dt>미이행률</dt><dd>100 − 이행률(보완필요 + 미이행)</dd></div>
                  <div><dt>진행</dt><dd>반기 전체 과제(기한 전 포함) 중 이행 완료 비율</dd></div>
                </dl>
              </div>
              <div className="usa-d-tbl">
                <div className="usa-d-filter">
                  <label><b>년도</b><ParamSelect name="year" value={year} options={years.map((y) => ({ v: y, label: y }))} /></label>
                  <label><b>대상</b><ParamSelect name="tgt" value={tgt} options={TGT.map((t) => ({ v: t.v, label: t.label }))} /></label>
                </div>
                <table className="usa-d-t">
                  <thead><tr><th>의무이행</th><th>전체</th><th>상반기</th><th>하반기</th></tr></thead>
                  <tbody>
                    <tr className="usa-d-rrow"><th>이행률</th>
                      {[rAll, rH1, rH2].map((r, i) => <td key={i} className={gradeClass(r)}>{pct2(r)}</td>)}</tr>
                    <tr className="usa-d-mrow" title="100 − 이행률 · 기한이 지났는데 이행하지 못한(보완필요·미이행) 비율"><th>미이행률</th>
                      {[rAll, rH1, rH2].map((r, i) => <td key={i}>{r === null ? "-" : pct2(100 - (r as number))}</td>)}</tr>
                    <tr><td>이행완료</td><td>{cAll.O}</td><td>{cH1.O}</td><td>{cH2.O}</td></tr>
                    <tr><td>보완필요</td><td>{cAll.T}</td><td>{cH1.T}</td><td>{cH2.T}</td></tr>
                    <tr><td>미이행</td><td>{cAll.X}</td><td>{cH1.X}</td><td>{cH2.X}</td></tr>
                    <tr><td>해당없음</td><td>{cAll.N}</td><td>{cH1.N}</td><td>{cH2.N}</td></tr>
                    <tr className="usa-d-sum"><th>합 계</th><td>{sum(cAll)}</td><td>{sum(cH1)}</td><td>{sum(cH2)}</td></tr>
                    <tr className="usa-d-prow" title="이행완료 ÷ 그 반기 전체 과제(이행 시기 전 과제 포함)"><td>진행률<small>시기 전 포함</small></td>
                      {[cAll, cH1, cH2].map((c, i) => <td key={i}>{pct2(prog(c))}</td>)}</tr>
                  </tbody>
                </table>
                <div className="usa-d-foot">
                  {/* 명세에 없는 줄 — 이행 시기가 아직 오지 않은 과제는 합계·이행률에서 뺀 것을 밝힌다 */}
                  <span className="usa-mut">이행 시기 전 과제 {cAll.W.toLocaleString()}건은 제외</span>
                  {canStatus && <Link href={trackOfArea} className="usa-d-more">이행현황 보기 ›</Link>}
                </div>
              </div>
            </div>
          </section>

          {/* 안전·보건 확보의무(잔여/전체) */}
          <section className="usa-d-secure">
            <h2 className="usa-d-h">안전·보건 확보의무 <small>(잔여/전체)</small></h2>
            <div className="usa-d-cards">
              {secure.map((s) => (
                <CardLink key={s.n} href={canStatus ? `${trackOfArea}&view=year&g=${s.g}&year=${year}` : ""} className="usa-d-card">
                  <span className="usa-d-num">{s.n}</span>
                  {/* 09-24 사용자: 억지 줄바꿈·굵은 글자 정리 — 제목은 한 문장(단어 단위로 자연 줄바꿈), 숫자는 한 줄 */}
                  <span className="usa-d-ct">{(TITLE2[s.n] || [s.title.join(" ")]).map((t, i) => <span key={i} className="usa-d-ctl">{t}</span>)}</span>
                  {/* 09-24 사용자: 두 줄 구성 — 1줄 번호·제목 · 2줄 「잔여 / 전체」 한 줄(숫자 크기 유지) */}
                  <span className="usa-d-cv usa-d-cv1"><small className="usa-d-cl">잔여</small><b>{s.left.toLocaleString()}</b><span className="usa-d-sl">/</span><small className="usa-d-cl">전체</small><b className="usa-d-tot">{s.total.toLocaleString()}</b><small>건</small></span>
                </CardLink>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** 링크가 없으면(권한 밖) 같은 모양의 상자만 — 09-25 권한 제어 */
function CardLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href ? <Link href={href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}
