import Link from "next/link";
import StaffPicker from "@/components/StaffPicker";
import Thumb from "@/components/Thumb";
import { loadHazards, staffOpts, REPEAT_N } from "../load";
import {
  FLOW_MINOR, FLOW_SERIOUS, ORDER_TYPES, REPORT_LIMIT_H,
  hid, nextOf, parseFix, ddayLabel, type Stage,
} from "../codes";
import { FixRows } from "../Pickers";
import {
  recordProtect, judgeReport, closeMinor, reportCeo, recordInspection, orderFix, savePlan, markFix,
} from "../actions";
import Steps, { Facts, type Step } from "@/components/Steps";
import s from "../hazards.module.css";

export const dynamic = "force-dynamic";

// [캡처 v2] 단계 막대(Steps)·핵심 5칸을 맨 위로, 지금 할 일 바로 아래. 신고 내용·처리 기록·계획·이력은 접기. 법령 인용·안내 문장 제거(09-22)
/** 단계 이름 줄임(2~6자). */
const SHORT: Record<string, string> = {
  "접수": "접수", "피해방지": "피해방지", "1차 판단": "판단", "종결": "종결", "경영책임자 보고": "보고",
  "긴급안전점검": "긴급점검", "개선 지시": "개선지시", "보수·보강 계획": "보수계획", "완료": "완료",
};

export default async function HazardDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const { rows, steps, deptName, staffName, staff } = await loadHazards();
  const r = rows.find((x) => x.hz_id === decodeURIComponent(id));
  if (!r) return <p>신고를 찾지 못했습니다. <Link href={`/hazards?role=${role}`}>목록으로</Link></p>;

  const who = (sid?: string) => (sid ? staffName.get(sid) || sid : "—");
  const opts = staffOpts(staff, deptName);
  const serious = r.severity === "심각";
  const flow: string[] = serious ? FLOW_SERIOUS : r.severity === "경미" ? FLOW_MINOR : [...FLOW_MINOR.slice(0, 3), "경영책임자 보고"];
  const at = flow.indexOf(r.stage as Stage);
  const mySteps = steps.filter((x) => x.hz_id === r.hz_id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const same = rows.filter((x) => x.asset_id === r.asset_id && x.hz_id !== r.hz_id);
  const pics = [
    r.photo_wide && { url: r.photo_wide, name: "사진① 전경", type: "image/jpeg", meta: r.location },
    r.photo_close && { url: r.photo_close, name: "사진② 근접", type: "image/jpeg", meta: r.location },
  ].filter(Boolean) as any[];
  const fix = parseFix(r.fix_items);
  const fixSum = fix.reduce((a, x) => a + (parseFloat(x.cost.replace(/,/g, "")) || 0), 0);
  const dl = r.deadline;
  const H = ({ n }: { n: string }) => <input type="hidden" name={n === "role" ? "role" : "hz_id"} value={n === "role" ? role : r.hz_id} />;
  const Hid = () => (<><H n="role" /><H n="hz" /></>);

  const bar: Step[] = flow.map((f, i) => ({
    label: SHORT[f] || f,
    state: i <= at ? "done" : i === at + 1 && r.open ? (serious && f === "경영책임자 보고" && r.reportLate ? "warn" : "on") : "",
  }));
  const ddl = dl && r.open ? (r.fix_started_at ? { l: dl.doneLeft, bad: dl.doneLate, k: "완료" } : { l: dl.startLeft, bad: dl.startLate, k: "착수" }) : null;

  return (
    <>
      <div className="crumb"><Link href={`/hazards?role=${role}`}>유해·위험요인</Link> › {hid(r.hz_id)}</div>
      <h1 className="v2h">{r.asset_name}</h1>
      <div className="chips">
        {r.severity ? <span className={`badge ${serious ? "bad" : "ok"}`}>{r.severity}</span> : <span className="badge none">판단 전</span>}
        {r.repeatN >= REPEAT_N && <span className="badge warn">반복 {r.repeatN}회</span>}
        <span className="badge none">{r.accident_type}</span>
      </div>

      <Steps items={bar} />

      <Facts items={[
        { k: "무엇", v: <span title={r.description}>{r.description}</span> },
        { k: "누가", v: deptName.get(r.dept_id) || r.dept_id },
        { k: "접수", v: String(r.received_at).slice(5, 10) },
        { k: "사진", v: pics.length < 2 ? <b className="tone-bad">{pics.length}/2</b> : "2/2" },
        { k: ddl ? `${ddl.k} 기한` : "상태", v: ddl && ddl.l !== null ? <b className={ddl.bad ? "tone-bad" : ""}>{ddayLabel(ddl.l!)}</b> : r.stage },
      ]} />

      {/* 지금 할 일 */}
      {r.open && (
        <div className={`card ${s.act}`} style={{ marginTop: 12 }}>
          <h3>지금 할 일 — {nextOf(r)}</h3>

          {r.stage === "접수" && (
            <form action={recordProtect}>
              <Hid />
              <div className={s.checks}>
                {["대피", "접근차단", "통제", "위험 표지", "유관기관 신고"].map((k) => (
                  <label key={k}><input type="checkbox" name="protect_kind" value={k} /> {k}</label>
                ))}
              </div>
              <div className={s.row}><input type="text" name="protect_memo" placeholder="예: 구간 통제, 우회 안내" />
                <button className="btn" type="submit">기록</button></div>
            </form>
          )}

          {r.stage === "피해방지" && (
            <form action={judgeReport}>
              <Hid />
              <div className={s.checks}>
                <label><input type="radio" name="severity" value="경미" required /> <b>경미</b> — 즉시 조치·종결</label>
                <label><input type="radio" name="severity" value="심각" /> <b>심각</b> — 경영책임자 보고</label>
              </div>
              <div className={s.row} style={{ marginBottom: 8 }}><span className="muted">판단자</span>
                <StaffPicker name="judged_by" staff={opts} defaultValue="SM02-2" label="판단자" /></div>
              <div className={s.row}><input type="text" name="judge_memo" placeholder="판단 이유" />
                <button className="btn" type="submit">판단 기록</button></div>
            </form>
          )}

          {r.stage === "1차 판단" && r.severity === "경미" && (
            <form action={closeMinor}>
              <Hid />
              <div className={s.row}><input type="text" name="minor_action" required placeholder="즉시 조치 내용" />
                {r.channel === "시민 신고"
                  ? <label className={s.checks} style={{ margin: 0 }}><input type="checkbox" name="notify" value="Y" defaultChecked /> 신고자 통보</label>
                  : <input type="hidden" name="notify" value="" />}
                <button className="btn" type="submit">종결</button></div>
            </form>
          )}

          {r.stage === "1차 판단" && serious && (
            <form action={reportCeo}>
              <Hid />
              <p style={{ margin: "0 0 8px" }}>판단 뒤 <b>{r.reportH}시간</b>{r.reportLate && <> <span className="badge bad">{REPORT_LIMIT_H}시간 넘음</span></>}</p>
              <div className={s.row}>
                <select name="mode" defaultValue="구두 선보고 후 서면"><option>구두 선보고 후 서면</option><option>서면</option><option>구두</option></select>
                <input type="datetime-local" name="reported_at" />
                <input type="text" name="instruction" placeholder="경영책임자 지시" />
                <button className="btn" type="submit">보고 기록</button>
              </div>
            </form>
          )}

          {r.stage === "경영책임자 보고" && (
            <form action={recordInspection}>
              <Hid />
              <div className={s.row}>
                <input type="date" name="insp_at" />
                <StaffPicker name="insp_by" staff={opts} defaultValue={`S${r.dept_id}-1`} label="점검자" />
              </div>
              <div className={s.row} style={{ marginTop: 8 }}>
                <input type="text" name="insp_result" required placeholder="긴급안전점검 결과" />
                <button className="btn" type="submit">결과 기록</button></div>
            </form>
          )}

          {r.stage === "긴급안전점검" && (
            <form action={orderFix}>
              <Hid />
              <div className={s.checks}>
                {ORDER_TYPES.map((k) => <label key={k}><input type="checkbox" name="order_type" value={k} defaultChecked={k === "보수·보강"} /> {k}</label>)}
              </div>
              <div className={s.row}>
                <input type="text" name="order_memo" placeholder="지시 내용" />
              </div>
              <div className={s.row} style={{ marginTop: 8 }}>
                <label className={s.checks} style={{ margin: 0 }}><input type="checkbox" name="fsam_applies" value="Y" defaultChecked={["1종", "2종", "3종"].includes(r.asset_class)} /> 법정 기한 적용</label>
                <span className="muted">기준일</span>
                <input type="date" name="basis_date" />
                <button className="btn" type="submit">지시 기록</button>
              </div>
            </form>
          )}

          {(r.stage === "개선 지시" || (r.stage === "보수·보강 계획" && !r.fix_started_at)) && (
            <form action={savePlan}>
              <Hid />
              <FixRows initial={fix} />
              <div className={s.row} style={{ marginTop: 8 }}>
                <input type="text" name="fix_budget" defaultValue={r.fix_budget} placeholder="예산 확보 여부" />
                <button className="btn" type="submit">{fix.length ? "계획 고치기" : "계획 저장"}</button>
              </div>
            </form>
          )}

          {r.stage === "보수·보강 계획" && (
            <form action={markFix} style={{ marginTop: 10 }}>
              <Hid />
              <input type="hidden" name="what" value={r.fix_started_at ? "done" : "start"} />
              <div className={s.row}>
                <span>{r.fix_started_at ? "완료일" : "착수일"}</span>
                <input type="date" name="at" />
                {r.fix_started_at && <input type="text" name="memo" placeholder="완료 내용" />}
                <button className="btn" type="submit">{r.fix_started_at ? "완료 기록" : "착수 기록"}</button>
              </div>
            </form>
          )}
        </div>
      )}

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>신고 내용</summary>
        <dl className={s.kv}>
          <dt>접수</dt><dd>{String(r.received_at).slice(0, 16)} · {r.channel} · {r.reporter || "—"} · {who(r.received_by)}</dd>
          <dt>시설</dt><dd><Link href={`/targets/${encodeURIComponent(r.asset_id)}?role=${role}`}>{r.asset_name}</Link> <span className="muted">{r.asset_class || ""}</span></dd>
          <dt>위치</dt><dd>{r.location || "—"}</dd>
          <dt>분류</dt><dd>{r.code_group} · {r.code}</dd>
          <dt>가능 사고</dt><dd>{r.possible_accident || "—"}</dd>
          <dt>사진</dt><dd>{pics.length ? <Thumb pics={pics} size={88} /> : <span className={s.nophoto}>없음</span>}</dd>
        </dl>
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>처리 기록</summary>
        <dl className={s.kv}>
          <dt>피해방지</dt><dd>{r.protect_action || "—"}</dd>
          <dt>판단</dt><dd>{r.severity ? <>{r.severity} · {who(r.judged_by)} · {String(r.judged_at).slice(5, 16)}</> : "—"}</dd>
          {r.severity === "경미" && <>
            <dt>즉시 조치</dt><dd>{r.minor_action || "—"}</dd>
            <dt>신고자 통보</dt><dd>{r.notified_reporter === "Y" ? `통보 ${r.notified_at}` : r.closed_at && r.channel === "시민 신고" ? <span className="badge warn">안 함</span> : "—"}</dd>
          </>}
          {serious && <>
            <dt>보고</dt><dd>{r.ceo_reported_at
              ? <>{String(r.ceo_reported_at).slice(5, 16)} · {who(r.ceo_reported_by)} · {r.reportH}시간{r.reportLate && <> <span className="badge bad">초과</span></>}</>
              : <span className="badge bad">보고 전</span>}</dd>
            <dt>긴급점검</dt><dd>{r.insp_at ? <span title={r.insp_result}>{r.insp_at} · {who(r.insp_by)}</span> : "—"}</dd>
            <dt>개선 지시</dt><dd>{r.order_at ? <span title={r.order_memo}>{r.order_types} · {r.order_at}</span> : "—"}</dd>
            {dl && <><dt>기한</dt><dd>착수 {dl.startBy}{r.fix_started_at ? " (착수함)" : ""} · 완료 {dl.doneBy}{r.fix_done_at ? " (완료)" : ""}</dd></>}
          </>}
        </dl>
        {serious && fix.length > 0 && (
          <table className="v2t" style={{ marginTop: 8 }}>
            <thead><tr><th>개선 항목</th><th>물량</th><th className="num">만원</th><th>기간</th></tr></thead>
            <tbody>
              {fix.map((x, i) => <tr key={i}><td title={x.item}>{x.item}</td><td>{x.qty}</td><td className="num">{x.cost}</td><td>{x.period}</td></tr>)}
              <tr><td colSpan={2}><b>합계</b></td><td className="num"><b>{fixSum.toLocaleString()}</b></td><td>{r.fix_budget}</td></tr>
            </tbody>
          </table>
        )}
      </details>

      {same.length > 0 && (
        <details className="card fold" style={{ marginTop: 12 }}>
          <summary>같은 시설 신고 <span className="muted">{same.length}</span></summary>
          <table className="v2t"><tbody>
            {same.slice(0, 10).map((x) => (
              <tr key={x.hz_id}><td><Link href={`/hazards/${x.hz_id}?role=${role}`}>{hid(x.hz_id)}</Link></td>
                <td className="dt">{String(x.received_at).slice(5, 10)}</td>
                <td>{x.accident_type}{x.accident_type === r.accident_type && <> <span className="badge warn">같음</span></>}</td>
                <td title={x.description}>{x.description}</td></tr>
            ))}
          </tbody></table>
        </details>
      )}

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>처리 이력 <span className="muted">{mySteps.length}</span></summary>
        <table className="v2t"><tbody>
          {mySteps.map((x) => (
            <tr key={x.step_id}><td className="dt">{String(x.at).slice(5, 16)}</td><td>{x.step}</td><td title={x.memo}>{who(x.by)}{x.memo ? ` — ${x.memo}` : ""}</td></tr>
          ))}
          {!mySteps.length && <tr><td className="muted">없음</td></tr>}
        </tbody></table>
      </details>
    </>
  );
}
