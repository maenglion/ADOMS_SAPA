"use client";
/**
 * [400 · 교육자료 버전] 묶음 B1 — 화면 안에서 바로 움직여야 하는 칸만 여기 둔다(클라이언트 JS 최소).
 *   HeadcountMatrix(근무인원 합계 자동 계산 · SCR-028) · IndustryPick(업종분류 → 코드 자동 채움)
 *   WorkerRows(업무 담당자 추가·삭제 · 직원 검색) · SupRows(관리감독자 + 행) · FileRows(첨부 +/−)
 *   HazardPicker(위험장소·작업 칩 ↔ 체크 목록 · SCR-032)
 * 저장은 모두 서버 액션(actions.ts)이 폼 값을 받아 한다.
 */
import { useMemo, useState } from "react";

type Person = { name: string; org: string; phone: string; pos: string };

/* ── 근무인원 매트릭스 ─────────────────────────────── */
export function HeadcountMatrix({ types, rows, init }: { types: string[]; rows: string[]; init: Record<string, number[]> }) {
  const [v, setV] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(rows.map((r) => [r, types.map((_, i) => Number(init?.[r]?.[i] || 0))])));
  const sum = (r: string) => v[r].reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return (
    <>
      <div className="usb1-hc-tot">
        <span>총 현원 : {sum(rows[0])}</span>
        <span>총 현업업무 종사자 : {sum(rows[1])}</span>
      </div>
      <table className="usb1-hc">
        <thead>
          <tr><th />{types.map((t) => <th key={t}>{t} <i className="usb1-req">*</i></th>)}<th>합계</th></tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td className="usb1-hc-row">{r}</td>
              {types.map((t, ti) => (
                <td key={t}>
                  <input type="number" min={0} required name={`hc_${ri}_${ti}`} value={v[r][ti]}
                    onChange={(e) => { const n = { ...v, [r]: [...v[r]] }; n[r][ti] = Math.max(0, Number(e.target.value || 0)); setV(n); }} />
                </td>
              ))}
              <td><input type="number" readOnly value={sum(r)} className="usb1-ro" tabIndex={-1} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ── 업종분류(안) ↔ 업종분류 코드 ───────────────────── */
export function IndustryPick({ options, cls, code }: { options: { label: string; code: string }[]; cls: string; code: string }) {
  const [c, setC] = useState(cls);
  const [k, setK] = useState(code);
  return (
    <div className="usb1-row2">
      <label className="usb1-lab">업종분류(안) (한국표준산업분류가분)</label>
      <select name="ind_class" value={c} onChange={(e) => {
        setC(e.target.value);
        const o = options.find((x) => x.label === e.target.value);
        if (o?.code) setK(o.code);
      }}>
        <option value="">선택하세요</option>
        {options.map((o) => <option key={o.label}>{o.label}</option>)}
      </select>
      <label className="usb1-lab">업종분류 코드</label>
      <input type="text" name="ind_code" value={k} onChange={(e) => setK(e.target.value)} />
    </div>
  );
}

/* ── 직원 검색(작은 펼침 목록) ───────────────────────── */
function Search({ people, q, onPick }: { people: Person[]; q: string; onPick: (p: Person) => void }) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => people.filter((p) => !q || p.name.includes(q) || p.org.includes(q)).slice(0, 12), [people, q]);
  return (
    <span className="usb1-srch">
      <button type="button" className="usb1-srch-b us-search-btn" onClick={() => setOpen(!open)}>검색</button>
      {open && (
        <span className="usb1-srch-pop">
          {list.length ? list.map((p) => (
            <button type="button" key={p.name + p.org} onClick={() => { onPick(p); setOpen(false); }}>
              <b>{p.name}</b> {p.pos} · {p.org}
            </button>
          )) : <em>찾는 직원이 없습니다</em>}
        </span>
      )}
    </span>
  );
}

/* ── 업무 담당자 반복 행 ───────────────────────────── */
type W = { name: string; org: string; phone: string };
export function WorkerRows({ init, people }: { init: W[]; people: Person[] }) {
  const [rows, setRows] = useState<W[]>(init.length ? init : [{ name: "", org: "", phone: "" }]);
  const set = (i: number, p: Partial<W>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="usb1-block">
      <div className="usb1-block-h">
        <span className="usb1-lab">업무 담당자</span>
        <button type="button" className="usb1-btn-o" onClick={() => setRows([...rows, { name: "", org: "", phone: "" }])}>추가</button>
      </div>
      {rows.map((r, i) => (
        <div className="usb1-wrow" key={i}>
          <span className="usb1-dot">이름</span>
          <span className="usb1-inbtn">
            <input type="text" name="w_name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            <Search people={people} q={r.name} onPick={(p) => set(i, { name: p.name, org: p.org, phone: p.phone })} />
          </span>
          <span className="usb1-dot">소속</span>
          <input type="text" name="w_org" value={r.org} onChange={(e) => set(i, { org: e.target.value })} />
          <span className="usb1-dot">연락처</span>
          <input type="text" name="w_phone" value={r.phone} onChange={(e) => set(i, { phone: e.target.value })} />
          <button type="button" className="usb1-btn-del" onClick={() => setRows(rows.filter((_, j) => j !== i))}>🗑 삭제</button>
        </div>
      ))}
    </div>
  );
}

/* ── 관리감독자 반복 행(SCR-029) ─────────────────────── */
type S = { state: string; name: string; phone: string; pos: string; from: string; to: string };
const EMPTY_S: S = { state: "지정", name: "", phone: "", pos: "", from: "", to: "" };
export function SupRows({ init, people }: { init: S[]; people: Person[] }) {
  const [rows, setRows] = useState<S[]>(init.length ? init : [EMPTY_S]);
  const set = (i: number, p: Partial<S>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <>
      {rows.map((r, i) => (
        <div className="usb1-srow" key={i}>
          {/* TODO: 확인 — 명세는 현재값 「지정」만 보인다. 선택지 「미지정」은 추정(판독불확실) */}
          <select name="s_state" value={r.state} onChange={(e) => set(i, { state: e.target.value })}>
            <option>지정</option><option>미지정</option>
          </select>
          {i === 0
            ? <button type="button" className="usb1-plus" title="행 추가" onClick={() => setRows([...rows, { ...EMPTY_S }])}>+</button>
            : <button type="button" className="usb1-plus" title="행 삭제" onClick={() => setRows(rows.filter((_, j) => j !== i))}>−</button>}
          <span className="usb1-sl">이름</span>
          <span className="usb1-inbtn">
            <input type="text" name="s_name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            <Search people={people} q={r.name} onPick={(p) => set(i, { name: p.name, phone: p.phone, pos: p.pos })} />
          </span>
          <span className="usb1-sl">연락처</span>
          <input type="text" name="s_phone" value={r.phone} onChange={(e) => set(i, { phone: e.target.value })} />
          <span className="usb1-sl">직위</span>
          <input type="text" name="s_pos" value={r.pos} onChange={(e) => set(i, { pos: e.target.value })} className="usb1-w6" />
          <span className="usb1-sl">선임시기</span>
          <input type="date" name="s_from" value={r.from} onChange={(e) => set(i, { from: e.target.value })} />
          <span>~</span>
          <input type="date" name="s_to" value={r.to} onChange={(e) => set(i, { to: e.target.value })} />
        </div>
      ))}
    </>
  );
}

/* ── 첨부파일 +/− ──────────────────────────────────── */
type F = { name: string; url: string };
/**
 * 이미 붙은 파일은 목록으로 보이고 「−」로 연결만 끊는다(파일 자체는 지우지 않는다 — 시행령 제13조 5년 보관).
 * 「+」는 새 파일 칸을 연다. 폼 이름: `${prefix}keep`(남길 파일 JSON) · `${prefix}nf_N` / `${prefix}nfn_N`.
 */
export function FileRows({ prefix = "", init, emptyRow = false }: { prefix?: string; init: F[]; emptyRow?: boolean }) {
  const [keep, setKeep] = useState<F[]>(init);
  const [n, setN] = useState(emptyRow && !init.length ? 1 : 0);
  return (
    <div className="usb1-files">
      <input type="hidden" name={`${prefix}keep`} value={JSON.stringify(keep)} />
      {keep.map((f, i) => (
        <div className="usb1-frow" key={`k${i}`}>
          <span className="us-ev-name">{f.url ? <a href={f.url} target="_blank">{f.name}</a> : f.name}</span>
          <button type="button" className="usb1-mini" title="첨부 해제" onClick={() => setKeep(keep.filter((_, j) => j !== i))}>−</button>
        </div>
      ))}
      {Array.from({ length: n }).map((_, i) => (
        <div className="usb1-frow" key={`n${i}`}>
          <input type="hidden" name={`${prefix}nfn_${i}`} value="" />
          <input type="file" name={`${prefix}nf_${i}`} className="usb1-file" />
          <button type="button" className="usb1-mini" title="칸 빼기" onClick={() => setN(n - 1)}>−</button>
        </div>
      ))}
      <button type="button" className="usb1-plus" title="파일 추가" onClick={() => setN(n + 1)}>+</button>
    </div>
  );
}

/* ── 위험장소·작업 선택(SCR-032) ─────────────────────── */
type P = { place_code: string; no: string; place_name: string; note: string; basis: string };
export function HazardPicker({ places, selected, hint }: { places: P[]; selected: string[]; hint: string[] }) {
  const [sel, setSel] = useState<string[]>(selected);
  const toggle = (c: string) => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]);
  const short = (s: string) => (s.length > 10 ? `${s.slice(0, 10)}…` : s);
  return (
    <>
      <input type="hidden" name="place_codes" value={sel.join(";")} />
      <div className="usb1-chips">
        <span className="usb1-chips-h">위험장소·작업 선택 〉</span>
        <span className="usb1-chips-l">
          {places.filter((p) => sel.includes(p.place_code)).map((p) => (
            <span className="usb1-chip" key={p.place_code} title={p.place_name}>
              {p.no}. {short(p.place_name)}
              <button type="button" onClick={() => toggle(p.place_code)}>×</button>
            </span>
          ))}
        </span>
        <button type="button" className="usb1-btn-o" onClick={() => setSel([])}>전체해제</button>
      </div>
      <div className="usb1-plist">
        <div className="usb1-plist-h">업무수행장소·작업 해당 시 선택</div>
        <div className="usb1-pgrid">
          {places.map((p) => {
            const on = sel.includes(p.place_code);
            return (
              <button type="button" key={p.place_code} className={`usb1-pitem${on ? " on" : ""}${!on && hint.includes(p.place_code) ? " hint" : ""}`}
                onClick={() => toggle(p.place_code)}>
                <span className="usb1-ptxt">
                  {p.no}. {p.place_name}
                  {p.note && p.note.split(" | ").map((x) => <small key={x}>{x}</small>)}
                  <small className="usb1-basis">{p.basis}</small>
                </span>
                <span className="usb1-chk">✔</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
