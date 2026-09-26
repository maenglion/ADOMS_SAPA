// [400 · 교육자료 버전] SCR-031 도급·용역·위탁 현황 정보 등록·관리 + SCR-032 유해·위험요인(업무수행장소·위험장소) + SCR-033 관리의무 이행정보
// 명세 구현 메모: 031/032/033 은 하나의 긴 등록 화면의 스크롤 구간 3개 → 한 화면 · 저장 버튼 하나. 주소 id = new 면 신규 등록.
// 위험장소·작업 목록은 명세의 더미 문구(4·5·9·10 중복 등) 대신 법령 원문(산업안전보건법 시행령 제11조 · 시행규칙 제6조)을 쓴다.
import Link from "next/link";
import { UsLayout, PageHead, EvHead } from "@/components/us/Parts";
import { assetSeed, contractHazards, contractDuties, duties, depts, readTable } from "@/lib/data";
import { deptOf } from "@/lib/roles";
import { B1Side } from "../../_side";
import { contractOne, contractDutyState, hazardPlaces, HZ_TO_PLACE, CSTATUS, J, staffMap } from "../../_lib";
import { HazardPicker, FileRows } from "../../_client";
import { saveContract } from "../../actions";
import { STAGES, stageIndex } from "../../../contracts/model";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

const Req = () => <i className="usb1-req">*</i>;
const L = ({ t, req }: { t: string; req?: boolean }) => <label className="usb1-lab">{t}{req && <Req />}</label>;

const GBN_SEQ = ["건축물", "교량", "터널", "옹벽", "절토사면", "하천", "댐", "상하수도", "기타"];
const GBN_ORDER = (g: string) => { const i = GBN_SEQ.indexOf(g); return i < 0 ? 99 : i; };

export default async function ContractDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const sp = await searchParams;
  const role = sp.role || "gm";
  const isNew = id === "new";
  const c: Record<string, any> = isNew ? {} : (await contractOne(id)) || {};
  const back = `/targets/contract?role=${role}`;
  if (!isNew && !c.contract_id) {
    return (
      <UsLayout side={<B1Side role={role} on="contract" />}>
        <PageHead sub="사업" title="도급·용역·위탁 현황" />
        <p>계약을 찾지 못했습니다. <Link href={back}>목록으로</Link></p>
      </UsLayout>
    );
  }

  const dl = await depts();
  const dn = new Map(dl.map((d: any) => [d.dept_id, d.dept_name]));
  const { nameOnly } = await staffMap();
  const deptId = c.dept_id || deptOf(role) || "";
  const assets = assetSeed().filter((a) => !deptId || a.dept_id === deptId || a.asset_id === c.asset_id)
    .sort((a, b) => String(a.asset_name).localeCompare(String(b.asset_name), "ko"));
  const places = await hazardPlaces();
  const hz = isNew ? [] : (await contractHazards()).filter((h: any) => h.contract_id === c.contract_id);
  const hzMap = isNew ? [] : (await readTable("contract_hazard_map", "hazard_id")).filter((m) => m.contract_id === c.contract_id);
  const hint = [...new Set(hzMap.flatMap((m) => HZ_TO_PLACE[m.hazard_code] || []))];
  const selected = String(c.place_codes || "").split(";").filter(Boolean);
  const cduty = isNew ? (await contractDutyState({ contract_id: "new" })) : await contractDutyState(c);
  // 관계법령 의무(우리 의무 목록) — 이 계약에 걸린 것
  const cds = isNew ? [] : (await contractDuties()).filter((d: any) => d.contract_id === c.contract_id);
  const dmap = cds.length ? new Map((await duties({ limit: 100000 })).map((d) => [d.duty_key, d])) : new Map();
  const attach = J<{ name: string; url: string }[]>(c.attach, []);
  const seedAttach = !c.attach && c.attachments ? String(c.attachments).split(/\s+·\s+/).filter(Boolean).map((n) => ({ name: n, url: "" })) : [];
  const ctype = c.contract_type === "공사" ? "도급" : c.contract_type || "";
  const v = (k: string, d = "") => String(c[k] ?? d);
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 수급인 평가·도급 단계 기록(옛 /contracts 가 쓰는 표 contract, 입력분 겹침)
  const ev = isNew ? null : (await readTable("contract", "contract_id")).find((x) => x.contract_id === c.contract_id) || null;

  return (
    <UsLayout side={<B1Side role={role} on="contract" />}>
      <PageHead sub="사업" title="도급·용역·위탁 현황" />
      {sp.ok && <div className="usb1-ok">저장했습니다</div>}
      <nav className="usb1-anch">
        <a href="#s1">1. 계약 기본정보</a><a href="#s2">2. 유해·위험요인</a><a href="#s3">3. 관리의무 이행정보</a>
        {!isNew && <a href="#s4">4. 수급인 평가 · 도급 단계</a>}{/* 09-26 사용자: 메뉴 밖 화면 합치기 */}
      </nav>

      <form action={saveContract} className="usb1-form" key={`${id}:${c.updated_at || ""}`}>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="contract_id" value={isNew ? "new" : c.contract_id} />
        <input type="hidden" name="dept_id" value={deptId} />

        <details className="usb1-det" open id="s1">
          <summary><span>1. 계약 기본정보</span><span className="usb1-tog">^</span></summary>
          <div className="usb1-cgrid">
            <L t="계약명" req /><input className="span3" type="text" name="contract_name" required defaultValue={v("contract_name")} />
            <L t="발주부서(소관부서)" req />
            <input className="span3" type="text" name="order_dept" required list="usb1-depts" defaultValue={v("order_dept", String(dn.get(deptId) || ""))} />
            <L t="담당자" req /><input type="text" name="manager_name" required={isNew} placeholder="위탁담당자" defaultValue={v("manager_name", nameOnly(c.manager_staff_id))} />
            <L t="연락처" req /><input type="text" name="manager_phone" required={isNew} placeholder="010-0000-0000" defaultValue={v("manager_phone")} />
            <L t="계약대상자(업체명)" req /><input className="span3" type="text" name="counterpart" required placeholder="계약대상자(업체명)" defaultValue={v("counterpart")} />
            <L t="계약기간" req />
            <span className="usb1-range"><input type="date" name="start_date" required={isNew} defaultValue={v("start_date")} /> ~ <input type="date" name="end_date" required={isNew} defaultValue={v("end_date")} /></span>
            <L t="착공일" req /><input type="date" name="work_start_date" required={isNew} defaultValue={v("work_start_date")} />
            <L t="계약유형" req />
            {/* TODO: 확인 — 명세 옵션값 판독불확실(도급/용역/위탁 추정). 원 자료의 「공사」는 「도급」, 「물품」을 더 둔다 */}
            <select name="contract_type" required defaultValue={ctype}>
              <option value="">선택하세요</option><option>도급</option><option>용역</option><option>위탁</option><option>물품</option>
            </select>
            <L t="계약금액(원)" req /><input type="text" name="amount" required={isNew} inputMode="numeric" placeholder="계약금액(원)" defaultValue={c.amount ? Number(c.amount).toLocaleString() : ""} />
            <L t="주요수행업무" req /><input className="span3" type="text" name="main_task" required={isNew} placeholder="주요수행업무" defaultValue={v("main_task")} />
            <div className="usb1-gap" />
            <L t="시설물명" />
            <select className="span3 usb1-blue" name="asset_id" defaultValue={v("asset_id")}>
              <option value="">해당없음</option>
              {/* 시설구분별로 묶는다 — 한 부서 시설이 수백 개라 한 줄 목록으로는 옹벽·절토사면 등을 찾기 어렵다(09-24 사용자) */}
              {[...new Set(assets.map((a) => a.asset_gbn || "기타"))].sort((x, y) => GBN_ORDER(x) - GBN_ORDER(y)).map((g) => (
                <optgroup key={g} label={`${g} (${assets.filter((a) => (a.asset_gbn || "기타") === g).length})`}>
                  {assets.filter((a) => (a.asset_gbn || "기타") === g).sort((x, y) => String(x.asset_name).localeCompare(String(y.asset_name)))
                    .map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_name}</option>)}
                </optgroup>
              ))}
            </select>
            <hr className="usb1-hr" />
            <L t="수탁담당자" req /><input type="text" name="vendor_manager" required={isNew} placeholder="수탁담당자" defaultValue={v("vendor_manager")} />
            <L t="연락처" req /><input type="text" name="vendor_phone" required={isNew} placeholder="010-1234-5678" defaultValue={v("vendor_phone")} />
            <L t="사업자등록번호" req /><input type="text" name="biz_no" required={isNew} placeholder="000-00-00000" pattern="\d{3}-\d{2}-\d{5}" defaultValue={v("biz_no")} />
            <L t="업종" req /><input type="text" name="trade" required={isNew} placeholder="업종" defaultValue={v("trade")} />
            <L t="상시 근로자 수" req /><input type="number" min={0} name="regular_workers" required={isNew} placeholder="상시근로자수" defaultValue={v("regular_workers")} />
            <L t="사업참여 인력수" req /><input type="number" min={0} name="worker_cnt" required={isNew} placeholder="사업참여 인력수" defaultValue={v("worker_cnt")} />
            <L t="첨부파일" /><div className="span3"><FileRows prefix="c_" init={attach.length ? attach : seedAttach} /></div>
          </div>
          <datalist id="usb1-depts">{dl.filter((d: any) => d.dept_id !== "D99").map((d: any) => <option key={d.dept_id} value={d.dept_name} />)}</datalist>
        </details>

        <section id="s2" className="usb1-s2">
          <h2 className="usb1-sec">2. 유해·위험요인 정보</h2>
          <div className="usb1-wp">
            <label>업무수행장소</label>
            <input type="text" name="work_place" defaultValue={v("work_place")} className="usb1-blue" />
          </div>
          <HazardPicker places={places as any} selected={selected} hint={hint} />
          {hint.length > 0 && <p className="usb1-note">점선 테두리 항목은 이 계약에 등록된 유해·위험요인 기록에서 확인된 참고 항목입니다. 선택은 담당자가 합니다.</p>}
          {hz.length > 0 && (
            <table className="us-tbl usb1-hz">
              <thead><tr><th>작업 장소</th><th>유해·위험요인</th><th>위험 수준</th><th>감소 대책</th></tr></thead>
              <tbody>{hz.map((h: any) => (
                <tr key={h.hazard_id}><td className="c">{h.hazard_place}</td><td className="c">{h.hazard_factor}</td><td className="c">{h.risk_level}</td><td>{h.measure}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>

        <section id="s3" className="usb1-s3">
          <h2 className="usb1-sec">3. 관리의무 이행정보</h2>
          <table className="us-tbl usb1-cd">
            <thead><tr><th colSpan={2}>구분</th><th>준수여부</th><th><EvHead /></th></tr></thead>
            <tbody>
              {cduty.map((d, i) => {
                const first3 = d.code === "C3A";
                return (
                  <tr key={d.code} className="usb1-cdr">
                    {!d.sub && <td colSpan={2} className="usb1-cdg" title={d.basis}>{d.group}</td>}
                    {first3 && <td rowSpan={2} className="usb1-cdg" title={d.basis}>{d.group}</td>}
                    {d.sub && <td className="c usb1-cds">{d.sub}</td>}
                    <td className="usb1-rad">
                      {CSTATUS.map((s) => (
                        <label key={s} className={`usb1-r ${s === "미이행" ? "bad" : ""}`}>
                          <input type="radio" name={`cd_${d.code}`} value={s} defaultChecked={d.status === s} /> {s}
                        </label>
                      ))}
                    </td>
                    <td><FileRows prefix={`cd_${d.code}_`} init={d.files} emptyRow={i < 3} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="usb1-basis-t">근거: 중대재해 처벌 등에 관한 법률 시행령 제4조제9호(가목 평가기준·절차 · 나목 관리비용 기준 · 반기 1회 이상 점검)</p>
          <div className="usb1-guide">
            <b>작성 방법</b>
            <p>- 업무수행장소는 전체 도급·용역·위탁 건에 대해 포괄적인 수행장소를 작성(작업별로 장소를 세분화하여 작성할 필요 없음)</p>
          </div>

          {cds.length > 0 && (
            <>
              <h3 className="usb1-h3">이 계약에 걸린 관계법령 의무</h3>
              <table className="us-tbl usb1-list">
                <thead><tr><th>의무</th><th>법령 · 조문</th><th>이행 상태</th><th>이행일</th></tr></thead>
                <tbody>{cds.map((x: any) => {
                  const d = dmap.get(x.duty_key) || {};
                  return (
                    <tr key={x.cduty_id}>
                      <td>{d.duty_name || d.task_name || x.duty_key}</td>
                      <td>{d.law} {d.unit_label_ko}</td>
                      <td className="c">{x.status}</td>
                      <td className="c">{x.done_at || "-"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </>
          )}
        </section>

        <div className="usb1-actions">
          <Link href={back} className="usb1-btn-back">〈 목록으로</Link>
          <button type="submit" className="usb1-btn-save">저장하기</button>
        </div>
      </form>

      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 「도급·용역·위탁 중점 관리」(/contracts)의 수급인 평가(10항목)·도급 단계를 이 계약 상세에서 연다.
          두 화면은 저장하는 표가 다르다(여기 = 계약 등록 기록 · 저쪽 = 평가·단계 기록) — 자료는 옮기지 않고 길만 잇는다. */}
      {!isNew && (
        <section id="s4" className="usb1-s3 d26-cev">
          <h2 className="usb1-sec">4. 수급인 평가 · 도급 단계</h2>
          {ev ? (
            <>
              <table className="us-tbl usb1-list">
                <thead><tr><th>도급 단계</th><th>수급인 평가</th><th>계약서 안전보건 조항</th><th>재하도급</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="c">{STAGES.map((s, i) => (
                      <span key={s} className={`d26-stg${i === stageIndex(ev.proc_stage) ? " on" : i < stageIndex(ev.proc_stage) ? " done" : ""}`}>{s}</span>
                    ))}</td>
                    <td className="c">{ev.evaluation_done === "Y"
                      ? <>{ev.eval_score ? `${ev.eval_score}점` : "실시"}{ev.eval_date ? <small> · {ev.eval_date}</small> : null}</>
                      : <span className="usb1-sapa q">미실시</span>}</td>
                    <td className="c">{ev.safety_clause || "-"}</td>
                    <td className="c">{ev.subcontract === "Y" ? "있음" : "없음"}</td>
                  </tr>
                </tbody>
              </table>
              <div className="d26-cev-go">
                <Link className="usb1-btn-o" href={`/contracts?role=${role}&c=${encodeURIComponent(c.contract_id)}#eval`}>수급인 평가(10항목) 보기·입력</Link>
                <Link className="usb1-btn-o" href={`/contracts?role=${role}&c=${encodeURIComponent(c.contract_id)}#stage`}>도급 단계 · 관리비 계상</Link>
                <Link className="usb1-btn-o" href={`/contracts?role=${role}`}>전체 계약 평가 현황</Link>
              </div>
            </>
          ) : (
            <p className="usb1-note">
              이 계약은 수급인 평가·도급 단계 기록이 아직 없습니다(이 화면에서 새로 등록한 계약).
              {" "}<Link href={`/contracts?role=${role}`}>전체 계약 평가 현황</Link>에서 다른 계약의 평가를 볼 수 있습니다.
            </p>
          )}
        </section>
      )}
    </UsLayout>
  );
}
