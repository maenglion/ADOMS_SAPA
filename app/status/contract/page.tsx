// [400 · 교육자료 버전] SCR-018 · 019 · 020 — 이행현황 › 도급·용역·위탁: 대상 항목 선택 → 이행 현황표(사업장 아코디언 × 계약 O/X) → 계약 상세 정보
/**
 * 사업장 = 계약의 발주부서(용인시청 본청 소속 부서 — 09-24 사용자: 사업장은 본청 하나, 필요하면 부서 단위).
 * O/X 는 관리대상 현황 › 도급·용역·위탁(묶음 B1 의 usb1_contract_duty)에서 고른 준수여부를 먼저 쓰고,
 * 없으면 원 자료(contract_compliance · contract.evaluation_done · 안전관리비 편성액)에서 읽는다.
 */
import Link from "next/link";
import { contracts, readTable, staff, assetSeed, type Row } from "@/lib/data";
import StatusSide from "../_parts/StatusSide";
import CheckAll from "@/components/us/CheckAll";
import { scopeOf, deptList, listParam } from "../_lib/calc";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

/** 명세 SCR-019 열 4개 — 묶음 B1 의 준수여부 코드(C1·C2·C3A·C3B)와 같은 자리. */
const COLS = [
  { code: "C1", ccp: "E4-9-GA" },
  { code: "C2", ccp: "E4-9-NA" },
  { code: "C3A" },
  { code: "C3B" },
];
type OX = "O" | "X" | "-";
const toOX = (s?: string): OX | "" =>
  s === "이행" || s === "이행완료" || s === "점검완료" ? "O" : s === "보완필요" || s === "조치필요" || s === "미이행" ? "X" : s === "해당없음" ? "-" : "";

async function contractRows(): Promise<Row[]> {
  const base = await contracts();
  const mine = await readTable("usb1_contract", "contract_id");
  const m = new Map<string, Row>();
  base.forEach((c: Row) => m.set(c.contract_id, c));
  [...mine].reverse().forEach((c) => m.set(c.contract_id, { ...(m.get(c.contract_id) || {}), ...c }));
  return [...m.values()].filter((c) => c.deleted !== "Y");
}

export default async function ContractStatus({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const role = one(sp.role) || "gm";
  const view = one(sp.view);
  const q = one(sp.q);
  const sc = await scopeOf(role);
  const all = await contractRows();
  const dl = (await deptList(sc)).filter((d) => all.some((c) => c.dept_id === d.dept_id));
  const dSel = sp.d !== undefined ? listParam(sp.d) : dl.map((d) => d.dept_id);
  const base = "/status/contract";
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ role, view, d: dSel.join(","), q, open: one(sp.open), ...patch })) if (v) p.set(k, v);
    return `${base}?${p.toString()}`;
  };

  /* ── SCR-018 대상 항목 선택 ─────────────────────────────────────── */
  if (!view) {
    // 사업장 20곳(09-24 · 전부 확인 필요) — 계약은 용인시청 본청 부서에만 있다. 다른 사업장을 고르면 빈 목록
    const cat = one(sp.cat);
    const wps = (await readTable("usb1_workplace", "wp_id")).filter((w) => w.deleted !== "Y").sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const wpSel = cat && cat !== "전체" && cat !== "본청" && cat !== "WP-01" ? wps.find((w) => w.wp_id === cat) : undefined;
    const cands = wpSel ? [] : dl.filter((d) => !q || String(d.dept_name).includes(q));
    const allD = sp.all === "d0" ? [] : sp.all === "d1" ? cands.map((d) => d.dept_id) : dSel;
    return (
      <div className="usa-wrap">
        <StatusSide on="ct" role={role} />
        <section className="usa-main">
          <form className="usa-search" method="get" action={base}>
            <input type="hidden" name="role" value={role} />
            <label>사업장
              <select name="cat" defaultValue={cat || "전체"}><option>전체</option>
                {wps.length ? wps.map((w) => <option key={w.wp_id} value={w.wp_id === "WP-01" ? "본청" : w.wp_id}>{w.wp_name}</option>) : <option value="본청">용인시청 본청</option>}
              </select>
            </label>
            <label className="usa-grow">사업장명
              <input name="q" defaultValue={q} placeholder="사업장 또는 부서명을 입력하세요" />
            </label>
            <button className="usa-sbtn us-search-btn" type="submit">검색</button>
          </form>
          <form method="get" action={base}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="view" value="table" />
            <div className="usa-pbox">
              <div className="usa-pbox-h">사업장 선택<span className="usa-pill">{wpSel ? wpSel.wp_name : "용인시청 본청"}</span>
                {/* 09-26 사용자: 「전체 선택」이 작동 안 함 — 브라우저에서 바로 켜고 끄는 단추로(components/us/CheckAll) */}<CheckAll name="d" />
              </div>
              <div className="usa-plist">
                {cands.map((d) => (
                  <label key={d.dept_id} className="usa-prow">
                    <span>{d.dept_name} <small className="usa-mut">계약 {all.filter((c) => c.dept_id === d.dept_id).length}건</small></span>
                    <input type="checkbox" name="d" value={d.dept_id} defaultChecked={allD.includes(d.dept_id)} />
                    <span className="usa-dot">⌄</span>
                  </label>
                ))}
                {!cands.length && <div className="usa-empty">{wpSel ? "이 사업장에는 등록된 도급·용역·위탁 계약이 없습니다." : "찾는 사업장이 없습니다."}</div>}
              </div>
              {cands.length > 10 && <div className="usa-more">︾</div>}
            </div>
            <div className="usa-right"><button className="usa-gbtn" type="submit">도급·용역·위탁 현황 보기</button></div>
          </form>
        </section>
      </div>
    );
  }

  /* ── SCR-019 이행 현황표 · SCR-020 상세 ─────────────────────────── */
  const picked = dl.filter((d) => dSel.includes(d.dept_id));
  const cid = one(sp.c);
  const cur = cid ? all.find((c) => c.contract_id === cid) : null;
  const open = one(sp.open) || cur?.dept_id || picked[0]?.dept_id || "";
  const ccp = await readTable("contract_compliance", "cc_id");
  const saved = await readTable("usb1_contract_duty", "cd_id");
  const oxOf = (c: Row): OX[] => COLS.map((k) => {
    const s = saved.find((r) => r.contract_id === c.contract_id && r.item_code === k.code);
    const fromSaved = toOX(s?.status);
    if (fromSaved) return fromSaved;
    if (k.ccp) return toOX(ccp.find((r) => r.contract_id === c.contract_id && r.item_code === k.ccp)?.status) || "X";
    if (k.code === "C3A") return c.evaluation_done === "Y" ? "O" : "X";
    // C3B 안전관리비 편성 및 집행점검 — 편성액(safety_cost · cost_planned)이 있으면 O. TODO: 확인(집행점검 기록이 따로 없다)
    return Number(c.safety_cost || c.cost_planned || 0) > 0 ? "O" : "X";
  });
  const rows = all.filter((c) => c.dept_id === open);

  return (
    <div className="usa-wrap">
      <StatusSide on="ct" role={role} />
      <section className="usa-main">
        <div className="usa-bar">
          <span />
          <Link className="usa-back" href={href({ view: null, open: null, c: null })}>사업장 다시 고르기</Link>
        </div>
        <div className="usa-ctwrap">
          <table className="usa-ct">
            <thead>
              <tr>
                <th rowSpan={2} className="usa-ct-dept">사업장</th>
                <th rowSpan={2} className="usa-ct-name">계약명</th>
                <th rowSpan={2}>1. 수급인 선정 기준<br />마련 여부<br />(안전보건수준 평가표)</th>
                <th rowSpan={2}>2. 안전보건관리비 기준<br />마련 여부</th>
                <th colSpan={2}>3. 안전보건수준 평가</th>
              </tr>
              <tr>
                <th>수급인 선정 시<br />안전관리수준평가<br />실시 여부</th>
                <th>안전관리비<br />편성 및<br />집행점검 여부</th>
              </tr>
            </thead>
            <tbody>
              {dl.filter((d) => d.dept_id === open).map((d) => rows.map((c, i) => {
                const ox = oxOf(c);
                return (
                  <tr key={c.contract_id} className={cid === c.contract_id ? "on" : ""}>
                    {i === 0 && <td rowSpan={rows.length} className="usa-ct-dept">{d.dept_name}</td>}
                    <td className="usa-ct-name"><Link href={href({ c: c.contract_id })}>{c.contract_name}</Link></td>
                    {ox.map((v, j) => <td key={j} className={`c usa-ox ${v === "X" ? "x" : ""}`}>{v}</td>)}
                  </tr>
                );
              }))}
              {open && !rows.length && <tr><td colSpan={6} className="c usa-mut">계약이 없습니다.</td></tr>}
            </tbody>
          </table>
          {cur && <ContractCard c={cur} close={href({ c: null })} />}
        </div>
        <div className="usa-acc">
          {picked.filter((d) => d.dept_id !== open).map((d) => (
            <Link key={d.dept_id} href={href({ open: d.dept_id, c: null })} className="usa-acc-row">
              <span>{d.dept_name}</span><span className="usa-mut">계약 {all.filter((c) => c.dept_id === d.dept_id).length}건 ⌄</span>
            </Link>
          ))}
        </div>
        <p className="usa-note">· 계약명을 누르면 계약 기본정보가 열립니다. O = 이행 · X = 미이행 또는 보완필요 · - = 해당없음. 준수여부 입력은 관리대상 현황 › 도급·용역·위탁 현황에서 합니다.</p>
      </section>
    </div>
  );
}

/** SCR-020 「1. 계약 기본정보」 — 조회 전용(회색 칸). */
async function ContractCard({ c, close }: { c: Row; close: string }) {
  const [st, dl] = await Promise.all([staff(), deptList(null)]);
  const mgr = st.find((s: any) => s.staff_id === c.manager_staff_id)?.display_name || "";
  const dept = dl.find((d) => d.dept_id === c.dept_id)?.dept_name || "";
  const asset = c.asset_id ? assetSeed().find((a) => a.asset_id === c.asset_id)?.asset_name : "";
  const won = (v: any) => (v ? Number(v).toLocaleString() : "");
  const files = String(c.attachments || "").split("·").map((x) => x.trim()).filter(Boolean);
  const F = ({ label, v, req = true, wide }: { label: string; v: any; req?: boolean; wide?: boolean }) => (
    <div className={`usa-f${wide ? " wide" : ""}`}>
      <span className="usa-f-l">○ {label}{req ? <b> •</b> : null}</span>
      <span className="usa-f-v">{v || "-"}</span>
    </div>
  );
  return (
    <div className="usa-card">
      <div className="usa-card-h">1. 계약 기본정보<Link href={close} className="usa-x2" title="닫기">✕</Link></div>
      <div className="usa-fgrid">
        <F label="계약명" v={c.contract_name} wide />
        <F label="발주부서(소관부서)" v={dept} wide />
        <F label="담당자" v={mgr} /><F label="연락처" v={c.manager_phone} />
        <F label="계약대상자(업체명)" v={c.counterpart} wide />
        <F label="계약기간" v={c.start_date ? `${c.start_date} ~ ${c.end_date || ""}` : ""} /><F label="착공일" v={c.work_start_date} />
        <F label="계약유형" v={c.contract_type} /><F label="계약금액(원)" v={won(c.amount)} />
        <F label="주요수행업무" v={c.main_task} wide />
        <F label="시설물명" v={asset || "해당없음"} req={false} wide />
        <hr className="usa-hr" />
        {/* 수탁 쪽 인적사항은 원 자료에 없다 — 관리대상 현황에서 등록하면 그 값을 보인다. TODO: 확인 */}
        <F label="수탁담당자" v={c.vendor_manager || c.vendor_rep_role} /><F label="연락처" v={c.vendor_phone} />
        <F label="사업자등록번호" v={c.biz_no} /><F label="업종" v={c.trade} />
        <F label="상시 근로자 수" v={c.regular_workers ? `${c.regular_workers}명` : ""} /><F label="사업참여 인력수" v={c.worker_cnt ? `${c.worker_cnt}명` : ""} />
        <div className="usa-f wide">
          <span className="usa-f-l">○ 첨부파일</span>
          <span className="usa-f-v">{files.length ? files.map((f) => <span key={f} className="usa-file">{f}</span>) : "-"}</span>
        </div>
      </div>
    </div>
  );
}
