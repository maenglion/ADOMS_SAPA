"use client";
/**
 * [400 · 교육자료 버전] SCR-091·092 발생통계 — 위 「발생 목록」 + 아래 「사고 내용」(선택한 사고 한 건 상세).
 *  09-25 사용자: 예시 화면은 20칸 표 하나를 위아래로 쪼개 같은 사고가 두 표에 한 번씩 나왔다 → 중복이 헷갈린다.
 *   · 위 = 사고 하나가 한 줄(재해유형 · 상해종류까지 보여 목록만 보고도 무슨 사고인지 안다)
 *   · 아래 = 고른 사고 한 건(처음에는 가장 최근 사고) — 사고과정 전문을 잘리지 않게 넓게
 */
import { useState } from "react";

type Col = { key: string; head: string; br?: [string, string] };
type Row = Record<string, any>;

const CENTER = new Set(["year", "seq", "comp", "disaster_kind", "sex", "lost_days", "birth_year", "occurred_at", "report_at", "approve_at", "acc_type", "injury"]);
const WIDE = new Set(["process", "note"]);

export default function OccTables({ rows, top, bottom }: { rows: Row[]; top: Col[]; bottom: Col[] }) {
  const [sel, setSel] = useState<string>(rows[0]?.occ_id || "");
  const cur = rows.find((r) => r.occ_id === sel) || rows[0];

  return (
    <div className="usg-occ2">
      <div className="usg-tbl-t">발생 목록 <span>최근 사고부터 · 줄을 누르면 아래에 그 사고의 내용이 나옵니다</span></div>
      <div className="usg-grid-scroll usg-occ-top">
        <table className="us-tbl usg-occ usg-occ-a">
          <thead>
            <tr>{top.map((c, i) => <th key={c.key} className={i < 2 ? `usg-fz${i}` : ""}>{c.br ? <>{c.br[0]}<br />{c.br[1]}</> : c.head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={top.length} className="c usg-empty">조건에 맞는 자료가 없습니다.</td></tr>}
            {rows.map((r) => (
              <tr key={r.occ_id} className={`usg-orow${cur && r.occ_id === cur.occ_id ? " on" : ""}`} onClick={() => setSel(r.occ_id)}>
                {top.map((c, i) => (
                  <td key={c.key} className={`${i < 2 ? `usg-fz${i} ` : ""}${CENTER.has(c.key) ? "c" : ""}`}>{r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="usg-tbl-t">사고 내용 <span>선택한 사고 한 건</span></div>
      {cur ? (
        <div className="usg-occ-card">
          <div className="usg-occ-card-h">
            <b>연번 {cur.seq}</b>
            <span>{cur.occurred_at}</span>
            <span>{[cur.org_name, cur.dept_name].filter(Boolean).join(" · ")}</span>
            {cur.acc_type && <span className="usg-occ-tag">{cur.acc_type}{cur.injury ? ` · ${cur.injury}` : ""}</span>}
          </div>
          <dl className="usg-occ-dl">
            {bottom.map((c) => (
              <div key={c.key} className={WIDE.has(c.key) ? "wide" : ""}>
                <dt>{c.head}</dt>
                <dd>{cur[c.key] || "-"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="us-muted">선택한 사고가 없습니다.</p>
      )}
    </div>
  );
}
