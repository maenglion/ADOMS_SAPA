import Link from "next/link";
import StaffPicker, { type StaffOpt } from "@/components/StaffPicker";
import { ceoConfirm } from "@/lib/roles";
import { hid } from "@/app/hazards/codes";
import type { Row } from "@/lib/data";
import {
  ACT_KINDS, CEO_KINDS, REPORT_STAGES, RECIPIENTS,
  kindLabel, kindBasis, kindRequired, fmtMin, minutesBetween, nowStr, type RespView,
} from "./response";
import { addReport, recordAct, ceoAck, ceoDirect } from "./response-actions";
import s from "./recurrence.module.css";

// [캡처 v2] 보조 설명·법령 설명·단계 힌트 줄 제거, 배지 문구 짧게(09-22)
/**
 * 재해 한 건의 「발생 직후 대응」 — 원인 조사 앞 단계(2026-09-22).
 * 보고 3단계(최초·직후·수시) · 긴급 조치 · 경영책임자 받음·지시.
 */
type P = {
  i: Row; r: RespView; role: string; canWrite: boolean; t: string;
  staffOpts: StaffOpt[]; nm: (id?: string) => string; limitMin: number;
  hidden: Record<string, string | undefined>;
};

const Ev = ({ row }: { row: Row }) =>
  row.evidence_url ? <a className={s.ev} href={row.evidence_url} target="_blank" rel="noreferrer">증빙 {row.evidence_name || "파일"}</a>
    : row.evidence_name ? <span className={s.ev}>증빙 {row.evidence_name}</span> : null;

export default function ResponsePanel({ i, r, role, canWrite, t, staffOpts, nm, limitMin, hidden }: P) {
  const c = ceoConfirm(role);
  const civil = r.area !== "산업";
  // [캡처 v2] 원료·제조물 재해는 시행령 제8조제3호다목(보고·신고·조치) — 공중이용시설 조문(제10조제7호다목)을 쓰던 것 정정(09-24 점검 K07)
  const material = String((i as any).basis_clause || "").includes("제9조제1항");
  const lawRef = !civil ? "시행령 제4조제8호" : material ? "시행령 제8조제3호다목" : "시행령 제10조제7호다목";
  const Hidden = () => (
    <>
      {Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <input type="hidden" name="incident_id" value={i.incident_id} />
    </>
  );
  const limitTxt = fmtMin(limitMin);
  const firstBadge = !r.recognizedAt
    ? <span className="badge warn">인지 시각 없음</span>
    : r.first
      ? <span className={`badge ${r.firstLate ? "bad" : "ok"}`}>최초보고 {fmtMin(r.firstMin)}{r.firstLate ? " · 넘김" : ""}</span>
      : <span className={`badge ${r.firstLate ? "bad" : "warn"}`}>보고 전 {fmtMin(r.firstMin)}{r.firstLate ? " · 넘김" : ""}</span>;
  const state = r.complete ? <span className="badge ok">끝남</span>
    : r.started ? <span className="badge warn">미완 {r.missing.length}</span>
      : <span className="badge none">기록 없음</span>;
  const kinds = ACT_KINDS.filter((k) => kindRequired(k, r.area) || k.optional);
  const defAt = nowStr().replace(" ", "T");   // 서버 지역 시각(날짜를 UTC 로 잡으면 새벽에 하루 어긋난다)

  return (
    <details className={s.resp} open={r.active || undefined} id={`resp-${i.incident_id}`}>
      <summary>
        <b>발생 직후 대응</b> {state} {firstBadge}
        {r.ceoAck && <span className="badge ok">경영책임자 받음</span>}
      </summary>

      {/* 1. 보고 3단계 */}
      <div className={s.respSub}>보고 <span className="muted">기한 {limitTxt}</span></div>
      <ol className={s.rsteps}>
        {REPORT_STAGES.map((st) => {
          const rows = r.reports.filter((x) => x.report_stage === st);
          return (
            <li key={st} className={rows.length ? s.done : ""}>
              <b>{st}</b>
              {!rows.length && <span>기록 없음</span>}
              {rows.map((x) => (
                <details key={x.report_id} className={s.rdet}>
                  <summary>{x.seq ? `${x.seq}차 · ` : ""}{x.reported_at} · {nm(x.reporter_staff_id)}</summary>
                  <div>수신: {x.recipients}{x.agency_name ? ` (${x.agency_name})` : ""}{x.channel ? ` · ${x.channel}` : ""}</div>
                  <dl className={s.dl}>
                    {x.overview && <><dt>개요</dt><dd>{x.overview}</dd></>}
                    {x.damage && <><dt>피해</dt><dd>{x.damage}</dd></>}
                    {x.rescue && <><dt>구조</dt><dd>{x.rescue}</dd></>}
                    {x.recovery && <><dt>수습</dt><dd>{x.recovery}</dd></>}
                    {x.support && <><dt>협조</dt><dd>{x.support}</dd></>}
                    {x.next_plan && <><dt>향후</dt><dd>{x.next_plan}</dd></>}
                  </dl>
                  <Ev row={x} />
                  {st === "최초보고" && (x.ceo_ack_at
                    ? <div><span className="badge ok">경영책임자 받음 {x.ceo_ack_at}</span>
                        {x.ceo_ack_proxy === "Y" && <span className="muted"> 대리 기록 · {nm(x.ceo_ack_recorded_by)}</span>}
                        <span className="muted"> · 보고 후 {fmtMin(minutesBetween(x.reported_at, x.ceo_ack_at))}</span></div>
                    : <div className="muted">경영책임자 받음 기록 없음</div>)}
                </details>
              ))}
            </li>
          );
        })}
      </ol>
      {canWrite && (
        <details className={s.act}>
          <summary>보고 기록 →</summary>
          <form action={addReport} className={s.respForm}>
            <Hidden />
            <label>단계 *
              <select name="report_stage" required defaultValue={!r.first ? "최초보고" : !r.after ? "직후보고" : "수시보고"}>
                {REPORT_STAGES.map((x) => <option key={x}>{x}</option>)}
              </select></label>
            <label>보고 시각 *<input type="datetime-local" name="reported_at" required defaultValue={defAt} /></label>
            <label>보고자 *<StaffPicker name="reporter_staff_id" staff={staffOpts} label="보고자" defaultValue={i.owner_staff_id || ""} /></label>
            <fieldset className={s.recips}><legend>수신 *</legend>
              {RECIPIENTS.map((x) => <label key={x}><input type="checkbox" name="recipients" value={x} defaultChecked={x !== "관계 행정기관"} /> {x}</label>)}
            </fieldset>
            <label>행정기관 이름<input type="text" name="agency_name" /></label>
            <label>보고 방법<select name="channel" defaultValue="전화"><option>전화</option><option>문자</option><option>서면</option><option>대면</option></select></label>
            <label className={s.wide}>개요 *<input type="text" name="overview" required /></label>
            <label>피해(인명·기타)<input type="text" name="damage" /></label>
            <label>긴급구조<input type="text" name="rescue" /></label>
            <label>수습<input type="text" name="recovery" /></label>
            <label>지원·협조<input type="text" name="support" /></label>
            <label>향후 대책<input type="text" name="next_plan" /></label>
            <label>보고 문서·사진<input type="file" name="evidence_upload" accept="image/*,application/pdf" /></label>
            <label>문서 이름<input type="text" name="evidence_name" /></label>
            <button className="btn sm" type="submit">보고 기록</button>
          </form>
        </details>
      )}

      {/* 2. 긴급 조치 */}
      <div className={s.respSub}>긴급 조치 <span className="muted">{lawRef}</span></div>
      <div className="tbl-wrap">
        <table className={s.rtable}>
          <tbody>
            {kinds.map((k) => {
              const x = r.byKind.get(k.key);
              return (
                <tr key={k.key}>
                  <td style={{ width: "13rem" }}>
                    <b title={kindBasis(k, r.area)}>{kindLabel(k.key, r.area)}</b>
                  </td>
                  <td style={{ width: "7rem" }}>
                    {!x ? <span className={`badge ${k.optional ? "none" : "warn"}`}>{k.optional ? "필요 시" : "기록 없음"}</span>
                      : x.status === "해당 없음" ? <span className="badge none">해당 없음</span>
                        : <span className="badge ok">함</span>}
                  </td>
                  <td>
                    {x && <>
                      {x.done_at && <span>{x.done_at}</span>}{x.done_by && <span> · {nm(x.done_by)}</span>}
                      {x.target_org && <span> · {x.target_org}</span>}
                      {x.detail && <span className="muted" title={x.detail}> · {x.detail}</span>}
                      <Ev row={x} />
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <details className={s.act}>
          <summary>조치 기록 →</summary>
          <form action={recordAct} className={s.respForm}>
            <Hidden />
            <label>조치 *
              <select name="kind" required defaultValue={r.missing[0]?.key || ""}>
                <option value="" disabled>고르십시오</option>
                {kinds.map((k) => <option key={k.key} value={k.key}>{kindLabel(k.key, r.area)}{r.byKind.get(k.key) ? " (다시 기록)" : ""}</option>)}
              </select></label>
            <label>결과 *
              <select name="status" defaultValue="완료"><option>완료</option><option>해당 없음</option></select></label>
            <label>시각<input type="datetime-local" name="done_at" defaultValue={defAt} /></label>
            <label>누가<StaffPicker name="done_by" staff={staffOpts} label="한 사람" defaultValue={i.owner_staff_id || ""} allowEmpty /></label>
            <label>기관·대상<input type="text" name="target_org" /></label>
            <label className={s.wide}>내용<input type="text" name="detail" /></label>
            <label>사진·문서 올리기<input type="file" name="evidence_upload" accept="image/*,application/pdf" capture="environment" /></label>
            <label>문서 이름<input type="text" name="evidence_name" /></label>
            <button className="btn sm" type="submit">조치 기록</button>
          </form>
        </details>
      )}

      {/* 3. 경영책임자 */}
      <div className={s.respSub}>경영책임자</div>
      <ul className={s.ceoList}>
        <li>최초보고 받음: {r.ceoAck
          ? <b>{r.ceoAck.ceo_ack_at}{r.ceoAck.ceo_ack_proxy === "Y" ? " (대리)" : ""}</b>
          : r.first ? <span className={s.warnText}>없음</span> : <span className="muted">—</span>}</li>
        {CEO_KINDS.map((k) => {
          const x = r.byKind.get(k.key);
          return <li key={k.key}>{k.label}: {x
            ? <><b>{x.done_at}</b> — {x.detail}{x.target_org ? ` (받는 사람 ${nm(x.target_org)})` : ""}{x.proxy === "Y" ? <span className="muted"> · 대리 기록 {nm(x.recorded_by)}</span> : ""}</>
            : <span className="muted">없음</span>}</li>;
        })}
        {r.byKind.get("ceo_cause") && (
          <li className="muted">원인 조사 {i.investigated_at ? i.investigated_at : `기한 ${i.cause_due || "—"}`}</li>
        )}
      </ul>
      {c.ok && (
        <div className={s.ceoForms}>
          {r.first && !r.ceoAck && (
            <form action={ceoAck} className={s.inlineForm}>
              <Hidden /><input type="hidden" name="report_id" value={r.first.report_id} />
              <input type="datetime-local" name="ack_at" defaultValue={defAt} aria-label="받은 시각" />
              <button className="btn sm" type="submit">{c.proxy ? "최초보고 받음 (대리 기록)" : "최초보고 받음"}</button>
            </form>
          )}
          <details className={s.act}>
            <summary>{c.proxy ? "경영책임자 지시 대리 기록 →" : "지시 기록 →"}</summary>
            <form action={ceoDirect} className={s.respForm}>
              <Hidden />
              <label>지시 *
                <select name="kind" defaultValue={r.byKind.get("ceo_prevent") ? "ceo_cause" : "ceo_prevent"}>
                  {CEO_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select></label>
              <label>시각<input type="datetime-local" name="done_at" defaultValue={defAt} /></label>
              <label>받는 사람<StaffPicker name="target_staff_id" staff={staffOpts} label="받는 사람" defaultValue={i.owner_staff_id || ""} allowEmpty /></label>
              <label className={s.wide}>지시 내용 *<input type="text" name="detail" required /></label>
              {!i.investigated_at && <label>조사 기한<input type="date" name="cause_due" defaultValue={i.cause_due || ""} /></label>}
              <button className="btn sm" type="submit">지시 기록</button>
            </form>
          </details>
        </div>
      )}
    </details>
  );
}

/** 사고 전 이력 — 같은 시설의 이전 유해·위험요인 신고가 있었나. */
export function PriorHazards({ i, r, role }: { i: Row; r?: RespView; role: string }) {
  if (!i.asset_id) return <div className={s.prior}><b>사전 신고</b> <span className="muted">대조 불가</span></div>;
  const hz = r?.priorHz || [];
  if (!hz.length) return <div className={s.prior}><b>사전 신고</b> <span className="muted">없음</span></div>;
  return (
    <div className={`${s.prior} ${s.priorHit}`}>
      <b>사전 신고 {hz.length}건</b>
      {hz.map((h) => (
        <div key={h.hz_id}>
          <Link href={`/hazards/${h.hz_id}?role=${role}`}>{hid(h.hz_id)}</Link> {String(h.received_at).slice(5, 10)} <span className="muted">{h.done_at ? "조치 완료" : "조치 미완"}</span>
        </div>
      ))}
    </div>
  );
}
