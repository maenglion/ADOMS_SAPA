/**
 * [400 · 교육자료 버전] 묶음 A — 이행현황 한 템플릿(명세 02: SCR-010~017).
 *   view 없음 → 취합 대상 설정(SCR-010 · 014)
 *   view=year → 선택항목에 대한 해당년도 이행 현황표(SCR-011 · 015)
 *   view=all  → 선택항목에 대한 대상별 이행 현황표(SCR-012 · 016) + 메시지 보내기
 *   modal=order → 이행현황 확인에 따른 조치 지시(SCR-013 · 017) · modal=sent → 메시지 발신 목록
 * 중대산업재해(ws)와 중대시민재해(fc · mt)는 라벨과 대상 축만 다르다(명세 SCR-014 구현 메모).
 */
import Link from "next/link";
import { staff, readTable } from "@/lib/data";
import { ymd } from "@/lib/day";
import StatusSide from "./StatusSide";
import ParamSelect from "./ParamSelect";
import { sendOrder } from "../actions";
import CheckAll from "@/components/us/CheckAll";
import { pctFloor, floor1 } from "@/lib/num";   // 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
import { CHANNEL_LIST, channelText, resultList, receiptsOf } from "@/lib/channels";
import {
  scopeOf, deptList, buildBoard, taskRows, recordRows, listParam, yearsOf, thisYear, orderLog,
  PICK4, AREA_OF, gradeClass, pct0, pct2, cntText, type Mark,
} from "../_lib/calc";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

const CELL: Record<Mark, string> = { O: "usa-c-o", "△": "usa-c-t", X: "usa-c-x", "-": "usa-c-n", wait: "usa-c-w" };
const CELL_TXT: Record<Mark, string> = { O: "O", "△": "△", X: "X", "-": "-", wait: "예정" };

export default async function StatusPage({ track, sp }: { track: "ws" | "fc" | "mt"; sp: SP }) {
  const role = one(sp.role) || "gm";
  const base = track === "ws" ? "/status/industrial" : "/status/civil";
  const civil = track !== "ws";
  // 라벨 — 중대산업재해: 사업장 / 중대시민재해: 실·국·본부(명세 SCR-014)
  const L = civil
    ? { sel: "부서", name: "부서명", left: "의무이행 사항", right: "실·국·본부", col: "실·국·본부" }
    : { sel: "사업장", name: "사업장명", left: "안전·보건 확보의무", right: "사업장", col: "사업장" };

  const view = one(sp.view);
  const year = one(sp.year) || thisYear();
  const q = one(sp.q), cat = one(sp.cat);
  const fold = listParam(sp.fold).map(Number);
  const modal = one(sp.modal);

  const sc = await scopeOf(role);
  const dAll = await deptList(sc);
  // 이 재해 구분에 과제가 있는 부서 — 처음 화면에서 미리 골라 둔다(과제가 없으면 모든 칸이 해당없음이다).
  const area = AREA_OF[track];
  const withTask = new Set([
    ...(await taskRows(year)).filter((r) => r.area === area).map((r) => r.dept_id),
    ...(await recordRows(track, year)).map((r) => r.dept_id),
  ]);

  // 09-24 사용자: 재해 종류를 고르면 안전·보건 확보의무는 기본으로 전체(1~4) 선택 — 참고 명세의 「1 · 4만」 기본은 쓰지 않는다
  const gSel = sp.g !== undefined ? listParam(sp.g).map(Number) : PICK4.map((x) => x.g);
  const dSel = sp.d !== undefined ? listParam(sp.d) : dAll.filter((d) => withTask.has(d.dept_id)).map((d) => d.dept_id);

  // 주소 만들기 — 지금 값에 바꿀 것만 덮는다.
  const state: Record<string, string> = {
    role, ...(civil ? { t: track } : {}), view, year, g: gSel.join(","), d: dSel.join(","), q, cat, fold: fold.join(","),
  };
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) p.set(k, v);
    return `${base}?${p.toString()}`;
  };

  /* ── SCR-010 · 014 취합 대상 설정 ─────────────────────────────── */
  if (!view) {
    // 사업장 20곳(09-24 · 전부 확인 필요) — 이행 과제는 용인시청 본청(WP-01) 부서에만 있다. 다른 사업장을 고르면 「과제 없음」.
    const wps = civil ? [] : (await readTable("usb1_workplace", "wp_id")).filter((w) => w.deleted !== "Y")
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const wpSel = !civil && cat && cat !== "전체" && cat !== "본청" && cat !== "WP-01" ? wps.find((w) => w.wp_id === cat) : undefined;
    const cands = wpSel ? [] : dAll.filter((d) =>
      (!q || String(d.dept_name).includes(q)) &&
      (!cat || cat === "전체" || (civil ? d.dept_role === cat : true)));
    const allG = sp.all === "g0" ? [] : sp.all === "g1" ? [1, 2, 3, 4] : gSel;
    const allD = sp.all === "d0" ? [] : sp.all === "d1" ? cands.map((d) => d.dept_id) : dSel;
    return (
      <div className="usa-wrap">
        <StatusSide on={track} role={role} />
        <section className="usa-main">
          <h2 className="usa-title">취합 대상 설정</h2>
          <form className="usa-search" method="get" action={base}>
            <input type="hidden" name="role" value={role} />
            {civil && <input type="hidden" name="t" value={track} />}
            <label>{L.sel}
              <select name="cat" defaultValue={cat || "전체"}>
                <option>전체</option>
                {civil
                  ? ["총괄", "관리", "현업"].map((x) => <option key={x}>{x}</option>)
                  : wps.length
                    ? wps.map((w) => <option key={w.wp_id} value={w.wp_id === "WP-01" ? "본청" : w.wp_id}>{w.wp_name}</option>)
                    : <option value="본청">용인시청 본청</option>}
              </select>
            </label>
            <label className="usa-grow">{L.name}
              <input name="q" defaultValue={q} placeholder="사업장 또는 부서명을 입력하세요" />
            </label>
            <button className="usa-sbtn" type="submit">🔍검색</button>
          </form>

          <form method="get" action={base}>
            <input type="hidden" name="role" value={role} />
            {civil && <input type="hidden" name="t" value={track} />}
            <input type="hidden" name="view" value="year" />
            <input type="hidden" name="year" value={year} />
            <div className="usa-pick2">
              <div className="usa-pbox">
                <div className="usa-pbox-h">{L.left}
                  {/* 09-26 사용자: 「전체 선택」이 작동 안 함 — 브라우저에서 바로 켜고 끄는 단추로(components/us/CheckAll) */}<CheckAll name="g" />
                </div>
                {PICK4.map((x) => (
                  <label key={x.g} className="usa-prow tall">
                    <span>{x.label}</span>
                    <input type="checkbox" name="g" value={x.g} defaultChecked={allG.includes(x.g)} />
                    <span className="usa-dot">⌄</span>
                  </label>
                ))}
              </div>
              <div className="usa-pbox">
                <div className="usa-pbox-h">{L.right}
                  {!civil && <span className="usa-pill">{wpSel ? wpSel.wp_name : "용인시청 본청"}</span>}
                  <CheckAll name="d" />
                </div>
                <div className="usa-plist">
                  {cands.map((d, i) => (
                    <label key={d.dept_id} className="usa-prow">
                      <span>{i + 1}. {d.dept_name}{withTask.has(d.dept_id) ? "" : <small className="usa-mut"> (기록 없음)</small>}</span>
                      <input type="checkbox" name="d" value={d.dept_id} defaultChecked={allD.includes(d.dept_id)} />
                      <span className="usa-dot">⌄</span>
                    </label>
                  ))}
                  {!cands.length && <div className="usa-empty">{wpSel ? "이 사업장에는 아직 이행 과제가 없습니다(과제 없음)." : <>찾는 {L.right}이(가) 없습니다.</>}</div>}
                </div>
                {cands.length > 10 && <div className="usa-more">︾</div>}
              </div>
            </div>
            <div className="usa-right"><button className="usa-gbtn" type="submit">취합 시작</button></div>
          </form>
        </section>
      </div>
    );
  }

  /* ── SCR-011 · 012 · 015 · 016 이행 현황표 ─────────────────────── */
  const cols = dAll.filter((d) => dSel.includes(d.dept_id));
  const B = await buildBoard(track, year, gSel, cols);
  const years = await yearsOf();
  const wide = view === "all";
  const wideCols = wide ? cols : [];
  const hideRow = (l: { kind: string; g: number }) => l.kind === "item" && fold.includes(l.g);
  const toggleFold = (g: number) => (fold.includes(g) ? fold.filter((x) => x !== g) : [...fold, g]).join(",");
  const exportHref = `/status/export?${new URLSearchParams({ track, year, g: gSel.join(","), d: dSel.join(","), view }).toString()}`;

  return (
    <div className="usa-wrap">
      <StatusSide on={track} role={role} />
      <section className="usa-main">
        <div className="usa-bar">
          <div className="usa-year"><b>년도</b>
            <ParamSelect name="year" value={year} options={years.map((y) => ({ v: y, label: y }))} />
          </div>
          <div className="usa-flex">
            <Link className="usa-back" href={href({ view: null })}>취합 대상 다시 고르기</Link>
            <a className="usa-xbtn" href={exportHref}>엑셀다운로드</a>
            <Link className="usa-wbtn" href={href({ view: wide ? "year" : "all" })}>{wide ? "요약보기" : "전체보기"}</Link>
          </div>
        </div>

        <div className="usa-scroll">
          <table className="usa-mx">
            <thead>
              <tr>
                <th rowSpan={wide && !civil ? 3 : 2} className="usa-th-item">점검사항</th>
                <th rowSpan={wide && !civil ? 3 : 2}>이행률</th>
                <th rowSpan={wide && !civil ? 3 : 2}>전체항목</th>
                <th rowSpan={wide && !civil ? 2 : 1}>이행완료</th>
                <th rowSpan={wide && !civil ? 2 : 1}>보완필요</th>
                <th rowSpan={wide && !civil ? 2 : 1}>미이행</th>
                <th rowSpan={wide && !civil ? 2 : 1}>해당없음</th>
                {wide && <th colSpan={Math.max(wideCols.length, 1)}>{L.col}</th>}
              </tr>
              {wide && !civil && (
                <tr><th colSpan={Math.max(wideCols.length, 1)}>용인시청 본청</th></tr>
              )}
              <tr>
                <th>(O)</th><th>(△)</th><th>(X)</th><th>(-)</th>
                {wideCols.map((c) => <th key={c.dept_id} className="usa-th-col">{c.dept_name}</th>)}
                {wide && !wideCols.length && <th>-</th>}
              </tr>
            </thead>
            <tbody>
              {B.lines.filter((l) => !hideRow(l)).map((l, i) => (
                <tr key={i} className={l.kind === "grp" ? "usa-grp" : "usa-item"}>
                  <td className={l.kind === "grp" ? "usa-td-grp" : "usa-td-item"}>
                    {l.label}
                    {l.kind === "grp" && !l.cells && (
                      <Link className="usa-fold" href={href({ fold: toggleFold(l.g) })} title="접기·펼치기">{fold.includes(l.g) ? "›" : "⌄"}</Link>
                    )}
                  </td>
                  {l.cnt ? (
                    <>
                      <td className={`c ${gradeClass(l.rate)}`}>{pct0(l.rate)}</td>
                      <td className="c">{l.cnt.n}</td>
                      <td className="c">{cntText(l.cnt.O)}</td>
                      <td className="c">{cntText(l.cnt.T)}</td>
                      <td className="c">{cntText(l.cnt.X)}</td>
                      <td className="c">{cntText(l.cnt.N)}</td>
                      {wide && l.cells!.map((m, j) => <td key={j} className={`c ${CELL[m]}`}>{CELL_TXT[m]}</td>)}
                    </>
                  ) : (
                    <>
                      <td /><td /><td /><td /><td /><td />
                      {wide && wideCols.map((c) => <td key={c.dept_id} />)}
                    </>
                  )}
                  {wide && !wideCols.length && <td />}
                </tr>
              ))}
              <tr className="usa-total">
                <td className="c"><b>이행률</b></td>
                <td className={`c ${gradeClass(B.total)}`}>{pct0(B.total)}</td>
                <td colSpan={5} />
                {wide && B.colRate.map((r, j) => <td key={j} className={`c ${gradeClass(r)}`}>{r === null ? "-" : pctFloor(r)}</td>)}
                {wide && !wideCols.length && <td />}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="usa-foot">
          <div>
            {/* 09-25 사용자: 취합 시작 뒤 첫 화면(요약보기)에서도 보이게 — 전엔 전체보기에서만 떴다 */}
            <Link className="usa-msgbtn" href={href({ modal: "order" })}>메시지 보내기</Link>
          </div>
          <div className="usa-legend">
            <span className="usa-good">우수<br /><small>(80% 이상)</small></span>
            <span className="usa-mid">보통<br /><small>(70% 이상)</small></span>
            <span className="usa-low">미흡<br /><small>(70% 미만)</small></span>
          </div>
        </div>
        {/* TODO: 확인 — 등급 임계값(80·70)은 명세 추정값(명세 00 §6). 「예정」은 이행 시기가 오지 않은 칸이라 이행률에서 뺐다(명세에 없는 값). */}
        <p className="usa-note">
          · 이행완료(O) · 보완필요(△) · 미이행(X) · 해당없음(-) — 줄의 숫자는 과제(의무) 하나하나를 센 것이고, 이행률 = 이행완료 ÷ (이행완료 + 보완필요 + 미이행) — 대시보드와 같은 계산입니다. 전체보기의 부서 칸 기호는 그 부서 과제를 모은 것(하나라도 미이행이면 X)입니다.
          {" "}「예정」은 이행 시기가 아직 오지 않은 칸으로, 이행률 계산에서 뺍니다. 과제·이행 기록 {B.tasks.length.toLocaleString()}건 기준 · {year}년.
        </p>

        {modal === "order" && <OrderModal role={role} track={track} civil={civil} colLabel={L.col} cols={cols} rates={B.colRate} sp={sp} href={href} />}
        {modal === "sent" && <SentModal track={track} href={href} ok={one(sp.ok)} pend={one(sp.pend)} />}
      </section>
    </div>
  );
}

/* ── SCR-013 · 017 조치 지시 모달 ────────────────────────────────── */
async function OrderModal({ role, track, civil, colLabel, cols, rates, sp, href }: {
  role: string; track: string; civil: boolean; colLabel: string; cols: any[]; rates: (number | null)[]; sp: SP;
  href: (p: Record<string, string | null>) => string;
}) {
  const mq = one(sp.mq);
  const pick = listParam(sp.pick);
  const done = one(sp.done) === "1";
  const rateOf_ = new Map(cols.map((c, i) => [c.dept_id, rates[i]]));
  const left = cols.filter((c) => !mq || String(c.dept_name).includes(mq));
  const right = cols.filter((c) => pick.includes(c.dept_id));
  const rt = (id: string) => rateOf_.get(id);
  const add = (id: string) => [...pick.filter((x) => x !== id), id].join(",");
  const del = (id: string) => pick.filter((x) => x !== id).join(",");
  // 예시 문구 — 이행률이 낮은 두 곳(명세 SCR-013 textarea 예시 모양)
  const low = [...cols].filter((c) => rt(c.dept_id) !== null && rt(c.dept_id)! < 70).sort((a, b) => (rt(a.dept_id)! - rt(b.dept_id)!)).slice(0, 2);
  const eg = `예시) ${(low.length ? low : cols.slice(0, 2)).map((c) => c.dept_name).join(", ")} 는 이행률 개선 조치 바람`;
  const preset = done && right.length ? `${right.map((c) => c.dept_name).join(", ")} 는 이행률 개선 조치 바람` : "";
  const back = href({ modal: null, pick: null, mq: null, done: null });
  const keep = new URLSearchParams(back.split("?")[1]);
  const st = await staff();
  const owner = (dept: string) => st.find((s: any) => s.dept_id === dept && s.duty_role === "정담당")?.display_name || "";

  return (
    <div className="us-modal-bg">
      <div className="usa-modal">
        <Link className="usa-x" href={back} title="닫기">✕</Link>
        <div className="usa-mtop">
          <Link className="usa-wbtn" href={href({ modal: "sent" })}>메시지 발신 목록</Link>
          <form method="get" className="usa-msearch">
            {[...keep.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="hidden" name="modal" value="order" />
            <input type="hidden" name="pick" value={pick.join(",")} />
            <input name="mq" defaultValue={mq} placeholder={`${colLabel} 이름`} />
            <button type="submit">🔍 검색</button>
          </form>
        </div>
        <div className="usa-transfer">
          <table className="usa-mt">
            <thead><tr><th>{colLabel}</th><th>이행률</th><th>선택</th></tr></thead>
            <tbody>
              {left.map((c) => (
                <tr key={c.dept_id}>
                  <td className="c">{c.dept_name}</td>
                  <td className={`c ${gradeClass(rt(c.dept_id))}`}>{pct2(rt(c.dept_id))}</td>
                  <td className="c">{pick.includes(c.dept_id)
                    ? <span className="usa-sbtn dim">추가</span>
                    : <Link className="usa-sbtn" href={href({ modal: "order", pick: add(c.dept_id), mq: mq || null })}>추가</Link>}</td>
                </tr>
              ))}
              {!left.length && <tr><td colSpan={3} className="c usa-mut">대상이 없습니다.</td></tr>}
            </tbody>
          </table>
          <div className="usa-arrow">➨</div>
          <div>
            <table className="usa-mt">
              <thead><tr><th>{colLabel}</th><th>이행률</th><th>선택</th></tr></thead>
              <tbody>
                {right.map((c) => (
                  <tr key={c.dept_id}>
                    <td className="c">{c.dept_name}</td>
                    <td className={`c ${gradeClass(rt(c.dept_id))}`}>{pct2(rt(c.dept_id))}</td>
                    <td className="c"><Link className="usa-sbtn" href={href({ modal: "order", pick: del(c.dept_id) || null, mq: mq || null })}>제외</Link></td>
                  </tr>
                ))}
                {!right.length && <tr><td colSpan={3} className="c usa-mut">왼쪽에서 추가하세요.</td></tr>}
              </tbody>
            </table>
            <div className="usa-right"><Link className="usa-wbtn" href={href({ modal: "order", pick: pick.join(",") || null, done: "1" })}>선택 완료</Link></div>
          </div>
        </div>
        <form action={sendOrder} className="usa-msg">
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="track" value={track} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="pick" value={pick.join(",")} />
          <input type="hidden" name="names" value={right.map((c) => c.dept_name).join(", ")} />
          <input type="hidden" name="owners" value={right.map((c) => `${c.dept_name}:${owner(c.dept_id)}`).join(" · ")} />
          <input type="hidden" name="rates" value={right.map((c) => `${c.dept_name} ${pct2(rt(c.dept_id))}`).join(" · ")} />
          <span className="usa-wbtn static">메시지</span>
          <textarea name="message" rows={3} defaultValue={preset} placeholder={eg} required />
          {/* 09-25 사용자(메일 발송): 준비 안 된 까닭은 lib/channels.ts note(전자우편 = 메일 서버 설정 필요) */}
          {/* 발신 수단 — 앱 알림은 늘 보낸다. 문자·전자우편·카카오톡은 연결 준비 중(골라도 밖으로 보내지 않고 기록에 「미발송」으로 남는다). */}
          <div className="usa-chan" role="group" aria-label="발신 수단">
            <b>발신 수단</b>
            {CHANNEL_LIST.map((c) => (
              <label key={c.channel} className={c.ready ? "" : "off"} title={c.ready ? "" : `${c.note || "연결 준비 중"} — 골라도 지금은 보내지 않고, 발신 기록에 미발송으로 남습니다`}>
                {c.channel === "app"
                  ? <input type="checkbox" checked disabled readOnly aria-label="앱 알림(늘 보냄)" />
                  : <input type="checkbox" name="channel" value={c.channel} />}
                {" "}{c.label}{!c.ready && <span className="usa-soon">{c.note || "연결 준비 중"}</span>}
              </label>
            ))}
          </div>
          <div className="usa-right">
            {right.length
              ? <button className="usa-wbtn" type="submit">발신</button>
              : <span className="usa-mut">받을 {colLabel}을(를) 먼저 추가하세요.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

/** 메시지 발신 목록 — 조치 지시 기록(usa_order). */
async function SentModal({ track, href, ok, pend }: { track: string; href: (p: Record<string, string | null>) => string; ok: string; pend: string }) {
  const rows = (await orderLog()).filter((r) => !track || r.track === track);
  // 읽음 수 — 받는 사람별 앱 알림(notification)의 read_at. 받는 쪽이 「내 업무」 알림에서 「읽음 확인」을 누르면 오른다.
  const rc = await receiptsOf(rows.map((r) => String(r.order_id)));
  const nm = new Map((await staff()).map((x: any) => [x.staff_id, String(x.display_name || "")]));
  return (
    <div className="us-modal-bg">
      <div className="usa-modal">
        <Link className="usa-x" href={href({ modal: null })} title="닫기">✕</Link>
        <h3 className="usa-title">메시지 발신 목록</h3>
        {ok && <p className="usa-ok">{ok}곳에 조치 지시를 보냈습니다. 받는 부서 담당자의 알림에 뜹니다.{pend && ` (${pend.replace(/·/g, " · ")}은(는) 연결 준비 중이라 보내지 않고 기록에만 남겼습니다.)`}</p>}
        <table className="usa-mt">
          <thead><tr><th>발신일</th><th>받는 곳</th><th>당시 이행률</th><th>메시지</th><th>보낸 사람</th><th>수단 · 결과</th><th>읽음</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const list = rc.get(String(r.order_id)) || [];
              const read = list.filter((n) => n.read_at).length;
              const res = resultList(r.results);
              return (
              <tr key={r.order_id}>
                <td className="c">{r.sent_at ? ymd(new Date(r.sent_at)) : ""}</td>
                <td>{r.to_names}</td>
                <td>{r.rates}</td>
                <td>{r.message}</td>
                <td className="c">{r.from_name}</td>
                <td>
                  {channelText(r.channels)}
                  {res.length > 0 && <div className="usa-mut usa-res">{res.map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>}
                </td>
                <td className="c" title={list.map((n) => `${nm.get(n.to_staff_id) || "받는 사람"} ${n.read_at ? "읽음" : "안 읽음"}`).join(" · ")}>{list.length ? `${read}/${list.length}` : "-"}</td>
              </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="c usa-mut">보낸 메시지가 없습니다.</td></tr>}
          </tbody>
        </table>
        <div className="usa-right"><Link className="usa-wbtn" href={href({ modal: "order" })}>메시지 보내기로</Link></div>
      </div>
    </div>
  );
}

