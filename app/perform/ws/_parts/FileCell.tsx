"use client";
/**
 * [400 · 교육자료 버전] 묶음 C — 증빙 파일 칸(파일선택 + 「+」 첨부 행 추가). 명세 G-6 증빙자료 칸.
 * 고른 파일 이름을 바로 보여 주려고 이 칸만 클라이언트로 둔다. 실제 저장은 폼의 「저장」(서버 동작)이 한다.
 */
import { useState } from "react";

export default function FileCell({ name, label = "파일선택", plus = true, disabled = false, empty = "선택된 파일 없음" }: {
  name: string; label?: string; plus?: boolean; disabled?: boolean; empty?: string;
}) {
  const [slots, setSlots] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  return (
    <div className="usc-fc">
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} className="usc-fc-row">
          <span className={`us-ev-name${names[i] ? "" : " empty"}`}>{names[i] || empty}</span>
          <label className={`us-btn-s${disabled ? " usc-off" : ""}`}>
            {label}
            <input type="file" name={name} hidden disabled={disabled}
              onChange={(e) => { const n = [...names]; n[i] = e.target.files?.[0]?.name || ""; setNames(n); }} />
          </label>
        </div>
      ))}
      {plus && !disabled && (
        <button type="button" className="usc-plus" title="첨부 추가" onClick={() => setSlots(slots + 1)}>+</button>
      )}
    </div>
  );
}
