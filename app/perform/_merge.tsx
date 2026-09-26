/**
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 몫 B(의무이행).
 *  체계 수립(/system) · 체계 기록(/system/record · /system/civil)을 의무이행(실적증빙) 안으로 들이는 길과 틀.
 *  자료는 옮기지 않는다 — 체계 기록은 제 표(system_record · 반기 점검 등)에, 의무이행 단계는 제 표(usc/usd/use_record)에 그대로 쌓인다.
 *   · ClauseSummary  = 각 대상 의무이행 첫 화면의 「호별 현황」 요약(호 · 상태 · 부족 · 입력하는 단계) + 전체 보기(/system)
 *   · RecordLink     = 단계 화면에서 같은 호의 체계 기록(경영책임자 보고받음 포함)을 여는 줄
 *   · MergedTitle    = 옛 화면 제목 줄(제목 + 「← 받는 화면으로」)
 *   · WS_REC_STEP · FC_REC_STEP = 체계 기록의 호 → 그 호를 다루는 의무이행 단계(좌측에서 켜 둘 단계)
 * 모양은 app/us-lsx.css 끝의 b26- 클래스.
 */
import Link from "next/link";
import { STEPS, type TrackKey } from "@/lib/us/tracks";
import { systemStatus, civilStatus, materialStatus, ST_LABEL, ST_TONE, type Clause, type St } from "@/lib/system";

/** 시행령 호 → 의무이행 단계(key). 단계가 없는 호(제4조제9호 도급 등)는 비운다 — 호별 현황 전체 보기에서 다룬다. */
export const CLAUSE_STEP: Record<TrackKey, Record<number, string>> = {
  // 시행령 제4조 — 제6호(전문인력 배치)는 3) 안전보건관계자 배치(제2호·제5호·제6호) 단계
  ws: { 1: "goal", 2: "org", 3: "risk", 4: "budget", 5: "work", 6: "staff", 7: "opinion", 8: "emergency" },
  // 시행령 제10조 · 제11조(no 11~14 = 제11조제2항제1~4호) — 제5호 반기 점검·제6호 조치는 3) 안전점검 단계(제안서 「공중이용시설 3) 안전점검」)
  fc: { 1: "staff", 2: "budget", 3: "inspect", 4: "plan", 5: "inspect", 6: "inspect", 7: "proc", 11: "law", 12: "law", 13: "law", 14: "law" },
  // 시행령 제8조 · 제9조(no 6 = 제9조제2항제1·2호, 7 = 제3·4호)
  mt: { 1: "staff", 2: "budget", 4: "proc", 6: "law", 7: "law" },
};

/** 체계 기록(/system/record?clause=N)의 호 → 사업장 단계 · (/system/civil?clause=N) → 공중이용시설 단계 */
export const WS_REC_STEP: Record<number, string> = { 1: "goal", 3: "risk", 5: "work", 7: "opinion", 8: "emergency" };
export const FC_REC_STEP: Record<number, string> = { 4: "plan", 5: "inspect", 7: "proc" };
/** 단계 화면의 체계 기록 줄 — 그 기록 화면에서 하는 일 */
export const WS_REC_WHAT: Record<number, string> = {
  1: "경영방침·목표 문서 등록·개정 · 경영책임자 보고받음",
  3: "절차 문서 등록·개정 · 반기 점검 기록 · 경영책임자 보고받음",
  5: "권한·예산 부여 · 반기 업무수행 평가 · 평가 기준표 · 경영책임자 보고받음",
  7: "의견 접수·처리 · 반기 점검 · 위원회·협의체 논의 기록 · 경영책임자 보고받음",
  8: "조치 매뉴얼 등록·개정 · 반기 점검(훈련) 기록 · 경영책임자 보고받음",
};
export const FC_REC_WHAT: Record<number, string> = {
  4: "안전계획 등록 · 항목 이행 입력 · 경영책임자 보고받음",
  5: "제1호~제4호 반기 점검 · 제6호 조치 · 경영책임자 보고받음",
  7: "업무처리절차 문서 등록·개정 · 개정 이력 · 경영책임자 보고받음",
};
/** 단계 key → 체계 기록의 호(단계 화면에서 체계 기록 줄을 보일지) */
export const recNoOf = (m: Record<number, string>, step: string) => {
  const hit = Object.entries(m).find(([, k]) => k === step);
  return hit ? Number(hit[0]) : 0;
};

const AREA: Record<TrackKey, "I" | "F" | "M"> = { ws: "I", fc: "F", mt: "M" };
const REF: Record<TrackKey, string> = { ws: "시행령 제4조", fc: "시행령 제10조·제11조", mt: "시행령 제8조·제9조" };
export const systemHref = (t: TrackKey, role: string) => `/system?role=${role}${AREA[t] === "I" ? "" : `&area=${AREA[t]}`}`;
const refOf = (c: Clause) => (c.ref || `시행령 제4조제${c.no}호`).replace("시행령 ", "");

/**
 * 「호별 현황」 요약 — 체계 수립 화면(/system)의 호별 표를 줄여 의무이행 첫 화면에 둔다.
 * 접힌 채로 열고(교육자료 모양의 단계 화면을 가리지 않게), 머리 줄에 갖춰짐·일부·없음을 센다.
 * stepHref(key) = 이 대상의 그 단계 주소(사업장·부서·대상 고른 값 유지).
 */
export async function ClauseSummary({ track, role, stepHref }: { track: TrackKey; role: string; stepHref: (step: string) => string }) {
  let clauses: Clause[] = [], sts: St[] = [], na: boolean[] = [];
  let cnt = (_: St) => 0, unkN = 0;
  try {
    if (track === "ws") ({ clauses, sts, cnt, unkN } = await systemStatus(role));
    else if (track === "fc") ({ clauses, sts, cnt, unkN } = await civilStatus(role));
    else ({ clauses, sts, cnt, unkN, na } = await materialStatus(role));
  } catch {
    return null;   // 현황을 못 읽어도 단계 화면은 그대로 연다
  }
  const steps = STEPS[track];
  const label = (k: string) => { const i = steps.findIndex((s) => s.key === k); return i < 0 ? "" : `${i + 1}) ${steps[i].label}`; };
  const all = systemHref(track, role);
  const n = clauses.filter((_, i) => !na[i]).length;
  return (
    <details className="b26-sum">
      <summary>
        <b>호별 현황</b>
        <span className="b26-sum-ref">{REF[track]}</span>
        <span className="badge ok">갖춰짐 {cnt("ok")}/{n}</span>
        {cnt("part") > 0 && <span className="badge warn">일부 {cnt("part")}</span>}
        {cnt("none") > 0 && <span className="badge bad">없음 {cnt("none")}</span>}
        {unkN > 0 && <span className="badge none">확인 필요 {unkN}</span>}
        <span className="b26-sum-open">펼쳐 보기</span>
      </summary>
      <table className="us-tbl b26-sum-tbl">
        <thead><tr><th style={{ width: "22%" }}>조문</th><th>항목</th><th style={{ width: "11%" }}>상태</th><th style={{ width: "22%" }}>부족</th><th style={{ width: "24%" }}>입력하는 단계</th></tr></thead>
        <tbody>
          {clauses.map((c, i) => {
            const gap = na[i] ? undefined : c.checks.find((k) => k.st !== "ok" && k.st !== "unk") || c.checks.find((k) => k.st === "unk");
            const sk = CLAUSE_STEP[track][c.no];
            const anchor = c.anchor || `c${c.no}`;
            return (
              <tr key={anchor}>
                <td title={c.ref || ""}>{refOf(c)}</td>
                <td title={c.text}><b>{c.name}</b></td>
                <td className="c">{na[i] ? <span className="badge none">해당 없음</span> : <span className={`badge ${ST_TONE[sts[i]]}`}>{ST_LABEL[sts[i]]}</span>}</td>
                <td title={gap?.fix || gap?.basis || ""}>{gap ? gap.label : <span className="muted">—</span>}</td>
                <td>{sk ? <Link href={stepHref(sk)}>{label(sk)} →</Link> : <Link href={`${all}#${anchor}`}>호별 현황에서 보기 →</Link>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="b26-sum-foot"><Link className="us-btn-s" href={all}>호별 현황 전체 보기(선임·지정 · 경영방침 · 절차·매뉴얼) →</Link></div>
    </details>
  );
}

/** 단계 화면 → 같은 호의 체계 기록(따로 쌓이는 기록 · 경영책임자 보고받음 포함)을 여는 줄. */
export function RecordLink({ href, clause, what }: { href: string; clause: string; what: string }) {
  return (
    <div className="b26-rec">
      <span className="b26-rec-h">{clause} 체계 기록</span>
      <span className="b26-rec-t">{what}</span>
      <Link className="us-btn-s" href={href}>체계 기록 열기 →</Link>
    </div>
  );
}

/** 옛 화면 제목 줄 — 제목 + 「← 받는 화면으로」. */
export function MergedTitle({ title, back, backLabel }: { title: React.ReactNode; back: string; backLabel: string }) {
  return (
    <div className="b26-title">
      <h1 className="v2h">{title}</h1>
      <Link className="b26-back" href={back}>← {backLabel}</Link>
    </div>
  );
}
