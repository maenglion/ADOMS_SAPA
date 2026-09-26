"use client";
import { useState } from "react";
import { ymd } from "@/lib/day";

/**
 * 증빙 여러 줄 입력 — 참고 명세의 「표 인라인 입력 + 행 추가 + 저장」. (2026-09-21)
 * 한 과제에 증빙이 여러 개인 경우가 흔하다(점검표 + 현장사진 + 조치결과). 한 건씩 저장하게 하면
 * 담당자가 같은 화면을 세 번 오간다. 줄을 더해 한 번에 저장한다.
 *
 * 한 줄을 **두 단**으로 쌓는다(윗단: 날짜·종류·제목 / 아랫단: 파일·비고).
 * 표 한 줄에 여섯 칸을 늘어놓으면 좁은 칸에서 제목이 세로로 눌린다(실제로 그랬다).
 *
 * 필드 이름은 `kind_0`·`title_0`·`date_0`·`note_0`·`files_0` 처럼 줄 번호를 붙인다.
 */
const KINDS = ["점검표", "일지·대장", "계획서", "결과보고서", "교육일지", "사진", "계약서", "기타"];

export default function EvidenceRows({ defaultKind = "점검표" }: { defaultKind?: string }) {
  const today = ymd();
  const [rows, setRows] = useState<number[]>([0]);
  const [next, setNext] = useState(1);

  const add = () => { setRows([...rows, next]); setNext(next + 1); };
  const del = (k: number) => setRows(rows.length > 1 ? rows.filter((x) => x !== k) : rows);

  return (
    <div>
      <div className="erows">
        {rows.map((k, i) => (
          <div className="erow" key={k}>
            <div className="eno">{i + 1}</div>
            <div className="ebody">
              <div className="eline">
                <input type="date" name={`date_${k}`} defaultValue={today} className="edate" aria-label="날짜" />
                <select name={`kind_${k}`} defaultValue={i === 0 ? defaultKind : "사진"} className="ekind" aria-label="종류">
                  {KINDS.map((x) => <option key={x}>{x}</option>)}
                </select>
                <input type="text" name={`title_${k}`} required={i === 0} className="etitle" aria-label="제목"
                       placeholder={i === 0 ? "제목 — 예) 2026년 상반기 정기점검 결과표" : "제목 — 예) 현장 사진"} />
              </div>
              <div className="eline">
                <input type="file" name={`files_${k}`} multiple accept="image/*,application/pdf"
                       className="efile" aria-label="파일" />
                <input type="text" name={`note_${k}`} className="enote" placeholder="비고" aria-label="비고" />
              </div>
            </div>
            <button type="button" className="btn ghost sm edel" onClick={() => del(k)}
                    disabled={rows.length === 1} title="이 줄 지우기">−</button>
          </div>
        ))}
      </div>
      <input type="hidden" name="row_keys" value={rows.join(",")} />
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn ghost" onClick={add}>+ 줄 추가</button>
        <span style={{ flex: 1 }} />
        <span className="muted">{rows.length}줄 · 파일은 한 줄에 여러 개 · 한 파일 25MB 까지</span>
        <button className="btn" type="submit">저장하고 제출</button>
      </div>
    </div>
  );
}
