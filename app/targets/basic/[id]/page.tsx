// [400 · 교육자료 버전] SCR-028 관리대상 기본정보 등록·관리 + SCR-029 세부정보 등록·관리(한 화면 — 명세: 같은 페이지의 스크롤 구간)
// 사업장(ws): 명세 원문 그대로(기준일자 · 1. 사업장 기본정보 · 근무인원 · 2. 세부정보 업무 담당자·관리감독자·첨부 · 작성요령)
// 공중이용시설·공중교통수단(fc): 같은 틀에 「시설물 제원」 — 중대시민재해 판정에 필요한 제원(자산 대장 need_data)을 표시
// 원료·제조물(mt): 같은 틀에 원료·제조물 대장(material_item)의 판단 내용 + 품목 세부
import Link from "next/link";
import { UsLayout, PageHead } from "@/components/us/Parts";
import { duties, assetSeed } from "@/lib/data";
import { ACT_LABEL } from "@/lib/material";
import { ymd } from "@/lib/day";
import { B1Side } from "../../_side";
import {
  trackKey, TRACK_LABEL, workplace, wsDepts, basicOf, basics, J, EMP_TYPES, HC_ROWS, IND_CLASS, staffPick, fcTargets, mtTargets,
  targetTypesOf, specFieldsOf, isNeeded, MT_FIELDS, deptNames, workplaces, workSites,
} from "../../_lib";
import { tasks } from "@/lib/data";
import { HeadcountMatrix, IndustryPick, WorkerRows, SupRows, FileRows } from "../../_client";
import { saveBasic } from "../../actions";
import { riskScope, riskCounts, targetsOf, statusTone } from "../../../risk/_scope";   // 09-26 사용자: 메뉴 밖 화면 합치기

export const dynamic = "force-dynamic";

const Req = () => <i className="usb1-req">*</i>;
function F({ label, req, children, wide }: { label: string; req?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`usb1-f${wide ? " wide" : ""}`}>
      <label className="usb1-lab">{label}{req && <Req />}</label>
      <div className="usb1-fv">{children}</div>
    </div>
  );
}

export default async function BasicDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const sp = await searchParams;
  const role = sp.role || "gm";
  const t = trackKey(sp.t);
  const { hist, cur } = await basicOf(t, id, sp.d);
  // 고른 기준일자 기록이 없으면 그 전 기록을 불러와 채운다(저장하면 새 기준일자 기록이 생긴다)
  const prev = !cur && sp.d ? hist.find((r) => r.base_date < sp.d) || hist[0] : undefined;
  const rec = cur || prev;
  const baseDate = sp.d || cur?.base_date || ymd();
  const people = await staffPick();
  const dn = await deptNames();
  const back = `/targets/basic?t=${t}&role=${role}`;

  const workers = J<{ name: string; org: string; phone: string }[]>(rec?.workers, []);
  const sups = J<{ state: string; name: string; phone: string; pos: string; from: string; to: string }[]>(rec?.sups, []);
  const files = J<{ name: string; url: string }[]>(rec?.files, []);
  const spec = J<Record<string, string>>(rec?.spec, {});
  const extra = J<Record<string, string>>(rec?.extra, {});

  /* ── 대상별 머리 정보 ── */
  let sec1: React.ReactNode = null;
  let sec2: React.ReactNode = null;
  let guide: string[] = [];
  let notFound = false;

  if (t === "ws") {
    const wp = await workplace();
    const ds = await wsDepts("gm");
    // 사업장 20곳(09-24) — 본청(WP-01)만 부서·이행 과제를 가진다. 나머지 19곳은 「과제 없음」
    const wps = await workplaces();
    const w = wps.find((x) => x.wp_id === id);
    const isWp = !!w;
    const isHq = id === wp.wp_id;
    const d = ds.find((x) => x.dept_id === id);
    if (!isWp && !d) notFound = true;
    const wpIds = new Set(wps.map((x) => x.wp_id));
    const mySites = isWp ? (await workSites()).filter((s) => s.wp_id === id) : [];
    const iTasks = isHq ? (await tasks({ limit: 100000 })).filter((x) => x.area === "I").length : 0;
    const kinds = [...new Set(mySites.map((s) => s.site_kind))];
    const hc = J<Record<string, number[]>>(rec?.headcount, {});
    // 사업장 전체 화면에서는 부서별 최신 입력의 합을 참고로 보인다
    let sumNote = "";
    if (isHq) {
      const all = await basics();
      const last = new Map<string, any>();
      all.filter((r) => r.track === "ws" && !wpIds.has(r.target_id)).sort((a, b) => (a.base_date < b.base_date ? -1 : 1)).forEach((r) => last.set(r.target_id, r));
      const tot = [0, 0];
      last.forEach((r) => { const h = J<Record<string, number[]>>(r.headcount, {}); HC_ROWS.forEach((k, i) => { tot[i] += (h[k] || []).reduce((a, b) => a + Number(b || 0), 0); }); });
      sumNote = `부서별 입력 합계(${last.size}개 부서) — 현원 ${tot[0]} · 현업업무종사자 ${tot[1]}`;
    }
    sec1 = (
      <>
        <F label="사업소명" req><input type="text" readOnly value={w ? w.wp_name : wp.wp_name} className="usb1-ro" /></F>
        <F label="부서명" req><input type="text" readOnly value={isHq ? `소속 부서 전체(${ds.length}개)` : w ? w.org_note || "확인 필요" : d?.dept_name || ""} className="usb1-ro" /></F>
        <F label="주소" req><input type="text" name="addr" required defaultValue={rec?.addr || (w ? w.addr : wp.addr) || ""} placeholder={w?.addr_note || ""} className="usb1-blue" /></F>
        <IndustryPick options={IND_CLASS} cls={rec?.ind_class ?? (w ? w.ind_class : wp.ind_class) ?? ""} code={rec?.ind_code ?? (w ? w.ind_code : wp.ind_code) ?? ""} />
        {w && (
          <div className="usb1-f wide">
            <label className="usb1-lab">사업장 확인 사항</label>
            <div className="usb1-fv">
              <table className="usb1-wpinfo">
                <tbody>
                  <tr><th>구분</th><td>{w.wp_kind}</td><th>관리주체</th><td>{w.subject || "용인시"}</td></tr>
                  <tr><th>확인 상태</th><td><span className="usb1-sapa q">{w.confirm_state === "확인필요" ? "확인 필요" : w.confirm_state}</span></td>
                    <th>이행 과제</th><td>{isHq ? `${ds.length}개 부서 · ${iTasks.toLocaleString()}건` : <span className="usb1-muted">과제 없음</span>}</td></tr>
                  <tr><th>현업 여부</th><td colSpan={3}>{w.field_work || "-"}{w.field_basis && <span className="usb1-basis-t"> — {w.field_basis}</span>}</td></tr>
                  {w.addr_note && <tr><th>주소 메모</th><td colSpan={3}>{w.addr_note}</td></tr>}
                  <tr><th>같은 부지 · 묶임</th><td colSpan={3}>{w.site_note || "-"}</td></tr>
                  <tr><th>소속 근무 장소</th><td colSpan={3}>
                    {mySites.length
                      ? <>{kinds.map((k) => `${k} ${mySites.filter((s) => s.site_kind === k).length}곳`).join(" · ")}
                          <div className="usb1-sites-l">{mySites.map((s) => <span key={s.site_id} title={[s.addr, s.org_note].filter(Boolean).join(" · ")}>{s.site_name}</span>)}</div></>
                      : "-"}
                  </td></tr>
                  <tr><th>근거</th><td colSpan={3} className="usb1-wp-src">
                    {String(w.src_url || "").split(" · ").filter(Boolean).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\//, "")}</a>)}
                  </td></tr>
                </tbody>
              </table>
              <p className="usb1-note">사업장 단위(안전보건관리책임자 선임 단위) · 상시근로자 수 · 현업 종사자 수는 누리집에 없어 용인시 확인이 필요합니다.</p>
            </div>
          </div>
        )}
        <div className="usb1-f wide">
          <label className="usb1-lab">근무인원</label>
          <div className="usb1-fv">
            <HeadcountMatrix types={[...EMP_TYPES]} rows={[...HC_ROWS]} init={hc} />
            {sumNote && <p className="usb1-note">{sumNote}</p>}
          </div>
        </div>
      </>
    );
    sec2 = (
      <>
        <WorkerRows init={workers} people={people} />
        <div className="usb1-grid2">
          <div className="usb1-gl">관리감독자 <Req /></div>
          <div className="usb1-gv"><SupRows init={sups} people={people} /></div>
          <div className="usb1-gl">첨부파일</div>
          <div className="usb1-gv"><FileRows init={files} /></div>
        </div>
      </>
    );
    guide = [
      "1. 사업소명: 중대산업재해 사업장 내 사업소 및 부서명 입력",
      "2. 주소: 사업소의 위치를 도로명주소로 기입하되 도로명 주소가 없는 경우 지번 주소만 기입",
      "3. 업종분류(안): 해당 사업소의 업종분류를 한국표준산업분류 기준으로 입력",
      "4. 근무인원: 해당 사업소 상시근로자 입력(현원과 현업업무종사자로 구분하여 입력)",
      " - 공무원, 공무직, 촉탁직, 기간제, 공공안전관, 공공근로, 뉴딜일자리, 기타",
      "5. 업무 담당자: 담당자 소속 및 이름, 연락처 입력",
      "6. 관리감독자: 해당 사업소의 관리감독자 지정 현황 및 관련 정보 입력(이름, 연락처, 직위, 선임시기 등)",
    ];
  } else if (t === "fc") {
    const a = (await fcTargets("gm")).find((x) => x.id === id);
    if (!a) notFound = true;
    const types = a && a.src === "asset" ? await targetTypesOf(a.id) : [];
    const fields = specFieldsOf(a?.gbn || "기타");
    const neededN = fields.filter((f) => isNeeded(a?.need, f)).length;
    sec1 = a && (
      <>
        <F label="시설물명" req><input type="text" readOnly value={a.name} className="usb1-ro" /></F>
        <F label="부서명" req><input type="text" readOnly value={dn.get(a.dept_id) || ""} className="usb1-ro" /></F>
        <F label="주소" req><input type="text" name="addr" required defaultValue={rec?.addr || a.addr} className="usb1-blue" /></F>
        <div className="usb1-row4">
          <F label="시설구분"><input type="text" readOnly value={a.gbn} className="usb1-ro" /></F>
          <F label="시설물 종류"><input type="text" readOnly value={a.kind || "-"} className="usb1-ro" /></F>
          {a.src === "asset" && <>
            <F label="시설물 종별"><input type="text" readOnly value={a.cls || "-"} className="usb1-ro" /></F>
            <F label="안전등급"><input type="text" readOnly value={a.grade || "-"} className="usb1-ro" /></F>
            <F label="준공일"><input type="text" readOnly value={a.completed ? `${a.completed.slice(0, 4)}-${a.completed.slice(4, 6)}-${a.completed.slice(6, 8)}` : "-"} className="usb1-ro" /></F>
          </>}
        </div>
        <F label="관리대상 유형" wide>
          {a.src === "asset" ? (
            <ul className="usb1-types">
              {types.map((x) => (
                <li key={x.code}>
                  <Link href={`/duties/list?role=${role}&axis=target&target=${x.code}`}>{x.name}</Link>
                  <span> — 관계법령 의무 {x.n.toLocaleString()}건(용인 확정 {x.y.toLocaleString()} · 조건부 {(x.n - x.y).toLocaleString()})</span>
                </li>
              ))}
              {!types.length && <li className="usb1-muted">연결된 관리대상 유형이 없습니다</li>}
            </ul>
          ) : <span>공중교통수단 — {a.kind} · {a.law_family}</span>}
        </F>
        <F label="중대시민재해 해당 여부" wide>
          <span className={`usb1-sapa ${a.sapa === "해당" ? "y" : a.sapa === "제외" ? "n" : "q"}`}>{a.sapa || "-"}</span>
          <span className="usb1-basis-t"> {a.sapa_basis}</span>
          {a.need && <span className="usb1-need-t"> · 판정에 필요한 제원: <b>{a.need}</b></span>}
          {a.note && <span className="usb1-basis-t"> · {a.note}</span>}
        </F>
      </>
    );
    sec2 = a && (
      <>
        <div className="usb1-block-h">
          <span className="usb1-lab">시설물 제원</span>
          {neededN > 0 && <span className="usb1-need-t">표시(●)한 {neededN}칸은 중대시민재해 해당 여부 판정에 필요한 제원입니다</span>}
        </div>
        <div className="usb1-spec">
          {fields.map((f) => {
            const need = isNeeded(a.need, f);
            return (
              <label key={f.key} className={`usb1-spec-i${need ? " need" : ""}`}>
                <span>{need && "● "}{f.label}</span>
                <input type="text" name={`spec_${f.key}`} defaultValue={spec[f.key] || ""} />
              </label>
            );
          })}
        </div>
        <WorkerRows init={workers} people={people} />
        <div className="usb1-grid2">
          <div className="usb1-gl">첨부파일</div>
          <div className="usb1-gv"><FileRows init={files} /></div>
        </div>
      </>
    );
    guide = [
      "1. 시설물명·부서명: 시설물 관리 대장(FMS)의 값 — 바꿀 때는 관리대상 대장에서 고친다",
      "2. 주소: 시설물의 위치를 도로명주소로 기입하되 도로명 주소가 없는 경우 지번 주소만 기입",
      "3. 시설물 제원: 시설구분별 제원 입력 — ● 표시 칸은 중대재해처벌법 시행령 별표 2·3 해당 여부 판정에 쓰인다",
      "4. 업무 담당자: 담당자 소속 및 이름, 연락처 입력",
      "5. 첨부파일: 시설물 대장·정밀안전진단 보고서 등 제원 근거 자료",
    ];
  } else {
    const m = (await mtTargets("gm")).find((x) => x.item_id === id);
    if (!m) notFound = true;
    const laws = String(m?.related_law || "").split(/\s*·\s*/).map((x) => x.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
    const md = laws.length ? await duties({ area: "M", limit: 100000 }) : [];
    const perLaw = laws.map((l) => ({ law: l, n: md.filter((d) => d.law === l).length }));
    // 수돗물은 자산 대장의 지방상수도 시설과 잇는다(생산·보관 장소)
    const water = m && /수돗물|상수도/.test(m.item_name) ? assetSeed().filter((a) => a.asset_kind === "지방상수도") : [];
    const acts = String(m?.acts || "").split(/[;,\s]+/).filter(Boolean).map((k) => ACT_LABEL[k] || k);
    sec1 = m && (
      <>
        <F label="품목명" req><input type="text" readOnly value={m.item_name} className="usb1-ro" /></F>
        <F label="부서명" req><input type="text" readOnly value={dn.get(m.dept_id) || ""} className="usb1-ro" /></F>
        <F label="주소(취급 장소)" req><input type="text" name="addr" required defaultValue={rec?.addr || ""} placeholder="생산·보관·제공 장소의 주소" className="usb1-blue" /></F>
        <div className="usb1-row4">
          <F label="취급 행위"><input type="text" readOnly value={acts.join(" · ") || "확인 전"} className="usb1-ro" /></F>
          <F label="시행령 별표 5"><input type="text" readOnly value={m.byeolpyo5 ? (m.byeolpyo5 === "N" ? "해당 없음" : `제${m.byeolpyo5}호`) : "확인 전"} className="usb1-ro" /></F>
        </div>
        <F label="관계 법령" wide>
          {perLaw.length ? (
            <ul className="usb1-types">
              {perLaw.map((x) => <li key={x.law}><b>{x.law}</b> — 원료·제조물 관계법령 의무 {x.n.toLocaleString()}건</li>)}
            </ul>
          ) : <span className="usb1-muted">관계 법령 확인 전</span>}
        </F>
        <F label="해당 여부" wide>
          <span className={`usb1-sapa ${m.verdict === "해당" ? "y" : m.verdict === "비해당" ? "n" : "q"}`}>{m.verdict || "확인 필요"}</span>
          <span className="usb1-basis-t"> {m.reason}</span>
          {m.basis_ref && <div className="usb1-basis-t">근거: {m.basis_ref}</div>}
        </F>
      </>
    );
    sec2 = m && (
      <>
        <div className="usb1-block-h"><span className="usb1-lab">품목 세부</span></div>
        <div className="usb1-spec">
          {MT_FIELDS.map((f) => (
            <label key={f.key} className="usb1-spec-i">
              <span>{f.label}</span>
              <input type="text" name={`x_${f.key}`} defaultValue={extra[f.key] || ""} />
            </label>
          ))}
        </div>
        {water.length > 0 && (
          <div className="usb1-rel">
            <b>관련 시설(시설물 관리 대장 · 지방상수도 {water.length}개소)</b>
            <span>{water.map((a) => <Link key={a.asset_id} href={`/targets/basic/${a.asset_id}?t=fc&role=${role}`}>{a.asset_name}</Link>)}</span>
          </div>
        )}
        <WorkerRows init={workers} people={people} />
        <div className="usb1-grid2">
          <div className="usb1-gl">첨부파일</div>
          <div className="usb1-gv"><FileRows init={files} /></div>
        </div>
      </>
    );
    guide = [
      "1. 품목명·해당 여부: 원료·제조물 대장에서 판단한 값 — 해당 여부는 사유와 함께 사람이 정한다",
      "2. 주소(취급 장소): 원료·제조물을 생산·보관·제공하는 장소",
      "3. 품목 세부: 생산·공급 규모, 공급 대상, 보관 장소, 품질·안전 검사 주기 입력",
      "4. 업무 담당자: 담당자 소속 및 이름, 연락처 입력",
    ];
  }

  // 09-26 사용자: 메뉴 밖 화면 합치기 — 이 사업장 위험성평가(조회). 사업장(WP-…)은 평가의 사업장 칸으로, 부서(D…)는 부서 칸으로 잇는다(app/risk/_scope.ts)
  let riskBox: React.ReactNode = null;
  if (t === "ws" && !notFound) {
    const isWpId = (await workplaces()).some((x) => x.wp_id === id);
    const rs = isWpId ? await riskScope(id) : await riskScope(undefined, id);
    const k = riskCounts(rs.ra, rs.ri);
    const all = isWpId ? `/risk?wp=${encodeURIComponent(id)}&role=${role}` : `/risk?dept=${encodeURIComponent(id)}&role=${role}`;
    const recent = rs.ra.slice(0, 5);
    riskBox = (
      <section className="d26-riskbox">
        <div className="d26-riskbox-h">
          <h2 className="usb1-sec">{isWpId ? "이 사업장" : "이 부서"} 위험성평가(조회)</h2>
          {k.n > 0 && <Link className="usb1-btn-o" href={all}>전체 보기 →</Link>}
        </div>
        <p className="d26-ro-s">위험성평가는 지원 시스템에서 입력합니다 — 여기서는 관리대상 확인용으로 조회만 합니다.</p>
        {k.n === 0 ? (
          <div className="usb1-note">{isWpId ? "이 사업장" : "이 부서"}에 연결된 위험성평가 자료가 없습니다.</div>
        ) : (
          <>
            <div className="d26-kpis">
              <span><small>평가</small><b>{k.n}</b>건</span>
              <span><small>최근 평가일</small><b className="d26-dt">{k.last || "-"}</b></span>
              <span><small>위험 수준 높음</small><b className="d26-hi">{k.high}</b></span>
              <span><small>보통</small><b>{k.mid}</b></span>
              <span><small>낮음</small><b>{k.low}</b></span>
              <span><small>개선조치 미완</small><b className="d26-open">{k.open}</b>{k.openHigh ? <small> (높음 {k.openHigh})</small> : null}</span>
            </div>
            <table className="us-tbl usb1-list">
              <thead><tr><th>구분</th><th>평가</th><th>평가일</th><th>상태</th><th>확인된 관리대상</th><th>유해·위험요인</th></tr></thead>
              <tbody>
                {recent.map((a) => {
                  const c1 = riskCounts([a], rs.ri);
                  return (
                    <tr key={a.risk_id}>
                      <td className="c">{a.kind || "-"}</td>
                      <td><Link href={`${all}&r=${encodeURIComponent(a.risk_id)}#rd`}>{a.title}</Link></td>
                      <td className="c">{a.assessed_at || "-"}</td>
                      <td className="c"><span className={`badge ${statusTone(a.status)}`}>{a.status || "-"}</span></td>
                      <td>{targetsOf(a).length ? <span className="d26-tgts">{targetsOf(a).map((x) => <span key={x}>{x}</span>)}</span> : <span className="usb1-muted">-</span>}</td>
                      <td className="c">{c1.items}건{c1.high ? <> · <span className="badge bad">높음 {c1.high}</span></> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {k.n > recent.length && <p className="d26-more"><Link href={all}>최근 {recent.length}건만 보였습니다 — 평가 {k.n}건 전체 보기 →</Link></p>}
          </>
        )}
      </section>
    );
  }

  if (notFound) {
    return (
      <UsLayout side={<B1Side role={role} on={t} />}>
        <PageHead sub="기본정보" title={TRACK_LABEL[t]} />
        <p>관리대상을 찾지 못했습니다. <Link href={back}>목록으로</Link></p>
      </UsLayout>
    );
  }

  return (
    <UsLayout side={<B1Side role={role} on={t} />}>
      <PageHead sub="기본정보" title={TRACK_LABEL[t]} />
      {sp.ok && <div className="usb1-ok">저장했습니다 — 기준일자 {baseDate}</div>}

      <form action={saveBasic} className="usb1-form" key={`${baseDate}:${rec?.basic_id || ""}`}>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="t" value={t} />
        <input type="hidden" name="target_id" value={id} />

        <div className="usb1-datebar">
          <label>기준일자</label>
          <input type="date" name="base_date" defaultValue={baseDate} required />
          {hist.length > 0 && (
            <span className="usb1-hist">
              기준일자 이력
              {hist.map((h) => (
                <Link key={h.base_date} href={`/targets/basic/${encodeURIComponent(id)}?t=${t}&role=${role}&d=${h.base_date}`}
                  className={h.base_date === (cur?.base_date || "") ? "on" : ""}>{h.base_date}</Link>
              ))}
            </span>
          )}
        </div>
        {prev && <p className="usb1-note">기준일자 {sp.d} 기록이 없어 {prev.base_date} 기록을 불러왔습니다. 저장하면 {sp.d} 기록이 새로 생깁니다.</p>}
        {!rec && <p className="usb1-note">아직 입력한 기록이 없습니다. 기준일자를 정하고 저장하면 입력 현황에 「입력」으로 잡힙니다.</p>}

        <h2 className="usb1-sec">1. {t === "ws" ? "사업장" : t === "fc" ? "시설물" : "원료·제조물"} 기본정보</h2>
        <div className="usb1-body">{sec1}</div>

        <details className="usb1-det" open>
          <summary><span>2. 세부정보</span><span className="usb1-tog">^</span></summary>
          <div className="usb1-body">{sec2}</div>
        </details>

        <div className="usb1-actions">
          <Link href={back} className="usb1-btn-back">〈 목록으로</Link>
          <button type="submit" className="usb1-btn-save">저장하기</button>
        </div>
      </form>

      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 「사업장 내 위험성평가를 어딘가에서 볼 수 있으면 된다」. 조회만(입력은 위험성평가 지원 시스템) */}
      {riskBox}

      <div className="usb1-guide">
        <b>작성요령</b>
        <ol>{guide.map((g) => <li key={g} className={g.startsWith(" -") ? "sub" : ""}>{g}</li>)}</ol>
      </div>
    </UsLayout>
  );
}
