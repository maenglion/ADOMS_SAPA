/**
 * 법조문 원문 한 덩어리(조 전문 또는 별표) — 「조문 보기」 공용(2026-09-24).
 *  · 조 · 항 · 호 · 목을 들여쓰기로 · 의무가 걸린 조항호목은 녹색 띠 + 「의무」 표시
 *  · 법령 개정 반영분은 「개정 반영」(옛 본문 접어 둠) · 시행일이 아직 안 온 것은 「시행 예정」 새 본문을 따로
 * 원문은 lib/lawtext.ts(정본 발행 판에서 뽑은 원문 + 반영한 개정)에서만 온다.
 */
import type { LawUnit } from "@/lib/lawtext";

export function LawArticle({ units, mark }: { units: LawUnit[]; mark?: Set<string> }) {
  return (
    <div className="lt-art">
      {units.map((u, i) => {
        const on = !!mark?.has(u.u);
        const lv = Math.max(0, Number(u.d || (u.t === "subitem" ? 4 : u.t === "item" ? 3 : u.t === "para" ? 2 : 1)) - 1);
        return (
          <div key={`${u.p}-${i}`} className={`lt-u lt-d${lv}${on ? " on" : ""}${u.del ? " del" : ""}`}>
            {on && <span className="lt-tag">의무</span>}
            {u.added && <span className="lt-tag new">개정 신설</span>}
            {u.old && <span className="lt-tag upd">개정 반영</span>}
            {u.x && <span className="lt-x">{u.x}</span>}
            {u.next && (
              <div className="lt-next"><b>시행 예정 {u.nextFrom}</b> {u.next}</div>
            )}
            {u.old && (
              <details className="lt-old"><summary>개정 전 본문</summary>{u.old}</details>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LawSchedule({ title, text }: { title: string; text: string }) {
  return (
    <div className="lt-art lt-sch">
      <div className="lt-sch-t">{title}</div>
      <pre className="lt-pre">{text}</pre>
    </div>
  );
}
