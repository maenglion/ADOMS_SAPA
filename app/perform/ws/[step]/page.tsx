// [400 · 교육자료 버전] SCR-036~056 의무이행(실적증빙) — 사업장(중대산업재해) 11단계
//   goal SCR-036 · org SCR-037 · staff SCR-038/039 · risk SCR-040/041 · budget SCR-042/043 · work SCR-044/045
//   · opinion SCR-046/047 · emergency SCR-048/049 · recur SCR-050/051/052 · order SCR-053/054 · law SCR-055/056
// 본문 = PageHead + 명세의 인라인 입력 표(저장 → usc_record) + 이미지 뷰어 + 증빙자료 예시 + 단계 이동.
// 09-25 사용자: 대상 = 용인시 사업장 20곳(사업장 → 부서 순으로 고른다). 본청은 부서별 그대로 · 나머지 19곳은 과제 없음 안내 + 빈 표 입력.
import { CheckAll } from "../../fc/_parts/client";   // 09-26 사용자: 불러오기 창 「전체 선택」
import { floor1 } from "@/lib/num";   // 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
import Link from "next/link";
import { notFound } from "next/navigation";
import { UsLayout, Side, PageHead, EvHead, StepNav, ExampleBox } from "@/components/us/Parts";
import { STEPS, type TrackKey } from "@/lib/us/tracks";
import { depts, staff as staffList, duties, budgets, trainings, readTable } from "@/lib/data";
import { deptOf } from "@/lib/roles";
import { stepRecs, groupRows, type Rec } from "../_lib/usc";
import { YEAR, WORKPLACE, fixedId, BUDGET_ITEMS, INC_ITEMS, LAW_ST, type FileRef } from "../_lib/meta";
import { saveStep, pickStaff, importRows } from "../actions";
import FileCell from "../_parts/FileCell";
import { workplaces, HQ_WP } from "../../../targets/_lib";   // 09-25 사용자: 사업장 20곳 기준
import { Id, CtxFields, In, Box, Pill, Trash, Dup, Ev, Trust, Viewer, Ex, blank, live, fname, type VRow } from "../_parts/cells";
import { ClauseSummary, RecordLink, WS_REC_STEP, WS_REC_WHAT, recNoOf } from "../../_merge";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 수립·기록

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

const LAYER: Record<string, string> = { "대통령령(시행령)": "시행령", "부령(시행규칙)": "시행규칙" };
const layerOf = (l: string) => LAYER[l] || l || "-";
const markOf = (m: string) => (m === "Y" ? "용인 확정" : m || "-");

export default async function PerformWsStep({ params, searchParams }: { params: Promise<{ step: string }>; searchParams: Promise<SP> }) {
  const { step } = await params;
  const sp = await searchParams;
  const steps = STEPS.ws;
  const idx = steps.findIndex((s) => s.key === step);
  if (idx < 0) notFound();
  const st = steps[idx];

  const role = sp.role || "gm";
  const deptList = await depts();
  const fixedDept = deptOf(role);
  // 09-25 사용자: 용인시 사업장 20곳 기준 — 사업장을 먼저 고르고, 본청이면 그 아래 부서를 고른다.
  //   부서·이행 과제는 모두 본청(WP-01)에 붙어 있다 → 본청 = 지금 그대로(dept_id = 부서 id, 기존 저장 키 불변).
  //   나머지 19곳은 부서 없음 → 기록 키(dept_id 칸)에 사업장 번호(wp_id)를 넣는다. 빈 표로 입력할 수 있다.
  //   부서가 고정된 역할(담당자·관리자)은 본청 소속이라 본청만 본다.
  const wps = await workplaces();
  const wp: Record<string, any> = (!fixedDept && wps.find((w) => w.wp_id === sp.wp)) || wps.find((w) => w.wp_id === HQ_WP) || { wp_id: HQ_WP, wp_name: WORKPLACE };
  const isHq = wp.wp_id === HQ_WP;
  const wpName = String(wp.wp_name || WORKPLACE);
  const dept = isHq ? fixedDept || sp.dept || "D03" : String(wp.wp_id);
  const deptName = isHq ? deptList.find((d: any) => d.dept_id === dept)?.dept_name || dept : wpName;
  const recs = await stepRecs(dept, YEAR, step);

  // 주소 — role · (본청이면 dept | 다른 사업장이면 wp) 를 늘 싣는다
  const url = (o: SP = {}, s = step) => {
    const p = new URLSearchParams({ role });
    if (!fixedDept) { if (isHq) p.set("dept", dept); else p.set("wp", String(wp.wp_id)); }
    Object.entries(o).forEach(([k, v]) => v && p.set(k, v));
    return `/perform/ws/${s}?${p.toString()}`;
  };
  // 검색 모달의 GET 폼이 같은 사업장·부서에 머물게 하는 숨김 칸
  const keepHidden = fixedDept ? null : isHq ? <input type="hidden" name="dept" value={dept} /> : <input type="hidden" name="wp" value={String(wp.wp_id)} />;
  const back = url({});
  const view = (id: string) => url({ view: id, modal: undefined });
  const ctx = { role, dept, year: YEAR, step, back };
  const href = (t: TrackKey, s?: string) => (t === "ws" ? url({}, s || steps[0].key) : `/perform/${t}${s ? `/${s}` : ""}?role=${role}`);

  // 이미지 뷰어 — ?view=rid.순번, 없으면 이 단계에서 마지막으로 올린 파일
  let vfile: FileRef | null = null;
  if (sp.view) {
    const [rid, i] = sp.view.split(".");
    vfile = recs.find((r) => r.rec_id === rid)?.files[Number(i)] || null;
  }
  if (!vfile) {
    const fl = recs.flatMap((r) => r.files).filter((f) => f.url);
    vfile = fl.sort((a, b) => (a.at < b.at ? 1 : -1))[0] || null;
  }

  // 단계 이동 — 좌측 메뉴 순서(1~11단계)로 잇는다
  const prev = idx > 0 ? { href: url({}, steps[idx - 1].key), label: `${idx}단계: ${steps[idx - 1].label}` } : { href: `/law/ws?role=${role}`, label: "목록으로" };
  const next = idx < steps.length - 1 ? { href: url({}, steps[idx + 1].key), label: `${idx + 2}단계: ${steps[idx + 1].label}` } : { href: `/law/ws?role=${role}`, label: "목록으로" };

  const sec = (name: string) => recs.filter((r) => r.section === name).map(live);
  const orBlank = (rows: VRow[], section: string, data: Record<string, string> = {}) => (rows.length ? rows : [blank(`N-${section}-1`, section, data)]);

  // 사업장 → 부서(대상) 고르기 — 담당자 역할은 자기 부서만(09-25: 사업장 20곳을 먼저 고른다 · 부서는 본청일 때만)
  const deptPick = fixedDept ? null : (
    <form className="usc-dept" action={`/perform/ws/${step}`}>
      <input type="hidden" name="role" value={role} />
      <select name="wp" defaultValue={String(wp.wp_id)} aria-label="사업장">
        {wps.map((w) => <option key={w.wp_id} value={w.wp_id}>{w.wp_name}</option>)}
      </select>
      {isHq && (
        <select name="dept" defaultValue={dept} aria-label="부서">
          {deptList.filter((d: any) => d.dept_id !== "D99").map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
        </select>
      )}
      <button className="us-btn-s" type="submit">보기</button>
    </form>
  );
  const wpNote = isHq ? null : (
    <div className="usb2-note">
      이 사업장에는 아직 이행 과제가 없습니다 — 사업장 단위는 용인시 확인 뒤 정합니다. 아래 표에 적어 저장하면 이 사업장의 기록으로 남습니다.
      {wp.wp_kind ? ` (${wp.wp_kind} · ${wp.confirm_state || "확인필요"})` : ""}
    </div>
  );

  const SaveBtn = ({ off, label = "저장" }: { off?: boolean; label?: string }) => (
    <button type="submit" name="op" value="" className="us-btn usc-save" disabled={off}>{label}</button>
  );

  let body: React.ReactNode = null;
  let example: React.ReactNode = null;
  let modal: React.ReactNode = null;

  /* ── ① 1) 안전·보건 목표 및 경영방침 설정 — SCR-036 ─────────────── */
  if (step === "goal") {
    const rows = orBlank(sec("main"), "main");
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} />
        <table className="us-tbl usc-tbl">
          <thead><tr><th style={{ width: "20%" }}>방침 수립 일자</th><th><EvHead /></th><th style={{ width: "26%" }}>비고</th><th className="usc-x" /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.rec_id}>
                <td className="c"><Id v={v} /><In v={v} k="date" type="date" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><In v={v} k="note" /></td>
                <td className="c"><Trash v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="us-tbl-foot"><span /><SaveBtn /></div>
      </form>
    );
    example = <ExampleBox title="증빙자료 예시" items={["해당 사업장의 안전·보건 목표 및 경영방침서"]} />;
  }

  /* ── ① 2) 안전·보건·총괄·관리 전담 조직 설치 — SCR-037 ──────────── */
  if (step === "org") {
    const rows = orBlank(sec("main"), "main");
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} />
        <table className="us-tbl usc-tbl">
          <thead><tr><th style={{ width: "15%" }}>의무이행 일자</th><th style={{ width: "22%" }}>의무이행 내용</th><th><EvHead /></th><th style={{ width: "20%" }}>비고</th><th className="usc-x" /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.rec_id}>
                <td className="c"><Id v={v} /><In v={v} k="date" type="date" /></td>
                <td><In v={v} k="content" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><In v={v} k="note" /></td>
                <td className="c"><Trash v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="us-tbl-foot"><span /><SaveBtn /></div>
      </form>
    );
    example = <Ex blocks={[{ h: "증빙자료 예시(필수항목)", lines: ["1.해당 사업장 안전 전담조직도", "2.해당 사업장 안전 전담조직 인력현황표"] }]} />;
  }

  /* ── ① 3) 안전보건관계자 배치 — SCR-038/039 · ① 6) 업무수행 — SCR-044/045 ── */
  if (step === "staff" || step === "work") {
    const isWork = step === "work";
    const gk = isWork ? "rel" : "rank";
    const all = orBlank(sec("main"), "main");
    const open = all.filter((v) => !v.locked);
    const locked = groupRows(all.filter((v) => v.locked), gk);
    const trustable = (v: VRow) => v.data.trust === "Y" || /안전관리자|보건관리자/.test(v.data[gk] || "");
    const person = (v: VRow) => (
      <div className="usc-person">
        <In v={v} k="name" />
        <Link className="usc-search us-search-btn" href={url({ modal: "staff", row: v.rec_id, sec: "main" })} scroll={false}>검색</Link>
      </div>
    );
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} />
        <table className="us-tbl usc-tbl">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: "15%" }}>{isWork ? <>안전보건<br />관계자</> : "직급"}</th>
              <th rowSpan={2} style={{ width: "13%" }}>{isWork ? "평가 일자" : "배치 일자"}</th>
              <th colSpan={2}>인적사항</th>
              <th rowSpan={2}>{isWork ? "증빙자료" : "증빙자료"}</th>
              <th rowSpan={2} style={{ width: "13%" }}>비고</th>
            </tr>
            <tr><th style={{ width: "15%" }}>이름</th><th style={{ width: "14%" }}>소속(부서)</th></tr>
          </thead>
          <tbody>
            {open.map((v) => (
              <tr key={v.rec_id}>
                <td>
                  <Id v={v} />
                  {trustable(v) && <Trust v={v} />}
                  <In v={v} k={gk} />
                  <Dup v={v} />
                </td>
                <td className="c"><In v={v} k="date" type="date" /></td>
                <td>{person(v)}</td>
                <td><In v={v} k="org" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><div className="usc-note"><In v={v} k="note" /><Trash v={v} /></div></td>
              </tr>
            ))}
            {locked.map((g) => g.map((v, i) => (
              <tr key={v.rec_id} className={`usc-locked${i === 0 ? " usc-top" : ""}`} title="관리대상 현황에서 지정된 관리감독자 — 이름·소속은 관리대상 현황에서 바꾼다">
                {i === 0 && <td rowSpan={g.length} className="c"><Box grey>{v.data[gk]}</Box></td>}
                <td className="c"><Id v={v} /><In v={v} k="date" type="date" off={!isWork} /></td>
                <td><Box grey>{v.data.name}</Box></td>
                <td><Box grey>{v.data.org}</Box></td>
                <td><Ev v={v} view={view} locked={!isWork} /></td>
                <td><In v={v} k="note" off /></td>
              </tr>
            )))}
          </tbody>
        </table>
        <div className="us-tbl-foot">
          {isWork ? (
            <div className="usc-btns">
              <button type="submit" name="op" value="add:main" className="us-btn w">안전보건관계자 추가</button>
              <Link className="us-btn w" href={url({ modal: "work" })} scroll={false}>계획수립 내용 검색 및 추가</Link>
            </div>
          ) : <span />}
          <SaveBtn />
        </div>
      </form>
    );
    example = isWork
      ? <Ex blocks={[{ h: "증빙자료 예시(필수항목)", lines: ["해당 안전보건관계자 업무 수행 평가표(직책별)"] }]} />
      : <Ex blocks={[{ h: "증빙자료 예시(필수항목)", lines: ["해당 안전보건관계자 선임서 또는 이를 증명하는 공문서 등(주요 개인정보 삭제 처리 후 업로드 필요)"] }]} />;

    if (sp.modal === "work") {
      const src = (await stepRecs(dept, YEAR, "staff")).filter((r) => r.data.rank || r.data.name);
      modal = (
        <Modal title="계획수립 내용 검색 및 추가 — 3단계 안전보건관계자 배치 내역" close={back}>
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="work" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>직급</th><th>배치 일자</th><th>이름</th><th>소속(부서)</th></tr></thead>
              <tbody>
                {src.map((r) => (
                  <tr key={r.rec_id}>
                    <td className="c"><input type="checkbox" name="keys" value={r.rec_id} defaultChecked /></td>
                    <td>{r.data.rank}{r.data.trust === "Y" ? " (위탁)" : ""}</td><td className="c">{r.data.date}</td><td>{r.data.name}</td><td>{r.data.org}</td>
                  </tr>
                ))}
                {!src.length && <tr><td colSpan={5} className="c">3단계에서 배치한 안전보건관계자가 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span /><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        </Modal>
      );
    }
  }

  /* ── ① 4) 유해·위험요인 확인 및 개선 절차 마련(위험성평가) — SCR-040/041 ── */
  if (step === "risk") {
    const hid = fixedId(dept, YEAR, "risk", "hdr");
    const h = recs.find((r) => r.rec_id === hid);
    const hv = h ? live(h) : blank(hid, "hdr", { kind: "정기평가" }, "x");
    // 고정 구분 2행(위험성평가 교육 · 위험성평가 이행결과)은 늘 보인다 — 아직 없으면 빈 행으로
    const got = sec("main");
    const FIX = ["위험성평가 교육", "위험성평가 이행결과"];
    const rows = [
      ...FIX.flatMap((g, i) => {
        const have = got.filter((v) => v.data.gbn === g && v.data.fixed === "Y");
        return have.length ? have : [blank(`N-main-${i + 1}`, "main", { gbn: g, fixed: "Y" })];
      }),
      ...got.filter((v) => !(v.data.fixed === "Y" && FIX.includes(v.data.gbn))),
    ];
    // 09-26 사용자: 메뉴 밖 화면 합치기 — 위험성평가는 지원 시스템에서 입력하고 여기서는 조회만(화면 /risk 는 조회 전용). 고른 사업장의 평가로 연다.
    const riskView = (
      <div className="b26-risk">
        <span>이 사업장의 위험성평가 결과는 지원 시스템에서 입력합니다.</span>
        <Link className="us-btn-s" href={`/risk?wp=${encodeURIComponent(String(wp.wp_id))}&role=${role}`}>사업장 위험성평가 결과 보기(조회) →</Link>
      </div>
    );
    body = (
      <>
      {riskView}
      <form action={saveStep}>
        <CtxFields {...ctx} />
        <div className="usc-subh">
          {/* TODO: 확인 — 평가 유형은 명세에 「정기평가」만 보인다(수시·최초 평가 화면 추정) */}
          <b>{hv.data.kind || "정기평가"}</b>
          <label><span>위험성평가 일자</span><Id v={hv} /><input type="hidden" name={fname(hv, "kind")} value={hv.data.kind || "정기평가"} /><In v={hv} k="date" type="date" /></label>
        </div>
        <table className="us-tbl usc-tbl">
          <thead><tr><th style={{ width: "15%" }}>구분</th><th style={{ width: "14%" }}>의무이행 일자</th><th style={{ width: "18%" }}>의무이행 내용</th><th><EvHead /></th><th style={{ width: "16%" }}>비고</th><th className="usc-x" /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.rec_id}>
                <td className="c">
                  <Id v={v} />
                  {v.data.fixed === "Y"
                    ? <><input type="hidden" name={fname(v, "gbn")} value={v.data.gbn} /><input type="hidden" name={fname(v, "fixed")} value="Y" />{v.data.gbn}</>
                    : <In v={v} k="gbn" ph="구분 입력" />}
                </td>
                <td className="c"><In v={v} k="date" type="date" /></td>
                <td><In v={v} k="content" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><In v={v} k="note" /></td>
                <td className="c">{v.data.fixed !== "Y" && <Trash v={v} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="us-tbl-foot">
          <button type="submit" name="op" value="add:main" className="us-btn w">항목 추가</button>
          <SaveBtn />
        </div>
      </form>
      </>
    );
    example = (
      <Ex blocks={[{
        h: "증빙자료 예시(필수항목)",
        lines: [
          "1. 위험성평가 교육(사전/사후) 계획서, 결과서 등",
          "2. 사업장 위험성평가 계획, 결과 보고서 등",
          "3. 위험성평가 감소대책 계획서, 결과서 등(즉시조치 내역은 결과서, 중장기 조치 내역은 계획서 업로드)",
          // TODO: 확인 — 명세 판독불확실(「정기임시수시특별점검에 따 른」) → 구분점을 살려 적음
          "- (사업장 자체) 정기·임시·수시·특별점검에 따른 점검표 및 개선결과",
          "- (시 전담조직 요청) 중대재해예방팀 점검 요청에 따른 결과",
        ],
      }]} />
    );
  }

  /* ── ① 5) 안전예산 편성·집행 — SCR-042/043 ─────────────────────── */
  if (step === "budget") {
    const rows: VRow[] = BUDGET_ITEMS.map((item, i) => {
      const id = fixedId(dept, YEAR, "budget", String(i + 1));
      const r = recs.find((x) => x.rec_id === id);
      return r ? live(r) : blank(id, "main", { item }, "x");
    });
    const sum = (k: string) => rows.reduce((a, v) => a + (Number(v.data[k]) || 0), 0);
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} />
        <table className="us-tbl usc-tbl">
          <thead><tr>
            <th style={{ width: "13%" }}>예산 항목</th><th style={{ width: "11%" }}>편성액<br />(천원)</th><th style={{ width: "12%" }}>집행 일자</th>
            <th style={{ width: "17%" }}>집행 내역</th><th>증빙 자료<br /><small>※개당 10MB 이하</small></th><th style={{ width: "10%" }}>집행액</th><th style={{ width: "11%" }}>비고</th>
          </tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.rec_id}>
                <td className="c"><Id v={v} /><input type="hidden" name={fname(v, "item")} value={v.data.item} /><Box>{v.data.item}</Box></td>
                <td><In v={v} k="plan" type="number" ph="0" /></td>
                <td className="c"><In v={v} k="date" type="date" /></td>
                <td><In v={v} k="content" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><In v={v} k="exec" type="number" ph="0" /></td>
                <td><In v={v} k="note" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="usc-sumline">편성액 합계 {sum("plan").toLocaleString()}천원 · 집행액 합계 {sum("exec").toLocaleString()}천원{sum("plan") ? ` · 집행률 ${floor1((sum("exec") / sum("plan")) * 100).toFixed(1)}%` : ""}</div>
        <div className="us-tbl-foot">
          <Link className="us-btn w" href={url({ modal: "budget" })} scroll={false}>계획수립 내용 검색 및 추가</Link>
          <SaveBtn />
        </div>
      </form>
    );
    example = (
      <Ex blocks={[
        { h: "증빙자료 예시(필수항목)", lines: ["필요한 예산에 대한 증빙자료(예산집행 결과를 알 수 있는 서류)"] },
        { h: "집행액", lines: ["천원 단위로 다섯째 자리 반올림하여 기재(필수입력사항은 아님)"] },
      ]} />
    );
    if (sp.modal === "budget") {
      const bs = (await budgets()).filter((b: any) => b.dept_id === dept && (b.area || "I") === "I" && String(b.fiscal_year || YEAR) === YEAR);
      modal = (
        <Modal title="계획수립 내용 검색 및 추가 — 안전예산 편성 계획" close={back}>
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="budget" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>예산 항목</th><th>편성액(천원)</th><th>집행액(천원)</th><th>내용</th></tr></thead>
              <tbody>
                {bs.map((b: any) => (
                  <tr key={b.budget_id}>
                    <td className="c"><input type="checkbox" name="keys" value={b.budget_id} defaultChecked /></td>
                    <td>{b.budget_item}{BUDGET_ITEMS.includes(b.budget_item) ? "" : " → 기타"}</td>
                    <td className="n">{Math.round(Number(b.planned_amount || 0) / 1000).toLocaleString()}</td>
                    <td className="n">{Math.round(Number(b.executed_amount || 0) / 1000).toLocaleString()}</td>
                    <td>{String(b.note || "").split("·").slice(1).join("·").trim() || b.use_basis}</td>
                  </tr>
                ))}
                {!bs.length && <tr><td colSpan={5} className="c">{deptName}의 {YEAR}년 중대산업재해 예방 예산 편성 계획이 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span className="us-muted">같은 예산 항목은 합쳐서 편성액·집행액 칸에 넣습니다.</span><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        </Modal>
      );
    }
  }

  /* ── ① 7) 종사자 의견 청취 및 개선 — SCR-046/047 ────────────────── */
  if (step === "opinion") {
    const hid = fixedId(dept, YEAR, "opinion", "hdr");
    const h = recs.find((r) => r.rec_id === hid);
    const hv = h ? live(h) : blank(hid, "hdr", {}, "x");
    const A = orBlank(sec("a"), "a");
    const B = groupRows(orBlank(sec("b"), "b"), "gbn");
    const dl = <datalist id="usc-gbn"><option value="산업안전보건위원회 운영" /><option value="안전보건협의체 운영" /><option value="기타 종사자 의견 청취" /><option value="필요 개선조치 이행" /></datalist>;
    const rowCells = (v: VRow, withId = false) => (
      <>
        <td className="c">{withId && <Id v={v} />}<In v={v} k="date" type="date" /></td>
        <td><In v={v} k="content" /></td>
        <td><Ev v={v} view={view} /></td>
        <td><In v={v} k="note" /></td>
        <td className="c"><Trash v={v} /></td>
      </>
    );
    const head = <thead><tr><th style={{ width: "17%" }}>구분</th><th style={{ width: "14%" }}>이행일자</th><th style={{ width: "19%" }}>이행내역</th><th><EvHead /></th><th style={{ width: "12%" }}>비고</th><th className="usc-x" /></tr></thead>;
    body = (
      <>
        {dl}
        <form action={saveStep}>
          <CtxFields {...ctx} />
          <div className="usc-subh">
            <b>산업안전보건위원회 구성 및 운영</b>
            <label><span>산업안전보건위원회 일자</span><Id v={hv} /><In v={hv} k="date" type="date" /></label>
          </div>
          <table className="us-tbl usc-tbl">
            {head}
            <tbody>
              {A.map((v) => (
                <tr key={v.rec_id}>
                  <td><Id v={v} /><input type="text" name={fname(v, "gbn")} defaultValue={v.data.gbn || ""} list="usc-gbn" /><Dup v={v} /></td>
                  {rowCells(v)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="us-tbl-foot"><span /><SaveBtn /></div>
        </form>
        <form action={saveStep}>
          <CtxFields {...ctx} />
          <div className="usc-subh"><b>필요 개선조치 이행</b></div>
          <table className="us-tbl usc-tbl">
            {head}
            <tbody>
              {B.map((g) => g.map((v, i) => (
                <tr key={v.rec_id}>
                  {i === 0 && (
                    <td rowSpan={g.length}>
                      {v.data.gbn ? <span className="usc-glabel">{v.data.gbn}</span> : <input type="text" name={fname(v, "gbn")} defaultValue="" list="usc-gbn" placeholder="구분 입력" />}
                      <Dup v={v} />
                    </td>
                  )}
                  {rowCells(v, true)}
                </tr>
              )))}
            </tbody>
          </table>
          <div className="us-tbl-foot">
            {/* 명세에는 표B 에 행 추가 단추가 「+」 뿐 — 새 구분을 열 길이 없어 구분추가를 둔다(결과 문서 기록) */}
            <button type="submit" name="op" value="add:b" className="us-btn w">구분추가</button>
            <SaveBtn />
          </div>
        </form>
      </>
    );
    example = (
      <Ex blocks={[{
        h: "증빙자료 예시",
        lines: [
          "산업안전보건위원회 구성 및 운영: 산업안전보건위원회 증빙서류(운영일지 등)",
          "안전보건협의체 구성 및 운영: 안전보건협의체 관련 증빙서류(운영일지 등)",
          "기타 종사자 의견 청취 내역: 종사자 의견 청취 내역 등",
          "필요 개선조치 이행: 개선조치 계획서, 내역서, 결과서, 결재문서 등",
        ],
      }]} />
    );
  }

  /* ── ① 8) 비상조치계획 수립 및 이행 — SCR-048/049 ─────────────────── */
  if (step === "emergency") {
    const G = groupRows(orBlank(sec("main"), "main"), "rank");
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} />
        {/* 명세 원문 컬럼 라벨은 「직급」「배치 일자」(실제 뜻은 구분·이행일자) — 09-25 사용자: 명세 오기는 고친다(몫 Y) */}
        <table className="us-tbl usc-tbl">
          <thead><tr><th style={{ width: "15%" }}>구분</th><th style={{ width: "14%" }}>이행 일자</th><th style={{ width: "24%" }}>이행내역</th><th><EvHead /></th><th style={{ width: "11%" }}>비고</th><th className="usc-x" /></tr></thead>
          <tbody>
            {G.map((g) => g.map((v, i) => (
              <tr key={v.rec_id}>
                {i === 0 && (
                  <td rowSpan={g.length}>
                    {v.data.rank ? <span className="usc-glabel">{v.data.rank}</span> : <In v={v} k="rank" ph="구분 입력" />}
                    <Dup v={v} />
                  </td>
                )}
                <td className="c"><Id v={v} /><In v={v} k="date" type="date" /></td>
                <td><In v={v} k="content" /></td>
                <td><Ev v={v} view={view} /></td>
                <td><In v={v} k="note" /></td>
                <td className="c"><Trash v={v} /></td>
              </tr>
            )))}
          </tbody>
        </table>
        <div className="us-tbl-foot">
          <div className="usc-btns">
            <button type="submit" name="op" value="add:main" className="us-btn w">구분추가</button>
            <Link className="us-btn w" href={url({ modal: "drill" })} scroll={false}>계획수립 내용 검색 및 추가</Link>
          </div>
          <SaveBtn />
        </div>
      </form>
    );
    example = (
      <Ex blocks={[{
        h: "증빙자료 예시",
        lines: ["비상조치계획서(재해발생 시나리오, 구성원별 역할, 비상연락망 등 포함)", "(해당사업장) 사업장 비상조치매뉴얼(보유시)", "비상조치훈련 관련 증빙서류(실시 결과서 등)"],
      }]} />
    );
    if (sp.modal === "drill") {
      const dn = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
      const dp = (await readTable("drill_plan", "drill_id")).filter((x: any) => String(x.year) === YEAR)
        .sort((a: any, b: any) => (a.dept_id === dept ? -1 : 0) - (b.dept_id === dept ? -1 : 0));
      modal = (
        <Modal title="계획수립 내용 검색 및 추가 — 비상대응훈련 계획" close={back}>
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="drill" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>부서</th><th>대상</th><th>반기</th><th>유형</th><th>시나리오</th><th>계획일</th><th>상태</th></tr></thead>
              <tbody>
                {dp.map((x: any) => (
                  <tr key={x.drill_id} className={x.dept_id === dept ? "hl" : ""}>
                    <td className="c"><input type="checkbox" name="keys" value={x.drill_id} defaultChecked={x.dept_id === dept} /></td>
                    <td>{dn.get(x.dept_id) || x.dept_id}</td><td>{x.target_name}</td><td className="c">{x.half}</td><td className="c">{x.drill_type}</td>
                    <td>{x.scenario}</td><td className="c">{String(x.planned_at || "").slice(0, 10)}</td><td className="c">{x.status}</td>
                  </tr>
                ))}
                {!dp.length && <tr><td colSpan={8} className="c">{YEAR}년 비상대응훈련 계획이 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span /><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        </Modal>
      );
    }
  }

  /* ── ② 재해 발생시 재발방지대책 수립 및 이행 — SCR-050/051/052 ───── */
  if (step === "recur") {
    const nid = fixedId(dept, YEAR, "recur", "nil");
    const nrec = recs.find((r) => r.rec_id === nid);
    const saved = nrec?.data.nil === "Y";
    const nilOn = sp.nil ? sp.nil === "1" : saved; // 체크 = 주소(nil=1)로 미리 보이고, 「저장」으로 확정
    const nv = nrec ? live(nrec) : blank(nid, "nil", {}, "x");
    const incs = sec("inc");
    const cards: VRow[] = incs.length ? incs : [blank(`USC-INC-N${Date.now().toString(36).toUpperCase()}`, "inc", {}, "x")];
    const saveBack = url({}); // 저장 뒤에는 저장된 상태로 돌아온다
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} back={saveBack} />
        <Id v={nv} />
        <input type="hidden" name={fname(nv, "nil")} value={nilOn ? "Y" : "N"} />
        <div className="usc-check">
          <Link href={url({ nil: nilOn ? "0" : "1" })} scroll={false} className={nilOn ? "on" : ""}>
            <span className="usc-ck">{nilOn ? "✔" : "✓"}</span> 산업재해, 중대산업재해 발생 이력이 없을 경우 체크하여 저장
          </Link>
          {nilOn !== saved && <span className="usc-pending">저장을 누르면 반영됩니다</span>}
        </div>
        {!nilOn && cards.map((c) => {
          const rows: VRow[] = INC_ITEMS.map((item, i) => {
            const id = `${c.rec_id}-r${i + 1}`;
            const r = recs.find((x) => x.rec_id === id);
            return r ? live(r) : blank(id, "incrow", { item: String(i + 1) }, "x", c.rec_id);
          });
          return (
            <div className="usc-card" key={c.rec_id}>
              <div className="usc-card-h">
                <label><span>발생재해명</span><Id v={c} /><In v={c} k="name" /></label>
                <label><span>재해발생일</span><In v={c} k="date" type="date" /></label>
              </div>
              <table className="us-tbl usc-tbl">
                <thead><tr><th style={{ width: "19%" }}>구분</th><th style={{ width: "14%" }}>이행 일자</th><th style={{ width: "22%" }}>이행 내역</th><th><EvHead /></th><th style={{ width: "13%" }}>비고</th></tr></thead>
                <tbody>
                  {rows.map((v, i) => (
                    <tr key={v.rec_id}>
                      <td><Id v={v} /><input type="hidden" name={fname(v, "item")} value={String(i + 1)} />{INC_ITEMS[i]}</td>
                      <td className="c"><In v={v} k="date" type="date" /></td>
                      <td><In v={v} k="content" /></td>
                      <td><Ev v={v} view={view} /></td>
                      <td><In v={v} k="note" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.mode === "e" && <div className="usc-card-f"><button type="submit" name="op" value={`delinc:${c.rec_id}`} className="usc-del">삭제</button></div>}
            </div>
          );
        })}
        <div className="us-tbl-foot">
          {!nilOn ? <button type="submit" name="op" value="addinc" className="us-btn w usc-blue">재해 추가</button> : <span />}
          <SaveBtn />
        </div>
      </form>
    );
    example = (
      <Ex blocks={[
        { h: "필수 내역", lines: ["1. 재해발생 상황보고서, 2. 산업재해조사표, 3. 재발방지계획서, 4. 수시 위험성평가"] },
        {
          h: "증빙자료 예시(필수항목)",
          lines: [
            "고용노동부 산업재해조사표(산업안전보건법 시행규칙 별지 제30호서식)(조사표 작성대상*인 경우)",
            "*3일 이상의 휴업이 필요한 산업재해 발생 시 1개월 이내에 조사표 제출(출·퇴근, 운동, 질병 등은 작성대상에서 제외)",
            "발생한 중대산업재해 재발방지계획서(사업장 개요, 재해발생 원인분석 및 재발방지 대책(단기적 대책, 장기적 대책))",
            <>수시 위험성평가는 “유해·위험요인 확인 및 개선 절차 마련(위험성평가)”등록·관리 <Link href={url({}, "risk")}>(바로가기 링크)</Link></>,
          ],
        },
      ]} />
    );
  }

  /* ── ③ 중앙행정기관, 지자체 개선·시정 사항 이행 — SCR-053/054 ────── */
  if (step === "order") {
    const nid = fixedId(dept, YEAR, "order", "nil");
    const nrec = recs.find((r) => r.rec_id === nid);
    const saved = nrec?.data.nil === "Y";
    const nilOn = sp.nil ? sp.nil === "1" : saved; // 체크하면 표·단추가 흐려진다(값은 남는다)
    const nv = nrec ? live(nrec) : blank(nid, "nil", {}, "x");
    const rows = orBlank(sec("main"), "main");
    body = (
      <form action={saveStep}>
        <CtxFields {...ctx} back={url({})} />
        <Id v={nv} />
        <input type="hidden" name={fname(nv, "nil")} value={nilOn ? "Y" : "N"} />
        <div className="usc-check">
          <Link href={url({ nil: nilOn ? "0" : "1" })} scroll={false} className={nilOn ? "on" : ""}>
            <span className="usc-ck">{nilOn ? "✔" : "✓"}</span> 중앙행정기관, 지자체 개선·시정 사항이 없을 경우 체크하여 저장
          </Link>
          {nilOn !== saved && <span className="usc-pending">저장을 누르면 반영됩니다</span>}
        </div>
        <div className={nilOn ? "usc-dim" : ""}>
          <table className="us-tbl usc-tbl">
            <thead><tr>
              <th style={{ width: "14%" }}>개선·시정 사항</th><th style={{ width: "10%" }}>개선·시정<br />요구기관</th><th style={{ width: "11%" }}>행정처분 일자</th>
              <th style={{ width: "15%" }}>개선·시정 사항<br />이행 내역</th><th style={{ width: "12%" }}>조치기간</th><th><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usc-x" />
            </tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.rec_id}>
                  <td><Id v={v} /><In v={v} k="item" off={nilOn} /></td>
                  <td><In v={v} k="agency" off={nilOn} /></td>
                  <td className="c"><In v={v} k="date" type="date" off={nilOn} /></td>
                  <td><In v={v} k="content" off={nilOn} /></td>
                  <td className="c usc-range"><In v={v} k="from" type="date" off={nilOn} /><span>~</span><In v={v} k="to" type="date" off={nilOn} /></td>
                  <td><Ev v={v} view={view} off={nilOn} /></td>
                  <td><In v={v} k="note" off={nilOn} /></td>
                  <td className="c"><Trash v={v} off={nilOn} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="us-tbl-foot">
          <button type="submit" name="op" value="add:main" className="us-btn w usc-blue" disabled={nilOn}>개선 시정사항 추가</button>
          <SaveBtn />
        </div>
      </form>
    );
    example = <Ex blocks={[{ h: "증빙자료 예시(필수항목)", lines: ["1. 중앙행정기관, 지자체 개선·시정 사항 행정처분 공문", "2. 중앙행정기관, 지자체 행정처분에 대한 조치계획서, 이행내역 결과서 등"] }]} />;
  }

  /* ── ④ 관계 법령 의무이행 조치 — SCR-055/056 (우리 의무 목록 duty_class, 중대산업재해) ── */
  if (step === "law") {
    const all = await duties({ area: "I", limit: 20000 });
    const dmap = new Map(all.map((d: any) => [d.duty_key, d]));
    const L = sec("law");
    const E = orBlank(sec("edu"), "edu");
    const yN = all.filter((d: any) => d.yongin_mark === "Y").length;
    const done = L.filter((v) => v.data.st === "이행완료").length;
    body = (
      <>
        <form action={saveStep}>
          <CtxFields {...ctx} />
          <div className="usc-subh"><b>관계 법령상 의무이행</b>
            <span className="usc-cnt">중대산업재해 관계 법령 의무 {all.length.toLocaleString()}건(용인 확정 {yN.toLocaleString()} · 조건부 {(all.length - yN).toLocaleString()}) 중 이 표 {L.length}건 · 이행완료 {done}건</span>
          </div>
          <table className="us-tbl usc-tbl">
            <thead><tr>
              <th style={{ width: "13%" }}>구분</th><th style={{ width: "13%" }}>법령명</th><th style={{ width: "19%" }}>법령내용</th><th style={{ width: "12%" }}>조치 일자</th>
              <th style={{ width: "9%" }}>이행 여부</th><th><EvHead /></th><th style={{ width: "9%" }}>비고</th><th className="usc-x" />
            </tr></thead>
            <tbody>
              {L.map((v) => {
                const d: any = dmap.get(v.data.duty_key) || {};
                return (
                  <tr key={v.rec_id}>
                    <td><Id v={v} /><div className="usc-pills"><Pill>중대재해처벌법 의무사항</Pill><Pill>{layerOf(d.layer)}</Pill></div></td>
                    <td><Pill>{d.law || "-"}</Pill></td>
                    <td>
                      <Pill>{[d.unit_label_ko, d.duty_name || d.article_title].filter(Boolean).join(" ") || v.data.duty_key}</Pill>
                      <div className="usc-mark">{markOf(d.yongin_mark)}{d.cycle_text ? ` · ${d.cycle_text}` : ""}</div>
                    </td>
                    <td className="c"><In v={v} k="date" type="date" /></td>
                    <td>
                      <select name={fname(v, "st")} defaultValue={v.data.st || "미이행"}>
                        {LAW_ST.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </td>
                    <td><Ev v={v} view={view} /></td>
                    <td><In v={v} k="note" /></td>
                    <td className="c"><Trash v={v} /></td>
                  </tr>
                );
              })}
              {!L.length && <tr><td colSpan={8} className="c us-muted">아래 단추로 우리 의무 목록에서 관계 법령 의무를 불러오세요.</td></tr>}
            </tbody>
          </table>
          <div className="us-tbl-foot">
            <div className="usc-btns">
              <Link className="us-btn w usc-blue" href={url({ modal: "law", mark: "Y" })} scroll={false}>관계 법령 이행사항 추가</Link>
              <Link className="us-btn w usc-blue" href={url({ modal: "law" })} scroll={false}>계획수립 내용 검색 및 추가</Link>
            </div>
            <SaveBtn />
          </div>
        </form>

        <form action={saveStep}>
          <CtxFields {...ctx} />
          <div className="usc-subh"><b>관계 법령상 법정교육 이수</b></div>
          <table className="us-tbl usc-tbl usc-edu">
            <thead><tr>
              {/* 명세 원문은 「법령명」 머리가 두 번(두 번째 칸은 조문 값) — 09-25 사용자: 명세 오기는 고친다 → 둘째 칸 「조문」(몫 Y) */}
              <th style={{ width: "11%" }}>법정교육명</th><th style={{ width: "12%" }}>법령명</th><th style={{ width: "8%" }}>조문</th>
              <th style={{ width: "8%" }}>교육대상</th><th style={{ width: "8%" }}>교육기관</th><th style={{ width: "11%" }}>교육 일자</th>
              <th><EvHead /></th><th style={{ width: "8%" }}>비고</th><th className="usc-x" />
            </tr></thead>
            <tbody>
              {E.map((v) => (
                <tr key={v.rec_id}>
                  <td><Id v={v} /><In v={v} k="name" /></td>
                  <td>
                    {v.data.duty_key || v.data.src || v.data.law
                      ? <div className="usc-pills"><Pill>{v.data.law || "-"}</Pill><Pill>중대재해처벌법 의무사항</Pill></div>
                      : <In v={v} k="law" ph="법령명" />}
                    {v.data.law && <input type="hidden" name={fname(v, "law")} value={v.data.law} />}
                  </td>
                  <td><In v={v} k="article" ph="제00조" /></td>
                  <td><In v={v} k="target" /></td>
                  <td><In v={v} k="agency" /></td>
                  <td className="c"><In v={v} k="date" type="date" /></td>
                  <td>
                    <div className="usc-roster">
                      {v.data.roster_url
                        ? <a className="us-ev-name" href={v.data.roster_url} target="_blank">{v.data.roster_name}</a>
                        : null}
                      <RosterPick v={v} />
                      <a className="us-btn-s" href="/perform/ws/sample" download>샘플다운</a>
                    </div>
                    <Ev v={v} view={view} />
                  </td>
                  <td><In v={v} k="note" /></td>
                  <td className="c"><Trash v={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="us-tbl-foot">
            <div className="usc-btns">
              <button type="submit" name="op" value="add:edu" className="us-btn w usc-blue">관계 법령 이행사항 추가</button>
              <Link className="us-btn w usc-blue" href={url({ modal: "edu" })} scroll={false}>계획수립 내용 검색 및 추가</Link>
            </div>
            <SaveBtn />
          </div>
        </form>
      </>
    );
    example = <Ex blocks={[{ h: "증빙자료 예시(필수항목)", lines: ["관계 법령에 따른 의무이행 조치 계획서, 결과서 등", "관계 법령에 따른 법정교육 계획서, 결과서, 교육일지, 교육이수 수료증 등"] }]} />;

    if (sp.modal === "law") {
      const q = sp.q || "";
      const mk = sp.mark || "";
      let rows = await duties({ area: "I", q: q || undefined, mark: mk || undefined, limit: 20000 });
      rows = [...rows].sort((a: any, b: any) => (a.yongin_mark === "Y" ? 0 : 1) - (b.yongin_mark === "Y" ? 0 : 1));
      const have = new Set(L.map((v) => v.data.duty_key));
      modal = (
        <Modal title="계획수립 내용 검색 및 추가 — 관계 법령 의무(중대산업재해)" close={back}>
          <form className="us-filter" action={`/perform/ws/${step}`}>
            <input type="hidden" name="role" value={role} />
            {keepHidden}
            <input type="hidden" name="modal" value="law" />
            <label>용인 표시
              <select name="mark" defaultValue={mk}><option value="">전체</option><option value="Y">용인 확정</option><option value="조건부">조건부</option></select>
            </label>
            <label>검색어 <input type="text" name="q" defaultValue={q} placeholder="법령명·조문 제목·의무" /></label>
            <button className="us-btn us-search-btn" type="submit">검색</button>
            <span className="us-muted">{rows.length.toLocaleString()}건{rows.length > 100 ? " · 앞 100건 표시" : ""}</span>
          </form>
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="law" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>구분</th><th>법령명</th><th>조문</th><th>법령내용</th><th>용인 표시</th><th>이행주기</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((d: any) => (
                  <tr key={d.duty_key}>
                    <td className="c">{have.has(d.duty_key) ? "등록" : <input type="checkbox" name="keys" value={d.duty_key} />}</td>
                    <td className="c">{layerOf(d.layer)}</td><td>{d.law}</td><td>{d.unit_label_ko}</td>
                    <td>{d.duty_name || d.article_title}</td><td className="c">{markOf(d.yongin_mark)}</td><td>{d.cycle_text || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span /><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        </Modal>
      );
    }
    if (sp.modal === "edu") {
      const src = sp.src === "train" ? "train" : "duty";
      const tab = (k: string, l: string) => <Link className={`usc-tab${src === k ? " on" : ""}`} href={url({ modal: "edu", src: k })} scroll={false}>{l}</Link>;
      let list: React.ReactNode;
      if (src === "duty") {
        const rows = await duties({ area: "I", code36: "I13", limit: 500 });
        const have = new Set(E.map((v) => v.data.duty_key).filter(Boolean));
        list = (
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="edu-duty" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>법령명</th><th>조문</th><th>교육 의무</th><th>용인 표시</th><th>이행주기</th></tr></thead>
              <tbody>
                {rows.map((d: any) => (
                  <tr key={d.duty_key}>
                    <td className="c">{have.has(d.duty_key) ? "등록" : <input type="checkbox" name="keys" value={d.duty_key} />}</td>
                    <td>{d.law}</td><td>{d.unit_label_ko}</td><td>{d.duty_name || d.article_title}</td><td className="c">{markOf(d.yongin_mark)}</td><td>{d.cycle_text || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span /><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        );
      } else {
        const sn = new Map((await staffList()).map((x: any) => [x.staff_id, x.display_name]));
        const tr = (await trainings()).filter((t: any) => t.dept_id === dept);
        const have = new Set(E.map((v) => v.data.src).filter(Boolean));
        list = (
          <form action={importRows}>
            <CtxFields {...ctx} />
            <input type="hidden" name="kind" value="edu-train" />
            <table className="us-tbl">
              <thead><tr><th className="usc-x"><CheckAll name="keys" /></th><th>교육명</th><th>법령명</th><th>교육대상</th><th>교육 일자</th><th>상태</th></tr></thead>
              <tbody>
                {tr.map((t: any) => (
                  <tr key={t.training_id}>
                    <td className="c">{have.has(t.training_id) ? "등록" : <input type="checkbox" name="keys" value={t.training_id} />}</td>
                    <td>{t.course_name}</td><td>{t.law}</td><td>{sn.get(t.staff_id) || t.staff_id}</td><td className="c">{t.trained_at || "-"}</td><td className="c">{t.status}</td>
                  </tr>
                ))}
                {!tr.length && <tr><td colSpan={6} className="c">{deptName}의 교육 이수 기록이 없습니다.</td></tr>}
              </tbody>
            </table>
            <div className="us-tbl-foot"><span /><button className="us-btn g" type="submit">불러오기</button></div>
          </form>
        );
      }
      modal = (
        <Modal title="계획수립 내용 검색 및 추가 — 관계 법령상 법정교육" close={back}>
          <div className="usc-tabs">{tab("duty", "관계 법령 교육 의무")}{tab("train", `${deptName} 교육 이수 기록`)}</div>
          {list}
        </Modal>
      );
    }
  }

  /* ── 직원 검색 모달(배치·업무수행 「검색」) ───────────────────────── */
  if (sp.modal === "staff") {
    const dn = new Map(deptList.map((d: any) => [d.dept_id, d.dept_name]));
    const q = sp.q || "";
    const people = (await staffList()).filter((x: any) => x.staff_id !== "CEO-1")
      .filter((x: any) => !q || `${x.display_name} ${dn.get(x.dept_id) || ""}`.includes(q));
    modal = (
      <Modal title="직원 검색" close={back}>
        <form className="us-filter" action={`/perform/ws/${step}`}>
          <input type="hidden" name="role" value={role} />
          {keepHidden}
          <input type="hidden" name="modal" value="staff" />
          <input type="hidden" name="row" value={sp.row || ""} />
          <input type="hidden" name="sec" value={sp.sec || "main"} />
          <label>이름·부서 <input type="text" name="q" defaultValue={q} /></label>
          <button className="us-btn us-search-btn" type="submit">검색</button>
        </form>
        <table className="us-tbl">
          <thead><tr><th>소속(부서)</th><th>이름</th><th>담당</th><th className="usc-x"><CheckAll name="keys" /></th></tr></thead>
          <tbody>
            {people.map((x: any) => (
              <tr key={x.staff_id}>
                <td>{dn.get(x.dept_id) || "-"}</td><td>{x.display_name}</td><td>{x.duty_role}</td>
                <td className="c">
                  <form action={pickStaff}>
                    <CtxFields {...ctx} />
                    <input type="hidden" name="row" value={sp.row || ""} />
                    <input type="hidden" name="section" value={sp.sec || "main"} />
                    <input type="hidden" name="staff_id" value={x.staff_id} />
                    <button className="us-btn-s" type="submit">선택</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    );
  }

  // 09-25 사용자: 사업장 20곳 — 머리의 사업장 이름을 고른 사업장으로(본청은 지금과 같은 「용인시청 본청 : 부서」)
  const meta = isHq ? `${wpName} : ${deptName} – 해당년도 : ${YEAR}년` : `${wpName} – 해당년도 : ${YEAR}년`;
  const recNo = recNoOf(WS_REC_STEP, step);   // 09-26 사용자: 메뉴 밖 화면 합치기 — 이 단계와 같은 호의 체계 기록
  return (
    <UsLayout side={<Side panel="의무사항(실적증빙)" track="ws" step={step} href={href} />}>
      <div className="usc-page">
        <PageHead sub="법 의무이행 조치" title={st.title} meta={meta} target={wpName} right={deptPick} />
        {wpNote}
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 첫 화면에 체계 수립의 「호별 현황」 요약 · 같은 호의 체계 기록(/system/record)으로 가는 줄 */}
        {idx === 0 && <ClauseSummary track="ws" role={role} stepHref={(k) => url({}, k)} />}
        {recNo > 0 && <RecordLink href={`/system/record?clause=${recNo}&role=${role}`} clause={`시행령 제4조제${recNo}호`} what={WS_REC_WHAT[recNo]} />}
        {body}
        <Viewer file={vfile} />
        {example}
        <StepNav prev={prev} next={next} />
      </div>
      {modal}
    </UsLayout>
  );
}

/** 교육 명부 파일 칸(명부선택) — 이름 표시는 FileCell 을 한 칸짜리로 쓴다. */
function RosterPick({ v }: { v: VRow }) {
  return <FileCell name={`roster~${v.rec_id}`} label="명부선택" plus={false} empty={v.data.roster_name ? "명부 바꾸기" : "선택 파일 없음"} />;
}

/** 모달 — 주소(?modal=…)로 여닫는 서버 화면. */
function Modal({ title, close, children }: { title: string; close: string; children: React.ReactNode }) {
  return (
    <div className="us-modal-bg">
      <div className="us-modal usc-modal">
        <div className="us-modal-h"><span>{title}</span><Link href={close} scroll={false} className="usc-close">닫기 ✕</Link></div>
        <div className="us-modal-b">{children}</div>
      </div>
    </div>
  );
}
