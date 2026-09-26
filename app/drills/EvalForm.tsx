"use client";
import { Fragment, useState } from "react";
import { RUBRIC } from "./codes";

/** 평가표 100점 입력 — 칸마다 배점 안에서 점수를 넣으면 영역별·전체 합계가 바로 바뀐다. */
export default function EvalForm({ initial }: { initial: Record<string, string> | null }) {
  const init: Record<string, number> = {};
  RUBRIC.forEach((g) => g.items.forEach((i) => { init[i.k] = Number(initial?.[i.k] ?? "") || 0; }));
  const [v, setV] = useState(init);
  const sum = (keys: string[]) => keys.reduce((a, k) => a + (v[k] || 0), 0);
  const total = sum(Object.keys(v));
  return (
    <table>
      <thead><tr><th>점검 항목</th><th className="num" style={{ width: 80 }}>배점</th><th style={{ width: 120 }}>점수</th></tr></thead>
      <tbody>
        {RUBRIC.map((g) => (
          <Fragment key={g.g}>
            <tr><td colSpan={2} style={{ background: "#f4f7fb" }}><b>{g.g}</b></td>
              <td className="num" style={{ background: "#f4f7fb" }}><b>{sum(g.items.map((i) => i.k))}</b> / {g.total}</td></tr>
            {g.items.map((i) => (
              <tr key={i.k}>
                <td>{i.t}</td>
                <td className="num">{i.max}</td>
                <td><input type="number" name={i.k} min={0} max={i.max} step={1} value={v[i.k]}
                  onChange={(e) => setV({ ...v, [i.k]: Math.max(0, Math.min(i.max, Number(e.target.value) || 0)) })}
                  style={{ width: 80, font: "inherit", padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 8 }} /></td>
              </tr>
            ))}
          </Fragment>
        ))}
        <tr><td colSpan={2}><b>합계</b></td><td className="num"><b style={{ fontSize: "1.2rem" }}>{total}</b> / 100</td></tr>
      </tbody>
    </table>
  );
}
