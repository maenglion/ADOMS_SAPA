import Link from "next/link";
import { contractDuties, contractHazards, depts, staff, duties, assets, readTable } from "@/lib/data";
import { Stat, StatusBadge, Bar } from "@/components/bits";
import { Donut, BarGroup, ChartSwitch } from "@/components/Chart";
import FlowBar from "@/components/FlowBar";
import { idKo } from "@/lib/labels";
import {
  setCompliance, setComplianceEvidence, evaluateVendor, evaluateVendorItems, saveEvalSetting,
  saveApply, advanceStage, setCostPlanned,
} from "./actions";
import {
  evalItems, evalSetting, passFor, passAtEval, controlResult, framesOf, frameLabel,
  FRAME_INFO, ITEM_BASIS, FRAMES, ENTRUST_TYPES, CIVIL_SCOPES, CTL_CHECKS, RISKS, STAGES, stageIndex,
} from "./model";
import s from "./contracts.module.css";
import { ymd } from "@/lib/day";
import Steps, { Facts, type Step } from "@/components/Steps";
import FileAttach, { FileLink } from "@/components/FileAttach"; // [캡처 v2] K03
// 09-26 사용자: 메뉴 밖 화면 합치기 — 관리대상 현황 레이아웃 + 좌측
import { UsLayout } from "@/components/us/Parts";
import { B1Side } from "../targets/_side";

// [캡처 v2] 설명 문단·법령 해설·할 일 문장 제거, 맨 위 도급 5단계 막대, 표 6칸 이하 한 줄, 계약 상세는 핵심 5칸 + 접기(09-22)

export const dynamic = "force-dynamic";

/**
 * S9 — 도급, 용역, 위탁 등. 중대재해처벌법 제5조 대응 화면.
 * 업무 흐름(①~⑧)과 나란히 도는 곁가지다 — ① 체계 수립에서 수급인 평가 기준을 세우고,
 * ④ 이행에서 계약별 관리의무를 이행한다. 그래서 흐름 막대는 ④ 자리에 둔다.
 *
 * 09-21 확장(참고 명세 빠짐목록 #12~#16):
 *   계약 기본정보 19필드 · 유해·위험요인 18항목 체크 · 관리의무 이행정보 4항목(시행령 제4조제9호 가·나·다목 + 법 제5조)
 *   · 도급 O/X 매트릭스(부서 × 계약 × 4항목).
 */
const 원 = (n: any) => {
  const v = Number(n || 0);
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return v.toLocaleString();
};

/** 관리의무 4항목 — 표(contract_mgmt_item)가 없을 때도 화면이 서도록 같은 값을 둔다. */
const ITEM_FALLBACK = [
  { item_no: "1", item_name: "수급인의 안전·보건 확보 능력·기술 평가 기준·절차", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호가목", evidence_hint: "수급인 안전보건 수준 평가표" },
  { item_no: "2", item_name: "안전·보건 관리비용 기준", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호나목", evidence_hint: "관리비용 산정 기준 · 관리비 계상·집행 내역" },
  { item_no: "3", item_name: "공사기간·건조기간 기준", basis: "중대재해 처벌 등에 관한 법률 시행령 제4조제9호다목", evidence_hint: "적정 공사기간 산정 검토서" },
  { item_no: "4", item_name: "도급인의 안전·보건 확보 조치", basis: "중대재해 처벌 등에 관한 법률 제5조", evidence_hint: "계약서 안전보건 조항 · 협의체 회의록" },
];
const SHORT = ["", "① 평가 기준·절차", "② 관리비용 기준", "③ 공사기간 기준", "④ 확보 조치"];
const NO = ["", "①", "②", "③", "④"];
const 법조 = (b: string) => b.replace("중대재해 처벌 등에 관한 법률 시행령", "시행령").replace("중대재해 처벌 등에 관한 법률", "법");

/** 미이행·보완필요일 때 「다음에 할 일」 한 줄 — 막다른 곳을 만들지 않는다. */
const NEXT: Record<string, string> = {
  "1": "발주 전 수급인 안전보건 수준 평가를 하고 결과를 남기세요.",
  "2": "과업내용서·계약서에 안전·보건 관리비용 산정 기준을 넣고 계상 내역을 남기세요.",
  "3": "공사기간을 산정할 때 우기·동절기 작업중지 일수를 반영하고 검토서를 남기세요.",
  "4": "계약서에 안전보건 확보 조항을 넣는 변경계약을 하고, 이 계약에 걸린 의무를 이행하세요.",
};

export default async function Contracts({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const graph = sp.g || "";

  // 계약·관리의무는 수정분(평가 입력·준수여부)이 겹쳐 보여야 해서 공용 readTable 로 읽는다.
  const all = await readTable("contract", "contract_id");
  const comp = await readTable("contract_compliance", "cc_id");
  const itemsTbl = await readTable("contract_mgmt_item");
  const hzCodes = (await readTable("hazard_code")).sort((a: any, b: any) => Number(a.sort_no) - Number(b.sort_no));
  const hzMap = await readTable("contract_hazard_map");
  const cds = await contractDuties();
  const hzs = await contractHazards();
  const deptList = await depts();
  const deptName = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map((await staff()).map((x: any) => [x.staff_id, x.display_name]));
  const assetName = new Map((await assets({ limit: 100000 })).map((a: any) => [a.asset_id, a.asset_name]));
  const du = await duties({ limit: 100000 });
  const dutyMap = new Map(du.map((d: any) => [d.duty_key, d]));
  const items = (itemsTbl.length ? itemsTbl : ITEM_FALLBACK)
    .slice().sort((a: any, b: any) => Number(a.item_no) - Number(b.item_no));
  const hzName = new Map(hzCodes.map((h: any) => [h.hazard_code, h.hazard_name]));
  const evItems = await evalItems();
  const S = await evalSetting();
  const evScores = await readTable("contract_eval_score");
  const canWrite = role !== "ceo";
  const canSet = role === "gm" || role === "mgr";
  // 실질 지배가 「비해당」이면 법 제5조·제9조제3항이 걸리지 않는다 — 4항목을 모두 해당없음으로 본다.
  const ctlOf = (c: any): string => c.control_result || controlResult(c);
  const todayStr = ymd();
  const offCtl = (c: any) => ctlOf(c) === "비해당";
  const 원2 = (n: any) => (n === "" || n == null ? "-" : `${Number(n).toLocaleString()}원`);

  // 계약 → 관리의무 4칸
  const compBy = new Map<string, Record<string, any>>();
  for (const r of comp) {
    const m = compBy.get(r.contract_id) || {};
    m[String(r.item_no)] = r;
    compBy.set(r.contract_id, m);
  }
  const byId = new Map(all.map((c: any) => [c.contract_id, c]));
  const ccOf = (cid: string, no: number) => {
    const r = compBy.get(cid)?.[String(no)];
    const c = byId.get(cid);
    // 실질 지배 없음 → 해당없음으로 보인다(기록은 지우지 않는다)
    if (r && c && offCtl(c)) return { ...r, status: "해당없음", finding: "실질 지배·운영·관리 없음 — 법 제5조·제9조제3항 적용 대상 아님" };
    return r;
  };
  const hasMiss = (cid: string) => [1, 2, 3, 4].some((n) => ccOf(cid, n)?.status === "미이행");

  // 수급인(업체) 묶음 — 같은 업체가 여러 계약을 받는다. 업체 단위로 봐야 보이는 것이 있다.
  const doneSt = (x: string) => x === "이행완료" || x === "점검완료";
  const vendors = [...new Map(all.map((c: any) => [c.counterpart, c])).keys()].map((name) => {
    const cs = all.filter((c: any) => c.counterpart === name);
    const ids = new Set(cs.map((c: any) => c.contract_id));
    const ds = cds.filter((d: any) => ids.has(d.contract_id));
    const scores = cs.filter((c: any) => c.eval_score).map((c: any) => Number(c.eval_score));
    return {
      name,
      trade: cs[0]?.trade,
      types: [...new Set(cs.map((c: any) => c.contract_type))],
      depts: [...new Set(cs.map((c: any) => c.dept_id))],
      n: cs.length,
      amount: cs.reduce((t: number, c: any) => t + Number(c.amount || 0), 0),
      workers: cs.reduce((t: number, c: any) => t + Number(c.worker_cnt || 0), 0),
      noClause: cs.filter((c: any) => c.safety_clause?.includes("없음")).length,
      noEval: cs.filter((c: any) => c.evaluation_done !== "Y").length,
      sub: cs.filter((c: any) => c.subcontract === "Y").length,
      noDoc: cs.filter((c: any) => c.vendor_doc_status === "미제출").length,
      score: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
      high: cs.filter((c: any) => hzs.some((h: any) => h.contract_id === c.contract_id && h.risk_level === "높음")).length,
      dutyN: ds.length,
      dutyDone: ds.filter((d: any) => doneSt(d.status)).length,
    };
  }).sort((a, b) => b.amount - a.amount);

  // 거르기
  let list = all;
  if (sp.vendor) list = list.filter((c: any) => c.counterpart === sp.vendor);
  if (sp.type) list = list.filter((c: any) => c.contract_type === sp.type);
  if (sp.dept) list = list.filter((c: any) => c.dept_id === sp.dept);
  if (sp.flag === "noclause") list = list.filter((c: any) => c.safety_clause?.includes("없음"));
  if (sp.flag === "noeval") list = list.filter((c: any) => c.evaluation_done !== "Y");
  if (sp.flag === "sub") list = list.filter((c: any) => c.subcontract === "Y");
  if (sp.flag === "high") list = list.filter((c: any) =>
    hzs.some((h: any) => h.contract_id === c.contract_id && h.risk_level === "높음"));
  if (sp.flag === "miss") list = list.filter((c: any) => hasMiss(c.contract_id));
  if (sp.flag === "fail") list = list.filter((c: any) => c.evaluation_done === "Y" && Number(c.eval_score) < passAtEval(c, S));
  if (sp.frame) list = list.filter((c: any) => framesOf(c.apply_frame).includes(sp.frame));
  if (sp.ctl) list = list.filter((c: any) => ctlOf(c) === sp.ctl);
  if (sp.civil) list = list.filter((c: any) => c.civil_scope === sp.civil);
  if (sp.stg) list = list.filter((c: any) => String(stageIndex(c.proc_stage)) === sp.stg);
  if (sp.q) list = list.filter((c: any) =>
    (c.contract_name + c.counterpart).includes(sp.q));

  const noClause = all.filter((c: any) => c.safety_clause?.includes("없음"));
  const noEval = all.filter((c: any) => c.evaluation_done !== "Y");
  const subY = all.filter((c: any) => c.subcontract === "Y");
  const missAll = all.filter((c: any) => hasMiss(c.contract_id));
  const sumAmt = all.reduce((t: number, c: any) => t + Number(c.amount || 0), 0);
  const workers = all.reduce((t: number, c: any) => t + Number(c.worker_cnt || 0), 0);
  const highIds = new Set(hzs.filter((h: any) => h.risk_level === "높음").map((h: any) => h.contract_id));
  const failAll = all.filter((c: any) => c.evaluation_done === "Y" && Number(c.eval_score) < passAtEval(c, S));
  const civilN = all.filter((c: any) => framesOf(c.apply_frame).includes("시민")).length;
  const ctlCheckN = all.filter((c: any) => ctlOf(c) === "확인 필요").length;
  const ctlOffN = all.filter((c: any) => ctlOf(c) === "비해당").length;
  const civilCheckN = all.filter((c: any) => c.civil_scope === "확인 필요").length;

  const sel = sp.c || list[0]?.contract_id;
  const cur: any = all.find((c: any) => c.contract_id === sel);
  const curDuties = cds.filter((d: any) => d.contract_id === sel);
  const curHz = hzs.filter((h: any) => h.contract_id === sel);
  const curDone = curDuties.filter((d: any) => d.status === "이행완료" || d.status === "점검완료").length;
  const curMap = hzMap.filter((m: any) => m.contract_id === sel);
  const curCodes = new Set(curMap.map((m: any) => m.hazard_code));
  const codesOfHz = (hid: string) => curMap.filter((m: any) => m.hazard_id === hid).map((m: any) => hzName.get(m.hazard_code) || m.hazard_code);
  const curOpen = curDuties.filter((d: any) => !doneSt(d.status));

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role, ...(graph ? { g: graph } : {}) });
    const merged = { type: sp.type, dept: sp.dept, flag: sp.flag, q: sp.q,
                     view: sp.view, vendor: sp.vendor, frame: sp.frame, ctl: sp.ctl, civil: sp.civil, stg: sp.stg, ...o };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/contracts?${p.toString()}`;
  };

  const typeSlices = ["공사", "용역", "위탁", "물품"].map((t, i) => ({
    label: t, n: all.filter((c: any) => c.contract_type === t).length,
    tone: (["bad", "", "warn", "none"] as const)[i],
  }));
  // 상위 8곳만 그리면 합계가 전체(71)와 달라진다 — 나머지를 「그 밖」으로 묶어 합을 맞춘다(09-21 정정).
  const deptAll = [...new Set(all.map((c: any) => c.dept_id))]
    .map((d) => ({ label: String(deptName.get(d) || d), n: all.filter((c: any) => c.dept_id === d).length }))
    .sort((a, b) => b.n - a.n);
  const deptTop = deptAll.slice(0, 8);
  const deptRest = deptAll.slice(8).reduce((t, x) => t + x.n, 0);
  const deptSlices = deptRest > 0
    ? [...deptTop, { label: `그 밖 ${deptAll.length - 8}곳`, n: deptRest }]
    : deptTop;

  // 매트릭스 — 부서 순서대로 묶는다(부서 칸은 rowspan).
  const deptOrder = deptList.map((d: any) => d.dept_id);
  const byDept = [...new Set(list.map((c: any) => c.dept_id))]
    .sort((a, b) => deptOrder.indexOf(a) - deptOrder.indexOf(b))
    .map((d) => ({ dept: d, rows: list.filter((c: any) => c.dept_id === d)
      .sort((a: any, b: any) => (a.contract_id < b.contract_id ? -1 : 1)) }));
  const mark = (st?: string) =>
    st === "이행" ? <span className={s.o} title="이행">O</span>
    : st === "보완필요" ? <span className={s.d} title="보완필요">△</span>
    : st === "미이행" ? <span className={s.x} title="미이행">X</span>
    : st === "해당없음" ? <span className={s.na} title="해당없음">-</span>
    : <span className={s.na}>·</span>;
  const colCount = (no: number, st: string) => list.filter((c: any) => ccOf(c.contract_id, no)?.status === st).length;
  const rate = (rows: any[]) => {
    let ok = 0, den = 0;
    for (const c of rows) for (const n of [1, 2, 3, 4]) {
      const st = ccOf(c.contract_id, n)?.status;
      if (!st || st === "해당없음") continue;
      den++; if (st === "이행") ok++;
    }
    return den ? Math.round((ok / den) * 100) : 0;
  };

  // 09-26 사용자: 메뉴 밖 화면 합치기 — 관리대상 현황 › 도급·용역·위탁 현황의 계약 상세(「수급인 평가·도급 단계」)에서 들어오고,
  //   같은 레이아웃·좌측(B1Side 「사업」) 안에서 열린다. 계약을 골라 들어왔으면(c) 그 계약 상세로 돌아가는 길을 둔다.
  const backHref = sp.c ? `/targets/contract/${encodeURIComponent(sp.c)}?role=${role}` : `/targets/contract?role=${role}`;
  return (
    <UsLayout side={<B1Side role={role} on="contract" />}>
      <div className="d26-back">
        <Link className="usb1-btn-o" href={backHref}>← 도급·용역·위탁 현황{sp.c ? "(계약 상세)" : ""}으로</Link>
      </div>
      <FlowBar step="submit" role={role} note="도급·용역·위탁 — 중대재해처벌법 제5조" />
      <h1 className="v2h">도급·용역·위탁 <span className="muted">중점 관리 {all.length}건 — 수급인 평가 · 도급 단계</span></h1>
      <div className="chips">
        <span className="badge">법 제5조</span>
        <span className="badge">법 제9조제3항</span>
        <span className="badge none">산업 반기 · 시민 연 1회</span>
      </div>

      {/* [캡처 v2] 용인시 실제 연간 계약 규모(09-24 사용자 지시 — 현실성 있는 숫자). 아래 목록은 그중 관리가 필요한 중점 계약. */}
      <details className="card fold" style={{ marginBottom: 10 }}>
        <summary>용인시 연간 계약 규모 <span className="badge none">2025년 · 공개 자료</span>
          <span className="muted" style={{ fontWeight: 400 }}> 공사 3,508건 · 용역 3,695건 · 물품 6,443건</span></summary>
        <table className="v2t" style={{ maxWidth: 760 }}>
          <thead><tr><th>구분</th><th className="num">일반회계</th><th className="num">상하수도특별회계</th><th className="num">합계</th></tr></thead>
          <tbody>
            <tr><td>공사</td><td className="num">2,412건 · 2,594억</td><td className="num">1,096건 · 170억</td><td className="num"><b>3,508건 · 2,764억</b></td></tr>
            <tr><td>용역</td><td className="num">3,395건 · 3,633억</td><td className="num">300건 · 207억</td><td className="num"><b>3,695건 · 3,840억</b></td></tr>
            <tr><td>물품</td><td className="num">6,033건 · 1,477억</td><td className="num">410건 · 92억</td><td className="num">6,443건 · 1,569억</td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 6 }}>
          용인특례시 계약정보공개시스템(계약일 2025-01-01~12-31) · 2천만 원 미만이 공사 41% · 용역 73% ·
          다년 계약은 총액과 1차분이 따로 잡혀 합계가 실제 지출보다 큼 · 민간위탁 협약은 목록 밖.
          아래 {all.length}건은 중대재해처벌법 관리가 필요한 중점 계약입니다.
        </p>
      </details>

      <Steps items={STAGES.map((l, i): Step => {
        const n = all.filter((c: any) => stageIndex(c.proc_stage) === i).length;
        const warn = i >= 1 && all.some((c: any) => stageIndex(c.proc_stage) === i && c.evaluation_done !== "Y");
        return { label: l, n, href: q({ stg: sp.stg === String(i) ? undefined : String(i), view: undefined }),
          state: sp.stg === String(i) ? "on" : warn ? "warn" : i === 4 ? "done" : "" };
      })} />

      {sp.err && <div className={`card ${s.msgErr}`}>저장 안 함 — {sp.err}</div>}
      {sp.ok && <div className={`card ${s.msgOk}`}>{sp.ok}</div>}

      <div className="grid g5" style={{ marginTop: 12 }}>
        <Stat n={all.length} l="계약" href={q({ type: undefined, flag: undefined, stg: undefined })} />
        <Stat n={원(sumAmt)} l="금액(원)" />
        <Stat n={noClause.length} l="조항 없음" tone="bad" href={q({ flag: "noclause" })} />
        <Stat n={noEval.length} l="평가 전" tone="warn" href={q({ flag: "noeval" })} />
        <Stat n={workers.toLocaleString()} l="인원" />
      </div>

      <details className="card fold" style={{ marginTop: 12 }} open={graph ? true : undefined}>
      <summary>계약 분포</summary>
      <ChartSwitch base="/contracts" sp={{ role, ...(sp.type ? { type: sp.type } : {}), ...(sp.dept ? { dept: sp.dept } : {}) }} cur={graph} />
      <div className="grid g2">
        <div className="card">
          <h3>구분</h3>
          {graph === "pie" ? <Donut slices={typeSlices} center={String(all.length)} sub="건" /> : <BarGroup slices={typeSlices} />}
        </div>
        <div className="card">
          <h3>부서</h3>
          {graph === "pie" ? <Donut slices={deptSlices} /> : <BarGroup slices={deptSlices} />}
        </div>
      </div>
      </details>

      <div className="chips">
        <Link className={`chip ${!sp.view ? "on" : ""}`} href={q({ view: undefined, vendor: undefined })}>계약별</Link>
        <Link className={`chip ${sp.view === "vendor" ? "on" : ""}`} href={q({ view: "vendor", vendor: undefined, c: undefined } as any)}>수급인별 {vendors.length}</Link>
        <Link className={`chip ${sp.view === "matrix" ? "on" : ""}`} href={q({ view: "matrix", vendor: undefined, c: undefined } as any)}>매트릭스</Link>
        <span style={{ width: 14 }} />
        {["", "공사", "용역", "위탁", "물품"].map((t) => (
          <Link key={t || "all"} className={`chip ${(sp.type || "") === t ? "on" : ""}`} href={q({ type: t || undefined })}>
            {t || "전체"}
          </Link>
        ))}
        <span style={{ width: 14 }} />
        <Link className={`chip ${sp.flag === "noclause" ? "on" : ""}`} href={q({ flag: sp.flag === "noclause" ? undefined : "noclause" })}>
          조항 없음 {noClause.length}
        </Link>
        <Link className={`chip ${sp.flag === "noeval" ? "on" : ""}`} href={q({ flag: sp.flag === "noeval" ? undefined : "noeval" })}>
          평가 미실시 {noEval.length}
        </Link>
        <Link className={`chip ${sp.flag === "sub" ? "on" : ""}`} href={q({ flag: sp.flag === "sub" ? undefined : "sub" })}>
          재하도급 {subY.length}
        </Link>
        <Link className={`chip ${sp.flag === "high" ? "on" : ""}`} href={q({ flag: sp.flag === "high" ? undefined : "high" })}>
          위험도 높음 {highIds.size}
        </Link>
        <Link className={`chip ${sp.flag === "miss" ? "on" : ""}`} href={q({ flag: sp.flag === "miss" ? undefined : "miss" })}>
          미이행 {missAll.length}
        </Link>
        <Link className={`chip ${sp.flag === "fail" ? "on" : ""}`} href={q({ flag: sp.flag === "fail" ? undefined : "fail" })}>
          평가 미달 {failAll.length}
        </Link>
      </div>
      <div className="chips">
        <Link className={`chip ${!sp.frame ? "on" : ""}`} href={q({ frame: undefined })}>모두</Link>
        <Link className={`chip ${sp.frame === "산업" ? "on" : ""}`} href={q({ frame: "산업" })}>중대산업재해 {all.filter((c: any) => framesOf(c.apply_frame).includes("산업")).length}</Link>
        <Link className={`chip ${sp.frame === "시민" ? "on" : ""}`} href={q({ frame: "시민" })}>중대시민재해 {civilN}</Link>
        <span style={{ width: 14 }} />
        <Link className={`chip ${sp.civil === "확인 필요" ? "on" : ""}`} href={q({ civil: sp.civil === "확인 필요" ? undefined : "확인 필요" })}>
          시설 확인 {civilCheckN}
        </Link>
        <Link className={`chip ${sp.ctl === "확인 필요" ? "on" : ""}`} href={q({ ctl: sp.ctl === "확인 필요" ? undefined : "확인 필요" })}>
          지배 확인 {ctlCheckN}
        </Link>
        <Link className={`chip ${sp.ctl === "비해당" ? "on" : ""}`} href={q({ ctl: sp.ctl === "비해당" ? undefined : "비해당" })}>
          지배 비해당 {ctlOffN}
        </Link>
      </div>

      {/* 수급인 평가 합격선·가중치 — 기관이 정하는 설정값 */}
      <details className={`card ${s.setBox}`} id="evalset"
        open={sp.ok?.includes("설정") || sp.err?.includes("합격선") || sp.err?.includes("가중치") ? true : undefined}>
        <summary>
          <b>평가 합격선</b>{" "}
          <span className="muted">{S.def}점</span>
        </summary>
        {canSet ? (
          <form action={saveEvalSetting} className={s.setForm}>
            <input type="hidden" name="role" value={role} />
            <label>기본 <input type="number" name="pass_default" min={1} max={100} defaultValue={S.def} /></label>
            <label>일반 <input type="number" name="pass_general" min={1} max={100} defaultValue={S.marks["일반"]} /></label>
            <label>위험장소 <input type="number" name="pass_risk" min={1} max={100} defaultValue={S.marks["위험장소"]} /></label>
            <label>화재·폭발·밀폐 <input type="number" name="pass_fire" min={1} max={100} defaultValue={S.marks["화재·폭발·밀폐"]} /></label>
            <div className={s.wGrid}>
              {evItems.map((it: any, i: number) => (
                <label key={it.item_no}><span className="muted">{it.group_code}</span> {it.item_name}
                  <input type="number" name={`w${it.item_no}`} min={1} max={10} defaultValue={S.weights[i] ?? 2} /></label>
              ))}
            </div>
            <button className="btn sm" type="submit">설정 저장</button>
          </form>
        ) : <p className="muted">총괄이 정함</p>}
      </details>

      {sp.view === "vendor" ? (
        <>
          <h2>수급인 <span className="muted">{vendors.length}</span></h2>
          <div className="tbl-wrap">
            <table className="v2t">
              <thead><tr>
                <th>수급인</th>
                <th className="num">계약</th>
                <th className="num">금액</th>
                <th className="cd">평가</th>
                <th>빠진 것</th>
                <th>이행</th>
              </tr></thead>
              <tbody>
                {vendors.map((v) => {
                  const pct = v.dutyN ? Math.round((v.dutyDone / v.dutyN) * 100) : 0;
                  return (
                    <tr key={v.name}>
                      <td title={`${v.trade} · ${v.types.join(" · ")} · ${v.depts.map((d: any) => deptName.get(d) || d).join(", ")} · ${v.workers}명`}><Link href={q({ view: undefined, vendor: v.name } as any)}>{v.name}</Link></td>
                      <td className="num">{v.n}</td>
                      <td className="num">{원(v.amount)}</td>
                      <td className="cd">{v.score !== null
                        ? <span className={`badge ${v.score >= S.def ? "ok" : "warn"}`} title={`기본 합격선 ${S.def}점`}>{v.score}점</span>
                        : <span className="badge none">없음</span>}</td>
                      <td>
                        {v.noClause > 0 && <span className="badge bad" style={{ marginRight: 4 }}>조항 {v.noClause}</span>}
                        {v.noEval > 0 && <span className="badge warn" style={{ marginRight: 4 }}>평가 {v.noEval}</span>}
                        {v.sub > 0 && <span className="badge warn" style={{ marginRight: 4 }}>재하도급 {v.sub}</span>}
                        {v.noDoc > 0 && <span className="badge warn" style={{ marginRight: 4 }}>서류</span>}
                        {v.high > 0 && <span className="badge none">위험 {v.high}</span>}
                        {v.noClause + v.noEval + v.sub + v.high + v.noDoc === 0 && <span className="muted">없음</span>}
                      </td>
                      <td title={`${v.dutyDone}/${v.dutyN}건`}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : sp.view === "matrix" ? (
        <>
          <h2>관리의무 매트릭스 <span className="muted">{list.length}건 · {rate(list)}%</span></h2>
          <div className={s.legend}>
            <span>{mark("이행")} 이행</span><span>{mark("보완필요")} 보완필요</span>
            <span>{mark("미이행")} 미이행</span><span>{mark("해당없음")} 해당없음</span>
          </div>
          <div className="tbl-wrap">
            <table className={s.mx}>
              <thead><tr>
                <th className={s.left} style={{ width: 150 }}>부서</th>
                <th className={s.left}>계약</th>
                {items.map((it: any) => (
                  <th key={it.item_no} className="cd" style={{ width: 104 }} title={`${it.item_name} — ${it.basis}`}>
                    {SHORT[Number(it.item_no)]}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {byDept.map((g) => g.rows.map((c: any, k: number) => (
                  <tr key={c.contract_id}>
                    {k === 0 && <td rowSpan={g.rows.length} className={`${s.left} ${s.mxDept}`}>
                      <Link href={q({ view: "matrix", dept: g.dept })}>{deptName.get(g.dept) || g.dept}</Link>
                      <div className="muted">{g.rows.length}건 · {rate(g.rows)}%</div></td>}
                    <td className={s.left} title={`${c.counterpart} · ${c.contract_type} · ${offCtl(c) ? "비해당" : framesOf(c.apply_frame).map((f) => (f === "산업" ? "중대산업재해" : "중대시민재해")).join(" · ")} · ${rate([c])}%`}>
                      <Link href={q({ view: undefined, c: c.contract_id } as any)}>{c.contract_name}</Link></td>
                    {[1, 2, 3, 4].map((n) => {
                      const r = ccOf(c.contract_id, n);
                      return <td key={n} title={r ? `${r.status}${r.finding ? " — " + r.finding : ""}` : "기록 없음"}>
                        <Link href={q({ view: undefined, c: c.contract_id } as any) + "#cc"} style={{ textDecoration: "none" }}>{mark(r?.status)}</Link>
                      </td>;
                    })}
                  </tr>
                )))}
                {list.length === 0 && <tr><td colSpan={6} className="muted">없음</td></tr>}
              </tbody>
              <tfoot>
                <tr className={s.mxFoot}>
                  <td className={s.left} colSpan={2}>합계 {list.length}</td>
                  {[1, 2, 3, 4].map((n) => (
                    <td key={n} className="cd">
                      <span className={s.o}>O</span> {colCount(n, "이행")} · <span className={s.x}>X</span> {colCount(n, "미이행")}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
      <div className="grid" style={{ gridTemplateColumns: "minmax(430px,1fr) minmax(460px,600px)",
                                     marginTop: 6, alignItems: "stretch" }}>
        {/* 왼쪽 목록이 격자 행 높이를 밀지 않게 한다 — 행 높이는 **오른쪽 상세**가 정하고,
            목록은 그 높이 안에서 스크롤한다. 그래야 둘의 아래 끝이 맞는다(사용자 요청 09-21). */}
        <div style={{ position: "relative", minHeight: 560 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          {sp.vendor && (
            <div className="card" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>{sp.vendor}</h3>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {list.length}건 · {원(list.reduce((t: number, c: any) => t + Number(c.amount || 0), 0))}원
                {" · "}<Link href={q({ vendor: undefined })}>전체</Link>
              </p>
            </div>
          )}
          <div className="tbl-wrap" style={{ flex: 1, minHeight: 0, maxHeight: "none" }}>
            <table>
              <thead><tr>
                <th>계약</th>
                <th className="cd" style={{ width: 74 }}>구분</th>
                <th className="num" style={{ width: 90 }}>금액</th>
                <th className="cd" style={{ width: 82 }}>조항</th>
                <th className="cd" style={{ width: 96 }}>평가</th>
              </tr></thead>
              <tbody>
                {list.map((c: any) => (
                  <tr key={c.contract_id} style={{ background: c.contract_id === sel ? "var(--blush)" : undefined }}>
                    <td title={`${c.contract_name} — ${c.counterpart} · ${deptName.get(c.dept_id) || c.dept_id}`}>
                      <Link href={q({ c: c.contract_id } as any)}>{c.contract_name}</Link>
                    </td>
                    <td className="cd"><span className="badge none">{c.contract_type}</span></td>
                    <td className="num">{원(c.amount)}</td>
                    <td className="cd"><span className={`badge ${c.safety_clause?.includes("있음") ? "ok" : "bad"}`}>
                      {c.safety_clause?.includes("있음") ? "있음" : "없음"}</span></td>
                    <td className="cd">{c.evaluation_done === "Y"
                      ? <span className={`badge ${Number(c.eval_score) >= passAtEval(c, S) ? "ok" : "warn"}`}
                          title={`평가 당시 합격선 ${passAtEval(c, S)}점`}>{c.eval_score}점</span>
                      : <span className="badge warn">미실시</span>}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={5} className="muted">없음</td></tr>}
              </tbody>
            </table>
          </div>
          </div>
        </div>

        <div>
          {cur && (
            <>
              {/* 1. 계약 기본정보 */}
              <div className="card">
                <h3 style={{ marginBottom: 4 }}>{cur.contract_name}</h3>
                <div className="chips" style={{ marginTop: 6 }}>
                  <span className="badge">{cur.contract_type}</span>
                  <span className={`badge ${cur.safety_clause?.includes("있음") ? "ok" : "bad"}`}>{cur.safety_clause?.includes("있음") ? "조항 있음" : <a href="#cc">조항 없음</a>}</span>
                  {cur.subcontract === "Y" && <span className="badge warn">재하도급</span>}
                </div>
                <Facts items={[
                  { k: "무엇", v: <span title={cur.main_task}>{cur.main_task || cur.trade || "-"}</span> },
                  { k: "누가", v: <Link href={q({ vendor: cur.counterpart, c: undefined } as any)}>{cur.counterpart}</Link> },
                  { k: "언제", v: `${String(cur.start_date || "").slice(5)} ~ ${String(cur.end_date || "").slice(5)}` },
                  { k: "금액", v: `${원(cur.amount)}원` },
                  { k: "단계", v: STAGES[stageIndex(cur.proc_stage)] || "-" },
                ]} />
                <details className="fold" style={{ marginTop: 8 }}>
                <summary>계약 정보</summary>
                <table style={{ marginTop: 10 }}>
                  <tbody>
                    <tr><td style={{ width: 130 }}>발주부서</td><td>{deptName.get(cur.dept_id) || cur.dept_id}</td></tr>
                    <tr><td>담당자 · 연락처</td><td>{staffName.get(cur.manager_staff_id) || "-"}
                      {cur.manager_phone && <span className="muted"> · {cur.manager_phone}(부서 대표)</span>}</td></tr>
                    <tr><td>계약 번호</td><td>{idKo(cur.contract_id)} · {cur.contract_method}</td></tr>
                    <tr><td>위탁 유형</td><td>{cur.entrust_type || "-"}</td></tr>
                    <tr><td>계약 기간</td><td className="dt">{cur.start_date} ~ {cur.end_date}</td></tr>
                    <tr><td>{cur.contract_type === "공사" ? "착공일" : "착수일"}</td><td className="dt">{cur.work_start_date || "-"}</td></tr>
                    <tr><td>계약 금액</td><td>{Number(cur.amount).toLocaleString()}원</td></tr>
                    {cur.safety_cost && <tr><td>산업안전보건관리비</td><td>{Number(cur.safety_cost).toLocaleString()}원
                      <span className="muted"> · {((cur.safety_cost / cur.amount) * 100).toFixed(1)}%</span></td></tr>}
                    <tr><td>시설물명</td><td>{cur.asset_id
                      ? <Link href={`/targets/${cur.asset_id}?role=${role}`}>{assetName.get(cur.asset_id) || cur.asset_id}</Link>
                      : <span className="muted">해당없음</span>}</td></tr>
                    <tr><td>업무수행장소</td><td>{cur.work_place || "-"}</td></tr>
                    <tr><td>수탁 담당자</td><td>{cur.vendor_rep_role || "-"}
                      {cur.vendor_safety_role && <span className="muted"> · 안전 담당: {cur.vendor_safety_role}</span>}</td></tr>
                    <tr><td>수탁 연락처</td><td>{cur.vendor_contact_on_file === "Y"
                      ? <span className="badge ok">등록됨</span>
                      : <span className="badge warn">미등록</span>}</td></tr>
                    <tr><td>수급인 확인 서류</td><td>{cur.vendor_doc_status === "제출됨"
                      ? <span className="badge ok">제출됨</span>
                      : <span className="badge warn">미제출</span>}</td></tr>
                    <tr><td>업종</td><td>{cur.trade}</td></tr>
                    <tr><td>상시 근로자 수</td><td>{cur.regular_workers ? `${Number(cur.regular_workers).toLocaleString()}명` : "-"}</td></tr>
                    <tr><td>사업 참여 인력</td><td>{cur.worker_cnt}명</td></tr>
                    <tr><td>첨부파일</td><td>{(cur.attachments || "").split(" · ").filter(Boolean).map((f: string) => (
                      <span key={f} className="badge none" style={{ marginRight: 4, marginBottom: 3 }}>{f}</span>))}
                      {!cur.attachments && <span className="muted">없음</span>}</td></tr>
                  </tbody>
                </table>
                </details>
              </div>

              {/* 1-2. 적용 판단 — 적용 틀 · 위탁 유형 · 실질 지배 */}
              <ApplyCard c={cur} />

              {/* 1-3. 도급 5단계 */}
              <StageCard c={cur} />

              {/* 2. 수급인 평가 — 10항목 또는 총점만. 합격선은 설정값 */}
              <EvalCard c={cur} />

              {/* 3. 유해·위험요인 18항목 */}
              <div className="card" style={{ marginTop: 12 }}>
                <h3>유해·위험요인 <span className="muted">{curCodes.size}/18</span></h3>
                <details className="fold">
                <summary>18항목 보기</summary>
                <div className={s.hzGrid}>
                  {hzCodes.map((h: any) => {
                    const on = curCodes.has(h.hazard_code);
                    return (
                      <div key={h.hazard_code} className={`${s.hzCell} ${on ? s.hzOn : s.hzOff}`}>
                        <span className={s.hzDot}>{on ? "●" : "○"}</span>{h.hazard_name}
                      </div>
                    );
                  })}
                </div>
                </details>
                <table className="v2t">
                  <thead><tr><th style={{ width: 120 }}>장소</th><th style={{ width: 150 }}>위험요인</th>
                    <th className="cd" style={{ width: 76 }}>위험도</th><th>조치</th></tr></thead>
                  <tbody>
                    {curHz.map((h: any) => (
                      <tr key={h.hazard_id}>
                        <td>{h.hazard_place}</td>
                        <td title={codesOfHz(h.hazard_id).join(" · ")}>{h.hazard_factor}</td>
                        <td className="cd"><span className={`badge ${h.risk_level === "높음" ? "bad" : h.risk_level === "보통" ? "warn" : "none"}`}>{h.risk_level}</span></td>
                        <td title={h.measure}>{h.measure}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. 관리의무 이행정보 4항목 */}
              <div className="card" style={{ marginTop: 12 }} id="cc">
                <h3>관리의무 <span className="muted">{offCtl(cur) ? <a href="#apply">비해당</a>
                  : framesOf(cur.apply_frame).map((f) => (f === "산업" ? "반기 1회" : "연 1회")).join(" · ")}</span></h3>
                <table>
                  <thead><tr><th>구분</th><th style={{ width: 196 }}>준수여부</th></tr></thead>
                  <tbody>
                    {items.map((it: any) => {
                      const no = String(it.item_no);
                      const r = ccOf(cur.contract_id, Number(no));
                      const st = r?.status || "";
                      const na = st === "해당없음";
                      return (
                        <tr key={no} className={`${s.ccRow} ${st === "미이행" ? s.ccBad : ""} ${na ? s.ccNa : ""}`}>
                          <td>
                            <b title={framesOf(cur.apply_frame).map((f) => ITEM_BASIS[no]?.[f]).filter(Boolean).join(" · ") || it.basis}>{SHORT[Number(no)] || `${NO[Number(no)]} ${it.item_name}`}</b>
                            {na ? null : <>
                              <div className="muted" style={{ marginTop: 4 }} title={`예: ${it.evidence_hint}`}>
                                증빙 {r?.evidence_name ? <b><FileLink name={r.evidence_name} url={r.evidence_url} max={30} /></b> : <span>없음</span>}
                              </div>
                              <form action={setComplianceEvidence} className={s.evForm} style={{ flexWrap: "wrap" }}>
                                <input type="hidden" name="role" value={role} />
                                <input type="hidden" name="cc_id" value={r?.cc_id || ""} />
                                <FileAttach as="bare" label="증빙 파일 첨부" />
                                <input className={s.evInput} name="evidence_name" placeholder="이름(파일 없을 때)" />
                                <button className={s.evBtn} type="submit" disabled={!r}>증빙 등록</button>
                              </form>
                              {(st === "미이행" || st === "보완필요") && (
                                <div className={s.next} title={r?.finding || NEXT[no]}>
                                  {no === "1" ? <a href="#eval">평가 →</a>
                                    : no === "4" ? <>{curOpen[0] ? <Link href={`/duties/${curOpen[0].duty_key}?role=${role}`}>의무 이행 →</Link> : <a href="#cduties">의무 →</a>}</>
                                    : <span>보완 필요</span>}
                                </div>
                              )}
                            </>}
                          </td>
                          <td>
                            {na ? <span className="badge none">해당없음</span> : (
                              <form action={setCompliance} className={s.stForm}>
                                <input type="hidden" name="role" value={role} />
                                <input type="hidden" name="cc_id" value={r?.cc_id || ""} />
                                {(["이행", "보완필요", "미이행"] as const).map((v) => (
                                  <button key={v} type="submit" name="status" value={v} disabled={!r}
                                    className={`${s.st} ${st === v ? (v === "이행" ? s.stOk : v === "보완필요" ? s.stWarn : s.stBad) : ""}`}>
                                    {v}
                                  </button>
                                ))}
                              </form>
                            )}
                            {r?.checked_at && <div className="muted dt" style={{ marginTop: 4 }}>{String(r.checked_at).slice(5, 10)}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 5. 걸린 의무 */}
              <div className="card" style={{ marginTop: 12 }} id="cduties">
                <h3>걸리는 의무 {curDuties.length}
                  <span className="muted"> · {curDuties.length ? Math.round((curDone / curDuties.length) * 100) : 0}%</span></h3>
                <Bar pct={curDuties.length ? Math.round((curDone / curDuties.length) * 100) : 0} />
                <table className="v2t" style={{ marginTop: 8 }}>
                  <thead><tr><th style={{ width: 120 }}>의무조항</th><th>의무</th><th className="cd" style={{ width: 96 }}>상태</th></tr></thead>
                  <tbody>
                    {curDuties.map((d: any) => {
                      const n: any = dutyMap.get(d.duty_key);
                      return (
                        <tr key={d.cduty_id}>
                          <td title={n?.code36_name}>{n?.code36} {n?.code36_name}</td>
                          <td title={`${n?.law || ""} ${n?.unit_label_ko || ""}`}><Link href={`/duties/${d.duty_key}?role=${role}`}>{n?.duty_name || n?.task_name || idKo(d.duty_key)}</Link></td>
                          <td className="cd"><StatusBadge s={d.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </UsLayout>
  );

  /* ── 적용 판단 — 적용 틀 · 위탁 유형 · 실질 지배 ── */
  function ApplyCard({ c }: { c: any }) {
    const res = ctlOf(c);
    const confirmed = Boolean(c.control_confirmed_at);
    const tone = (x: string) => (x === "해당" ? "ok" : x === "확인 필요" ? "warn" : "none");
    return (
      <details className="card fold" style={{ marginTop: 12 }} id="apply">
        <summary>적용 판단 <span className={`badge ${res === "해당" ? "ok" : res === "비해당" ? "none" : "warn"}`}>{res}</span></summary>
        <table>
          <tbody>
            <tr><td style={{ width: 150 }}>적용 틀</td><td>
              {res === "비해당" ? <span className="badge none">적용 안 됨 — 실질 지배 없음</span>
                : framesOf(c.apply_frame).map((f) => (
                  <div key={f} title={`${FRAME_INFO[f].law} · ${FRAME_INFO[f].decree}`}><span className={`badge ${f === "시민" ? "ok" : ""}`}>{frameLabel(f)}</span>{" "}
                    {FRAME_INFO[f].cycle}</div>))}
            </td></tr>
            <tr><td>위탁 유형</td><td>{c.entrust_type || <span className="muted">정하지 않음</span>}</td></tr>
            <tr><td>시설 위탁</td><td>
              <span className={`badge ${tone(c.civil_scope || "확인 필요")}`}>{c.civil_scope || "확인 필요"}</span>
            </td></tr>
            <tr><td>실질 지배</td><td>
              <span className={`badge ${res === "해당" ? "ok" : res === "비해당" ? "none" : "warn"}`}>{res}</span>{" "}
              {confirmed
                ? <span className="muted">{String(c.control_confirmed_at).slice(5, 10)} · {staffName.get(c.control_confirmed_by) || c.control_confirmed_by}</span>
                : <span className="badge warn">확정 전</span>}
              <ul className={s.chk}>
                {CTL_CHECKS.map(([k, l]) => <li key={k}>{c[k] === "Y" ? "☑" : "☐"} {l}</li>)}
              </ul>
            </td></tr>
          </tbody>
        </table>
        {canWrite && (
          <details className={s.act}>
            <summary>{confirmed ? "판단 고치기" : "확인하고 저장"}</summary>
            <form action={saveApply} className={s.applyForm}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="contract_id" value={c.contract_id} />
              <label>적용 틀
                <select name="apply_frame" defaultValue={c.apply_frame || "산업"}>
                  {FRAMES.map((f) => <option key={f} value={f}>{frameLabel(f)}</option>)}
                </select></label>
              <label>위탁 유형
                <select name="entrust_type" defaultValue={c.entrust_type || ""} required>
                  <option value="" disabled>고르십시오</option>
                  {ENTRUST_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select></label>
              <label>시설 위탁
                <select name="civil_scope" defaultValue={c.civil_scope || "확인 필요"}>
                  {CIVIL_SCOPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select></label>
              <label className={s.wide}>시설 판단 근거 <input type="text" name="civil_basis" defaultValue={c.civil_basis || ""} /></label>
              <fieldset className={`${s.wide} ${s.chkSet}`}>
                <legend>실질 지배</legend>
                {CTL_CHECKS.map(([k, l]) => (
                  <label key={k}><input type="checkbox" name={k} value="Y" defaultChecked={c[k] === "Y"} /> {l}</label>
                ))}
              </fieldset>
              <label className={s.wide}>판단 근거 * <input type="text" name="control_basis" required defaultValue={c.control_basis || ""} /></label>
              <div className={s.wide}>
                <button className="btn sm" type="submit">판단 저장</button>
              </div>
            </form>
          </details>
        )}
      </details>
    );
  }

  /* ── 도급 5단계 — 발주 → 평가 → 계약 → 이행 → 준공 정산 ── */
  function StageCard({ c }: { c: any }) {
    const k = stageIndex(c.proc_stage);
    const dates = [c.order_at, c.eval_date, c.contract_at || c.start_date, c.work_start_date, c.settled_at];
    const next = STAGES[k + 1];
    const planned = c.cost_planned === "" || c.cost_planned == null ? null : Number(c.cost_planned);
    const settled = c.cost_settled === "" || c.cost_settled == null ? null : Number(c.cost_settled);
    return (
      <div className="card" style={{ marginTop: 12 }} id="stage">
        <h3>도급 단계</h3>
        <Steps items={STAGES.map((l, i): Step => ({ label: l, n: dates[i] ? String(dates[i]).slice(5, 10) : "",
          state: i < k ? "done" : i === k ? (i >= 1 && c.evaluation_done !== "Y" ? "warn" : "on") : "" }))} />
        {k >= 1 && c.evaluation_done !== "Y" && (
          <p className={s.next}>평가 없이 진행 중 <a href="#eval">평가 →</a></p>
        )}
        {c.contract_at && c.eval_date && c.eval_date > c.contract_at && (
          <p className={s.next}>평가일이 계약일보다 늦음</p>
        )}
        <table>
          <tbody>
            <tr><td style={{ width: 170 }}>관리비 계상</td><td>{원2(planned ?? "")}</td></tr>
            <tr><td>정산</td><td>{settled === null ? <span className="muted">-</span> : 원2(settled)}</td></tr>
            {planned !== null && settled !== null && (
              <tr><td>사용률</td><td>{(planned - settled).toLocaleString()}원 · {planned ? Math.round((settled / planned) * 100) : 0}%
                {planned && settled / planned < 0.9 && <span className="badge warn" style={{ marginLeft: 6 }}>적게 씀</span>}</td></tr>
            )}
          </tbody>
        </table>
        {canWrite && next && (
          <form action={advanceStage} className={s.evalForm}>
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="contract_id" value={c.contract_id} />
            <label>{next === "준공 정산" ? "준공일" : "날짜"} <input type="date" name="stage_date" defaultValue={todayStr} max={todayStr} /></label>
            {next === "준공 정산" && <>
              {planned === null && <label>계상액 <input type="number" name="cost_planned" min={0} style={{ width: 140 }} /></label>}
              <label>실사용 정산액 * <input type="number" name="cost_settled" min={0} required style={{ width: 140 }} /></label>
            </>}
            <button className="btn sm" type="submit">「{next}」 단계로</button>
          </form>
        )}
        {canWrite && k < 4 && (
          <details className={s.act}>
            <summary>관리비 계상액 {planned === null ? "적기" : "고치기"}</summary>
            <form action={setCostPlanned} className={s.evalForm}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="contract_id" value={c.contract_id} />
              <label>계상액(원) <input type="number" name="cost_planned" min={0} defaultValue={planned ?? ""} style={{ width: 160 }} /></label>
              <button className="btn sm ghost" type="submit">저장</button>
            </form>
          </details>
        )}
      </div>
    );
  }

  /* ── 수급인 평가 — 10항목(5·3·1 × 가중치) 또는 총점만 ── */
  function EvalCard({ c }: { c: any }) {
    const pass = passFor(c, S);
    const passE = passAtEval(c, S);
    const sc: any = evScores.find((r: any) => r.contract_id === c.contract_id);
    const detail = c.eval_detail === "Y" && sc;
    const scW = detail ? String(sc.weights || "").split(",").map(Number) : [];
    const done = c.evaluation_done === "Y";
    const score = Number(c.eval_score);
    return (
      <div className="card" style={{ marginTop: 12 }} id="eval">
        <h3>수급인 평가</h3>
        {done ? (
          <>
            <p style={{ margin: 0 }}>
              <span className={`badge ${score >= passE ? "ok" : "warn"}`}>{c.eval_score}점</span>{" "}
              <span className="muted dt">{String(c.eval_date || "").slice(5, 10)}</span>
              <span className="muted"> · 합격선 {passE} · {score >= passE ? "합격" : "미달"}</span>
            </p>
            {passE !== pass && (
              <p className="muted" style={{ margin: "4px 0 0" }}>현 합격선 {pass} · {score >= pass ? "합격" : "미달"}</p>
            )}
            {detail ? (
              <details className="fold" style={{ marginTop: 8 }}><summary>항목 점수</summary>
              <table className="v2t">
                <thead><tr><th>평가 항목</th><th className="cd" style={{ width: 80 }}>점수</th><th className="num" style={{ width: 70 }}>가중치</th></tr></thead>
                <tbody>
                  {evItems.map((it: any, i: number) => {
                    const p = Number(sc[`p${it.item_no}`]);
                    return (
                      <tr key={it.item_no}>
                        <td title={`${it.group_code} ${it.group_name}`}>{it.item_name}</td>
                        <td className="cd"><span className={`badge ${p === 5 ? "ok" : p === 3 ? "none" : "warn"}`}>{p === 5 ? "우수 5" : p === 3 ? "보통 3" : "미흡 1"}</span></td>
                        <td className="num">×{scW[i] ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </details>
            ) : (
              <p className="muted" style={{ margin: "4px 0 0" }}><span className="badge none">세부 없음</span></p>
            )}
          </>
        ) : (
          <p style={{ margin: 0 }}><span className="badge warn">미실시</span></p>
        )}
        {canWrite && (
          <>
            <details className={s.act} open={!done ? true : undefined}>
              <summary>{done ? "다시 평가(10항목)" : "10항목으로 평가"}</summary>
              <form action={evaluateVendorItems}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="contract_id" value={c.contract_id} />
                <div className={s.evalForm}>
                  <label>작업 위험도 *
                    <select name="work_risk" defaultValue={c.work_risk || ""} required>
                      <option value="" disabled>고르십시오</option>
                      {RISKS.map((r) => <option key={r} value={r}>{r} — 합격선 {S.marks[r]}점</option>)}
                    </select></label>
                  <label>평가일 <input type="date" name="eval_date" defaultValue={todayStr} max={todayStr} /></label>
                </div>
                <table className={s.evTbl}>
                  <thead><tr><th>평가 항목</th><th className="cd">우수 5</th><th className="cd">보통 3</th><th className="cd">미흡 1</th><th className="num">가중치</th></tr></thead>
                  <tbody>
                    {evItems.map((it: any, i: number) => (
                      <tr key={it.item_no}>
                        <td title={`${it.group_code} ${it.group_name}`}>{it.item_name}</td>
                        {[5, 3, 1].map((p) => (
                          <td key={p} className="cd">
                            <label title={p === 3 ? it.mid_hint || "" : p === 1 ? it.low_hint || "" : ""}><input type="radio" name={`p${it.item_no}`} value={p} required /></label>
                          </td>
                        ))}
                        <td className="num">×{S.weights[i] ?? 2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={s.evalForm}>
                  <input type="text" name="eval_note" placeholder="메모(선택)" style={{ flex: 1, minWidth: 200 }} />
                  <button className="btn sm" type="submit">평가 저장</button>
                </div>
              </form>
            </details>
            <details className={s.act}>
              <summary>총점만 적기</summary>
              <form action={evaluateVendor} className={s.evalForm}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="contract_id" value={c.contract_id} />
                <label>점수 <input type="number" name="eval_score" min={0} max={100} required style={{ width: 80 }} /></label>
                <label>평가일 <input type="date" name="eval_date" defaultValue={todayStr} max={todayStr} /></label>
                <label>작업 위험도
                  <select name="work_risk" defaultValue={c.work_risk || ""}>
                    <option value="">기본({S.def}점)</option>
                    {RISKS.map((r) => <option key={r} value={r}>{r} — {S.marks[r]}점</option>)}
                  </select></label>
                <button className="btn sm" type="submit">평가 결과 저장</button>
              </form>
            </details>
          </>
        )}
      </div>
    );
  }
}
